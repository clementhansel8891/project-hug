import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../persistence/prisma.service";
import { IAdminRepository } from "./admin.repository.interface";
import { ToggleModuleDto } from "../dto/toggle-module.dto";
import { CreateAdminRequestDto } from "../dto/create-admin-request.dto";
import { AdminModuleStatus } from "../entities/admin-module.entity";
import { AdminRequest } from "../entities/admin-request.entity";
import { AdminAuditEvent } from "../entities/admin-audit.entity";
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AdminPrismaRepository extends IAdminRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async getModuleStatuses(tenant_id: string): Promise<AdminModuleStatus[]> {
    const statuses = await this.prisma.admin_module_statuses.findMany({
      where: { tenant_id: tenant_id },
    });
    return statuses.map(s => this.mapModuleStatus(s));
  }

  async toggleModule(
    tenant_id: string,
    dto: ToggleModuleDto,
  ): Promise<AdminModuleStatus> {
    // Upsert: create the row if it doesn't exist yet (handles newly-added module keys).
    const updated = await this.prisma.admin_module_statuses.upsert({
      where: { tenant_id_module_key: { tenant_id: tenant_id, module_key: dto.moduleKey } },
      update: {
        enabled: dto.enabled,
        updated_by: dto.updatedBy,
        updated_at: new Date(),
      },
      create: {
        id: uuidv4(),
        tenant_id: tenant_id,
        module_key: dto.moduleKey,
        enabled: dto.enabled,
        updated_by: dto.updatedBy || 'system',
        updated_at: new Date(),
      },
    });
    // Record audit event
    await this.prisma.admin_audit_events.create({
      data: {
        id: uuidv4(),
        tenant_id: tenant_id,
        action: "admin.module.toggle",
        entity_type: "module",
        entity_id: dto.moduleKey,
        actor_id: dto.updatedBy || "system",
        updated_at: new Date(),
      },
    });
    return this.mapModuleStatus(updated);
  }

  async getRequests(tenant_id: string): Promise<AdminRequest[]> {
    const requests = await this.prisma.admin_requests.findMany({
      where: { tenant_id: tenant_id },
    });
    return requests.map(r => this.mapRequest(r));
  }

  async createRequest(
    tenant_id: string,
    dto: CreateAdminRequestDto,
  ): Promise<AdminRequest> {
    const created = await this.prisma.admin_requests.create({
      data: {
        id: uuidv4(),
        updated_at: new Date(),
        tenant_id: tenant_id,
        type: dto.type,
        title: dto.title,
        detail: dto.detail,
        status: "open",
        requested_by: dto.requested_by || "system",
      },
    });
    // Audit
    await this.prisma.admin_audit_events.create({
      data: {
        id: uuidv4(),
        tenant_id: tenant_id,
        action: "admin.request.create",
        entity_type: "admin_request",
        entity_id: created.id,
        actor_id: dto.requested_by || "system",
        updated_at: new Date(),
      },
    });
    return this.mapRequest(created);
  }

  async resolveRequest(
    tenant_id: string,
    request_id: string,
    resolvedBy: string,
  ): Promise<AdminRequest> {
    const resolved = await this.prisma.admin_requests.update({
      where: { id: request_id },
      data: { status: "resolved", resolved_by: resolvedBy, updated_at: new Date() },
    });
    await this.prisma.admin_audit_events.create({
      data: {
        id: uuidv4(),
        tenant_id: tenant_id,
        action: "admin.request.resolve",
        entity_type: "admin_request",
        entity_id: request_id,
        actor_id: resolvedBy,
        updated_at: new Date(),
      },
    });
    return this.mapRequest(resolved);
  }

  async getAuditEvents(tenant_id: string): Promise<AdminAuditEvent[]> {
    const events = await this.prisma.admin_audit_events.findMany({ 
      where: { tenant_id: tenant_id },
      orderBy: { id: 'desc' }
    });
    return events.map(e => this.mapAuditEvent(e));
  }

  async getStuckEvents(tenant_id: string, staleSince: Date): Promise<any[]> {
    return this.prisma.sys_outbox_events.findMany({
      where: {
        tenant_id,
        OR: [
          { status: "FAILED" },
          { status: "PENDING", created_at: { lt: staleSince } }
        ]
      },
      orderBy: { created_at: 'desc' }
    });
  }

  async retryEvent(tenant_id: string, event_id: string): Promise<any> {
    return this.prisma.sys_outbox_events.update({
      where: { id: event_id, tenant_id },
      data: {
        status: "PENDING",
        attempts: 0,
        updated_at: new Date(),
        next_retry_at: new Date()
      }
    });
  }

  async getSyncStatus(tenant_id: string): Promise<any> {
    const [pending, failed, lastProcessed] = await Promise.all([
      this.prisma.sys_outbox_events.count({ where: { tenant_id, status: "PENDING" } }),
      this.prisma.sys_outbox_events.count({ where: { tenant_id, status: "FAILED" } }),
      this.prisma.sys_outbox_events.findFirst({
        where: { tenant_id, status: "PROCESSED" },
        orderBy: { updated_at: "desc" },
        select: { updated_at: true }
      })
    ]);

    const isHealthy = pending < 100 && failed < 10;
    const latencyMinutes = lastProcessed 
      ? Math.floor((Date.now() - lastProcessed.updated_at.getTime()) / 60000)
      : -1;

    return {
      status: isHealthy ? "HEALTHY" : "DEGRADED",
      pending_count: pending,
      failed_count: failed,
      last_sync_at: lastProcessed?.updated_at || null,
      sync_latency_min: latencyMinutes,
      is_healthy: isHealthy
    };
  }

  async getIotDevices(tenant_id: string): Promise<any[]> {
    return this.prisma.it_devices.findMany({
      where: { tenant_id },
      include: {
        locations: { select: { name: true } },
        employees: { select: { first_name: true, last_name: true } }
      },
      orderBy: { updated_at: 'desc' }
    });
  }

  private mapModuleStatus(s: any): AdminModuleStatus {
    return {
      id: s.id,
      tenant_id: s.tenant_id,
      moduleKey: s.module_key,
      enabled: s.enabled,
      updatedBy: s.updated_by,
      updated_at: s.updated_at,
    };
  }

  private mapRequest(r: any): AdminRequest {
    return {
      id: r.id,
      tenant_id: r.tenant_id,
      type: r.type,
      title: r.title,
      detail: r.detail,
      status: r.status,
      requested_by: r.requested_by,
      resolvedBy: r.resolved_by,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }

  private mapAuditEvent(e: any): AdminAuditEvent {
    return {
      id: e.id,
      tenant_id: e.tenant_id,
      action: e.action,
      entity_type: e.entity_type,
      entity_id: e.entity_id,
      actor_id: e.actor_id,
      created_at: e.created_at,
    };
  }
}
