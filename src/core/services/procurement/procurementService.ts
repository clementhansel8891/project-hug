import { apiRequest } from "@/core/api/apiClient";
import { audit } from "@/core/logging/audit";
import type { SessionContext } from "@/core/security/session";
import { financeService } from "@/core/services/finance/financeService";
import { workflowService } from "@/core/services/hr/workflowService";
import { procurementIntegrationAdapters } from "@/core/services/procurement/procurementIntegrationAdapters";
import type {
  ContractRecord,
  DraftPurchaseOrder,
  FinalPurchaseOrder,
  GoodsReceiptSyncStatus,
  PoLineItem,
  ProcurementAuditEvent,
  ProcurementSpendInsight,
  RatingLog,
  ReceiptRecord,
  Requisition,
  RiskSignal,
  RiskSignalStatus,
  RiskTier,
  SupplierBranch,
  SupplierMaster,
  SupplierPortalMessage,
  SupplierProduct,
  SupplierRecommendation,
} from "@/core/types/procurement/procurement";

const nowIso = () => new Date().toISOString();
const createId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const ensureTenant = (tenantId: string, session: SessionContext) => {
  if (session.role === "SUPERADMIN") return;
  if (tenantId !== session.tenant_id) throw new Error("Tenant access denied");
};

const BUDGET_LIMITS: Record<Requisition["budgetClass"], number> = {
  OPEX: 1000000000,
  CAPEX: 10000000000,
  EMERGENCY: 500000000,
};

const logEvent = (
  tenantId: string,
  session: SessionContext,
  action: string,
  entityType: ProcurementAuditEvent["entityType"],
  entityId: string,
  detail: string,
) => {
  // Direct API call for audit
  apiRequest("/v1/procurement/audit-events", "POST", session, {
    actorId: session.user_id,
    action,
    entityType,
    entityId,
    detail,
  });

  audit.log({
    tenantId,
    actorId: session.user_id,
    action: `procurement.${action}`,
    entityType: entityType.toLowerCase(),
    entityId,
    after: { detail },
  });
};

const createOpenRisk = async (
  tenantId: string,
  session: SessionContext,
  code: RiskSignal["code"],
  severity: RiskSignal["severity"],
  entityId: string,
  detail: string,
) => {
  return apiRequest<RiskSignal>("/v1/procurement/risk-signals", "POST", session, {
    code,
    severity,
    status: "OPEN",
    entityId,
    detail,
  });
};

export const procurementService = {
  listSupplierMasters: async (tenantId: string, session: SessionContext) =>
    apiRequest<SupplierMaster[]>("/v1/procurement/suppliers", "GET", session),

  listSupplierBranches: async (tenantId: string, session: SessionContext) =>
    apiRequest<SupplierBranch[]>("/v1/procurement/branches", "GET", session),

  listSupplierProducts: async (tenantId: string, session: SessionContext) =>
    apiRequest<SupplierProduct[]>("/v1/procurement/products", "GET", session),

  listRequisitions: async (tenantId: string, session: SessionContext) =>
    apiRequest<Requisition[]>("/v1/procurement/requisitions", "GET", session),

  listDraftPurchaseOrders: async (tenantId: string, session: SessionContext) =>
    apiRequest<DraftPurchaseOrder[]>("/v1/procurement/draft-pos", "GET", session),

  listFinalPurchaseOrders: async (tenantId: string, session: SessionContext) =>
    apiRequest<FinalPurchaseOrder[]>(
      "/v1/procurement/purchase-orders",
      "GET",
      session,
    ),

  listContracts: async (tenantId: string, session: SessionContext) =>
    apiRequest<ContractRecord[]>("/v1/procurement/contracts", "GET", session),

  listPortalMessages: async (tenantId: string, session: SessionContext) => {
    try { return await apiRequest<any[]>("/v1/procurement/portal-messages", "GET", session); } catch { return []; }
  },

  listRatingLogs: async (tenantId: string, session: SessionContext) => {
    try { return await apiRequest<any[]>("/v1/procurement/rating-logs", "GET", session); } catch { return []; }
  },

  listRiskSignals: async (tenantId: string, session: SessionContext) =>
    apiRequest<RiskSignal[]>("/v1/procurement/risk-signals", "GET", session),

  listAuditEvents: async (tenantId: string, session: SessionContext) =>
    apiRequest<ProcurementAuditEvent[]>(
      "/v1/procurement/audit-events",
      "GET",
      session,
    ),

  listCategories: async (tenantId: string, session: SessionContext) =>
    apiRequest<any[]>("/v1/procurement/categories", "GET", session),

  upsertCategory: async (
    tenantId: string,
    session: SessionContext,
    payload: { id?: string; name: string; description?: string; active?: boolean },
  ) => apiRequest<any>("/v1/procurement/categories/upsert", "POST", session, payload),

  deleteCategory: async (tenantId: string, session: SessionContext, id: string) =>
    apiRequest<any>(`/v1/procurement/categories/${id}`, "DELETE", session),

  getOverview: async (tenantId: string, session: SessionContext) =>
    apiRequest<any>("/v1/procurement/overview", "GET", session),

  listLegalHandoffs: async (tenantId: string, session: SessionContext) =>
    await procurementIntegrationAdapters.listLegalHandoffs(tenantId, session),
  listGoodsReceiptSyncs: async (tenantId: string, session: SessionContext) =>
    await procurementIntegrationAdapters.listGoodsReceiptSyncs(
      tenantId,
      session,
    ),
  updateGoodsReceiptSyncStatus: async (
    tenantId: string,
    session: SessionContext,
    syncId: string,
    payload: {
      status: GoodsReceiptSyncStatus;
      issueCount: number;
      invoiceMismatch: boolean;
    },
  ) =>
    await procurementIntegrationAdapters.setGoodsReceiptSyncStatus(
      tenantId,
      session,
      syncId,
      payload,
    ),
  updateSupplierAccessProvisioningStatus: async (
    tenantId: string,
    session: SessionContext,
    requestId: string,
    status: string,
  ) =>
    await procurementIntegrationAdapters.setSupplierAccessProvisioningStatus(
      tenantId,
      session,
      requestId,
      status as any,
    ),
  listSupplierAccessProvisioning: async (
    tenantId: string,
    session: SessionContext,
  ) =>
    await procurementIntegrationAdapters.listSupplierAccessProvisioning(
      tenantId,
      session,
    ),

  async createSupplierMaster(
    tenantId: string,
    session: SessionContext,
    payload: {
      name: string;
      taxId: string;
      categories: string[];
      branchCode: string;
      website?: string;
      contactPerson?: string;
      contactEmail?: string;
      contactPhone?: string;
      address?: string;
      fullAddress?: string; // for the primary branch
    },
  ): Promise<SupplierMaster> {
    ensureTenant(tenantId, session);
    const created = await apiRequest<SupplierMaster>(
      "/v1/procurement/suppliers",
      "POST",
      session,
      {
        ...payload,
        category: payload.categories[0] || "General",
      },
    );

    await workflowService.createRequest(tenantId, session, {
      entityType: "PURCHASE",
      entityId: created.id,
      makerDept: session.department_id,
      destinationDept: "LEGAL",
      notes: "Supplier onboarding compliance verification",
    });
    logEvent(
      tenantId,
      session,
      "supplier.created",
      "SUPPLIER",
      created.id,
      created.name,
    );
    return created;
  },

  async createSupplierBranch(
    tenantId: string,
    session: SessionContext,
    payload: {
      supplierId: string;
      branchCode: string;
      branchName: string;
      location: string;
      leadTimeDays: number;
      fullAddress?: string;
      contactPerson?: string;
      contactEmail?: string;
      contactPhone?: string;
    },
  ): Promise<SupplierBranch> {
    ensureTenant(tenantId, session);
    const created = await apiRequest<SupplierBranch>(
      "/v1/procurement/branches",
      "POST",
      session,
      payload,
    );
    logEvent(
      tenantId,
      session,
      "supplier_branch.created",
      "SUPPLIER_BRANCH",
      created.id,
      created.branchName,
    );
    return created;
  },

  async upsertSupplierProduct(
    tenantId: string,
    session: SessionContext,
    payload: Omit<SupplierProduct, "tenantId" | "updatedAt">,
  ): Promise<SupplierProduct> {
    ensureTenant(tenantId, session);
    const updated = await apiRequest<SupplierProduct>(
      "/v1/procurement/products",
      "POST",
      session,
      payload,
    );
    logEvent(
      tenantId,
      session,
      "supplier_product.upserted",
      "SUPPLIER_BRANCH",
      updated.id,
      updated.name,
    );
    return updated;
  },

  async createRequisition(
    tenantId: string,
    session: SessionContext,
    payload: {
      title: string;
      description: string;
      category: string;
      branchCode: string;
      budgetClass: Requisition["budgetClass"];
      amount: number;
      contractRequired: boolean;
    },
  ): Promise<Requisition> {
    ensureTenant(tenantId, session);
    const created = await apiRequest<Requisition>(
      "/v1/procurement/requisitions",
      "POST",
      session,
      {
        ...payload,
        requesterDept: session.department_id,
        createdBy: session.user_id,
      },
    );

    await workflowService.createRequest(tenantId, session, {
      entityType: "PURCHASE",
      entityId: created.id,
      makerDept: session.department_id,
      destinationDept: "REQUESTER_HOD",
      notes: "Requester HOD approval gate",
    });

    if (created.amount > BUDGET_LIMITS[created.budgetClass]) {
      await createOpenRisk(
        tenantId,
        session,
        "PRICE_SPIKE",
        "HIGH",
        created.id,
        `Amount exceeds ${created.budgetClass} threshold.`,
      );
    }
    logEvent(
      tenantId,
      session,
      "requisition.created",
      "REQUISITION",
      created.id,
      created.title,
    );
    return created;
  },

  async approveRequesterHod(
    tenantId: string,
    session: SessionContext,
    requisitionId: string,
  ) {
    ensureTenant(tenantId, session);
    const updated = await apiRequest<Requisition>(
      `/v1/procurement/requisitions/${requisitionId}/approve-requester-hod`,
      "PUT",
      session,
    );
    logEvent(
      tenantId,
      session,
      "requisition.requester_hod_approved",
      "REQUISITION",
      requisitionId,
      updated.title,
    );
    return updated;
  },

  async buildDraftPurchaseOrder(
    tenantId: string,
    session: SessionContext,
    payload: {
      requisitionId: string;
      supplierId: string;
      supplierBranchId: string;
      contractType: DraftPurchaseOrder["contractType"];
      lineItems: Array<{
        productSku: string;
        description: string;
        quantity: number;
        uom: string;
        unitPrice: number;
      }>;
    },
  ): Promise<DraftPurchaseOrder> {
    ensureTenant(tenantId, session);

    // Instead of local find, we send to backend which should handle validation
    const draft = await apiRequest<DraftPurchaseOrder>(
      "/v1/procurement/draft-pos",
      "POST",
      session,
      payload,
    );

    logEvent(
      tenantId,
      session,
      "draft_po.created",
      "DRAFT_PO",
      draft.id,
      payload.requisitionId,
    );
    return draft;
  },

  async approveDraftByProcurementHod(
    tenantId: string,
    session: SessionContext,
    draftPoId: string,
  ) {
    ensureTenant(tenantId, session);
    const updated = await apiRequest<Requisition>(
      `/v1/procurement/draft-pos/${draftPoId}/approve`,
      "PUT",
      session,
    );
    logEvent(
      tenantId,
      session,
      "draft_po.procurement_hod_approved",
      "DRAFT_PO",
      draftPoId,
      draftPoId,
    );
    return updated;
  },

  async confirmSupplierQuote(
    tenantId: string,
    session: SessionContext,
    payload: {
      draftPoId: string;
      quoteReference: string;
      quoteNotes: string;
      quoteAttachment?: string;
      quotedTotal?: number;
    },
  ) {
    ensureTenant(tenantId, session);
    const updated = await apiRequest<DraftPurchaseOrder>(
      `/v1/procurement/draft-pos/${payload.draftPoId}/confirm-quote`,
      "PUT",
      session,
      payload,
    );
    return updated;
  },

  async upsertContractForRequisition(
    tenantId: string,
    session: SessionContext,
    payload: {
      requisitionId: string;
      supplierId: string;
      notes?: string;
      attachmentIds?: string[];
    },
  ): Promise<ContractRecord> {
    ensureTenant(tenantId, session);
    const contract = await apiRequest<ContractRecord>(
      "/v1/procurement/contracts",
      "POST",
      session,
      payload,
    );

    // Legacy workflow trigger
    const legalWorkflow = await workflowService.createRequest(
      tenantId,
      session,
      {
        entityType: "CONTRACT",
        entityId: contract.id,
        makerDept: session.department_id,
        destinationDept: "LEGAL",
        notes: "Procurement contract ownership handoff",
      },
    );

    await procurementIntegrationAdapters.requestLegalContractHandoff(
      tenantId,
      session,
      {
        requisitionId: payload.requisitionId,
        contractId: contract.id,
        supplierId: payload.supplierId,
        notes: payload.notes,
        workflowRequestId: legalWorkflow.id,
      },
    );

    logEvent(
      tenantId,
      session,
      "contract.upserted",
      "CONTRACT",
      contract.id,
      payload.requisitionId,
    );
    return contract;
  },

  async approveLegalContract(
    tenantId: string,
    session: SessionContext,
    contractId: string,
  ) {
    ensureTenant(tenantId, session);
    const updated = await apiRequest<ContractRecord>(
      `/v1/procurement/contracts/${contractId}/approve-legal`,
      "PUT",
      session,
    );
    return updated;
  },

  async signContractParty(
    tenantId: string,
    session: SessionContext,
    contractId: string,
    party: "SUPPLIER" | "PROCUREMENT_HOD" | "FINANCE_HOD",
  ) {
    ensureTenant(tenantId, session);
    const updated = await apiRequest<ContractRecord>(
      `/v1/procurement/contracts/${contractId}/sign`,
      "PUT",
      session,
      { party },
    );
    return updated;
  },

  async setFinalApproval(
    tenantId: string,
    session: SessionContext,
    requisitionId: string,
    approver: "REQUESTER_HOD" | "PROCUREMENT_HOD" | "FINANCE_HOD",
  ) {
    ensureTenant(tenantId, session);
    const updated = await apiRequest<Requisition>(
      `/v1/procurement/requisitions/${requisitionId}/approve-final`,
      "PUT",
      session,
      { approver },
    );
    return updated;
  },

  async releasePurchaseOrder(
    tenantId: string,
    session: SessionContext,
    requisitionId: string,
  ): Promise<FinalPurchaseOrder> {
    ensureTenant(tenantId, session);
    const finalPo = await apiRequest<FinalPurchaseOrder>(
      "/v1/procurement/purchase-orders/release",
      "POST",
      session,
      { requisitionId },
    );

    // External integrations (Payable & Goods Receipt)
    const payable = await financeService.createPayable(tenantId, session, {
      vendor: finalPo.supplierId,
      amount: finalPo.totalAmount,
      dueDate: addDays(30),
      currency: "IDR",
    });

    await procurementIntegrationAdapters.queueGoodsReceiptSync(
      tenantId,
      session,
      {
        finalPoId: finalPo.id,
        requisitionId: requisitionId,
        supplierId: finalPo.supplierId,
        supplierBranchId: finalPo.supplierBranchId,
        branchCode: finalPo.branchCode,
        expectedDeliveryDate: finalPo.expectedDeliveryDate,
      },
    );

    logEvent(
      tenantId,
      session,
      "po.released",
      "FINAL_PO",
      finalPo.id,
      requisitionId,
    );
    return finalPo;
  },

  async recordReceipt(
    tenantId: string,
    session: SessionContext,
    payload: {
      finalPoId: string;
      deliveryOnTime: boolean;
      quantityAccuracy: number;
      qualityScore: number;
      issueCount: number;
      invoiceMismatch: boolean;
    },
  ) {
    ensureTenant(tenantId, session);
    const result = await apiRequest<{
      receipt: ReceiptRecord;
      rating: RatingLog;
    }>("/v1/procurement/receipts", "POST", session, payload);
    return result;
  },

  async runRiskScan(
    tenantId: string,
    session: SessionContext,
  ): Promise<RiskSignal[]> {
    ensureTenant(tenantId, session);
    return apiRequest<RiskSignal[]>("/v1/procurement/risk-scan", "POST", session);
  },

  async getSupplierRecommendations(
    tenantId: string,
    session: SessionContext,
    params: { branchCode: string; category: string },
  ): Promise<SupplierRecommendation[]> {
    ensureTenant(tenantId, session);
    const queryString = new URLSearchParams(params as any).toString();
    return apiRequest<SupplierRecommendation[]>(
      `/v1/procurement/recommendations?${queryString}`,
      "GET",
      session,
    );
  },

  async getSpendInsights(
    tenantId: string,
    session: SessionContext,
  ): Promise<ProcurementSpendInsight[]> {
    ensureTenant(tenantId, session);
    return apiRequest<ProcurementSpendInsight[]>(
      "/v1/procurement/spend-insights",
      "GET",
      session,
    );
  },

  async setRiskSignalStatus(
    tenantId: string,
    session: SessionContext,
    riskSignalId: string,
    status: RiskSignalStatus,
  ) {
    ensureTenant(tenantId, session);
    const updated = await apiRequest<RiskSignal>(
      `/v1/procurement/risk-signals/${riskSignalId}/status`,
      "PUT",
      session,
      { status },
    );
    return updated;
  },

  async createPortalMessage(
    tenantId: string,
    session: SessionContext,
    payload: {
      supplierId: string;
      supplierBranchId: string;
      direction: SupplierPortalMessage["direction"];
      type: SupplierPortalMessage["type"];
      content: string;
      attachmentName?: string;
    },
  ): Promise<SupplierPortalMessage> {
    ensureTenant(tenantId, session);
    const created = await apiRequest<SupplierPortalMessage>(
      "/v1/procurement/portal-messages",
      "POST",
      session,
      payload,
    );
    logEvent(
      tenantId,
      session,
      "portal_message.created",
      "PORTAL",
      created.id,
      payload.type,
    );
    return created;
  },

  async acknowledgeLegalHandoff(
    tenantId: string,
    actor: SessionContext,
    handoffId: string,
  ) {
    return { id: handoffId, status: "ACKNOWLEDGED" };
  },
};

