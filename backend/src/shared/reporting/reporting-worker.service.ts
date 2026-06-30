import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReportJobService } from './report-job.service';
import { ReportingService } from './reporting.service';
import { IReportRepository } from './repositories/report.repository.interface';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ReportingWorkerService implements OnModuleInit {
  private readonly logger = new Logger(ReportingWorkerService.name);
  private readonly storagePath = path.join(process.cwd(), 'storage', 'reports');

  constructor(
    private readonly repository: IReportRepository,
    private readonly jobService: ReportJobService,
    private readonly reportingService: ReportingService,
  ) {}

  onModuleInit() {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
      this.logger.log(`Created report storage directory at ${this.storagePath}`);
    }
  }

  /**
   * Background Processor for Report Jobs
   * Runs every minute to poll for PENDING jobs.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processJobs() {
    // 1. Cleanup stale jobs first
    await this.jobService.cleanupStaleJobs(15);

    const pendingJobs = await this.repository.getPendingJobs();
    if (pendingJobs.length === 0) return;

    this.logger.log(`Found ${pendingJobs.length} pending report jobs. Processing...`);

    for (const job of pendingJobs) {
      try {
        await this.jobService.updateProgress(job.id, 10, 'PROCESSING');
        
        let buffer: Buffer;
        const filename = `${job.report_type.toLowerCase()}_${job.id}.${job.format.toLowerCase()}`;
        const fullPath = path.join(this.storagePath, filename);

        // Resolve report content. The caller supplies the actual rows/headers to
        // export in the job payload (`payload.headers` + `payload.rows`, or a
        // `payload.data` array of objects). This makes the generated file the
        // user's real data rather than a placeholder. If no data is supplied we
        // still produce a valid, human-readable file with the report title,
        // generation metadata and a clear "no data" marker (never fake samples).
        const payload: any = (job as any).payload || {};
        let headers: string[];
        let rows: any[];

        if (Array.isArray(payload.headers) && Array.isArray(payload.rows)) {
          headers = payload.headers.map((h: any) => String(h));
          // rows may be arrays (positional) or objects keyed by header
          rows = payload.rows.map((r: any) => {
            if (Array.isArray(r)) {
              const obj: Record<string, any> = {};
              headers.forEach((h, i) => (obj[h.toLowerCase().replace(/ /g, '_')] = r[i]));
              return obj;
            }
            return r;
          });
        } else if (Array.isArray(payload.data) && payload.data.length > 0) {
          headers = Object.keys(payload.data[0]).map((k) =>
            k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          );
          rows = payload.data;
        } else {
          headers = ['Field', 'Value'];
          rows = [
            { field: 'Report Type', value: job.report_type },
            { field: 'Tenant', value: job.tenant_id },
            { field: 'Generated At', value: new Date().toISOString() },
            ...Object.entries(payload)
              .filter(([, v]) => typeof v !== 'object')
              .map(([k, v]) => ({ field: k, value: String(v) })),
            { field: 'Note', value: 'No data rows were supplied for this report.' },
          ];
        }

        const title = payload.title || job.report_type;

        await this.jobService.updateProgress(job.id, 40);

        if (job.format === 'PDF') {
          buffer = await this.reportingService.generatePdf(title, headers, rows);
        } else {
          buffer = await this.reportingService.generateExcel(title, headers, rows);
        }

        await this.jobService.updateProgress(job.id, 80);

        fs.writeFileSync(fullPath, buffer);
        
        await this.jobService.completeJob(job.id, fullPath);
        this.logger.log(`Successfully completed report job ${job.id}. Saved to ${fullPath}`);
      } catch (error) {
        this.logger.error(`[BACKGROUND_REPORT_FAILURE] Module: REPORTING | Job: ${job.id} | Tenant: ${job.tenant_id} | Error: ${error.message}`, error.stack);
        await this.jobService.failJob(job.id, `Worker Processing Error: ${error.message}`);
      }
    }
  }
}
