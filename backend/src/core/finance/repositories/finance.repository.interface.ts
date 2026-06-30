import { Prisma } from "@prisma/client";
import { LedgerEntry } from "../entities/ledger-entry.entity";
import { Transaction } from "../entities/transaction.entity";
import { Balance } from "../entities/balance.entity";
import { CreateTransactionDto } from "../dto/create-transaction.dto";
import { TenantContext } from "../../../gateway/tenant-context.interface";
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
  FinanceMoneySourceRow,
  TreasuryTransfer,
  BankTransaction,
  PerformanceTreeNode,
} from "../finance.types";

/**
 * Finance Repository Interface
 * Abstract class defining the contract for finance data persistence
 * Using abstract class instead of interface for NestJS DI compatibility
 *
 * CRITICAL: All methods MUST accept TenantContext as the first argument
 * to enforce multi-tenancy and hierarchy at the data layer
 */
export abstract class IFinanceRepository {
  // Ledger & Transactions
  abstract getLedger(
    ctx: TenantContext,
    location_id?: string,
  ): Promise<LedgerEntry[]>;
  abstract createTransaction(
    ctx: TenantContext,
    data: CreateTransactionDto,
    tx?: Prisma.TransactionClient,
  ): Promise<Transaction>;
  abstract createJournal(
    ctx: TenantContext,
    data: any,
    tx?: Prisma.TransactionClient,
  ): Promise<any>;
  abstract getBalance(ctx: TenantContext): Promise<Balance>;
  abstract getTransactionById(
    ctx: TenantContext,
    transaction_id: string,
  ): Promise<Transaction | null>;

  // Money Sources
  abstract listMoneySources(ctx: TenantContext): Promise<FinanceMoneySourceRow[]>;
  abstract updateMoneySource(
    ctx: TenantContext,
    id: string,
    updates: Partial<FinanceMoneySourceRow>,
    tx?: Prisma.TransactionClient,
  ): Promise<FinanceMoneySourceRow>;

  // Treasury
  abstract listTransfers(ctx: TenantContext): Promise<TreasuryTransfer[]>;
  abstract createTransfer(
    ctx: TenantContext,
    data: Partial<TreasuryTransfer>,
    tx?: Prisma.TransactionClient,
  ): Promise<TreasuryTransfer>;
  abstract reconcileSettlement(
    ctx: TenantContext,
    sourceId: string,
    amount: number,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;

  // Assets
  abstract listAssets(ctx: TenantContext): Promise<Asset[]>;
  abstract getAssetById(
    ctx: TenantContext,
    assetId: string,
  ): Promise<Asset | null>;
  abstract createAsset(
    ctx: TenantContext,
    asset: Partial<Asset>,
    tx?: Prisma.TransactionClient,
  ): Promise<Asset>;
  abstract updateAsset(
    ctx: TenantContext,
    assetId: string,
    updates: Partial<Asset>,
    tx?: Prisma.TransactionClient,
  ): Promise<Asset | null>;

  // Capex
  abstract listCapexRequests(ctx: TenantContext): Promise<CapexRequest[]>;
  abstract getCapexRequestById(
    ctx: TenantContext,
    id: string,
  ): Promise<CapexRequest | null>;
  abstract createCapexRequest(
    ctx: TenantContext,
    request: Partial<CapexRequest>,
    tx?: Prisma.TransactionClient,
  ): Promise<CapexRequest>;
  abstract updateCapexRequest(
    ctx: TenantContext,
    id: string,
    updates: Partial<CapexRequest>,
    tx?: Prisma.TransactionClient,
  ): Promise<CapexRequest | null>;
  abstract listCapexBudgets(ctx: TenantContext): Promise<FinanceCapexBudgetRow[]>;
  abstract setCapexBudget(
    ctx: TenantContext,
    budget: FinanceCapexBudgetRow,
  ): Promise<void>;

  // Depreciation & Events
  abstract listAssetDepreciationEntries(
    ctx: TenantContext,
    assetId?: string,
  ): Promise<AssetDepreciationEntry[]>;
  abstract createDepreciationEntry(
    ctx: TenantContext,
    entry: Partial<AssetDepreciationEntry>,
    tx?: Prisma.TransactionClient,
  ): Promise<AssetDepreciationEntry>;
  abstract listAssetEvents(
    ctx: TenantContext,
    assetId?: string,
  ): Promise<AssetEvent[]>;
  abstract createAssetEvent(
    ctx: TenantContext,
    event: Partial<AssetEvent>,
    tx?: Prisma.TransactionClient,
  ): Promise<AssetEvent>;
  abstract getAssetAuditPack(
    ctx: TenantContext,
    assetId: string,
  ): Promise<AssetAuditPack>;

  // Receivables
  abstract listReceivables(ctx: TenantContext): Promise<FinanceReceivableRow[]>;
  abstract createReceivable(
    ctx: TenantContext,
    invoice: Partial<ReceivableInvoice>,
    tx?: Prisma.TransactionClient,
  ): Promise<ReceivableInvoice>;
  abstract updateReceivable(
    ctx: TenantContext,
    id: string,
    updates: Partial<ReceivableInvoice>,
    tx?: Prisma.TransactionClient,
  ): Promise<ReceivableInvoice | null>;

  // Payables
  abstract listPayables(ctx: TenantContext): Promise<FinancePayableRow[]>;
  abstract createPayable(
    ctx: TenantContext,
    bill: Partial<PayableBill>,
    tx?: Prisma.TransactionClient,
  ): Promise<PayableBill>;
  abstract updatePayable(
    ctx: TenantContext,
    id: string,
    updates: Partial<PayableBill>,
    tx?: Prisma.TransactionClient,
  ): Promise<PayableBill | null>;
  abstract markPayablePaid(
    ctx: TenantContext,
    id: string,
  ): Promise<PayableBill>;

  // Payments
  abstract listPayments(ctx: TenantContext): Promise<FinancePaymentRow[]>;
  abstract createPaymentRequest(
    ctx: TenantContext,
    request: Partial<PaymentRequest>,
    tx?: Prisma.TransactionClient,
  ): Promise<PaymentRequest>;
  abstract updatePaymentStatus(
    ctx: TenantContext,
    id: string,
    status: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;

  // Documents
  abstract listDocuments(ctx: TenantContext): Promise<FinanceDocumentRow[]>;
  abstract createDocument(
    ctx: TenantContext,
    doc: Partial<FinanceDocumentRow>,
    tx?: Prisma.TransactionClient,
  ): Promise<FinanceDocumentRow>;

  // Policies & Periods
  abstract listPolicies(ctx: TenantContext): Promise<FinancePolicyRow[]>;
  abstract listPeriods(ctx: TenantContext): Promise<AccountingPeriod[]>;

  // Insights & Alerts
  abstract getInsights(ctx: TenantContext): Promise<FinanceInsight[]>;
  abstract getAlerts(ctx: TenantContext): Promise<FinanceAlert[]>;

  // Payroll
  abstract listPayrollEntries(
    ctx: TenantContext,
    period?: string,
  ): Promise<PayrollEntry[]>;
  abstract createPayrollEntry(
    ctx: TenantContext,
    entry: Partial<PayrollEntry>,
    tx?: Prisma.TransactionClient,
  ): Promise<PayrollEntry>;
  abstract estimatePayroll(
    ctx: TenantContext,
    period: string,
  ): Promise<PayrollEstimate[]>;
  abstract executePayrollRun(
    ctx: TenantContext,
    period: string,
    user_id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
  abstract updatePayrollEntry(
    ctx: TenantContext,
    id: string,
    updates: Partial<PayrollEntry>,
    tx?: Prisma.TransactionClient,
  ): Promise<PayrollEntry | null>;

  // Bank Reconciliation & Analytics (Phase 5)
  abstract ingestBankTransactions(
    ctx: TenantContext,
    transactions: Partial<BankTransaction>[],
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
  abstract getUnreconciledTransactions(
    ctx: TenantContext
  ): Promise<BankTransaction[]>;
  abstract createReconcileMatch(
    ctx: TenantContext,
    transaction_id: string,
    journal_id: string,
    score: number,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
  abstract getPerformanceTree(
    ctx: TenantContext,
    parentId?: string,
    type?: string
  ): Promise<PerformanceTreeNode>;

  // Loans
  abstract listLoans(ctx: TenantContext, employee_id?: string): Promise<any[]>;
  abstract getLoanById(ctx: TenantContext, id: string): Promise<any | null>;
  abstract createLoan(ctx: TenantContext, data: any, tx?: Prisma.TransactionClient): Promise<any>;
  abstract updateLoanStatus(ctx: TenantContext, id: string, status: string, tx?: Prisma.TransactionClient): Promise<void>;
  abstract listInstallments(ctx: TenantContext, loan_id: string): Promise<any[]>;
}

