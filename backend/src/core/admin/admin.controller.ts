import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Request } from "express";
import { TenantContext } from "../../gateway/tenant-context.interface";
import { TenantInterceptor } from "../../gateway/tenant.interceptor";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { Roles } from "../../shared/decorators/roles.decorator";
import { UserRole } from "../../shared/roles";
import { CreateAdminRequestDto } from "./dto/create-admin-request.dto";
import { ToggleModuleDto } from "./dto/toggle-module.dto";
import { AdminService } from "./admin.service";
import { PrismaService } from "../../persistence/prisma.service";
import { isModuleActive } from "../../shared/helpers/module-active.helper";
import { AuditChainService } from "../../shared/audit/audit-chain.service";
import { EventBusService } from "../../shared/events/event-bus.service";
import { LocalEmitterService } from "../../shared/events/local-emitter.service";
import { OutboxWorkerService } from "../../shared/maintenance/outbox-worker.service";

interface RequestWithTenant extends Request {
  tenantContext: TenantContext;
}

@Controller('admin')
@UseInterceptors(TenantInterceptor)
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly prisma: PrismaService,
    private readonly auditChainService: AuditChainService,
    private readonly eventBusService: EventBusService,
    private readonly localEmitter: LocalEmitterService,
    private readonly outboxWorker: OutboxWorkerService,
  ) {}

  @Get("dashboard")
  async getDashboardMetrics(@Req() request: RequestWithTenant, @Query('period') period?: string) {
    const { tenant_id } = request.tenantContext;
    const data = await this.adminService.getDashboardMetrics(tenant_id, period);
    
    // Maintain kpis structure for backward compatibility/simpler frontend mapping if needed
    // Fetch tenant currency for proper formatting
    const company = await this.adminService['prisma'].companies.findFirst({
      where: { tenant_id },
      select: { currency: true },
    });
    const currency = company?.currency || 'IDR';
    
    const formatRevenue = (amount: number, curr: string) => {
      if (curr === 'IDR') {
        if (amount >= 1_000_000_000) return `Rp ${(amount / 1_000_000_000).toFixed(1)}B`;
        if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(2)}M`;
        if (amount >= 1_000) return `Rp ${(amount / 1_000).toFixed(0)}K`;
        return `Rp ${amount.toFixed(0)}`;
      }
      return `$${(amount / 1_000_000).toFixed(2)}M`;
    };

    const kpis = [
      {
        label: "Revenue",
        value: formatRevenue(data.metrics.revenue, currency),
        delta: "Live DB Aggregate",
        icon: "Briefcase",
        trend: 'up'
      },
      {
        label: "Active Staff",
        value: data.metrics.activeStaff.toString(),
        delta: "Live DB Count",
        icon: "Users",
        trend: 'flat'
      },
      {
        label: "Alerts",
        value: data.metrics.alerts.toString(),
        delta: "Pending Review",
        icon: "AlertTriangle",
        trend: 'down'
      },
      {
        label: "Module Status",
        value: `${data.systemStatus.activeModules}/${data.systemStatus.totalModules}`,
        delta: "Active Services",
        icon: "ClipboardCheck",
        trend: 'up'
      },
    ];

    return {
      success: true,
      tenant_id,
      data: {
        ...data,
        kpis
      },
    };
  }

  @Get("dashboard/tactical")
  async getDashboardTactical(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const data = await this.adminService.getDashboardTactical(tenant_id);
    return {
      success: true,
      tenant_id,
      data
    };
  }

  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Get("modules")
  async getModules(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const data = await this.adminService.getModuleStatuses(tenant_id);
    return { success: true, tenant_id, count: data.length, data };
  }

  @Roles(UserRole.OWNER)
  @Put("modules/toggle")
  async toggleModule(
    @Req() request: RequestWithTenant,
    @Body() dto: ToggleModuleDto,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    return {
      success: true,
      tenant_id,
      message: "Module status updated",
      data: await this.adminService.toggleModule(tenant_id, dto, user_id),
    };
  }

  @Get("requests")
  async getRequests(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const data = await this.adminService.getRequests(tenant_id);
    return { success: true, tenant_id, count: data.length, data };
  }

  @Post("requests")
  async createRequest(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateAdminRequestDto,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    return {
      success: true,
      tenant_id,
      message: "Admin request created",
      data: await this.adminService.createRequest(tenant_id, dto, user_id),
    };
  }

  @Put("requests/:id/resolve")
  async resolveRequest(
    @Req() request: RequestWithTenant,
    @Param("id") request_id: string,
    @Body() body: { resolvedBy: string },
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    return {
      success: true,
      tenant_id,
      message: "Admin request resolved",
      data: await this.adminService.resolveRequest(
        tenant_id,
        request_id,
        user_id || body.resolvedBy || "system",
      ),
    };
  }

  @Get("audit-events")
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async getAuditEvents(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const data = await this.adminService.getAuditEvents(tenant_id);
    return { success: true, tenant_id, count: data.length, data };
  }

  /**
   * Proactive Integrity Check for a specific tenant
   */
  @Get("audit/verify/:tenant_id")
  @Roles(UserRole.SUPERADMIN)
  async verifyTenantAudit(@Param("tenant_id") tenantId: string) {
    const result = await this.auditChainService.verifyIntegrity(tenantId);
    return { success: true, tenant_id: tenantId, ...result };
  }

  /**
   * GET /v1/admin/audit/verify-integrity
   * Standardized integrity check for current tenant context.
   */
  @Get("audit/verify-integrity")
  @Roles(UserRole.SUPERADMIN, UserRole.OWNER)
  async verifyIntegrity(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const result = await this.auditChainService.verifyIntegrity(tenant_id);
    return { 
      success: true, 
      tenant_id, 
      status: result.status,
      verified_at: new Date().toISOString(),
      details: result.details,
      integrity_score: result.brokenCount === 0 ? 100 : Math.max(0, 100 - (result.brokenCount * 10))
    };
  }

  /**
   * GET /v1/admin/audit/verify-seal
   * Compatibility alias for verify-integrity
   */
  @Get("audit/verify-seal")
  async verifySeal(@Req() request: RequestWithTenant) {
    return this.verifyIntegrity(request);
  }

  /**
   * GET /v1/admin/events/stuck
   * List background events that are failed or pending for too long
   */
  @Get("events/stuck")
  @Roles(UserRole.SUPERADMIN, UserRole.OWNER)
  async getStuckEvents(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const stats = await this.eventBusService.getStuckEventsCount(tenant_id);
    const snapshot = await this.eventBusService.getFailedSnapshot(tenant_id);
    
    return { 
      success: true, 
      tenant_id, 
      metrics: stats,
      failed_snapshot: snapshot 
    };
  }

  /**
   * GET /v1/admin/events/local-metrics
   * Visibility into the in-memory local event fabric.
   */
  @Get("events/local-metrics")
  @Roles(UserRole.SUPERADMIN)
  async getLocalMetrics() {
    return {
      success: true,
      data: this.localEmitter.getMetrics()
    };
  }

  /**
   * POST /v1/admin/events/:id/retry
   * Manually trigger a retry for a specific event
   */
  @Post("events/:id/retry")
  @Roles(UserRole.SUPERADMIN, UserRole.OWNER)
  async retryEvent(
    @Req() request: RequestWithTenant,
    @Param("id") event_id: string,
  ) {
    const { tenant_id } = request.tenantContext;
    await this.eventBusService.replayEvent(tenant_id, event_id, true);
    return { success: true, tenant_id, message: "Event scheduled for retry" };
  }

  /**
   * GET /v1/admin/infra/outbox-status
   * Visibility into the Outbox Polling Worker.
   */
  @Get("infra/outbox-status")
  @Roles(UserRole.SUPERADMIN)
  async getOutboxStatus(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const summary = await this.outboxWorker.getOutboxSummary(tenant_id);
    return { success: true, tenant_id, data: summary };
  }

  /**
   * GET /v1/admin/sync/status
   * Heuristic reports synchronization health and latency
   */
  @Get("sync/status")
  async getSyncStatus(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const data = await this.adminService.getSyncStatus(tenant_id);
    return { success: true, tenant_id, data };
  }

  /**
   * GET /v1/admin/iot/devices
   * List of connected IoT devices and their current status
   */
  @Get("iot/devices")
  async getIotDevices(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const data = await this.adminService.getIotDevices(tenant_id);
    return { success: true, tenant_id, count: data.length, data };
  }

  /**
   * GET /v1/admin/audit/integrity-status
   * Formal alias for integrity verification — accessible by ADMIN and above.
   */
  @Get("audit/integrity-status")
  @Roles(UserRole.SUPERADMIN, UserRole.OWNER, UserRole.ADMIN)
  async getAuditIntegrityStatus(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const result = await this.auditChainService.verifyIntegrity(tenant_id);
    return {
      success: true,
      tenant_id,
      status: result.status,
      verified_at: new Date().toISOString(),
      details: result.details,
      integrity_score: result.brokenCount === 0 ? 100 : Math.max(0, 100 - (result.brokenCount * 10))
    };
  }

  /**
   * POST /v1/admin/invitations
   * Create a new administrative invitation with specialized Magic Link.
   */
  @Post("invitations")
  @Roles(UserRole.OWNER)
  async createInvitation(
    @Req() request: RequestWithTenant,
    @Body() dto: { email: string; role: string; justification?: string }
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const result = await this.adminService.createInvitation(tenant_id, dto, user_id || "SYSTEM");
    return {
      success: true,
      tenant_id,
      message: "Invitation link generated and logged.",
      data: result
    };
  }
}

