import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseInterceptors,
  UseGuards,
  Query,
} from "@nestjs/common";
import { Request } from "express";
import { TenantContext } from "../../gateway/tenant-context.interface";
import { TenantInterceptor } from "../../gateway/tenant.interceptor";
import { ModuleStateGuard } from "../auth/guards/module-state.guard";
import { BranchGatingGuard } from "../auth/guards/branch-gating.guard";
import { TenantGuard } from "../../shared/guards/tenant.guard";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { Roles } from "../../shared/decorators/roles.decorator";
import { UserRole } from "../../shared/roles";
import { RequiredModule } from "../../shared/decorators/required-module.decorator";
import { PrismaService } from "../../persistence/prisma.service";
import { TenantScopeResolver } from "../../shared/scope/tenant-scope.resolver";
import { CreateProvisioningRequestDto } from "./dto/create-provisioning-request.dto";
import { CreateDeviceDto, CreateDeviceEventDto } from "./dto/device.dto";
import {
  CreateTicketDto,
  UpdateTicketDto,
  EscalateTicketDto,
  ResolveTicketDto,
} from "./dto/ticket.dto";
import { CreateIncidentDto } from "./dto/incident.dto";
import { SlaConfigDto } from "./dto/sla-config.dto";
import { ITService } from "./it.service";

interface RequestWithTenant extends Request {
  tenantContext: TenantContext;
}

/**
 * IT Controller (Phase 1)
 *
 * Identity and scope are derived exclusively from the verified
 * `request.tenantContext` (populated by `TenantInterceptor` after the
 * JWT-bearing tenant middleware), never from client-supplied headers
 * (Requirements 2.10). Each mutating request resolves a validated
 * `TenantScope` via the shared `TenantScopeResolver` and passes the verified
 * `tenant_id` into the IT service. `RolesGuard` plus a `@Roles(...)` gate on
 * every mutating handler enforces role-based access control; `ModuleStateGuard`
 * rejects requests when the IT module is inactive for the tenant
 * (Requirements 3.1, 3.2, 3.5, 3.6).
 */
@Controller('it')
@UseInterceptors(TenantInterceptor)
@UseGuards(ModuleStateGuard, BranchGatingGuard, TenantGuard, RolesGuard)
@RequiredModule("it")
export class ITController {
  constructor(
    private readonly itService: ITService,
    private readonly prisma: PrismaService,
    private readonly scopeResolver: TenantScopeResolver,
  ) {}

  // ==================== Overview (Module-Aware) ====================

  /**
   * GET /it/overview
   * IT workspace overview — assembled from persisted, tenant-scoped data and
   * enriched with Retail POS/ecommerce contributions only when the Retail
   * Module_Activation_State is active for the tenant (Requirements 6.8, 6.9,
   * 6.10, 8.10, 8.11). All scoping and module-activation gating is performed in
   * the service/repository against persisted data.
   */
  @Get("overview")
  async getOverview(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.itService.getOverview(scope);

    return {
      success: true,
      tenant_id: scope.tenant_id,
      data,
    };
  }

  // ==================== Devices (NEW) ====================

  @Get("devices")
  async getDevices(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.itService.getDevices(scope);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  @Get("devices/:id")
  async getDevice(
    @Req() request: RequestWithTenant,
    @Param("id") device_id: string,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.itService.getDevice(scope, device_id);
    return { success: true, tenant_id: scope.tenant_id, data };
  }

  @Post("devices")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async createDevice(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateDeviceDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = request.tenantContext.user_id;
    return {
      success: true,
      data: await this.itService.createDevice(scope, dto, user_id),
    };
  }

  @Put("devices/:id")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async updateDevice(
    @Req() request: RequestWithTenant,
    @Param("id") device_id: string,
    @Body() dto: Partial<CreateDeviceDto>,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = request.tenantContext.user_id;
    return {
      success: true,
      data: await this.itService.updateDevice(
        scope,
        device_id,
        dto,
        user_id,
      ),
    };
  }

  // ==================== Device Events (NEW) ====================

  @Get("device-events")
  async getDeviceEvents(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.itService.getDeviceEvents(scope);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  @Post("device-events")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async createDeviceEvent(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateDeviceEventDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    return {
      success: true,
      data: await this.itService.createDeviceEvent(scope, dto),
    };
  }

  // ==================== Provisioning ====================

  @Get("provisioning")
  async getProvisioningRequests(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.itService.getProvisioningRequests(scope);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  @Post("provisioning")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async createProvisioningRequest(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateProvisioningRequestDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = request.tenantContext.user_id;
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Provisioning request created",
      data: await this.itService.createProvisioningRequest(
        scope,
        dto,
        user_id,
      ),
    };
  }

  @Put("provisioning/:id/provision")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async markProvisioned(
    @Req() request: RequestWithTenant,
    @Param("id") request_id: string,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    // Actor identity is the verified caller from the tenant context, never a
    // client-supplied `provisionedBy` value (Requirement 2.10). A mutating
    // request without a verified user identity is rejected (Requirement 2.3).
    const user_id = request.tenantContext.user_id;
    if (!user_id) {
      throw new ForbiddenException(
        "A verified user identity is required to provision a request.",
      );
    }
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Provisioning request marked as provisioned",
      data: await this.itService.markProvisioned(
        scope,
        request_id,
        user_id,
      ),
    };
  }

  @Put("provisioning/:id")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async updateProvisioningRequest(
    @Req() request: RequestWithTenant,
    @Param("id") request_id: string,
    @Body() dto: Partial<CreateProvisioningRequestDto>,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = request.tenantContext.user_id;
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Provisioning request updated",
      data: await this.itService.updateProvisioningRequest(
        scope,
        request_id,
        dto,
        user_id,
      ),
    };
  }

  @Delete("provisioning/:id")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async deleteProvisioningRequest(
    @Req() request: RequestWithTenant,
    @Param("id") request_id: string,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = request.tenantContext.user_id;
    await this.itService.deleteProvisioningRequest(
      scope,
      request_id,
      user_id,
    );
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Provisioning request deleted",
    };
  }

  @Get("system-health")
  async getSystemHealth(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.itService.getSystemHealth(scope);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  @Delete("devices/:id")
  @Roles(UserRole.ADMIN)
  async deleteDevice(
    @Req() request: RequestWithTenant,
    @Param("id") device_id: string,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    await this.prisma.it_devices.updateMany({
      where: { id: device_id, tenant_id: scope.tenant_id },
      data: { status: 'DECOMMISSIONED', updated_at: new Date() },
    });
    return { success: true, message: "Device decommissioned" };
  }

  @Get("topology")
  async getTopology(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    // Build topology from locations + devices
    const [locations, devices] = await Promise.all([
      this.prisma.locations.findMany({ where: { tenant_id: scope.tenant_id } }),
      this.prisma.it_devices.findMany({ where: { tenant_id: scope.tenant_id, status: { not: 'DECOMMISSIONED' } } }),
    ]);

    const nodes = locations.map((loc: any) => ({
      id: loc.id,
      type: 'LOCATION',
      name: loc.name,
      code: loc.code,
      devices: devices.filter((d: any) => d.location_id === loc.id),
    }));

    return { success: true, tenant_id: scope.tenant_id, data: { nodes, totalDevices: devices.length, totalLocations: locations.length } };
  }

  // ==================== Monitoring ====================

  @Get("monitoring/stats")
  async getMonitoringStats(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.itService.getMonitoringStats(scope);
    return { success: true, data };
  }

  @Get("monitoring/logs")
  async getAuditLogs(
    @Req() request: RequestWithTenant,
    @Query("request_id") request_id?: string
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.itService.getAuditLogs(scope, request_id);
    return { success: true, count: data.length, data };
  }

  // ==================== IT Service Management: Tickets ====================

  @Get("tickets")
  async getTickets(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.itService.getTickets(scope);
    return { success: true, count: data.length, data };
  }

  @Post("tickets")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async createTicket(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateTicketDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.itService.createTicket(scope, dto, request.tenantContext.user_id);
    return { success: true, data };
  }

  // Static POST routes declared BEFORE the :id param routes so "escalate"
  // and "resolve" are never captured as a ticket id.
  @Post("tickets/escalate")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async escalateTicket(
    @Req() request: RequestWithTenant,
    @Body() dto: EscalateTicketDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.itService.escalateTicket(scope, dto, request.tenantContext.user_id);
    return { success: true, data };
  }

  @Post("tickets/resolve")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async resolveTicket(
    @Req() request: RequestWithTenant,
    @Body() dto: ResolveTicketDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.itService.resolveTicket(scope, dto, request.tenantContext.user_id);
    return { success: true, data };
  }

  @Get("tickets/:id")
  async getTicket(@Req() request: RequestWithTenant, @Param("id") id: string) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.itService.getTicket(scope, id);
    return { success: true, data };
  }

  @Patch("tickets/:id")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async updateTicket(
    @Req() request: RequestWithTenant,
    @Param("id") id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.itService.updateTicket(scope, id, dto, request.tenantContext.user_id);
    return { success: true, data };
  }

  // ==================== IT Service Management: Incidents ====================

  @Get("incidents")
  async getIncidents(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.itService.getIncidents(scope);
    return { success: true, count: data.length, data };
  }

  @Post("incidents")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async createIncident(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateIncidentDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.itService.createIncident(scope, dto, request.tenantContext.user_id);
    return { success: true, data };
  }

  // ==================== IT Service Management: SLA Config ====================

  @Get("sla-config")
  async getSlaConfigs(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.itService.getSlaConfigs(scope);
    return { success: true, count: data.length, data };
  }

  @Post("sla-config")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async upsertSlaConfig(
    @Req() request: RequestWithTenant,
    @Body() dto: SlaConfigDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.itService.upsertSlaConfig(scope, dto, request.tenantContext.user_id);
    return { success: true, data };
  }
}

