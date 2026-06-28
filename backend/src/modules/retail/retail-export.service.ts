import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../persistence/prisma.service';
import { TenantContext } from '../../gateway/tenant-context.interface';
import { MultiTenancyUtil } from '../../shared/utils/multi-tenancy.util';

@Injectable()
export class RetailExportService {
  private readonly logger = new Logger(RetailExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generateReturnCsv(ctx: TenantContext) {
    this.logger.log(`Generating Return Metrics CSV for tenant ${ctx.tenant_id}`);
    
    // Gap Analysis Step 3 logic implementation: streaming JSON to CSV
    // using Prisma to find Refund/Return data
    const records = await this.prisma.retail_orders.findMany({
      where: {
        ...MultiTenancyUtil.getScope(ctx),
        status: 'refunded'
      },
      select: {
        id: true,
        total_amount: true,
        created_at: true,
        customer_id: true,
      },
      orderBy: { created_at: 'desc' },
      take: 10000
    });

    // Formatting as CSV
    const csvHeader = "Order ID,Amount,Date,Customer ID\n";
    const csvRows = records.map((r: any) => 
      `${r.id},${r.total_amount ? r.total_amount.toString() : '0'},${r.created_at.toISOString()},${r.customer_id || 'N/A'}`
    ).join("\n");

    return csvHeader + csvRows;
  }

  async generateAuditCsv(ctx: TenantContext) {
    this.logger.log(`Generating Retail Audit CSV for tenant ${ctx.tenant_id}`);
    const logs = await this.prisma.audit_logs.findMany({
      where: {
        tenant_id: ctx.tenant_id,
        module: "RETAIL",
      },
      orderBy: { created_at: "desc" },
      take: 10000
    });

    const header = "Date,User ID,Action,Resource,Status,Meta\n";
    const rows = logs
      .map((log: any) =>
        `${log.created_at.toISOString()},${log.user_id},${log.action},${log.resource_type},${log.status},"${JSON.stringify(log.metadata).replace(/"/g, '""')}"`
      )
      .join("\n");

    return header + rows;
  }

  async generateDashboardKpiCsv(ctx: TenantContext) {
    this.logger.log(`Generating Dashboard KPI CSV for tenant ${ctx.tenant_id}`);
    const shifts = await this.prisma.retail_shifts.findMany({
      where: { ...MultiTenancyUtil.getScope(ctx) },
      orderBy: { end_time: "desc" },
      take: 50,
    });

    const header = "Shift ID,Started At,Ended At,Opening Cash,Closing Cash,Expected Cash,Variance\n";
    const rows = shifts
      .map((s: any) => {
        const variance = s.closing_cash ? Number(s.closing_cash) - Number(s.expected_cash || 0) : 0;
        return `${s.id},${s.start_time.toISOString()},${s.end_time ? s.end_time.toISOString() : "OPEN"},${s.opening_cash},${s.closing_cash || 0},${s.expected_cash || 0},${variance}`;
      })
      .join("\n");

    return header + rows;
  }
}
