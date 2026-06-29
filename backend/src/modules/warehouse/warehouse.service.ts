import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../persistence/prisma.service';
import { IWarehouseRepository } from './repositories/interfaces/warehouse.repository.interface';
import { TenantContext } from '../../gateway/tenant-context.interface';
import { MultiTenancyUtil } from '../../shared/utils/multi-tenancy.util';
import { mapPrismaError } from '../../core/_shared/errors/prisma-error.mapper';
import { CreateBinDto } from './dto/create-bin.dto';

@Injectable()
export class WarehouseService {
  private readonly logger = new Logger(WarehouseService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(IWarehouseRepository)
    private readonly warehouseRepo: IWarehouseRepository,
  ) {}

  async getBins(ctx: TenantContext, locationId: string, skip?: number, take?: number) {
    return (this.prisma as any).warehouse_bins.findMany({
      where: MultiTenancyUtil.getScope(ctx, { location_id: locationId }),
      include: {
        bin_assignments: {
          include: {
            item_masters: true,
          },
        },
      },
      ...(skip !== undefined && { skip }),
      ...(take !== undefined && { take }),
    });
  }

  async countBins(ctx: TenantContext, locationId: string): Promise<number> {
    return (this.prisma as any).warehouse_bins.count({
      where: MultiTenancyUtil.getScope(ctx, { location_id: locationId }),
    });
  }

  async createBin(ctx: TenantContext, locationId: string, data: CreateBinDto) {
    try {
      return await (this.prisma as any).warehouse_bins.create({
        data: MultiTenancyUtil.wrapCreate(ctx, {
          ...data,
          location_id: locationId,
        }),
      });
    } catch (error) {
      mapPrismaError(error, 'WarehouseBin');
    }
  }

  async getBinStock(ctx: TenantContext, binId: string, skip?: number, take?: number) {
    return (this.prisma as any).bin_assignments.findMany({
      where: MultiTenancyUtil.getScope(ctx, { bin_id: binId }),
      include: {
        item_masters: true,
      },
      ...(skip !== undefined && { skip }),
      ...(take !== undefined && { take }),
    });
  }

  async countBinStock(ctx: TenantContext, binId: string): Promise<number> {
    return (this.prisma as any).bin_assignments.count({
      where: MultiTenancyUtil.getScope(ctx, { bin_id: binId }),
    });
  }

  async assignStock(ctx: TenantContext, binId: string, data: { product_id: string; quantity: number }) {
    // Upsert assignment
    const existing = await (this.prisma as any).bin_assignments.findFirst({
      where: MultiTenancyUtil.getScope(ctx, {
        bin_id: binId,
        product_id: data.product_id,
      }),
    });

    if (existing) {
      return (this.prisma as any).bin_assignments.update({
        where: { id: existing.id },
        data: {
          qty: Number(existing.qty) + data.quantity,
        },
      });
    }

    return (this.prisma as any).bin_assignments.create({
      data: MultiTenancyUtil.wrapCreate(ctx, {
        bin_id: binId,
        product_id: data.product_id,
        qty: data.quantity,
      }),
    });
  }
}
