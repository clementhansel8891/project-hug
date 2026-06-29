import { CreateProvisioningRequestDto } from "../dto/create-provisioning-request.dto";
import { ProvisioningRequest } from "../entities/provisioning-request.entity";
import { SystemHealth } from "../entities/system-health.entity";
import { Device, DeviceEvent } from "../entities/device.entity";
import { CreateDeviceDto, CreateDeviceEventDto } from "../dto/device.dto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { IITRepository } from "./it.repository.interface";
import { TenantScope } from "../../../shared/scope/tenant-scope";

@Injectable()
export class ITMockRepository extends IITRepository {
  private readonly provisioningRequests: ProvisioningRequest[] = [];
  private readonly healthChecks: SystemHealth[] = [];
  private readonly devices: Device[] = [];
  private readonly deviceEvents: DeviceEvent[] = [];

  constructor() {
    super();
    this.seed("tenant-001");
    this.seed("tenant-002");
  }

  private seed(tenant_id: string): void {
    this.provisioningRequests.push({
      id: `${tenant_id}-prov-1`,
      tenant_id,
      supplierId: `${tenant_id}-supplier-1`,
      supplierBranchId: `${tenant_id}-supplier-1-jkt`,
      scope: "full_portal",
      priority: "MEDIUM",
      description: "Initial automated onboarding for new supplier admin.",
      reason: "Initial supplier onboarding",
      status: "requested",
      requested_by: "procurement-admin",
      created_at: new Date(),
      updated_at: new Date(),
    });
    this.healthChecks.push(
      {
        id: `${tenant_id}-health-1`,
        tenant_id,
        component: "identity",
        status: "healthy",
        latencyMs: 42,
        checkedAt: new Date(),
      },
      {
        id: `${tenant_id}-health-2`,
        tenant_id,
        component: "database",
        status: "healthy",
        latencyMs: 55,
        checkedAt: new Date(),
      },
      {
        id: `${tenant_id}-health-3`,
        tenant_id,
        component: "integrations",
        status: "degraded",
        latencyMs: 210,
        checkedAt: new Date(),
      },
    );
  }

  async getProvisioningRequests(
    scope: TenantScope,
  ): Promise<ProvisioningRequest[]> {
    return this.provisioningRequests.filter(
      (item) => item.tenant_id === scope.tenant_id,
    );
  }

  async createProvisioningRequest(
    tenant_id: string,
    dto: CreateProvisioningRequestDto,
    _tx?: Prisma.TransactionClient,
  ): Promise<ProvisioningRequest> {
    const created: ProvisioningRequest = {
      id: `${tenant_id}-prov-${this.provisioningRequests.length + 1}`,
      tenant_id,
      supplierId: dto.supplierId,
      supplierBranchId: dto.supplierBranchId,
      scope: dto.scope,
      priority: dto.priority || "MEDIUM",
      description: dto.description,
      reason: dto.reason,
      status: "pending",
      requested_by: dto.requested_by || "system",
      created_at: new Date(),
      updated_at: new Date(),
    };
    this.provisioningRequests.push(created);
    return created;
  }

  async markProvisioned(
    tenant_id: string,
    request_id: string,
    provisionedBy: string,
    _tx?: Prisma.TransactionClient,
  ): Promise<ProvisioningRequest> {
    const request = this.provisioningRequests.find(
      (item) => item.tenant_id === tenant_id && item.id === request_id,
    );
    if (!request)
      throw new NotFoundException("Provisioning request not found.");
    request.status = "provisioned";
    request.provisionedBy = provisionedBy;
    request.updated_at = new Date();
    return request;
  }

  async getProvisioningRequest(
    scope: TenantScope,
    request_id: string,
    _tx?: Prisma.TransactionClient,
  ): Promise<ProvisioningRequest> {
    const request = this.provisioningRequests.find(
      (item) => item.tenant_id === scope.tenant_id && item.id === request_id,
    );
    if (!request) {
      throw new NotFoundException(
        `Provisioning request '${request_id}' was not found.`,
      );
    }
    return request;
  }

  async updateProvisioningRequest(
    tenant_id: string,
    request_id: string,
    dto: Partial<CreateProvisioningRequestDto>,
    _tx?: Prisma.TransactionClient,
  ): Promise<ProvisioningRequest> {
    const request = this.provisioningRequests.find(
      (item) => item.tenant_id === tenant_id && item.id === request_id,
    );
    if (!request)
      throw new NotFoundException("Provisioning request not found.");
    if (dto.employee_id !== undefined) request.employee_id = dto.employee_id;
    if (dto.supplierId !== undefined) request.supplierId = dto.supplierId;
    if (dto.supplierBranchId !== undefined)
      request.supplierBranchId = dto.supplierBranchId;
    if (dto.scope !== undefined) request.scope = dto.scope;
    if (dto.reason !== undefined) request.reason = dto.reason;
    request.updated_at = new Date();
    return request;
  }

  async deleteProvisioningRequest(
    tenant_id: string,
    request_id: string,
    _tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const index = this.provisioningRequests.findIndex(
      (item) => item.tenant_id === tenant_id && item.id === request_id,
    );
    if (index === -1)
      throw new NotFoundException("Provisioning request not found.");
    this.provisioningRequests.splice(index, 1);
  }

  async getSystemHealth(scope: TenantScope): Promise<SystemHealth[]> {
    return this.healthChecks.filter((item) => item.tenant_id === scope.tenant_id);
  }

  async getProvisioningStats(scope: TenantScope): Promise<any> {
    const requests = this.provisioningRequests.filter((r) => r.tenant_id === scope.tenant_id);
    return {
      total: requests.length,
      requested: requests.filter((r) => r.status === "pending" || r.status === "requested").length,
      provisioned: requests.filter((r) => r.status === "provisioned").length,
    };
  }

  async getAuditLogs(scope: TenantScope, request_id?: string): Promise<any[]> {
    return []; // Mock return
  }

  // Devices (NEW)
  async getDevices(scope: TenantScope): Promise<Device[]> {
    return this.devices.filter((d) => d.tenant_id === scope.tenant_id);
  }

  async createDevice(
    tenant_id: string,
    dto: CreateDeviceDto,
    _tx?: Prisma.TransactionClient,
  ): Promise<Device> {
    const created: Device = {
      id: `dev-${Math.random().toString(36).substr(2, 9)}`,
      tenant_id,
      name: dto.name,
      type: dto.type,
      connection: dto.connection,
      status: "ONLINE",
      location_id: dto.location_id,
      owner_id: dto.owner_id,
      metadata: dto.metadata || {},
      created_at: new Date(),
    };
    this.devices.push(created);
    return created;
  }

  async updateDevice(
    tenant_id: string,
    device_id: string,
    dto: Partial<CreateDeviceDto>,
    _tx?: Prisma.TransactionClient,
  ): Promise<Device> {
    const device = this.devices.find((d) => d.id === device_id && d.tenant_id === tenant_id);
    if (!device) throw new NotFoundException("Device not found");
    Object.assign(device, dto);
    return device;
  }

  async getDevice(scope: TenantScope, device_id: string): Promise<Device> {
    const device = this.devices.find(
      (d) => d.id === device_id && d.tenant_id === scope.tenant_id,
    );
    if (!device) {
      throw new NotFoundException(`Device '${device_id}' was not found.`);
    }
    return device;
  }

  // Device Events (NEW)
  async getDeviceEvents(scope: TenantScope): Promise<DeviceEvent[]> {
    return this.deviceEvents.filter((e) => e.tenant_id === scope.tenant_id);
  }

  async createDeviceEvent(
    tenant_id: string,
    dto: CreateDeviceEventDto,
    _tx?: Prisma.TransactionClient,
  ): Promise<DeviceEvent> {
    const created: DeviceEvent = {
      id: `evt-${Math.random().toString(36).substr(2, 9)}`,
      tenant_id,
      device_id: dto.device_id,
      event_type: dto.event_type,
      payload: dto.payload,
      processed: dto.processed || false,
      created_at: new Date(),
    };
    this.deviceEvents.push(created);
    return created;
  }

  async getOverview(scope: TenantScope): Promise<any> {
    const health = await this.getSystemHealth(scope);
    const nodes = (await this.getDevices(scope)).length;
    const updates = (await this.getProvisioningRequests(scope)).filter(r => r.status === 'pending' || r.status === 'requested').length;

    const healthyCount = health.filter(h => h.status === 'healthy').length;
    const healthScore = health.length > 0 ? Math.round((healthyCount / health.length) * 100) : 100;

    return {
      healthScore: `${healthScore}%`,
      activeNodes: nodes,
      pendingUpdates: updates,
      pendingProvisioningRequests: updates,
      systemHealthNodes: health.length,
      healthyNodes: healthyCount,
    };
  }

  async getRetailContributions(_scope: TenantScope): Promise<any | null> {
    // The mock repository carries no Retail activation state or POS/ecommerce
    // data; Retail contributions are exercised against the live DB repository.
    return null;
  }

  // ==================== IT Service Management (in-memory) ====================
  private readonly tickets: any[] = [];
  private readonly incidents: any[] = [];
  private readonly slaConfigs: any[] = [];

  async createTicket(tenant_id: string, company_id: string | undefined, data: any): Promise<any> {
    const ticket = {
      id: `tkt-${Math.random().toString(36).substr(2, 9)}`,
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
      escalation_level: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };
    this.tickets.push(ticket);
    return ticket;
  }

  async getTickets(scope: TenantScope): Promise<any[]> {
    return this.tickets.filter((t) => t.tenant_id === scope.tenant_id);
  }

  async getTicket(scope: TenantScope, ticket_id: string): Promise<any> {
    const ticket = this.tickets.find(
      (t) => t.id === ticket_id && t.tenant_id === scope.tenant_id,
    );
    if (!ticket) throw new NotFoundException(`Ticket '${ticket_id}' was not found.`);
    return ticket;
  }

  async updateTicket(tenant_id: string, ticket_id: string, data: any): Promise<any> {
    const ticket = this.tickets.find(
      (t) => t.id === ticket_id && t.tenant_id === tenant_id,
    );
    if (!ticket) throw new NotFoundException(`Ticket '${ticket_id}' was not found.`);
    Object.assign(ticket, data, { updated_at: new Date() });
    return ticket;
  }

  async createIncident(tenant_id: string, company_id: string | undefined, data: any): Promise<any> {
    const incident = {
      id: `inc-${Math.random().toString(36).substr(2, 9)}`,
      tenant_id,
      company_id: company_id ?? null,
      title: data.title,
      description: data.description,
      type: data.type,
      severity: data.severity,
      affected_systems: data.affectedSystems,
      discovered_at: new Date(data.discoveredAt),
      status: "open",
      created_at: new Date(),
      updated_at: new Date(),
    };
    this.incidents.push(incident);
    return incident;
  }

  async getIncidents(scope: TenantScope): Promise<any[]> {
    return this.incidents.filter((i) => i.tenant_id === scope.tenant_id);
  }

  async upsertSlaConfig(tenant_id: string, company_id: string | undefined, data: any): Promise<any> {
    let cfg = this.slaConfigs.find(
      (s) => s.tenant_id === tenant_id && s.priority === data.priority,
    );
    if (cfg) {
      cfg.response_time_minutes = data.responseTimeMinutes;
      cfg.resolution_time_minutes = data.resolutionTimeMinutes;
      cfg.updated_at = new Date();
    } else {
      cfg = {
        id: `sla-${Math.random().toString(36).substr(2, 9)}`,
        tenant_id,
        company_id: company_id ?? null,
        priority: data.priority,
        response_time_minutes: data.responseTimeMinutes,
        resolution_time_minutes: data.resolutionTimeMinutes,
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.slaConfigs.push(cfg);
    }
    return cfg;
  }

  async getSlaConfigs(scope: TenantScope): Promise<any[]> {
    return this.slaConfigs.filter((s) => s.tenant_id === scope.tenant_id);
  }
}
