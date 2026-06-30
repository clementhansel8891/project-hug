import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { PrismaService } from '../../persistence/prisma.service';
import { SyncEngineService } from './sync-engine.service';
import { TenantGuard } from '../../shared/guards/tenant.guard';
import { PaginationPipe, PaginationParams } from '../../shared/pipes/pagination.pipe';
import { CacheInterceptor, CacheTTL } from '../../shared/cache';
import { Request } from 'express';

@Controller('sync')
@UseGuards(TenantGuard)
export class SyncController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly syncEngineService: SyncEngineService,
  ) {}

  // --- Snapshot individual paginated endpoints ---

  @Get('snapshot/item-masters')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getSnapshotItemMasters(
    @Req() req: Request,
    @Query(PaginationPipe) pagination: PaginationParams,
  ) {
    const tenant_id = req.headers['x-tenant-id'] as string;
    const skip = (pagination.page - 1) * pagination.pageSize;

    const [data, totalCount] = await Promise.all([
      this.prisma.item_masters.findMany({
        where: { tenant_id, status: 'active' },
        skip,
        take: pagination.pageSize,
      }),
      this.prisma.item_masters.count({
        where: { tenant_id, status: 'active' },
      }),
    ]);

    return {
      data,
      totalCount,
      currentPage: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
    };
  }

  @Get('snapshot/staff')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getSnapshotStaff(
    @Req() req: Request,
    @Query(PaginationPipe) pagination: PaginationParams,
  ) {
    const tenant_id = req.headers['x-tenant-id'] as string;
    const skip = (pagination.page - 1) * pagination.pageSize;

    const [data, totalCount] = await Promise.all([
      this.prisma.employees.findMany({
        where: { tenant_id, status: 'active' },
        skip,
        take: pagination.pageSize,
      }),
      this.prisma.employees.count({
        where: { tenant_id, status: 'active' },
      }),
    ]);

    return {
      data,
      totalCount,
      currentPage: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
    };
  }

  @Get('snapshot/locations')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getSnapshotLocations(
    @Req() req: Request,
    @Query(PaginationPipe) pagination: PaginationParams,
  ) {
    const tenant_id = req.headers['x-tenant-id'] as string;
    const skip = (pagination.page - 1) * pagination.pageSize;

    const [data, totalCount] = await Promise.all([
      this.prisma.locations.findMany({
        where: { tenant_id },
        skip,
        take: pagination.pageSize,
      }),
      this.prisma.locations.count({
        where: { tenant_id },
      }),
    ]);

    return {
      data,
      totalCount,
      currentPage: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
    };
  }

  @Get('snapshot/stock-levels')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getSnapshotStockLevels(
    @Req() req: Request,
    @Query(PaginationPipe) pagination: PaginationParams,
  ) {
    const tenant_id = req.headers['x-tenant-id'] as string;
    const skip = (pagination.page - 1) * pagination.pageSize;

    const [data, totalCount] = await Promise.all([
      this.prisma.stock_levels.findMany({
        where: { tenant_id },
        skip,
        take: pagination.pageSize,
      }),
      this.prisma.stock_levels.count({
        where: { tenant_id },
      }),
    ]);

    return {
      data,
      totalCount,
      currentPage: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
    };
  }

  @Get('snapshot/prices')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getSnapshotPrices(
    @Req() req: Request,
    @Query(PaginationPipe) pagination: PaginationParams,
  ) {
    const tenant_id = req.headers['x-tenant-id'] as string;
    const skip = (pagination.page - 1) * pagination.pageSize;

    const [data, totalCount] = await Promise.all([
      this.prisma.price_versions.findMany({
        where: { tenant_id, is_current: true },
        skip,
        take: pagination.pageSize,
      }),
      this.prisma.price_versions.count({
        where: { tenant_id, is_current: true },
      }),
    ]);

    return {
      data,
      totalCount,
      currentPage: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
    };
  }

  // --- Delta individual paginated endpoints ---

  @Get('delta/item-masters')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getDeltaItemMasters(
    @Req() req: Request,
    @Query(PaginationPipe) pagination: PaginationParams,
    @Query('since') since?: string,
  ) {
    const tenant_id = req.headers['x-tenant-id'] as string;
    const anchorDate = since ? new Date(since) : new Date(0);
    const skip = (pagination.page - 1) * pagination.pageSize;

    const where = { tenant_id, updated_at: { gt: anchorDate } };

    const [data, totalCount] = await Promise.all([
      this.prisma.item_masters.findMany({ where, skip, take: pagination.pageSize }),
      this.prisma.item_masters.count({ where }),
    ]);

    return {
      data,
      totalCount,
      currentPage: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
    };
  }

  @Get('delta/staff')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getDeltaStaff(
    @Req() req: Request,
    @Query(PaginationPipe) pagination: PaginationParams,
    @Query('since') since?: string,
  ) {
    const tenant_id = req.headers['x-tenant-id'] as string;
    const anchorDate = since ? new Date(since) : new Date(0);
    const skip = (pagination.page - 1) * pagination.pageSize;

    const where = { tenant_id, updated_at: { gt: anchorDate } };

    const [data, totalCount] = await Promise.all([
      this.prisma.employees.findMany({ where, skip, take: pagination.pageSize }),
      this.prisma.employees.count({ where }),
    ]);

    return {
      data,
      totalCount,
      currentPage: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
    };
  }

  @Get('delta/stock-levels')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getDeltaStockLevels(
    @Req() req: Request,
    @Query(PaginationPipe) pagination: PaginationParams,
    @Query('since') since?: string,
  ) {
    const tenant_id = req.headers['x-tenant-id'] as string;
    const anchorDate = since ? new Date(since) : new Date(0);
    const skip = (pagination.page - 1) * pagination.pageSize;

    const where = { tenant_id, updated_at: { gt: anchorDate } };

    const [data, totalCount] = await Promise.all([
      this.prisma.stock_levels.findMany({ where, skip, take: pagination.pageSize }),
      this.prisma.stock_levels.count({ where }),
    ]);

    return {
      data,
      totalCount,
      currentPage: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
    };
  }

  // --- Retail storefront mirror: customers & orders ---

  @Get('snapshot/retail-customers')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getSnapshotRetailCustomers(
    @Req() req: Request,
    @Query(PaginationPipe) pagination: PaginationParams,
  ) {
    const tenant_id = req.headers['x-tenant-id'] as string;
    const skip = (pagination.page - 1) * pagination.pageSize;

    const where = { tenant_id, ecommerce_id: { not: null } };
    const [data, totalCount] = await Promise.all([
      this.prisma.retail_customers.findMany({
        where,
        skip,
        take: pagination.pageSize,
        orderBy: { updated_at: 'asc' },
      }),
      this.prisma.retail_customers.count({ where }),
    ]);

    return {
      data,
      totalCount,
      currentPage: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
    };
  }

  @Get('delta/retail-customers')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getDeltaRetailCustomers(
    @Req() req: Request,
    @Query(PaginationPipe) pagination: PaginationParams,
    @Query('since') since?: string,
  ) {
    const tenant_id = req.headers['x-tenant-id'] as string;
    const anchorDate = since ? new Date(since) : new Date(0);
    const skip = (pagination.page - 1) * pagination.pageSize;

    const where = { tenant_id, ecommerce_id: { not: null }, updated_at: { gt: anchorDate } };
    const [data, totalCount] = await Promise.all([
      this.prisma.retail_customers.findMany({
        where,
        skip,
        take: pagination.pageSize,
        orderBy: { updated_at: 'asc' },
      }),
      this.prisma.retail_customers.count({ where }),
    ]);

    return {
      data,
      totalCount,
      currentPage: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
    };
  }

  @Get('snapshot/retail-orders')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getSnapshotRetailOrders(
    @Req() req: Request,
    @Query(PaginationPipe) pagination: PaginationParams,
  ) {
    const tenant_id = req.headers['x-tenant-id'] as string;
    const skip = (pagination.page - 1) * pagination.pageSize;

    const where = { tenant_id, ecommerce_id: { not: null } };
    const [data, totalCount] = await Promise.all([
      this.prisma.retail_orders.findMany({
        where,
        skip,
        take: pagination.pageSize,
        orderBy: { updated_at: 'asc' },
        include: { retail_order_items: true },
      }),
      this.prisma.retail_orders.count({ where }),
    ]);

    return {
      data,
      totalCount,
      currentPage: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
    };
  }

  @Get('delta/retail-orders')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getDeltaRetailOrders(
    @Req() req: Request,
    @Query(PaginationPipe) pagination: PaginationParams,
    @Query('since') since?: string,
  ) {
    const tenant_id = req.headers['x-tenant-id'] as string;
    const anchorDate = since ? new Date(since) : new Date(0);
    const skip = (pagination.page - 1) * pagination.pageSize;

    const where = { tenant_id, ecommerce_id: { not: null }, updated_at: { gt: anchorDate } };
    const [data, totalCount] = await Promise.all([
      this.prisma.retail_orders.findMany({
        where,
        skip,
        take: pagination.pageSize,
        orderBy: { updated_at: 'asc' },
        include: { retail_order_items: true },
      }),
      this.prisma.retail_orders.count({ where }),
    ]);

    return {
      data,
      totalCount,
      currentPage: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
    };
  }

  // --- Legacy consolidated endpoints (backward-compatible, paginated internally) ---

  @Get('snapshot')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getSnapshot(
    @Req() req: Request,
    @Query(PaginationPipe) pagination: PaginationParams,
  ) {
    const tenant_id = req.headers['x-tenant-id'] as string;
    const skip = (pagination.page - 1) * pagination.pageSize;

    const [itemMaster, staff, locations, stockLevels, prices, company] = await Promise.all([
      this.prisma.item_masters.findMany({
        where: { tenant_id, status: 'active' },
        skip,
        take: pagination.pageSize,
      }),
      this.prisma.employees.findMany({
        where: { tenant_id, status: 'active' },
        skip,
        take: pagination.pageSize,
      }),
      this.prisma.locations.findMany({
        where: { tenant_id },
        skip,
        take: pagination.pageSize,
      }),
      this.prisma.stock_levels.findMany({
        where: { tenant_id },
        skip,
        take: pagination.pageSize,
      }),
      this.prisma.price_versions.findMany({
        where: { tenant_id, is_current: true },
        skip,
        take: pagination.pageSize,
      }),
      this.prisma.companies.findUnique({ where: { id: tenant_id } }),
    ]);

    return {
      success: true,
      timestamp: new Date().toISOString(),
      pagination: {
        currentPage: pagination.page,
        pageSize: pagination.pageSize,
      },
      data: {
        itemMaster,
        staff,
        locations,
        stockLevels,
        prices,
      },
    };
  }

  @Get('delta')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getDelta(
    @Req() req: Request,
    @Query(PaginationPipe) pagination: PaginationParams,
    @Query('since') since?: string,
  ) {
    const tenant_id = req.headers['x-tenant-id'] as string;
    const anchorDate = since ? new Date(since) : new Date(0);
    const skip = (pagination.page - 1) * pagination.pageSize;

    const [itemMaster, staff, stockLevels] = await Promise.all([
      this.prisma.item_masters.findMany({
        where: { tenant_id, updated_at: { gt: anchorDate } },
        skip,
        take: pagination.pageSize,
      }),
      this.prisma.employees.findMany({
        where: { tenant_id, updated_at: { gt: anchorDate } },
        skip,
        take: pagination.pageSize,
      }),
      this.prisma.stock_levels.findMany({
        where: { tenant_id, updated_at: { gt: anchorDate } },
        skip,
        take: pagination.pageSize,
      }),
    ]);

    return {
      success: true,
      timestamp: new Date().toISOString(),
      pagination: {
        currentPage: pagination.page,
        pageSize: pagination.pageSize,
      },
      data: {
        itemMaster,
        staff,
        stockLevels,
      },
    };
  }

  // --- Reconciliation & Health endpoints ---

  /**
   * GET /sync/reconciliation/:tenantId
   *
   * Exposes per-location stock levels, pending unsynced quantities, and last sync timestamps.
   * Estimates pending quantities for locations whose last sync exceeds 2× heartbeat interval.
   *
   * Requirements: 7.6
   */
  @Get('reconciliation/:tenantId')
  async getReconciliationReport(@Param('tenantId') tenantId: string) {
    return this.syncEngineService.getReconciliationReport(tenantId);
  }

  /**
   * GET /sync/health/:locationId
   *
   * Returns last sync timestamp, pending/failed operation counts,
   * average sync latency (60-min rolling window).
   *
   * Requirements: 8.5
   */
  @Get('health/:locationId')
  async getHealthMetrics(@Param('locationId') locationId: string) {
    return this.syncEngineService.getHealthMetrics(locationId);
  }
}
