import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  BadRequestException,
} from "@nestjs/common";
import { Request } from "express";
import { WarehouseService } from "./warehouse.service";
import { TenantContext } from "../../gateway/tenant-context.interface";
import { TenantInterceptor } from "../../gateway/tenant.interceptor";
import { ModuleStateGuard } from "../../core/auth/guards/module-state.guard";
import { RolesGuard } from "../../shared/guards/roles.guard";
import { RequiredModule } from "../../shared/decorators/required-module.decorator";
import { PaginationPipe, PaginationParams } from "../../shared/pipes/pagination.pipe";
import { CacheInterceptor, CacheTTL, CacheInvalidationHelper } from "../../shared/cache";
import { CreateBinDto } from "./dto/create-bin.dto";

interface RequestWithTenant extends Request {
  tenantContext: TenantContext;
}

@Controller('warehouse')
@UseGuards(ModuleStateGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
@RequiredModule("inventory")
export class WarehouseController {
  constructor(
    private readonly warehouseService: WarehouseService,
    private readonly cacheHelper: CacheInvalidationHelper,
  ) {}

  @Get("bins")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getBins(
    @Req() request: RequestWithTenant,
    @Query("locationId") locationId: string,
    @Query(PaginationPipe) pagination: PaginationParams,
  ) {
    const ctx = request.tenantContext;
    const skip = (pagination.page - 1) * pagination.pageSize;
    const [data, totalCount] = await Promise.all([
      this.warehouseService.getBins(ctx, locationId, skip, pagination.pageSize),
      this.warehouseService.countBins(ctx, locationId),
    ]);
    return {
      data,
      totalCount,
      currentPage: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
    };
  }

  @Post("bins")
  async createBin(
    @Req() request: RequestWithTenant,
    @Query("locationId") locationId: string,
    @Body() data: CreateBinDto,
  ) {
    if (!locationId) {
      throw new BadRequestException('locationId query parameter is required.');
    }
    const ctx = request.tenantContext;
    const bin = await this.warehouseService.createBin(ctx, locationId, data);
    await this.cacheHelper.invalidateAll();
    return { success: true, data: bin };
  }

  @Get("bins/:binId/stock")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getBinStock(
    @Req() request: RequestWithTenant,
    @Param("binId") binId: string,
    @Query(PaginationPipe) pagination: PaginationParams,
  ) {
    const ctx = request.tenantContext;
    const skip = (pagination.page - 1) * pagination.pageSize;
    const [data, totalCount] = await Promise.all([
      this.warehouseService.getBinStock(ctx, binId, skip, pagination.pageSize),
      this.warehouseService.countBinStock(ctx, binId),
    ]);
    return {
      data,
      totalCount,
      currentPage: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
    };
  }

  @Post("bins/:binId/assign")
  async assignStock(
    @Req() request: RequestWithTenant,
    @Param("binId") binId: string,
    @Body() data: { product_id: string; quantity: number },
  ) {
    const ctx = request.tenantContext;
    const assignment = await this.warehouseService.assignStock(
      ctx,
      binId,
      data,
    );
    await this.cacheHelper.invalidateAll();
    return { success: true, data: assignment };
  }
}
