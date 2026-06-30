import { Injectable, Logger, Inject } from "@nestjs/common";
import { TenantContext } from "../../gateway/tenant-context.interface";
import { PrismaService } from "../../persistence/prisma.service";
import { Prisma } from "@prisma/client";
import { IFinanceRepository } from "./repositories/finance.repository.interface";
import { LedgerEntry } from "./entities/ledger-entry.entity";
import { Transaction } from "./entities/transaction.entity";
import { Balance } from "./entities/balance.entity";
import {
  CreateTransactionDto,
  TransactionType,
} from "./dto/create-transaction.dto";
import { CreateJournalDto } from "./dto/create-journal.dto";
import {
  Asset,
  CapexRequest,
  FinanceCapexBudgetRow,
  AssetDepreciationEntry,
  AssetEvent,
  AssetAuditPack,
  FinanceReceivableRow,
  ReceivableInvoice,
  FinancePayableRow,
  PayableBill,
  FinancePaymentRow,
  PaymentRequest,
  FinanceDocumentRow,
  FinancePolicyRow,
  AccountingPeriod,
  FinanceInsight,
  FinanceAlert,
  PayrollEntry,
  PayrollEstimate,
  BankTransaction,
  PerformanceTreeNode,
} from "./finance.types";
import { AuditService } from "../../shared/audit/audit.service";
import { FileProcessingService } from "../../shared/file-processing/file-processing.service";
import { CsvBankProvider, ModularApiBankProvider } from "../../shared/finance/bank-providers";

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    @Inject(IFinanceRepository)
    private readonly financeRepository: IFinanceRepository,
    private readonly auditService: AuditService,
    private readonly fileProcessingService: FileProcessingService,
    private readonly prisma: PrismaService,
    private readonly csvBankProvider: CsvBankProvider,
    private readonly apiBankProvider: ModularApiBankProvider,
  ) {}

  // Money Sources
  async getMoneySources(ctx: TenantContext) {
    return this.financeRepository.listMoneySources(ctx);
  }

  async listPeriods(ctx: TenantContext) {
    return this.financeRepository.listPeriods(ctx);
  }

  async getAlerts(ctx: TenantContext) {
    return this.financeRepository.getAlerts(ctx);
  }

  async listCapexBudgets(ctx: TenantContext) {
    return this.financeRepository.listCapexBudgets(ctx);
  }

  async listPolicies(ctx: TenantContext) {
    return this.financeRepository.listPolicies(ctx);
  }

  async getInbox(ctx: TenantContext) {
    // Inbox is a combination of unresolved alerts and pending payment requests
    const [alerts, payments] = await Promise.all([
      this.financeRepository.getAlerts(ctx),
      this.financeRepository.listPayments(ctx)
    ]);

    const pendingPayments = payments.filter(p => p.status === 'PENDING_APPROVAL');

    return {
      alerts,
      pendingPayments,
      totalCount: alerts.length + pendingPayments.length
    };
  }

  async listPayments(ctx: TenantContext) {
    return this.financeRepository.listPayments(ctx);
  }

  async listReceivables(ctx: TenantContext) {
    return this.financeRepository.listReceivables(ctx);
  }

  async listPayables(ctx: TenantContext) {
    return this.financeRepository.listPayables(ctx);
  }

  async markPayablePaid(ctx: TenantContext, id: string) {
    const result = await this.financeRepository.markPayablePaid(ctx, id);
    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id: ctx.user_id || "system",
      module: "finance",
      action: "UPDATE",
      entity_type: "PAYABLE",
      entity_id: id,
      metadata: { status: "PAID" },
    });
    return result;
  }

  async listJournals(ctx: TenantContext) {
    // Standardizing on 'ledger' as the repository method for journals
    return this.financeRepository.getLedger(ctx);
  }

  async listInvoices(ctx: TenantContext) {
    // Aggregated view of both AR and AP invoices
    const [ar, ap] = await Promise.all([
      this.financeRepository.listReceivables(ctx),
      this.financeRepository.listPayables(ctx)
    ]);

    // Map to a common Invoice interface
    const arInvoices = ar.map(i => ({
      id: i.id,
      vendor: (i as any).customerName || (i as any).customer, // Handle mapping variations
      amount: i.amount,
      invoiceDate: i.dueDate, // Use due date as placeholder if date is missing
      dueDate: i.dueDate,
      status: i.status,
      kind: 'RECEIVABLE'
    }));

    const apInvoices = ap.map(i => ({
      id: i.id,
      vendor: (i as any).vendorName || (i as any).vendor,
      amount: i.amount,
      invoiceDate: i.dueDate,
      dueDate: i.dueDate,
      status: i.status,
      kind: 'PAYABLE'
    }));

    return [...arInvoices, ...apInvoices];
  }

  // Assets
  async listAssets(ctx: TenantContext) {
    return this.financeRepository.listAssets(ctx);
  }

  async getAssetById(ctx: TenantContext, id: string) {
    return this.financeRepository.getAssetById(ctx, id);
  }

  async listAssetEvents(ctx: TenantContext, assetId?: string) {
    return this.financeRepository.listAssetEvents(ctx, assetId);
  }

  async listAssetDepreciationEntries(ctx: TenantContext, assetId?: string) {
    return this.financeRepository.listAssetDepreciationEntries(ctx, assetId);
  }

  async getAssetAuditPack(ctx: TenantContext, assetId: string) {
    return this.financeRepository.getAssetAuditPack(ctx, assetId);
  }

  // Asset Write Operations
  async createAsset(ctx: TenantContext, data: any, userId: string) {
    const asset = await this.financeRepository.createAsset(ctx, data);
    await this.auditService.log({ tenant_id: ctx.tenant_id, user_id: userId, module: 'FINANCE', action: 'ASSET_CREATED', entity_type: 'ASSET', entity_id: asset.id, metadata: data });
    return asset;
  }

  async capitalizeAsset(ctx: TenantContext, id: string, data: any, userId: string) {
    const asset = await this.financeRepository.updateAsset(ctx, id, { status: 'CAPITALIZED' as any, capitalizedAt: new Date(), ...data });
    await this.financeRepository.createAssetEvent(ctx, { assetId: id, type: 'MAINTENANCE', amount: data.amount || 0 } as any);
    await this.auditService.log({ tenant_id: ctx.tenant_id, user_id: userId, module: 'FINANCE', action: 'ASSET_CAPITALIZED', entity_type: 'ASSET', entity_id: id });
    return asset;
  }

  async postDepreciation(ctx: TenantContext, id: string, data: any, userId: string) {
    const entry = await this.financeRepository.createDepreciationEntry(ctx, { assetId: id, ...data, postedBy: userId });
    await this.financeRepository.createAssetEvent(ctx, { assetId: id, type: 'MAINTENANCE', amount: data.amount || 0 } as any);
    return entry;
  }

  async runScheduledDepreciation(ctx: TenantContext, data: any, userId: string) {
    const assets = await this.financeRepository.listAssets(ctx);
    const activeAssets = (Array.isArray(assets) ? assets : []).filter((a: any) => a.status === 'CAPITALIZED' || a.status === 'ACTIVE');
    const results: any[] = [];
    for (const asset of activeAssets) {
      try {
        const entry = await this.postDepreciation(ctx, asset.id, { postingDate: data.postingDate || new Date().toISOString(), method: (asset as any).depreciationMethod || 'STRAIGHT_LINE' }, userId);
        results.push({ asset_id: asset.id, status: 'success', entry });
      } catch (e: any) {
        results.push({ asset_id: asset.id, status: 'failed', error: e.message });
      }
    }
    return { total: activeAssets.length, processed: results.length, results };
  }

  async recordImpairment(ctx: TenantContext, id: string, data: any, userId: string) {
    await this.financeRepository.createAssetEvent(ctx, { assetId: id, type: 'IMPAIRMENT', amount: data.impairmentAmount } as any);
    return this.financeRepository.updateAsset(ctx, id, { currentValue: data.impairmentAmount } as any);
  }

  async recordRevaluation(ctx: TenantContext, id: string, data: any, userId: string) {
    await this.financeRepository.createAssetEvent(ctx, { assetId: id, type: 'REVALUATION', amount: data.revaluedAmount } as any);
    return this.financeRepository.updateAsset(ctx, id, { currentValue: data.revaluedAmount } as any);
  }

  async disposeAsset(ctx: TenantContext, id: string, data: any, userId: string) {
    await this.financeRepository.createAssetEvent(ctx, { assetId: id, type: 'DISPOSAL', amount: data.proceeds || 0 } as any);
    return this.financeRepository.updateAsset(ctx, id, { status: 'DISPOSED' as any } as any);
  }

  async updateAssetStatus(ctx: TenantContext, id: string, status: string, userId: string) {
    await this.financeRepository.createAssetEvent(ctx, { assetId: id, type: 'MAINTENANCE' } as any);
    return this.financeRepository.updateAsset(ctx, id, { status } as any);
  }

  async verifyAssetAuditPack(ctx: TenantContext, assetId: string, userId: string) {
    await this.financeRepository.createAssetEvent(ctx, { assetId, type: 'MAINTENANCE' } as any);
    return { verified: true, assetId, verifiedBy: userId, verifiedAt: new Date().toISOString() };
  }

  // CAPEX Requests
  async listCapexRequests(ctx: TenantContext) {
    return this.financeRepository.listCapexRequests(ctx);
  }

  async createCapexRequest(ctx: TenantContext, data: any, userId: string) {
    return this.financeRepository.createCapexRequest(ctx, { ...data, requestedBy: userId, status: 'PENDING' } as any);
  }

  async approveCapexRequest(ctx: TenantContext, id: string, userId: string) {
    return this.financeRepository.updateCapexRequest(ctx, id, { status: 'APPROVED' as any, approvedBy: userId, approvedAt: new Date() } as any);
  }

  async rejectCapexRequest(ctx: TenantContext, id: string, reason: string, userId: string) {
    return this.financeRepository.updateCapexRequest(ctx, id, { status: 'REJECTED' as any, rejectionReason: reason } as any);
  }

  async setCapexBudget(ctx: TenantContext, data: any, userId: string) {
    return this.financeRepository.setCapexBudget(ctx, data);
  }

  // Payment Requests
  async createPaymentRequest(ctx: TenantContext, data: any, userId: string) {
    return this.financeRepository.createPaymentRequest(ctx, { ...data, requestedBy: userId, status: 'PENDING' } as any);
  }

  async updatePaymentStatus(ctx: TenantContext, id: string, status: string, userId: string) {
    return this.financeRepository.updatePaymentStatus(ctx, id, status, userId as any);
  }

  // Audit Log
  async listAuditLog(ctx: TenantContext, module?: string, limit?: number) {
    const where: any = { tenant_id: ctx.tenant_id };
    if (module) where.module = module;
    return this.prisma.audit_logs.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit || 100,
    });
  }

  async createAuditLog(ctx: TenantContext, data: any, userId: string) {
    await this.auditService.log({ tenant_id: ctx.tenant_id, user_id: userId, module: data.module || 'FINANCE', action: data.action, entity_type: data.entity_type || 'OPERATION', entity_id: data.entity_id, metadata: data.metadata });
    return { success: true };
  }

  // Treasury
  async listTransfers(ctx: TenantContext) {
    return this.financeRepository.listTransfers(ctx);
  }

  async createTransfer(ctx: TenantContext, data: any) {
    return this.financeRepository.createTransfer(ctx, data);
  }

  async reconcileSettlement(ctx: TenantContext, sourceId: string, amount: number) {
    return this.financeRepository.reconcileSettlement(ctx, sourceId, amount);
  }

  // Payroll
  async getPayrollEntries(ctx: TenantContext, period?: string) {
    return this.financeRepository.listPayrollEntries(ctx, period);
  }

  async estimatePayroll(ctx: TenantContext, period: string) {
    return this.financeRepository.estimatePayroll(ctx, period);
  }

  async executePayroll(ctx: TenantContext, period: string, userId: string) {
    return this.financeRepository.executePayrollRun(ctx, period, userId);
  }

  async updateMoneySource(ctx: TenantContext, id: string, updates: any) {
    this.logger.log(`[FinanceService] Updating money source ${id} for tenant ${ctx.tenant_id}`);
    const updated = await this.financeRepository.updateMoneySource(ctx, id, updates);
    
    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id: 'SYSTEM', // Should be from context if available
      module: 'FINANCE',
      action: 'MONEY_SOURCE_UPDATED',
      entity_type: 'MONEY_SOURCE',
      entity_id: id,
      metadata: updates
    });

    return updated;
  }

  // Phase 5: Bank Reconciliation Orchestration
  async processBankStatement(
    ctx: TenantContext,
    source: 'CSV' | 'API',
    user_id: string,
    fileBuffer?: Buffer
  ): Promise<void> {
    const provider = source === 'CSV' ? this.csvBankProvider : this.apiBankProvider;
    this.logger.log(`[FinanceService] Processing statement from ${source} for tenant ${ctx.tenant_id}`);

    if (source === 'CSV' && !fileBuffer) {
      throw new Error('CSV file buffer is required for CSV ingestion');
    }

    const transactions = await provider.fetchStatements(ctx.tenant_id, { buffer: fileBuffer as any });
    
    if (transactions.length > 0) {
      const bankTxns = transactions.map(t => ({
        ...t,
        amount: new Prisma.Decimal(t.amount),
        status: 'UNRECONCILED' as any
      }));
      await this.financeRepository.ingestBankTransactions(ctx, bankTxns);
      await this.autoMatchBankTransactions(ctx);
    }

    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: 'FINANCE',
      action: 'BANK_STATEMENT_PROCESSED',
      entity_type: 'BANK_ACCOUNT',
      entity_id: 'GLOBAL',
      metadata: { source, row_count: transactions.length }
    });
  }

  private async autoMatchBankTransactions(ctx: TenantContext): Promise<void> {
    const unreconciled = await this.financeRepository.getUnreconciledTransactions(ctx);
    const ledger = await this.financeRepository.getLedger(ctx);

    for (const stmt of unreconciled) {
      // Logic: Exact Amount + Date Proxy (within 3 days)
      const match = ledger.find(l => 
        l.amount.equals(stmt.amount) && 
        l.created_at &&
        Math.abs(new Date(l.created_at).getTime() - stmt.date.getTime()) < 259200000 // 3 days
      );

      if (match) {
        await this.financeRepository.createReconcileMatch(ctx, stmt.id, match.id, 0.95);
      }
    }
  }

  // Phase 5: Hierarchical Performance Dashboard (Multi-Level Roll-up)
  async getPerformanceDashboard(
    ctx: TenantContext,
    scope: 'TENANT' | 'BRANCH' | 'STORE' | 'ECOMMERCE',
    nodeId?: string
  ): Promise<PerformanceTreeNode> {
    this.logger.log(`[FinanceService] Calculating Performance Tree for ${scope}:${nodeId || 'ROOT'}`);
    
    // Recursive aggregation logic moved to Repository for DB-level performance
    const tree = await this.financeRepository.getPerformanceTree(ctx, nodeId, scope);
    
    return tree;
  }

  /**
   * Post a balanced journal entry. Thin passthrough to the repository so other
   * modules (e.g. HR payroll disbursement) can post their GL entries inside an
   * existing transaction by forwarding `tx`. The repository resolves the open
   * fiscal period, resolve-or-creates the GL accounts, and enforces balancing.
   */
  async createJournal(
    ctx: TenantContext,
    data: CreateJournalDto,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    return this.financeRepository.createJournal(ctx, data, tx);
  }

  /**
   * Finalize a payroll settlement coming from the HR module.
   *
   * NOTE: the event bus delivers a plain `tenant_id` string (see
   * PayrollSettlementListener), not a full TenantContext. The previous
   * signature typed this as `TenantContext`, so at runtime `ctx.tenant_id`
   * resolved to `undefined` and the audit log was written with no tenant. The
   * GL journal for the run is posted in the same DB transaction during
   * disbursement; this handler records the settlement audit trail only.
   */
  async finalizePayrollSettlement(
    tenant_id: string,
    runId: string,
    payload: any
  ): Promise<void> {
    this.logger.log(`[FinanceService] Finalizing Payroll Settlement for run ${runId}`);

    await this.auditService.log({
      tenant_id,
      user_id: 'SYSTEM',
      module: 'FINANCE',
      action: 'PAYROLL_SETTLEMENT_FINALIZED',
      entity_type: 'PAYROLL_RUN',
      entity_id: runId,
      metadata: payload
    });
  }

  // Loans
  async listLoans(ctx: TenantContext, employee_id?: string) {
    return this.financeRepository.listLoans(ctx, employee_id);
  }

  async getLoanById(ctx: TenantContext, id: string) {
    return this.financeRepository.getLoanById(ctx, id);
  }

  async applyForLoan(ctx: TenantContext, data: any, user_id: string) {
    // Resolve employee_id from user_id if not provided
    let employee_id = data.employee_id;
    if (!employee_id) {
      const employee = await (this.prisma as any).employees.findFirst({
        where: { user_id, tenant_id: ctx.tenant_id },
      });
      if (!employee) throw new Error("Employee record not found for user");
      employee_id = employee.id;
    }

    // Resolve company currency
    let currency = data.currency;
    if (!currency) {
      const company = await (this.prisma as any).companies.findUnique({
        where: { id: ctx.company_id || "system" },
        select: { currency: true },
      });
      currency = company?.currency || "USD";
    }

    const loan = await this.financeRepository.createLoan(ctx, {
      ...data,
      employee_id,
      currency,
      status: "PENDING",
    });

    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "FINANCE",
      action: "LOAN_APPLICATION_SUBMITTED",
      entity_type: "LOAN",
      entity_id: loan.id,
      metadata: data,
    });

    return loan;
  }

  async approveLoan(ctx: TenantContext, id: string, user_id: string) {
    await this.financeRepository.updateLoanStatus(ctx, id, "APPROVED");

    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "FINANCE",
      action: "LOAN_APPROVED",
      entity_type: "LOAN",
      entity_id: id,
    });
  }

  async getEmployeeIdByUserId(ctx: TenantContext, user_id: string) {
    const employee = await (this.prisma as any).employees.findFirst({
      where: { user_id, tenant_id: ctx.tenant_id },
    });
    return employee?.id;
  }

  // --- Payslip Templates ---
  async listPayslipTemplates(ctx: TenantContext) {
    return (this.prisma as any).payslip_templates.findMany({
      where: { tenant_id: ctx.tenant_id },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
  }

  async createPayslipTemplate(ctx: TenantContext, data: any, userId: string) {
    const { v4: uuidv4 } = await import('uuid');
    const template = await (this.prisma as any).payslip_templates.create({
      data: {
        id: uuidv4(),
        tenant_id: ctx.tenant_id,
        name: data.name,
        description: data.description || null,
        is_default: data.isDefault ?? false,
        layout: data.layout || [],
        branding: data.branding || {},
        created_by: userId,
      },
    });

    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id: userId,
      module: "FINANCE",
      action: "PAYSLIP_TEMPLATE_CREATED",
      entity_type: "PAYSLIP_TEMPLATE",
      entity_id: template.id,
      metadata: { name: data.name },
    });

    return template;
  }

  async updatePayslipTemplate(ctx: TenantContext, id: string, data: any, userId: string) {
    const template = await (this.prisma as any).payslip_templates.update({
      where: { id, tenant_id: ctx.tenant_id },
      data: {
        name: data.name,
        description: data.description,
        is_default: data.isDefault,
        layout: data.layout,
        branding: data.branding,
        updated_at: new Date(),
      },
    });
    return template;
  }

  async deletePayslipTemplate(ctx: TenantContext, id: string) {
    await (this.prisma as any).payslip_templates.delete({
      where: { id, tenant_id: ctx.tenant_id },
    });
    return { success: true, deleted: id };
  }
}

