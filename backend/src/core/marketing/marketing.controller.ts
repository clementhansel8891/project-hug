import {
  Body,
  Controller,
  ForbiddenException,
  BadRequestException,
  Get,
  Param,
  Post,
  Put,
  Delete,
  Req,
  UseInterceptors,
  UseGuards,
  UploadedFile,
  Res,
  Query,
} from "@nestjs/common";
import { Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { existsSync, mkdirSync, unlinkSync } from "fs";
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
import { CaptureLeadDto } from "./dto/capture-lead.dto";
import { ConnectAccountDto } from "./dto/connect-account.dto";
import { CreateCampaignDto } from "./dto/create-campaign.dto";
import { CreateWorkflowDto } from "./dto/create-workflow.dto";
import { RunExecutionDto } from "./dto/run-execution.dto";
import { ScheduleExecutionDto } from "./dto/schedule-execution.dto";
import { UpdateAccountStatusDto } from "./dto/update-account-status.dto";
import { UpdateAccountSettingsDto } from "./dto/update-account-settings.dto";
import { UpdateCampaignStatusDto } from "./dto/update-campaign-status.dto";
import { UpdateWorkflowStatusDto } from "./dto/update-workflow-status.dto";
import { MarketingService } from "./marketing.service";
import { Customer360Service } from "./customer-360.service";
import { BookingService } from "./booking.service";
import { OmnichannelService } from "./omnichannel.service";
import { SocialSyncService } from "./social-sync.service";
import { PrismaService } from "../../persistence/prisma.service";
import { isModuleActive } from "../../shared/helpers/module-active.helper";
import { MultiTenancyUtil } from "../../shared/utils/multi-tenancy.util";

interface RequestWithTenant extends Request {
  tenantContext: TenantContext;
}

/**
 * Marketing Controller (Phase 4)
 *
 * Identity and scope are derived exclusively from the verified
 * `request.tenantContext` (populated by `TenantInterceptor` after the
 * JWT-bearing tenant middleware), never from client-supplied headers or body
 * fields (Requirements 2.1, 2.2, 2.5, 2.10). Each request resolves a validated
 * `TenantScope` via the shared `TenantScopeResolver` and passes that scope into
 * the Marketing service, which filters every read/write by the scope's
 * `tenant_id`. `RolesGuard` plus a `@Roles(...)` gate on every mutating handler
 * (create/update/transition/handoff/sync/upload) enforces role-based access
 * control; `ModuleStateGuard` rejects requests when the Marketing module is
 * inactive for the tenant (Requirements 3.1, 3.2, 3.5, 3.6).
 */
@Controller('marketing')
@UseInterceptors(TenantInterceptor)
@UseGuards(ModuleStateGuard, BranchGatingGuard, TenantGuard, RolesGuard)
@RequiredModule("marketing")
export class MarketingController {
  constructor(
    private readonly marketingService: MarketingService,
    private readonly prisma: PrismaService,
    private readonly customer360: Customer360Service,
    private readonly bookingService: BookingService,
    private readonly omnichannel: OmnichannelService,
    private readonly socialSync: SocialSyncService,
    private readonly scopeResolver: TenantScopeResolver,
  ) {}

  /**
   * Resolve the verified actor `user_id` from the tenant context, rejecting a
   * mutating request that carries no verified user identity (Requirements 2.3,
   * 2.10). Actor identity is never taken from a client-supplied `x-actor-id`
   * header nor a `"system"` fallback.
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
    const dashboardData = await this.marketingService.getDashboard(scope);

    const moduleContributions: any = {};
    if (await isModuleActive(this.prisma, scope.tenant_id, "retail")) {
      const walkInCustomers = await this.prisma.retail_orders.count({
        where: { ...MultiTenancyUtil.getScope(scope), customer_id: null },
      });
      const loyaltyMembers = await this.prisma.retail_orders.groupBy({
        by: ["customer_id"],
        where: { ...MultiTenancyUtil.getScope(scope), customer_id: { not: null } },
      });
      moduleContributions.retail = {
        walkInCustomers,
        loyaltyActive: loyaltyMembers.length,
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

  @Get("channel-performance")
  async getChannelPerformance(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.marketingService.getChannelPerformance(scope);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  @Get("campaigns")
  async getCampaigns(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.marketingService.getCampaigns(scope);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  @Post("campaigns")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async createCampaign(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateCampaignDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Campaign created",
      data: await this.marketingService.createCampaign(scope, dto, user_id),
    };
  }

  @Put("campaigns/:id/status")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async updateCampaignStatus(
    @Req() request: RequestWithTenant,
    @Param("id") campaignId: string,
    @Body() dto: UpdateCampaignStatusDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Campaign status updated",
      data: await this.marketingService.updateCampaignStatus(
        scope,
        campaignId,
        dto,
        user_id,
      ),
    };
  }

  @Get("executions")
  async getExecutions(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.marketingService.getExecutions(scope);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  @Post("executions")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async scheduleExecution(
    @Req() request: RequestWithTenant,
    @Body() dto: ScheduleExecutionDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Execution scheduled",
      data: await this.marketingService.scheduleExecution(scope, dto, user_id),
    };
  }

  @Put("executions/:id/run")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async runExecution(
    @Req() request: RequestWithTenant,
    @Param("id") executionId: string,
    @Body() dto: RunExecutionDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Execution update applied",
      data: await this.marketingService.runExecution(
        scope,
        executionId,
        dto,
        user_id,
      ),
    };
  }

  @Get("leads")
  async getLeads(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.marketingService.getLeads(scope);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  @Get("contacts")
  async getContacts(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.marketingService.getContacts(scope);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  @Post("leads")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async captureLead(
    @Req() request: RequestWithTenant,
    @Body() dto: CaptureLeadDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Lead captured",
      data: await this.marketingService.captureLead(scope, dto, user_id),
    };
  }

  @Put("leads/:id/handoff-ready")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async markLeadHandoffReady(
    @Req() request: RequestWithTenant,
    @Param("id") lead_id: string,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Lead marked handoff-ready",
      data: await this.marketingService.markLeadHandoffReady(
        scope,
        lead_id,
        user_id,
      ),
    };
  }

  @Put("leads/:id/handoff-sales")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async handoffLeadToSales(
    @Req() request: RequestWithTenant,
    @Param("id") lead_id: string,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Lead handed off to Sales",
      data: await this.marketingService.handoffLeadToSales(
        scope,
        lead_id,
        user_id,
      ),
    };
  }

  @Get("workflows")
  async getWorkflows(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.marketingService.getWorkflows(scope);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  @Post("workflows")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async createWorkflow(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateWorkflowDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Workflow created",
      data: await this.marketingService.createWorkflow(scope, dto, user_id),
    };
  }

  @Put("workflows/:id/status")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async updateWorkflowStatus(
    @Req() request: RequestWithTenant,
    @Param("id") workflowId: string,
    @Body() dto: UpdateWorkflowStatusDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Workflow status updated",
      data: await this.marketingService.updateWorkflowStatus(
        scope,
        workflowId,
        dto,
        user_id,
      ),
    };
  }

  @Get("accounts")
  async getAccounts(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.marketingService.getConnectedAccounts(scope);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  @Post("accounts")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async connectAccount(
    @Req() request: RequestWithTenant,
    @Body() dto: ConnectAccountDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Account connected",
      data: await this.marketingService.connectAccount(scope, dto, user_id),
    };
  }

  @Put("accounts/:id/status")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async updateAccountStatus(
    @Req() request: RequestWithTenant,
    @Param("id") accountId: string,
    @Body() dto: UpdateAccountStatusDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Account status updated",
      data: await this.marketingService.updateAccountStatus(
        scope,
        accountId,
        dto,
        user_id,
      ),
    };
  }

  @Put("accounts/:id/settings")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async updateAccountSettings(
    @Req() request: RequestWithTenant,
    @Param("id") accountId: string,
    @Body() dto: UpdateAccountSettingsDto,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Account configuration updated",
      data: await this.marketingService.updateAccountSettings(
        scope,
        accountId,
        dto,
        user_id,
      ),
    };
  }

  @Delete("accounts/:id")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async deleteAccount(
    @Req() request: RequestWithTenant,
    @Param("id") accountId: string,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    await this.marketingService.deleteAccount(scope, accountId, user_id);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Account decommissioned",
    };
  }

  @Post("accounts/:id/sync")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async triggerManualSync(
    @Req() request: RequestWithTenant,
    @Param("id") accountId: string,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    const result = await this.marketingService.triggerManualSync(
      scope,
      accountId,
      user_id,
    );
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Manual synchronization complete",
      data: result,
    };
  }

  @Get("attribution")
  async getAttribution(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.marketingService.getAttribution(scope);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  @Get("alerts")
  async getAlerts(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.marketingService.getAlerts(scope);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  @Put("alerts/:id/ack")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async acknowledgeAlert(
    @Req() request: RequestWithTenant,
    @Param("id") alertId: string,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Alert acknowledged",
      data: await this.marketingService.acknowledgeAlert(scope, alertId),
    };
  }

  @Post("health-sweep")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async runHealthSweep(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    const data = await this.marketingService.runHealthSweep(scope, user_id);
    return {
      success: true,
      tenant_id: scope.tenant_id,
      message: "Health sweep executed",
      count: data.length,
      data,
    };
  }

  @Get("audit-events")
  async getAuditEvents(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.marketingService.getAuditEvents(scope);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  // --- Growth Engine: Customer 360 ---

  @Get("customers/:id/profile")
  async getCustomerProfile(@Param("id") id: string, @Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.customer360.getUnifiedProfile(request.tenantContext, id);
    return { success: true, tenant_id: scope.tenant_id, data };
  }

  @Post("contacts/sync")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async syncContact(@Body() body: { type: "LEAD" | "RETAIL", id: string }, @Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.customer360.syncContactFromEntity(request.tenantContext, body.type, body.id);
    return { success: true, tenant_id: scope.tenant_id, data };
  }

  // --- Growth Engine: Appointments ---

  @Get("appointments")
  async getAppointments(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.bookingService.getAppointments(request.tenantContext);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  @Post("appointments")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async createAppointment(@Body() body: any, @Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.bookingService.createAppointment(request.tenantContext, body);
    return { success: true, tenant_id: scope.tenant_id, message: "Appointment created", data };
  }

  // --- Growth Engine: Omnichannel ---

  @Post("messages/send")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async sendMessage(@Body() body: { contactId: string, channel: string, content: string }, @Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.omnichannel.sendMessage(request.tenantContext, body.contactId, body.channel, body.content);
    return { success: true, tenant_id: scope.tenant_id, data };
  }

  @Get("channels/status")
  async getChannelStatus() {
    return { success: true, data: this.omnichannel.getChannelStatus() };
  }

  @Post("omnichannel/config")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async saveOmnichannelConfig(
    @Req() request: RequestWithTenant,
    @Body() body: { channel?: string; autoReply?: boolean; autoReplyMessage?: string; assignTo?: string; maxConcurrentChats?: number; businessHoursOnly?: boolean },
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    if (!body.channel) {
      throw new BadRequestException("channel is required");
    }
    const data = await this.omnichannel.saveConfig(request.tenantContext, body as any);
    return { success: true, tenant_id: scope.tenant_id, data };
  }

  @Get("omnichannel/config")
  async getOmnichannelConfig(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.omnichannel.getConfigs(request.tenantContext);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  // --- Growth Engine: Funnels ---

  @Get("funnels")
  async getFunnels(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.marketingService.getFunnels(scope);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  @Post("funnels")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async createFunnel(@Req() request: RequestWithTenant, @Body() body: any) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    const data = await this.marketingService.createFunnel(scope, body, user_id);
    return { success: true, tenant_id: scope.tenant_id, message: "Funnel created", data };
  }

  @Put("funnels/:id")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async updateFunnel(@Req() request: RequestWithTenant, @Param("id") id: string, @Body() body: any) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    const data = await this.marketingService.updateFunnel(scope, id, body, user_id);
    return { success: true, tenant_id: scope.tenant_id, message: "Funnel updated", data };
  }

  @Get("assets")
  async getCreativeAssets(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.marketingService.getCreativeAssets(scope);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  @Post("assets")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async createCreativeAsset(@Req() request: RequestWithTenant, @Body() body: any) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    const data = await this.marketingService.createCreativeAsset(scope, body, user_id);
    return { success: true, tenant_id: scope.tenant_id, message: "Asset created", data };
  }

  @Put("assets/:id")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async updateCreativeAsset(@Req() request: RequestWithTenant, @Param("id") id: string, @Body() body: any) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    const data = await this.marketingService.updateCreativeAsset(scope, id, body, user_id);
    return { success: true, tenant_id: scope.tenant_id, message: "Asset updated", data };
  }

  @Post("assets/upload")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = join(process.cwd(), "storage", "marketing", "assets");
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
          cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async uploadAsset(
    @Req() request: RequestWithTenant,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const user_id = this.requireActor(request);
    const assetData = {
      name: body.name || file.originalname,
      type: file.mimetype.startsWith("image") ? "IMAGE" : file.mimetype.startsWith("video") ? "VIDEO" : "DOCUMENT",
      url: `/api/v1/marketing/assets/raw/${file.filename}`,
      metadata: {
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
      },
    };
    // Store + register in one Atomic_Operation: the blob has already been
    // written to disk by the upload interceptor, so we register its record
    // inside a transaction and pass a compensating cleanup that deletes the
    // stored blob if that transaction rolls back. On failure neither an
    // orphaned blob nor an orphaned record remains (Req 11.7, 11.8).
    const storedPath = join(process.cwd(), "storage", "marketing", "assets", file.filename);
    const data = await this.marketingService.uploadCreativeAsset(
      scope,
      assetData,
      user_id,
      () => {
        if (existsSync(storedPath)) {
          unlinkSync(storedPath);
        }
      },
    );
    return { success: true, tenant_id: scope.tenant_id, message: "Asset uploaded and registered", data };
  }

  @Get("assets/raw/:filename")
  async getRawAsset(@Param("filename") filename: string, @Res() res: Response) {
    const filePath = join(process.cwd(), "storage", "marketing", "assets", filename);
    if (!existsSync(filePath)) {
      return res.status(404).send("File not found");
    }
    return res.sendFile(filePath);
  }

  @Get("conversations")
  async getConversations(@Req() request: RequestWithTenant) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.omnichannel.getConversations(request.tenantContext);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  @Get("messages")
  async getMessages(@Req() request: RequestWithTenant, @Query("conversationId") conversationId?: string) {
    const scope = await this.scopeResolver.resolve(request.tenantContext);
    const data = await this.omnichannel.getMessages(request.tenantContext, conversationId);
    return { success: true, tenant_id: scope.tenant_id, count: data.length, data };
  }

  // --- OAuth Callbacks ---
  //
  // OAuth callbacks and provider webhooks are external entry points (browser
  // redirects / provider callbacks). They are not role-gated: the caller is the
  // OAuth provider, not an authenticated platform user, so no `@Roles` gate is
  // applied. They still pass through the tenant interceptor/guard chain.

  @Get("oauth/callback/meta")
  async handleMetaCallback(
    @Req() request: RequestWithTenant,
    @Query("code") code: string,
    @Res() res: Response,
  ) {
    return this.completeOAuthCallback(res, "meta", () =>
      this.socialSync.handleMetaCallback(request.tenantContext, code),
    );
  }

  @Get("oauth/callback/google")
  async handleGoogleCallback(
    @Req() request: RequestWithTenant,
    @Query("code") code: string,
    @Res() res: Response,
  ) {
    return this.completeOAuthCallback(res, "google", () =>
      this.socialSync.handleGoogleCallback(request.tenantContext, code),
    );
  }

  @Get("oauth/callback/tiktok")
  async handleTikTokCallback(
    @Req() request: RequestWithTenant,
    @Query("code") code: string,
    @Res() res: Response,
  ) {
    return this.completeOAuthCallback(res, "tiktok", () =>
      this.socialSync.handleTikTokCallback(request.tenantContext, code),
    );
  }

  @Get("oauth/callback/youtube")
  async handleYoutubeCallback(
    @Req() request: RequestWithTenant,
    @Query("code") code: string,
    @Res() res: Response,
  ) {
    return this.completeOAuthCallback(res, "youtube", () =>
      this.socialSync.handleYoutubeCallback(request.tenantContext, code),
    );
  }

  /**
   * Drive an OAuth callback to a clean browser redirect. The social-sync service
   * already runs the callback under the async-rejection deadline guard, so it
   * resolves as a typed result and records both success and failure outcomes in
   * the Integration_Log (Req 11.10, 11.11). Here we translate that typed outcome
   * into a redirect: success → `status=success`, failure → `status=error`, so the
   * browser always lands on a clean page and no rejection escapes the boundary.
   */
  private async completeOAuthCallback(
    res: Response,
    provider: string,
    work: () => Promise<unknown>,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    try {
      await work();
      return res.redirect(
        `${frontendUrl}/marketing/accounts?status=success&provider=${provider}`,
      );
    } catch {
      // The failure outcome has already been recorded in the Integration_Log by
      // the async-rejection helper inside the service (Req 11.10); surface a
      // clean error redirect rather than an unhandled rejection / error page.
      return res.redirect(
        `${frontendUrl}/marketing/accounts?status=error&provider=${provider}`,
      );
    }
  }

  @Get("webhooks/meta")
  verifyMetaWebhook(
    @Query("hub.mode") mode: string,
    @Query("hub.verify_token") token: string,
    @Query("hub.challenge") challenge: string,
  ) {
    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
    if (mode === "subscribe" && token === verifyToken) {
      return challenge;
    }
    return "Verification failed";
  }

  @Post("webhooks/meta")
  async handleMetaWebhook(@Body() payload: any) {
    await this.omnichannel.processInboundWebhook(payload);
    return { success: true };
  }

  @Get("oauth/authorize/:provider")
  async getAuthUrl(
    @Req() request: RequestWithTenant,
    @Param("provider") provider: string,
  ) {
    const tenant_id = request.tenantContext.tenant_id;
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";

    if (provider === "meta") {
      const appId = process.env.META_APP_ID;
      const redirectUri = encodeURIComponent(`${backendUrl}/marketing/oauth/callback/meta`);
      const scopes = encodeURIComponent("ads_read,ads_management,leads_retrieval");
      return {
        url: `https://www.facebook.com/v17.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&state=${tenant_id}&scope=${scopes}`
      };
    } else if (provider === "google") {
      const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
      const redirectUri = encodeURIComponent(`${backendUrl}/marketing/oauth/callback/google`);
      const scopes = encodeURIComponent("https://www.googleapis.com/auth/adwords");
      return {
        url: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&state=${tenant_id}&response_type=code&scope=${scopes}&access_type=offline`
      };
    } else if (provider === "tiktok") {
      const clientId = process.env.TIKTOK_CLIENT_ID;
      const redirectUri = encodeURIComponent(`${backendUrl}/marketing/oauth/callback/tiktok`);
      const scopes = encodeURIComponent("user.info.basic,video.list,video.stats");
      return {
        url: `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientId}&redirect_uri=${redirectUri}&state=${tenant_id}&response_type=code&scope=${scopes}`
      };
    } else if (provider === "youtube") {
      const clientId = process.env.GOOGLE_ADS_CLIENT_ID; // Usually same project as Google Ads
      const redirectUri = encodeURIComponent(`${backendUrl}/marketing/oauth/callback/youtube`);
      const scopes = encodeURIComponent("https://www.googleapis.com/auth/youtube.readonly");
      return {
        url: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&state=${tenant_id}&response_type=code&scope=${scopes}&access_type=offline`
      };
    }

    return { url: null };
  }
}
