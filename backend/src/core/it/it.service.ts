import { BadRequestException, Injectable } from "@nestjs/common";
import { CreateProvisioningRequestDto } from "./dto/create-provisioning-request.dto";
import { IITRepository } from "./repositories/it.repository.interface";
import { AuditService } from "../../shared/audit/audit.service";
import { EventBusService } from "../../shared/events/event-bus.service";
import { CreateDeviceDto, CreateDeviceEventDto } from "./dto/device.dto";
import { assignPriority } from "./dto/ticket.dto";
import { TenantScope } from "../../shared/scope/tenant-scope";
import { AtomicOperationService, AtomicContext } from "../shared/atomic";
import { AsyncRejectionService } from "../shared/async";

/**
 * Statuses from which a provisioning request may transition to PROVISIONED.
 * A new request is created PENDING (Requirement 8.4); legacy/auto-created
 * records may carry the equivalent REQUESTED status. Comparison is
 * case-insensitive against the entity's lowercased status. Any other status
 * (notably an already-PROVISIONED request) is not a valid source state and the
 * transition is rejected, leaving the status unchanged (Requirement 8.9).
 */
const PROVISIONABLE_STATES = new Set(["PENDING", "REQUESTED"]);

@Injectable()
export class ITService {
  constructor(
    private readonly repository: IITRepository,
    private readonly auditService: AuditService,
    private readonly eventBus: EventBusService,
    private readonly atomic: AtomicOperationService,
    private readonly asyncRejection: AsyncRejectionService,
  ) {}

  async getProvisioningRequests(scope: TenantScope) {
    return this.repository.getProvisioningRequests(scope);
  }

  async createProvisioningRequest(
    scope: TenantScope,
    dto: CreateProvisioningRequestDto,
    user_id?: string,
  ) {
    return this.atomic.run(async (ctx) => {
      const request = await this.repository.createProvisioningRequest(
        scope.tenant_id,
        dto,
        ctx.tx,
      );
      await this.recordPrivilegedAction(ctx, {
        scope,
        user_id,
        action: "CREATE",
        entity_type: "PROVISIONING_REQUEST",
        entity_id: request.id,
        event_type: "it.provisioning.created.v1",
        metadata: { ...dto },
        after_state: { status: request.status },
      });
      return request;
    });
  }

  /**
   * Mark a PENDING provisioning request as PROVISIONED within a single
   * Atomic_Operation (Requirements 8.5, 4.1, 4.4).
   *
   * The request is read by composite key inside the transaction so a request
   * outside the caller's Tenant_Scope surfaces as a 404 (Requirement 8.8). The
   * transition is validated before any write: a request whose current status is
   * not a provisionable state (e.g. an already-PROVISIONED request) is rejected
   * with a 400 that names the current and target state, and — because the throw
   * happens inside the Atomic_Operation before the update — the status is left
   * unchanged (Requirement 8.9). The actor is the verified `user_id` from the
   * Tenant_Context, recorded on the request and in the Audit_Trail entry, which
   * commits or rolls back together with the transition (Requirements 8.5, 4.4).
   */
  async markProvisioned(
    scope: TenantScope,
    request_id: string,
    user_id: string,
  ) {
    return this.atomic.run(async ({ tx, audit, outbox }) => {
      const current = await this.repository.getProvisioningRequest(
        scope,
        request_id,
        tx,
      );

      const status = (current.status || "").toUpperCase();
      if (!PROVISIONABLE_STATES.has(status)) {
        throw new BadRequestException(
          `Cannot provision provisioning request '${request_id}': ` +
            `invalid transition from '${status}' to 'PROVISIONED'.`,
        );
      }

      const updated = await this.repository.markProvisioned(
        scope.tenant_id,
        request_id,
        user_id,
        tx,
      );

      await audit({
        tenant_id: scope.tenant_id,
        user_id,
        module: "it",
        action: "PROVISION",
        entity_type: "PROVISIONING_REQUEST",
        entity_id: request_id,
        metadata: {
          provisionedBy: user_id,
          tenant_scope: this.toTenantScopePayload(scope),
        },
        before_state: { status: current.status },
        after_state: { status: "provisioned" },
      });

      // Integration_Log event recorded inside the same Atomic_Operation, so the
      // cross-module domain event commits before the transition reports success
      // and rolls back with it on failure (Requirements 6.5, 6.6).
      await outbox({
        tenant_id: scope.tenant_id,
        type: "it.provisioning.provisioned.v1",
        payload: {
          entity_type: "PROVISIONING_REQUEST",
          entity_id: request_id,
          action: "PROVISION",
          actor_user_id: user_id,
          tenant_scope: this.toTenantScopePayload(scope),
        },
        company_id: scope.company_id,
      });

      return updated;
    });
  }

  async updateProvisioningRequest(
    scope: TenantScope,
    request_id: string,
    dto: Partial<CreateProvisioningRequestDto>,
    user_id?: string,
  ) {
    return this.atomic.run(async (ctx) => {
      const request = await this.repository.updateProvisioningRequest(
        scope.tenant_id,
        request_id,
        dto,
        ctx.tx,
      );
      await this.recordPrivilegedAction(ctx, {
        scope,
        user_id,
        action: "UPDATE",
        entity_type: "PROVISIONING_REQUEST",
        entity_id: request_id,
        event_type: "it.provisioning.updated.v1",
        metadata: { ...dto },
      });
      return request;
    });
  }

  async deleteProvisioningRequest(
    scope: TenantScope,
    request_id: string,
    user_id?: string,
  ) {
    return this.atomic.run(async (ctx) => {
      await this.repository.deleteProvisioningRequest(
        scope.tenant_id,
        request_id,
        ctx.tx,
      );
      await this.recordPrivilegedAction(ctx, {
        scope,
        user_id,
        action: "DELETE",
        entity_type: "PROVISIONING_REQUEST",
        entity_id: request_id,
        event_type: "it.provisioning.deleted.v1",
      });
    });
  }

  // Devices (NEW)
  async getDevices(scope: TenantScope) {
    return this.repository.getDevices(scope);
  }

  async createDevice(scope: TenantScope, dto: CreateDeviceDto, user_id?: string) {
    return this.atomic.run(async (ctx) => {
      const device = await this.repository.createDevice(
        scope.tenant_id,
        dto,
        ctx.tx,
      );
      await this.recordPrivilegedAction(ctx, {
        scope,
        user_id,
        action: "CREATE",
        entity_type: "DEVICE",
        entity_id: device.id,
        event_type: "it.device.created.v1",
        metadata: { ...dto },
      });
      return device;
    });
  }

  async updateDevice(
    scope: TenantScope,
    device_id: string,
    dto: Partial<CreateDeviceDto>,
    user_id?: string,
  ) {
    return this.atomic.run(async (ctx) => {
      const device = await this.repository.updateDevice(
        scope.tenant_id,
        device_id,
        dto,
        ctx.tx,
      );
      await this.recordPrivilegedAction(ctx, {
        scope,
        user_id,
        action: "UPDATE",
        entity_type: "DEVICE",
        entity_id: device_id,
        event_type: "it.device.updated.v1",
        metadata: { ...dto },
      });
      return device;
    });
  }

  /**
   * Composite-key read of a single device within the caller's Tenant_Scope.
   * A device owned by another tenant surfaces as a 404 (Requirements 8.8, 1.4).
   */
  async getDevice(scope: TenantScope, device_id: string) {
    return this.repository.getDevice(scope, device_id);
  }

  // Device Events (NEW)
  async getDeviceEvents(scope: TenantScope) {
    return this.repository.getDeviceEvents(scope);
  }

  async createDeviceEvent(scope: TenantScope, dto: CreateDeviceEventDto) {
    // Reject an event referencing a device that does not exist within the
    // resolved Tenant_Scope WITHOUT recording it (Requirement 8.13). The scoped
    // composite-key read surfaces a foreign-scope device as a 404, so no event
    // row is ever written for it.
    await this.repository.getDevice(scope, dto.device_id);

    // Record the event against the corresponding device within that device's
    // Tenant_Scope (Requirement 8.12).
    const event = await this.repository.createDeviceEvent(scope.tenant_id, dto);

    // Publish to the EventBus for Inventory/Retail to consume. The publish is
    // asynchronous work whose rejection handler is attached BEFORE it executes
    // via the async-rejection helper (BUG-13), so a downstream delivery failure
    // is captured and recorded in the Integration_Log and can never surface as
    // an unhandled rejection or crash the process (Requirements 7.1, 7.2). The
    // event has already been durably recorded, so ingestion succeeds regardless
    // of downstream delivery.
    void this.asyncRejection.fireAndForget(
      {
        module: "IT",
        operation: "it.device-event.publish",
        tenant_id: scope.tenant_id,
        metadata: {
          device_event_id: event.id,
          device_id: event.device_id,
          event_type: event.event_type,
        },
      },
      () =>
        this.eventBus.publish({
          event_type: "DEVICE_EVENT_CREATED",
          tenant_id: event.tenant_id,
          entity_id: event.id,
          entity_type: "DEVICE_EVENT",
          source_module: "it",
          payload: event.payload,
        }),
    );

    return event;
  }

  // Misc
  async getSystemHealth(scope: TenantScope) {
    return this.repository.getSystemHealth(scope);
  }

  async getMonitoringStats(scope: TenantScope) {
    return this.repository.getProvisioningStats(scope);
  }

  async getAuditLogs(scope: TenantScope, request_id?: string) {
    return this.repository.getAuditLogs(scope, request_id);
  }

  /**
   * Assemble the IT workspace overview from persisted, tenant-scoped data only
   * — no placeholder, mock, or hardcoded values (Requirements 6.10, 8.1).
   *
   * POS device and ecommerce-connector statistics are contributed under
   * `moduleContributions.retail` ONLY when the Retail Module_Activation_State is
   * active for the tenant (Requirements 6.8, 8.10); when Retail is inactive the
   * overview is returned with `moduleContributions.retail = null` — successfully
   * and without error (Requirements 6.9, 8.11). All contributed data is scoped
   * to the caller's Tenant_Scope.
   */
  async getOverview(scope: TenantScope) {
    const [overview, retailContribution] = await Promise.all([
      this.repository.getOverview(scope),
      this.repository.getRetailContributions(scope),
    ]);

    return {
      ...overview,
      moduleContributions: {
        retail: retailContribution,
      },
    };
  }

  // ==================== IT Service Management ====================

  async createTicket(scope: TenantScope, dto: any, user_id?: string) {
    const priority =
      dto.priority || assignPriority(dto.category, dto.impact);
    const ticket = await this.repository.createTicket(scope.tenant_id, scope.company_id, {
      ...dto,
      priority,
    });
    if (user_id) {
      await this.auditService.log({
        tenant_id: scope.tenant_id,
        user_id,
        module: "it",
        action: "CREATE",
        entity_type: "TICKET",
        entity_id: ticket.id,
        metadata: { title: dto.title, category: dto.category, priority },
      });
    }
    return ticket;
  }

  async getTickets(scope: TenantScope) {
    return this.repository.getTickets(scope);
  }

  async getTicket(scope: TenantScope, ticket_id: string) {
    return this.repository.getTicket(scope, ticket_id);
  }

  async updateTicket(scope: TenantScope, ticket_id: string, dto: any, user_id?: string) {
    // Composite-key read first so a foreign-tenant ticket surfaces as 404.
    await this.repository.getTicket(scope, ticket_id);
    const data: any = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.assigneeId !== undefined) data.assignee_id = dto.assigneeId;
    const updated = await this.repository.updateTicket(scope.tenant_id, ticket_id, data);
    if (user_id) {
      await this.auditService.log({
        tenant_id: scope.tenant_id,
        user_id,
        module: "it",
        action: "UPDATE",
        entity_type: "TICKET",
        entity_id: ticket_id,
        metadata: { ...data },
      });
    }
    return updated;
  }

  async escalateTicket(scope: TenantScope, dto: any, user_id?: string) {
    const ticket = await this.repository.getTicket(scope, dto.ticketId);
    const updated = await this.repository.updateTicket(scope.tenant_id, dto.ticketId, {
      status: "escalated",
      priority: dto.priority,
      escalated_to: dto.escalatedTo,
      escalation_reason: dto.reason,
      escalation_level: (ticket.escalation_level || 0) + 1,
    });
    if (user_id) {
      await this.auditService.log({
        tenant_id: scope.tenant_id,
        user_id,
        module: "it",
        action: "ESCALATE",
        entity_type: "TICKET",
        entity_id: dto.ticketId,
        metadata: { escalatedTo: dto.escalatedTo, priority: dto.priority, reason: dto.reason },
      });
    }
    return updated;
  }

  async resolveTicket(scope: TenantScope, dto: any, user_id?: string) {
    await this.repository.getTicket(scope, dto.ticketId);
    const updated = await this.repository.updateTicket(scope.tenant_id, dto.ticketId, {
      status: "resolved",
      resolution_notes: dto.resolutionNotes,
      resolution_category: dto.category,
      resolved_by: user_id || null,
      resolved_at: new Date(),
    });
    if (user_id) {
      await this.auditService.log({
        tenant_id: scope.tenant_id,
        user_id,
        module: "it",
        action: "RESOLVE",
        entity_type: "TICKET",
        entity_id: dto.ticketId,
        metadata: { category: dto.category },
      });
    }
    return updated;
  }

  async createIncident(scope: TenantScope, dto: any, user_id?: string) {
    const incident = await this.repository.createIncident(scope.tenant_id, scope.company_id, dto);
    if (user_id) {
      await this.auditService.log({
        tenant_id: scope.tenant_id,
        user_id,
        module: "it",
        action: "CREATE",
        entity_type: "INCIDENT",
        entity_id: incident.id,
        metadata: { title: dto.title, type: dto.type, severity: dto.severity },
      });
    }
    return incident;
  }

  async getIncidents(scope: TenantScope) {
    return this.repository.getIncidents(scope);
  }

  async upsertSlaConfig(scope: TenantScope, dto: any, user_id?: string) {
    const cfg = await this.repository.upsertSlaConfig(scope.tenant_id, scope.company_id, dto);
    if (user_id) {
      await this.auditService.log({
        tenant_id: scope.tenant_id,
        user_id,
        module: "it",
        action: "UPSERT",
        entity_type: "SLA_CONFIG",
        entity_id: cfg.id,
        metadata: { priority: dto.priority },
      });
    }
    return cfg;
  }

  async getSlaConfigs(scope: TenantScope) {
    return this.repository.getSlaConfigs(scope);
  }

  /**
   * Project a {@link TenantScope} to a plain payload recorded in Audit_Trail
   * entries and Integration_Log events so every privileged action captures the
   * caller's Tenant_Scope (Requirement 6.7).
   */
  private toTenantScopePayload(scope: TenantScope): Record<string, string> {
    const payload: Record<string, string> = { tenant_id: scope.tenant_id };
    if (scope.company_id) payload.company_id = scope.company_id;
    if (scope.location_id) payload.location_id = scope.location_id;
    if (scope.branch_id) payload.branch_id = scope.branch_id;
    return payload;
  }

  /**
   * Record the Audit_Trail entry and the Integration_Log (outbox) event for a
   * privileged IT create/update/delete action inside the current
   * Atomic_Operation.
   *
   * The Audit_Trail entry captures the actor `user_id`, the action, the affected
   * resource identifier, and the caller's Tenant_Scope (Requirement 6.7). The
   * Integration_Log event records the cross-module domain event with the
   * originating Tenant_Scope and — because it is written on the same transaction
   * client — is committed before the operation reports success and rolls back
   * with the write on failure (Requirements 6.5, 6.6).
   */
  private async recordPrivilegedAction(
    ctx: Pick<AtomicContext, "audit" | "outbox">,
    params: {
      scope: TenantScope;
      user_id?: string;
      action: string;
      entity_type: string;
      entity_id: string;
      event_type: string;
      metadata?: Record<string, unknown>;
      before_state?: Record<string, unknown>;
      after_state?: Record<string, unknown>;
    },
  ): Promise<void> {
    const tenant_scope = this.toTenantScopePayload(params.scope);

    if (params.user_id) {
      await ctx.audit({
        tenant_id: params.scope.tenant_id,
        user_id: params.user_id,
        module: "it",
        action: params.action,
        entity_type: params.entity_type,
        entity_id: params.entity_id,
        metadata: { ...(params.metadata ?? {}), tenant_scope },
        before_state: params.before_state,
        after_state: params.after_state,
      });
    }

    await ctx.outbox({
      tenant_id: params.scope.tenant_id,
      type: params.event_type,
      payload: {
        entity_type: params.entity_type,
        entity_id: params.entity_id,
        action: params.action,
        actor_user_id: params.user_id ?? null,
        tenant_scope,
      },
      company_id: params.scope.company_id,
    });
  }
}
