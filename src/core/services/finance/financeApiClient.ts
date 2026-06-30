import { apiRequest } from "@/core/api/apiClient";
import type { SessionContext } from "@/core/security/session";
import type {
  AssetCapexInput,
  FinanceCapexBudgetRow,
  FinanceDocumentRow,
  FinanceReceivableRow,
  FinancePayableRow,
  FinanceInvoiceRow,
  FinanceJournalRow,
  FinancePaymentRow,
  FinancePolicyRow,
  FinanceInsight,
  AccountingPeriod,
  FinanceAlert,
  CapexBudgetPayload,
  DepreciationRunPayload,
  PostDepreciationPayload,
  AssetImpairmentPayload,
  AssetRevaluationPayload,
  AssetDisposalPayload,
  ReceivablePayload,
  PayablePayload,
  InvoiceCapturePayload,
  JournalPayload,
  PaymentRequestPayload,
  TreasuryTransferPayload,
  PolicyPayload,
  ScheduledDepreciationRunResult,
} from "@/core/services/finance/financeService";
import type {
  FixedAsset,
  CapexRequest,
  AssetDepreciationEntry,
  AssetEvent,
  AssetAuditPack,
} from "@/core/types/finance/assets";
import type { JournalEntry } from "@/core/types/finance/ledger";
import type { PaymentRequest } from "@/core/types/finance/payments";
import { PaymentMethod } from "@/core/types/finance/payments";
import type { PayableBill } from "@/core/types/finance/payables";
import type { ReceivableInvoice } from "@/core/types/finance/receivables";
import type { PayrollEntry, PayrollEstimate } from "@/core/types/finance/payrollTypes";
import type { WorkflowRequest } from "@/core/tools/workflows/workflowTypes";
import type { MoneySource } from "@/core/types/finance/accounts";
import type { TreasuryTransfer } from "@/core/types/finance/treasury";

export const financeApiClient = {
  // Assets & Capex
  listAssets: (tenantId: string, session: SessionContext) =>
    apiRequest<FixedAsset[]>("/v1/finance/assets", "GET", session),

  listCapexRequests: (tenantId: string, session: SessionContext) =>
    apiRequest<CapexRequest[]>("/v1/finance/capex/requests", "GET", session),

  listCapexBudgets: (tenantId: string, session: SessionContext) =>
    apiRequest<FinanceCapexBudgetRow[]>(
      "/finance/capex/budgets",
      "GET",
      session,
    ),

  setCapexBudget: (
    tenantId: string,
    session: SessionContext,
    payload: CapexBudgetPayload,
  ) => apiRequest<void>("/v1/finance/capex/budgets", "POST", session, payload),

  createCapexRequest: (
    tenantId: string,
    session: SessionContext,
    payload: AssetCapexInput,
  ) =>
    apiRequest<CapexRequest>(
      "/finance/capex/requests",
      "POST",
      session,
      payload,
    ),

  approveCapexRequest: (
    tenantId: string,
    session: SessionContext,
    requestId: string,
  ) =>
    apiRequest<CapexRequest>(
      `/finance/capex/requests/${requestId}/approve`,
      "POST",
      session,
    ),

  rejectCapexRequest: (
    tenantId: string,
    session: SessionContext,
    requestId: string,
    reason: string,
  ) =>
    apiRequest<CapexRequest>(
      `/finance/capex/requests/${requestId}/reject`,
      "POST",
      session,
      { reason },
    ),

  capitalizeAsset: (
    tenantId: string,
    session: SessionContext,
    assetId: string,
    capitalizationDate: string,
  ) =>
    apiRequest<FixedAsset>(
      `/finance/assets/${assetId}/capitalize`,
      "POST",
      session,
      { capitalizationDate },
    ),

  listAssetDepreciationEntries: (
    tenantId: string,
    session: SessionContext,
    assetId?: string,
  ) => {
    const query = assetId ? `?assetId=${assetId}` : "";
    return apiRequest<AssetDepreciationEntry[]>(
      `/finance/assets/depreciation${query}`,
      "GET",
      session,
    );
  },

  runScheduledPeriodDepreciation: (
    tenantId: string,
    session: SessionContext,
    payload: DepreciationRunPayload,
  ) =>
    apiRequest<ScheduledDepreciationRunResult>(
      "/finance/assets/depreciation/schedule-run",
      "POST",
      session,
      payload,
    ),

  postDepreciation: (
    tenantId: string,
    session: SessionContext,
    payload: PostDepreciationPayload,
  ) =>
    apiRequest<AssetDepreciationEntry & { journalEntryId: string }>(
      `/finance/assets/${payload.assetId}/depreciation`,
      "POST",
      session,
      payload,
    ),

  recordAssetImpairment: (
    tenantId: string,
    session: SessionContext,
    payload: AssetImpairmentPayload,
  ) =>
    apiRequest<AssetEvent>(
      `/finance/assets/${payload.assetId}/impairment`,
      "POST",
      session,
      payload,
    ),

  recordAssetRevaluation: (
    tenantId: string,
    session: SessionContext,
    payload: AssetRevaluationPayload,
  ) =>
    apiRequest<AssetEvent>(
      `/finance/assets/${payload.assetId}/revaluation`,
      "POST",
      session,
      payload,
    ),

  disposeAsset: (
    tenantId: string,
    session: SessionContext,
    payload: AssetDisposalPayload,
  ) =>
    apiRequest<AssetEvent>(
      `/finance/assets/${payload.assetId}/disposal`,
      "POST",
      session,
      payload,
    ),

  listAssetEvents: (
    tenantId: string,
    session: SessionContext,
    assetId?: string,
  ) => {
    const query = assetId ? `?assetId=${assetId}` : "";
    return apiRequest<AssetEvent[]>(
      `/finance/assets/events${query}`,
      "GET",
      session,
    );
  },

  updateAssetStatus: (
    tenantId: string,
    session: SessionContext,
    id: string,
    status: string,
  ) =>
    apiRequest<FixedAsset | null>(
      `/finance/assets/${id}/status`,
      "POST",
      session,
      { status },
    ),

  generateAssetAuditPack: (
    tenantId: string,
    session: SessionContext,
    assetId: string,
  ) =>
    apiRequest<AssetAuditPack>(
      `/finance/assets/${assetId}/audit-pack`,
      "GET",
      session,
    ),

  // Receivables
  listReceivables: (tenantId: string, session: SessionContext) =>
    apiRequest<FinanceReceivableRow[]>("/v1/finance/receivables", "GET", session),

  createReceivable: (
    tenantId: string,
    session: SessionContext,
    payload: ReceivablePayload,
  ) =>
    apiRequest<ReceivableInvoice>(
      "/finance/receivables",
      "POST",
      session,
      payload,
    ),

  markReceived: (tenantId: string, session: SessionContext, id: string) =>
    apiRequest<void>(
      `/finance/receivables/${id}/mark-received`,
      "POST",
      session,
    ),

  sendReceivableReminder: (
    tenantId: string,
    session: SessionContext,
    id: string,
  ) => apiRequest<void>(`/finance/receivables/${id}/remind`, "POST", session),

  // Payables
  listPayables: (tenantId: string, session: SessionContext) =>
    apiRequest<FinancePayableRow[]>("/v1/finance/payables", "GET", session),

  createPayable: (
    tenantId: string,
    session: SessionContext,
    payload: PayablePayload,
  ) => apiRequest<PayableBill>("/v1/finance/payables", "POST", session, payload),

  approvePayable: (tenantId: string, session: SessionContext, id: string) =>
    apiRequest<PayableBill | null>(
      `/finance/payables/${id}/approve`,
      "POST",
      session,
    ),

  markPaid: (tenantId: string, session: SessionContext, id: string) =>
    apiRequest<void>(`/finance/payables/${id}/mark-paid`, "POST", session),

  // Invoices (Aggregated)
  listInvoices: (tenantId: string, session: SessionContext) =>
    apiRequest<FinanceInvoiceRow[]>("/v1/finance/invoices", "GET", session),

  captureInvoice: (
    tenantId: string,
    session: SessionContext,
    payload: ReceivablePayload,
  ) =>
    apiRequest<ReceivableInvoice>(
      "/finance/receivables",
      "POST",
      session,
      payload,
    ),

  capturePayableInvoice: (
    tenantId: string,
    session: SessionContext,
    payload: InvoiceCapturePayload,
  ) =>
    apiRequest<PayableBill>(
      "/finance/payables",
      "POST",
      session,
      payload,
    ),

  // Journals
  listJournals: (tenantId: string, session: SessionContext) =>
    apiRequest<FinanceJournalRow[]>("/v1/finance/ledger", "GET", session),

  createJournal: (
    tenantId: string,
    session: SessionContext,
    payload: JournalPayload,
  ) => apiRequest<JournalEntry>("/v1/finance/ledger", "POST", session, payload),

  // Payments
  listPayments: (tenantId: string, session: SessionContext) =>
    apiRequest<FinancePaymentRow[]>("/v1/finance/payments", "GET", session),

  createPayment: (
    tenantId: string,
    session: SessionContext,
    payload: PaymentRequestPayload,
  ) =>
    apiRequest<PaymentRequest>("/v1/finance/payments", "POST", session, payload),

  createPaymentRequest: (
    tenantId: string,
    session: SessionContext,
    payload: PaymentRequestPayload,
  ) =>
    apiRequest<PaymentRequest>(
      "/finance/payment-requests",
      "POST",
      session,
      payload,
    ),

  updatePaymentStatus: (
    tenantId: string,
    session: SessionContext,
    id: string,
    status: string,
  ) =>
    apiRequest<void>(`/finance/payments/${id}/status`, "POST", session, {
      status,
    }),

  // Documents
  listDocuments: (tenantId: string, session: SessionContext) =>
    apiRequest<FinanceDocumentRow[]>("/v1/finance/documents", "GET", session),

  // Treasury
  listSources: (tenantId: string, session: SessionContext) =>
    apiRequest<MoneySource[]>("/v1/finance/treasury/sources", "GET", session),

  listTransfers: (tenantId: string, session: SessionContext) =>
    apiRequest<TreasuryTransfer[]>(
      "/finance/treasury/transfers",
      "GET",
      session,
    ),

  createTransfer: (
    tenantId: string,
    session: SessionContext,
    payload: TreasuryTransferPayload,
  ) =>
    apiRequest<TreasuryTransfer>(
      "/finance/treasury/transfers",
      "POST",
      session,
      payload,
    ),

  reconcileSettlement: (
    tenantId: string,
    session: SessionContext,
    sourceId: string,
    amount: number,
  ) =>
    apiRequest<void>("/v1/finance/treasury/reconcile", "POST", session, {
      sourceId,
      amount,
    }),

  uploadDocumentForApproval: (
    tenantId: string,
    session: SessionContext,
    payload: {
      title: string;
      type: string;
      description: string;
      file: File | Blob | null; // Improved from any
    },
  ) =>
    apiRequest<FinanceDocumentRow>(
      "/finance/documents/upload",
      "POST",
      session,
      payload,
    ),

  updateDocumentStatus: (
    tenantId: string,
    session: SessionContext,
    id: string,
    status: string,
  ) =>
    apiRequest<void>(`/finance/documents/${id}/status`, "POST", session, {
      status,
    }),

  // Policies
  listPolicies: (tenantId: string, session: SessionContext) =>
    apiRequest<FinancePolicyRow[]>("/v1/finance/policies", "GET", session),

  createPolicy: (
    tenantId: string,
    session: SessionContext,
    payload: PolicyPayload,
  ) =>
    apiRequest<FinancePolicyRow>("/v1/finance/policies", "POST", session, payload),

  togglePolicy: (tenantId: string, session: SessionContext, id: string) =>
    apiRequest<void>(`/finance/policies/${id}/toggle`, "POST", session),

  // Periods
  listPeriods: (tenantId: string, session: SessionContext) =>
    apiRequest<AccountingPeriod[]>("/v1/finance/periods", "GET", session),

  lockPeriod: (tenantId: string, session: SessionContext, id: string) =>
    apiRequest<void>(`/finance/periods/${id}/lock`, "POST", session),

  approvePeriodClose: (tenantId: string, session: SessionContext, id: string) =>
    apiRequest<void>(`/finance/periods/${id}/approve-close`, "POST", session),

  markPeriodFailed: (tenantId: string, session: SessionContext, id: string) =>
    apiRequest<void>(`/finance/periods/${id}/fail`, "POST", session),

  reopenPeriod: (tenantId: string, session: SessionContext, id: string) =>
    apiRequest<void>(`/finance/periods/${id}/reopen`, "POST", session),

  forceClosePeriod: (tenantId: string, session: SessionContext, id: string) =>
    apiRequest<void>(`/finance/periods/${id}/force-close`, "POST", session),

  // Dashboards & Snapshots (Hardened)
  getSnapshotSummary: (
    session: SessionContext,
    companyId: string,
    periodId: string,
    filters: Record<string, string>,
    snapshotSequence?: number,
    correlationId?: string,
  ) => {
    const queryParams = new URLSearchParams({
      companyId,
      periodId,
      ...filters,
    });
    if (snapshotSequence) queryParams.append("snapshotSequence", snapshotSequence.toString());
    
    return apiRequest<any>(
      `/finance/dashboard/summary?${queryParams.toString()}`,
      "GET",
      session,
      undefined,
      undefined, // tenantId from session ONLY
      correlationId,
    );
  },

  getHierarchicalReport: (
    session: SessionContext,
    companyId: string,
    periodId: string,
    reportType: "TB" | "PL" | "BS",
    snapshotSequence: number,
    correlationId?: string,
  ) => {
    return apiRequest<any>(
      `/finance/dashboard/summary?companyId=${companyId}&periodId=${periodId}&type=${reportType}&snapshotSequence=${snapshotSequence}`,
      "GET",
      session,
      undefined,
      undefined,
      correlationId,
    );
  },

  getGLLinesForSnapshot: (
    session: SessionContext,
    accountId: string,
    periodId: string,
    snapshotSequence: number,
    cursor?: string,
    correlationId?: string,
  ) => {
    const query = new URLSearchParams({
      accountId,
      periodId,
      snapshotSequence: snapshotSequence.toString(),
    });
    if (cursor) query.append("cursor", cursor);
    
    return apiRequest<any>(
      `/finance/dashboard/drilldown?${query.toString()}`,
      "GET",
      session,
      undefined,
      undefined,
      correlationId,
    );
  },

  exportDashboardReport: (
    session: SessionContext,
    payload: any,
    correlationId?: string,
  ) => {
    return apiRequest<any>(
      "/finance/dashboard/export",
      "POST",
      session,
      payload,
      undefined,
      correlationId,
    );
  },

  /**
   * Download a real, human-readable financial dashboard report file
   * (xlsx by default, or pdf). Returns a Blob for browser download.
   */
  downloadDashboardReportFile: (
    session: SessionContext,
    params: { company_id: string; periodId?: string; format?: "xlsx" | "pdf" },
  ) => {
    const qs = new URLSearchParams();
    if (params.company_id) qs.set("company_id", params.company_id);
    if (params.periodId) qs.set("periodId", params.periodId);
    qs.set("format", params.format || "xlsx");
    return apiRequest<Blob>(
      `/finance/dashboard/export/file?${qs.toString()}`,
      "GET",
      session,
      undefined,
      { responseType: "blob" },
    );
  },

  verifyExport: (session: SessionContext, data: any, signature: string) => 
    apiRequest<{ valid: boolean }>("/v1/finance/dashboard/verify-export", "POST", session, { data, signature }),

  getSystemHealth: (session: SessionContext, companyId: string) => 
    apiRequest<any>(`/finance/dashboard/health?companyId=${companyId}`, "GET", session),

  repairAuditChain: (session: SessionContext, fromTimestamp?: string) => 
    apiRequest<any>("/v1/finance/dashboard/repair-chain", "POST", session, { fromTimestamp }),

  // Financial Intelligence (Phase 1: Cashflow Engine)
  getCashflow: (
    session: SessionContext,
    params: {
      companyId: string;
      snapshotId?: string;
      days?: number;
      minimumSafeCash?: number;
      avgDelayDays?: number;
      timezone?: string;
      revenueMultiplier?: number;
      expenseMultiplier?: number;
      scenarioDelayDays?: number;
      correlationId?: string;
    }
  ) => {
    const query = new URLSearchParams({ companyId: params.companyId });
    if (params.snapshotId) query.append("snapshotId", params.snapshotId);
    if (params.days) query.append("days", params.days.toString());
    if (params.minimumSafeCash) query.append("minimumSafeCash", params.minimumSafeCash.toString());
    if (params.avgDelayDays) query.append("avgDelayDays", params.avgDelayDays.toString());
    if (params.timezone) query.append("timezone", params.timezone);
    if (params.revenueMultiplier) query.append("revenueMultiplier", params.revenueMultiplier.toString());
    if (params.expenseMultiplier) query.append("expenseMultiplier", params.expenseMultiplier.toString());
    if (params.scenarioDelayDays) query.append("scenarioDelayDays", params.scenarioDelayDays.toString());

    return apiRequest<any>(
      `/finance/intelligence/cashflow?${query.toString()}`,
      "GET",
      session,
      undefined,
      undefined,
      params.correlationId
    );
  },

  // Insights & Alerts
  getFinanceInsights: (tenantId: string, session: SessionContext) =>
    apiRequest<FinanceInsight[]>("/v1/finance/insights", "GET", session),

  getInbox: (tenantId: string, session: SessionContext) =>
    apiRequest<WorkflowRequest[]>("/v1/finance/inbox", "GET", session),

  getAlerts: (tenantId: string, session: SessionContext) =>
    apiRequest<FinanceAlert[]>("/v1/finance/alerts", "GET", session),

  // Payroll
  getPayrollEntries: (
    tenantId: string,
    session: SessionContext,
    period?: string,
  ) => {
    const query = period ? `?period=${period}` : "";
    return apiRequest<PayrollEntry[]>(
      `/finance/payroll/entries${query}`,
      "GET",
      session,
    );
  },

  createPayrollEntry: (
    tenantId: string,
    session: SessionContext,
    payload: Partial<PayrollEntry>,
  ) =>
    apiRequest<PayrollEntry>(
      "/finance/payroll/entries",
      "POST",
      session,
      payload,
    ),

  updatePayrollEntry: (
    tenantId: string,
    session: SessionContext,
    entryId: string,
    updates: Partial<PayrollEntry>,
  ) =>
    apiRequest<PayrollEntry>(
      `/finance/payroll/entries/${entryId}`,
      "PATCH",
      session,
      updates,
    ),

  estimatePayroll: (
    tenantId: string,
    session: SessionContext,
    period: string,
  ) =>
    apiRequest<PayrollEstimate[]>(
      `/finance/payroll/estimate?period=${period}`,
      "GET",
      session,
    ),

  runPayroll: (tenantId: string, session: SessionContext, period: string) =>
    apiRequest<boolean>("/v1/finance/payroll/run", "POST", session, { period }),
};

