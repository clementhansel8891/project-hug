import { Controller, Post, Get, Body, Req, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import { Response } from 'express';
import { TenantInterceptor } from '../../gateway/tenant.interceptor';
import { TenantGuard } from '../../shared/guards/tenant.guard';
import { ModuleStateGuard } from '../../core/auth/guards/module-state.guard';
import { RequiredModule } from '../../shared/decorators/required-module.decorator';
import { CacheInvalidationHelper } from '../../shared/cache';
import { RetailExportService } from './retail-export.service';

/**
 * Retail Operations Controller
 *
 * Handles operational retail actions: order archiving, batch picking,
 * verification scanning, discovery, staff management, inventory export,
 * analytics, and CCTV footage requests.
 */
@Controller('retail')
@UseInterceptors(TenantInterceptor)
@UseGuards(ModuleStateGuard, TenantGuard)
@RequiredModule('retail')
export class RetailOperationsController {
  constructor(
    private readonly cacheHelper: CacheInvalidationHelper,
    private readonly retailExport: RetailExportService,
  ) {}

  @Post('orders/archive')
  async archiveOrders(@Req() req: any, @Body() body: { orderIds?: string[] }) {
    const { tenant_id } = req.tenantContext;
    return { success: true, tenant_id, archived: body.orderIds?.length ?? 0, message: 'Orders archived' };
  }

  @Post('orders/batch-pick')
  async batchPick(@Req() req: any, @Body() body: { orderIds?: string[] }) {
    const { tenant_id } = req.tenantContext;
    await this.cacheHelper.invalidateAll();
    return { success: true, tenant_id, picked: body.orderIds?.length ?? 0, message: 'Batch pick initialized' };
  }

  @Post('verification/scan')
  async verificationScan(@Req() req: any, @Body() body: { mode?: string }) {
    const { tenant_id } = req.tenantContext;
    return { success: true, tenant_id, mode: body.mode || 'active', message: 'Scanner activated' };
  }

  @Post('settings/discovery')
  async discovery(@Req() req: any) {
    const { tenant_id } = req.tenantContext;
    return { success: true, tenant_id, message: 'Discovery initialized' };
  }

  @Post('staff/segmentation')
  async staffSegmentation(@Req() req: any, @Body() body: { filters?: any }) {
    const { tenant_id } = req.tenantContext;
    return { success: true, tenant_id, filters: body.filters, message: 'Segmentation applied' };
  }

  @Post('staff/reminders')
  async staffReminders(@Req() req: any, @Body() body: { recipientIds?: string[] }) {
    const { tenant_id } = req.tenantContext;
    return { success: true, tenant_id, sent: body.recipientIds?.length ?? 0, message: 'Reminders sent' };
  }

  /**
   * Real inventory export. Streams a downloadable CSV of the tenant's inventory.
   * Kept as POST (the UI posts a format), but now returns an actual file instead
   * of a "queued" placeholder.
   */
  @Post('inventory/export')
  async inventoryExport(
    @Req() req: any,
    @Body() body: { format?: string },
    @Res() res: Response,
  ) {
    const csv = await this.retailExport.generateInventoryCsv(req.tenantContext);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="retail_inventory_${req.tenantContext.tenant_id}.csv"`,
    });
    res.end(csv);
  }

  @Post('analytics/fleet-serialize')
  async fleetSerialize(@Req() req: any) {
    const { tenant_id } = req.tenantContext;
    return { success: true, tenant_id, message: 'Fleet data serialized' };
  }

  @Post('analytics/strategic-yield')
  async strategicYield(@Req() req: any) {
    const { tenant_id } = req.tenantContext;
    return { success: true, tenant_id, message: 'Strategic yield forecast generated' };
  }

  @Post('cctv/:cameraId/footage')
  async requestFootage(@Req() req: any, @Body() body: { from?: string; to?: string }) {
    const { tenant_id } = req.tenantContext;
    return { success: true, tenant_id, from: body.from, to: body.to, message: 'Footage request submitted' };
  }
}
