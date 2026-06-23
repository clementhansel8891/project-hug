import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Inject, BadRequestException } from '@nestjs/common';
import { getFinanceExecutionMode } from './utils/finance-safety.utils';
import { FinanceService } from './finance.service';
import { ChartOfAccountService } from './services/chart-of-account.service';
import { FiscalPeriodService } from './services/fiscal-period.service';
import { PostingRuleService } from './services/posting-rule.service';
import { LedgerPostingService } from './services/ledger-posting.service';
import { JournalReversalService } from './services/journal-reversal.service';
import { PeriodClosingService } from './services/period-closing.service';
import { CreateCOADto, UpdateCOADto } from './dto/coa.dto';
import { UpdateFiscalPeriodDto } from './dto/fiscal.dto';
import { CreatePostingRuleDto } from './dto/posting-rule.dto';
import { TenantGuard } from '../../shared/guards/tenant.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '../../shared/roles';
import { TenantCtx } from '../../gateway/tenant-context.decorator';
import { TenantContext } from '../../gateway/tenant-context.interface';

@Controller('finance')
@UseGuards(TenantGuard, RolesGuard)
export class FinanceController {
  constructor(
    private readonly coaService: ChartOfAccountService,
    private readonly fiscalService: FiscalPeriodService,
    private readonly ruleService: PostingRuleService,
    private readonly ledgerService: LedgerPostingService,
    private readonly reversalService: JournalReversalService,
    private readonly periodClosingService: PeriodClosingService,
    private readonly financeService: FinanceService,
    @Inject('IAccountBalanceRepository') private readonly balanceRepo: any,
    @Inject('IUnitOfWork') private readonly uow: any,
  ) {}

  @Get('health')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPERADMIN)
  async getHealth() {
    return {
      status: 'UP',
      module: 'FINANCE CORE',
      executionMode: getFinanceExecutionMode().toUpperCase(),
      repositoryType: this.balanceRepo.constructor.name,
      unitOfWorkType: this.uow.constructor.name,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    };
  }

  // --- Chart of Accounts ---
  @Get('coa')
  async getCoa(@TenantCtx() ctx: TenantContext) {
    return this.coaService.getHierarchy(ctx.tenant_id, ctx.company_id);
  }

  @Post('coa')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async createCoa(@TenantCtx() ctx: TenantContext, @Body() dto: CreateCOADto) {
    return this.coaService.createAccount(ctx.tenant_id, ctx.company_id, dto, ctx.user_id || 'SYSTEM');
  }

  @Patch('coa/:id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async updateCoa(@TenantCtx() ctx: TenantContext, @Param('id') id: string, @Body() dto: UpdateCOADto) {
    return this.coaService.updateAccount(ctx.tenant_id, ctx.company_id, id, dto, ctx.user_id || 'SYSTEM');
  }

  @Delete('coa/:id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async deleteCoa(@TenantCtx() ctx: TenantContext, @Param('id') id: string) {
    return this.coaService.deleteAccount(ctx.tenant_id, ctx.company_id, id, ctx.user_id || 'SYSTEM');
  }

  // --- Fiscal Periods ---
  @Get('fiscal-years')
  async getFiscalYears(@TenantCtx() ctx: TenantContext) {
    return this.fiscalService.listYears(ctx.tenant_id, ctx.company_id);
  }

  @Get('periods')
  async listPeriods(@TenantCtx() ctx: TenantContext) {
    return this.financeService.listPeriods(ctx);
  }

  @Post('fiscal-periods/:id/lock')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPERADMIN)
  async transitionPeriod(@TenantCtx() ctx: TenantContext, @Param('id') id: string, @Body() dto: UpdateFiscalPeriodDto) {
    return this.fiscalService.transitionStatus(ctx.tenant_id, ctx.company_id, id, dto.status, ctx.user_id || 'SYSTEM');
  }

  @Post('fiscal-periods/:id/close')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPERADMIN)
  async closePeriod(@TenantCtx() ctx: TenantContext, @Param('id') id: string) {
    const closingRecordId = await this.periodClosingService.closePeriod(
      ctx.tenant_id,
      ctx.company_id,
      id,
      ctx.user_id || 'SYSTEM',
    );
    return { success: true, closingRecordId };
  }

  @Post('fiscal-periods/:id/reopen')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPERADMIN)
  async reopenPeriod(@TenantCtx() ctx: TenantContext, @Param('id') id: string) {
    await this.periodClosingService.reverseClosing(ctx.tenant_id, ctx.company_id, id);
    return { success: true, periodId: id, status: 'OPEN' };
  }

  // --- Posting Rules ---
  @Get('posting-rules')
  async getRules(@TenantCtx() ctx: TenantContext) {
    return this.ruleService.listRules(ctx.tenant_id, ctx.company_id);
  }

  @Post('posting-rules')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async createRule(@TenantCtx() ctx: TenantContext, @Body() dto: CreatePostingRuleDto) {
    return this.ruleService.createRule(ctx.tenant_id, ctx.company_id, dto, ctx.user_id || 'SYSTEM');
  }

  @Post('posting-rules/:id/activate')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async activateRule(@TenantCtx() ctx: TenantContext, @Param('id') id: string) {
    return this.ruleService.activateRule(ctx.tenant_id, ctx.company_id, id, ctx.user_id || 'SYSTEM');
  }

  // --- Ledger Engine ---
  @Post('ledger/process-event')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPERADMIN)
  async processEvent(@TenantCtx() ctx: TenantContext, @Body() envelope: any) {
    // Envelope context is now secondary to the secure TenantCtx
    const targetCompanyId = envelope?.company_id || ctx.company_id;
    const postingId = envelope?.id || envelope?.postingId;
    if (!postingId) {
      throw new BadRequestException(
        'process-event requires an enqueued posting id (envelope.id or envelope.postingId)',
      );
    }
    return this.ledgerService.processEvent(ctx.tenant_id, targetCompanyId, postingId);
  }

  // --- Auditable Flux & Reversals ---
  @Post('journals/:id/reverse')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPERADMIN)
  async reverseJournal(@TenantCtx() ctx: TenantContext, @Param('id') id: string, @Body() body: { reason: string }) {
    return this.reversalService.reverseJournal(
      ctx.tenant_id,
      ctx.company_id,
      id,
      body.reason || 'Manual reversal',
      ctx.user_id || 'SYSTEM'
    );
  }

  // --- Money Sources & Petty Cash ---
  @Get('money-sources')
  async getMoneySources(@TenantCtx() ctx: TenantContext) {
    return this.financeService.getMoneySources(ctx);
  }

  @Patch('money-sources/:id')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  async updateMoneySource(
    @TenantCtx() ctx: TenantContext,
    @Param('id') id: string,
    @Body() dto: any
  ) {
    return this.financeService.updateMoneySource(ctx, id, dto);
  }

  // --- Alerts, Inbox & Payments ---
  @Get('alerts')
  async getAlerts(@TenantCtx() ctx: TenantContext) {
    return this.financeService.getAlerts(ctx);
  }

  @Get('inbox')
  async getInbox(@TenantCtx() ctx: TenantContext) {
    return this.financeService.getInbox(ctx);
  }

  @Get('payments')
  async listPayments(@TenantCtx() ctx: TenantContext) {
    return this.financeService.listPayments(ctx);
  }

  @Get('capex/budgets')
  async listCapexBudgets(@TenantCtx() ctx: TenantContext) {
    return this.financeService.listCapexBudgets(ctx);
  }

  @Get('policies')
  async listPolicies(@TenantCtx() ctx: TenantContext) {
    return this.financeService.listPolicies(ctx);
  }

  @Get('payables')
  async listPayables(@TenantCtx() ctx: TenantContext) {
    return this.financeService.listPayables(ctx);
  }

  @Get('receivables')
  async listReceivables(@TenantCtx() ctx: TenantContext) {
    return this.financeService.listReceivables(ctx);
  }

  @Get('ledger')
  async listJournals(@TenantCtx() ctx: TenantContext) {
    return this.financeService.listJournals(ctx);
  }

  @Get('invoices')
  async listInvoices(@TenantCtx() ctx: TenantContext) {
    return this.financeService.listInvoices(ctx);
  }

  // --- Treasury ---
  @Get('treasury/sources')
  async listSources(@TenantCtx() ctx: TenantContext) {
    return this.financeService.getMoneySources(ctx);
  }

  @Get('treasury/transfers')
  async listTransfers(@TenantCtx() ctx: TenantContext) {
    return this.financeService.listTransfers(ctx);
  }

  @Post('treasury/transfers')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  async createTransfer(@TenantCtx() ctx: TenantContext, @Body() dto: any) {
    return this.financeService.createTransfer(ctx, dto);
  }

  @Post('treasury/reconcile')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  async reconcileSettlement(@TenantCtx() ctx: TenantContext, @Body() body: { sourceId: string, amount: number }) {
    return this.financeService.reconcileSettlement(ctx, body.sourceId, body.amount);
  }

  // --- Payroll ---
  @Get('payroll/entries')
  async getPayrollEntries(@TenantCtx() ctx: TenantContext, @Query('period') period?: string) {
    return this.financeService.getPayrollEntries(ctx, period);
  }

  @Get('payroll/estimate')
  async estimatePayroll(@TenantCtx() ctx: TenantContext, @Query('period') period: string) {
    return this.financeService.estimatePayroll(ctx, period);
  }

  @Post('payroll/execute')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async executePayroll(@TenantCtx() ctx: TenantContext, @Body('period') period: string) {
    return this.financeService.executePayroll(ctx, period, ctx.user_id || 'SYSTEM');
  }

  // --- Assets ---
  @Get('assets')
  async listAssets(@TenantCtx() ctx: TenantContext) {
    return this.financeService.listAssets(ctx);
  }

  @Get('assets/events')
  async listAssetEvents(@TenantCtx() ctx: TenantContext, @Query('assetId') assetId?: string) {
    return this.financeService.listAssetEvents(ctx, assetId);
  }

  @Get('assets/depreciation')
  async listAssetDepreciationEntries(@TenantCtx() ctx: TenantContext, @Query('assetId') assetId?: string) {
    return this.financeService.listAssetDepreciationEntries(ctx, assetId);
  }

  @Get('assets/:id')
  async getAssetById(@TenantCtx() ctx: TenantContext, @Param('id') id: string) {
    return this.financeService.getAssetById(ctx, id);
  }

  @Get('assets/:id/audit-pack')
  async getAssetAuditPack(@TenantCtx() ctx: TenantContext, @Param('id') id: string) {
    return this.financeService.getAssetAuditPack(ctx, id);
  }

  // --- Loans ---
  @Get('loans')
  async listLoans(@TenantCtx() ctx: TenantContext) {
    return this.financeService.listLoans(ctx);
  }

  @Get('loans/my')
  async getMyLoans(@TenantCtx() ctx: TenantContext) {
    const employeeId = await this.financeService.getEmployeeIdByUserId(ctx, ctx.user_id || '');
    if (!employeeId) return [];
    return this.financeService.listLoans(ctx, employeeId);
  }

  @Post('loans')
  async applyForLoan(@TenantCtx() ctx: TenantContext, @Body() dto: any) {
    return this.financeService.applyForLoan(ctx, dto, ctx.user_id || 'SYSTEM');
  }

  @Patch('loans/:id/approve')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  async approveLoan(@TenantCtx() ctx: TenantContext, @Param('id') id: string) {
    return this.financeService.approveLoan(ctx, id, ctx.user_id || 'SYSTEM');
  }
}
