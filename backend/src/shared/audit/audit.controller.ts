import { Controller, Get, Post, Param, Query, Req, Res, UseGuards, Body, UseInterceptors } from '@nestjs/common';
import { AuditService, AuditQueryDto } from './audit.service';
import { ReportingService } from '../reporting/reporting.service';
import { Response } from 'express';
import { TenantInterceptor } from '../../gateway/tenant.interceptor';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { UserRole } from '../roles';
import { PaginationPipe, PaginationParams } from '../pipes/pagination.pipe';
import { CacheInterceptor, CacheTTL, CacheInvalidationHelper } from '../cache';


@Controller('audit')
@UseInterceptors(TenantInterceptor)
@UseGuards(RolesGuard)
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly reportingService: ReportingService,
    private readonly cacheHelper: CacheInvalidationHelper,
  ) {}


  @Get('logs')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async query(
    @Req() req: any,
    @Query(PaginationPipe) pagination: PaginationParams,
    @Query('module') module?: string,
    @Query('action') action?: string,
    @Query('user_id') userId?: string,
    @Query('entity_type') entityType?: string,
    @Query('entity_id') entityId?: string,
    @Query('severity') severity?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.auditService.queryPaginated(req.tenantContext.tenant_id, pagination, {
      module,
      action,
      user_id: userId,
      entity_type: entityType,
      entity_id: entityId,
      severity,
      start_date: startDate,
      end_date: endDate,
    });
  }

  @Get('logs/:id')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getOne(@Req() req: any, @Param('id') id: string) {
    return this.auditService.getLogDetail(req.tenantContext.tenant_id, id);
  }

  @Get('verify-chain')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async verifyChain(@Req() req: any, @Query('fromTimestamp') fromTimestamp?: string) {
    const tenant_id = req.tenantContext.tenant_id; // Shared tenant middleware
    return this.auditService.verifyChain(
      tenant_id, 
      fromTimestamp ? new Date(fromTimestamp) : undefined
    );
  }

  @Post('repair')
  @Roles(UserRole.SUPERADMIN)
  async repair(
    @Req() req: any,
    @Body() body: { reason: string; permission_by?: string }
  ) {
    const { tenant_id, user_id } = req.tenantContext;
    const result = await this.auditService.repairChain({
      tenant_id,
      actor_id: user_id || 'system',
      reason: body.reason,
      permission_by: body.permission_by,
      permission_at: body.permission_by ? new Date() : undefined,
      source_ip: req.ip,
      request_id: req.headers['x-request-id'] as string,
    });
    await this.cacheHelper.invalidateAll();
    return result;
  }

  @Get('system/metrics')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  @Roles(UserRole.SUPERADMIN, UserRole.OWNER)
  async getMetrics(@Req() req: any) {
    return this.auditService.getMetrics();
  }

  @Get('anchors/public')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getPublicAnchors(
    @Query(PaginationPipe) pagination: PaginationParams,
  ) {
    return this.auditService.getPublicAnchorsPaginated(pagination);
  }

  @Get('export')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async export(
    @Req() req: any,
    @Query() filters: AuditQueryDto,
    @Query('format') format: 'pdf' | 'csv' = 'csv',
    @Res() res: Response,
  ) {
    const { data } = await this.auditService.query(req.tenantContext.tenant_id, { ...filters, limit: 1000 });
    const headers = ['Action', 'Module', 'Entity Type', 'User ID', 'Created At', 'Severity'];
    const title = `Audit Trail Report - ${req.tenantContext.tenant_id}`;

    if (format === 'pdf') {
      const buffer = await this.reportingService.generatePdf(title, headers, data);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=audit-report-${Date.now()}.pdf`);
      res.send(buffer);
    } else {
      const buffer = await this.reportingService.generateExcel(title, headers, data);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=audit-report-${Date.now()}.xlsx`);
      res.send(buffer);
    }
  }
}

