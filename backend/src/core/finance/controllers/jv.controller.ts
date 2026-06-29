import {
  Controller, Get, Post, Patch, Body, Query, Param,
  UseGuards, Inject, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TenantGuard } from '../../../shared/guards/tenant.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { UserRole } from '../../../shared/roles';
import { TenantCtx } from '../../../gateway/tenant-context.decorator';
import { TenantContext } from '../../../gateway/tenant-context.interface';
import { IJVRepository } from '../repositories/interfaces/jv.repository.interface';
import { PrismaService } from '../../../persistence/prisma.service';
import { JVReportingService } from '../services/jv-reporting.service';
import { JVExpenseService, CreateJVExpenseDto, ApproveExpenseDto, RejectExpenseDto } from '../services/jv-expense.service';
import { JVSettlementService, GenerateSettlementDto, ConfirmSettlementDto, MarkPaidDto, DisputeSettlementDto } from '../services/jv-settlement.service';
import { JVPermissionService, SetPermissionDto, BulkPermissionDto } from '../services/jv-permission.service';
import { JVModule } from '../../../gateway/jv-module.decorator';

@Controller('finance/jv')
@UseGuards(TenantGuard, RolesGuard)
export class JVController {
  constructor(
    @Inject('IJVRepository') private readonly jvRepo: IJVRepository,
    private readonly prisma: PrismaService,
    private readonly reportingService: JVReportingService,
    private readonly expenseService: JVExpenseService,
    private readonly settlementService: JVSettlementService,
    private readonly permissionService: JVPermissionService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CORE JV READS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('ledger')
  async getLedger(@TenantCtx() ctx: TenantContext) {
    return this.jvRepo.getLedgerEntries(ctx.tenant_id, {});
  }

  @Get('settlement-summary')
  async getSettlementSummary(@TenantCtx() ctx: TenantContext) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const participations = await this.jvRepo.findParticipation(ctx.tenant_id, "");

    const settlements = await Promise.all(participations.map(async (p) => {
      const summary = await this.reportingService.getParticipantMTD(ctx.tenant_id, p.id, month, year);
      return {
        participant_name: p.jv_profiles?.name || 'Unknown Partner',
        participant_tenant_id: p.participant_tenant_id,
        gross_revenue: summary.debits,
        cost_burden: summary.credits,
        net_payable: summary.total_allocated,
      };
    }));

    return settlements;
  }

  @Get('profiles')
  async getProfiles(@TenantCtx() ctx: TenantContext) {
    return this.jvRepo.findProfileByScope(ctx.tenant_id, {});
  }

  @Get('profiles/:id')
  async getProfileDetail(@TenantCtx() ctx: TenantContext, @Param('id') id: string) {
    const profile = await this.prisma.finance_jv_profiles.findFirst({
      where: { id, tenant_id: ctx.tenant_id },
      include: {
        participants: true,
        scopes: true,
        invitations: { where: { status: 'PENDING' } },
      },
    });
    if (!profile) throw new BadRequestException('Profile not found.');
    return profile;
  }

  @Get('participations')
  async getParticipations(@TenantCtx() ctx: TenantContext) {
    return this.jvRepo.findParticipation(ctx.tenant_id, "");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // JV PROFILE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('profiles')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async createProfile(@TenantCtx() ctx: TenantContext, @Body() dto: any) {
    const profile = await this.prisma.finance_jv_profiles.create({
      data: {
        tenant_id: ctx.tenant_id,
        company_id: dto.company_id || ctx.company_id,
        name: dto.name,
        code: dto.code,
        effective_from: dto.effective_from ? new Date(dto.effective_from) : new Date(),
        effective_to: dto.effective_to ? new Date(dto.effective_to) : undefined,
      },
    });

    // Create scope if provided
    if (dto.scope) {
      await this.prisma.finance_jv_scopes.create({
        data: {
          jv_profile_id: profile.id,
          company_id: dto.scope.company_id,
          branch_id: dto.scope.branch_id,
          ecommerce_id: dto.scope.ecommerce_id,
        },
      });
    }

    // Log activity
    await this.logActivity(ctx, profile.id, 'PROFILE_CREATED', 'profile', profile.id);

    return profile;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INVITATION FLOW
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('invite')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async invitePartner(@TenantCtx() ctx: TenantContext, @Body() dto: any) {
    const token = randomUUID();
    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + 7);

    const invitation = await this.prisma.finance_jv_invitations.create({
      data: {
        jv_profile_id: dto.jv_profile_id,
        email: dto.email,
        token,
        role: dto.role || 'NON_OPERATOR',
        revenue_share: dto.revenue_share || 0,
        profit_share: dto.profit_share || 0,
        expires_at,
      },
    });

    await this.logActivity(ctx, dto.jv_profile_id, 'PARTNER_INVITED', 'invitation', invitation.id, {
      email: dto.email,
      role: dto.role,
    });

    return invitation;
  }

  @Post('accept-invite')
  async acceptInvite(@TenantCtx() ctx: TenantContext, @Body() dto: { token: string }) {
    const invite = await this.prisma.finance_jv_invitations.findUnique({
      where: { token: dto.token, status: 'PENDING' },
    });

    if (!invite) throw new BadRequestException("Invalid or expired invitation");
    if (new Date() > invite.expires_at) throw new BadRequestException("Invitation has expired");

    // Create Participant
    const participant = await this.prisma.finance_jv_participants.create({
      data: {
        jv_profile_id: invite.jv_profile_id,
        participant_tenant_id: ctx.tenant_id,
        revenue_share_pct: invite.revenue_share,
        profit_share_pct: invite.profit_share,
        role: invite.role,
      },
    });

    // Initialize permissions based on role
    await this.permissionService.initializeDefaults(participant.id, invite.role);

    // Mark accepted
    await this.prisma.finance_jv_invitations.update({
      where: { id: invite.id },
      data: { status: 'ACCEPTED' },
    });

    await this.logActivity(ctx, invite.jv_profile_id, 'INVITATION_ACCEPTED', 'participant', participant.id);

    return { participant, status: 'ACCEPTED' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERMISSION MANAGEMENT (Host controls partner access)
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('permissions/:participantId')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async getPermissions(@Param('participantId') participantId: string) {
    return this.permissionService.getPermissions(participantId);
  }

  @Post('permissions')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async setPermission(@TenantCtx() ctx: TenantContext, @Body() dto: SetPermissionDto) {
    const result = await this.permissionService.setPermission(dto);
    await this.logActivity(ctx, '', 'PERMISSION_CHANGED', 'permission', dto.participant_id, {
      module: dto.module,
      access_level: dto.access_level,
    });
    return result;
  }

  @Post('permissions/bulk')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async setBulkPermissions(@TenantCtx() ctx: TenantContext, @Body() dto: BulkPermissionDto) {
    return this.permissionService.setBulkPermissions(dto);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPENSES (Both parties can submit, counterparty approves)
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('expenses')
  @JVModule('expenses')
  async listExpenses(
    @TenantCtx() ctx: TenantContext,
    @Query('profile_id') profileId: string,
    @Query('status') status?: string,
  ) {
    if (!profileId) throw new BadRequestException('profile_id query param required');
    return this.expenseService.listExpenses(ctx.tenant_id, profileId, { status });
  }

  @Post('expenses')
  @JVModule('expenses')
  async createExpense(@TenantCtx() ctx: TenantContext, @Body() dto: CreateJVExpenseDto) {
    const submitterTenant = ctx.jv_home_tenant_id || ctx.tenant_id;
    const expense = await this.expenseService.createExpense(
      ctx.tenant_id,
      submitterTenant,
      ctx.user_id!,
      dto,
    );

    await this.logActivity(ctx, dto.jv_profile_id, 'EXPENSE_SUBMITTED', 'expense', expense.id, {
      amount: dto.amount,
      description: dto.description,
    });

    return expense;
  }

  @Post('expenses/approve')
  @JVModule('expenses')
  async approveExpense(@TenantCtx() ctx: TenantContext, @Body() dto: ApproveExpenseDto) {
    const approverTenant = ctx.jv_home_tenant_id || ctx.tenant_id;
    const result = await this.expenseService.approveExpense(
      ctx.tenant_id,
      approverTenant,
      ctx.user_id!,
      dto,
    );

    await this.logActivity(ctx, '', 'EXPENSE_APPROVED', 'expense', dto.expense_id);
    return result;
  }

  @Post('expenses/reject')
  @JVModule('expenses')
  async rejectExpense(@TenantCtx() ctx: TenantContext, @Body() dto: RejectExpenseDto) {
    const rejectorTenant = ctx.jv_home_tenant_id || ctx.tenant_id;
    return this.expenseService.rejectExpense(
      ctx.tenant_id,
      rejectorTenant,
      ctx.user_id!,
      dto,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SETTLEMENTS (Periodic reconciliation + payment tracking)
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('settlements')
  async listSettlements(
    @TenantCtx() ctx: TenantContext,
    @Query('profile_id') profileId: string,
    @Query('status') status?: string,
  ) {
    if (!profileId) throw new BadRequestException('profile_id query param required');
    return this.settlementService.listSettlements(ctx.tenant_id, profileId, status);
  }

  @Get('settlements/:id')
  async getSettlementDetail(@TenantCtx() ctx: TenantContext, @Param('id') id: string) {
    return this.settlementService.getSettlementDetail(ctx.tenant_id, id);
  }

  @Post('settlements/generate')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async generateSettlement(@TenantCtx() ctx: TenantContext, @Body() dto: GenerateSettlementDto) {
    const result = await this.settlementService.generateSettlement(ctx.tenant_id, ctx.user_id!, dto);
    await this.logActivity(ctx, dto.jv_profile_id, 'SETTLEMENT_GENERATED', 'settlement', result!.id);
    return result;
  }

  @Post('settlements/confirm')
  async confirmSettlement(@TenantCtx() ctx: TenantContext, @Body() dto: ConfirmSettlementDto) {
    const callerTenantId = ctx.jv_home_tenant_id || ctx.tenant_id;
    const result = await this.settlementService.confirmSettlement(ctx.tenant_id, ctx.user_id!, callerTenantId, dto);
    await this.logActivity(ctx, '', 'SETTLEMENT_CONFIRMED', 'settlement', dto.settlement_id, {
      host_confirmed: result.host_confirmed,
      partner_confirmed: result.partner_confirmed,
    });
    return result;
  }

  @Post('settlements/paid')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async markPaid(@TenantCtx() ctx: TenantContext, @Body() dto: MarkPaidDto) {
    return this.settlementService.markPaid(ctx.tenant_id, dto);
  }

  @Post('settlements/dispute')
  async disputeSettlement(@TenantCtx() ctx: TenantContext, @Body() dto: DisputeSettlementDto) {
    return this.settlementService.disputeSettlement(ctx.tenant_id, dto);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPLIT CONFIGURATION (Manual — both parties must agree)
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('split-status')
  async getSplitStatus(@Query('profile_id') profileId: string) {
    if (!profileId) throw new BadRequestException('profile_id required');
    return this.settlementService.getSplitStatus(profileId);
  }

  @Post('split/propose')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async proposeSplit(@TenantCtx() ctx: TenantContext, @Body() dto: any) {
    const result = await this.settlementService.proposeSplit(ctx.tenant_id, ctx.user_id!, dto);
    await this.logActivity(ctx, dto.jv_profile_id, 'SPLIT_PROPOSED', 'profile', dto.jv_profile_id, {
      splits: dto.splits,
    });
    return result;
  }

  @Post('split/confirm')
  async confirmSplit(@TenantCtx() ctx: TenantContext, @Body() dto: any) {
    const callerTenantId = ctx.jv_home_tenant_id || ctx.tenant_id;
    const result = await this.settlementService.confirmSplit(callerTenantId, ctx.user_id!, dto);
    await this.logActivity(ctx, dto.jv_profile_id, 'SPLIT_CONFIRMED', 'profile', dto.jv_profile_id, {
      all_confirmed: result.all_confirmed,
    });
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // JV P&L REPORTING
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('pnl')
  async getJVPnL(
    @TenantCtx() ctx: TenantContext,
    @Query('profile_id') profileId: string,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    if (!profileId) throw new BadRequestException('profile_id required');

    const m = parseInt(month) || (new Date().getMonth() + 1);
    const y = parseInt(year) || new Date().getFullYear();

    const profile = await this.prisma.finance_jv_profiles.findFirst({
      where: { id: profileId, tenant_id: ctx.tenant_id },
      include: { participants: true },
    });

    if (!profile) throw new BadRequestException('Profile not found');

    // Build P&L for each participant
    const periodStart = new Date(y, m - 1, 1);
    const periodEnd = new Date(y, m, 0, 23, 59, 59);

    // Revenue from shadow ledger
    const ledgerEntries = await this.prisma.finance_jv_ledger.findMany({
      where: {
        tenant_id: ctx.tenant_id,
        jv_profile_id: profileId,
        created_at: { gte: periodStart, lte: periodEnd },
      },
    });

    // Expenses
    const expenses = await this.prisma.finance_jv_expense_allocations.findMany({
      where: {
        expense: {
          tenant_id: ctx.tenant_id,
          jv_profile_id: profileId,
          status: 'APPROVED',
          expense_date: { gte: periodStart, lte: periodEnd },
        },
      },
    });

    // Build per-participant P&L
    const pnl: any[] = [];

    for (const p of profile.participants) {
      const revenue = ledgerEntries
        .filter(e => e.participant_id === p.participant_tenant_id && (e.type === 'REVENUE' || e.type === 'PROFIT'))
        .reduce((sum, e) => sum + Number(e.allocated_amt), 0);

      const costs = ledgerEntries
        .filter(e => e.participant_id === p.participant_tenant_id && e.type === 'COST')
        .reduce((sum, e) => sum + Number(e.allocated_amt), 0);

      const expenseBurden = expenses
        .filter(e => e.tenant_id === p.participant_tenant_id)
        .reduce((sum, e) => sum + Number(e.amount), 0);

      pnl.push({
        participant_id: p.id,
        participant_tenant_id: p.participant_tenant_id,
        role: p.role,
        revenue_share_pct: Number(p.revenue_share_pct),
        profit_share_pct: Number(p.profit_share_pct),
        revenue_allocated: revenue,
        cost_allocated: costs,
        expense_burden: expenseBurden,
        net_profit: revenue - costs - expenseBurden,
      });
    }

    // Host's share (remainder)
    const totalPartnerRevenue = pnl.reduce((s, p) => s + p.revenue_allocated, 0);
    const totalPartnerCosts = pnl.reduce((s, p) => s + p.cost_allocated, 0);
    const totalPartnerExpenses = pnl.reduce((s, p) => s + p.expense_burden, 0);

    const totalRevenue = ledgerEntries
      .filter(e => e.type === 'REVENUE' || e.type === 'PROFIT')
      .reduce((sum, e) => sum + Number(e.allocated_amt), 0);

    // Total JV revenue is the gross before allocation
    // Host's share = gross - what was allocated to partners
    const hostExpenses = expenses
      .filter(e => e.participant_id === 'HOST')
      .reduce((sum, e) => sum + Number(e.amount), 0);

    return {
      period: { month: m, year: y },
      profile: { id: profile.id, name: profile.name, code: profile.code },
      participants: pnl,
      host: {
        tenant_id: profile.tenant_id,
        expense_burden: hostExpenses,
      },
      totals: {
        total_allocated_revenue: totalPartnerRevenue,
        total_allocated_costs: totalPartnerCosts,
        total_expenses: totalPartnerExpenses + hostExpenses,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIVITY LOG
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('activity')
  async getActivityLog(
    @TenantCtx() ctx: TenantContext,
    @Query('profile_id') profileId: string,
    @Query('limit') limit?: string,
  ) {
    return this.prisma.finance_jv_activity_log.findMany({
      where: {
        tenant_id: ctx.tenant_id,
        ...(profileId ? { jv_profile_id: profileId } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: parseInt(limit || '50'),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async logActivity(
    ctx: TenantContext,
    profileId: string,
    action: string,
    entityType: string,
    entityId?: string,
    details?: any,
  ) {
    try {
      await this.prisma.finance_jv_activity_log.create({
        data: {
          tenant_id: ctx.tenant_id,
          jv_profile_id: profileId,
          actor_id: ctx.user_id || 'system',
          actor_tenant_id: ctx.jv_home_tenant_id || ctx.tenant_id,
          action,
          entity_type: entityType,
          entity_id: entityId,
          details: details ? JSON.parse(JSON.stringify(details)) : undefined,
        },
      });
    } catch (e) {
      // Non-critical — don't let logging failures break operations
      console.warn('[JV-ACTIVITY] Failed to log:', e);
    }
  }
}
