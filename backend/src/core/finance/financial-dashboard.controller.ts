import { Controller, Get, Post, Body, Req, UseGuards, ForbiddenException, Query } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { FinancialDashboardService } from './services/financial-dashboard.service';
import { AuditService } from '../../shared/audit/audit.service';
import { AuditChainService } from '../../shared/audit/audit-chain.service';
import { createHash } from 'crypto';

@Controller('finance/dashboard')
@UseGuards(ThrottlerGuard)
export class FinancialDashboardController {
  constructor(
    private readonly dashboardService: FinancialDashboardService,
    private readonly audit: AuditService,
    private readonly auditChain: AuditChainService,
  ) {}

  @Get('summary')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getSummary(@Req() req: any, @Query() query: any) {
    const { tenant_id, user_id } = req.tenantContext;
    const company_id = query.company_id || tenant_id;

    // Requirement 5: Validate allowedCompanies
    this.validateCompanyAccess(req.user, company_id);

    // If a report type is requested, return hierarchical report rows (TB/PL/BS).
    if (query.type) {
      return this.dashboardService.getReport(
        tenant_id,
        company_id,
        query.periodId || query.period_id,
        query.type,
      );
    }

    const data = await this.dashboardService.getDashboardSummary(tenant_id, company_id, query);

    // Requirement 1 & 8: Backend Audit Enforcement (Resilient)
    // Requirement 2: Audit Enrichment (After State)
    await this.audit.log({
      tenant_id,
      user_id,
      module: 'FINANCE',
      action: 'FINANCE_DASHBOARD_VIEW',
      entity_type: 'FINANCE_SUMMARY',
      entity_id: query.periodId || 'LATEST',
      metadata: { filters: query, snapshotSequence: data.sequence },
      after_state: { kpis: data.kpis, healthStatus: data.healthStatus },
      idempotency_key: this.generateEventIdempotencyKey(user_id, 'DASHBOARD_VIEW', query),
    });

    return data;
  }

  @Get('drilldown')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getDrillDown(@Req() req: any, @Query() query: any) {
    const { tenant_id, user_id } = req.tenantContext;
    const company_id = query.company_id || tenant_id;

    this.validateCompanyAccess(req.user, company_id);

    const data = await this.dashboardService.getDrillDown(tenant_id, company_id, query);

    await this.audit.log({
      tenant_id,
      user_id,
      module: 'FINANCE',
      action: 'FINANCE_DRILLDOWN_VIEW',
      entity_type: 'FINANCE_LEDGER',
      entity_id: query.accountId,
      metadata: { filters: query },
      idempotency_key: this.generateEventIdempotencyKey(user_id, 'DRILLDOWN_VIEW', query),
    });

    return data;
  }

  @Post('export')
  async exportReport(@Req() req: any, @Body() body: any) {
    const { tenant_id, user_id } = req.tenantContext;
    const company_id = body.company_id || tenant_id;

    this.validateCompanyAccess(req.user, company_id);

    const data = await this.dashboardService.exportReport(tenant_id, company_id, body, user_id);

    await this.audit.log({
      tenant_id,
      user_id,
      module: 'FINANCE',
      action: 'FINANCE_EXPORT',
      entity_type: 'FINANCE_REPORT',
      entity_id: body.periodId,
      metadata: { filters: body, exportId: data.exportId },
      before_state: { summaryKpis: data.reportData?.kpis },
      after_state: { watermark: data.watermark },
      idempotency_key: this.generateEventIdempotencyKey(user_id, 'EXPORT', body),
    });

    return data;
  }

  @Post('verify-export')
  async verifyExport(@Body() body: { data: any; signature: string }) {
    const secret = process.env.FINANCE_EXPORT_SECRET;
    if (!secret) {
      throw new Error('FINANCE_EXPORT_SECRET not configured');
    }
    const isValid = await this.dashboardService.verifyExportSignature(body.data, body.signature, secret);
    return { valid: isValid };
  }

  @Get('health')
  async getHealth(@Req() req: any, @Query('company_id') company_id: string) {
    const { tenant_id } = req.tenantContext;
    return this.dashboardService.getSystemHealth(tenant_id, company_id || tenant_id, 'LATEST');
  }

  @Get('cfo-analytics')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getCfoAnalytics(@Req() req: any, @Query() query: any) {
    const { tenant_id } = req.tenantContext;
    const company_id = query.company_id || tenant_id;
    this.validateCompanyAccess(req.user, company_id);
    return this.dashboardService.getCfoAnalytics(tenant_id, company_id);
  }

  @Get('cto-analytics')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getCtoAnalytics(@Req() req: any, @Query() query: any) {
    const { tenant_id } = req.tenantContext;
    const company_id = query.company_id || tenant_id;
    this.validateCompanyAccess(req.user, company_id);
    return this.dashboardService.getCtoAnalytics(tenant_id, company_id);
  }

  @Get('operations-metrics')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getOperationsMetrics(@Req() req: any, @Query() query: any) {
    const { tenant_id } = req.tenantContext;
    const company_id = query.company_id || tenant_id;
    this.validateCompanyAccess(req.user, company_id);
    return this.dashboardService.getOperationsMetrics(tenant_id, company_id);
  }

  @Post('repair-chain')
  async repairChain(@Req() req: any, @Body() body: { fromTimestamp?: string }) {
    const { tenant_id, user_id } = req.tenantContext;
    if (req.user.role !== 'SUPERADMIN') {
      throw new ForbiddenException('Only SuperAdmins can trigger audit chain repairs');
    }
    return this.auditChain.repairChain(
      tenant_id, 
      user_id, 
      { approvedBy: user_id, reason: 'ADMIN_FORCE_REPAIR' },
      body.fromTimestamp ? new Date(body.fromTimestamp) : undefined
    );
  }

  private validateCompanyAccess(user: any, requestedCompanyId: string) {
    // Requirement 4: tenant_id from session ONLY (already in req.tenantContext)
    // Requirement 5: validate allowedCompanies
    // Note: req.user is the verified user payload which uses snake_case (user_companies).
    const userCompanies = user.user_companies || user.userCompanies || [];
    const isAllowed =
      userCompanies.some(
        (uc: any) =>
          uc.tenant_id === requestedCompanyId ||
          uc.company_id === requestedCompanyId,
      ) ||
      // The requested company defaults to the session tenant; always allow own tenant.
      user.tenant_id === requestedCompanyId;

    if (!isAllowed && user.role !== 'SUPERADMIN') {
      throw new ForbiddenException(`Access Denied: You do not have permission to access company ${requestedCompanyId}`);
    }
  }

  private generateEventIdempotencyKey(user_id: string, action: string, params: any): string {
    // Requirement 1: generate event-level idempotency_key
    // Using a stable hash of user, action, parameters, and time (hourly) to deduplicate views
    // but allowing fresh logs every hour if the user keeps the tab open.
    const hourPrefix = new Date().toISOString().slice(0, 13);
    const source = `${user_id}:${action}:${JSON.stringify(params)}:${hourPrefix}`;
    return createHash('sha256').update(source).digest('hex');
  }
}
