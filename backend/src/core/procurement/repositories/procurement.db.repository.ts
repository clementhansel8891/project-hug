import { TenantScope } from "../../../shared/scope/tenant-scope";
import { MultiTenancyUtil } from "../../../shared/utils/multi-tenancy.util";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../../persistence/prisma.service";
import { v4 as uuidv4 } from "uuid";
import { CreateRequisitionDto } from "../dto/create-requisition.dto";
import { CreateSupplierDto } from "../dto/create-supplier.dto";
import { CreateSupplierBranchDto } from "../dto/create-supplier-branch.dto";
import { CreateDraftPoDto } from "../dto/create-draft-po.dto";
import { ConfirmQuoteDto } from "../dto/confirm-quote.dto";
import { CreateContractDto } from "../dto/create-contract.dto";
import { SignContractDto } from "../dto/sign-contract.dto";
import { ApproveFinalDto } from "../dto/approve-final.dto";
import { CreatePortalMessageDto } from "../dto/create-portal-message.dto";
import { CreateReceiptDto } from "../dto/create-receipt.dto";
import { UpsertSupplierProductDto } from "../dto/upsert-supplier-product.dto";
import { CreateRiskSignalDto } from "../dto/create-risk-signal.dto";
import { CreateProcurementCategoryDto } from "../dto/create-procurement-category.dto";
import { UpdateProcurementCategoryDto } from "../dto/update-procurement-category.dto";
import { ReleasePoDto } from "../dto/release-po.dto";
import { ProcurementRisk } from "../entities/procurement-risk.entity";
import { PurchaseOrder } from "../entities/purchase-order.entity";
import { Requisition } from "../entities/requisition.entity";
import { Supplier } from "../entities/supplier.entity";
import {
  Prisma,
  supplier_masters as SupplierMaster,
  procurement_requisitions as ProcurementRequisition,
  procurement_final_pos as ProcurementFinalPo,
  procurement_risk_signals as ProcurementRiskSignal,
  supplier_branches as SupplierBranch,
  supplier_products as SupplierProduct,
  procurement_draft_pos as ProcurementDraftPo,
  procurement_contracts as ProcurementContract,
  procurement_audit_events as ProcurementAuditEvent,
} from "@prisma/client";
import { IProcurementRepository } from "./procurement.repository.interface";
import { defineFieldMap } from "../../common";

/**
 * Explicit, schema-aligned writable columns and DTO-to-column mappers for the
 * Procurement tables (`prisma/schema.prisma`). Each create/update path binds DTO
 * field values to their single corresponding snake_case column through these
 * deterministic mappers (Task 1.4 field-mapping discipline). A supplied field
 * that resolves to no known column rejects the whole request with
 * `UnresolvedFieldError` (HTTP 400) before any write, so nothing is persisted
 * (Requirements 5.1–5.4, 9.9). Server-managed columns (`id`, `created_at`,
 * `updated_at`), the always-context-derived scope (`tenant_id`, `company_id`),
 * and derived/defaulted values (status, ratings, version flags) are bound
 * explicitly by the repository rather than from the DTO.
 *
 * Transient DTO fields that intentionally carry no column on the target table
 * are declared in `ignore` so they are dropped rather than rejected (mirroring
 * the IT phase's treatment of `metadata`).
 */

/** `supplier_masters` writable columns. */
const SUPPLIER_COLUMNS = [
  "name",
  "tax_id",
  "compliance_status",
  "global_rating",
  "risk_tier",
  "categories",
  "address",
  "contact_email",
  "contact_person",
  "contact_phone",
  "website",
  "company_id",
  "retail_id",
] as const;
const mapSupplierToColumns = defineFieldMap({
  columns: SUPPLIER_COLUMNS,
  // Transient/handled-explicitly DTO fields with no supplier_masters column:
  // `category` is folded into the `categories` array; `branchCode` is a
  // response-only convenience; `active`/`fullAddress` belong to branches.
  ignore: ["category", "branchCode", "active", "fullAddress"],
});

/** `supplier_branches` writable columns. */
const SUPPLIER_BRANCH_COLUMNS = [
  "supplier_id",
  "branch_code",
  "branch_name",
  "lead_time_days",
  "local_rating",
  "risk_tier",
  "active",
  "contact_email",
  "contact_person",
  "contact_phone",
  "full_address",
  "locations",
  "company_id",
  "retail_id",
] as const;
const mapSupplierBranchToColumns = defineFieldMap({
  columns: SUPPLIER_BRANCH_COLUMNS,
  // The DTO carries the branch location as `location`; the schema column is the
  // (required) `locations`.
  aliases: { location: "locations" },
});

/** `supplier_products` writable columns. */
const SUPPLIER_PRODUCT_COLUMNS = [
  "supplier_id",
  "branch_id",
  "sku",
  "name",
  "category",
  "unit_price",
  "currency",
  "quality_score",
  "active",
  "company_id",
] as const;
const mapSupplierProductToColumns = defineFieldMap({
  columns: SUPPLIER_PRODUCT_COLUMNS,
  // `id` selects the row to update; it is never written as a column.
  ignore: ["id"],
});

/** `procurement_categories` writable columns. */
const CATEGORY_COLUMNS = [
  "name",
  "description",
  "active",
  "company_id",
] as const;
const mapCategoryToColumns = defineFieldMap({
  columns: CATEGORY_COLUMNS,
  ignore: ["id"],
});

/** `procurement_requisitions` writable columns. */
const REQUISITION_COLUMNS = [
  "requester_id",
  "department_id",
  "branch_code",
  "title",
  "description",
  "category",
  "budget_class",
  "amount",
  "currency",
  "status",
  "approvals",
  "supplier_id",
  "supplier_branch_id",
  "contract_required",
  "company_id",
] as const;
const mapRequisitionToColumns = defineFieldMap({
  columns: REQUISITION_COLUMNS,
  // `requesterDept` is the requesting department; `createdBy` is the requester.
  aliases: { requesterDept: "department_id", createdBy: "requester_id" },
});

/** `procurement_draft_pos` writable columns. */
const DRAFT_PO_COLUMNS = [
  "requisition_id",
  "branch_code",
  "supplier_id",
  "supplier_branch_id",
  "contract_type",
  "status",
  "line_items",
  "quoted_total",
  "quote_reference",
  "quote_notes",
  "quote_attachment",
  "created_by",
  "company_id",
] as const;
const mapDraftPoToColumns = defineFieldMap({
  columns: DRAFT_PO_COLUMNS,
});

/** `procurement_contracts` writable columns. */
const CONTRACT_COLUMNS = [
  "requisition_id",
  "supplier_id",
  "status",
  "legal_reviewed_by",
  "version",
  "signed_by_supplier",
  "signed_by_proc_hod",
  "signed_by_finance_hod",
  "notes",
  "attachment_ids",
  "company_id",
] as const;
const mapContractToColumns = defineFieldMap({
  columns: CONTRACT_COLUMNS,
});

/** `procurement_risk_signals` writable columns. */
const RISK_SIGNAL_COLUMNS = [
  "code",
  "severity",
  "status",
  "entity_id",
  "detail",
  "company_id",
] as const;
const mapRiskSignalToColumns = defineFieldMap({
  columns: RISK_SIGNAL_COLUMNS,
});

/** `supplier_portal_messages` writable columns. */
const PORTAL_MESSAGE_COLUMNS = [
  "supplier_id",
  "supplier_branch_id",
  "direction",
  "type",
  "related_entity_id",
  "content",
  "attachment_name",
  "created_by",
  "company_id",
] as const;
const mapPortalMessageToColumns = defineFieldMap({
  columns: PORTAL_MESSAGE_COLUMNS,
});

/**
 * Procurement_Workflow transition guards (Requirements 9.2, 9.3, 4.6, 4.7).
 *
 * Each guard names the set of source statuses from which a given transition is
 * legal, using the actual status values persisted by this repository. A
 * transition is validated against the entity's CURRENT status — read inside the
 * Atomic_Operation BEFORE any write — and an illegal transition is rejected with
 * a `BadRequestException` that names the current and target state, leaving the
 * entity unchanged (Requirement 9.3). Because the throw happens inside the
 * transaction before the update, no write is persisted (Requirement 4.7).
 */
/** A requisition may receive requester-HOD approval only while pending it. */
const REQUESTER_HOD_APPROVABLE = new Set(["PENDING_REQUESTER_HOD"]);
/** A requisition may receive final approval after requester-HOD approval. */
const FINAL_APPROVABLE = new Set([
  "APPROVED_REQUESTER_HOD",
  "FINAL_APPROVAL_PENDING",
]);
/** A draft PO may receive procurement-HOD approval only while in DRAFT. */
const DRAFT_PROC_HOD_APPROVABLE = new Set(["DRAFT"]);
/** A supplier quote may be confirmed only after procurement-HOD approval. */
const DRAFT_QUOTE_CONFIRMABLE = new Set(["PROCUREMENT_HOD_APPROVED"]);

/**
 * Contract lifecycle transition guards (Requirement 9.7).
 *
 * A contract is created in `LEGAL_REVIEW`, advances to `LEGAL_APPROVED` once the
 * legal team approves it, then accumulates party signatures (`PARTIAL_SIGNED`)
 * until all three parties have signed (`SIGNED`). Each transition is validated
 * against the contract's CURRENT status — read inside the Atomic_Operation
 * BEFORE any write — and an illegal transition is rejected with a
 * `BadRequestException` naming the current and target state, leaving the
 * contract unchanged (Requirements 9.7, 9.3, 4.7).
 */
/** Legal approval is legal only while the contract is in legal review. */
const CONTRACT_LEGAL_APPROVABLE = new Set(["LEGAL_REVIEW"]);
/** A contract may be signed only after legal approval (and while not fully signed). */
const CONTRACT_SIGNABLE = new Set(["LEGAL_APPROVED", "PARTIAL_SIGNED"]);

/**
 * Build the standard invalid-transition error message naming the entity, its
 * current state, and the rejected target state (Requirement 9.3).
 */
function invalidTransition(
  entity: string,
  id: string,
  current: string,
  target: string,
): BadRequestException {
  return new BadRequestException(
    `Invalid Procurement_Workflow transition for ${entity} '${id}': ` +
      `cannot transition from '${current}' to '${target}'.`,
  );
}

@Injectable()
export class ProcurementDbRepository extends IProcurementRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // ─── AUDIT HELPERS ──────────────────────────────────────────────────────────

  async createAuditEvent(ctx: TenantScope,
    actor_id: string,
    action: string,
    entity_type: string,
    entity_id: string,
    detail = "",
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    const client = tx ?? this.prisma;
    return client.procurement_audit_events.create({
      data: {
        id: uuidv4(),
        updated_at: new Date(),
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        actor_id: actor_id,
        action,
        entity_type: entity_type,
        entity_id: entity_id,
        detail,
      },
    });
  }

  async getAuditEvents(ctx: TenantScope): Promise<any[]> {
    const events = await this.prisma.procurement_audit_events.findMany({
      where: MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
      orderBy: { created_at: "desc" },
      take: 200,
    });
    return events.map((e: any) => ({
      id: e.id,
      tenant_id: e.tenant_id,
      actor_id: e.actor_id,
      action: e.action,
      entity_type: e.entity_type.toLowerCase(),
      entity_id: e.entity_id,
      detail: e.detail,
      created_at: e.created_at,
    }));
  }

  // ─── CATEGORIES ─────────────────────────────────────────────────────────────

  async getCategories(ctx: TenantScope): Promise<any[]> {
    return this.prisma.procurement_categories.findMany({
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), active: true },
      orderBy: { name: "asc" },
    });
  }

  async upsertCategory(ctx: TenantScope,
    data: CreateProcurementCategoryDto | UpdateProcurementCategoryDto,
  ): Promise<any> {
    // Explicit DTO-to-column mapping; any field that resolves to no schema
    // column rejects the whole request before any write (Req 5.1–5.4, 9.9).
    const mapped = mapCategoryToColumns(data as unknown as Record<string, unknown>);

    if ("id" in data && data.id) {
      return this.prisma.procurement_categories.update({
        where: { id: data.id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
        data: mapped as Record<string, any>,
      });
    } else {
      return this.prisma.procurement_categories.create({
        data: {
          id: uuidv4(),
          updated_at: new Date(),
          ...(mapped as Record<string, any>),
          ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
          name: (data as any).name!,
          active: (data as any).active ?? true,
        },
      });
    }
  }

  async deleteCategory(ctx: TenantScope, id: string): Promise<any> {
    return this.prisma.procurement_categories.update({
      where: { id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      data: { active: false },
    });
  }

  // ─── SUPPLIERS ───────────────────────────────────────────────────────────────

  async getSuppliers(ctx: TenantScope): Promise<Supplier[]> {
    const suppliers = await this.prisma.supplier_masters.findMany({
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), deleted_at: null },
      orderBy: { created_at: "desc" },
    });
    return suppliers.map((s: any) => ({
      id: s.id,
      tenant_id: s.tenant_id,
      name: s.name,
      taxId: s.tax_id || "",
      category: s.categories[0] || "General",
      categories: s.categories,
      branchCode: "HQ",
      complianceStatus: s.compliance_status as any,
      globalRating: s.global_rating,
      riskTier: s.risk_tier as any,
      rating: s.global_rating,
      created_at: s.created_at,
      updated_at: s.updated_at,
    }));
  }

  async createSupplier(ctx: TenantScope, data: CreateSupplierDto): Promise<Supplier> {
    // Explicit DTO-to-column mapping; an unresolved field rejects the request
    // before any write, persisting nothing (Req 5.1–5.4, 9.9).
    const mapped = mapSupplierToColumns(data as unknown as Record<string, unknown>);
    const created = await this.prisma.supplier_masters.create({
      data: {
        id: uuidv4(),
        updated_at: new Date(),
        ...(mapped as Record<string, any>),
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        name: data.name,
        // `category` is a single DTO value folded into the `categories` array.
        categories: [data.category],
        compliance_status: "PENDING",
        global_rating: 70,
        risk_tier: "MEDIUM",
      },
    });
    return {
      id: created.id,
      tenant_id: created.tenant_id,
      name: created.name,
      taxId: created.tax_id || "",
      category: created.categories[0],
      branchCode: data.branchCode,
      complianceStatus: "PENDING" as any,
      rating: created.global_rating,
      created_at: created.created_at,
      updated_at: created.updated_at,
    };
  }

  // ─── SUPPLIER BRANCHES ────────────────────────────────────────────────────────

  async getSupplierBranches(ctx: TenantScope): Promise<any[]> {
    const branches = await this.prisma.supplier_branches.findMany({
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), deleted_at: null },
      orderBy: { created_at: "desc" },
    });
    return branches.map((b: any) => ({
      id: b.id,
      tenant_id: b.tenant_id,
      supplierId: b.supplier_id,
      branchCode: b.branch_code,
      branchName: b.branch_name,
      location: b.location,
      leadTimeDays: b.lead_time_days,
      localRating: b.local_rating,
      riskTier: b.risk_tier.toLowerCase(),
      active: b.active,
      created_at: b.created_at,
      updated_at: b.updated_at,
    }));
  }

  async createSupplierBranch(ctx: TenantScope, data: CreateSupplierBranchDto): Promise<any> {
    const supplier = await this.prisma.supplier_masters.findFirst({
      where: { id: data.supplierId, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
    });
    if (!supplier) throw new NotFoundException("Supplier not found");

    const created = await this.prisma.supplier_branches.create({
      data: {
        id: uuidv4(),
        updated_at: new Date(),
        ...(mapSupplierBranchToColumns(
          data as unknown as Record<string, unknown>,
        ) as Record<string, any>),
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        supplier_id: data.supplierId,
        local_rating: 70,
        risk_tier: "MEDIUM",
        active: data.active ?? true,
      },
    });
    return {
      id: created.id,
      tenant_id: created.tenant_id,
      supplierId: created.supplier_id,
      branchCode: created.branch_code,
      branchName: created.branch_name,
      locations: created,
      leadTimeDays: created.lead_time_days,
      localRating: created.local_rating,
      riskTier: created.risk_tier.toLowerCase(),
      active: created.active,
      created_at: created.created_at,
      updated_at: created.updated_at,
    };
  }

  // ─── SUPPLIER PRODUCTS ────────────────────────────────────────────────────────

  async getSupplierProducts(ctx: TenantScope): Promise<any[]> {
    const products = await this.prisma.supplier_products.findMany({
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), active: true },
    });
    return products.map((p: SupplierProduct) => ({
      id: p.id,
      tenant_id: p.tenant_id,
      supplierId: p.supplier_id,
      branch_id: p.branch_id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      unit_price: Number(p.unit_price),
      currency: p.currency,
      quality_score: p.quality_score,
      active: p.active,
      updated_at: p.updated_at,
    }));
  }

  async upsertSupplierProduct(ctx: TenantScope, data: UpsertSupplierProductDto): Promise<any> {
    // Explicit DTO-to-column mapping; an unresolved field rejects the request
    // before any write (Req 5.1–5.4, 9.9). `id` selects the row, never a column.
    const mapped = mapSupplierProductToColumns(
      data as unknown as Record<string, unknown>,
    ) as Record<string, any>;

    if (data.id) {
      const updated = await this.prisma.supplier_products.update({
        where: { id: data.id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
        data: {
          ...mapped,
          currency: data.currency || "IDR",
          quality_score: data.qualityScore ?? 70,
          active: data.active ?? true,
        },
      });
      return { ...updated, unit_price: Number(updated.unit_price) };
    } else {
      const created = await this.prisma.supplier_products.create({
        data: {
          id: uuidv4(),
          updated_at: new Date(),
          ...mapped,
          ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
          supplier_id: data.supplierId,
          branch_id: data.branch_id,
          currency: data.currency || "IDR",
          quality_score: data.qualityScore ?? 70,
          active: data.active ?? true,
        },
      });
      return { ...created, unit_price: Number(created.unit_price) };
    }
  }

  async getSupplierRecommendations(ctx: TenantScope,
    params: { branchCode?: string; category?: string },
  ): Promise<any[]> {
    const products = await this.prisma.supplier_products.findMany({
      where: {
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        category: params.category,
        active: true,
        supplier_branches: {
          active: true,
          ...(params.branchCode ? { branch_code: params.branchCode } : {}),
        },
      },
      include: { supplier_masters: true, supplier_branches: true },
      take: 10,
    });
    return products.map((p) => ({
      supplierId: p.supplier_id,
      branch_id: p.branch_id,
      supplierName: p.supplier_masters?.name || "Unknown Supplier",
      branchName: p.supplier_branches?.branch_name || "Unknown Branch",
      branchCode: p.supplier_branches?.branch_code || "N/A",
      category: p.category,
      score: p.quality_score,
      riskTier: p.supplier_branches?.risk_tier || "LOW",
      unit_price: Number(p.unit_price),
      leadTimeDays: p.supplier_branches?.lead_time_days || 0,
    }));
  }

  // ─── REQUISITIONS ─────────────────────────────────────────────────────────────

  async getRequisitions(ctx: TenantScope): Promise<Requisition[]> {
    const requisitions = await this.prisma.procurement_requisitions.findMany({
      where: MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
      orderBy: { created_at: "desc" },
    });
    return (requisitions as any[]).map((r) => ({
      id: r.id,
      tenant_id: r.tenant_id,
      title: r.title,
      description: r.description,
      category: r.category,
      budgetClass: r.budget_class as any,
      requesterDept: r.department_id,
      branchCode: r.branch_code,
      amount: Number(r.amount),
      currency: r.currency as any,
      status: r.status as any,
      approvals: {} as any,
      contractRequired: false,
      createdBy: r.requester_id,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  }

  async createRequisition(ctx: TenantScope, data: CreateRequisitionDto): Promise<Requisition> {
    // Explicit DTO-to-column mapping; an unresolved field rejects the request
    // before any write (Req 5.1–5.4, 9.9). `requesterDept`→`department_id` and
    // `createdBy`→`requester_id` are declared as aliases on the mapper.
    const mapped = mapRequisitionToColumns(
      data as unknown as Record<string, unknown>,
    ) as Record<string, any>;

    // Resolve requester: user_id → employee_id (FK target is employees table)
    let requesterId = data.createdBy || "system";
    const employee = await this.prisma.employees.findFirst({
      where: { user_id: requesterId, tenant_id: ctx.tenant_id },
      select: { id: true },
    });
    if (employee) {
      requesterId = employee.id;
    }

    const created = await this.prisma.procurement_requisitions.create({
      data: {
        id: uuidv4(),
        updated_at: new Date(),
        ...mapped,
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        requester_id: requesterId,
        category: data.category || "General",
        currency: data.currency || "IDR",
        budget_class: "OPEX",
        status: "PENDING_REQUESTER_HOD",
      },
    });
    return {
      id: created.id,
      tenant_id: created.tenant_id,
      title: created.title,
      description: created.description,
      category: created.category,
      budgetClass: created.budget_class as any,
      requesterDept: created.department_id,
      branchCode: created.branch_code,
      amount: Number(created.amount),
      currency: created.currency as any,
      status: created.status as any,
      approvals: {} as any,
      contractRequired: false,
      createdBy: created.requester_id,
      created_at: created.created_at,
      updated_at: created.updated_at,
    };
  }

  async approveRequesterHod(ctx: TenantScope, requisitionId: string, tx?: Prisma.TransactionClient): Promise<Requisition> {
    const client = tx ?? this.prisma;
    // Read the CURRENT state inside the Atomic_Operation and validate the
    // transition before any write (Requirements 9.2, 9.3, 4.6, 4.7).
    const current = await client.procurement_requisitions.findFirst({
      where: { id: requisitionId, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
    });
    if (!current) throw new NotFoundException("Requisition not found");
    if (!REQUESTER_HOD_APPROVABLE.has(current.status)) {
      throw invalidTransition("requisition", requisitionId, current.status, "APPROVED_REQUESTER_HOD");
    }

    const updated = await client.procurement_requisitions.update({
      where: { id: requisitionId, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      data: { status: "APPROVED_REQUESTER_HOD" },
    });
    return {
      id: updated.id,
      tenant_id: updated.tenant_id,
      title: updated.title,
      description: updated.description,
      category: updated.category,
      budgetClass: updated.budget_class as any,
      requesterDept: updated.department_id,
      branchCode: updated.branch_code,
      amount: Number(updated.amount),
      currency: updated.currency as any,
      status: updated.status as any,
      approvals: {} as any,
      contractRequired: false,
      createdBy: updated.requester_id,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    };
  }

  async approveFinal(ctx: TenantScope, requisitionId: string, data: ApproveFinalDto, tx?: Prisma.TransactionClient): Promise<Requisition> {
    const client = tx ?? this.prisma;
    const req = await client.procurement_requisitions.findFirst({
      where: { id: requisitionId, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
    });
    if (!req) throw new NotFoundException("Requisition not found");

    // Progress status toward FINAL_APPROVED
    // For simplicity: each approver advances status; once all approved → FINAL_APPROVED
    const newStatus =
      data.approver === "FINANCE_HOD" ? "FINAL_APPROVED" : "FINAL_APPROVAL_PENDING";

    // Validate the transition against the requisition's CURRENT state before any
    // write (Requirements 9.2, 9.3): final approval is only legal once the
    // requester-HOD approval has been granted (or a final approval is already in
    // progress). An illegal source state is rejected, leaving status unchanged.
    if (!FINAL_APPROVABLE.has(req.status)) {
      throw invalidTransition("requisition", requisitionId, req.status, newStatus);
    }

    const updated = await client.procurement_requisitions.update({
      where: { id: requisitionId, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      data: { status: newStatus },
    });
    return {
      id: updated.id,
      tenant_id: updated.tenant_id,
      title: updated.title,
      description: updated.description,
      category: updated.category,
      budgetClass: updated.budget_class as any,
      requesterDept: updated.department_id,
      branchCode: updated.branch_code,
      amount: Number(updated.amount),
      currency: updated.currency as any,
      status: updated.status as any,
      approvals: {} as any,
      contractRequired: false,
      createdBy: updated.requester_id,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    };
  }

  // ─── DRAFT PURCHASE ORDERS ────────────────────────────────────────────────────

  async getDraftPurchaseOrders(ctx: TenantScope): Promise<any[]> {
    const drafts = await this.prisma.procurement_draft_pos.findMany({
      where: MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
      orderBy: { created_at: "desc" },
    });
    return (drafts as any[]).map((d) => ({
      id: d.id,
      tenant_id: d.tenant_id,
      requisitionId: d.requisition_id,
      branchCode: d.branch_code,
      supplierId: d.supplier_id,
      supplierBranchId: d.supplier_branch_id,
      contractType: d.contract_type?.toLowerCase(),
      status: d.status,
      quotedTotal: Number(d.quoted_total),
      created_at: d.created_at,
      updated_at: d.updated_at,
    }));
  }

  async createDraftPurchaseOrder(ctx: TenantScope, data: CreateDraftPoDto, createdBy: string): Promise<any> {
    const requisition = await this.prisma.procurement_requisitions.findFirst({
      where: { id: data.requisitionId, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
    });
    if (!requisition) throw new NotFoundException("Requisition not found");

    const total_amount = data.quotedTotal
      ?? data.lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

    const draft = await this.prisma.procurement_draft_pos.create({
      data: {
        id: uuidv4(),
        updated_at: new Date(),
        ...(mapDraftPoToColumns({
          ...(data as unknown as Record<string, unknown>),
          lineItems: data.lineItems,
        }) as Record<string, any>),
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        requisition_id: data.requisitionId,
        branch_code: requisition.branch_code,
        status: "DRAFT",
        quoted_total: total_amount,
        created_by: createdBy,
      },
    });

    // Update requisition status
    await this.prisma.procurement_requisitions.update({
      where: { id: data.requisitionId, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      data: { status: "DRAFT_PO_PREPARED" },
    });

    return {
      id: draft.id,
      tenant_id: draft.tenant_id,
      requisitionId: draft.requisition_id,
      branchCode: draft.branch_code,
      supplierId: draft.supplier_id,
      supplierBranchId: draft.supplier_branch_id,
      contractType: draft.contract_type?.toLowerCase(),
      status: draft.status,
      quotedTotal: Number(draft.quoted_total),
      lineItems: data.lineItems,
      created_at: draft.created_at,
      updated_at: draft.updated_at,
    };
  }

  async approveDraftByProcurementHod(ctx: TenantScope, draftPoId: string, tx?: Prisma.TransactionClient): Promise<any> {
    const client = tx ?? this.prisma;
    const draft = await client.procurement_draft_pos.findFirst({
      where: { id: draftPoId, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
    });
    if (!draft) throw new NotFoundException("Draft PO not found");

    // Validate the transition before any write (Requirements 9.2, 9.3): a draft
    // PO may be approved by the procurement HOD only while in DRAFT.
    if (!DRAFT_PROC_HOD_APPROVABLE.has(draft.status)) {
      throw invalidTransition("draft PO", draftPoId, draft.status, "PROCUREMENT_HOD_APPROVED");
    }

    const updated = await client.procurement_draft_pos.update({
      where: { id: draftPoId, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      data: { status: "PROCUREMENT_HOD_APPROVED" },
    });

    await client.procurement_requisitions.update({
      where: { id: draft.requisition_id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      data: { status: "DRAFT_PO_APPROVED" },
    });

    return { ...updated, quotedTotal: Number(updated.quoted_total), status: updated.status };
  }

  async confirmSupplierQuote(ctx: TenantScope, draftPoId: string, data: ConfirmQuoteDto, tx?: Prisma.TransactionClient): Promise<any> {
    const client = tx ?? this.prisma;
    const draft = await client.procurement_draft_pos.findFirst({
      where: { id: draftPoId, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
    });
    if (!draft) throw new NotFoundException("Draft PO not found");

    // Validate the transition before any write (Requirements 9.2, 9.3): a
    // supplier quote may be confirmed only after procurement-HOD approval.
    if (!DRAFT_QUOTE_CONFIRMABLE.has(draft.status)) {
      throw invalidTransition("draft PO", draftPoId, draft.status, "SUPPLIER_CONFIRMED");
    }

    const updated = await client.procurement_draft_pos.update({
      where: { id: draftPoId, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      data: {
        status: "SUPPLIER_CONFIRMED",
        ...(data.quotedTotal != null ? { quoted_total: data.quotedTotal } : {}),
      },
    });

    await client.procurement_requisitions.update({
      where: { id: draft.requisition_id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      data: { status: "SUPPLIER_CONFIRMED" },
    });

    return { ...updated, quotedTotal: Number(updated.quoted_total) };
  }

  // ─── PURCHASE ORDERS (FINAL) ──────────────────────────────────────────────────

  /**
   * Finance Payable_Record contract — the columns the Finance_Module's payables
   * contract requires populated for a Procurement-originated accounts-payable
   * record (the `payables` table in `prisma/schema.prisma`, consumed by
   * `FinanceDbRepository.listPayables`/`createPayable`). Each is a non-defaulted,
   * Finance-consumed column: the originating `tenant_id`, the `vendor_name`,
   * the `amount`, the `currency`, the `due_date`, and the `status`. A release
   * that cannot populate any of these is rejected before any write so no partial
   * Payable_Record or purchase order is persisted (Requirements 6.3, 6.4).
   */
  private static readonly PAYABLE_REQUIRED_FIELDS = [
    "tenant_id",
    "vendor_name",
    "amount",
    "currency",
    "due_date",
    "status",
  ] as const;

  /**
   * Assert every Finance-contract-required Payable_Record field is populated.
   * Throws a `BadRequestException` naming the first missing field so the caller
   * rejects the originating release without a partial write (Requirement 6.4).
   */
  private assertPayableContract(payable: Record<string, unknown>): void {
    for (const field of ProcurementDbRepository.PAYABLE_REQUIRED_FIELDS) {
      const value = payable[field];
      if (value === undefined || value === null || value === "") {
        throw new BadRequestException(
          `Cannot release purchase order: Finance Payable_Record is missing required field '${field}'`,
        );
      }
    }
  }

  async releasePurchaseOrder(
    ctx: TenantScope,
    data: ReleasePoDto,
    tx?: Prisma.TransactionClient,
  ): Promise<PurchaseOrder> {
    // Use the Atomic_Operation transaction client when supplied so the PO
    // release and the Finance Payable_Record commit together or neither
    // persists; a Payable_Record failure rolls back the release (Req 9.4, 9.10).
    const client = tx ?? this.prisma;
    const scope = MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true });

    const requisition = await client.procurement_requisitions.findFirst({
      where: { id: data.requisitionId, ...scope },
    });
    if (!requisition) throw new NotFoundException("Requisition not found");

    // Resolve the supplier for the Payable_Record vendor BEFORE any write so a
    // missing vendor rejects the release rather than silently persisting a
    // placeholder vendor name (Requirements 6.3, 6.4).
    const supplier = await client.supplier_masters.findFirst({
      where: { id: data.supplierId, ...scope },
    });

    // Assemble the Finance Payable_Record with the originating tenant_id and
    // every contract-required field, then validate the contract up front so a
    // missing field rejects the whole release with no partial write (Req 6.4).
    const payableData = {
      id: uuidv4(),
      updated_at: new Date(),
      ...scope,
      vendor_name: supplier?.name,
      amount: data.total_amount,
      currency: requisition.currency || undefined,
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: "RECEIVED",
    };
    this.assertPayableContract(payableData);

    const po = await client.procurement_final_pos.create({
      data: {
        id: uuidv4(),
        updated_at: new Date(),
        ...scope,
        requisition_id: requisition.id,
        draft_po_id: "auto",
        supplier_id: data.supplierId,
        supplier_branch_id: (data as any).supplierBranchId || "auto",
        branch_code: requisition.branch_code,
        total_amount: data.total_amount,
        status: "RELEASED",
      },
    });

    await client.procurement_requisitions.update({
      where: { id: requisition.id, ...scope },
      data: { status: "PO_RELEASED" },
    });

    // Cross-Module: create the Finance Payable_Record in the same transaction.
    await client.payables.create({ data: payableData });

    return {
      id: po.id,
      tenant_id: po.tenant_id,
      requisitionId: po.requisition_id,
      supplierId: po.supplier_id,
      branchCode: po.branch_code,
      total_amount: Number(po.total_amount),
      status: "released" as any,
      issuedAt: po.issued_at,
      created_at: po.created_at,
      updated_at: po.updated_at,
    };
  }

  async getPurchaseOrders(ctx: TenantScope): Promise<PurchaseOrder[]> {
    const pos = await this.prisma.procurement_final_pos.findMany({
      where: MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
      orderBy: { created_at: "desc" },
    });
    return (pos as any[]).map((po) => ({
      id: po.id,
      tenant_id: po.tenant_id,
      requisitionId: po.requisition_id,
      supplierId: po.supplier_id,
      branchCode: po.branch_code,
      total_amount: Number(po.total_amount),
      status: po.status.toLowerCase() as any,
      issuedAt: po.issued_at,
      created_at: po.created_at,
      updated_at: po.updated_at,
    }));
  }

  // ─── RECEIPTS ─────────────────────────────────────────────────────────────────

  async createReceipt(
    ctx: TenantScope,
    data: CreateReceiptDto,
    createdBy: string,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    // The receipt persistence, the inventory intake, and the supplier-rating
    // recalculation all run on the SAME transaction client so they commit
    // together or none persist (Requirement 9.5). When invoked from the service
    // a `tx` is always supplied; the `?? this.prisma` fallback keeps the
    // standalone path working for direct callers/tests.
    const client = tx ?? this.prisma;
    const scope = MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true });

    const finalPo = await client.procurement_final_pos.findFirst({
      where: { id: data.finalPoId, ...scope },
    });
    if (!finalPo) throw new NotFoundException("Final PO not found");

    // ── Outstanding-quantity guard (Requirement 9.6) ──────────────────────────
    // Resolve the ordered quantities for the PO from its draft line items and
    // reject — BEFORE any write — a receipt whose received quantity exceeds the
    // outstanding ordered quantity for a line (or references a line that was
    // never ordered). The throw happens before persistence so nothing is
    // written (Requirement 9.6).
    const receivedItems = data.items ?? [];
    if (receivedItems.length > 0) {
      const orderedBySku = await this.resolveOrderedQuantities(client, ctx, finalPo);
      for (const item of receivedItems) {
        const outstanding = orderedBySku.get(item.sku) ?? 0;
        if (item.quantity > outstanding) {
          throw new BadRequestException(
            `Goods receipt rejected: received quantity ${item.quantity} for SKU ` +
              `'${item.sku}' exceeds the outstanding ordered quantity ${outstanding} ` +
              `on purchase order '${finalPo.id}'.`,
          );
        }
      }
    }

    // 1. Persist the goods receipt itself.
    const receipt = await client.procurement_receipts.create({
      data: {
        id: uuidv4(),
        updated_at: new Date(),
        ...scope,
        final_po_id: finalPo.id,
        supplier_id: finalPo.supplier_id,
        supplier_branch_id: finalPo.supplier_branch_id,
        delivery_on_time: data.deliveryOnTime,
        quantity_accuracy: Math.round(data.quantityAccuracy),
        quality_score: Math.round(data.qualityScore),
        issue_count: data.issueCount,
        invoice_mismatch: data.invoiceMismatch,
      },
    });

    // 2. Update the associated inventory for every received line that resolves a
    //    product and a location — an INTAKE stock movement plus an on-hand
    //    increment, mirroring the inventory intake path (Requirement 9.5).
    for (const item of receivedItems) {
      const location_id = item.location_id ?? data.location_id;
      if (!item.productId || !location_id || item.quantity <= 0) continue;
      await this.intakeReceivedStock(client, ctx, {
        product_id: item.productId,
        location_id,
        quantity: item.quantity,
        reference_id: finalPo.id,
        performed_by: createdBy,
      });
    }

    // 3. Update the final PO status to RECEIVED.
    await client.procurement_final_pos.update({
      where: { id: finalPo.id, ...scope },
      data: { status: "RECEIVED" },
    });

    // 4. Recalculate the supplier rating from the receipt quality signals.
    const qualityScore =
      (data.deliveryOnTime ? 25 : 0) +
      data.quantityAccuracy * 0.5 +
      data.qualityScore * 0.25 -
      data.issueCount * 5 -
      (data.invoiceMismatch ? 10 : 0);
    const newRating = Math.max(0, Math.min(100, Math.round(qualityScore)));

    await client.supplier_masters.update({
      where: { id: finalPo.supplier_id, ...scope },
      data: { global_rating: newRating },
    });

    return {
      id: receipt.id,
      finalPoId: finalPo.id,
      tenant_id: ctx.tenant_id,
      supplierId: finalPo.supplier_id,
      deliveryOnTime: data.deliveryOnTime,
      quantityAccuracy: data.quantityAccuracy,
      quality_score: data.qualityScore,
      issueCount: data.issueCount,
      invoiceMismatch: data.invoiceMismatch,
      calculatedRating: newRating,
      created_at: receipt.created_at,
    };
  }

  /**
   * Resolve the ordered quantity per SKU for a final PO from its draft purchase
   * order's line items. Resolves the draft by `draft_po_id` and, failing that
   * (e.g. when the PO was released with a placeholder draft reference), by the
   * PO's `requisition_id`. Returns an empty map when no ordered lines can be
   * resolved, in which case no over-quantity guard is applied.
   */
  private async resolveOrderedQuantities(
    client: Prisma.TransactionClient | PrismaService,
    ctx: TenantScope,
    finalPo: ProcurementFinalPo,
  ): Promise<Map<string, number>> {
    const scope = MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true });
    let draft = await (client as any).procurement_draft_pos.findFirst({
      where: { id: finalPo.draft_po_id, ...scope },
    });
    if (!draft) {
      draft = await (client as any).procurement_draft_pos.findFirst({
        where: { requisition_id: finalPo.requisition_id, ...scope },
        orderBy: { created_at: "desc" },
      });
    }

    const ordered = new Map<string, number>();
    const lineItems = (draft?.line_items as any[] | undefined) ?? [];
    for (const line of lineItems) {
      const sku: string | undefined = line?.productSku ?? line?.sku;
      const quantity = Number(line?.quantity ?? 0);
      if (!sku || !Number.isFinite(quantity)) continue;
      ordered.set(sku, (ordered.get(sku) ?? 0) + quantity);
    }
    return ordered;
  }

  /**
   * Take a received line into inventory on the supplied transaction client:
   * increment the matching `stock_levels` row (creating it when absent) and
   * record an INTAKE `stock_movements` entry. Mirrors the inventory module's
   * intake path so the receipt and the stock update share one Atomic_Operation
   * (Requirement 9.5).
   */
  private async intakeReceivedStock(
    client: Prisma.TransactionClient | PrismaService,
    ctx: TenantScope,
    data: {
      product_id: string;
      location_id: string;
      quantity: number;
      reference_id: string;
      performed_by: string;
    },
  ): Promise<void> {
    const c = client as any;
    const scope = MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true });

    const existing = await c.stock_levels.findFirst({
      where: {
        tenant_id: ctx.tenant_id,
        location_id: data.location_id,
        product_id: data.product_id,
        department_id: null,
      },
    });

    if (existing) {
      await c.stock_levels.update({
        where: { id: existing.id },
        data: {
          on_hand: { increment: data.quantity },
          available: { increment: data.quantity },
          updated_at: new Date(),
        },
      });
    } else {
      await c.stock_levels.create({
        data: {
          id: uuidv4(),
          updated_at: new Date(),
          ...scope,
          location_id: data.location_id,
          department_id: null,
          product_id: data.product_id,
          on_hand: data.quantity,
          available: data.quantity,
        },
      });
    }

    await c.stock_movements.create({
      data: {
        id: uuidv4(),
        updated_at: new Date(),
        ...scope,
        product_id: data.product_id,
        location_id: data.location_id,
        to_location_id: data.location_id,
        to_department_id: null,
        quantity: data.quantity,
        type: "INTAKE",
        reference_id: data.reference_id,
        reference_type: "PROCUREMENT_RECEIPT",
        performed_by: data.performed_by,
      },
    });
  }

  // ─── CONTRACTS ────────────────────────────────────────────────────────────────

  async getContracts(ctx: TenantScope): Promise<any[]> {
    const contracts = await this.prisma.procurement_contracts.findMany({
      where: MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
      orderBy: { created_at: "desc" },
    });
    return (contracts as any[]).map((c) => ({
      id: c.id,
      tenant_id: c.tenant_id,
      requisitionId: c.requisition_id,
      supplierId: c.supplier_id,
      status: c.status,
      version: c.version,
      signedBySupplier: c.signed_by_supplier,
      signedByProcHod: c.signed_by_proc_hod,
      signedByFinanceHod: c.signed_by_finance_hod,
      notes: c.notes,
      created_at: c.created_at,
      updated_at: c.updated_at,
    }));
  }

  async createContract(ctx: TenantScope, data: CreateContractDto, createdBy: string): Promise<any> {
    // Explicit DTO-to-column mapping; an unresolved field rejects the request
    // before any write (Req 5.1–5.4, 9.9).
    const mapped = mapContractToColumns(
      data as unknown as Record<string, unknown>,
    ) as Record<string, any>;

    const existing = await this.prisma.procurement_contracts.findFirst({
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), requisition_id: data.requisitionId },
    });

    if (existing) {
      // Increment version and reset signatures for a fresh legal review.
      const updated = await this.prisma.procurement_contracts.update({
        where: { id: existing.id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
        data: {
          ...mapped,
          status: "LEGAL_REVIEW",
          version: existing.version + 1,
          notes: data.notes || existing.notes,
          signed_by_supplier: false,
          signed_by_proc_hod: false,
          signed_by_finance_hod: false,
        },
      });
      return { ...updated };
    }

    const created = await this.prisma.procurement_contracts.create({
      data: {
        id: uuidv4(),
        updated_at: new Date(),
        ...mapped,
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        status: "LEGAL_REVIEW",
        version: 1,
        signed_by_supplier: false,
        signed_by_proc_hod: false,
        signed_by_finance_hod: false,
        attachment_ids: data.attachmentIds || [],
      },
    });

    await this.prisma.procurement_requisitions.update({
      where: { id: data.requisitionId, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      data: { status: "LEGAL_APPROVED" },
    }).catch(() => {}); // Non-fatal; requisition may not exist in edge cases

    return { ...created };
  }

  async approveLegalContract(ctx: TenantScope, contractId: string, tx?: Prisma.TransactionClient): Promise<any> {
    const client = tx ?? this.prisma;
    const scope = MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true });

    // Read the CURRENT state inside the Atomic_Operation and validate the
    // transition BEFORE any write (Requirement 9.7): legal approval is legal
    // only while the contract is in legal review. An illegal source state is
    // rejected naming current+target, leaving the contract unchanged.
    const contract = await client.procurement_contracts.findFirst({
      where: { id: contractId, ...scope },
    });
    if (!contract) throw new NotFoundException("Contract not found");
    if (!CONTRACT_LEGAL_APPROVABLE.has(contract.status)) {
      throw invalidTransition("contract", contractId, contract.status, "LEGAL_APPROVED");
    }

    const updated = await client.procurement_contracts.update({
      where: { id: contractId, ...scope },
      data: { status: "LEGAL_APPROVED" },
    });
    return { ...updated };
  }

  async signContract(ctx: TenantScope, contractId: string, data: SignContractDto, tx?: Prisma.TransactionClient): Promise<any> {
    const client = tx ?? this.prisma;
    const scope = MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true });

    // Read the CURRENT state inside the Atomic_Operation and validate the
    // transition BEFORE any write (Requirement 9.7): a contract may be signed
    // only after legal approval and while it is not already fully signed.
    const contract = await client.procurement_contracts.findFirst({
      where: { id: contractId, ...scope },
    });
    if (!contract) throw new NotFoundException("Contract not found");
    if (!CONTRACT_SIGNABLE.has(contract.status)) {
      throw invalidTransition("contract", contractId, contract.status, "SIGNED");
    }

    // Compute the post-signature flags from the CURRENT row plus this party, then
    // persist the signature and the resulting status in a single write so the
    // sign transition is one atomic update.
    const signedBySupplier = contract.signed_by_supplier || data.party === "SUPPLIER";
    const signedByProcHod = contract.signed_by_proc_hod || data.party === "PROCUREMENT_HOD";
    const signedByFinanceHod = contract.signed_by_finance_hod || data.party === "FINANCE_HOD";

    const allSigned = signedBySupplier && signedByProcHod && signedByFinanceHod;
    const finalStatus = allSigned ? "SIGNED" : "PARTIAL_SIGNED";

    const updated = await client.procurement_contracts.update({
      where: { id: contractId, ...scope },
      data: {
        signed_by_supplier: signedBySupplier,
        signed_by_proc_hod: signedByProcHod,
        signed_by_finance_hod: signedByFinanceHod,
        status: finalStatus,
      },
    });

    return { ...updated };
  }

  // ─── RISK MANAGEMENT ──────────────────────────────────────────────────────────

  async getRiskSignals(ctx: TenantScope): Promise<ProcurementRisk[]> {
    const signals = await this.prisma.procurement_risk_signals.findMany({
      where: MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
      orderBy: { created_at: "desc" },
    });
    return (signals as any[]).map((s) => ({
      id: s.id,
      tenant_id: s.tenant_id,
      code: s.code as any,
      severity: s.severity as any,
      status: s.status as any,
      entity_id: s.entity_id,
      detail: s.detail,
      created_at: s.created_at,
      updated_at: s.updated_at,
    }));
  }

  async runRiskScan(ctx: TenantScope): Promise<ProcurementRisk[]> {
    // Fake logic for sweep
    return this.getRiskSignals(ctx);
  }

  async createRiskSignal(ctx: TenantScope, data: CreateRiskSignalDto): Promise<any> {
    // Explicit DTO-to-column mapping; an unresolved field rejects the request
    // before any write (Req 5.1–5.4, 9.9).
    return this.prisma.procurement_risk_signals.create({
      data: {
        id: uuidv4(),
        updated_at: new Date(),
        ...(mapRiskSignalToColumns(
          data as unknown as Record<string, unknown>,
        ) as Record<string, any>),
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        detail: data.detail || "",
        status: "OPEN",
      },
    });
  }

  async updateRiskSignalStatus(ctx: TenantScope, riskSignalId: string, status: string): Promise<any> {
    return this.prisma.procurement_risk_signals.update({
      where: { id: riskSignalId, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      data: { status },
    });
  }

  // ─── PORTAL MESSAGES ──────────────────────────────────────────────────────────

  async getPortalMessages(ctx: TenantScope): Promise<any[]> {
    const messages = await this.prisma.supplier_portal_messages.findMany({
      where: MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
      orderBy: { created_at: "desc" },
    });
    return messages;
  }

  async createPortalMessage(ctx: TenantScope, data: CreatePortalMessageDto, createdBy: string): Promise<any> {
    // Explicit DTO-to-column mapping; an unresolved field rejects the request
    // before any write (Req 5.1–5.4, 9.9).
    return this.prisma.supplier_portal_messages.create({
      data: {
        id: uuidv4(),
        updated_at: new Date(),
        ...(mapPortalMessageToColumns(
          data as unknown as Record<string, unknown>,
        ) as Record<string, any>),
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        created_by: createdBy,
      },
    });
  }

  // ─── SPEND INSIGHTS ──────────────────────────────────────────────────────────

  async getSpendInsights(ctx: TenantScope): Promise<any[]> {
    // Aggregate by category
    const items = await this.prisma.procurement_requisitions.groupBy({
      by: ["category"],
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), status: "PO_RELEASED" },
      _sum: { amount: true },
      _count: { id: true },
    });
    return items.map((i) => ({
      category: i.category,
      totalSpend: Number(i._sum.amount),
      requisitionCount: i._count.id,
    }));
  }
}
