import { 
  Controller, 
  Post, 
  Get, 
  Param, 
  Body, 
  Query,
  Req, 
  Res, 
  StreamableFile, 
  NotFoundException, 
  BadRequestException,
  UseGuards,
  ForbiddenException,
  UseInterceptors
} from '@nestjs/common';
import { ReportJobService } from './report-job.service';
import { Request } from 'express';
import { TenantContext } from '../../gateway/tenant-context.interface';
import { TenantInterceptor } from '../../gateway/tenant.interceptor';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { UserRole } from '../roles';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { PaginationPipe, PaginationParams } from '../pipes/pagination.pipe';
import { CacheInterceptor, CacheTTL, CacheInvalidationHelper } from '../cache';

interface RequestWithTenant extends Request {
  tenantContext: TenantContext;
}

/**
 * Reporting Controller
 * Handles async job-based report generation and retrieval.
 */
@Controller('reporting')
@UseInterceptors(TenantInterceptor)
@UseGuards(RolesGuard)
export class ReportingController {
  constructor(
    private readonly jobService: ReportJobService,
    private readonly cacheHelper: CacheInvalidationHelper,
  ) {}

  @Get('archives')
  async getArchives(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    // Return empty array — archives are populated when report jobs complete
    return [];
  }

  @Post('generate')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async generateReport(
    @Req() request: RequestWithTenant,
    @Body() body: { report_type: string; format: string; payload?: any }
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    if (!body.report_type || !body.format) {
      throw new BadRequestException('Report type and format are required.');
    }

    try {
      const job = await this.jobService.createJob(
        tenant_id,
        user_id || 'system',
        body.report_type,
        body.format,
        body.payload
      );

      await this.cacheHelper.invalidateAll();

      return { 
        success: true, 
        job_id: job.id, 
        status: job.status,
        message: 'Report generation queued successfully.' 
      };
    } catch (error) {
      const { mapPrismaError } = await import('../../core/_shared/errors/prisma-error.mapper');
      mapPrismaError(error, 'ReportGeneration');
    }
  }

  @Get(':id/status')
  async getStatus(
    @Req() request: RequestWithTenant,
    @Param('id') id: string
  ) {
    const { tenant_id, user_id, role } = request.tenantContext;
    const isPlatformAdmin = role === UserRole.SUPERADMIN;
    
    const job = await this.jobService.getJobSafe(id, tenant_id, user_id || 'system', isPlatformAdmin);
    if (!job) throw new NotFoundException('Report job not found or access denied.');

    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      error: job.error_message,
      completed_at: job.status === 'COMPLETED' ? job.updated_at : null
    };
  }

  @Get(':id/download')
  async downloadReport(
    @Req() request: RequestWithTenant,
    @Param('id') id: string,
    @Res() res: Response
  ) {
    const { tenant_id, user_id, role } = request.tenantContext;
    const isPlatformAdmin = role === UserRole.SUPERADMIN;

    const job = await this.jobService.getJobSafe(id, tenant_id, user_id || 'system', isPlatformAdmin);
    if (!job) throw new NotFoundException('Report job not found or access denied.');
    if (job.status !== 'COMPLETED' || !job.file_path) {
      throw new BadRequestException('Report is not ready for download.');
    }

    if (!fs.existsSync(job.file_path)) {
      throw new NotFoundException('Physical report file missing from storage.');
    }

    const fileBuffer = fs.readFileSync(job.file_path);
    const filename = path.basename(job.file_path);

    // Send the file buffer directly (NOT StreamableFile): a global response
    // interceptor wraps returned objects in JSON, which corrupts a streamed
    // file. Writing to the raw response bypasses that transform.
    res.set({
      'Content-Type': job.format === 'PDF'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': fileBuffer.length,
    });
    res.end(fileBuffer);
  }

  @Post(':id/retry')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async retryReport(
    @Req() request: RequestWithTenant,
    @Param('id') id: string
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const job = await this.jobService.retryJob(id, tenant_id, user_id || 'system');
    if (!job) throw new NotFoundException('Report job not found or access denied.');

    await this.cacheHelper.invalidateAll();

    return { 
      success: true, 
      job_id: job.id, 
      status: job.status,
      message: 'Report job reset and moved to pending queue.' 
    };
  }
}
