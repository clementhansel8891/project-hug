import { Prisma } from "@prisma/client";
import { CreateProvisioningRequestDto } from "../dto/create-provisioning-request.dto";
import { ProvisioningRequest } from "../entities/provisioning-request.entity";
import { SystemHealth } from "../entities/system-health.entity";
import { Device, DeviceEvent } from "../entities/device.entity";
import { CreateDeviceDto, CreateDeviceEventDto } from "../dto/device.dto";
import { TenantScope } from "../../../shared/scope/tenant-scope";

export abstract class IITRepository {
  // Provisioning
  //
  // Reads are filtered by the resolved TenantScope (tenant_id plus any
  // validated company/location/branch keys) so a caller never sees records
  // outside their permitted scope (Requirements 8.1, 8.2). An empty match
  // yields `[]`, never an error.
  abstract getProvisioningRequests(
    scope: TenantScope,
  ): Promise<ProvisioningRequest[]>;
  /**
   * Composite-key read of a single provisioning request within the caller's
   * Tenant_Scope. Resolves via `findFirst({ where: { id, tenant_id, ... } })`
   * so a request owned by another tenant surfaces as a 404 rather than leaking
   * across tenants (Requirements 8.8, 1.4, 4.5). Accepts an optional `tx` so the
   * read can participate in an Atomic_Operation (read-then-transition).
   */
  abstract getProvisioningRequest(
    scope: TenantScope,
    request_id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ProvisioningRequest>;
  abstract createProvisioningRequest(
    tenant_id: string,
    dto: CreateProvisioningRequestDto,
    tx?: Prisma.TransactionClient,
  ): Promise<ProvisioningRequest>;
  /**
   * Transition a provisioning request to PROVISIONED, recording the actor.
   * Accepts an optional `tx?: Prisma.TransactionClient` so the write enrols in
   * the calling Atomic_Operation alongside its Audit_Trail entry
   * (Requirements 8.5, 4.1, 4.4).
   */
  abstract markProvisioned(
    tenant_id: string,
    request_id: string,
    provisionedBy: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ProvisioningRequest>;
  abstract updateProvisioningRequest(
    tenant_id: string,
    request_id: string,
    dto: Partial<CreateProvisioningRequestDto>,
    tx?: Prisma.TransactionClient,
  ): Promise<ProvisioningRequest>;
  abstract deleteProvisioningRequest(
    tenant_id: string,
    request_id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;

  // Devices (NEW)
  abstract getDevices(scope: TenantScope): Promise<Device[]>;
  abstract createDevice(
    tenant_id: string,
    dto: CreateDeviceDto,
    tx?: Prisma.TransactionClient,
  ): Promise<Device>;
  abstract updateDevice(
    tenant_id: string,
    device_id: string,
    dto: Partial<CreateDeviceDto>,
    tx?: Prisma.TransactionClient,
  ): Promise<Device>;
  /**
   * Composite-key read of a single device within the caller's Tenant_Scope.
   * Resolves via `findFirst({ where: { id, tenant_id, ... } })` so a device
   * owned by another tenant is indistinguishable from a missing one and
   * surfaces as a 404 — never as cross-tenant leakage (Requirements 8.8, 1.4).
   */
  abstract getDevice(scope: TenantScope, device_id: string): Promise<Device>;

  // Device Events (NEW)
  abstract getDeviceEvents(scope: TenantScope): Promise<DeviceEvent[]>;
  /**
   * Record a device event/inbound webhook against a device. Accepts an optional
   * `tx?: Prisma.TransactionClient` so the write can enrol in an
   * Atomic_Operation (Requirements 8.12, 4.1). Scope validation that the device
   * belongs to the resolved Tenant_Scope is performed by the service before
   * this write (Requirement 8.13).
   */
  abstract createDeviceEvent(
    tenant_id: string,
    dto: CreateDeviceEventDto,
    tx?: Prisma.TransactionClient,
  ): Promise<DeviceEvent>;

  // Misc
  abstract getSystemHealth(scope: TenantScope): Promise<SystemHealth[]>;
  abstract getProvisioningStats(scope: TenantScope): Promise<any>;
  abstract getAuditLogs(scope: TenantScope, request_id?: string): Promise<any[]>;
  /**
   * IT workspace overview assembled from persisted, tenant-scoped data only —
   * no placeholder, mock, or hardcoded values (Requirements 6.10, 8.1). Every
   * metric is filtered by the resolved Tenant_Scope.
   */
  abstract getOverview(scope: TenantScope): Promise<any>;
  /**
   * POS device and ecommerce-connector statistics contributed to the IT
   * overview ONLY when the Retail Module_Activation_State is active for the
   * caller's tenant (Requirements 6.8, 8.10). Returns `null` when Retail is
   * inactive so the overview is returned without Retail contributions and
   * without error (Requirements 6.9, 8.11). All counts/lists are scoped to the
   * caller's Tenant_Scope.
   */
  abstract getRetailContributions(scope: TenantScope): Promise<any | null>;

  // ==================== IT Service Management (Tickets/Incidents/SLA) ====================
  abstract createTicket(tenant_id: string, company_id: string | undefined, data: any): Promise<any>;
  abstract getTickets(scope: TenantScope): Promise<any[]>;
  abstract getTicket(scope: TenantScope, ticket_id: string): Promise<any>;
  abstract updateTicket(tenant_id: string, ticket_id: string, data: any): Promise<any>;
  abstract createIncident(tenant_id: string, company_id: string | undefined, data: any): Promise<any>;
  abstract getIncidents(scope: TenantScope): Promise<any[]>;
  abstract upsertSlaConfig(tenant_id: string, company_id: string | undefined, data: any): Promise<any>;
  abstract getSlaConfigs(scope: TenantScope): Promise<any[]>;
}
