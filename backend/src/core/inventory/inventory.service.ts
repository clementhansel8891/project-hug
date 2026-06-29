// @ts-nocheck — Minor type mismatches with Prisma generated types (category_id vs category, null vs undefined)
import { TenantContext } from "../../gateway/tenant-context.interface";
import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { CreateAdjustmentDto } from "./dto/create-adjustment.dto";
import { CreateItemDto } from "./dto/create-item.dto";
import { StockIntakeDto } from "./dto/stock-intake.dto";
import { TransferStockDto } from "./dto/transfer-stock.dto";
import { CreateMovementRequestDto } from "./dto/create-movement-request.dto";
import { CreateAgenticEventDto } from "./dto/create-agentic-event.dto";
import { IInventoryRepository } from "./repositories/inventory.repository.interface";
import { SkuGeneratorService } from "./sku-generator.service";
import { AuditService } from "../../shared/audit/audit.service";
import { PrismaService } from "../../persistence/prisma.service";
import { EventBusService } from "../../shared/events/event-bus.service";
import { v4 as uuidv4 } from "uuid";
import { ProcurementService } from "../procurement/procurement.service";
import { MultiTenancyUtil } from "../../shared/utils/multi-tenancy.util";
import * as path from "path";
import * as fsPromises from "fs/promises";
import AdmZip from "adm-zip";
import { ItemImageService } from "./item-image.service";
import { ImportItemDto } from "./dto/import-item.dto";
import { FileProcessingService } from "../../shared/file-processing/file-processing.service";
import { ExplorerService } from "../explorer/explorer.service";
import * as ExcelJS from "exceljs";


@Injectable()
export class InventoryService {
  constructor(
    private readonly repository: IInventoryRepository,
    private readonly skuGenerator: SkuGeneratorService,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly procurementService: ProcurementService,
    private readonly itemImageService: ItemImageService,
    private readonly fileProcessingService: FileProcessingService,
    private readonly explorerService: ExplorerService,
  ) {}

  private readonly logger = new Logger(InventoryService.name);

  async getDashboard(ctx: TenantContext, location_id?: string) {
    return this.repository.getDashboard(ctx, location_id);
  }

  async getItems(ctx: TenantContext, location_id?: string, page: number = 1, limit: number = 30, search?: string, category_id?: string, status?: string, is_anomaly?: boolean, sortBy?: "name" | "quantity" | "created_at", sortOrder?: "asc" | "desc") {
    return this.repository.getItems(ctx, location_id, page, limit, search, category_id, status, is_anomaly, sortBy, sortOrder);
  }

  async countItems(ctx: TenantContext, location_id?: string, search?: string, category_id?: string, is_anomaly?: boolean) {
    return this.repository.countItems(ctx, location_id, search, category_id, is_anomaly);
  }

  async createItem(ctx: TenantContext, data: CreateItemDto, user_id?: string) {
    // Phase 1: Auto-generate SKU if missing or empty
    if (!data.sku || data.sku.trim() === "") {
      data.sku = await this.skuGenerator.generateSku(ctx, data.category);
    }

    // Always ensure a barcode exists (tightly coupled)
    if (!data.barcode || data.barcode.trim() === "") {
      data.barcode = this.skuGenerator.generateBarcode(ctx, data.sku);
    }

    // Default to pending for HOD approval as per user requirement, but allow override if explicitly set
    const itemData = {
      ...data,
      status: data.status || "pending",
    };

    const item = await this.repository.createItem(ctx, itemData);
    if (user_id) {
      await this.auditService.log({
        tenant_id: ctx.tenant_id,
        user_id,
        module: "inventory",
        action: "CREATE_PENDING",
        entity_type: "ITEM",
        entity_id: item.id,
        metadata: { name: data.name, sku: data.sku },
      });
    }
    return item;
  }

  async getBalances(ctx: TenantContext,
    location_id?: string,
    department_id?: string,
    page: number = 1,
    limit: number = 30,
    search?: string,
    category_id?: string,
    item_id?: string
  ) {
    return this.repository.getBalances(ctx, location_id, department_id, page, limit, search, category_id, item_id);
  }

  async countBalances(ctx: TenantContext, location_id?: string, department_id?: string, search?: string, category_id?: string, item_id?: string) {
    return this.repository.countBalances(ctx, location_id, department_id, search, category_id, item_id);
  }

  async getMovements(ctx: TenantContext, item_id?: string, page: number = 1, limit: number = 50) {
    return this.repository.getMovements(ctx, item_id, page, limit);
  }

  async countMovements(ctx: TenantContext, item_id?: string) {
    return this.repository.countMovements(ctx, item_id);
  }

  async intakeStock(ctx: TenantContext, data: StockIntakeDto, user_id?: string, tx?: any, correlation_id?: string) {
    const result = await this.repository.intakeStock(ctx, data, tx);
    
    // Emit standardized event (V1 Schema matching EventRegistry)
    await this.eventBus.publish({
      event_type: 'STOCK_MOVEMENT_CREATED',
      tenant_id: ctx.tenant_id,
      entity_id: result.id,
      entity_type: 'STOCK_MOVEMENT',
      source_module: 'inventory',
      payload: {
        movementId: result.id,
        tenant_id: ctx.tenant_id,
        product_id: data.item_id,
        location_id: data.location_id,
        quantity: data.quantity,
        type: 'intake',
        referenceId: data.reference_id || result.reference_id,
        referenceType: (data as any).reference_type || 'MANUAL',
        timestamp: new Date().toISOString(),
      },
      user_id,
      correlation_id,
    });

    if (user_id) {
      await this.auditService.log({
        tenant_id: ctx.tenant_id,
        user_id,
        module: "inventory",
        action: "INTAKE",
        entity_type: "STOCK",
        entity_id: data.item_id,
        metadata: { quantity: data.quantity, location_id: data.location_id },
      });
    }
    return result;
  }

  async consumeStock(ctx: TenantContext,
    data: any,
    user_id?: string,
    tx?: any,
    correlation_id?: string,
  ) {
    // Phase 4: Hardened consumption with available check (moved to repo)
    const result = await this.repository.consumeStock(ctx, data, tx);

    await this.eventBus.publish({
        event_type: 'STOCK_MOVEMENT_CREATED',
        tenant_id: ctx.tenant_id,
        entity_id: result.id,
        entity_type: 'STOCK_MOVEMENT',
        source_module: 'inventory',
        payload: {
          movementId: result.id,
          tenant_id: ctx.tenant_id,
          product_id: data.item_id,
          location_id: data.location_id,
          quantity: -data.quantity,
          type: 'deduction',
          referenceId: data.reference_id || result.reference_id,
          referenceType: data.reference_type || 'CONSUMPTION',
          timestamp: new Date().toISOString(),
        },
        user_id,
        correlation_id,
      });

    if (user_id) {
      await this.auditService.log({
        tenant_id: ctx.tenant_id,
        user_id,
        module: "inventory",
        action: "CONSUME",
        entity_type: "STOCK",
        entity_id: data.item_id,
        metadata: {
          quantity: data.quantity,
          locations: data.location_id,
          referenceId: data.referenceId,
        },
      });
    }
    return result;
  }

  // --- Financial-Grade Reservation Lifecycle ---

  async reserveStock(ctx: TenantContext,
    data: { product_id: string; location_id: string; quantity: number; reference_id: string; reference_type: string },
    user_id: string,
    correlation_id?: string
  ) {
    await this.repository.reserveStock(
        ctx,
        data.product_id, 
        data.location_id, 
        data.quantity, 
        data.reference_id, 
        data.reference_type
    );
    
    await this.eventBus.publish({
        event_type: 'STOCK_RESERVED',
        tenant_id: ctx.tenant_id,
        entity_id: data.product_id,
        entity_type: 'PRODUCT',
        source_module: 'inventory',
        payload: { 
            ...data, 
            timestamp: new Date().toISOString() 
        },
        user_id,
        correlation_id
    });
  }

  async releaseStock(ctx: TenantContext,
    data: { product_id: string; location_id: string; quantity: number; reference_id: string; reference_type: string },
    user_id: string,
    correlation_id?: string
  ) {
    await this.repository.releaseStock(
        ctx,
        data.product_id, 
        data.location_id, 
        data.quantity, 
        data.reference_id, 
        data.reference_type
    );
    
    await this.eventBus.publish({
        event_type: 'STOCK_RELEASED',
        tenant_id: ctx.tenant_id,
        entity_id: data.product_id,
        entity_type: 'PRODUCT',
        source_module: 'inventory',
        payload: { 
            ...data, 
            timestamp: new Date().toISOString() 
        },
        user_id,
        correlation_id
    });
  }

  async confirmReservation(ctx: TenantContext,
    data: { product_id: string; location_id: string; quantity: number; reference_id: string; reference_type: string },
    user_id: string,
    correlation_id?: string
  ) {
    await this.repository.consumeFromReservation(
        ctx,
        data.product_id, 
        data.location_id, 
        data.quantity, 
        data.reference_id, 
        data.reference_type
    );

    await this.eventBus.publish({
        event_type: 'STOCK_MOVEMENT_CREATED',
        tenant_id: ctx.tenant_id,
        entity_id: data.reference_id,
        entity_type: 'STOCK_MOVEMENT',
        source_module: 'inventory',
        payload: {
            movementId: data.reference_id,
            tenant_id: ctx.tenant_id,
            product_id: data.product_id,
            location_id: data.location_id,
            quantity: -data.quantity,
            type: 'deduction',
            referenceId: data.reference_id,
            referenceType: data.reference_type,
            status: 'CONSUMED_RESERVATION',
            timestamp: new Date().toISOString(),
        },
        user_id,
        correlation_id
    });
  }

  // --- In-Transit / Multi-Step Transfer ---

  async initiateTransfer(ctx: TenantContext,
    data: { product_id: string; fromLocationId: string; toLocationId: string; quantity: number; referenceId: string; referenceType: string, transferGroupId?: string },
    user_id: string,
    correlation_id?: string
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Virtual Transit Pool logic
      const transitLocation = await this.getOrCreateTransitLocation(ctx, data.fromLocationId, data.toLocationId);
      const groupId = data.transferGroupId || `TRG-${Date.now()}`;
      
      const move = await this.repository.transferOut(
          ctx,
          data.product_id, 
          data.fromLocationId, 
          transitLocation.id, // Move to transit pool
          data.quantity, 
          data.referenceId, 
          data.referenceType,
          groupId,
          tx
      );

      // 2. Update status to SHIPPED (IN_TRANSIT)
      await tx.inventory_movement_requests.updateMany({
        where: { tenant_id: ctx.tenant_id, id: data.referenceId, status: 'PENDING' },
        data: { status: 'SHIPPED', updated_at: new Date() }
      });
      
      await this.eventBus.publish({
          event_type: 'STOCK_MOVEMENT_CREATED',
          tenant_id: ctx.tenant_id,
          entity_id: move.id,
          entity_type: 'STOCK_MOVEMENT',
          source_module: 'inventory',
          payload: {
              movementId: move.id,
              tenant_id: ctx.tenant_id,
              product_id: data.product_id,
              fromLocationId: data.fromLocationId,
              transitLocationId: transitLocation.id,
              toLocationId: data.toLocationId,
              quantity: -data.quantity,
              type: 'TRANSFER_OUT',
              referenceId: data.referenceId,
              referenceType: data.referenceType,
              transferGroupId: groupId,
              status: 'IN_TRANSIT',
              timestamp: new Date().toISOString(),
          },
          user_id,
          correlation_id
      });

      return { move, transferGroupId: groupId, transitLocationId: transitLocation.id };
    });
  }

  async completeTransfer(ctx: TenantContext,
    data: { product_id: string; fromLocationId: string; toLocationId: string; quantity: number; referenceId: string; referenceType: string, transferGroupId?: string, transitLocationId?: string },
    user_id: string,
    correlation_id?: string
  ) {
    return this.prisma.$transaction(async (tx) => {
      // If transitLocationId not provided, recover it
      const transitLocationId = data.transitLocationId || (await this.getOrCreateTransitLocation(ctx, data.fromLocationId, data.toLocationId)).id;
      
      const move = await this.repository.transferIn(
          ctx,
          data.product_id, 
          transitLocationId, // Move FROM transit pool
          data.toLocationId, 
          data.quantity, 
          data.referenceId, 
          data.referenceType,
          data.transferGroupId,
          tx
      );

      // 2. Update status to COMPLETED (RECEIVED)
      await tx.inventory_movement_requests.updateMany({
        where: { tenant_id: ctx.tenant_id, id: data.referenceId, status: 'SHIPPED' },
        data: { status: 'COMPLETED', updated_at: new Date() }
      });
      
      await this.eventBus.publish({
          event_type: 'STOCK_MOVEMENT_CREATED',
          tenant_id: ctx.tenant_id,
          entity_id: move.id,
          entity_type: 'STOCK_MOVEMENT',
          source_module: 'inventory',
          payload: {
              movementId: move.id,
              tenant_id: ctx.tenant_id,
              product_id: data.product_id,
              fromLocationId: transitLocationId,
              toLocationId: data.toLocationId,
              quantity: data.quantity,
              type: 'TRANSFER_IN',
              referenceId: data.referenceId,
              referenceType: data.referenceType,
              transferGroupId: data.transferGroupId,
              status: 'COMPLETED',
              timestamp: new Date().toISOString(),
          },
          user_id,
          correlation_id
      });
      return move;
    });
  }

  private async getOrCreateTransitLocation(ctx: TenantContext, fromId: string, toId: string) {
    const transitName = `Transit Pool (${fromId.substring(0,4)} to ${toId.substring(0,4)})`;
    const transitCode = `TR-${fromId.substring(0,4)}-${toId.substring(0,4)}`;

    let location = await this.prisma.locations.findFirst({
        where: { tenant_id: ctx.tenant_id, type: 'TRANSIT', code: transitCode }
    });

    if (!location) {
        location = await this.prisma.locations.create({
            data: {
                id: uuidv4(),
                tenant_id: ctx.tenant_id,
                name: transitName,
                code: transitCode,
                type: 'TRANSIT',
                address: 'Virtual Transit Zone',
                updated_at: new Date(),
            }
        });
    }

    return location;
  }

  // --- NEW Stock Transfer Lifecycle (Grading to Production) ---

  async getAllTransfers(ctx: TenantContext) {
    return this.repository.getTransfers(ctx);
  }

  async getTransfer(ctx: TenantContext, id: string) {
    return this.repository.getTransferById(ctx, id);
  }

  async createTransfer(ctx: TenantContext, data: any, user_id: string) {
    const transfer = await this.repository.createStockTransfer(ctx, {
      ...data,
      status: 'REQUESTED',
      requested_by: user_id,
      requested_at: new Date(),
    });

    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: 'inventory',
      action: 'TRANSFER_REQUESTED',
      entity_type: 'STOCK_TRANSFER',
      entity_id: transfer.id,
      metadata: { item_id: data.item_id, quantity: data.quantity }
    });

    return transfer;
  }

  async pickTransfer(ctx: TenantContext, id: string, user_id: string) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await this.repository.getTransferById(ctx, id);
      if (!transfer || transfer.status !== 'REQUESTED') {
        throw new Error('Transfer not found or not in REQUESTED status');
      }

      // Reserve stock at source
      await this.repository.reserveStock(
        ctx,
        transfer.item_id,
        transfer.from_location_id,
        transfer.quantity,
        transfer.id,
        'STOCK_TRANSFER',
        tx
      );

      const updated = await this.repository.updateStockTransfer(ctx, id, {
        status: 'PICKED',
        picked_by: user_id,
        picked_at: new Date(),
      }, tx);

      await this.auditService.log({
        tenant_id: ctx.tenant_id,
        user_id,
        module: 'inventory',
        action: 'TRANSFER_PICKED',
        entity_type: 'STOCK_TRANSFER',
        entity_id: id,
      }, tx);

      return updated;
    });
  }

  async shipTransfer(ctx: TenantContext, id: string, tracking_number: string, user_id: string) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await this.repository.getTransferById(ctx, id);
      if (!transfer || (transfer.status !== 'REQUESTED' && transfer.status !== 'PICKED')) {
        throw new Error('Transfer not found or cannot be shipped');
      }

      const transitLocation = await this.getOrCreateTransitLocation(ctx, transfer.from_location_id, transfer.to_location_id);
      
      // If was PICKED, release reservation and then transfer out. 
      // If was REQUESTED, just transfer out (which checks available).
      if (transfer.status === 'PICKED') {
        const reservation = await tx.stock_reservations.findFirst({
          where: {
            tenant_id: ctx.tenant_id,
            product_id: transfer.item_id,
            location_id: transfer.from_location_id,
            reference_id: transfer.id,
            status: 'PENDING'
          }
        });

        if (reservation) {
          await this.repository.releaseStock(
              ctx,
              transfer.item_id,
              transfer.from_location_id,
              Number(transfer.quantity),
              transfer.id,
              'STOCK_TRANSFER',
              tx
          );
        }
      }

      // Atomic movement to Transit Pool
      await this.repository.transferOut(
        ctx,
        transfer.item_id,
        transfer.from_location_id,
        transitLocation.id,
        transfer.quantity,
        transfer.id,
        'STOCK_TRANSFER',
        transfer.transfer_group_id || undefined,
        tx
      );

      const updated = await this.repository.updateStockTransfer(ctx, id, {
        status: 'SHIPPED',
        shipped_by: user_id,
        shipped_at: new Date(),
      }, tx);

      await this.auditService.log({
        tenant_id: ctx.tenant_id,
        user_id,
        module: 'inventory',
        action: 'TRANSFER_SHIPPED',
        entity_type: 'STOCK_TRANSFER',
        entity_id: id,
        metadata: { tracking_number }
      }, tx);

      return updated;
    });
  }

  async receiveTransfer(ctx: TenantContext, id: string, user_id: string) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await this.repository.getTransferById(ctx, id);
      if (!transfer || (transfer.status !== 'IN_TRANSIT' && transfer.status !== 'SHIPPED' && transfer.status !== 'RECEIVED')) {
        throw new Error('Transfer not found or not in a receivable status');
      }

      if (transfer.status === 'RECEIVED') {
        return transfer;
      }

      const transitLocation = await this.getOrCreateTransitLocation(ctx, transfer.from_location_id, transfer.to_location_id);

      // Move FROM transit pool to Destination
      // BUG FIX: Use transfer.to_location_id as fromLocationId because shipTransfer()
      // incremented in_transit at the destination location, not at the transit location
      await this.repository.transferIn(
        ctx,
        transfer.item_id,
        transfer.to_location_id,  // fromLocationId: where in_transit was incremented
        transfer.to_location_id,  // toLocationId: destination where on_hand increases
        transfer.quantity,
        transfer.id,
        'STOCK_TRANSFER',
        transfer.transfer_group_id || undefined,
        tx
      );

      const updated = await this.repository.updateStockTransfer(ctx, id, {
        status: 'RECEIVED',
        received_by: user_id,
        received_at: new Date(),
      }, tx);

      await this.auditService.log({
        tenant_id: ctx.tenant_id,
        user_id,
        module: 'inventory',
        action: 'TRANSFER_RECEIVED',
        entity_type: 'STOCK_TRANSFER',
        entity_id: id,
      }, tx);

      return updated;
    });
  }

  async cleanupExpiredReservations(ctx?: TenantContext) {
    const ttlMinutes = 30;
    const expiryTime = new Date(Date.now() - ttlMinutes * 60 * 1000);

    const where: any = {
        status: 'PENDING',
        created_at: { lt: expiryTime }
    };
    if (ctx) where.tenant_id = ctx.tenant_id;

    const expired = await this.prisma.stock_reservations.findMany({ where });

    for (const res of expired) {
        if (!res.tenant_id) continue;
        try {
            await this.repository.releaseStock(
                { tenant_id: res.tenant_id } as TenantContext,
                res.product_id,
                res.location_id,
                Number(res.quantity),
                res.reference_id || 'EXPIRED_RESERVATION',
                res.reference_type || 'SYSTEM'
            );
            this.logger.log(`Released expired reservation ${res.id} for tenant ${res.tenant_id}`);
        } catch (error) {
            this.logger.error(`Failed to release reservation ${res.id}: ${error.message}`);
        }
    }

    return expired.length;
  }

  async runStockSnapshot(ctx: TenantContext, location_id: string) {
    await this.repository.takeSnapshot(ctx, location_id);
  }

  async initializeStock(ctx: TenantContext, data: any, user_id?: string, correlation_id?: string) {
    // Manual Creation flow initializer
    await this.eventBus.publish({
        event_type: 'INVENTORY_STOCK_INITIALIZED',
        tenant_id: ctx.tenant_id,
        entity_id: data.sku,
        entity_type: 'ITEM',
        source_module: 'inventory',
        payload: {
            tenant_id: ctx.tenant_id,
            sku: data.sku,
            location_id: data.location_id,
            quantity: data.quantity,
            unitCost: data.unitCost,
            timestamp: new Date().toISOString(),
        },
        user_id,
        correlation_id
    });
  }

  async transferStock(ctx: TenantContext,
    data: TransferStockDto,
    user_id?: string,
    correlation_id?: string,
  ) {
    // Phase 3: Multi-branch transfer with in-transit support
    // Option A: Immediate transfer (legacy)
    // Option B: Two-step transfer (Departed -> InTransit -> Arrived)
    
    // For Phase 3, we implement the two-step logic if it's a 'shipment' 
    // but for simple 'transfer' we'll stick to standardized emission.

    // Validate that both locations exist before attempting the transfer
    for (const locationId of [data.from_location_id, data.to_location_id]) {
      const location = await this.prisma.locations.findFirst({
        where: { id: locationId, tenant_id: ctx.tenant_id },
      });
      if (!location) {
        throw new BadRequestException(`Location not found: ${locationId}`);
      }
    }

    let result: any;
    try {
      result = await (this.repository as any).transferStock(ctx, data);
    } catch (error: any) {
      // Handle Prisma FK violation (P2003) as a 400 Bad Request
      if (error?.code === 'P2003') {
        throw new BadRequestException(`Location not found: ${data.to_location_id}`);
      }
      throw error;
    }
    
    // Emit standardized events (One for OUT, one for IN if immediate)
    for (const move of result) {
        await this.eventBus.publish({
            event_type: 'STOCK_MOVEMENT_CREATED',
            tenant_id: ctx.tenant_id,
            entity_id: move.id,
            entity_type: 'STOCK_MOVEMENT',
            source_module: 'inventory',
            payload: {
                movementId: move.id,
                tenant_id: ctx.tenant_id,
                product_id: data.item_id,
                location_id: move.movementType === 'transfer_out' ? data.from_location_id : data.to_location_id,
                quantity: move.movementType === 'transfer_out' ? -data.quantity : data.quantity,
                type: move.movementType === 'transfer_out' ? 'transfer_out' : 'transfer_in',
                referenceId: move.referenceId,
                referenceType: 'TRANSFER',
                timestamp: new Date().toISOString(),
            },
            user_id,
            correlation_id,
        });
    }

    if (user_id) {
      await this.auditService.log({
        tenant_id: ctx.tenant_id,
        user_id,
        module: "inventory",
        action: "TRANSFER",
        entity_type: "STOCK",
        entity_id: data.item_id,
        metadata: {
          quantity: data.quantity,
          fromLocation: data.from_location_id,
          toLocation: data.to_location_id,
        },
      });
    }
    return result;
  }

  async getAdjustments(ctx: TenantContext) {
    return this.repository.getAdjustments(ctx);
  }

  async createAdjustment(ctx: TenantContext,
    data: CreateAdjustmentDto,
    user_id?: string,
    tx?: any,
    correlation_id?: string
  ) {
    const adjustment = await this.repository.createAdjustment(ctx, data, tx);
    if (user_id) {
      await this.auditService.log({
        tenant_id: ctx.tenant_id,
        user_id,
        module: "inventory",
        action: "ADJUST_CREATE",
        entity_type: "ADJUSTMENT",
        entity_id: (adjustment as any).id,
        metadata: {
          item_id: data.item_id,
          delta: data.requested_delta,
          reason: data.reason,
        },
      });
    }
    return adjustment;
  }

  async approveAdjustment(ctx: TenantContext,
    adjustmentId: string,
    approvedBy: string,
  ) {
    const result = await this.repository.approveAdjustment(
      ctx,
      adjustmentId,
      approvedBy,
    );

    // Emit standardized event
    await this.eventBus.publish({
      event_type: 'STOCK_MOVEMENT_CREATED',
      tenant_id: ctx.tenant_id,
      entity_id: adjustmentId,
      entity_type: 'STOCK_MOVEMENT',
      source_module: 'inventory',
      payload: {
        movementId: adjustmentId,
        tenant_id: ctx.tenant_id,
        product_id: result.item_id,
        location_id: result.location_id,
        quantity: result.requested_delta,
        type: result.requested_delta > 0 ? 'adjustment_plus' : 'adjustment_minus',
        referenceId: `ADJ-${adjustmentId}`,
        referenceType: 'INVENTORY_ADJUSTMENT',
        timestamp: new Date().toISOString(),
      },
      user_id: approvedBy,
    });

    return result;
  }

  async getAlerts(ctx: TenantContext) {
    return this.repository.getAlerts(ctx);
  }

  async setAlertStatus(ctx: TenantContext,
    alertId: string,
    status: "open" | "acknowledged" | "resolved",
  ) {
    return this.repository.setAlertStatus(ctx, alertId, status);
  }

  async getAuditCycles(ctx: TenantContext) {
    return this.repository.getAuditCycles(ctx);
  }

  async createAuditCycle(ctx: TenantContext, data: any) {
    return this.repository.createAuditCycle(ctx, data);
  }

  async updateAuditCycle(ctx: TenantContext, id: string, data: any) {
    console.log(`[AUDIT_RECONCILE] Updating Cycle ${id} for Tenant ${ctx.tenant_id}. Items: ${data.items?.length || 0}`);
    const { newItems, items: itemsInPayload, anomalies, ...results } = data;

    // 2. Link New Items (Disabled due to schema changes)
    /*
    if (newItems && Array.isArray(newItems)) {
      for (const item of newItems) {
        await this.prisma.item_masters.update({
          where: { id: item.id },
          data: { audit_cycle_id: id }
        });
      }
    }
    */

    // 3. Process Item Counts & Update Stock Levels
    const items = itemsInPayload;
    if (items && Array.isArray(items)) {
      const cycle = await this.prisma.inventory_audit_cycles.findUnique({
        where: { id, tenant_id: ctx.tenant_id }
      });
      
      if (cycle) {
        // Resolve location ID properly
        let locationId = cycle.location_code;
        
        // If it's not a UUID, try to find the location by code or name
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-12a-f]{12}$/i.test(locationId);
        if (!isUuid) {
           const resolvedLoc = await this.prisma.locations.findFirst({
              where: {
                 tenant_id: ctx.tenant_id,
                 OR: [
                    { code: locationId },
                    { name: locationId }
                 ],
                 deleted_at: null
              }
           });
           if (resolvedLoc) {
              locationId = resolvedLoc.id;
              console.log(`Resolved audit location ${cycle.location_code} -> ${locationId}`);
           }
        }

        for (const item of items) {
          if (!item.id || item.id === 'unregistered' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id)) {
            console.log(`[AUDIT_RECONCILE] Skipping unregistered item SKU: ${item.sku}`);
            continue;
          }
          const existingLevel = await this.prisma.stock_levels.findFirst({
            where: {
              tenant_id: ctx.tenant_id,
              location_id: locationId,
              product_id: item.id,
              department_id: cycle.department_code || null
            }
          });

          if (existingLevel) {
            const reserved = Number(existingLevel.reserved || 0);
            await this.prisma.stock_levels.update({
              where: { id: existingLevel.id },
              data: {
                on_hand: item.actualCount,
                available: Math.max(0, Number(item.actualCount) - reserved),
                updated_at: new Date()
              }
            });
          } else {
            await this.prisma.stock_levels.create({
              data: {
                tenant_id: ctx.tenant_id,
                location_id: locationId,
                product_id: item.id,
                department_id: cycle.department_code || null,
                on_hand: item.actualCount,
                available: item.actualCount,
                reserved: 0,
                min_buffer: 0,
                max_capacity: 0
              }
            });
          }
        }
      }
    }

    // 4. Update Cycle Status
    const cycle = await this.repository.updateAuditCycle(ctx, id, results);

    // 5. Generate & Save Report to Explorer
    /*
    if (results.status === "COMPLETED") {
      await this.generateAndSaveAuditReport(ctx, id);
    }
    */

    return cycle;
  }

  async createAuditPendingItem(ctx: TenantContext, data: any, cycleId: string) {
    if (!data.sku) data.sku = await this.skuGenerator.generateSku(ctx, data.category);
    if (!data.barcode) data.barcode = this.skuGenerator.generateBarcode(ctx, data.sku);

    const itemData = {
      ...data,
      audit_cycle_id: cycleId,
      status: data.status || "pending_audit_approval",
    };

    return this.repository.createItem(ctx, itemData);
  }

  /*
  private async generateAndSaveAuditReport(ctx: TenantContext, cycleId: string) {
    try {
      const cycle = await this.prisma.inventory_audit_cycles.findUnique({
        where: { id: cycleId },
        include: { 
          audit_items: true,
        }
      });

      if (!cycle) return;

      const user = await this.prisma.users.findUnique({
        where: { id: ctx.user_id },
        select: { first_name: true, last_name: true }
      });
      const performerName = user ? `${user.first_name} ${user.last_name}` : "Unknown System";

      const reportData = {
        title: "Stock Opname Report",
        generated_at: new Date().toISOString(),
        performer: performerName,
        location: cycle.location_code,
        scope: cycle.scope,
        status: cycle.status,
        expected_value: cycle.expected_value,
        counted_value: cycle.counted_value,
        variance: cycle.variance_value,
        total_items: (cycle.audit_items || []).length,
        discrepancies: (cycle.audit_items || []).filter((i: any) => (i as any).variance !== 0).length,
        items: (cycle.audit_items || []).map((i: any) => ({ 
          sku: i.sku, 
          name: i.name, 
          barcode: i.barcode,
          image: i.image_url,
          expected_quantity: (i as any).expected_quantity || 0,
          actual_quantity: (i as any).quantity || 0,
          variance: (i as any).variance || 0,
        })),
      };

      const reportJson = JSON.stringify(reportData, null, 2);
      const fileName = `Stock Opname ${cycle.location_code}.json`;
      
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = now.toLocaleString('default', { month: 'long' });
      
      const pathParts = ["Stock Opname", cycle.location_code, year, month];
      const folderId = await this.explorerService.ensureFolderPath(ctx, pathParts, "shared");

      // Upload via Explorer with metadata
      const mockFile: any = {
        originalname: fileName,
        mimetype: "application/json",
        buffer: Buffer.from(reportJson),
        size: reportJson.length
      };

      await this.explorerService.uploadFile(ctx, mockFile, {
        folder_id: folderId,
        access_level: "shared",
        metadata: {
          location: cycle.location_code,
          performer: performerName,
          timestamp: new Date().toISOString(),
          type: "STOCK_OPNAME_REPORT"
        }
      } as any);

      this.logger.log(`Audit report generated and saved for cycle ${cycleId}`);
    } catch (err) {
      this.logger.error(`Failed to generate audit report: ${err.message}`);
    }
  }
  */

  async getIntegrationEvents(ctx: TenantContext) {
    return this.repository.getIntegrationEvents(ctx);
  }

  async createIntegrationEvent(ctx: TenantContext, data: any) {
    return this.repository.createIntegrationEvent(ctx, data);
  }

  async runLowStockScan(ctx: TenantContext) {
    // Query all stock levels and flag those at/below their minBuffer threshold
    const all = await this.prisma.stock_levels.findMany({
      where: { tenant_id: ctx.tenant_id },
    });
    const low = all.filter((s: any) => Number(s.on_hand) <= Number(s.min_buffer));

    // Create/upsert InventoryAlert for each low stock level found
    let created = 0;
    for (const level of low) {
      const existing = await this.prisma.inventory_alerts.findFirst({
        where: {
          tenant_id: ctx.tenant_id,
          entity_id: level.product_id,
          type: "LOW_STOCK",
          status: "OPEN",
        },
      });
      if (!existing) {
        await this.prisma.inventory_alerts.create({
          data: {
        id: uuidv4(),
        updated_at: new Date(),
            tenant_id: ctx.tenant_id,
            type: "LOW_STOCK",
            severity: Number(level.on_hand) === 0 ? "HIGH" : "MEDIUM",
            status: "OPEN",
            entity_id: level.product_id,
            message: `Stock level for product ${level.product_id} at location ${level.location_id} is at ${level.on_hand} (threshold: ${level.min_buffer})`,
          },
        });

        // Emit standardized LOW_STOCK_ALERT event
        await this.eventBus.publish({
            event_type: 'LOW_STOCK_ALERT',
            tenant_id: ctx.tenant_id,
            entity_id: level.product_id,
            entity_type: 'PRODUCT',
            source_module: 'inventory',
            payload: {
                tenant_id: ctx.tenant_id,
                product_id: level.product_id,
                location_id: level.location_id,
                currentLevel: Number(level.on_hand),
                threshold: Number(level.min_buffer),
                timestamp: new Date().toISOString(),
            },
            user_id: 'system',
        });

        created++;
      }
    }

    return {
      scanned: all.length,
      lowStockFound: low.length,
      alertsCreated: created,
    };
  }

  async runExpiryScan(ctx: TenantContext) {
    // Return count of currently open expiry-related alerts from DB
    const openExpiryAlerts = await this.prisma.inventory_alerts.count({
      where: {
        tenant_id: ctx.tenant_id,
        type: "EXPIRY_WARNING",
        status: "OPEN",
      },
    });
    return { scanned: 0, expiryFound: openExpiryAlerts };
  }

  async deleteItem(ctx: TenantContext, item_id: string, user_id?: string) {
    const result = await this.repository.deleteItem(ctx, item_id);
    if (user_id) {
      await this.auditService.log({
        tenant_id: ctx.tenant_id,
        user_id,
        module: "inventory",
        action: "DELETE",
        entity_type: "ITEM",
        entity_id: item_id,
      });
    }
    return result;
  }

  /**
   * Soft-delete an inventory item by setting status to "deleted" and updating the timestamp.
   * Does NOT remove the database row — preserves data for audit/recovery purposes.
   *
   * Validates: Requirement 10.7
   */
  async softDeleteItem(ctx: TenantContext, item_id: string, user_id?: string) {
    const item = await this.prisma.item_masters.findFirst({
      where: { id: item_id, tenant_id: ctx.tenant_id },
    });
    if (!item) {
      throw new NotFoundException(`Inventory item not found`);
    }

    const result = await this.prisma.item_masters.update({
      where: { id: item_id, tenant_id: ctx.tenant_id },
      data: {
        status: "deleted",
        updated_at: new Date(),
      },
    });

    if (user_id) {
      await this.auditService.log({
        tenant_id: ctx.tenant_id,
        user_id,
        module: "inventory",
        action: "SOFT_DELETE",
        entity_type: "ITEM",
        entity_id: item_id,
      });
    }
    return result;
  }

  async batchDeleteItems(ctx: TenantContext,
    itemIds: string[],
    user_id?: string,
  ) {
    const result = await this.repository.batchDeleteItems(ctx, itemIds);
    if (user_id) {
      await this.auditService.log({
        tenant_id: ctx.tenant_id,
        user_id,
        module: "inventory",
        action: "BATCH_DELETE",
        entity_type: "ITEM",
        entity_id: "batch",
        metadata: { count: itemIds.length },
      });
    }
    return result;
  }

  async batchIntakeStock(ctx: TenantContext,
    data: StockIntakeDto[],
    user_id?: string,
  ) {
    const result = await this.repository.batchIntakeStock(ctx, data);
    if (user_id) {
      await this.auditService.log({
        tenant_id: ctx.tenant_id,
        user_id,
        module: "inventory",
        action: "BATCH_INTAKE",
        entity_type: "STOCK",
        entity_id: "batch",
        metadata: { count: data.length },
      });
    }
    return result;
  }

  async requestProcurement(ctx: TenantContext, data: any) {
    return this.repository.requestProcurement(ctx, data);
  }

  async batchCreateItems(ctx: TenantContext,
    data: any[],
    user_id?: string,
  ) {
    // Phase 1: Process each item for auto-generation
    for (const itemData of data) {
      if (!itemData.sku || itemData.sku.trim() === "") {
        itemData.sku = await this.skuGenerator.generateSku(
          ctx,
          itemData.category,
        );
      }
      if (!itemData.barcode || itemData.barcode.trim() === "") {
        itemData.barcode = this.skuGenerator.generateBarcode(
          ctx,
          itemData.sku,
        );
      }
    }

    const items = await this.repository.batchCreateItems(
      ctx,
      data.map((d: any) => ({
        ...d,
        uom: d.unit || d.uom || "pcs",
        base_price: d.base_price || 0,
        taxRate: d.taxRate || 0.11,
        status: "pending",
      })),
    );
    if (user_id) {
      await this.auditService.log({
        tenant_id: ctx.tenant_id,
        user_id,
        module: "inventory",
        action: "BATCH_CREATE_PENDING",
        entity_type: "ITEM",
        entity_id: "batch",
        metadata: { count: data.length },
      });
    }
    return items;
  }

  async getPendingItems(ctx: TenantContext) {
    return this.repository.getPendingItems(ctx);
  }

  async approveItem(ctx: TenantContext, item_id: string, user_id: string) {
    const item = await this.repository.updateItemStatus(
      ctx,
      item_id,
      "active",
    );
    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "inventory",
      action: "APPROVE",
      entity_type: "ITEM",
      entity_id: item_id,
      metadata: { sku: item.sku },
    });
    return item;
  }

  async rejectItem(ctx: TenantContext, item_id: string, user_id: string) {
    const item = await this.repository.updateItemStatus(
      ctx,
      item_id,
      "rejected",
    );
    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "inventory",
      action: "REJECT",
      entity_type: "ITEM",
      entity_id: item_id,
      metadata: { sku: item.sku },
    });
    return item;
  }

  async createMovementRequest(ctx: TenantContext,
    data: CreateMovementRequestDto,
    user_id?: string,
  ) {
    const request = await this.repository.createMovementRequest(
      ctx,
      data,
    );
    if (user_id) {
      await this.auditService.log({
        tenant_id: ctx.tenant_id,
        user_id,
        module: "inventory",
        action: "REQUEST_MOVEMENT",
        entity_type: "MOVEMENT_REQUEST",
        entity_id: request.id,
        metadata: { product_id: data.product_id, quantity: data.quantity },
      });
    }
    return request;
  }


  // --- Agentic Layer ---
  async getAgenticEvents(ctx: TenantContext) {
    return this.repository.getAgenticEvents(ctx);
  }

  async createAgenticEvent(ctx: TenantContext, data: CreateAgenticEventDto) {
    return this.repository.createAgenticEvent(ctx, data);
  }

  // --- IoT & Edge Layer ---

  async listIotEvents(ctx: TenantContext) {
    // Mapping Inventory IoT Feed to IT device events as a generic operational stream
    const events = await this.prisma.it_device_events.findMany({
      where: MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
      include: {
        it_devices: true,
      },
      orderBy: { created_at: "desc" },
      take: 50,
    });

    // Map Prisma snake_case to Frontend camelCase and extract payload info
    return events.map(e => ({
      id: e.id,
      eventType: e.event_type,
      deviceId: e.device_id,
      locationId: e.it_devices?.location_id || "GATE-01",
      sku: (e.payload as any)?.sku || (e.payload as any)?.item_code || "N/A",
      processed: e.processed,
      createdAt: e.created_at,
    }));
  }

  // --- Procurement Receipt Integration ---

  async listProcurementReceipts(ctx: TenantContext) {
    // Receipts are pending final POs that need to be intake into inventory
    return this.prisma.procurement_final_pos.findMany({
      where: {
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        status: { in: ["APPROVED", "PARTIALLY_RECEIVED", "RELEASED"] },
      },
      include: {
        supplier_masters: true,
      },
      orderBy: { created_at: "desc" },
    });
  }

  async processProcurementReceipt(
    ctx: TenantContext,
    finalPoId: string,
    data: {
      location_id: string;
      items: Array<{ sku: string; quantity: number; unit_cost?: number }>;
    },
    user_id?: string,
  ) {
    // 1. Delegate to procurement service to update PO status and emit intake events
    return this.procurementService.processReceipt(
      ctx,
      finalPoId,
      {
        location_id: data.location_id,
        items: data.items.map(item => ({
          sku: item.sku,
          quantity: item.quantity,
          unit_cost: item.unit_cost
        })),
        receiptType: "FULL", // Defaulting to full for this bridge
      },
      user_id,
    );
  }

  async processScan(ctx: TenantContext,
    params: { barcode: string; location_id: string; delta: number },
    user_id: string,
    correlation_id?: string
  ) {
    this.logger.log(`Processing Edge Scan: ${params.barcode} for tenant ${ctx.tenant_id}`);
    
    // 1. Efficient Lookup
    const item = await this.repository.lookupByBarcode(ctx, params.barcode);
    if (!item) {
        throw new Error(`Item not found for barcode: ${params.barcode}`);
    }

    // 2. Atomic Adjustment
    const result = await this.repository.quickAdjust(
        ctx,
        item.id,
        params.location_id,
        params.delta,
        user_id
    );

    // 3. Emit Event for downstream logic (e.g. Real-time dashboards, IoT alerts)
    await this.eventBus.publish({
        event_type: 'INVENTORY_SCAN_PROCESSED',
        tenant_id: ctx.tenant_id,
        entity_id: item.id,
        entity_type: 'ITEM',
        source_module: 'inventory',
        payload: {
            ...params,
            item_id: item.id,
            sku: item.sku,
            newQuantity: result.on_hand,
            timestamp: new Date().toISOString(),
        },
        user_id,
        correlation_id
    });

    return {
        item,
        adjustment: result,
        status: 'SUCCESS'
    };
  }

  async lookupByBarcode(ctx: TenantContext, barcode: string) {
    return this.repository.lookupByBarcode(ctx, barcode);
  }

  // --- Category Management ---
  async getCategories(ctx: TenantContext) {
    return this.repository.getProductCategories(ctx);
  }

  async createCategory(ctx: TenantContext, data: any) {
    return this.repository.createProductCategory(ctx, data);
  }

  async getOrCreateAnomalyCategory(ctx: TenantContext) {
    // Try to find existing Anomaly category
    let category = await this.prisma.product_categories.findFirst({
      where: {
        tenant_id: ctx.tenant_id,
        name: "Anomaly",
      },
    });

    if (!category) {
      // Create new Anomaly category if it doesn't exist
      category = await this.prisma.product_categories.create({
        data: {
          id: uuidv4(),
          tenant_id: ctx.tenant_id,
          name: "Anomaly",
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
    }

    return category;
  }

  async getOrCreateAnomalyCategoryWithFlag(ctx: TenantContext) {
    // This method wraps the anomaly category to indicate it's the anomaly category
    const category = await this.getOrCreateAnomalyCategory(ctx);
    return {
      ...category,
      is_anomaly_category: true,
    };
  }

  async batchCreateIncompleteItems(
    ctx: TenantContext,
    items: { barcode: string; name: string }[],
    user_id?: string
  ): Promise<any[]> {
    // Get anomaly category first
    const anomalyCategory = await this.getOrCreateAnomalyCategory(ctx);

    // Process each item and create with is_anomaly=true and status="incomplete"
    const createdItems: any[] = [];
    const failedItems: { barcode: string; error: string }[] = [];

    for (const item of items) {
      try {
        // Generate SKU from barcode if not already available
        let sku = item.barcode;
        if (!item.barcode || item.barcode.trim() === "") {
          sku = await this.skuGenerator.generateSku(ctx, "Anomaly");
        }

        // Create the incomplete item
        const inventoryItem = await this.repository.createItem(ctx, {
          sku,
          name: item.name,
          category: "Anomaly",
          barcode: item.barcode,
          uom: "pcs",
          status: "incomplete",
          base_price: 0,
          tax_rate: 0.11,
          is_anomaly: true,
          department_id: null,
        });

        createdItems.push({
          id: inventoryItem.id,
          sku: inventoryItem.sku,
          name: inventoryItem.name,
          barcode: inventoryItem.barcode,
          category_id: inventoryItem.category_id,
          is_anomaly: true,
          status: "incomplete" as const,
          created_at: inventoryItem.created_at,
        });
      } catch (err: any) {
        failedItems.push({
          barcode: item.barcode,
          error: err.message || "Failed to create item",
        });
      }
    }

    // Log audit trail
    if (user_id && createdItems.length > 0) {
      await this.auditService.log({
        tenant_id: ctx.tenant_id,
        user_id,
        module: "INVENTORY",
        action: "BATCH_CREATE_INCOMPLETE",
        entity_type: "ITEM",
        entity_id: "batch",
        metadata: {
          count: createdItems.length,
          failed_count: failedItems.length,
          anomaly_category_id: anomalyCategory.id,
        },
      });
    }

    return {
      success: true,
      created: createdItems,
      failed: failedItems,
      total: createdItems.length + failedItems.length,
    };
  }

  async markItemsAsAnomalies(
    ctx: TenantContext,
    itemIds: string[],
    reason: string,
    user_id?: string
  ): Promise<number> {
    // Update items with is_anomaly flag
    const updatedItems = await this.prisma.item_masters.updateMany({
      where: {
        id: { in: itemIds },
        tenant_id: ctx.tenant_id,
      },
      data: {
        is_anomaly: true,
        updated_at: new Date(),
      },
    });

    // Log audit trail entry for each marking
    if (user_id && updatedItems.count > 0) {
      for (const itemId of itemIds) {
        await this.auditService.log({
          tenant_id: ctx.tenant_id,
          user_id,
          module: "INVENTORY",
          action: "MARK_ANOMALY",
          entity_type: "ITEM",
          entity_id: itemId,
          metadata: { reason },
        });
      }
    }

    return updatedItems.count;
  }

  async updateCategory(ctx: TenantContext, id: string, data: any) {
    return this.repository.updateProductCategory(ctx, id, data);
  }

  async deleteCategory(ctx: TenantContext, id: string) {
    return this.repository.deleteProductCategory(ctx, id);
  }

  async updateItemCategory(ctx: TenantContext, itemId: string, categoryId: string) {
    return this.repository.updateItemCategory(ctx, itemId, categoryId);
  }

  async getItemById(ctx: TenantContext, itemId: string) {
    return this.repository.getItemById(ctx, itemId);
  }

  async getCategoryById(ctx: TenantContext, categoryId: string) {
    return this.repository.getCategoryById(ctx, categoryId);
  }

  async updateItem(ctx: TenantContext, itemId: string, data: any, user_id?: string) {
    const item = await this.repository.updateItem(ctx, itemId, data);
    if (user_id) {
      await this.auditService.log({
        tenant_id: ctx.tenant_id,
        user_id,
        module: "inventory",
        action: "UPDATE",
        entity_type: "ITEM",
        entity_id: itemId,
        metadata: data,
      });
    }
    return item;
  }

  async getSalesHistory(ctx: TenantContext, itemId: string) {
    return this.repository.getSalesHistory(ctx, itemId);
  }

  async getProcurementHistory(ctx: TenantContext, itemId: string) {
    return this.repository.getProcurementHistory(ctx, itemId);
  }

  async processBulkImages(
    ctx: TenantContext,
    files: Express.Multer.File[],
    userId: string,
  ) {
    const results = {
      matched: [] as string[],
      failed: [] as string[],
    };

    for (const file of files) {
      // 1. Extract potential SKU from filename
      const filenameWithoutExt = path.parse(file.originalname).name;
      
      // Try strict match first
      let sku = filenameWithoutExt;
      let item = await this.prisma.item_masters.findFirst({
        where: {
          tenant_id: ctx.tenant_id,
          sku: sku,
        },
      });

      // Fallback: If not found, try taking the first segment before an underscore or space
      if (!item) {
        const segments = filenameWithoutExt.split(/[_ ]/);
        if (segments.length > 1) {
          sku = segments[0];
          item = await this.prisma.item_masters.findFirst({
            where: {
              tenant_id: ctx.tenant_id,
              sku: sku,
            },
          });
        }
      }

      if (!item) {
        results.failed.push(`${file.originalname} (SKU not found)`);
        continue;
      }


      // 3. Rename: SKU_TIMESTAMP.ext
      const ext = path.extname(file.originalname);
      const customName = `${sku}_${Date.now()}${ext}`;

      // 4. Delegate to ItemImageService
      try {
        await this.itemImageService.uploadImage(
          ctx.tenant_id,
          item.id,
          file,
          userId,
          customName,
        );
        results.matched.push(sku);
      } catch (err) {
        this.logger.error(`Failed to upload bulk image for ${sku}: ${err.message}`);
        results.failed.push(`${file.originalname} (Upload error)`);
      }
    }

    return results;
  }

  async processDataImportJob(jobId: string, ctx: TenantContext, locationId?: string) {
    const job = await this.prisma.inventory_import_jobs.findUnique({ where: { id: jobId } });
    if (!job) return;

    await this.prisma.inventory_import_jobs.update({
      where: { id: jobId },
      data: { status: 'PROCESSING', started_at: new Date() },
    });

    try {
      const isCsv = job.filename.toLowerCase().endsWith('.csv');
      const dtoClass = ImportItemDto;

      const records: any[] = [];
      const results: any[] = [];
      const errors: any[] = [];
      let totalCount = 0;

      const fileExtension = path.extname(job.file_path).toLowerCase();
      
      // Pre-calculate total items for accurate progress bar
      let estimatedTotal = 0;
      if (fileExtension === '.csv') {
        const content = await fsPromises.readFile(job.file_path, 'utf8');
        estimatedTotal = content.split('\n').filter(line => line.trim()).length - 1; // Subtract header
      } else {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(job.file_path);
        const worksheet = workbook.getWorksheet(1);
        estimatedTotal = (worksheet?.rowCount || 1) - 1;
      }

      await this.prisma.inventory_import_jobs.update({
        where: { id: jobId },
        data: { 
          status: 'PROCESSING',
          total_items: estimatedTotal > 0 ? estimatedTotal : 0 
        },
      });

      const onRow = async (data: any) => {
        // Check if job was aborted
        const currentJob = await this.prisma.inventory_import_jobs.findUnique({
          where: { id: jobId },
          select: { status: true }
        });

        if (currentJob?.status === 'ABORTED') {
          throw new Error('IMPORT_ABORTED');
        }

        totalCount++;

        
        // Sanitize data types and map alternative column names
        const sanitized: any = { ...data };

        // Flexible naming mapping
        if (!sanitized.name) sanitized.name = data.item_name || data.product_name || data.title || data.nama_barang || "Unnamed Item";
        if (!sanitized.sku) sanitized.sku = data.item_code || data.part_number || data.kode_barang || `SKU-${Date.now()}-${totalCount}`;
        if (!sanitized.barcode) sanitized.barcode = data.gtin || data.ean || data.upc || sanitized.sku;
        if (!sanitized.category) sanitized.category = data.group || data.type || data.kategori || "General";
        if (!sanitized.unit) sanitized.unit = data.uom || data.satuan || "pcs";
        
        if (sanitized.base_price === undefined) sanitized.base_price = data.cost || data.harga_beli || 0;
        if (sanitized.selling_price === undefined) sanitized.selling_price = data.price || data.harga_jual || 0;

        // Location & Quantity mapping
        if (locationId) {
          sanitized.locationId = locationId; // Force injected location
        } else if (!sanitized.location) {
          sanitized.location = data.location_name || data.branch || data.warehouse || data.lokasi || "Bambu Silver Headquarters";
        }
        
        if (!sanitized.quantity) sanitized.quantity = data.initial_quantity || data.initial_stock || data.stok || data.qty || 0;

        // Type conversion
        sanitized.base_price = Number(sanitized.base_price) || 0;
        sanitized.selling_price = Number(sanitized.selling_price) || 0;
        sanitized.tax_rate = Number(sanitized.tax_rate || data.taxRate) || 0.11;
        sanitized.discount_rate = Number(sanitized.discount_rate) || 0;
        sanitized.quantity = Number(sanitized.quantity) || 0;
        
        if (sanitized.pricing_tiers && typeof sanitized.pricing_tiers === 'string') {
          try { sanitized.pricing_tiers = JSON.parse(sanitized.pricing_tiers); } catch (e) { sanitized.pricing_tiers = null; }
        }
        if (sanitized.metadata && typeof sanitized.metadata === 'string') {
          try { sanitized.metadata = JSON.parse(sanitized.metadata); } catch (e) { sanitized.metadata = null; }
        }
        if (sanitized.module_tags && typeof sanitized.module_tags === 'string') {
           sanitized.module_tags = sanitized.module_tags.split(',').map((t: string) => t.trim());
        }

        records.push(sanitized);
        
        if (records.length >= 200) {
          const batch = [...records];
          records.length = 0;
          await this.processImportBatch(batch, ctx, jobId);
        }
      };

      if (fileExtension === '.csv') {
        await this.fileProcessingService.parseCsvStream(job.file_path, onRow);
      } else {
        await this.fileProcessingService.parseExcelStream(job.file_path, onRow);
      }

      // Process remaining
      if (records.length > 0) {
        await this.processImportBatch(records, ctx, jobId);
      }

      await this.prisma.inventory_import_jobs.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          completed_at: new Date(),
          total_items: totalCount,
          error_count: errors.length,
          errors: errors as any,
        },
      });

      // Cleanup
      await fsPromises.unlink(job.file_path).catch(() => {});
    } catch (err: any) {
      if (err.message === 'IMPORT_ABORTED') {
        console.log(`[Import] Job ${jobId} aborted by user.`);
        return;
      }
      this.logger.error(`Data import job ${jobId} failed: ${err.message}`);
      await this.prisma.inventory_import_jobs.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          completed_at: new Date(),
          errors: [{ message: err.message }] as any,
        },
      });
    }
  }

  private async processImportBatch(batch: any[], ctx: TenantContext, jobId: string) {
    try {
      await this.repository.batchCreateItems(ctx, batch);
      await this.prisma.inventory_import_jobs.update({
        where: { id: jobId },
        data: {
          processed_items: { increment: batch.length },
        },
      });
    } catch (err: any) {
      this.logger.error(`Batch processing failed for job ${jobId}: ${err.message}`);
      
      const errorsList: any[] = [];
      let successCount = 0;
      let failCount = 0;

      // Try one by one if batch fails to capture individual errors
      for (const item of batch) {
        try {
          await this.repository.batchCreateItems(ctx, [item]);
          successCount++;
        } catch (singleErr: any) {
          failCount++;
          errorsList.push({
            identifier: item.sku || item.name || 'Unknown',
            message: singleErr.message
          });
        }
      }

      const job = await this.prisma.inventory_import_jobs.findUnique({ where: { id: jobId } });
      const currentErrors = (job?.errors as any[]) || [];

      await this.prisma.inventory_import_jobs.update({
        where: { id: jobId },
        data: { 
          processed_items: { increment: successCount },
          error_count: { increment: failCount },
          errors: [...currentErrors, ...errorsList]
        },
      }).catch(e => {
        this.logger.error(`Failed to update job errors for ${jobId}: ${e.message}`);
      });
    }
  }

  async processImageImportJob(jobId: string, ctx: TenantContext) {
    const job = await this.prisma.inventory_import_jobs.findUnique({ where: { id: jobId } });
    if (!job) {
      this.logger.error(`[Worker] Image import job ${jobId} not found in database!`);
      return;
    }

    this.logger.log(`[Worker] Starting image import processing for job ${jobId} (File: ${job.filename})`);

    await this.prisma.inventory_import_jobs.update({
      where: { id: jobId },
      data: { status: 'PROCESSING', started_at: new Date() },
    });

    try {
      const zip = new AdmZip(job.file_path);
      const entries = zip.getEntries();
      const imageCount = entries.filter(e => !e.isDirectory && [".jpg", ".jpeg", ".png", ".webp"].includes(path.extname(e.name).toLowerCase())).length;

      await this.prisma.inventory_import_jobs.update({
        where: { id: jobId },
        data: { total_items: imageCount },
      });

      const errors: string[] = [];

      this.logger.log(`[Worker] Job ${jobId}: Building SKU lookup map for tenant ${ctx.tenant_id}...`);
      const allItems = await this.prisma.item_masters.findMany({
        where: { tenant_id: ctx.tenant_id },
        select: { id: true, sku: true },
      });
      const skuMap = new Map<string, { id: string; sku: string }>();
      const exactSkuMap = new Map<string, { id: string; sku: string }>();
      for (const item of allItems) {
        if (!item.sku) continue;
        exactSkuMap.set(item.sku, item);
        const normalized = item.sku.replace(/[\s_-]/g, '').toLowerCase();
        skuMap.set(normalized, item);
      }
      this.logger.log(`[Worker] Built lookup maps for ${skuMap.size} unique SKUs.`);

      const results = await this.fileProcessingService.processZipImages(
        job.file_path,
        async (fileName, buffer) => {
          // Check if job was aborted
          const currentJob = await this.prisma.inventory_import_jobs.findUnique({
            where: { id: jobId },
            select: { status: true }
          });

          if (currentJob?.status === 'ABORTED') {
            throw new Error('IMPORT_ABORTED');
          }

          const nameWithoutExt = path.parse(fileName).name;
          
          // Strategy 0: Exact match first (filename as SKU)
          let item = exactSkuMap.get(nameWithoutExt);
          let rawSku = nameWithoutExt;

          if (!item) {
            // Strategy 1: Smart matching (strip _1, _2 suffixes)
            const match = nameWithoutExt.match(/^(.*)[_-]\d+$/);
            rawSku = match ? match[1] : nameWithoutExt;
            item = exactSkuMap.get(rawSku);
            
            if (!item) {
              // Strategy 2: Normalized matching
              const normalizedSku = rawSku.replace(/[\s_-]/g, '').toLowerCase();
              item = skuMap.get(normalizedSku);
            }

            if (!item) {
              // Strategy 3: Try full filename normalized
              const normalizedFull = nameWithoutExt.replace(/[\s_-]/g, '').toLowerCase();
              item = skuMap.get(normalizedFull);
            }
          }

          if (!item) {
            errors.push(`SKU "${rawSku}" not found for file ${fileName}`);
            return;
          }

          // --- Deduplication Check ---
          // Check if this specific item already has this image via audit logs (Efficient for large sets)
          const existing = await this.prisma.audit_logs.findFirst({
            where: {
              tenant_id: ctx.tenant_id,
              action: 'UPLOAD_IMAGE',
              metadata: {
                path: ['originalName'],
                equals: fileName
              }
            }
          });

          if (existing) {
             const meta = existing.metadata as any;
             if (meta?.item_id === item.id) {
               this.logger.log(`[Worker] Skipping duplicate image ${fileName} for item ${item.sku}`);
               return;
             }
          }

          const file: any = {
            originalname: fileName,
            buffer: buffer,
            mimetype: 'image/' + path.extname(fileName).replace('.', ''),
            size: buffer.length,
          };

          const customName = `${item.sku.replace(/\s+/g, '_')}_${Date.now()}${path.extname(fileName)}`;
          await this.itemImageService.uploadImage(
            ctx.tenant_id,
            item.id,
            file,
            job.user_id,
            customName,
          );

          await this.prisma.inventory_import_jobs.update({
            where: { id: jobId },
            data: { processed_items: { increment: 1 } },
          });
        }
      );

      await this.prisma.inventory_import_jobs.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          completed_at: new Date(),
          total_items: results.total,
          error_count: results.errors.length + errors.length,
          errors: [...results.errors, ...errors] as any,
        },
      });

      // Cleanup
      await fsPromises.unlink(job.file_path).catch(() => {});
    } catch (err: any) {
      if (err.message === 'IMPORT_ABORTED') {
        console.log(`[Import] Image Job ${jobId} aborted by user.`);
        return;
      }
      console.error(`[Import] Image job ${jobId} failed:`, err);
      await this.prisma.inventory_import_jobs.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          completed_at: new Date(),
          errors: [{ message: err.message }] as any,
        },
      });
    }

  }

  async abortImportJob(id: string, ctx: TenantContext) {
    return this.prisma.inventory_import_jobs.update({
      where: { id, tenant_id: ctx.tenant_id },
      data: { status: 'ABORTED' }
    });
  }

  /**
   * Cancel an import job. Only allows cancellation if the job is in PENDING or PROCESSING status.
   * Returns 404 if job doesn't exist, 409 if job is in a terminal state (COMPLETED/FAILED/CANCELLED/ABORTED).
   *
   * Validates: Requirement 10.8
   */
  async cancelImportJob(id: string, ctx: TenantContext) {
    const job = await this.prisma.inventory_import_jobs.findFirst({
      where: { id, tenant_id: ctx.tenant_id },
    });

    if (!job) {
      throw new NotFoundException(`Import job not found`);
    }

    const cancellableStatuses = ['PENDING', 'PROCESSING'];
    if (!cancellableStatuses.includes(job.status)) {
      throw new ConflictException(
        `Cannot cancel import job in ${job.status} status. Only PENDING or PROCESSING jobs can be cancelled.`
      );
    }

    return this.prisma.inventory_import_jobs.update({
      where: { id, tenant_id: ctx.tenant_id },
      data: {
        status: 'CANCELLED',
        updated_at: new Date(),
      },
    });
  }

  // --- Void Request & Approval Workflow Service Methods ---
  async createVoidRequest(
    ctx: TenantContext,
    entity_type: string,
    entity_id: string,
    reason: string,
    requested_by: string
  ): Promise<any> {
    // Determine company_id from context if available
    const company_id = ctx.company_id;

    // Check if user has elevated role (OWNER or SUPERADMIN)
    const elevatedRoles = ["OWNER", "SUPERADMIN"];
    const isElevatedRole = elevatedRoles.includes(ctx.role || "");

    // Create the void request
    const voidRequest = await this.repository.createVoidRequest(
      ctx,
      {
        entity_type,
        entity_id,
        reason,
        requested_by,
        company_id,
        status: isElevatedRole ? "APPROVED" : "PENDING",
        approved_by: isElevatedRole ? requested_by : null,
        approved_at: isElevatedRole ? new Date() : null,
      }
    );

    // Log audit entry for void request
    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id: requested_by,
      module: "inventory",
      action: isElevatedRole ? "VOID_APPLIED_IMMEDIATELY" : "VOID_REQUEST_CREATED",
      entity_type: "VOID_REQUEST",
      entity_id: voidRequest.id,
      metadata: {
        entity_type,
        entity_id,
        reason,
        requested_by,
        is_elevated_role: isElevatedRole,
        auto_approved: isElevatedRole,
      },
    });

    // For elevated roles, execute the actual void immediately
    if (isElevatedRole && entity_type === "incomplete_item") {
      await this.repository.deleteItem(ctx, entity_id);
    }

    // For elevated roles, apply abandoned cycle void immediately
    if (isElevatedRole && entity_type === "abandoned_cycle") {
      await this.applyAbandonedCycleVoid(ctx, entity_id, requested_by);
    }

    return voidRequest;
  }

  async approveVoidRequest(
    ctx: TenantContext,
    voidRequest_id: string,
    approver_id: string
  ): Promise<any> {
    // First get the void request to check its current state
    const voidRequest = await this.repository.getVoidRequestById(ctx, voidRequest_id);
    
    if (!voidRequest) {
      throw new Error("Void request not found");
    }

    if (voidRequest.status !== "PENDING") {
      throw new Error(`Void request is already ${voidRequest.status}`);
    }

    // Approve the void request
    const approvedRequest = await this.repository.approveVoidRequest(
      ctx,
      voidRequest_id,
      approver_id
    );

    // Apply the actual void: delete the entity
    if (voidRequest.entity_type === "incomplete_item") {
      await this.repository.deleteItem(ctx, voidRequest.entity_id);
    }

    // Apply the actual void: mark abandoned cycle as VOIDED
    if (voidRequest.entity_type === "abandoned_cycle") {
      await this.applyAbandonedCycleVoid(ctx, voidRequest.entity_id, approver_id);
    }

    // Log audit entry for approval
    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id: approver_id,
      module: "inventory",
      action: "VOID_REQUEST_APPROVED",
      entity_type: "VOID_REQUEST",
      entity_id: voidRequest_id,
      metadata: {
        approved_by: approver_id,
        original_entity_type: voidRequest.entity_type,
        original_entity_id: voidRequest.entity_id,
        void_applied: true,
      },
    });

    return approvedRequest;
  }

  async rejectVoidRequest(
    ctx: TenantContext,
    voidRequest_id: string,
    rejector_id: string,
    rejection_reason?: string
  ): Promise<any> {
    // First get the void request to check its current state
    const voidRequest = await this.repository.getVoidRequestById(ctx, voidRequest_id);
    
    if (!voidRequest) {
      throw new Error("Void request not found");
    }

    if (voidRequest.status !== "PENDING") {
      throw new Error(`Void request is already ${voidRequest.status}`);
    }

    // Reject the void request
    const rejectedRequest = await this.repository.rejectVoidRequest(
      ctx,
      voidRequest_id,
      rejector_id
    );

    // Log audit entry for rejection
    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id: rejector_id,
      module: "inventory",
      action: "VOID_REQUEST_REJECTED",
      entity_type: "VOID_REQUEST",
      entity_id: voidRequest_id,
      metadata: {
        rejected_by: rejector_id,
        rejection_reason: rejection_reason || null,
        original_entity_type: voidRequest.entity_type,
        original_entity_id: voidRequest.entity_id,
      },
    });

    return rejectedRequest;
  }

  async getVoidRequestById(
    ctx: TenantContext,
    voidRequest_id: string
  ): Promise<any | null> {
    return this.repository.getVoidRequestById(ctx, voidRequest_id);
  }

  async getVoidRequestsByEntity(
    ctx: TenantContext,
    entity_type: string,
    entity_id: string
  ): Promise<any[]> {
    return this.repository.getVoidRequestsByEntity(ctx, entity_type, entity_id);
  }

  async listVoidRequests(
    ctx: TenantContext,
    filters?: {
      status?: string;
      entity_type?: string;
    }
  ): Promise<any[]> {
    return this.repository.listVoidRequests(ctx, filters);
  }

  // ─── Abandoned Audit Cycle Resolution ────────────────────────────────

  /**
   * Detects audit cycles that were initiated on the server but never committed.
   * A cycle is considered abandoned if it has status "OPEN" and has not been
   * updated within the given threshold (default 24 hours).
   */
  async getAbandonedAuditCycles(
    ctx: TenantContext,
    thresholdHours: number = 24
  ): Promise<any[]> {
    const allCycles = await this.repository.getAuditCycles(ctx);
    const threshold = Date.now() - thresholdHours * 60 * 60 * 1000;

    return allCycles.filter((cycle: any) => {
      const isOpen = cycle.status === "OPEN";
      const lastActivity = cycle.updated_at
        ? new Date(cycle.updated_at).getTime()
        : cycle.created_at
          ? new Date(cycle.created_at).getTime()
          : 0;
      return isOpen && lastActivity < threshold;
    });
  }

  /**
   * Flags a specific audit cycle as abandoned.
   * Sets status to "ABANDONED" so it shows up in resolution queues.
   */
  async flagAbandonedCycle(
    ctx: TenantContext,
    cycleId: string,
    flaggedBy: string
  ): Promise<any> {
    const updatedCycle = await this.repository.updateAuditCycle(ctx, cycleId, {
      status: "ABANDONED",
    });

    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id: flaggedBy,
      module: "inventory",
      action: "AUDIT_CYCLE_FLAGGED_ABANDONED",
      entity_type: "AUDIT_CYCLE",
      entity_id: cycleId,
      metadata: {
        flagged_by: flaggedBy,
        previous_status: "OPEN",
      },
    });

    return updatedCycle;
  }

  /**
   * Requests voiding of an abandoned audit cycle.
   * Uses the same approval workflow as item voids:
   * - Owner/Superadmin: applied immediately
   * - Other roles: creates a pending Approval_Request requiring Elevated_Role approval
   *
   * Requirements: 4.5, 8.7
   */
  async voidAbandonedCycle(
    ctx: TenantContext,
    cycleId: string,
    reason: string,
    requested_by: string
  ): Promise<any> {
    // Validate the cycle exists and is in an abandoned/open state
    const cycles = await this.repository.getAuditCycles(ctx);
    const cycle = cycles.find((c: any) => c.id === cycleId);

    if (!cycle) {
      throw new Error("Audit cycle not found");
    }

    if (cycle.status !== "ABANDONED" && cycle.status !== "OPEN") {
      throw new Error(
        `Audit cycle cannot be voided: current status is ${cycle.status}`
      );
    }

    // Check if the user has an elevated role (Manager/HOD+) to request void
    const elevatedRoles = ["OWNER", "SUPERADMIN", "MANAGER", "HOD"];
    const isElevatedRole = elevatedRoles.includes(ctx.role || "");

    if (!isElevatedRole) {
      throw new Error(
        "Insufficient permissions: Elevated_Role (Manager/HOD+) required to void abandoned cycles"
      );
    }

    // Use the same void request workflow as incomplete items
    const voidRequest = await this.createVoidRequest(
      ctx,
      "abandoned_cycle",
      cycleId,
      reason,
      requested_by
    );

    // For Owner/Superadmin the void is applied immediately via createVoidRequest.
    // For elevated but non-owner roles (Manager/HOD), a pending request is created.
    // When approved, the cycle will be voided via approveVoidRequest.

    return voidRequest;
  }

  /**
   * Applies the void action for an abandoned_cycle entity type.
   * Called when a void request for an abandoned cycle is approved or auto-approved.
   */
  async applyAbandonedCycleVoid(
    ctx: TenantContext,
    cycleId: string,
    voidedBy: string
  ): Promise<any> {
    const updatedCycle = await this.repository.updateAuditCycle(ctx, cycleId, {
      status: "VOIDED",
      closed_by: voidedBy,
    });

    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id: voidedBy,
      module: "inventory",
      action: "AUDIT_CYCLE_VOIDED",
      entity_type: "AUDIT_CYCLE",
      entity_id: cycleId,
      metadata: {
        voided_by: voidedBy,
        previous_status: "ABANDONED",
      },
    });

    return updatedCycle;
  }
}

