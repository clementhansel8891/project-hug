import { Injectable, NotFoundException } from "@nestjs/common";
import {
  it_provisioning_requests as ItProvisioningRequest,
  it_system_health as ItSystemHealth,
  it_devices as PrismaDevice,
  it_device_events as PrismaDeviceEvent,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../persistence/prisma.service";
import { CreateProvisioningRequestDto } from "../dto/create-provisioning-request.dto";
import { ProvisioningRequest } from "../entities/provisioning-request.entity";
import { SystemHealth } from "../entities/system-health.entity";
import { Device, DeviceEvent } from "../entities/device.entity";
import { CreateDeviceDto, CreateDeviceEventDto } from "../dto/device.dto";
import { IITRepository } from "./it.repository.interface";
import { TenantScope } from "../../../shared/scope/tenant-scope";
import { findScopedOrThrow } from "../../_shared";
import { defineFieldMap } from "../../common";
import { isModuleActive } from "../../../shared/helpers/module-active.helper";

/** Scope keys (beyond tenant_id) that a given IT table actually carries. */
type ScopeColumn = "company_id" | "location_id" | "branch_id";

/**
 * Explicit, schema-aligned writable columns for `it_devices`
 * (`prisma/schema.prisma`). Server-managed columns (`id`, `created_at`,
 * `updated_at`, `last_heartbeat`) and the always-context-derived `tenant_id`
 * are bound explicitly by the repository rather than from the DTO.
 */
const IT_DEVICE_COLUMNS = [
  "name",
  "type",
  "connection",
  "status",
  "location_id",
  "owner_id",
  "company_id",
  "metadata",
] as const;

/**
 * Explicit, schema-aligned writable columns for `it_provisioning_requests`.
 * `tenant_id`, `status`, `requested_by`, and the resolved employee/supplier ids
 * are bound explicitly by the repository.
 */
const IT_PROVISIONING_COLUMNS = [
  "employee_id",
  "supplier_id",
  "supplier_branch_id",
  "type",
  "scope",
  "reason",
  "status",
  "requested_by",
  "provisioned_by",
  "description",
  "priority",
  "company_id",
] as const;

/**
 * DTO-to-column mappers (Task 1.4 field-mapping discipline). Each translates a
 * camelCase DTO field to its single corresponding snake_case schema column
 * deterministically (e.g. `supplierBranchId` -> `supplier_branch_id`) and
 * rejects the whole request with a 400 if any supplied field resolves to no
 * known column, persisting nothing (Requirements 5.1–5.4).
 */
const mapDeviceToColumns = defineFieldMap({ columns: IT_DEVICE_COLUMNS });
const mapProvisioningToColumns = defineFieldMap({
  columns: IT_PROVISIONING_COLUMNS,
  // `metadata` is a transient DTO field with no provisioning column; it is a
  // known non-column field and is dropped rather than rejected.
  ignore: ["metadata"],
});

@Injectable()
export class ITDbRepository extends IITRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  /**
   * Builds a tenant-scoped `where` clause for an IT table.
   *
   * `tenant_id` is always applied; any additional scope key (company/location/
   * branch) is applied only when present on the resolved scope AND supported as
   * a column on the target table, so the same resolved scope can be reused
   * across tables with differing scope columns without producing an invalid
   * query (Requirements 8.1, 2.7).
   */
  private scopedWhere(
    scope: TenantScope,
    columns: ScopeColumn[],
  ): { tenant_id: string } & Record<string, string> {
    const where: { tenant_id: string } & Record<string, string> = {
      tenant_id: scope.tenant_id,
    };
    for (const column of columns) {
      const value = scope[column];
      if (value) {
        where[column] = value;
      }
    }
    return where;
  }

  async getProvisioningRequests(
    scope: TenantScope,
  ): Promise<ProvisioningRequest[]> {
    const requests = await this.prisma.it_provisioning_requests.findMany({
      where: this.scopedWhere(scope, ["company_id"]),
    });

    return requests.map((r: ItProvisioningRequest) => ({
      id: r.id,
      tenant_id: r.tenant_id,
      employee_id: r.employee_id || undefined,
      supplierId: r.supplier_id || undefined,
      supplierBranchId: r.supplier_branch_id || undefined,
      scope: (r.scope as any) || "full_portal",
      priority: (r as any).priority || "MEDIUM",
      description: (r as any).description || undefined,
      reason: r.reason || "",
      status: r.status.toLowerCase() as any,
      requested_by: r.requested_by,
      provisionedBy: r.provisioned_by || undefined,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  }

  async createProvisioningRequest(
    tenant_id: string,
    dto: CreateProvisioningRequestDto,
    tx?: Prisma.TransactionClient,
  ): Promise<ProvisioningRequest> {
    const client = tx ?? this.prisma;
    let finalEmployeeId = dto.employee_id;
    let fallbackReason = dto.reason || "";

    if (finalEmployeeId && finalEmployeeId.startsWith("EMP-")) {
      const emp = await client.employees.findUnique({
        where: {
          tenant_id_employee_code: { tenant_id: tenant_id, employee_code: finalEmployeeId },
        },
      });
      if (emp) {
        finalEmployeeId = emp.id;
      } else {
        // Graceful fallback for brand-new accounts where the Employee record isn't in DB yet
        fallbackReason = `[RequestedFor: ${finalEmployeeId}] ` + fallbackReason;
        finalEmployeeId = undefined as any;
      }
    }

    let finalSupplierId = dto.supplierId;
    if (finalSupplierId && finalSupplierId.startsWith("SUP-")) {
      const sup = await client.supplier_masters.findFirst({
        where: { tenant_id: tenant_id, id: { startsWith: finalSupplierId } }, // Mock loose match
      });
      if (!sup)
        throw new NotFoundException(`Supplier ${finalSupplierId} not found`);
      finalSupplierId = sup.id;
    }

    const created = await client.it_provisioning_requests.create({
      data: {
        // Explicit DTO-to-column mapping; any field that resolves to no schema
        // column rejects the whole request before this write (Req 5.1–5.4).
        ...(mapProvisioningToColumns(
          dto as unknown as Record<string, unknown>,
        ) as Record<string, any>),
        updated_at: new Date(),
        tenant_id: tenant_id,
        // Resolved/derived values override the raw DTO-mapped equivalents.
        employee_id: finalEmployeeId,
        supplier_id: finalSupplierId,
        supplier_branch_id: dto.supplierBranchId,
        reason: fallbackReason,
        // A new provisioning request is always created PENDING (Req 8.4).
        status: "PENDING",
        requested_by: dto.requested_by || "system",
      },
    });

    return this.mapToProvisioning(created);
  }

  async markProvisioned(
    tenant_id: string,
    request_id: string,
    provisionedBy: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ProvisioningRequest> {
    const client = tx ?? this.prisma;
    const updated = await client.it_provisioning_requests.update({
      where: { id: request_id, tenant_id: tenant_id },
      data: {
        status: "PROVISIONED",
        provisioned_by: provisionedBy,
        updated_at: new Date(),
      },
    });

    return this.mapToProvisioning(updated);
  }

  /**
   * Composite-key read of a single provisioning request within the caller's
   * Tenant_Scope (Requirements 8.8, 1.4, 4.5). A request owned by another tenant
   * resolves to `null` via `findFirst` and surfaces as a 404, never as
   * cross-tenant leakage. The optional `tx` lets the read run inside the same
   * Atomic_Operation as a subsequent transition so the status check and the
   * write observe one consistent snapshot.
   */
  async getProvisioningRequest(
    scope: TenantScope,
    request_id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ProvisioningRequest> {
    const client = tx ?? this.prisma;
    const record = await client.it_provisioning_requests.findFirst({
      where: { id: request_id, ...this.scopedWhere(scope, ["company_id"]) },
    });
    if (!record) {
      throw new NotFoundException(
        `Provisioning request '${request_id}' was not found.`,
      );
    }
    return this.mapToProvisioning(record);
  }

  async updateProvisioningRequest(
    tenant_id: string,
    request_id: string,
    dto: Partial<CreateProvisioningRequestDto>,
    tx?: Prisma.TransactionClient,
  ): Promise<ProvisioningRequest> {
    const client = tx ?? this.prisma;
    let finalEmployeeId = dto.employee_id;
    let fallbackReason = dto.reason;

    if (finalEmployeeId && finalEmployeeId.startsWith("EMP-")) {
      const emp = await client.employees.findUnique({
        where: {
          tenant_id_employee_code: { tenant_id: tenant_id, employee_code: finalEmployeeId },
        },
      });
      if (emp) {
        finalEmployeeId = emp.id;
      } else {
        // Fallback for non-existent employees in update
        fallbackReason =
          `[RequestedFor: ${finalEmployeeId}] ` + (fallbackReason || "");
        finalEmployeeId = undefined as any;
      }
    }

    // Determine final data via explicit DTO-to-column mapping (Req 5.1–5.4),
    // never a blind spread of camelCase DTO keys into Prisma.
    const updateData = mapProvisioningToColumns(
      dto as unknown as Record<string, unknown>,
    );
    if (finalEmployeeId !== dto.employee_id) {
      updateData.employee_id = finalEmployeeId;
      updateData.reason = fallbackReason;
    }
    updateData.updated_at = new Date();

    const updated = await client.it_provisioning_requests.update({
      where: { id: request_id, tenant_id: tenant_id },
      data: updateData as any,
    });
    return this.mapToProvisioning(updated);
  }

  async deleteProvisioningRequest(
    tenant_id: string,
    request_id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.it_provisioning_requests.delete({
      where: { id: request_id, tenant_id: tenant_id },
    });
  }

  // Devices (NEW)
  async getDevices(scope: TenantScope): Promise<Device[]> {
    const devices = await this.prisma.it_devices.findMany({
      where: this.scopedWhere(scope, ["company_id", "location_id"]),
    });
    return devices.map((d: any) => this.mapToDevice(d));
  }

  async createDevice(
    tenant_id: string,
    dto: CreateDeviceDto,
    tx?: Prisma.TransactionClient,
  ): Promise<Device> {
    const client = tx ?? this.prisma;
    const data = {
      // Explicit DTO-to-column mapping (Req 5.1–5.4); rejects any unknown
      // field before persisting.
      ...(mapDeviceToColumns(
        dto as unknown as Record<string, unknown>,
      ) as Record<string, any>),
      tenant_id: tenant_id,
      status: "ONLINE",
      metadata: dto.metadata ?? {},
      updated_at: new Date(),
    };
    const created = await client.it_devices.create({ data: data as any });
    return this.mapToDevice(created);
  }

  async updateDevice(
    tenant_id: string,
    device_id: string,
    dto: Partial<CreateDeviceDto>,
    tx?: Prisma.TransactionClient,
  ): Promise<Device> {
    const client = tx ?? this.prisma;
    const updateData = mapDeviceToColumns(
      dto as unknown as Record<string, unknown>,
    );
    updateData.updated_at = new Date();
    const updated = await client.it_devices.update({
      where: { id: device_id, tenant_id: tenant_id },
      data: updateData as any,
    });
    return this.mapToDevice(updated);
  }

  async getDevice(scope: TenantScope, device_id: string): Promise<Device> {
    // Composite-key read: a device owned by another tenant resolves to `null`
    // and surfaces as a 404 rather than leaking across tenants
    // (Requirements 8.8, 1.4, 4.5).
    const device = await findScopedOrThrow(
      this.prisma.it_devices,
      device_id,
      this.scopedWhere(scope, ["company_id", "location_id"]),
      "Device",
    );
    return this.mapToDevice(device as PrismaDevice);
  }

  // Device Events (NEW)
  async getDeviceEvents(scope: TenantScope): Promise<DeviceEvent[]> {
    const events = await this.prisma.it_device_events.findMany({
      where: this.scopedWhere(scope, ["company_id"]),
      orderBy: { created_at: "desc" },
      take: 100,
    });
    return events.map((e: any) => this.mapToDeviceEvent(e));
  }

  async createDeviceEvent(
    tenant_id: string,
    dto: CreateDeviceEventDto,
    tx?: Prisma.TransactionClient,
  ): Promise<DeviceEvent> {
    const client = tx ?? this.prisma;
    const created = await client.it_device_events.create({
      data: {
        tenant_id: tenant_id,
        device_id: dto.device_id,
        event_type: dto.event_type,
        payload: dto.payload,
        processed: dto.processed || false,
        updated_at: new Date(),
      },
    });
    return this.mapToDeviceEvent(created);
  }

  // Helpers
  private mapToProvisioning(r: ItProvisioningRequest): ProvisioningRequest {
    return {
      id: r.id,
      tenant_id: r.tenant_id,
      employee_id: r.employee_id || undefined,
      supplierId: r.supplier_id || undefined,
      supplierBranchId: r.supplier_branch_id || undefined,
      scope: (r.scope as any) || "full_portal",
      priority: r.priority || "MEDIUM",
      description: r.description || undefined,
      reason: r.reason || "",
      status: r.status.toLowerCase() as any,
      requested_by: r.requested_by,
      provisionedBy: r.provisioned_by || undefined,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }

  private mapToDevice(r: PrismaDevice): Device {
    return {
      id: r.id,
      tenant_id: r.tenant_id,
      name: r.name,
      type: r.type,
      connection: r.connection,
      status: r.status,
      location_id: r.location_id || undefined,
      owner_id: r.owner_id || undefined,
      metadata: r.metadata,
      created_at: r.created_at,
    };
  }

  private mapToDeviceEvent(r: PrismaDeviceEvent): DeviceEvent {
    return {
      id: r.id,
      tenant_id: r.tenant_id,
      device_id: r.device_id,
      event_type: r.event_type,
      payload: r.payload,
      processed: r.processed,
      created_at: r.created_at,
    };
  }

  async getSystemHealth(scope: TenantScope): Promise<SystemHealth[]> {
    const health = await this.prisma.it_system_health.findMany({
      where: this.scopedWhere(scope, ["company_id"]),
    });
    return health.map(h => ({
      id: h.id,
      tenant_id: h.tenant_id,
      component: h.component as any,
      status: h.status as any,
      latencyMs: h.latency_ms,
      checkedAt: h.checked_at,
    }));
  }

  async getProvisioningStats(scope: TenantScope): Promise<any> {
    const counts = await this.prisma.it_provisioning_requests.groupBy({
      by: ['status'],
      where: this.scopedWhere(scope, ["company_id"]),
      _count: true,
    });
    return counts;
  }

  async getAuditLogs(scope: TenantScope, request_id?: string): Promise<any[]> {
    return []; // Placeholder for now
  }

  async getOverview(scope: TenantScope): Promise<any> {
    // Every metric is read from persisted data filtered by the resolved
    // Tenant_Scope — no placeholder, mock, or hardcoded values (Req 6.10, 8.1).
    const scopedWhere = this.scopedWhere(scope, ["company_id"]);
    const deviceWhere = this.scopedWhere(scope, ["company_id", "location_id"]);

    const [health, nodes, pending] = await Promise.all([
      this.prisma.it_system_health.findMany({ where: scopedWhere }),
      this.prisma.it_devices.count({ where: deviceWhere }),
      this.prisma.it_provisioning_requests.count({
        where: { ...scopedWhere, status: { in: ["PENDING", "REQUESTED"] } },
      }),
    ]);

    const healthyCount = health.filter(
      (h) => (h.status || "").toUpperCase() === "HEALTHY",
    ).length;
    const healthScore =
      health.length > 0
        ? Math.round((healthyCount / health.length) * 100)
        : 100;

    return {
      healthScore: `${healthScore}%`,
      activeNodes: nodes,
      pendingUpdates: pending,
      pendingProvisioningRequests: pending,
      systemHealthNodes: health.length,
      healthyNodes: healthyCount,
    };
  }

  /**
   * POS device and ecommerce-connector statistics for the IT overview, scoped
   * to the caller's Tenant_Scope. Returned ONLY when the Retail
   * Module_Activation_State is active for the tenant (Requirements 6.8, 8.10);
   * `null` otherwise so the overview omits Retail contributions without error
   * (Requirements 6.9, 8.11). All values come from persisted data — no
   * placeholder/mock/hardcoded values (Requirement 6.10).
   */
  async getRetailContributions(scope: TenantScope): Promise<any | null> {
    const retailActive = await isModuleActive(
      this.prisma,
      scope.tenant_id,
      "retail",
    );
    if (!retailActive) {
      return null;
    }

    // POS device stats from the unified Device model, scoped.
    const posDeviceWhere = {
      ...this.scopedWhere(scope, ["company_id", "location_id"]),
      type: "POS_TERMINAL",
    };
    const [totalPosDevices, onlinePosDevices, offlinePosDevices] =
      await Promise.all([
        this.prisma.it_devices.count({ where: posDeviceWhere }),
        this.prisma.it_devices.count({
          where: { ...posDeviceWhere, status: "ONLINE" },
        }),
        this.prisma.it_devices.count({
          where: { ...posDeviceWhere, status: "OFFLINE" },
        }),
      ]);

    // Ecommerce channel connectors, scoped (the table carries tenant_id and an
    // optional company_id, but no location_id).
    const ecomChannels = await this.prisma.ecommerce_connectors.findMany({
      where: this.scopedWhere(scope, ["company_id"]),
      select: {
        id: true,
        name: true,
        platform: true,
        status: true,
        updated_at: true,
      },
      take: 10,
    });

    const activeChannels = ecomChannels.filter(
      (c: { status: string }) =>
        c.status === "ACTIVE" || c.status === "active",
    ).length;

    return {
      moduleId: "retail",
      moduleName: "Retail Operations",
      posDevices: {
        total: totalPosDevices,
        online: onlinePosDevices,
        offline: offlinePosDevices,
      },
      storeDevices: {
        posTerminals: totalPosDevices,
        total: totalPosDevices,
      },
      ecommerceChannels: {
        total: ecomChannels.length,
        active: activeChannels,
        list: ecomChannels.slice(0, 5).map(
          (c: {
            name: string;
            platform: string;
            status: string;
            updated_at: Date | null;
          }) => ({
            name: c.name,
            type: c.platform,
            status: c.status,
            lastSynced: c.updated_at,
          }),
        ),
      },
    };
  }

  // ==================== IT Service Management ====================

  async createTicket(
    tenant_id: string,
    company_id: string | undefined,
    data: any,
  ): Promise<any> {
    return this.prisma.it_tickets.create({
      data: {
        tenant_id,
        company_id: company_id ?? null,
        title: data.title,
        description: data.description,
        category: data.category,
        impact: data.impact,
        priority: data.priority || "Medium",
        status: "open",
        assignee_id: data.assigneeId || null,
        reporter_id: data.reporterId || null,
        updated_at: new Date(),
      },
    });
  }

  async getTickets(scope: TenantScope): Promise<any[]> {
    return this.prisma.it_tickets.findMany({
      where: this.scopedWhere(scope, ["company_id"]),
      orderBy: { created_at: "desc" },
      take: 200,
    });
  }

  async getTicket(scope: TenantScope, ticket_id: string): Promise<any> {
    const ticket = await this.prisma.it_tickets.findFirst({
      where: { id: ticket_id, ...this.scopedWhere(scope, ["company_id"]) },
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket '${ticket_id}' was not found.`);
    }
    return ticket;
  }

  async updateTicket(
    tenant_id: string,
    ticket_id: string,
    data: any,
  ): Promise<any> {
    return this.prisma.it_tickets.update({
      where: { id: ticket_id, tenant_id },
      data: { ...data, updated_at: new Date() },
    });
  }

  async createIncident(
    tenant_id: string,
    company_id: string | undefined,
    data: any,
  ): Promise<any> {
    return this.prisma.it_incidents.create({
      data: {
        tenant_id,
        company_id: company_id ?? null,
        title: data.title,
        description: data.description,
        type: data.type,
        severity: data.severity,
        affected_systems: data.affectedSystems,
        discovered_at: new Date(data.discoveredAt),
        status: "open",
        updated_at: new Date(),
      },
    });
  }

  async getIncidents(scope: TenantScope): Promise<any[]> {
    return this.prisma.it_incidents.findMany({
      where: this.scopedWhere(scope, ["company_id"]),
      orderBy: { created_at: "desc" },
      take: 200,
    });
  }

  async upsertSlaConfig(
    tenant_id: string,
    company_id: string | undefined,
    data: any,
  ): Promise<any> {
    return this.prisma.it_sla_configs.upsert({
      where: { tenant_id_priority: { tenant_id, priority: data.priority } },
      update: {
        response_time_minutes: data.responseTimeMinutes,
        resolution_time_minutes: data.resolutionTimeMinutes,
        updated_at: new Date(),
      },
      create: {
        tenant_id,
        company_id: company_id ?? null,
        priority: data.priority,
        response_time_minutes: data.responseTimeMinutes,
        resolution_time_minutes: data.resolutionTimeMinutes,
        updated_at: new Date(),
      },
    });
  }

  async getSlaConfigs(scope: TenantScope): Promise<any[]> {
    return this.prisma.it_sla_configs.findMany({
      where: this.scopedWhere(scope, ["company_id"]),
      orderBy: { priority: "asc" },
    });
  }
}
