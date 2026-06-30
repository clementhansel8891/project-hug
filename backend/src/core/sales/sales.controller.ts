import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseInterceptors,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { TenantContext } from "../../gateway/tenant-context.interface";
import { TenantInterceptor } from "../../gateway/tenant.interceptor";
import { ModuleStateGuard } from "../auth/guards/module-state.guard";
import { BranchGatingGuard } from "../auth/guards/branch-gating.guard";
import { RequiredModule } from "../../shared/decorators/required-module.decorator";
import { TenantGuard } from "../../shared/guards/tenant.guard";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { Roles } from "../../shared/decorators/roles.decorator";
import { UserRole } from "../../shared/roles";
import { TenantScopeResolver } from "../../shared/scope/tenant-scope.resolver";
import { CloseOpportunityDto } from "./dto/close-opportunity.dto";
import { CreateOrderDto } from "./dto/create-order.dto";
import { CreateIncentivePlanDto as CreateSalesIncentivePlanDto } from "./dto/create-incentive-plan.dto";
import { CreateLeadDto } from "./dto/create-lead.dto";
import { CreateOpportunityDto } from "./dto/create-opportunity.dto";
import { CreateQuoteDto } from "./dto/create-quote.dto";
import { CreateTaskDto } from "./dto/create-task.dto";
import { CreateTimelineEventDto } from "./dto/create-timeline-event.dto";
import { MoveOpportunityStageDto } from "./dto/move-opportunity-stage.dto";
import { QuoteDecisionDto } from "./dto/quote-decision.dto";
import { UpdateLeadStatusDto } from "./dto/update-lead-status.dto";
import { SalesService } from "./sales.service";
import { IncentivesService } from "../incentives/incentives.service";
import { PrismaService } from "../../persistence/prisma.service";
import { isModuleActive } from "../../shared/helpers/module-active.helper";

interface RequestWithTenant extends Request {
  tenantContext: TenantContext;
}

/**
 * Sales Controller (Phase 3)
 *
 * Identity and scope are derived exclusively from the verified
 * `request.tenantContext` (populated by `TenantInterceptor` after the
 * JWT-bearing tenant middleware), never from client-supplied headers or body
 * fields (Requirements 2.1, 2.2, 2.5, 2.10). Each request resolves a validated
 * `TenantScope` via the shared `TenantScopeResolver` and passes that scope into
 * the Sales service, which filters every read/write by the scope's `tenant_id`.
 * `RolesGuard` plus a `@Roles(...)` gate on every mutating handler
 * (create/update/convert/stage/close/submit/decide/complete/sweep) enforces
 * role-based access control; `ModuleStateGuard` rejects requests when the Sales
 * module is inactive for the tenant (Requirements 3.1, 3.2, 3.5, 3.6).
 */
@Controller('sales')
@UseInterceptors(TenantInterceptor)
@UseGuards(ModuleStateGuard, BranchGatingGuard, TenantGuard, RolesGuard)
@RequiredModule("sales")
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    private readonly prisma: PrismaService,
    private readonly scopeResolver: TenantScopeResolver,
    private readonly incentivesService: IncentivesService,
  ) {}

  /**
   * Resolve the verified actor `user_id` from the tenant context, rejecting a
   * mutating request that carries no verified user identity (Requirements 2.3,
   * 2.10). Actor identity is never taken from a client-supplied header nor a
   * `"system"` fallback.
   */
  private requireActor(request: RequestWithTenant): string {
    const user_id = request.tenantContext.user_id;
    if (!user_id) {
      throw new ForbiddenException(
        "A verified user identity is required to perform this action.",
      );
    }
    return user_id;
  }

  @Get("dashboard")
  async getDashboard(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const dashboardData = await this.salesService.getDashboard(scope);

    // Core Module Integration: Retail Contributions (Requirements 10.9, 10.10,
    // 6.8, 6.9, 6.10). Retail revenue and order counts are contributed ONLY
    // when the Retail Module_Activation_State is active for the tenant; when
    // inactive the dashboard is returned without retail contributions and
    // without error. Every value is read from persisted, tenant-scoped
    // `retail_orders` data — no placeholder/mock/hardcoded values.
    const moduleContributions: { retail?: { retailRevenue: number; retailOrders: number } } = {};
    if (await isModuleActive(this.prisma, scope.tenant_id, "retail")) {
      // Scope only by the columns `retail_orders` actually carries
      // (`tenant_id`, optional `company_id`) so reusing the resolved scope
      // across a table with different scope columns never produces an invalid
      // query (Requirement 10.10 — success without error).
      const retailScope: { tenant_id: string; company_id?: string } = {
        tenant_id: scope.tenant_id,
      };
      if (scope.company_id) retailScope.company_id = scope.company_id;

      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const [retailRevenueAgg, retailOrders] = await Promise.all([
        this.prisma.retail_orders.aggregate({
          where: {
            ...retailScope,
            status: { in: ["COMPLETED", "PAID", "complete", "paid"] },
            created_at: { gte: startOfWeek },
          },
          _sum: { total_amount: true },
        }),
        this.prisma.retail_orders.count({
          where: {
            ...retailScope,
            created_at: { gte: startOfWeek },
          },
        }),
      ]);

      moduleContributions.retail = {
        retailRevenue: retailRevenueAgg._sum.total_amount?.toNumber() || 0,
        retailOrders,
      };
    }

    return {
      success: true,
      tenant_id: scope.tenant_id,
      data: {
        ...dashboardData,
        moduleContributions,
      },
    };
  }

  @Get("manager-metrics")
  async getManagerMetrics(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      data: await this.salesService.getManagerMetrics(scope),
    };
  }

  @Get("executive-forecast")
  async getExecutiveForecast(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      data: await this.salesService.getExecutiveForecast(scope),
    };
  }

  @Get("nba")
  async getNextBestActions(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      data: await this.salesService.getNextBestActions(scope),
    };
  }

  @Get("forecast")
  async getForecast(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      data: await this.salesService.getForecast(scope),
    };
  }

  @Get("analytics")
  async getAnalytics(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      data: await this.salesService.getSalesAnalytics(scope),
    };
  }

  @Get("leads")
  async getLeads(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.salesService.getLeads(scope);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  @Get("pipeline")
  async getPipeline(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.salesService.getPipeline(scope);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  @Post("leads")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async createLead(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateLeadDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Lead created",
      data: await this.salesService.createLead(scope, dto, user_id),
    };
  }

  @Put("leads/:id/status")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async updateLeadStatus(
    @Req() request: RequestWithTenant,
    @Param("id") lead_id: string,
    @Body() dto: UpdateLeadStatusDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Lead status updated",
      data: await this.salesService.updateLeadStatus(
        scope,
        lead_id,
        dto,
        user_id,
      ),
    };
  }

  @Post("leads/:id/convert")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async convertLead(
    @Req() request: RequestWithTenant,
    @Param("id") lead_id: string,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Lead converted to opportunity",
      data: await this.salesService.convertLead(scope, lead_id, user_id),
    };
  }

  @Get("opportunities")
  async getOpportunities(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.salesService.getOpportunities(scope);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  @Post("opportunities")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async createOpportunity(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateOpportunityDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Opportunity created",
      data: await this.salesService.createOpportunity(scope, dto, user_id),
    };
  }

  @Put("opportunities/:id/stage")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async moveOpportunityStage(
    @Req() request: RequestWithTenant,
    @Param("id") opportunityId: string,
    @Body() dto: MoveOpportunityStageDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Opportunity stage updated",
      data: await this.salesService.moveOpportunityStage(
        scope,
        opportunityId,
        dto,
        user_id,
      ),
    };
  }

  @Put("opportunities/:id/close")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async closeOpportunity(
    @Req() request: RequestWithTenant,
    @Param("id") opportunityId: string,
    @Body() dto: CloseOpportunityDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Opportunity close operation complete",
      data: await this.salesService.closeOpportunity(
        scope,
        opportunityId,
        dto,
        user_id,
      ),
    };
  }

  @Get("quotes")
  async getQuotes(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.salesService.getQuotes(scope);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  @Post("quotes")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async createQuote(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateQuoteDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Quote created",
      data: await this.salesService.createQuote(scope, dto, user_id),
    };
  }

  @Put("quotes/:id/submit")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async submitQuote(
    @Req() request: RequestWithTenant,
    @Param("id") quoteId: string,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Quote submitted for approval",
      data: await this.salesService.submitQuote(scope, quoteId, user_id),
    };
  }

  @Put("quotes/:id/decision")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async decideQuote(
    @Req() request: RequestWithTenant,
    @Param("id") quoteId: string,
    @Body() dto: QuoteDecisionDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Quote decision recorded",
      data: await this.salesService.decideQuote(scope, quoteId, dto, user_id),
    };
  }

  @Get("timeline")
  async getTimeline(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.salesService.getTimeline(scope);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  @Post("timeline")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async createTimelineEvent(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateTimelineEventDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Timeline event created",
      data: await this.salesService.createTimelineEvent(scope, dto, user_id),
    };
  }

  @Get("tasks")
  async getTasks(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.salesService.getTasks(scope);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  @Post("tasks")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async createTask(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateTaskDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Task created",
      data: await this.salesService.createTask(scope, dto, user_id),
    };
  }

  @Put("tasks/:id/done")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async completeTask(
    @Req() request: RequestWithTenant,
    @Param("id") taskId: string,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Task marked done",
      data: await this.salesService.completeTask(scope, taskId, user_id),
    };
  }

  @Get("orders")
  async getOrders(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.salesService.getOrders(scope);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  // Convert a won opportunity into a sales order (CreateOrderModal → POST orders).
  // Delegates to the atomic close-won pipeline so the opportunity is closed WON
  // and the order is created together with audit/outbox/incentive side effects.
  @Post("orders")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async createOrder(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateOrderDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    const data = await this.salesService.closeOpportunity(
      scope,
      dto.opportunityId,
      {
        result: "won",
        quoteId: dto.quotationId,
        reason: dto.notes,
        actor_id: user_id,
      },
      user_id,
    );
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Opportunity closed as WON and Sales Order initialized",
      data,
    };
  }

  // Create a sales incentive plan (IncentiveConfigModal → POST incentives/plans).
  // The modal conflates plan + reward rule, so we create the plan (tenant/company
  // derived from the authenticated context, never client body) and a default
  // GLOBAL rule capturing the reward type/value. Runs under the sales module's
  // TenantGuard + RolesGuard, unlike the bare /incentives controller.
  @Post("incentives/plans")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async createIncentivePlan(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateSalesIncentivePlanDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);

    const plan = await this.incentivesService.createPlan({
      name: dto.name,
      description: dto.description,
      tenant_id: scope.tenant_id,
      company_id: scope.company_id,
      is_active: dto.isActive ?? true,
      start_date: new Date(dto.startDate),
      end_date: dto.endDate ? new Date(dto.endDate) : undefined,
      conflict_strategy: "PRIORITY",
    } as any);

    // Map the modal's reward type to the rule's base_type and persist a single
    // GLOBAL rule so the configured reward value is not lost.
    const baseType =
      dto.type === "FIXED"
        ? "FIXED_AMOUNT"
        : dto.type === "TIERED"
          ? "SLIDING_SCALE"
          : "PERCENTAGE";
    await this.incentivesService.createRule({
      plan_id: plan.id,
      priority: 0,
      dimension: "GLOBAL",
      base_type: baseType,
      value: dto.value,
    } as any);

    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Incentive plan created",
      data: plan,
    };
  }

  @Get("alerts")
  async getAlerts(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.salesService.getAlerts(scope);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  @Put("alerts/:id/ack")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async acknowledgeAlert(@Req() request: RequestWithTenant, @Param('id') id: string) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    await this.prisma.sales_alerts.updateMany({
      where: { id, tenant_id: scope.tenant_id },
      data: { acknowledged: true, updated_at: new Date() },
    });
    return { success: true, id, acknowledged: true };
  }

  @Put("quotes/:id/send")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async sendQuoteToCustomer(@Req() request: RequestWithTenant, @Param('id') id: string) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    await this.prisma.sales_quotes.updateMany({
      where: { id, tenant_id: scope.tenant_id },
      data: { status: 'SENT', updated_at: new Date() },
    });
    return { success: true, id, status: 'SENT' };
  }

  @Post("leads/sync-marketing")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async syncLeadFromMarketing(@Req() request: RequestWithTenant, @Body() dto: any) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    // Create a lead from marketing data
    const lead = await this.salesService.createLead(scope, {
      ...dto,
      source: 'MARKETING_SYNC',
    }, user_id);
    return { success: true, tenant_id: scope.tenant_id, data: lead };
  }

  @Post("sla-sweep")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async runSlaSweep(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    const data = await this.salesService.runSlaSweep(scope, user_id);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "SLA sweep executed",
      count: data.length,
      data,
    };
  }

  @Get("audit-events")
  async getAuditEvents(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.salesService.getAuditEvents(scope);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }
}
