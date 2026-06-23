import { Injectable, BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../../../persistence/prisma.service";
import { IFinanceRepository } from "./finance.repository.interface";
import { TenantContext } from "../../../gateway/tenant-context.interface";
import { MultiTenancyUtil } from "../../../shared/utils/multi-tenancy.util";
import { LedgerEntry } from "../entities/ledger-entry.entity";
import { Transaction } from "../entities/transaction.entity";
import { Balance } from "../entities/balance.entity";
import { CreateTransactionDto } from "../dto/create-transaction.dto";
import {
  Asset,
  CapexRequest,
  FinancePaymentRow,
  PaymentRequest,
  TreasuryTransfer,
  FinanceMoneySourceRow,
  FinanceReceivableRow,
  ReceivableInvoice,
  FinancePayableRow,
  PayableBill,
  PayrollEntry,
  PayrollEstimate,
  FinanceCapexBudgetRow,
  AssetDepreciationEntry,
  AssetEvent,
  AssetAuditPack,
  FinanceDocumentRow,
  FinancePolicyRow,
  AccountingPeriod,
  FinanceInsight,
  FinanceAlert,
  BankTransaction,
  PerformanceTreeNode,
} from "../finance.types";
import { CreateJournalDto } from "../dto/create-journal.dto";


@Injectable()
export class FinanceDbRepository extends IFinanceRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async getLedger(
    ctx: TenantContext,
    location_id?: string,
  ): Promise<LedgerEntry[]> {
    const journalEntries = await this.prisma.finance_journal_entries.findMany({
      where: {
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
      },
      include: {
        finance_journal_lines: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    // Flatten journal entries into ledger entries
    const ledger: LedgerEntry[] = [];
    for (const entry of journalEntries) {
      for (const line of ((entry as any).finance_journal_lines ?? [])) {
        ledger.push({
          id: line.id,
          tenant_id: entry.tenant_id,
          created_at: entry.created_at.toISOString(),
          description: (line as any).description || entry.description || "No description",
          amount:
            line.debit.gt(0)
              ? line.debit
              : line.credit,
          type: (line.debit.gt(0) ? "DEBIT" : "CREDIT") as any,
          account: line.account_code,
          category: String(line.account_code ?? "").startsWith("4") ? "SALES" : "GENERAL",
          referenceId: entry.ref || undefined,
          status: entry.status || "POSTED",
          effectiveDate: entry.posting_date,
          balance: new Prisma.Decimal(0),
        });
      }
    }

    // Filter by location if provided (in this schema, JournalEntry doesn't have location_id,
    // but the task requires location awareness. We'll skip filtering if missing in DB for now
    // as we don't want to break the schema without a migration)
    return ledger;
  }

  async createTransaction(
    ctx: TenantContext,
    data: CreateTransactionDto,
    tx?: Prisma.TransactionClient,
  ): Promise<Transaction> {
    const execute = async (contextTx: Prisma.TransactionClient) => {
      // 1. Prepare lines
      const lines = [
        {
          accountCode: data.category === "SALES" ? "4000" : "1001",
          debit:
            data.type === "credit"
              ? 0
              : Number(data.amount),
          credit:
            data.type === "credit"
              ? Number(data.amount)
              : 0,
          description: data.description || "POS Sales",
        },
      ];

      // Since createTransaction currently creates a single-sided entry in the legacy implementation,
      // we must balance it against a suspense or bank account for it to pass the new validation.
      // For POS Sales, we balance Bank/Cash (1001) against Sales (4000).
      if (data.category === "SALES") {
        lines.push({
          accountCode: "1001",
          debit: Number(data.amount),
          credit: 0,
          description: "Offset - Cash/Bank",
        });
      }

      // 2. Create Journal Entry using validated helper
      const journalEntry = await this.validateAndCreateJournal(
        ctx,
        {
          ref: data.referenceId || `TXN-${Date.now()}`,
          description: data.description || "POS Sales Transaction",
          lines,
        },
        contextTx,
      );

      return {
        id: journalEntry.id,
        tenant_id: journalEntry.tenant_id,
        location_id: data.location_id ?? "default",
        amount: new Prisma.Decimal(data.amount),
        type: data.type,
        description: journalEntry.description || "",
        category: data.category || "GENERAL",
        created_at: journalEntry.created_at,
        status: "approved" as "approved",
        createdBy: "system",
      };
    };

    return tx ? execute(tx) : this.prisma.$transaction(execute);
  }

  private async validateAndCreateJournal(
    ctx: TenantContext,
    data: CreateJournalDto,
    tx: Prisma.TransactionClient,
  ): Promise<any> {
    // 1. Total Balancing Check
    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);

    for (const line of data.lines) {
      totalDebit = totalDebit.plus(new Prisma.Decimal(line.debit || 0));
      totalCredit = totalCredit.plus(new Prisma.Decimal(line.credit || 0));
    }

    if (!totalDebit.equals(totalCredit)) {
      throw new Error(
        `Unbalanced Journal Entry: Total Debit (${totalDebit}) does not equal Total Credit (${totalCredit})`,
      );
    }

    // 2. Resolve an OPEN fiscal period (create one for the tenant if none exists). The
    //    previous hardcoded fiscal_period_id "FISCAL_AUTO" is not a real row -> FK violation.
    let period = await tx.finance_fiscal_periods.findFirst({
      where: { tenant_id: ctx.tenant_id, status: "OPEN" },
    });
    if (!period) {
      const now = new Date();
      period = await tx.finance_fiscal_periods.create({
        data: {
          id: randomUUID(),
          tenant_id: ctx.tenant_id,
          name: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
          start_date: new Date(now.getFullYear(), now.getMonth(), 1),
          end_date: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
          status: "OPEN",
          fiscal_year_id: `FY-${ctx.tenant_id}-${now.getFullYear()}`,
          updated_at: new Date(),
        },
      });
    }

    // 3. Resolve-or-create each line's GL account by code. Callers pass account codes/labels
    //    (e.g. "4100-SALES-RETURNS") in accountId/accountCode; these are not real COA ids.
    const typeFromCode = (code: string): string => {
      switch (String(code).trim()[0]) {
        case "1": return "ASSET";
        case "2": return "LIABILITY";
        case "3": return "EQUITY";
        case "4": return "REVENUE";
        case "5":
        case "6": return "EXPENSE";
        default: return "ASSET";
      }
    };
    const resolveAccount = async (rawCode: string, desc?: string) => {
      const code = String(rawCode);
      let acc = await tx.finance_chart_of_accounts.findUnique({
        where: { tenant_id_code: { tenant_id: ctx.tenant_id, code } },
      });
      if (!acc) {
        acc = await tx.finance_chart_of_accounts.create({
          data: {
            id: randomUUID(),
            tenant_id: ctx.tenant_id,
            code,
            name: desc || code,
            type: typeFromCode(code),
            status: "ACTIVE",
            updated_at: new Date(),
          },
        });
      }
      return acc;
    };

    const linesData = [];
    for (const line of data.lines as any[]) {
      const code = line.accountCode || line.account_code || line.accountId || line.account_id;
      const acc = await resolveAccount(code, line.description);
      linesData.push({
        id: randomUUID(),
        tenant_id: ctx.tenant_id,
        account_id: acc.id,
        account_code: acc.code,
        side: new Prisma.Decimal(line.debit || 0).gt(0) ? "DEBIT" : "CREDIT",
        amount: new Prisma.Decimal(line.debit || 0).gt(0)
          ? new Prisma.Decimal(line.debit)
          : new Prisma.Decimal(line.credit),
        description: line.description,
        debit: new Prisma.Decimal(line.debit || 0),
        credit: new Prisma.Decimal(line.credit || 0),
      });
    }

    // 4. Create Entry
    return tx.finance_journal_entries.create({
      data: {
        id: randomUUID(),
        tenant_id: ctx.tenant_id,
        ref: data.ref || `JR-${Date.now()}`,
        description: data.description,
        fiscal_period_id: period.id,
        posting_date: new Date(),
        journal_type: "MANUAL",
        status: "POSTED",
        updated_at: new Date(),
        finance_journal_lines: { create: linesData },
      },
      include: {
        finance_journal_lines: true,
      },
    });
  }

  async createJournal(
    ctx: TenantContext,
    data: CreateJournalDto,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    const execute = async (contextTx: Prisma.TransactionClient) => {
      return this.validateAndCreateJournal(ctx, data, contextTx);
    };

    if (tx) return execute(tx);
    return this.prisma.$transaction(execute);
  }

  async getBalance(ctx: TenantContext): Promise<Balance> {
    const moneySources = await this.prisma.money_sources.findMany({
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
    });

    let totalCash = new Prisma.Decimal(0);
    for (const source of moneySources) {
      totalCash = totalCash.plus(source.balance);
    }

    // Get journal line aggregates
    const lines = await this.prisma.finance_journal_lines.findMany({
      where: {
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
      },
    });

    let totalRevenue = new Prisma.Decimal(0);
    let totalExpense = new Prisma.Decimal(0);

    for (const line of lines) {
      if (line.account_code.startsWith("4")) {
        // Revenue: Credit - Debit
        totalRevenue = totalRevenue.plus(line.credit).minus(line.debit);
      } else if (line.account_code.startsWith("5")) {
        // Expense: Debit - Credit
        totalExpense = totalExpense.plus(line.debit).minus(line.credit);
      }
    }

    return {
      tenant_id: ctx.tenant_id,
      totalBalance: totalCash,
      currency: "IDR",
      lastUpdated: new Date(),
      totalDebits: totalExpense,
      totalCredits: totalRevenue,
      transactionCount: lines.length,
    };
  }

  // Assets
  async listAssets(ctx: TenantContext): Promise<Asset[]> {
    const assets = await this.prisma.fixed_assets.findMany({
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
    });
    return assets.map(this.mapAsset);
  }

  async getAssetById(ctx: TenantContext, assetId: string): Promise<Asset | null> {
    const asset = await this.prisma.fixed_assets.findFirst({
      where: { id: assetId, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
    });
    return asset ? this.mapAsset(asset) : null;
  }

  async createAsset(
    ctx: TenantContext,
    asset: Partial<Asset>,
    tx?: Prisma.TransactionClient,
  ): Promise<Asset> {
    const db = tx ?? this.prisma;
    const created = await db.fixed_assets.create({
      data: {
        id: randomUUID(),
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        description: asset.description!,
        asset_class: asset.assetClass!,
        location: (asset as any).location!,
        department: asset.department!,
        acquisition_cost: asset.acquisitionCost!,
        acquisition_date: new Date(asset.acquisitionDate!),
        useful_life_years: asset.usefulLifeYears!,
        depreciation_method: asset.depreciationMethod!,
        residual_value: asset.residualValue!,
        status: asset.status || "ACTIVE",
        carrying_value: asset.acquisitionCost!,
        updated_at: new Date(),
      },
    });
    return this.mapAsset(created);
  }

  async updateAsset(
    ctx: TenantContext,
    assetId: string,
    updates: Partial<Asset>,
    tx?: Prisma.TransactionClient,
  ): Promise<Asset | null> {
    const db = tx ?? this.prisma;
    const data: any = { ...updates };
    if (updates.acquisitionDate)
      data.acquisitionDate = new Date(updates.acquisitionDate);

    const updated = await db.fixed_assets.update({
      where: { id: assetId, tenant_id: ctx.tenant_id },
      data,
    });
    return this.mapAsset(updated);
  }

  // Capex
  async listCapexRequests(ctx: TenantContext): Promise<CapexRequest[]> {
    const requests = await this.prisma.capex_requests.findMany({
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
    });
    return requests.map(this.mapCapexRequest);
  }

  async getCapexRequestById(
    ctx: TenantContext,
    id: string,
  ): Promise<CapexRequest | null> {
    const request = await this.prisma.capex_requests.findFirst({
      where: { id, ...MultiTenancyUtil.getScope(ctx) },
    });
    return request ? this.mapCapexRequest(request) : null;
  }

  async createCapexRequest(
    ctx: TenantContext,
    request: Partial<CapexRequest>,
    tx?: Prisma.TransactionClient,
  ): Promise<CapexRequest> {
    const db = tx ?? this.prisma;
    const created = await db.capex_requests.create({
      data: {
        id: randomUUID(),
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        asset_description: request.assetDescription!,
        requested_amount: request.requestedAmount!,
        department: request.department!,
        project_code: request.projectCode,
        requested_by: request.requesterId!,
        status: request.status || "PENDING",
        updated_at: new Date(),
      },
    });
    return this.mapCapexRequest(created);
  }

  async updateCapexRequest(
    ctx: TenantContext,
    id: string,
    updates: Partial<CapexRequest>,
    tx?: Prisma.TransactionClient,
  ): Promise<CapexRequest | null> {
    const db = tx ?? this.prisma;
    const updated = await db.capex_requests.update({
      where: { id, tenant_id: ctx.tenant_id },
      data: {
        status: updates.status,
        current_approval_stage: updates.currentApprovalStage,
        budget_matched: updates.budgetMatched,
      },
    });
    return this.mapCapexRequest(updated);
  }

  // Money Sources
  async listMoneySources(ctx: TenantContext): Promise<FinanceMoneySourceRow[]> {
    const sources = await this.prisma.money_sources.findMany({
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true, excludeEcommerce: true }) },
    });

    const rows = sources.map((s: any) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      currency: s.currency,
      balance: s.balance,
      pendingSettlement: s.pending_settlement || new Prisma.Decimal(0),
      provider: s.provider,
      lastUpdated: s.last_updated.toISOString(),
      minLimit: s.min_limit ?? undefined,
      maxLimit: s.max_limit ?? undefined,
    }));

    // Industry Module Integration: Aggregate cash from open Retail shifts
    try {
      const openShifts = await this.prisma.retail_shifts.findMany({
        where: { ...MultiTenancyUtil.getScope(ctx), status: "open" },
        select: { opening_cash: true },
      });

      if (openShifts.length > 0) {
        const totalRetailCash = openShifts.reduce(
          (sum: number, shifts: any) => sum + shifts.opening_cash.toNumber(),
          0,
        );

        rows.push({
          id: "retail-float",
          name: "Retail Floor Cash (Active Shifts)",
          type: "CASH_REGISTER",
          currency: "IDR",
          balance: new Prisma.Decimal(totalRetailCash),
          pendingSettlement: new Prisma.Decimal(0),
          provider: "Retail Module",
          lastUpdated: new Date().toISOString(),
          minLimit: undefined,
          maxLimit: undefined,
        });
      }
    } catch {
      // Retail module may not have shifts table yet or no open shifts
    }

    return rows;
  }

  async updateMoneySource(
    ctx: TenantContext,
    id: string,
    updates: Partial<FinanceMoneySourceRow>,
    tx?: Prisma.TransactionClient,
  ): Promise<FinanceMoneySourceRow> {
    const db = tx ?? this.prisma;
    const data: any = {};
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.balance !== undefined) data.balance = updates.balance;
    if (updates.minLimit !== undefined) data.min_limit = updates.minLimit;
    if (updates.maxLimit !== undefined) data.max_limit = updates.maxLimit;
    
    const updated = await db.money_sources.update({
      where: { id, tenant_id: ctx.tenant_id },
      data,
    });

    return {
      id: updated.id,
      name: updated.name,
      type: updated.type,
      currency: updated.currency,
      balance: updated.balance,
      pendingSettlement: updated.pending_settlement || new Prisma.Decimal(0),
      provider: updated.provider,
      lastUpdated: updated.last_updated.toISOString(),
      minLimit: updated.min_limit ?? undefined,
      maxLimit: updated.max_limit ?? undefined,
    };
  }

  // Treasury Transfers
  async listTransfers(ctx: TenantContext): Promise<TreasuryTransfer[]> {
    const transfers = await this.prisma.treasury_transfers.findMany({
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      orderBy: { created_at: "desc" },
    });

    return transfers.map((t: any) => ({
      id: t.id,
      tenant_id: t.tenant_id,
      fromSourceId: t.from_source_id,
      toSourceId: t.to_source_id,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      requested_by: t.requested_by,
      created_at: t.created_at,
      updated_at: t.updated_at,
    }));
  }

  async createTransfer(
    ctx: TenantContext,
    data: Partial<TreasuryTransfer>,
    tx?: Prisma.TransactionClient,
  ): Promise<TreasuryTransfer> {
    const db = tx ?? this.prisma;
    const created = await db.treasury_transfers.create({
      data: {
        id: randomUUID(),
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        from_source_id: data.fromSourceId!,
        to_source_id: data.toSourceId!,
        amount: data.amount!,
        currency: data.currency || "IDR",
        status: data.status || "PENDING",
        requested_by: data.requested_by || "system",
        updated_at: new Date(),
      },
    });

    return {
      id: created.id,
      tenant_id: created.tenant_id,
      fromSourceId: created.from_source_id,
      toSourceId: created.to_source_id,
      amount: created.amount,
      currency: created.currency,
      status: created.status as any,
      requested_by: created.requested_by,
      created_at: created.created_at,
      updated_at: created.updated_at,
    };
  }

  async reconcileSettlement(
    ctx: TenantContext,
    sourceId: string,
    amount: number,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    // Two writes (balance mutation + settlement record) MUST be atomic — otherwise
    // money can move on the source with no settlement trace if the second write fails.
    const execute = async (db: Prisma.TransactionClient): Promise<void> => {
      const source = await db.money_sources.findFirst({
        where: { id: sourceId, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      });

      if (!source) return;

      await db.money_sources.update({
        where: { id: sourceId },
        data: {
          balance: { increment: amount },
          pending_settlement: { decrement: amount },
          last_updated: new Date(),
        },
      });

      // Create a record of the reconciliation
      await db.settlement_records.create({
        data: {
          id: randomUUID(),
          ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
          source_id: sourceId,
          amount,
          currency: source.currency,
          status: "COMPLETED",
          reference: `RECON-${Date.now()}`,
          updated_at: new Date(),
        },
      });
    };

    if (tx) return execute(tx);
    await this.prisma.$transaction(execute);
  }

  // Payments
  async listPayments(ctx: TenantContext): Promise<FinancePaymentRow[]> {
    // Fetch internal payment requests
    const internalPayments = await this.prisma.payment_transactions.findMany({
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      orderBy: { created_at: "desc" },
      take: 50,
    });

    // Fetch retail order payments if applicable
    let retailPayments: any[] = [];
    try {
      retailPayments = await this.prisma.payment_transactions.findMany({
        where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), type: { in: ["RETAIL_ORDER", "ONLINE_ORDER"] } },
        orderBy: { created_at: "desc" },
        take: 20,
      });
    } catch {
      // retail payments may not exist yet
    }

    const combined = [...internalPayments, ...retailPayments];
    // Deduplicate by id
    const seen = new Set<string>();
    const deduped: any[] = [];
    for (const p of combined) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        deduped.push(p);
      }
    }

    return deduped.map((p: any) => ({
      id: p.id,
      beneficiary: p.destination || p.type || "Unknown",
      amount: p.amount,
      currency: p.currency,
      status: (p.status === "SUBMITTED" || p.status === "PENDING_APPROVAL"
        ? "PENDING_APPROVAL"
        : p.status === "APPROVED" || p.status === "PROCESSING"
          ? "PROCESSING"
          : p.status === "PAID" || p.status === "COMPLETED"
            ? "COMPLETED"
            : "FAILED") as
        | "PENDING_APPROVAL"
        | "PROCESSING"
        | "COMPLETED"
        | "FAILED",
      method: (p.channel || "BANK_TRANSFER") as any,
      scheduledDate: p.created_at.toISOString(),
    }));
  }

  async createPaymentRequest(
    ctx: TenantContext,
    request: Partial<PaymentRequest>,
    tx?: Prisma.TransactionClient,
  ): Promise<PaymentRequest> {
    const db = tx ?? this.prisma;
    const created = await db.payment_transactions.create({
      data: {
        id: randomUUID(),
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        idempotency_key: `pay-req-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        type: "PAYMENT_REQUEST",
        amount: request.amount!,
        currency: request.currency || "IDR",
        destination: request.beneficiary!,
        source: request.source,
        channel: "BANK_TRANSFER",
        status: request.status || "DRAFT",
        department_id: request.departmentId,
        purpose: request.purpose,
        extra_info: request.extraInfo ? (request.extraInfo as any) : undefined,
        created_by: request.requested_by!,
      },
      include: {
        departments: true,
      },
    });

    return {
      id: created.id,
      amount: created.amount,
      currency: created.currency,
      beneficiary: created.destination,
      source: created.source || undefined,
      purpose: created.purpose || "",
      departmentId: created.department_id || undefined,
      extraInfo: (created.extra_info as Record<string, any>) || undefined,
      status: created.status as any,
      requested_by: created.created_by,
      requestedAt: created.created_at.toISOString(),
    };
  }

  async updatePaymentStatus(
    ctx: TenantContext,
    id: string,
    status: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const db = tx ?? this.prisma;
    await db.payment_transactions.updateMany({
      where: { id, tenant_id: ctx.tenant_id },
      data: { status },
    });
  }

  // Receivables
  async listReceivables(ctx: TenantContext): Promise<FinanceReceivableRow[]> {
    const items = await this.prisma.receivables.findMany({
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      orderBy: { created_at: "desc" },
    });

    return items.map((inv) => ({
      id: inv.id,
      customerName: inv.customer_name,
      invoiceNumber: inv.id,
      amount: inv.amount,
      currency: inv.currency,
      dueDate: inv.due_date.toISOString(),
      status: inv.status as any,
      agingDays: Math.floor(
        (Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24),
      ),
      updated_at: inv.updated_at.toISOString(),
    }));
  }

  async createReceivable(
    ctx: TenantContext,
    invoice: Partial<ReceivableInvoice>,
    tx?: Prisma.TransactionClient,
  ): Promise<ReceivableInvoice> {
    const execute = async (contextTx: Prisma.TransactionClient) => {
      const rec = await contextTx.receivables.create({
        data: {
          id: randomUUID(),
          ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
          customer_name: invoice.customer!,
          amount: invoice.amount!,
          currency: "IDR",
          due_date: new Date(invoice.dueDate!),
          status: invoice.status || "DRAFT",
          updated_at: new Date(),
        },
      });

      return rec;
    };

    const created = tx
      ? await execute(tx)
      : await this.prisma.$transaction(execute);

    return {
      id: created.id,
      customer: created.customer_name,
      amount: created.amount,
      dueDate: created.due_date.toISOString(),
      status: created.status as any,
    };
  }

  // Payables
  async listPayables(ctx: TenantContext): Promise<FinancePayableRow[]> {
    const items = await this.prisma.payables.findMany({
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      orderBy: { created_at: "desc" },
    });

    return items.map((bill) => ({
      id: bill.id,
      vendorName: bill.vendor_name,
      billNumber: bill.id,
      amount: bill.amount,
      currency: bill.currency,
      dueDate: bill.due_date.toISOString(),
      status: bill.status as any,
      updated_at: bill.updated_at.toISOString(),
    }));
  }

  async createPayable(
    ctx: TenantContext,
    bill: Partial<PayableBill>,
    tx?: Prisma.TransactionClient,
  ): Promise<PayableBill> {
    const execute = async (contextTx: Prisma.TransactionClient) => {
      const pay = await contextTx.payables.create({
        data: {
          id: randomUUID(),
          ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
          vendor_name: bill.vendor!,
          amount: bill.amount!,
          currency: "IDR",
          due_date: new Date(bill.dueDate!),
          status: bill.status || "PENDING",
          updated_at: new Date(),
        },
      });

      await this.validateAndCreateJournal(
        ctx,
        {
          ref: `PAY-${pay.id.substring(0, 8)}`,
          description: `Bill received from ${bill.vendor}`,
          lines: [
            {
              accountCode: "EXP-GEN",
              debit: Number(bill.amount!),
              credit: 0,
              description: `Expense for ${bill.vendor}`,
            },
            {
              accountCode: "LIAB-AP",
              debit: 0,
              credit: Number(bill.amount!),
              description: "Accounts Payable",
            },
          ],
        },
        contextTx,
      );

      return pay;
    };

    const created = tx
      ? await execute(tx)
      : await this.prisma.$transaction(execute);

    return {
      id: created.id,
      vendor: created.vendor_name,
      amount: created.amount,
      dueDate: created.due_date.toISOString(),
      status: created.status as any,
    };
  }

  // Payroll
  async listPayrollEntries(
    ctx: TenantContext,
    period?: string,
  ): Promise<PayrollEntry[]> {
    const lines = await this.prisma.payroll_lines.findMany({
      where: {
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        hr_payroll_runs: period ? { period_end: { gte: new Date(period) } } : undefined,
      },
      include: {
        hr_payroll_runs: true,
      },
      orderBy: { created_at: "desc" },
    });

    return lines.map((line: any) => ({
      id: line.id,
      tenant_id: line.tenant_id,
      employee_id: line.employee_id,
      period: (line as any).hr_payroll_runs.period_end.toISOString().substring(0, 7),
      baseSalary: line.gross_pay,
      netSalary: line.net_pay,
      status: (line as any).hr_payroll_runs.status as any,
      created_at: line.created_at.toISOString(),
      updated_at: line.updated_at.toISOString(),
      name: undefined,
      department: undefined,
      bonuses: new Prisma.Decimal(0),
      deductions: new Prisma.Decimal(0),
    }));
  }

  async estimatePayroll(
    ctx: TenantContext,
    period: string,
  ): Promise<PayrollEstimate[]> {
    const employees = await this.prisma.employees.findMany({
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), status: "active" },
      include: { 
        departments: true,
        compensations: true
      },
    });

    const estimatesMap = new Map<string, PayrollEstimate>();

    for (const emp of employees) {
      const deptName = (emp as any).departments?.name || "Unassigned";
      
      let gross = 0;
      const comp = (emp as any).compensations;
      
      if (comp) {
        gross = Number(comp.baseSalary);
        
        // Add allowances
        if (comp.allowances) {
          const allowances = comp.allowances as any[];
          if (Array.isArray(allowances)) {
            allowances.forEach(a => {
              if (a.amount) gross += Number(a.amount);
            });
          }
        }

        // Add bonuses
        if (comp.bonuses) {
          const bonuses = comp.bonuses as any[];
          if (Array.isArray(bonuses)) {
            bonuses.forEach(b => {
              if (b.amount) gross += Number(b.amount);
            });
          }
        }
      } else {
        // Fallback to legacy baseSalary if compensation record is missing
        gross = emp.base_salary ? emp.base_salary.toNumber() : 0;
      }

      // Simplified: Net = Gross - 10% deductions for estimation purposes
      const net = gross * 0.9;

      if (!estimatesMap.has(deptName)) {
        estimatesMap.set(deptName, {
          department: deptName,
          employeeCount: 0,
          totalGross: new Prisma.Decimal(0),
          totalNet: new Prisma.Decimal(0),
        });
      }

      const est = estimatesMap.get(deptName)!;
      est.employeeCount += 1;
      est.totalGross = est.totalGross.plus(gross);
      est.totalNet = est.totalNet.plus(net);
    }

    return Array.from(estimatesMap.values());
  }

  async executePayrollRun(
    ctx: TenantContext,
    period: string, // e.g. "2026-02"
    user_id: string, // for auditing
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const db = tx ?? this.prisma;
    const employees = await db.employees.findMany({
      // employees has no branch_id/location_id columns; use excludeBranch to avoid injecting
      // them into the where clause (which 500-ed payroll execute).
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), status: "active" },
      include: { compensations: true }
    });

    if (employees.length === 0) {
      throw new Error("No active employees found to run payroll.");
    }

    let totalGross = new Prisma.Decimal(0);
    let totalNet = new Prisma.Decimal(0);

    const linesData = employees.map((emp: any) => {
      let gross = 0;
      const comp = (emp as any).compensations;
      if (comp) {
        gross = Number(comp.baseSalary);
        // Add allowances
        if (comp.allowances) {
          const allowances = comp.allowances as any[];
          if (Array.isArray(allowances)) {
            allowances.forEach(a => {
              if (a.amount) gross += Number(a.amount);
            });
          }
        }

        // Add bonuses
        if (comp.bonuses) {
          const bonuses = comp.bonuses as any[];
          if (Array.isArray(bonuses)) {
            bonuses.forEach(b => {
              if (b.amount) gross += Number(b.amount);
            });
          }
        }
      } else {
        // Fallback to legacy baseSalary
        gross = emp.base_salary ? emp.base_salary.toNumber() : 0;
      }

      const net = gross * 0.9; // 10% withholding/taxes
      totalGross = totalGross.plus(gross);
      totalNet = totalNet.plus(net);

      return {
        id: randomUUID(),
        updated_at: new Date(),
        tenant_id: ctx.tenant_id,
        employee_id: emp.id,
        base_salary: new Prisma.Decimal(gross),
        gross_income: new Prisma.Decimal(gross),
        gross_pay: new Prisma.Decimal(gross),
        net_pay: new Prisma.Decimal(net),
        adjustments: new Prisma.Decimal(gross - net),
      };
    });

    const periodDate = new Date(`${period}-01`);
    const periodEnd = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0);

    // Payroll runs are unique per (tenant, period). Reject a duplicate run for the same
    // period with a clear 400 instead of a Prisma unique-constraint 500.
    const existingRun = await db.hr_payroll_runs.findFirst({
      where: { tenant_id: ctx.tenant_id, period_start: periodDate, period_end: periodEnd },
      select: { id: true },
    });
    if (existingRun) {
      throw new BadRequestException(`Payroll has already been executed for period ${period}`);
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Create the PayrollRun
      const run = await tx.hr_payroll_runs.create({
        data: {
        id: randomUUID(),
          // hr_payroll_runs / payroll_lines have no branch_id/location_id columns; getScope
          // injected them -> 500. Scope by tenant_id only.
          tenant_id: ctx.tenant_id,
          period_start: periodDate,
          period_end: periodEnd,
          status: "approved",
          approved_by: user_id,
          total_employees: employees.length,
          total_gross_pay: totalGross,
          total_net_pay: totalNet,
          payroll_lines: {
            create: linesData,
          },
        },
      });

      // 2. Create the Ledger Journal Entry via the shared helper, which resolves a real OPEN
      //    fiscal period and resolve-or-creates the GL accounts (the previous inline create
      //    used fiscal_period_id=period string + non-existent ACC-* ids + branch scope -> 500).
      await this.validateAndCreateJournal(
        ctx,
        {
          ref: `PAY-${period}-${run.id.substring(0, 8)}`,
          description: `Payroll posting for ${period}`,
          lines: [
            { accountCode: "6200", description: `Gross Payroll ${period}`, debit: totalGross.toNumber(), credit: 0 },
            { accountCode: "1001", description: `Net Payroll Disbursed ${period}`, debit: 0, credit: totalNet.toNumber() },
            { accountCode: "2100", description: `Payroll Deductions ${period}`, debit: 0, credit: totalGross.minus(totalNet).toNumber() },
          ],
        } as any,
        tx as any,
      );

      // We could also log to audit service here if it accepts a Prisma transaction client.
    });
  }

  // --- NEWLY ADDED PRISMA IMPLEMENTATIONS FOR MISSING DB OPERATIONS ---

  async getTransactionById(ctx: TenantContext, transaction_id: string): Promise<Transaction | null> {
    const journalEntry = await this.prisma.finance_journal_entries.findFirst({
      where: { id: transaction_id, ...MultiTenancyUtil.getScope(ctx) },
      include: { finance_journal_lines: true }
    });
    if (!journalEntry) return null;
    return {
      id: journalEntry.id,
      tenant_id: journalEntry.tenant_id,
      location_id: "default",
      amount: (journalEntry as any).financeJournalLines.length > 0 ? ((journalEntry as any).financeJournalLines[0].debit.gt(0) ? (journalEntry as any).financeJournalLines[0].debit : (journalEntry as any).financeJournalLines[0].credit) : new Prisma.Decimal(0),
      type: "debit",
      description: journalEntry.description || "",
      category: "GENERAL",
      created_at: journalEntry.created_at,
      status: "approved",
      createdBy: "system"
    };
  }

  // Capex Budgets
  async listCapexBudgets(ctx: TenantContext): Promise<FinanceCapexBudgetRow[]> {
    const budgets = await this.prisma.capex_budgets.findMany({
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      include: { departments: true },
    });
    return budgets.map((b: any) => ({
      department: b.departments?.name || "Unassigned",
      allocatedBudget: b.allocated_budget,
      committedBudget: b.committed_budget || new Prisma.Decimal(0),
      availableBudget: b.available_budget || new Prisma.Decimal(0),
      fiscalYear: b.period, // Mapping period to fiscalYear
    }));
  }

  async setCapexBudget(ctx: TenantContext, budget: FinanceCapexBudgetRow): Promise<void> {
    await this.prisma.capex_budgets.upsert({
      where: {
        tenant_id_department_id_period: {
          tenant_id: ctx.tenant_id,
          department_id: budget.department,
          period: budget.fiscalYear
        }
      },
      update: {
        allocated_budget: budget.allocatedBudget,
        committed_budget: budget.committedBudget,
        available_budget: budget.availableBudget,
        updated_at: new Date(),
      },
      create: {
        id: randomUUID(),
        ...MultiTenancyUtil.getScope(ctx),
        department_id: budget.department,
        period: budget.fiscalYear,
        allocated_budget: budget.allocatedBudget,
        committed_budget: budget.committedBudget,
        available_budget: budget.availableBudget,
        updated_at: new Date(),
      }
    });
  }

  // Depreciation
  async listAssetDepreciationEntries(ctx: TenantContext, assetId?: string): Promise<AssetDepreciationEntry[]> {
    const entries = await this.prisma.asset_depreciation_entries.findMany({
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), ...(assetId ? { asset_id: assetId } : {}) },
      orderBy: { date: 'desc' }
    });
    return entries.map((e: any) => ({
      id: e.id,
      assetId: e.assetId,
      postingDate: e.date.toISOString(),
      amount: e.depreciationExp,
      method: "STRAIGHT_LINE",
      accumulatedDepreciation: e.accumulatedDep,
      carryingValue: e.carryingValue,
      journalEntryId: e.journalRef || "",
      isPosted: true
    }));
  }

  async createDepreciationEntry(ctx: TenantContext, entry: Partial<AssetDepreciationEntry>, tx?: Prisma.TransactionClient): Promise<AssetDepreciationEntry> {
    const db = tx ?? this.prisma;
    const created = await db.asset_depreciation_entries.create({
      data: {
        id: randomUUID(),
        ...MultiTenancyUtil.getScope(ctx),
        asset_id: entry.assetId!,
        period: entry.postingDate?.substring(0, 7) || "2026-02",
        date: new Date(entry.postingDate!),
        depreciation_exp: entry.amount!,
        accumulated_dep: entry.accumulatedDepreciation!,
        carrying_value: entry.carryingValue!,
        journal_ref: entry.journalEntryId,
      }
    });
    return {
      id: created.id,
      assetId: created.asset_id,
      postingDate: created.date.toISOString(),
      amount: created.depreciation_exp,
      method: "STRAIGHT_LINE",
      accumulatedDepreciation: created.accumulated_dep,
      carryingValue: created.carrying_value,
      journalEntryId: created.journal_ref || "",
      isPosted: true
    };
  }

  async listAssetEvents(ctx: TenantContext, assetId?: string): Promise<AssetEvent[]> {
    const events = await this.prisma.asset_events.findMany({
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), ...(assetId ? { asset_id: assetId } : {}) },
      orderBy: { date: 'desc' }
    });
    return events.map((e: any) => ({
      id: e.id,
      assetId: e.assetId,
      type: e.type as any,
      amount: new Prisma.Decimal(0),
      reason: e.description,
      created_at: e.date.toISOString(),
      approvedBy: e.recordedBy,
      attachmentDocumentIds: []
    }));
  }

  async createAssetEvent(ctx: TenantContext, event: Partial<AssetEvent>, tx?: Prisma.TransactionClient): Promise<AssetEvent> {
    const db = tx ?? this.prisma;
    const created = await db.asset_events.create({
      data: {
        id: randomUUID(),
        ...MultiTenancyUtil.getScope(ctx),
        asset_id: event.assetId!,
        type: event.type!,
        description: event.reason || "Event generated",
        date: new Date(event.created_at || new Date()),
        recorded_by: event.approvedBy || "system",
      }
    });
    return {
      id: created.id,
      assetId: created.asset_id,
      type: created.type as any,
      amount: new Prisma.Decimal(0),
      reason: created.description,
      created_at: created.date.toISOString(),
      approvedBy: created.recorded_by,
      attachmentDocumentIds: []
    };
  }

  async getAssetAuditPack(ctx: TenantContext, assetId: string): Promise<AssetAuditPack> {
    const asset = await this.getAssetById(ctx, assetId);
    if (!asset) throw new Error("Asset not found");
    const depreciation = await this.listAssetDepreciationEntries(ctx, assetId);
    const events = await this.listAssetEvents(ctx, assetId);
    return {
      assetId,
      depreciationEntries: depreciation,
      events,
      evidence: [],
      checksum: "sys-gen-chk",
      signature: "sys-hsm-sig"
    };
  }

  // Receivables/Payables Updates
  async updateReceivable(ctx: TenantContext, id: string, updates: Partial<ReceivableInvoice>, tx?: Prisma.TransactionClient): Promise<ReceivableInvoice | null> {
    const db = tx ?? this.prisma;
    const updated = await db.receivables.update({
      where: { id, tenant_id: ctx.tenant_id },
      data: { status: updates.status, amount: updates.amount, due_date: updates.dueDate ? new Date(updates.dueDate) : undefined, updated_at: new Date() }
    });
    return {
      id: updated.id,
      customer: updated.customer_name,
      amount: updated.amount,
      dueDate: updated.due_date.toISOString(),
      status: updated.status as any
    };
  }

  async updatePayable(ctx: TenantContext, id: string, updates: Partial<PayableBill>, tx?: Prisma.TransactionClient): Promise<PayableBill | null> {
    const db = tx ?? this.prisma;
    const updated = await db.payables.update({
      where: { id, tenant_id: ctx.tenant_id },
      data: { status: updates.status, amount: updates.amount, due_date: updates.dueDate ? new Date(updates.dueDate) : undefined, updated_at: new Date() }
    });
    return {
      id: updated.id,
      vendor: updated.vendor_name,
      amount: updated.amount,
      dueDate: updated.due_date.toISOString(),
      status: updated.status as any
    };
  }

  // Documents
  async listDocuments(ctx: TenantContext): Promise<FinanceDocumentRow[]> {
    const docs = await this.prisma.finance_documents.findMany({ where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true, excludeEcommerce: true }) }, orderBy: { created_at: 'desc' } });
    return docs.map((d: any) => ({
      id: d.id,
      title: d.title,
      type: d.type,
      category: "OTHER",
      url: d.url,
      uploadDate: d.created_at.toISOString(),
      status: "APPROVED"
    }));
  }

  async createDocument(ctx: TenantContext, data: any, tx?: Prisma.TransactionClient): Promise<FinanceDocumentRow> {
    const db = tx ?? this.prisma;
    const created = await db.finance_documents.create({
      data: {
        id: randomUUID(),
        ...MultiTenancyUtil.getScope(ctx),
        title: data.title,
        type: data.type,
        url: data.url,
        description: data.description || '',
        uploaded_by: data.uploadedBy,
        updated_at: new Date(),
      }
    });
    return {
      id: created.id,
      title: created.title,
      type: created.type,
      category: "OTHER",
      uploadDate: created.created_at.toISOString(),
      status: "APPROVED",
      url: created.url
    };
  }

  // Policies
  async listPolicies(ctx: TenantContext): Promise<FinancePolicyRow[]> {
    const policies = await this.prisma.finance_policies.findMany({ where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true, excludeEcommerce: true }) }, orderBy: { created_at: 'desc' } });
    return policies.map((p: any) => ({
      id: p.id,
      name: p.title,
      description: p.description || p.title,
      status: p.active ? "ACTIVE" : "ARCHIVED",
      enforced: true
    }));
  }

  // Periods
  async listPeriods(ctx: TenantContext): Promise<AccountingPeriod[]> {
    const whereClause: any = { tenant_id: ctx.tenant_id };
    if (ctx.company_id && ctx.company_id !== "system") {
      whereClause.company_id = ctx.company_id;
    }

    let periods = await this.prisma.accounting_periods.findMany({
      where: whereClause,
      orderBy: { start_date: 'desc' }
    });

    // Auto-provision current fiscal year monthly periods if none exist for this tenant/company.
    if (periods.length === 0) {
      await this.provisionDefaultPeriods(ctx);
      periods = await this.prisma.accounting_periods.findMany({
        where: whereClause,
        orderBy: { start_date: 'desc' }
      });
    }

    return periods.map((p: any) => ({
      id: p.id,
      name: p.name,
      start_date: p.start_date.toISOString(),
      end_date: p.end_date.toISOString(),
      status: p.status as any
    }));
  }

  /**
   * Creates 12 monthly accounting periods for the current calendar year.
   * The period covering the current month is marked OPEN; all others CLOSED.
   * Idempotent via the (tenant_id, name) unique constraint (skipDuplicates).
   */
  private async provisionDefaultPeriods(ctx: TenantContext): Promise<void> {
    const now = new Date();
    const year = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth(); // 0-11
    const companyId =
      ctx.company_id && ctx.company_id !== 'system' ? ctx.company_id : null;

    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];

    const data = monthNames.map((mn, idx) => {
      const start = new Date(Date.UTC(year, idx, 1, 0, 0, 0));
      // Last day of the month: day 0 of next month
      const end = new Date(Date.UTC(year, idx + 1, 0, 23, 59, 59));
      return {
        tenant_id: ctx.tenant_id,
        company_id: companyId,
        name: `${mn} ${year}`,
        start_date: start,
        end_date: end,
        status: idx === currentMonth ? 'OPEN' : 'CLOSED',
      };
    });

    try {
      await this.prisma.accounting_periods.createMany({
        data,
        skipDuplicates: true,
      });
    } catch (err) {
      // Non-fatal: another concurrent request may have provisioned already.
      this.logger?.warn?.(
        `provisionDefaultPeriods failed for tenant ${ctx.tenant_id}: ${(err as Error).message}`,
      );
    }
  }

  // Insights & Alerts
  async getInsights(ctx: TenantContext): Promise<FinanceInsight[]> {
    const insights = await this.prisma.finance_insights.findMany({ 
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true, excludeEcommerce: true }) }, 
      orderBy: { created_at: 'desc' } 
    });
    return insights.map((i: any) => ({
      id: i.id,
      title: i.title,
      type: i.category === "WARNING" ? "WARNING" : "INFO",
      message: i.description,
      date: i.created_at.toISOString()
    }));
  }

  async getAlerts(ctx: TenantContext): Promise<FinanceAlert[]> {
    const alerts = await this.prisma.finance_alerts.findMany({ 
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true, excludeEcommerce: true }), status: "UNRESOLVED" }, 
      orderBy: { created_at: 'desc' } 
    });
    return alerts.map((a: any) => ({
      id: a.id,
      message: a.message,
      severity: a.severity as any,
      created_at: a.created_at.toISOString(),
      read: false
    }));
  }

  // Payroll Extras
  async createPayrollEntry(ctx: TenantContext, entry: Partial<PayrollEntry>, tx?: Prisma.TransactionClient): Promise<PayrollEntry> {
    return entry as PayrollEntry; 
  }

  async updatePayrollEntry(ctx: TenantContext, id: string, updates: Partial<PayrollEntry>, tx?: Prisma.TransactionClient): Promise<PayrollEntry | null> {
    return null; 
  }

  // Mappers
  private mapAsset(a: any): Asset {
    return {
      tenant_id: a.tenant_id,
      company_id: a.tenant_id, // tenant_id maps to company in this schema
      branch_id: a || "default",
      category_id: a.asset_class || "general",
      name: a.description || "Unnamed Asset",
      usefulLifeMonths: (Number(a.useful_life_years) || 0) * 12,
      currency: "USD",
      id: a.id,
      description: a.description,
      assetClass: a.asset_class,
      location: a,
      department: a.department_id,
      acquisitionCost: a.acquisition_cost,
      acquisitionDate: a.acquisition_date.toISOString(),
      usefulLifeYears: a.useful_life_years,
      residualValue: a.residual_value || new Prisma.Decimal(0),
      depreciationMethod: a.depreciation_method as any,
      accumulatedDepreciation: a.accumulated_dep || new Prisma.Decimal(0),
      carryingValue: a.carrying_value || new Prisma.Decimal(0),
      revaluationReserve: new Prisma.Decimal(0),
      status: a.status as any,
    };
  }

  private mapCapexRequest(c: any): CapexRequest {
    return {
      id: c.id,
      assetDescription: c.asset_description,
      requestedAmount: c.requested_amount,
      department: c.department,
      projectCode: c.project_code || "",
      status: c.status as any,
      currentApprovalStage: c.current_approval_stage as any,
      budgetMatched: c.budget_matched,
      created_at: c.created_at.toISOString(),
      requesterId: c.requested_by,
    };
  }

  // Bank Reconciliation & Analytics (Phase 5)
  async ingestBankTransactions(
    ctx: TenantContext,
    transactions: Partial<BankTransaction>[],
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    // To be implemented in Phase 5
  }

  async getUnreconciledTransactions(
    ctx: TenantContext,
  ): Promise<BankTransaction[]> {
    return [];
  }

  async createReconcileMatch(
    ctx: TenantContext,
    transaction_id: string,
    journal_id: string,
    score: number,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    // To be implemented in Phase 5
  }

  async getPerformanceTree(
    ctx: TenantContext,
    parentId?: string,
    type?: string,
  ): Promise<PerformanceTreeNode> {
    // To be implemented in Phase 5
    return {
      id: "root",
      name: "Total Organization",
      type: "TENANT",
      income: new Prisma.Decimal(0),
      expense: new Prisma.Decimal(0),
      net: new Prisma.Decimal(0),
    };
  }

  async listLoans(ctx: TenantContext, employee_id?: string) {
    const { tenant_id } = ctx;
    return (this.prisma as any).finance_loans.findMany({
      where: {
        tenant_id,
        ...(employee_id ? { employee_id } : {}),
      },
      include: {
        installments: true,
        employee: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });
  }

  async getLoanById(ctx: TenantContext, id: string) {
    const { tenant_id } = ctx;
    return (this.prisma as any).finance_loans.findUnique({
      where: { id, tenant_id },
      include: { installments: true },
    });
  }

  async createLoan(ctx: TenantContext, data: any, tx?: Prisma.TransactionClient) {
    const { tenant_id } = ctx;
    const client = tx || this.prisma;
    return (client as any).finance_loans.create({
      data: {
        ...data,
        tenant_id,
        // company_id is a nullable FK; ctx.company_id is not a real companies.id, so null.
        company_id: null,
        // interest_rate and start_date are required (no DB default) — supply sensible defaults.
        interest_rate: data.interest_rate ?? 0,
        start_date: data.start_date ? new Date(data.start_date) : new Date(),
        currency: data.currency || "IDR",
        updated_at: new Date(),
      },
    });
  }

  async updateLoanStatus(
    ctx: TenantContext,
    id: string,
    status: string,
    tx?: Prisma.TransactionClient,
  ) {
    const { tenant_id } = ctx;
    const client = tx || this.prisma;
    await (client as any).finance_loans.update({
      where: { id, tenant_id },
      data: { status },
    });
  }

  async listInstallments(ctx: TenantContext, loan_id: string) {
    return (this.prisma as any).finance_loan_installments.findMany({
      where: { loan_id },
      orderBy: { due_date: "asc" },
    });
  }
}
