import { apiRequest } from "@/core/api/apiClient";
import type { SessionContext } from "@/core/security/session";
import type { WorkflowRequest } from "@/core/tools/workflows/workflowTypes";
import type {
  Asset,
  AssetAuditPack,
  AssetAuditPackArtifact,
  AssetCapexInput,
  AssetDepreciationEntry,
  AssetEvent,
  CapexRequest,
  DepreciationMethod,
  DisposalType,
  FinanceCapexBudgetRow,
  ScheduledDepreciationRunResult,
  FinanceAlert,
} from "@/core/types/finance/assets";
import type {
  PaymentMethod,
  PaymentRequest,
  FinancePaymentRow,
} from "@/core/types/finance/payments";
import type {
  ReceivableInvoice,
  FinanceReceivableRow,
} from "@/core/types/finance/receivables";
import type {
  PayableBill,
  FinancePayableRow,
} from "@/core/types/finance/payables";

export type {
  Asset,
  AssetAuditPack,
  AssetAuditPackArtifact,
  AssetCapexInput,
  AssetDepreciationEntry,
  AssetEvent,
  CapexRequest,
  DepreciationMethod,
  DisposalType,
  FinanceCapexBudgetRow,
  ScheduledDepreciationRunResult,
  FinanceAlert,
  PaymentRequest,
  FinancePaymentRow,
  ReceivableInvoice,
  FinanceReceivableRow,
  PayableBill,
  FinancePayableRow,
};

export interface FinanceInvoiceRow {
  id: string;
  kind: "PAYABLE" | "RECEIVABLE";
  vendor: string;
  amount: number;
  invoiceDate: string;
  dueDate: string;
  status: "PENDING" | "APPROVED" | "PAID" | "OVERDUE";
}

export interface FinanceJournalRow {
  id: string;
  account: string;
  type: "DEBIT" | "CREDIT";
  amount: number;
  description: string;
  status: string;
  createdAt: string;
  lines?: JournalLineInput[];
}

export interface AccountingPeriod {
  id: string;
  startDate: string;
  endDate: string;
  status: "OPEN" | "CLOSING" | "CLOSED" | "FAILED";
  lockedBy?: string;
  approvalLevel?: number;
}

export interface FinanceInsight {
  id: string;
  title: string;
  category: "PAYMENTS" | "CASHFLOW" | "APPROVALS" | "PERIODS";
  value: string;
  trend: "UP" | "DOWN" | "NEUTRAL";
}

export interface FinanceDocumentRow {
  id: string;
  title: string;
  type: string;
  description: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  uploadedAt: string;
  uploadedBy: string;
}

export interface FinancePolicyRow {
  id: string;
  title: string;
  type: string;
  description: string;
  threshold: number;
  active: boolean;
}

export interface CapexBudgetPayload {
  department: string;
  totalBudget: number;
  notes?: string;
  accountCode?: string;
}

export interface DepreciationRunPayload {
  periodStart: string;
  periodEnd: string;
  postingDate?: string;
  cfoSignoff?: boolean;
}

export interface PostDepreciationPayload {
  assetId: string;
  postingDate: string;
  method?: DepreciationMethod;
  unitsProduced?: number;
  cfoSignoff?: boolean;
}

export interface AssetImpairmentPayload {
  assetId: string;
  impairmentAmount: number;
  reason: string;
  attachmentDocumentIds: string[];
}

export interface AssetRevaluationPayload {
  assetId: string;
  revaluedAmount: number;
  reason: string;
  attachmentDocumentIds: string[];
}

export interface AssetDisposalPayload {
  assetId: string;
  disposalType: DisposalType;
  proceeds: number;
  attachmentDocumentIds: string[];
}

export interface ReceivablePayload {
  customer: string;
  amount: number;
  dueDate: string;
  invoiceDate?: string;
  currency?: "IDR" | "USD";
}

export interface PayablePayload {
  vendor: string;
  amount: number;
  dueDate: string;
  currency?: string;
}

export interface InvoiceCapturePayload {
  vendor: string;
  amount: number;
  invoiceDate: string;
  dueDate: string;
}

export interface JournalLineInput {
  accountCode: string;
  description: string;
  debit: number;
  credit: number;
}

export interface JournalPayload {
  ref?: string;
  description: string;
  status?: string;
  lines: JournalLineInput[];
}

export interface PaymentRequestPayload {
  amount: number;
  currency?: string;
  method?:
    | "QRIS"
    | "GOPAY"
    | "OVO"
    | "DANA"
    | "SHOPEEPAY"
    | "BANK_TRANSFER"
    | "CARD";
  source?: string;
  beneficiary: string;
  departmentId?: string;
  purpose?: string;
  extraInfo?: Record<string, unknown>;
}

export interface TreasuryTransferPayload {
  sourceId: string;
  destinationId: string;
  amount: number;
  description: string;
}

export interface PolicyPayload {
  title: string;
  type: string;
  description: string;
  threshold: number;
}

export const financeService = {
  async getInbox(
    tenantId: string,
    session: SessionContext,
  ): Promise<{ alerts: FinanceAlert[], pendingPayments: FinancePaymentRow[], totalCount: number }> {
    return apiRequest<{ alerts: FinanceAlert[], pendingPayments: FinancePaymentRow[], totalCount: number }>("/v1/finance/inbox", "GET", session);
  },

  async getMoneySources(
    tenantId: string,
    session: SessionContext,
  ): Promise<
    Array<{
      id: string;
      name: string;
      type: string;
      currency: string;
      balance: number;
      provider?: string | null;
    }>
  > {
    return apiRequest<
      Array<{
        id: string;
        name: string;
        type: string;
        currency: string;
        balance: number;
        provider?: string | null;
      }>
    >("/v1/finance/money-sources", "GET", session);
  },

  async updateMoneySource(
    tenantId: string,
    id: string,
    updates: any,
    session: SessionContext,
  ): Promise<any> {
    return apiRequest<any>(`/v1/finance/money-sources/${id}`, "PATCH", session, updates);
  },

  async getAlerts(
    tenantId: string,
    session: SessionContext,
  ): Promise<FinanceAlert[]> {
    return apiRequest<FinanceAlert[]>("/v1/finance/alerts", "GET", session);
  },

  async createPaymentRequest(
    tenantId: string,
    session: SessionContext,
    payload: {
      amount: number;
      currency?: string;
      method?: PaymentMethod;
      source?: string;
      beneficiary: string;
      departmentId?: string;
      purpose?: string;
      extraInfo?: Record<string, unknown>;
    },
  ): Promise<PaymentRequest> {
    return apiRequest<PaymentRequest>(
      "/v1/finance/payment-requests",
      "POST",
      session,
      payload,
    );
  },

  async updatePaymentStatus(
    tenantId: string,
    id: string,
    status: string,
    session: SessionContext,
  ): Promise<void> {
    return apiRequest<void>(`/v1/finance/payments/${id}/status`, "PUT", session, {
      status,
    });
  },

  async listAssets(
    tenantId: string,
    session: SessionContext,
  ): Promise<Asset[]> {
    return apiRequest<Asset[]>("/v1/finance/assets", "GET", session);
  },

  async listPayments(
    tenantId: string,
    session: SessionContext,
  ): Promise<FinancePaymentRow[]> {
    return apiRequest<FinancePaymentRow[]>("/v1/finance/payments", "GET", session);
  },

  async listCapexRequests(
    tenantId: string,
    session: SessionContext,
  ): Promise<CapexRequest[]> {
    return apiRequest<CapexRequest[]>(
      "/v1/finance/capex/requests",
      "GET",
      session,
    );
  },

  async listCapexBudgets(
    tenantId: string,
    session: SessionContext,
  ): Promise<FinanceCapexBudgetRow[]> {
    return apiRequest<FinanceCapexBudgetRow[]>(
      "/v1/finance/capex/budgets",
      "GET",
      session,
    );
  },

  async setCapexBudget(
    tenantId: string,
    session: SessionContext,
    payload: CapexBudgetPayload,
  ): Promise<FinanceCapexBudgetRow> {
    return apiRequest<FinanceCapexBudgetRow>(
      "/v1/finance/capex/budgets",
      "POST",
      session,
      payload,
    );
  },

  async createCapexRequest(
    tenantId: string,
    session: SessionContext,
    input: AssetCapexInput,
  ): Promise<{ asset: Asset; capex: CapexRequest }> {
    return apiRequest<{ asset: Asset; capex: CapexRequest }>(
      "/v1/finance/capex/requests",
      "POST",
      session,
      input,
    );
  },

  async createAsset(
    tenantId: string,
    session: SessionContext,
    input: AssetCapexInput,
  ): Promise<Asset> {
    // Helper that just delegates to createCapexRequest as per original logic,
    // or we can invoke the API if there is a specific endpoint.
    // The original logic wrapped createCapexRequest.
    // For API efficiency, we can keep this wrapper if reuse is needed, or just call the API.
    // However, the original returned just the asset.
    const { asset } = await this.createCapexRequest(tenantId, session, input);
    return asset;
  },

  async approveCapexRequest(
    tenantId: string,
    session: SessionContext,
    requestId: string,
  ): Promise<CapexRequest | null> {
    return apiRequest<CapexRequest>(
      `/v1/finance/capex/requests/${requestId}/approve`,
      "POST",
      session,
    );
  },

  async rejectCapexRequest(
    tenantId: string,
    session: SessionContext,
    requestId: string,
    notes?: string,
  ): Promise<CapexRequest | null> {
    return apiRequest<CapexRequest>(
      `/v1/finance/capex/requests/${requestId}/reject`,
      "POST",
      session,
      { notes },
    );
  },

  async capitalizeAsset(
    tenantId: string,
    session: SessionContext,
    assetId: string,
    capitalizationDate: string,
  ): Promise<Asset | null> {
    return apiRequest<Asset>(
      `/v1/finance/assets/${assetId}/capitalize`,
      "POST",
      session,
      { capitalizationDate },
    );
  },

  async listAssetDepreciationEntries(
    tenantId: string,
    session: SessionContext,
    assetId?: string,
  ): Promise<AssetDepreciationEntry[]> {
    const query = assetId ? `?assetId=${assetId}` : "";
    return apiRequest<AssetDepreciationEntry[]>(
      `/v1/finance/assets/depreciation${query}`,
      "GET",
      session,
    );
  },

  async postDepreciation(
    tenantId: string,
    session: SessionContext,
    params: PostDepreciationPayload,
  ): Promise<AssetDepreciationEntry & { journalEntryId: string }> {
    return apiRequest<AssetDepreciationEntry & { journalEntryId: string }>(
      `/v1/finance/assets/${params.assetId}/depreciation`,
      "POST",
      session,
      params,
    );
  },

  async runScheduledPeriodDepreciation(
    tenantId: string,
    session: SessionContext,
    params: DepreciationRunPayload,
  ): Promise<ScheduledDepreciationRunResult> {
    return apiRequest<ScheduledDepreciationRunResult>(
      "/v1/finance/assets/depreciation/schedule-run",
      "POST",
      session,
      params,
    );
  },

  async recordAssetImpairment(
    tenantId: string,
    session: SessionContext,
    params: AssetImpairmentPayload,
  ): Promise<AssetEvent> {
    return apiRequest<AssetEvent>(
      `/v1/finance/assets/${params.assetId}/impairment`,
      "POST",
      session,
      params,
    );
  },

  async recordAssetRevaluation(
    tenantId: string,
    session: SessionContext,
    params: AssetRevaluationPayload,
  ): Promise<AssetEvent> {
    return apiRequest<AssetEvent>(
      `/v1/finance/assets/${params.assetId}/revaluation`,
      "POST",
      session,
      params,
    );
  },

  async disposeAsset(
    tenantId: string,
    session: SessionContext,
    params: AssetDisposalPayload,
  ): Promise<AssetEvent> {
    return apiRequest<AssetEvent>(
      `/v1/finance/assets/${params.assetId}/disposal`,
      "POST",
      session,
      params,
    );
  },

  async listAssetEvents(
    tenantId: string,
    session: SessionContext,
    assetId?: string,
  ): Promise<AssetEvent[]> {
    const query = assetId ? `?assetId=${assetId}` : "";
    return apiRequest<AssetEvent[]>(
      `/v1/finance/assets/events${query}`,
      "GET",
      session,
    );
  },

  async generateAssetAuditPack(
    tenantId: string,
    session: SessionContext,
    assetId: string,
  ): Promise<AssetAuditPack> {
    return apiRequest<AssetAuditPack>(
      `/v1/finance/assets/${assetId}/audit-pack`,
      "GET",
      session,
    );
  },

  async downloadAssetAuditPack(
    tenantId: string,
    session: SessionContext,
    assetId: string,
    format: "JSON" | "PDF",
  ): Promise<AssetAuditPackArtifact> {
    return apiRequest<AssetAuditPackArtifact>(
      `/v1/finance/assets/${assetId}/audit-pack/download?format=${format}`,
      "GET",
      session,
    );
  },

  async verifyAssetAuditPack(
    tenantId: string,
    session: SessionContext,
    pack: AssetAuditPack,
  ): Promise<boolean> {
    return apiRequest<boolean>(
      "/v1/finance/assets/audit-pack/verify",
      "POST",
      session,
      { pack },
    );
  },

  async updateAssetStatus(
    tenantId: string,
    session: SessionContext,
    id: string,
    status: Asset["status"],
  ): Promise<Asset | null> {
    return apiRequest<Asset>(`/v1/finance/assets/${id}/status`, "POST", session, {
      status,
    });
  },

  async listReceivables(
    tenantId: string,
    session: SessionContext,
  ): Promise<FinanceReceivableRow[]> {
    return apiRequest<FinanceReceivableRow[]>(
      "/v1/finance/receivables",
      "GET",
      session,
    );
  },

  async createReceivable(
    tenantId: string,
    session: SessionContext,
    payload: ReceivablePayload,
  ): Promise<ReceivableInvoice> {
    return apiRequest<ReceivableInvoice>(
      "/v1/finance/receivables",
      "POST",
      session,
      payload,
    );
  },

  async sendReceivableReminder(
    tenantId: string,
    session: SessionContext,
    id: string,
  ): Promise<void> {
    return apiRequest<void>(
      `/v1/finance/receivables/${id}/remind`,
      "POST",
      session,
    );
  },

  async markReceived(
    tenantId: string,
    session: SessionContext,
    id: string,
  ): Promise<void> {
    return apiRequest<void>(
      `/v1/finance/receivables/${id}/mark-received`,
      "POST",
      session,
    );
  },

  // Invoices (Aggregated)
  async listInvoices(
    tenantId: string,
    session: SessionContext,
  ): Promise<FinanceInvoiceRow[]> {
    return apiRequest<FinanceInvoiceRow[]>("/v1/finance/invoices", "GET", session);
  },

  async capturePayableInvoice(
    tenantId: string,
    session: SessionContext,
    payload: InvoiceCapturePayload,
  ): Promise<FinanceInvoiceRow> {
    return apiRequest<FinanceInvoiceRow>(
      "/v1/finance/payables",
      "POST",
      session,
      payload,
    );
  },


  async createPayable(
    tenantId: string,
    session: SessionContext,
    payload: PayablePayload,
  ): Promise<FinanceInvoiceRow> {
    // Adapter to capturePayableInvoice
    return this.capturePayableInvoice(tenantId, session, {
      vendor: payload.vendor,
      amount: payload.amount,
      dueDate: payload.dueDate,
      invoiceDate: new Date().toISOString(),
    });
  },

  // Periods
  async listPeriods(
    tenantId: string,
    session: SessionContext,
  ): Promise<AccountingPeriod[]> {
    const raw = await apiRequest<any[]>("/v1/finance/periods", "GET", session);
    return (Array.isArray(raw) ? raw : []).map((p) => ({
      id: p.id,
      startDate: p.startDate ?? p.start_date ?? "",
      endDate: p.endDate ?? p.end_date ?? "",
      status: p.status,
      lockedBy: p.lockedBy ?? p.locked_by,
      approvalLevel: p.approvalLevel ?? p.approval_level,
      // preserve name for display if present
      ...(p.name ? { name: p.name } : {}),
    })) as AccountingPeriod[];
  },

  async lockPeriod(
    tenantId: string,
    session: SessionContext,
    id: string,
  ): Promise<void> {
    return apiRequest<void>(`/v1/finance/fiscal-periods/${id}/lock`, "POST", session, { status: "SOFT_LOCK" });
  },

  async approvePeriodClose(
    tenantId: string,
    session: SessionContext,
    id: string,
  ): Promise<void> {
    return apiRequest<void>(
      `/v1/finance/fiscal-periods/${id}/close`,
      "POST",
      session,
    );
  },

  async markPeriodFailed(
    tenantId: string,
    session: SessionContext,
    id: string,
  ): Promise<void> {
    return apiRequest<void>(`/v1/finance/fiscal-periods/${id}/lock`, "POST", session, { status: "HARD_LOCK" });
  },

  async reopenPeriod(
    tenantId: string,
    session: SessionContext,
    id: string,
  ): Promise<void> {
    return apiRequest<void>(`/v1/finance/fiscal-periods/${id}/lock`, "POST", session, { status: "OPEN" });
  },

  async forceClosePeriod(
    tenantId: string,
    session: SessionContext,
    id: string,
  ): Promise<void> {
    return apiRequest<void>(
      `/v1/finance/fiscal-periods/${id}/close`,
      "POST",
      session,
    );
  },

  // Insights
  async getFinanceInsights(
    tenantId: string,
    session: SessionContext,
  ): Promise<FinanceInsight[]> {
    return apiRequest<FinanceInsight[]>("/v1/finance/intelligence/insights", "GET", session);
  },

  async getFinanceOverview(
    tenantId: string,
    session: SessionContext,
  ): Promise<any> {
    return apiRequest<any>(
      "/v1/finance/dashboard/summary",
      "GET",
      session,
    );
  },

  // Phase 8-11 Advanced Features
  async getTrendReport(
    session: SessionContext,
    companyId: string,
    periodIds: string[],
  ): Promise<any> {
    const query = (Array.isArray(periodIds) ? periodIds : []).map(p => `periodIds[]=${p}`).join('&');
    return apiRequest<any>(`/v1/finance/reporting/trends?companyId=${companyId}&${query}`, "GET", session);
  },

  async getConsolidatedReport(
    session: SessionContext,
    companyIds: string[],
    fiscalPeriodId: string,
  ): Promise<any> {
    const query = (Array.isArray(companyIds) ? companyIds : []).map(c => `companyIds[]=${c}`).join('&');
    return apiRequest<any>(`/v1/finance/reporting/consolidated?fiscalPeriodId=${fiscalPeriodId}&${query}`, "GET", session);
  },

  async getBudgetVariance(
    session: SessionContext,
    companyId: string,
    fiscalPeriodId: string,
  ): Promise<any> {
    return apiRequest<any>(`/v1/finance/operations/budget/variance?companyId=${companyId}&fiscalPeriodId=${fiscalPeriodId}`, "GET", session);
  },

  async submitWorkflow(
    session: SessionContext,
    payload: { entityType: string; entityId: string; data: any },
  ): Promise<any> {
    return apiRequest<any>("/v1/finance/operations/workflow/submit", "POST", session, payload);
  },

  async evaluateExpense(
    session: SessionContext,
    payload: { amount: number; category: string; departmentId: string },
  ): Promise<any> {
    return apiRequest<any>("/v1/finance/operations/expense/evaluate", "POST", session, payload);
  },

  async getTaxReport(
    session: SessionContext,
    companyId: string,
    fiscalPeriodId: string,
  ): Promise<any> {
    return apiRequest<any>(`/v1/finance/compliance/tax/report?companyId=${companyId}&fiscalPeriodId=${fiscalPeriodId}`, "GET", session);
  },

  async verifyLedgerIntegrity(
    session: SessionContext,
    companyId: string,
  ): Promise<any> {
    return apiRequest<any>(`/v1/finance/compliance/audit/integrity?companyId=${companyId}`, "GET", session);
  },

  async proveReport(
    session: SessionContext,
    reportId: string,
    reportHash: string,
  ): Promise<any> {
    return apiRequest<any>(`/v1/finance/compliance/audit/prove/${reportId}?reportHash=${reportHash}`, "GET", session);
  },

  // Reconciliation
  async uploadBankStatement(
    session: SessionContext,
    payload: any
  ): Promise<any> {
    return apiRequest<any>("/v1/finance/reconciliation/upload", "POST", session, payload);
  },

  async autoMatchTransactions(
    session: SessionContext,
    statementId?: string
  ): Promise<any> {
    return apiRequest<any>("/v1/finance/reconciliation/auto-match", "POST", session, { statementId });
  },

  async manualMatchTransactions(
    session: SessionContext,
    bankTxId: string,
    journalIds: string[]
  ): Promise<any> {
    return apiRequest<any>("/v1/finance/reconciliation/manual-match", "POST", session, { bankTxId, journalIds });
  },

  async unlinkMatch(
    session: SessionContext,
    matchId: string
  ): Promise<any> {
    return apiRequest<any>(`/v1/finance/reconciliation/match/${matchId}`, "DELETE", session);
  },

  async finalizeReconciliation(
    session: SessionContext,
    statementId: string
  ): Promise<any> {
    return apiRequest<any>("/v1/finance/reconciliation/finalize", "POST", session, { statementId });
  },

  async getUnmatchedLedger(
    session: SessionContext,
    glAccountId: string
  ): Promise<any[]> {
    return apiRequest<any[]>(`/v1/finance/reconciliation/unmatched-ledger?glAccountId=${glAccountId}`, "GET", session);
  },

  // JV Management
  async getJVProfiles(session: SessionContext): Promise<any[]> {
    return apiRequest<any[]>("/v1/finance/jv/profiles", "GET", session);
  },

  async getJVProfileDetail(session: SessionContext, profileId: string): Promise<any> {
    return apiRequest<any>(`/v1/finance/jv/profiles/${profileId}`, "GET", session);
  },

  async createJVProfile(session: SessionContext, data: any): Promise<any> {
    return apiRequest<any>("/v1/finance/jv/profiles", "POST", session, data);
  },

  async getJVLedger(session: SessionContext, filters?: any): Promise<any[]> {
    const query = filters ? new URLSearchParams(filters).toString() : "";
    return apiRequest<any[]>(`/v1/finance/jv/ledger?${query}`, "GET", session);
  },

  async getJVNetSettlement(session: SessionContext, periodId: string): Promise<any[]> {
    return apiRequest<any[]>(`/v1/finance/jv/settlement-summary?periodId=${periodId}`, "GET", session);
  },

  async getJVParticipations(session: SessionContext): Promise<any[]> {
    return apiRequest<any[]>("/v1/finance/jv/participations", "GET", session);
  },

  async inviteJVPartner(session: SessionContext, data: any): Promise<any> {
    return apiRequest<any>("/v1/finance/jv/invite", "POST", session, data);
  },

  async acceptJVInvite(session: SessionContext, token: string): Promise<any> {
    return apiRequest<any>("/v1/finance/jv/accept-invite", "POST", session, { token });
  },

  // ─── JV Expenses ─────────────────────────────────────────────────────
  async getJVExpenses(session: SessionContext, profileId: string, status?: string): Promise<any[]> {
    const params = new URLSearchParams({ profile_id: profileId });
    if (status) params.set('status', status);
    return apiRequest<any[]>(`/v1/finance/jv/expenses?${params}`, "GET", session);
  },

  async createJVExpense(session: SessionContext, data: any): Promise<any> {
    return apiRequest<any>("/v1/finance/jv/expenses", "POST", session, data);
  },

  async approveJVExpense(session: SessionContext, expenseId: string): Promise<any> {
    return apiRequest<any>("/v1/finance/jv/expenses/approve", "POST", session, { expense_id: expenseId });
  },

  async rejectJVExpense(session: SessionContext, expenseId: string, reason: string): Promise<any> {
    return apiRequest<any>("/v1/finance/jv/expenses/reject", "POST", session, { expense_id: expenseId, reason });
  },

  // ─── JV Settlements ──────────────────────────────────────────────────
  async getJVSettlements(session: SessionContext, profileId: string, status?: string): Promise<any[]> {
    const params = new URLSearchParams({ profile_id: profileId });
    if (status) params.set('status', status);
    return apiRequest<any[]>(`/v1/finance/jv/settlements?${params}`, "GET", session);
  },

  async getJVSettlementDetail(session: SessionContext, id: string): Promise<any> {
    return apiRequest<any>(`/v1/finance/jv/settlements/${id}`, "GET", session);
  },

  async generateJVSettlement(session: SessionContext, data: any): Promise<any> {
    return apiRequest<any>("/v1/finance/jv/settlements/generate", "POST", session, data);
  },

  async confirmJVSettlement(session: SessionContext, settlementId: string): Promise<any> {
    return apiRequest<any>("/v1/finance/jv/settlements/confirm", "POST", session, { settlement_id: settlementId });
  },

  async markJVSettlementPaid(session: SessionContext, settlementId: string, paymentRef: string, notes?: string): Promise<any> {
    return apiRequest<any>("/v1/finance/jv/settlements/paid", "POST", session, { settlement_id: settlementId, payment_ref: paymentRef, notes });
  },

  async disputeJVSettlement(session: SessionContext, settlementId: string, notes: string): Promise<any> {
    return apiRequest<any>("/v1/finance/jv/settlements/dispute", "POST", session, { settlement_id: settlementId, notes });
  },

  // ─── JV Permissions ──────────────────────────────────────────────────
  async getJVPermissions(session: SessionContext, participantId: string): Promise<any> {
    return apiRequest<any>(`/v1/finance/jv/permissions/${participantId}`, "GET", session);
  },

  async setJVPermission(session: SessionContext, data: any): Promise<any> {
    return apiRequest<any>("/v1/finance/jv/permissions", "POST", session, data);
  },

  async setJVBulkPermissions(session: SessionContext, data: any): Promise<any> {
    return apiRequest<any>("/v1/finance/jv/permissions/bulk", "POST", session, data);
  },

  // ─── JV P&L Report ───────────────────────────────────────────────────
  async getJVPnL(session: SessionContext, profileId: string, month?: number, year?: number): Promise<any> {
    const params = new URLSearchParams({ profile_id: profileId });
    if (month) params.set('month', month.toString());
    if (year) params.set('year', year.toString());
    return apiRequest<any>(`/v1/finance/jv/pnl?${params}`, "GET", session);
  },

  // ─── JV Activity Log ─────────────────────────────────────────────────
  async getJVActivityLog(session: SessionContext, profileId?: string, limit?: number): Promise<any[]> {
    const params = new URLSearchParams();
    if (profileId) params.set('profile_id', profileId);
    if (limit) params.set('limit', limit.toString());
    return apiRequest<any[]>(`/v1/finance/jv/activity?${params}`, "GET", session);
  },

  // ─── JV Split Configuration ────────────────────────────────────────────
  async getJVSplitStatus(session: SessionContext, profileId: string): Promise<any> {
    return apiRequest<any>(`/v1/finance/jv/split-status?profile_id=${profileId}`, "GET", session);
  },

  async proposeJVSplit(session: SessionContext, data: { jv_profile_id: string; splits: any[] }): Promise<any> {
    return apiRequest<any>("/v1/finance/jv/split/propose", "POST", session, data);
  },

  async confirmJVSplit(session: SessionContext, profileId: string): Promise<any> {
    return apiRequest<any>("/v1/finance/jv/split/confirm", "POST", session, { jv_profile_id: profileId });
  },
};


