import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseInterceptors, UseGuards, Req,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantContext } from '../../gateway/tenant-context.interface';
import { TenantInterceptor } from '../../gateway/tenant.interceptor';
import { ModuleStateGuard } from '../../core/auth/guards/module-state.guard';
import { TenantGuard } from '../../shared/guards/tenant.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '../../shared/roles';
import { RequiredModule } from '../../shared/decorators/required-module.decorator';
import { PrismaService } from '../../persistence/prisma.service';
import { v4 as uuidv4 } from 'uuid';

interface RequestWithTenant extends Request {
  tenantContext: TenantContext;
}

/**
 * Retail Governance & Crisis Management Controller
 * 
 * Handles:
 * - Operational thresholds (revenue min, staffing min, latency max, etc.)
 * - Threshold violations tracking and resolution
 * - Crisis alerts (infrastructure failures, staffing shortages, stockout risks)
 * - Resource deployment tasks for crisis resolution
 */
@Controller('retail')
@UseInterceptors(TenantInterceptor)
@UseGuards(ModuleStateGuard, TenantGuard, RolesGuard)
@RequiredModule('retail')
export class RetailGovernanceController {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // GOVERNANCE THRESHOLDS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('governance/thresholds')
  async getThresholds(@Req() req: RequestWithTenant, @Query('locationId') locationId?: string) {
    const { tenant_id } = req.tenantContext;
    const where: any = { tenant_id };
    if (locationId) where.location_id = locationId;

    const thresholds = await this.prisma.retail_governance_thresholds.findMany({ where });

    // If no thresholds exist yet, return sensible defaults
    if (thresholds.length === 0) {
      return [
        { id: `default-rev-${tenant_id}`, metric: 'REVENUE_MIN', value: 5000000, unit: 'currency', status: 'NORMAL' },
        { id: `default-staff-${tenant_id}`, metric: 'STAFFING_MIN', value: 3, unit: 'count', status: 'NORMAL' },
        { id: `default-lat-${tenant_id}`, metric: 'LATENCY_MAX', value: 200, unit: 'ms', status: 'NORMAL' },
        { id: `default-surge-${tenant_id}`, metric: 'ORDER_SURGE_MAX', value: 50, unit: 'count', status: 'NORMAL' },
      ];
    }

    return thresholds;
  }

  @Patch('governance/thresholds/:id')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  async updateThreshold(
    @Req() req: RequestWithTenant,
    @Param('id') id: string,
    @Body() body: { value: number },
  ) {
    const { tenant_id } = req.tenantContext;

    // Upsert — if it's a default ID, create a real record
    if (id.startsWith('default-')) {
      const metric = id.replace(`default-`, '').replace(`-${tenant_id}`, '').toUpperCase();
      const metricMap: Record<string, string> = { rev: 'REVENUE_MIN', staff: 'STAFFING_MIN', lat: 'LATENCY_MAX', surge: 'ORDER_SURGE_MAX' };
      const resolvedMetric = metricMap[metric.toLowerCase().split('-')[0]] || metric;

      const created = await this.prisma.retail_governance_thresholds.create({
        data: {
          id: uuidv4(),
          tenant_id,
          metric: resolvedMetric,
          value: body.value,
          unit: 'count',
          status: 'NORMAL',
        },
      });
      return created;
    }

    const updated = await this.prisma.retail_governance_thresholds.updateMany({
      where: { id, tenant_id },
      data: { value: body.value, updated_at: new Date() },
    });

    return { id, value: body.value, updated: updated.count > 0 };
  }

  @Get('governance/violations')
  async getViolations(@Req() req: RequestWithTenant) {
    const { tenant_id } = req.tenantContext;
    return this.prisma.retail_governance_violations.findMany({
      where: { tenant_id, resolved: false },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
  }

  @Post('governance/violations/:id/resolve')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  async resolveViolation(
    @Req() req: RequestWithTenant,
    @Param('id') id: string,
    @Body() body: { resolution: string },
  ) {
    const { tenant_id, user_id } = req.tenantContext;
    await this.prisma.retail_governance_violations.updateMany({
      where: { id, tenant_id },
      data: { resolved: true, resolution: body.resolution, resolved_by: user_id, resolved_at: new Date() },
    });
    return { success: true, id };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CRISIS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('crisis/alerts')
  async getCrisisAlerts(@Req() req: RequestWithTenant) {
    const { tenant_id } = req.tenantContext;
    return this.prisma.retail_crisis_alerts.findMany({
      where: { tenant_id, resolved: false },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
  }

  @Post('crisis/deploy')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  async deployResources(
    @Req() req: RequestWithTenant,
    @Body() body: { alertId: string; assets: string[] },
  ) {
    const { tenant_id, user_id } = req.tenantContext;

    const task = await this.prisma.retail_deployment_tasks.create({
      data: {
        id: uuidv4(),
        tenant_id,
        alert_id: body.alertId,
        title: `Resource Deployment for alert ${body.alertId.substring(0, 8)}`,
        description: `Deploying ${body.assets.length} assets to resolve crisis`,
        priority: 'URGENT',
        status: 'ACTIVE',
        assigned_assets: body.assets,
        assigned_by: user_id || 'system',
      },
    });

    // Mark alert as having a resolution task
    await this.prisma.retail_crisis_alerts.updateMany({
      where: { id: body.alertId, tenant_id },
      data: { resolution_task_id: task.id },
    });

    return { success: true, taskId: task.id };
  }

  @Get('crisis/tasks/:taskId')
  async getDeploymentTask(@Req() req: RequestWithTenant, @Param('taskId') taskId: string) {
    const { tenant_id } = req.tenantContext;
    const task = await this.prisma.retail_deployment_tasks.findFirst({
      where: { id: taskId, tenant_id },
    });
    return task || { id: taskId, status: 'NOT_FOUND' };
  }

  @Post('crisis/replenish')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  async triggerReplenishment(
    @Req() req: RequestWithTenant,
    @Body() body: { locationId: string; skus: string[] },
  ) {
    const { tenant_id, user_id } = req.tenantContext;

    // Create a movement request for each SKU
    const orderId = uuidv4();
    for (const sku of body.skus) {
      const item = await this.prisma.item_masters.findFirst({
        where: { tenant_id, sku },
      });
      if (item) {
        await this.prisma.inventory_movement_requests.create({
          data: {
            id: uuidv4(),
            tenant_id,
            product_id: item.id,
            from_location_id: body.locationId,
            to_location_id: body.locationId,
            quantity: 10,
            status: 'PENDING',
          } as any,
        });
      }
    }

    return { success: true, orderId };
  }
}
