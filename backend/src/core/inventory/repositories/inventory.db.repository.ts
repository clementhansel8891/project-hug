// @ts-nocheck — void_requests table reference pending migration sync
import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../../persistence/prisma.service";
import {
  IInventoryRepository,
  InventoryDashboard,
  InventoryItem,
  StockBalance,
  StockMovement,
  InventoryAdjustment,
  CreateItemDto,
  StockIntakeDto,
  TransferStockDto,
  CreateAdjustmentDto,
  InventoryAlert,
  CreateMovementRequestDto,
  MovementRequest,
  CreateAgenticEventDto,
  AgenticEvent,
} from "./inventory.repository.interface";
import { v4 as uuidv4 } from "uuid";
import {
  product_categories as ProductCategory,
  locations as Location,
  departments as Department,
  stock_levels as StockLevel,
  inventory_adjustments as PrismaInventoryAdjustment,
  inventory_alerts as PrismaInventoryAlert,
  stock_movements as PrismaStockMovement,
  agentic_events as PrismaAgenticEvent,
  item_masters as ItemMaster,
  Prisma,
} from "@prisma/client";
import { TenantContext } from "../../../gateway/tenant-context.interface";
import { MultiTenancyUtil } from "../../../shared/utils/multi-tenancy.util";

@Injectable()
export class InventoryDbRepository implements IInventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(ctx: TenantContext, location_id?: string): Promise<any> {
    // Items are tenant-scoped (company_id may be NULL on imported items)
    const baseScope = { tenant_id: ctx.tenant_id };
    
    // Fetch company currency
    const company = await this.prisma.companies.findFirst({
      where: { 
        tenant_id: ctx.tenant_id,
        deleted_at: null
      },
      select: { currency: true }
    });
    const currency = company?.currency || "USD";
    
    // Detect if location_id is actually a Branch (Tenant) ID
    let branchTenantId: string | undefined;
    const isLocationFiltered = location_id && location_id !== "all" && location_id !== "";
    if (isLocationFiltered) {
      // Branch detection removed
    }

    const itemWhere: any = { ...baseScope };
    if (isLocationFiltered) {
      itemWhere.stock_levels = { some: { location_id } };
    }
    
    const totalLocations = await this.prisma.locations.count({
      where: baseScope,
    });
    const totalDepartments = await this.prisma.departments.count({
      where: baseScope,
    });

    // Fetch all active products with their stock levels to calculate KPIs dynamically
    const allProducts = await this.prisma.item_masters.findMany({
      where: { ...itemWhere, status: "active" },
      include: {
        stock_levels: {
          where: isLocationFiltered ? (branchTenantId ? { tenant_id: branchTenantId } : { location_id }) : undefined,
        }
      }
    });

    let totalItems = 0; // Represents "Items Type" - active items
    let totalOnHandQty = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalValuation = 0;
    let capitalValue = 0;

    for (const product of allProducts) {
      totalItems++;
      const currentStock = product.stock_levels.reduce((sum, level) => sum + Number(level.on_hand), 0);
      const minStock = Number((product.metadata as any)?.min_stock) || 0;
      
      totalOnHandQty += currentStock;
      totalValuation += currentStock * (Number(product.selling_price) || 0);
      capitalValue += currentStock * (Number(product.base_price) || 0);

      if (currentStock <= 0) {
        outOfStockCount++;
      } else if (minStock > 0 && currentStock <= minStock) {
        lowStockCount++;
      } else if (minStock === 0 && currentStock <= 5) {
        lowStockCount++; // Fallback if min_stock is not set
      }
    }

    const pendingAdjustments = await this.prisma.inventory_adjustments.count({
      where: { ...baseScope, status: "PENDING_APPROVAL" },
    });

    const expiryWarningCount = await this.prisma.inventory_alerts.count({
      where: { ...baseScope, type: "EXPIRY_WARNING", status: "OPEN" },
    });

    const pendingReceiptSyncs = await this.prisma.procurement_final_pos.count({
      where: {
        ...baseScope,
        status: { in: ["RELEASED", "APPROVED", "DELIVERED"] },
      },
    });

    return {
      total_items: totalItems,
      items_type_count: totalItems, // Same as total_items for now (distinct active products)
      total_locations: totalLocations,
      total_departments: totalDepartments,
      total_on_hand_qty: totalOnHandQty,
      total_valuation: totalValuation,
      capital_value: capitalValue,
      out_of_stock_count: outOfStockCount,
      pending_adjustments: pendingAdjustments,
      pending_receipt_syncs: pendingReceiptSyncs,
      low_stock_count: lowStockCount,
      expiry_warning_count: expiryWarningCount,
      currency,
    };
  }

  async getItems(ctx: TenantContext, location_id?: string, page: number = 1, limit: number = 100, search?: string, category_id?: string, status?: string, is_anomaly?: boolean, sortBy?: "name" | "quantity" | "created_at", sortOrder?: "asc" | "desc"): Promise<InventoryItem[]> {
    const skip = (page - 1) * limit;
    // Items are tenant-scoped (company_id may be NULL on imported items)
    const scope = { tenant_id: ctx.tenant_id };
    
    // Detect if location_id is actually a Branch (Tenant) ID
    let branchTenantId: string | undefined;
    const isLocationFiltered = location_id && location_id !== "all" && location_id !== "";
    if (isLocationFiltered) {
      // Branch detection removed
    }

    // Determine if we need raw SQL (for stock-based filtering or sorting)
    const isStockStatus = ["low", "critical", "out_of_stock"].includes(status || "");
    const useRawSql = sortBy === "quantity" || isStockStatus;

    if (useRawSql) {
      const conditions = [`p.tenant_id = '${ctx.tenant_id}'`, `p.status != 'deleted'`];
      if (category_id && category_id !== "all") conditions.push(`p.category_id = '${category_id}'`);
      
      // If it's a regular status, apply it to the master table
      const regularStatus = (status && !isStockStatus && status !== "all") ? status : null;
      if (regularStatus) conditions.push(`p.status = '${regularStatus}'`);

      if (is_anomaly !== undefined) {
        conditions.push(`p.is_anomaly = ${is_anomaly}`);
      }

      if (search) {
        const s = search.replace(/'/g, "''");
        conditions.push(`(p.name ILIKE '%${s}%' OR p.sku ILIKE '%${s}%' OR p.barcode ILIKE '%${s}%')`);
      }

      const whereClause = conditions.join(" AND ");
      
      // Location condition for aggregation
      const locationCondition = isLocationFiltered ? `s.location_id = '${location_id}'` : `1=1`;

      // Stock status filters (HAVING clause)
      let havingClause = "";
      if (status === "low") {
        havingClause = `HAVING SUM(CASE WHEN ${locationCondition} THEN COALESCE(s.on_hand, 0) ELSE 0 END) <= COALESCE(CAST(p.metadata->>'min_stock' AS DECIMAL), 5) 
                        AND SUM(CASE WHEN ${locationCondition} THEN COALESCE(s.on_hand, 0) ELSE 0 END) > 0`;
      } else if (status === "out_of_stock" || status === "critical") {
        havingClause = `HAVING SUM(CASE WHEN ${locationCondition} THEN COALESCE(s.on_hand, 0) ELSE 0 END) <= 0`;
      }

      const sortSql = sortBy === "quantity" 
        ? `SUM(CASE WHEN ${locationCondition} THEN COALESCE(s.on_hand, 0) ELSE 0 END) ${sortOrder === "asc" ? "ASC" : "DESC"}`
        : `p.${sortBy || 'created_at'} ${sortOrder || 'desc'}`;

      const rawSql = `
        SELECT p.id
        FROM item_masters p
        LEFT JOIN stock_levels s ON s.product_id = p.id
        WHERE ${whereClause}
        GROUP BY p.id
        ${havingClause}
        ORDER BY ${sortSql}
        LIMIT ${limit} OFFSET ${skip}
      `;
      
      const orderedIds = await this.prisma.$queryRawUnsafe<{ id: string }[]>(rawSql);
      
      const products = await this.prisma.item_masters.findMany({
        where: { id: { in: (orderedIds || []).map(p => p.id) } },
        include: { 
          product_categories: true, 
          item_images: true,
          stock_levels: {
            where: isLocationFiltered ? { location_id } : undefined,
            select: { on_hand: true, location_id: true, tenant_id: true }
          }
        },
      });
      
      const productMap = new Map(products.map(p => [p.id, p]));
      const orderedProducts = (orderedIds || []).map(o => productMap.get(o.id)).filter(Boolean);
      
      return orderedProducts.map(p => this.mapToInventoryItem(p));
    }

    // Standard Prisma path for simple queries
    const where: any = { ...scope, status: { not: "deleted" } };
    if (search) {
      where.OR = [
        { sku: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category_id && category_id !== "all") where.category_id = category_id;
    if (status && status !== "all") where.status = status;
    if (is_anomaly !== undefined) where.is_anomaly = is_anomaly;

    const products = await this.prisma.item_masters.findMany({
      where,
      include: { 
        product_categories: true, 
        item_images: true,
        stock_levels: {
          where: isLocationFiltered ? (branchTenantId ? { tenant_id: branchTenantId } : { location_id }) : undefined,
          select: { on_hand: true }
        }
      },
      orderBy: sortBy === "name" ? { name: sortOrder || "asc" } : { created_at: sortOrder || "desc" },
      skip,
      take: limit,
    });

    return products.map(p => this.mapToInventoryItem(p));
  }

  private mapToInventoryItem(p: any): InventoryItem {
    const currentStock = p.stock_levels?.reduce((sum: number, level: any) => sum + Number(level.on_hand), 0) || 0;
    const minStock = Number(p.metadata?.min_stock) || 0;

    return {
      id: p.id,
      tenant_id: p.tenant_id,
      sku: p.sku,
      name: p.name,
      category: p.product_categories?.name || "consumable",
      uom: p.unit || "unit",
      barcode: p.barcode || p.sku,
      qr_code: p.barcode || p.sku,
      module_tags: p.module_tags || [],
      department_id: p.department_id || undefined,
      active: p.status === "active",
      status: (p.status || "active").toUpperCase(),
      image_url: p.image_url || undefined,
      images: p.item_images || [],
      selling_price: Number(p.selling_price) || 0,
      discount_rate: Number(p.discount_rate) || 0,
      discount_type: p.discount_type || "percentage",
      pricing_tiers: p.pricing_tiers || {},
      metadata: p.metadata || {},
      current_stock: currentStock,
      currentStock: currentStock,
      min_stock: minStock,
      minStock: minStock,
      is_anomaly: p.is_anomaly || false,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  }

  async countItems(ctx: TenantContext, location_id?: string, search?: string, category_id?: string, is_anomaly?: boolean): Promise<number> {
    // Items are tenant-scoped (company_id may be NULL on imported items)
    const where: any = { tenant_id: ctx.tenant_id, status: { not: "deleted" } };

    if (search) {
      where.OR = [
        { sku: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category_id && category_id !== "all") {
      where.category_id = category_id;
    }

    if (is_anomaly !== undefined) {
      where.is_anomaly = is_anomaly;
    }

    if (location_id) {
      where.stock_levels = { some: { location_id } };
    }

    return this.prisma.item_masters.count({ where });
  }

  async createItem(
    ctx: TenantContext,
    data: CreateItemDto,
  ): Promise<InventoryItem> {
    const scope = MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true });
    // Find or create category
    let category = await this.prisma.product_categories.findFirst({
      where: { ...scope, name: data.category },
    });

    if (!category) {
      category = await this.prisma.product_categories.create({
        data: MultiTenancyUtil.wrapCreate(ctx, {
          id: uuidv4(),
          updated_at: new Date(),
          name: data.category 
        }),
      });
    }

    const product = await this.prisma.item_masters.create({
      data: MultiTenancyUtil.wrapCreate(ctx, {
        id: uuidv4(),
        updated_at: new Date(),
        category_id: category.id,
        name: data.name,
        sku: data.sku,
        barcode: data.sku,
        description: data.description ?? null,
        unit: data.uom ?? "unit",
        base_price: data.base_price ?? 0,
        tax_rate: (data as any).tax_rate ?? 0,
        module_tags: (data as any).module_tags ?? [],
        status: data.status || "active",
        department_id: (data as any).department_id || null,
      }),
      include: { product_categories: true },
    });

    return this.mapToInventoryItem(product);
  }

  async getBalances(ctx: TenantContext,
    location_id?: string,
    department_id?: string,
    page: number = 1,
    limit: number = 100,
    search?: string,
    category_id?: string,
    item_id?: string
  ): Promise<StockBalance[]> {
    const skip = (page - 1) * limit;
    
    // If item_id is provided, we want cross-branch visibility for the item details modal
    const where: any = item_id 
      ? { tenant_id: ctx.tenant_id, product_id: item_id }
      : { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) };

    if (location_id) where.location_id = location_id;
    if (department_id) where.department_id = department_id;

    if (search) {
      where.item_masters = {
        OR: [
          { sku: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
        ]
      };
    }

    if (category_id && category_id !== "all") {
      where.item_masters = {
        ...(where.item_masters || {}),
        category_id: category_id
      };
    }

    const levels = await this.prisma.stock_levels.findMany({
      where,
      include: { item_masters: true, locations: true, departments: true },
      skip,
      take: limit,
    });

    return levels.map(
      (
        l: any
      ) => ({
        id: l.id,
        tenant_id: l.tenant_id,
        item_id: l.product_id,
        location_id: l.location_id,
        department_id: l.department_id || undefined,
        quantity: Number(l.on_hand),
        reserved_quantity: Number(l.reserved),
        in_transit_quantity: Number(l.in_transit),
        avg_unit_cost: Number(l.base_price || 0),
        reorder_point: Number(l.min_buffer || 0),
        safety_stock: Number(l.min_buffer || 0),
        updated_at: l.updated_at,
        item: l.item_masters,
        location: l.locations,
        department: l.departments,
      }),
    );
  }

  async countBalances(
    ctx: TenantContext,
    location_id?: string,
    department_id?: string,
    search?: string,
    category_id?: string,
    item_id?: string
  ): Promise<number> {
    // Consistent scoping with getBalances
    const where: any = item_id 
      ? { tenant_id: ctx.tenant_id, product_id: item_id }
      : { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) };

    if (location_id) where.location_id = location_id;
    if (department_id) where.department_id = department_id;

    if (search) {
      where.item_masters = {
        OR: [
          { sku: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
        ]
      };
    }

    if (category_id && category_id !== "all") {
      where.item_masters = {
        ...(where.item_masters || {}),
        category_id: category_id
      };
    }

    return this.prisma.stock_levels.count({ where });
  }

  async getMovements(
    ctx: TenantContext,
    item_id?: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<StockMovement[]> {
    const skip = (page - 1) * limit;
    const where = MultiTenancyUtil.getScope(ctx, {
      ...(item_id && { product_id: item_id }),
    }, { excludeBranch: true });

    const movements = await this.prisma.stock_movements.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
    });

    return movements.map((m: any) => ({
      id: m.id,
      tenant_id: m.tenant_id,
      item_id: m.product_id,
      movement_type: m.type.toLowerCase() as any,
      quantity: m.quantity,
      unit_cost: 0,
      reason: "Movement",
      source_location_id: m.from_location_id || undefined,
      destination_location_id: m.to_location_id || undefined,
      reference_id: m.reference_id,
      created_by: m.performed_by,
      created_at: m.created_at,
    }));
  }

  async countMovements(
    ctx: TenantContext,
    item_id?: string,
  ): Promise<number> {
    const where = MultiTenancyUtil.getScope(ctx, {
      ...(item_id && { product_id: item_id }),
    }, { excludeBranch: true });

    return this.prisma.stock_movements.count({ where });
  }

  async intakeStock(ctx: TenantContext,
    data: StockIntakeDto,
    providedTx?: any
  ): Promise<StockMovement> {
    const execute = async (tx: any) => {
      // 1. Atomic Upsert (Refactored for nullable department_id)
      const existingLevel = await tx.stock_levels.findFirst({
        where: {
          tenant_id: ctx.tenant_id,
          location_id: data.location_id,
          product_id: data.item_id,
          department_id: data.department_id || null,
        }
      });

      let level;
      if (existingLevel) {
        level = await tx.stock_levels.update({
          where: { id: existingLevel.id },
          data: {
            on_hand: { increment: data.quantity },
            available: { increment: data.quantity },
            updated_at: new Date(),
          },
        });
      } else {
        level = await tx.stock_levels.create({
          data: {
            id: uuidv4(),
            updated_at: new Date(),
            ...MultiTenancyUtil.getScope(ctx),
            location_id: data.location_id,
            department_id: data.department_id || null,
            product_id: data.item_id,
            on_hand: data.quantity,
            available: data.quantity,
          },
        });
      }

      // 2. Create movement
      const movement = await tx.stock_movements.create({
        data: {
          id: uuidv4(),
          updated_at: new Date(),
          ...MultiTenancyUtil.getScope(ctx),
          product_id: data.item_id,
          location_id: data.location_id, 
          to_location_id: data.location_id,
          to_department_id: data.department_id || null,
          quantity: data.quantity,
          type: "INTAKE",
          reference_id: data.reference_id || `INTAKE-${Date.now()}`,
          reference_type: data.reference_type || 'MANUAL',
          performed_by: data.created_by || "system",
        },
      });

      return {
        id: movement.id,
        tenant_id: movement.tenant_id,
        item_id: movement.product_id,
        movement_type: "intake" as any,
        quantity: movement.quantity,
        unit_cost: Number((movement as any).unit_cost || 0),
        reason: "Intake",
        destination_location_id: movement.to_location_id!,
        destination_department_id: movement.to_department_id || undefined,
        reference_id: movement.reference_id,
        created_by: movement.performed_by,
        created_at: movement.created_at,
      };
    };

    return providedTx ? execute(providedTx) : this.prisma.$transaction(execute);
  }

  async consumeStock(ctx: TenantContext, data: any, providedTx?: any): Promise<any> {
    const execute = async (tx: any) => {
      // 1. Atomic Update with inline balance check
      const affectedRows = await tx.$executeRaw`
        UPDATE stock_levels 
        SET on_hand = on_hand - ${data.quantity}, 
            available = available - ${data.quantity},
            updated_at = NOW()
        WHERE tenant_id = ${ctx.tenant_id}
          AND product_id = ${data.item_id}
          AND location_id = ${data.location_id}
          AND on_hand >= ${data.quantity}
      `;

      if (affectedRows === 0) {
        throw new Error(`Insufficient stock or balance not found for product ${data.item_id} at location ${data.location_id}`);
      }

      // 2. Create movement
      const movement = await tx.stock_movements.create({
        data: {
          id: uuidv4(),
          updated_at: new Date(),
          ...MultiTenancyUtil.getScope(ctx),
          product_id: data.item_id,
          location_id: data.location_id, 
          from_location_id: data.location_id,
          quantity: -data.quantity,
          type: "OUT",
          reference_id: data.reference_id || `CONSUME-${Date.now()}`,
          reference_type: data.reference_type || 'MANUAL',
          performed_by: data.performed_by || "system",
        },
      });

      return movement;
    };

    return providedTx ? execute(providedTx) : this.prisma.$transaction(execute);
  }

  async transferStock(ctx: TenantContext,
    data: TransferStockDto,
  ): Promise<StockMovement[]> {
    // For legacy immediate transfer, we use a single transaction but lock both rows
    return this.prisma.$transaction(async (tx): Promise<StockMovement[]> => {
      const source = await this.getLock(tx, ctx.tenant_id, data.item_id, data.from_location_id);
      if (!source || source.available < data.quantity) throw new Error(`Insufficient source stock for transfer`);

      // 1. Decrement source
      await tx.stock_levels.update({
        where: { id: source.id },
        data: {
          on_hand: { decrement: data.quantity },
          available: { decrement: data.quantity },
        },
      });

      // 2. Increment dest (standard immediate logic) (Refactored for nullable department_id)
      const existingDest = await tx.stock_levels.findFirst({
        where: {
          tenant_id: ctx.tenant_id,
          location_id: data.to_location_id,
          product_id: data.item_id,
          department_id: data.to_department_id || null,
        }
      });

      let dest;
      if (existingDest) {
        dest = await tx.stock_levels.update({
          where: { id: existingDest.id },
          data: {
            on_hand: { increment: data.quantity },
            available: { increment: data.quantity },
            updated_at: new Date(),
          },
        });
      } else {
        dest = await tx.stock_levels.create({
          data: {
            id: uuidv4(),
            updated_at: new Date(),
            ...MultiTenancyUtil.getScope(ctx),
            location_id: data.to_location_id,
            department_id: data.to_department_id || null,
            product_id: data.item_id,
            on_hand: data.quantity,
            available: data.quantity,
          },
        });
      }

      // 3. Create movement records
      const outMove = await tx.stock_movements.create({
        data: {
          id: uuidv4(),
          ...MultiTenancyUtil.getScope(ctx),
          product_id: data.item_id,
          location_id: data.from_location_id, // Mandatory location_id
          from_location_id: data.from_location_id,
          from_department_id: data.from_department_id || null,
          to_location_id: data.to_location_id,
          to_department_id: data.to_department_id || null,
          quantity: -data.quantity,
          type: "TRANSFER_OUT",
          reference_id: data.reference_id || `TR-${Date.now()}`,
          reference_type: data.reference_type || 'INTERNAL',
          performed_by: data.created_by || "system",
        },
      });

      const inMove = await tx.stock_movements.create({
        data: {
          id: uuidv4(),
          ...MultiTenancyUtil.getScope(ctx),
          product_id: data.item_id,
          location_id: data.to_location_id, // Mandatory location_id
          from_location_id: data.from_location_id,
          from_department_id: data.from_department_id || null,
          to_location_id: data.to_location_id,
          to_department_id: data.to_department_id || null,
          quantity: data.quantity,
          type: "TRANSFER_IN",
          reference_id: data.reference_id || `TR-${Date.now()}`,
          reference_type: data.reference_type || 'INTERNAL',
          performed_by: data.created_by || "system",
        },
      });

      return [outMove as any, inMove as any];
    });
  }

  async getAdjustments(ctx: TenantContext): Promise<InventoryAdjustment[]> {
    const adjs = await this.prisma.inventory_adjustments.findMany({
      where: MultiTenancyUtil.getScope(ctx),
      orderBy: { created_at: "desc" },
    });

    return adjs.map((a: any) => ({
      id: a.id,
      tenant_id: a.tenant_id,
      item_id: a.item_id,
      location_id: a.location_id,
      department_id: a.department_id || undefined,
      requested_delta: Number(a.requested_delta),
      reason: a.reason,
      status: a.status.toLowerCase() as any,
      requested_by: a.requested_by,
      approved_by: a.approved_by || undefined,
      approved_at: a.approved_at || undefined,
      created_at: a.created_at,
      updated_at: a.updated_at,
    }));
  }

  async createAdjustment(ctx: TenantContext,
    data: CreateAdjustmentDto,
    providedTx?: any
  ): Promise<InventoryAdjustment> {
    const db = providedTx || this.prisma;
    // Validate the item exists in the master before creating an adjustment, so an unknown
    // item_id is rejected with a clear 400 instead of a downstream FK-violation 500.
    const item = await db.item_masters.findFirst({
      where: { id: data.item_id, tenant_id: ctx.tenant_id },
      select: { id: true },
    });
    if (!item) {
      throw new BadRequestException(
        `Item ${data.item_id} does not exist in the item master for this tenant`,
      );
    }
    const adj = await db.inventory_adjustments.create({
      data: {
        id: uuidv4(),
        updated_at: new Date(),
        // inventory_adjustments has no branch_id/ecommerce_id columns; getScope(ctx)
        // injected them (-> 500 when ctx.branch_id is set). Set only tenant_id.
        tenant_id: ctx.tenant_id,
        item_id: data.item_id,
        location_id: data.location_id,
        department_id: data.department_id || null,
        requested_delta: data.requested_delta,
        reason: data.reason,
        status: "PENDING_APPROVAL",
        requested_by: data.requested_by || "system",
      },
    });

    return {
      id: adj.id,
      tenant_id: adj.tenant_id,
      item_id: adj.item_id,
      location_id: adj.location_id,
      department_id: adj.department_id || undefined,
      requested_delta: Number(adj.requested_delta),
      reason: adj.reason,
      status: adj.status as any,
      requested_by: adj.requested_by,
      created_at: adj.created_at,
      updated_at: adj.updated_at,
    };
  }

  async approveAdjustment(ctx: TenantContext,
    adjustmentId: string,
    approvedBy: string,
  ): Promise<InventoryAdjustment> {
    return this.prisma.$transaction(async (tx) => {
      const adj = await tx.inventory_adjustments.update({
        where: { id: adjustmentId, tenant_id: ctx.tenant_id },
        data: {
          status: "APPROVED",
          approved_by: approvedBy,
          approved_at: new Date(),
        },
      });

      const level = await tx.stock_levels.findFirst({
        where: {
          tenant_id: ctx.tenant_id,
          location_id: adj.location_id,
          product_id: adj.item_id,
          department_id: adj.department_id || null,
        },
      });

      if (level) {
        await tx.stock_levels.update({
          where: { id: level.id },
          data: {
            on_hand: { increment: adj.requested_delta },
            available: { increment: adj.requested_delta },
            updated_at: new Date(),
          },
        });
      } else {
        await tx.stock_levels.create({
          data: {
            id: uuidv4(),
            // stock_levels has no branch_id/ecommerce_id columns; getScope(ctx) injected
            // them (-> Prisma 500 when ctx.branch_id is set). Set only tenant_id.
            tenant_id: ctx.tenant_id,
            location_id: adj.location_id,
            department_id: adj.department_id || null,
            product_id: adj.item_id,
            on_hand: adj.requested_delta,
            available: adj.requested_delta,
            updated_at: new Date(),
          },
        });
      }


      // Add movement log for adjustment
      await tx.stock_movements.create({
        data: {
          id: uuidv4(),
          tenant_id: ctx.tenant_id,
          product_id: adj.item_id,
          location_id: adj.location_id,
          to_location_id: adj.location_id,
          to_department_id: adj.department_id || null,
          quantity: Math.abs(Number(adj.requested_delta)),
          type: Number(adj.requested_delta) > 0 ? "ADJUSTMENT_PLUS" : "ADJUSTMENT_MINUS",
          reference_id: `ADJ-${adj.id}`,
          reference_type: "ADJUSTMENT",
          performed_by: approvedBy,
        },
      });

      return {
        id: adj.id,
        tenant_id: adj.tenant_id,
        item_id: adj.item_id,
        location_id: adj.location_id,
        department_id: adj.department_id || undefined,
        requested_delta: Number(adj.requested_delta),
        reason: adj.reason,
        status: "approved" as const,
        requested_by: adj.requested_by,
        approved_by: adj.approved_by || undefined,
        approved_at: adj.approved_at || undefined,
        created_at: adj.created_at,
        updated_at: adj.updated_at,
      };
    });
  }

  async getAlerts(ctx: TenantContext): Promise<InventoryAlert[]> {
    const alerts = await this.prisma.inventory_alerts.findMany({
      where: MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
      orderBy: { created_at: "desc" },
    });

    return alerts.map((a: any) => ({
      id: a.id,
      tenant_id: a.tenant_id,
      alertType: a.type.toLowerCase() as any,
      severity: a.severity.toLowerCase() as any,
      status: a.status.toLowerCase() as any,
      entity_id: a.entity_id,
      message: a.message,
      created_at: a.created_at,
      updated_at: a.updated_at,
    }));
  }

  async setAlertStatus(ctx: TenantContext,
    alertId: string,
    status: InventoryAlert["status"],
  ): Promise<InventoryAlert> {
    const alert = await this.prisma.inventory_alerts.update({
      where: { id: alertId, tenant_id: ctx.tenant_id },
      data: { status },
    });
    return {
      id: alert.id,
      tenant_id: alert.tenant_id,
      alertType: alert.type.toLowerCase() as any,
      severity: alert.severity.toLowerCase() as any,
      status: alert.status.toLowerCase() as any,
      entity_id: alert.entity_id,
      message: alert.message,
      created_at: alert.created_at,
      updated_at: alert.updated_at,
    };
  }

  async getAuditCycles(ctx: TenantContext): Promise<any[]> {
    return this.prisma.inventory_audit_cycles.findMany({
      where: {
        tenant_id: ctx.tenant_id,
      },
    });
  }

  async createAuditCycle(ctx: TenantContext, data: any): Promise<any> {
    const { location_id, department_id, createdBy, description, name, notes, ...rest } = data;
    return this.prisma.inventory_audit_cycles.create({
      data: {
        id: uuidv4(),
        updated_at: new Date(),
        tenant_id: ctx.tenant_id,
        location_code: location_id || data.location_code || null,
        department_code: department_id || null,
        opened_by: createdBy || ctx.user_id || "system",
        ...rest,
      },
    });
  }

  async updateAuditCycle(ctx: TenantContext,
    id: string,
    data: any,
  ): Promise<any> {
    return this.prisma.inventory_audit_cycles.update({
      where: { 
        id, 
        tenant_id: ctx.tenant_id 
      },
      data,
    });
  }

  async getIntegrationEvents(ctx: TenantContext): Promise<any[]> {
    return this.prisma.inventory_integration_events.findMany({
      where: {
        tenant_id: ctx.tenant_id,
      },
    });
  }

  async createIntegrationEvent(ctx: TenantContext, data: any): Promise<any> {
    return this.prisma.inventory_integration_events.create({
      data: {
        id: uuidv4(),
        updated_at: new Date(),
        tenant_id: ctx.tenant_id,
        ...data,
      },
    });
  }

  async deleteItem(ctx: TenantContext, item_id: string): Promise<void> {
    await this.prisma.item_masters.update({
      where: { id: item_id, tenant_id: ctx.tenant_id },
      data: { status: "deleted" },
    });
  }

  async batchDeleteItems(ctx: TenantContext, itemIds: string[]): Promise<void> {
    await this.prisma.item_masters.updateMany({
      where: { id: { in: itemIds }, tenant_id: ctx.tenant_id },
      data: { status: "deleted" },
    });
  }

  async itemExistsBySku(ctx: TenantContext, sku: string): Promise<boolean> {
    const count = await this.prisma.item_masters.count({
      where: { tenant_id: ctx.tenant_id, sku: sku },
    });
    return count > 0;
  }

  async batchIntakeStock(ctx: TenantContext,
    data: StockIntakeDto[],
  ): Promise<StockMovement[]> {
    return this.prisma.$transaction(async (tx) => {
      const movements: StockMovement[] = [];
      for (const intake of data) {
        const move = await this.intakeStock(ctx, intake, tx);
        movements.push(move);
      }
      return movements;
    });
  }

  async requestProcurement(ctx: TenantContext, data: any): Promise<any> {
    // Creates a procurement requisition triggered by inventory low-stock
    // Uses a system user/employee; data should include: departmentId, reason, items[]
    const departmentId = data.departmentId || null;
    const requesterId = data.requested_by || data.requesterId || null;

    // If we don't have departmentId or requesterId, just log and return placeholder
    if (!departmentId || !requesterId) {
      console.warn(
        "[InventoryService] requestProcurement: Missing departmentId or requesterId — skipping PR creation",
      );
      return { skipped: true, reason: "Missing departmentId or requesterId" };
    }

    const total_amount = (data.items || []).reduce(
      (sum: number, item: any) =>
        sum + (item.quantity || 0) * (item.unit_price || 0),
      0,
    );

    return this.prisma.procurement_requisitions.create({
      data: {
        id: uuidv4(),
        updated_at: new Date(),
        ...MultiTenancyUtil.getScope(ctx),
        department_id: departmentId,
        requester_id: requesterId,
        branch_code: data.branchCode || "HQ",
        title: data.title || "Auto-Restock from Inventory",
        description: data.reason || "Low-stock auto-generated procurement request",
        category: data.category || "GENERAL",
        budget_class: data.budgetClass || "OPEX",
        amount: total_amount || 0,
        currency: data.currency || "IDR",
        status: "DRAFT",
      },
    });
  }

  async batchCreateItems(ctx: TenantContext, data: any[]): Promise<InventoryItem[]> {
    return this.prisma.$transaction(async (tx) => {
      const results: InventoryItem[] = [];
      const scope = MultiTenancyUtil.getScope(ctx);

      for (const itemData of data) {
        // Find or create category
        let category = await tx.product_categories.findFirst({
          where: { ...scope, name: itemData.category },
        });

        if (!category) {
          category = await tx.product_categories.create({
            data: {
              id: uuidv4(),
              updated_at: new Date(),
              ...scope,
              name: itemData.category,
            },
          });
        }

        const product = await tx.item_masters.upsert({
          where: {
            tenant_id_sku: {
              tenant_id: ctx.tenant_id,
              sku: itemData.sku,
            },
          },
          update: {
            updated_at: new Date(),
            category_id: category.id,
            name: itemData.name,
            barcode: itemData.barcode || itemData.sku,
            description: itemData.description ?? null,
            unit: itemData.uom || itemData.unit || "pcs",
            base_price: itemData.base_price ?? 0,
            tax_rate: itemData.taxRate ?? 0.11,
            module_tags: itemData.moduleTags ?? [],
            status: itemData.status || "active",
            department_id: itemData.departmentId || null,
            selling_price: itemData.selling_price ?? 0,
            discount_rate: itemData.discount_rate ?? 0,
            discount_type: itemData.discount_type || "percentage",
            pricing_tiers: itemData.pricing_tiers ? (typeof itemData.pricing_tiers === 'string' ? JSON.parse(itemData.pricing_tiers) : itemData.pricing_tiers) : null,
            metadata: itemData.metadata ? (typeof itemData.metadata === 'string' ? JSON.parse(itemData.metadata) : itemData.metadata) : null,
            is_anomaly: itemData.is_anomaly ?? false,
          },
          create: {
            id: uuidv4(),
            updated_at: new Date(),
            ...scope,
            category_id: category.id,
            name: itemData.name,
            sku: itemData.sku,
            barcode: itemData.barcode || itemData.sku,
            description: itemData.description ?? null,
            unit: itemData.uom || itemData.unit || "pcs",
            base_price: itemData.base_price ?? 0,
            tax_rate: itemData.taxRate ?? 0.11,
            module_tags: itemData.moduleTags ?? [],
            status: itemData.status || "active",
            department_id: itemData.departmentId || null,
            selling_price: itemData.selling_price ?? 0,
            discount_rate: itemData.discount_rate ?? 0,
            discount_type: itemData.discount_type || "percentage",
            pricing_tiers: itemData.pricing_tiers ? (typeof itemData.pricing_tiers === 'string' ? JSON.parse(itemData.pricing_tiers) : itemData.pricing_tiers) : null,
            metadata: itemData.metadata ? (typeof itemData.metadata === 'string' ? JSON.parse(itemData.metadata) : itemData.metadata) : null,
            is_anomaly: itemData.is_anomaly ?? false,
          },
          include: { product_categories: true },
        });

        // Handle initial quantity if provided
        if (itemData.quantity !== undefined && itemData.quantity !== null) {
          let locationId = itemData.locationId;
          
          if (!locationId && itemData.location) {
            const loc = await tx.locations.findFirst({
              where: { ...scope, name: { contains: itemData.location, mode: 'insensitive' } }
            });
            if (loc) {
              locationId = loc.id;
            }
          }

          if (locationId) {
            // Refactored for nullable department_id
            const existingStock = await tx.stock_levels.findFirst({
              where: {
                tenant_id: ctx.tenant_id,
                location_id: locationId,
                product_id: product.id,
                department_id: itemData.departmentId || null,
              }
            });

            if (existingStock) {
              await tx.stock_levels.update({
                where: { id: existingStock.id },
                data: {
                  on_hand: Number(itemData.quantity),
                  available: Number(itemData.quantity),
                  updated_at: new Date(),
                }
              });
            } else {
              await tx.stock_levels.create({
                data: {
                  id: uuidv4(),
                  updated_at: new Date(),
                  ...scope,
                  location_id: locationId,
                  product_id: product.id,
                  department_id: itemData.departmentId || null,
                  on_hand: Number(itemData.quantity),
                  available: Number(itemData.quantity),
                },
              });
            }
          }
        }

        results.push(this.mapToInventoryItem(product));
      }
      return results;
    });
  }

  async getNextSequence(ctx: TenantContext, category: string): Promise<number> {
    const count = await this.prisma.item_masters.count({
      where: {
        ...MultiTenancyUtil.getScope(ctx),
        product_categories: { name: category },
      },
    });
    return count + 1;
  }

  async updateItemStatus(ctx: TenantContext,
    item_id: string,
    status: string,
  ): Promise<InventoryItem> {
    const product = await this.prisma.item_masters.update({
      where: { id: item_id, tenant_id: ctx.tenant_id },
      data: { status },
      include: { product_categories: true },
    });

    return this.mapToInventoryItem(product);
  }

  async getPendingItems(ctx: TenantContext): Promise<InventoryItem[]> {
    const products = await this.prisma.item_masters.findMany({
      where: { tenant_id: ctx.tenant_id, status: "pending" },
      include: { product_categories: true },
    });

    return (products as any[]).map((p) => this.mapToInventoryItem(p));
  }

  async createMovementRequest(ctx: TenantContext,
    data: CreateMovementRequestDto,
  ): Promise<MovementRequest> {
    const request = await this.prisma.inventory_movement_requests.create({
      data: {
        id: uuidv4(),
        updated_at: new Date(),
        ...MultiTenancyUtil.getScope(ctx),
        product_id: data.product_id,
        from_location_id: data.from_location_id,
        to_location_id: data.to_location_id,
        quantity: data.quantity,
        status: "PENDING",
        priority: data.priority || "MEDIUM",
      },
    });

    return {
      id: request.id,
      tenant_id: request.tenant_id,
      product_id: request.product_id,
      from_location_id: request.from_location_id,
      to_location_id: request.to_location_id,
      quantity: request.quantity,
      priority: request.priority as any,
      status: request.status.toLowerCase() as any,
      requested_by: (request as any).requested_by || 'system',
      created_at: request.created_at,
      updated_at: request.updated_at,
    };
  }

  async findHighestSkuByCategory(ctx: TenantContext,
    category: string,
  ): Promise<string | null> {
    const product = await this.prisma.item_masters.findFirst({
      where: {
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        product_categories: { name: category },
      },
      orderBy: { sku: "desc" },
    });
    return product?.sku || null;
  }

  // --- Financial-Grade Hardening ---

  async reserveStock(ctx: TenantContext,
    product_id: string,
    location_id: string,
    quantity: number,
    referenceId: string,
    referenceType: string,
    tx?: any,
  ): Promise<void> {
    const execute = async (t: any) => {
      // 1. Atomic reservation
      const updateResult = await t.$executeRaw`
        UPDATE stock_levels 
        SET 
          reserved = reserved + ${quantity},
          available = available - ${quantity},
          updated_at = NOW()
        WHERE 
          tenant_id = ${ctx.tenant_id} AND 
          product_id = ${product_id} AND 
          location_id = ${location_id} AND 
          available >= ${quantity}
      `;

      if (updateResult === 0) {
        throw new Error(
          `Insufficient available stock at ${location_id} for reservation`,
        );
      }

      // 2. Create reservation record
      await t.stock_reservations.create({
        data: {
          id: uuidv4(),
          updated_at: new Date(),
          ...MultiTenancyUtil.getScope(ctx),
          product_id: product_id,
          location_id: location_id,
          quantity,
          status: "PENDING",
          reference_id: referenceId,
          reference_type: referenceType,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // Default 24h
        },
      });

      // 3. Create movement for audit if not exists
      const existingMovement = await t.stock_movements.findFirst({
        where: {
          tenant_id: ctx.tenant_id,
          reference_id: referenceId,
          reference_type: referenceType,
          type: "RESERVE",
          product_id,
          location_id,
        }
      });

      if (!existingMovement) {
        await t.stock_movements.create({
          data: {
            id: uuidv4(),
            updated_at: new Date(),
            ...MultiTenancyUtil.getScope(ctx),
            product_id: product_id,
            location_id: location_id,
            to_location_id: location_id,
            quantity: 0, // Reservation doesn't change on_hand
            type: "RESERVE",
            reference_id: referenceId,
            reference_type: referenceType,
            reservation_id: referenceId,
            performed_by: "system",
          },
        });
      }
    };
    return tx ? execute(tx) : this.prisma.$transaction(execute);
  }

  async releaseStock(ctx: TenantContext,
    product_id: string,
    location_id: string,
    quantity: number,
    referenceId: string,
    referenceType: string,
    tx?: any,
  ): Promise<void> {
    const execute = async (t: any) => {
      // 1. Atomic release
      const updateResult = await t.$executeRaw`
        UPDATE stock_levels 
        SET 
          reserved = reserved - ${quantity},
          available = available + ${quantity},
          updated_at = NOW()
        WHERE 
          tenant_id = ${ctx.tenant_id} AND 
          product_id = ${product_id} AND 
          location_id = ${location_id} AND 
          reserved >= ${quantity}
      `;

      if (updateResult === 0) {
        throw new Error(`Insufficient reserved stock at ${location_id} for release`);
      }

      // 2. Update reservation status
      await t.stock_reservations.updateMany({
        where: {
          ...MultiTenancyUtil.getScope(ctx),
          product_id,
          location_id,
          reference_id: referenceId,
          status: "PENDING",
        },
        data: { status: "CANCELLED" },
      });

      // 3. Create movement if not exists
      const existingMovement = await t.stock_movements.findFirst({
        where: {
          tenant_id: ctx.tenant_id,
          reference_id: referenceId,
          reference_type: referenceType,
          type: "RELEASE",
          product_id,
          location_id,
        }
      });

      if (!existingMovement) {
        await t.stock_movements.create({
          data: {
            id: uuidv4(),
            updated_at: new Date(),
            ...MultiTenancyUtil.getScope(ctx),
            product_id: product_id,
            location_id: location_id,
            to_location_id: location_id,
            quantity: 0,
            type: "RELEASE",
            reference_id: referenceId,
            reference_type: referenceType,
            performed_by: "system",
          },
        });
      }
    };
    return tx ? execute(tx) : this.prisma.$transaction(execute);
  }

  async consumeFromReservation(ctx: TenantContext,
    product_id: string,
    location_id: string,
    quantity: number,
    referenceId: string,
    referenceType: string,
    tx?: any,
  ): Promise<void> {
    const execute = async (t: any) => {
      // 1. Atomic consumption from reservation
      const updateResult = await t.$executeRaw`
        UPDATE stock_levels 
        SET 
          on_hand = on_hand - ${quantity},
          reserved = reserved - ${quantity},
          updated_at = NOW()
        WHERE 
          tenant_id = ${ctx.tenant_id} AND 
          product_id = ${product_id} AND 
          location_id = ${location_id} AND 
          reserved >= ${quantity} AND 
          on_hand >= ${quantity}
      `;

      if (updateResult === 0) {
        throw new Error(
          `Insufficient reserved or on-hand stock at ${location_id} for consumption`,
        );
      }

      // 2. Update Reservation Record
      await t.stock_reservations.updateMany({
        where: {
          ...MultiTenancyUtil.getScope(ctx),
          reference_id: referenceId,
          product_id: product_id,
          status: "PENDING",
        },
        data: { status: "CONSUMED" },
      });

      // 3. Create movement
      await t.stock_movements.create({
        data: {
          id: uuidv4(),
          updated_at: new Date(),
          ...MultiTenancyUtil.getScope(ctx),
          product_id: product_id,
          location_id: location_id,
          from_location_id: location_id,
          quantity: -quantity,
          type: "CONSUME_RESERVED",
          reference_id: referenceId,
          reference_type: referenceType,
          reservation_id: referenceId,
          performed_by: "system",
        },
      });
    };
    return tx ? execute(tx) : this.prisma.$transaction(execute);
  }

  async transferOut(ctx: TenantContext,
    product_id: string,
    fromLocationId: string,
    toLocationId: string,
    quantity: number,
    referenceId: string,
    referenceType: string,
    transferGroupId?: string,
    tx?: any,
  ): Promise<StockMovement> {
    const execute = async (t: any) => {
      // 1. Atomic decrement at Source
      const sourceUpdate = await t.$executeRaw`
        UPDATE stock_levels 
        SET 
          on_hand = on_hand - ${quantity},
          available = available - ${quantity},
          updated_at = NOW()
        WHERE 
          tenant_id = ${ctx.tenant_id} AND 
          product_id = ${product_id} AND 
          location_id = ${fromLocationId} AND 
          on_hand >= ${quantity}
      `;

      if (sourceUpdate === 0) {
        throw new Error(`Insufficient stock at source ${fromLocationId} for transfer`);
      }

      // 2. Increment in_transit at Destination (Refactored to avoid upsert issues with nullable fields)
      const existingDest = await t.stock_levels.findFirst({
        where: {
          tenant_id: ctx.tenant_id,
          location_id: toLocationId,
          product_id: product_id,
          department_id: null,
        },
      });

      if (existingDest) {
        await t.stock_levels.update({
          where: { id: existingDest.id },
          data: {
            in_transit: { increment: quantity },
            updated_at: new Date(),
          },
        });
      } else {
        await t.stock_levels.create({
          data: {
            id: uuidv4(),
            tenant_id: ctx.tenant_id,
            location_id: toLocationId,
            product_id: product_id,
            department_id: null,
            on_hand: 0,
            in_transit: quantity,
            available: 0,
            updated_at: new Date(),
          },
        });
      }

      // 3. Create movement if not exists
      const existingMovement = await t.stock_movements.findFirst({
        where: {
          tenant_id: ctx.tenant_id,
          reference_id: referenceId,
          reference_type: referenceType,
          type: "TRANSFER_OUT",
          product_id,
          location_id: fromLocationId,
        }
      });

      if (!existingMovement) {
        return t.stock_movements.create({
          data: {
            id: uuidv4(),
            updated_at: new Date(),
            ...MultiTenancyUtil.getScope(ctx),
            product_id: product_id,
            location_id: fromLocationId,
            from_location_id: fromLocationId,
            to_location_id: toLocationId,
            quantity: -quantity,
            type: "TRANSFER_OUT",
            reference_id: referenceId,
            reference_type: referenceType,
            transfer_group_id: transferGroupId,
            performed_by: "system",
          },
        });
      }
      return existingMovement;
    };
    return tx ? execute(tx) : this.prisma.$transaction(execute);
  }

  async transferIn(ctx: TenantContext,
    product_id: string,
    fromLocationId: string,
    toLocationId: string,
    quantity: number,
    referenceId: string,
    referenceType: string,
    transferGroupId?: string,
    tx?: any,
  ): Promise<StockMovement> {
    const execute = async (t: any) => {
      // 1. Atomic decrement in-transit at transit pool (fromLocationId)
      const transitUpdate = await t.$executeRaw`
        UPDATE stock_levels 
        SET 
          in_transit = in_transit - ${quantity},
          updated_at = NOW()
        WHERE 
          tenant_id = ${ctx.tenant_id} AND 
          product_id = ${product_id} AND 
          location_id = ${fromLocationId} AND 
          in_transit >= ${quantity}
      `;

      if (transitUpdate === 0) {
        throw new Error(
          `Insufficient in-transit stock at transit pool ${fromLocationId} for receipt`,
        );
      }

      // 2. Atomic increment on-hand at destination (toLocationId)
      const existingDest = await t.stock_levels.findFirst({
        where: {
          tenant_id: ctx.tenant_id,
          product_id: product_id,
          location_id: toLocationId,
          department_id: null
        }
      });

      if (existingDest) {
        await t.stock_levels.update({
          where: { id: existingDest.id },
          data: {
            on_hand: { increment: quantity },
            available: { increment: quantity },
            updated_at: new Date()
          }
        });
      } else {
        await t.stock_levels.create({
          data: {
            id: uuidv4(),
            tenant_id: ctx.tenant_id,
            product_id: product_id,
            location_id: toLocationId,
            department_id: null,
            on_hand: quantity,
            available: quantity,
            updated_at: new Date()
          }
        });
      }

      // 3. Create movement if not exists
      const existingMovement = await t.stock_movements.findFirst({
        where: {
          tenant_id: ctx.tenant_id,
          reference_id: referenceId,
          reference_type: referenceType,
          type: "TRANSFER_IN",
          product_id,
          location_id: toLocationId,
        }
      });

      if (!existingMovement) {
        return t.stock_movements.create({
          data: {
            id: uuidv4(),
            updated_at: new Date(),
            ...MultiTenancyUtil.getScope(ctx),
            product_id: product_id,
            location_id: toLocationId,
            from_location_id: fromLocationId,
            to_location_id: toLocationId,
            quantity: quantity,
            type: "TRANSFER_IN",
            reference_id: referenceId,
            reference_type: referenceType,
            transfer_group_id: transferGroupId,
            performed_by: "system",
          },
        });
      }
      return existingMovement;
    };
    return tx ? execute(tx) : this.prisma.$transaction(execute);
  }

  async takeSnapshot(ctx: TenantContext, location_id: string): Promise<void> {
    const levels = await this.prisma.stock_levels.findMany({
        where: { ...MultiTenancyUtil.getScope(ctx), location_id: location_id }
    });

    await this.prisma.stock_snapshots.createMany({
        data: (levels as any[]).map(l => ({
            id: uuidv4(),
            ...MultiTenancyUtil.getScope(ctx),
            location_id: l.location_id,
            product_id: l.product_id,
            onHand: l.on_hand,
            reserved: l.reserved,
            available: l.available,
            inTransit: l.in_transit,
            snapshot_at: new Date(),
        }))
    });
  }

  // --- Stock State Upgrades (Helpers) ---
  async updateStockReserved(ctx: TenantContext,
    product_id: string,
    location_id: string,
    quantity: number,
    type: 'increment' | 'decrement',
    providedTx?: any
  ): Promise<void> {
    // Legacy helper - redirect to new formal methods if possible or keep logic
    return this.reserveStock(ctx, product_id, location_id, quantity, `UP-RES-${Date.now()}`, 'ADJUSTMENT', providedTx);
  }

  async updateStockInTransit(ctx: TenantContext,
    product_id: string,
    fromLocationId: string,
    toLocationId: string,
    quantity: number,
    type: 'increment' | 'decrement',
    providedTx?: any
  ): Promise<void> {
    // Helper used by service
    const execute = async (tx: any) => {
        if (type === 'increment') {
            await this.transferOut(ctx, product_id, fromLocationId, toLocationId, quantity, `TR-OUT-${Date.now()}`, 'TRANSFER', undefined, tx);
        } else {
            await this.transferIn(ctx, product_id, fromLocationId, toLocationId, quantity, `TR-IN-${Date.now()}`, 'TRANSFER', undefined, tx);
        }
    };
    return providedTx ? execute(providedTx) : this.prisma.$transaction(execute);
  }

  async findProductByCode(ctx: TenantContext, code: string): Promise<any | null> {
    return this.prisma.item_masters.findFirst({
      where: {
        ...MultiTenancyUtil.getScope(ctx),
        OR: [{ barcode: code }, { sku: code }],
      },
      include: { product_categories: true },
    });
  }

  /**
   * Specialized lookup optimized for scanners.
   * Enforces Per-Tenant Uniqueness as per Phase 4 requirement.
   */
  async lookupByBarcode(ctx: TenantContext, barcode: string): Promise<any | null> {
    return this.prisma.item_masters.findFirst({
      where: {
        tenant_id: ctx.tenant_id,
        OR: [
          { barcode: { equals: barcode, mode: 'insensitive' } },
          { sku: { equals: barcode, mode: 'insensitive' } }
        ],
      },
      include: { product_categories: true },
    });
  }

  /**
   * Atomic, low-latency stock adjustment for Edge scanners.
   */
  async quickAdjust(ctx: TenantContext,
    item_id: string,
    location_id: string,
    delta: number,
    user_id: string
  ): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Row Level Lock
      const level = await this.getLock(tx, ctx.tenant_id, item_id, location_id);
      
      if (!level) {
        // Auto-create level for inflow if missing
        if (delta < 0) throw new Error(`Stock level not found for adjustment`);
        
        return tx.stock_levels.create({
          data: {
            id: uuidv4(),
            updated_at: new Date(),
            tenant_id: ctx.tenant_id,
            product_id: item_id,
            location_id,
            on_hand: delta,
            available: delta,
          }
        });
      }

      // 2. Atomic Update
      const updated = await tx.stock_levels.update({
        where: { id: level.id },
        data: {
          on_hand: { [delta > 0 ? "increment" : "decrement"]: Math.abs(delta) },
          available: { [delta > 0 ? "increment" : "decrement"]: Math.abs(delta) },
        }
      });

      // 3. Lightweight Movement Log
      await tx.stock_movements.create({
        data: {
          id: uuidv4(),
          updated_at: new Date(),
          tenant_id: ctx.tenant_id,
          product_id: item_id,
          location_id,
          type: delta > 0 ? "SCAN_IN" : "SCAN_OUT",
          quantity: delta,
          reference_type: "EDGE_SCAN",
          reference_id: `SCAN-${Date.now()}`,
          performed_by: user_id,
        }
      });

      return updated;
    });
  }


  // --- Agentic Layer ---
  async getAgenticEvents(ctx: TenantContext): Promise<AgenticEvent[]> {
    const events = await this.prisma.agentic_events.findMany({
      where: {
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        entity_type: "INVENTORY",
      },
      orderBy: { created_at: "desc" },
    });

    return events.map((e) => ({
      id: e.id,
      tenant_id: e.tenant_id,
      event_type: e.event_type,
      entity_id: e.entity_id,
      entity_type: e.entity_type,
      payload: e.payload as any,
      status: e.status,
      processedAt: e.processed_at || undefined,
      errorMsg: e.error_msg || undefined,
      created_at: e.created_at,
    }));
  }

  async createAgenticEvent(ctx: TenantContext,
    data: CreateAgenticEventDto,
  ): Promise<AgenticEvent> {
    const event = await this.prisma.agentic_events.create({
      data: {
        id: uuidv4(),
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        event_type: data.event_type,
        entity_id: data.entity_id,
        entity_type: data.entity_type,
        payload: data.payload as any,
        source_event_id: (data as any).sourceEventId || null,
        correlation_id: (data as any).correlation_id || null,
        status: "PENDING",
      },
    });
    return {
      id: event.id,
      tenant_id: event.tenant_id,
      event_type: event.event_type,
      entity_id: event.entity_id,
      entity_type: event.entity_type,
      payload: event.payload as any,
      status: event.status,
      processedAt: event.processed_at || undefined,
      errorMsg: event.error_msg || undefined,
      created_at: event.created_at,
    };
  }

  async getTransfers(ctx: TenantContext): Promise<any[]> {
    return this.prisma.inventory_transfers.findMany({
      where: MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
      include: {
        item_masters: true,
        from_location: true,
        to_location: true,
      },
      orderBy: { created_at: "desc" },
    });
  }

  async getTransferById(ctx: TenantContext, id: string): Promise<any | null> {
    return this.prisma.inventory_transfers.findFirst({
      where: { id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      include: {
        item_masters: true,
        from_location: true,
        to_location: true,
      },
    });
  }

  async createStockTransfer(ctx: TenantContext, data: any, tx?: any): Promise<any> {
    const db = tx || this.prisma;
    return db.inventory_transfers.create({
      data: {
        ...data,
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        id: uuidv4(),
        updated_at: new Date(),
      },
    });
  }

  async updateStockTransfer(ctx: TenantContext, id: string, data: any, tx?: any): Promise<any> {
    const db = tx || this.prisma;
    const scope = MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true });
    return db.inventory_transfers.update({
      where: { id, ...scope },
      data: {
        ...data,
        updated_at: new Date(),
      },
    });
  }

  private async getLock(
    tx: Prisma.TransactionClient,
    tenant_id: string,
    product_id: string,
    location_id: string,
  ): Promise<any> {
    const rows: any[] = await tx.$queryRaw(Prisma.sql`
      SELECT * FROM stock_levels 
      WHERE tenant_id = ${tenant_id} 
      AND product_id = ${product_id} 
      AND location_id = ${location_id}
      FOR UPDATE
    `);
    return rows[0] || null;
  }

  // --- Category Management ---
  async getProductCategories(ctx: TenantContext): Promise<any[]> {
    return this.prisma.product_categories.findMany({
      where: { tenant_id: ctx.tenant_id },
      orderBy: { name: "asc" },
    });
  }

  async createProductCategory(ctx: TenantContext, data: any): Promise<any> {
    return this.prisma.product_categories.create({
      data: MultiTenancyUtil.wrapCreate(ctx, {
        id: uuidv4(),
        updated_at: new Date(),
        name: data.name,
        parent_id: data.parent_id || null,
        icon: data.icon || null,
      }),
    });
  }

  async updateProductCategory(ctx: TenantContext, id: string, data: any): Promise<any> {
    return this.prisma.product_categories.update({
      where: { id, tenant_id: ctx.tenant_id },
      data: {
        ...data,
        updated_at: new Date(),
      },
    });
  }

  async deleteProductCategory(ctx: TenantContext, id: string): Promise<void> {
    // Check if category has items
    const itemCount = await this.prisma.item_masters.count({
      where: { category_id: id, tenant_id: ctx.tenant_id },
    });

    if (itemCount > 0) {
      throw new Error("Cannot delete category with associated items. Reclassify items first.");
    }

    await this.prisma.product_categories.delete({
      where: { id, tenant_id: ctx.tenant_id },
    });
  }

  async updateItemCategory(ctx: TenantContext, itemId: string, categoryId: string): Promise<any> {
    return this.prisma.item_masters.update({
      where: { id: itemId, tenant_id: ctx.tenant_id },
      data: { category_id: categoryId, updated_at: new Date() }
    });
  }

  async updateItem(ctx: TenantContext, itemId: string, data: any): Promise<any> {
    return this.prisma.item_masters.update({
      where: { id: itemId, tenant_id: ctx.tenant_id },
      data: {
        ...data,
        updated_at: new Date()
      }
    });
  }

  async getItemById(ctx: TenantContext, itemId: string): Promise<any> {
    return this.prisma.item_masters.findFirst({
      where: { id: itemId, tenant_id: ctx.tenant_id },
      include: {
        product_categories: true
      }
    });
  }

  async getCategoryById(ctx: TenantContext, categoryId: string): Promise<any> {
    return this.prisma.product_categories.findFirst({
      where: { id: categoryId, tenant_id: ctx.tenant_id }
    });
  }

  async getSalesHistory(ctx: TenantContext, itemId: string): Promise<any[]> {
    return this.prisma.retail_order_items.findMany({
      where: {
        tenant_id: ctx.tenant_id,
        product_id: itemId
      },
      include: {
        retail_orders: {
          select: {
            id: true,
            created_at: true,
            status: true
          }
        }
      },
      orderBy: { updated_at: "desc" },
      take: 50
    });
  }

  async getProcurementHistory(ctx: TenantContext, itemId: string): Promise<any[]> {
    const lines = await this.prisma.procurement_po_lines.findMany({
      where: {
        tenant_id: ctx.tenant_id,
        product_id: itemId,
      },
      include: {
        procurement_draft_pos: {
          include: {
            supplier_masters: {
              select: { name: true }
            },
            procurement_final_pos: {
              select: { id: true }
            }
          }
        }
      },
      orderBy: { created_at: "desc" },
      take: 50
    });

    return lines.map(line => ({
      id: line.draft_po_id,
      date: line.created_at,
      status: line.procurement_draft_pos.status,
      supplier: line.procurement_draft_pos.supplier_masters?.name,
      total: Number(line.total_cost),
      final_po: line.procurement_draft_pos.procurement_final_pos?.[0]?.id
    }));
  }

  // --- Void Request & Approval Workflow Methods ---
  async createVoidRequest(
    ctx: TenantContext,
    data: {
      entity_type: string;
      entity_id: string;
      reason: string;
      requested_by: string;
      company_id?: string;
      status?: "PENDING" | "APPROVED" | "REJECTED";
      approved_by?: string;
      approved_at?: Date;
    },
    tx?: any
  ): Promise<any> {
    const db = tx || this.prisma;
    
    return db.void_requests.create({
      data: MultiTenancyUtil.wrapCreate(ctx, {
        id: uuidv4(),
        entity_type: data.entity_type,
        entity_id: data.entity_id,
        reason: data.reason,
        requested_by: data.requested_by,
        status: data.status || "PENDING",
        company_id: data.company_id,
        approved_by: data.status === "APPROVED" ? data.approved_by || data.requested_by : null,
        approved_at: data.status === "APPROVED" ? data.approved_at || new Date() : null,
      }),
    });
  }

  async approveVoidRequest(
    ctx: TenantContext,
    voidRequest_id: string,
    approver_id: string,
    tx?: any
  ): Promise<any> {
    const db = tx || this.prisma;
    
    return db.void_requests.update({
      where: { id: voidRequest_id, tenant_id: ctx.tenant_id },
      data: {
        status: "APPROVED",
        approved_by: approver_id,
        approved_at: new Date(),
        last_action: "APPROVED",
        updated_at: new Date(),
      },
    });
  }

  async rejectVoidRequest(
    ctx: TenantContext,
    voidRequest_id: string,
    rejector_id: string,
    tx?: any
  ): Promise<any> {
    const db = tx || this.prisma;
    
    return db.void_requests.update({
      where: { id: voidRequest_id, tenant_id: ctx.tenant_id },
      data: {
        status: "REJECTED",
        rejected_by: rejector_id,
        rejected_at: new Date(),
        last_action: "REJECTED",
        updated_at: new Date(),
      },
    });
  }

  async getVoidRequestById(ctx: TenantContext, voidRequest_id: string): Promise<any | null> {
    return this.prisma.void_requests.findFirst({
      where: { id: voidRequest_id, tenant_id: ctx.tenant_id },
    });
  }

  async getVoidRequestsByEntity(
    ctx: TenantContext,
    entity_type: string,
    entity_id: string
  ): Promise<any[]> {
    return this.prisma.void_requests.findMany({
      where: {
        tenant_id: ctx.tenant_id,
        entity_type,
        entity_id,
      },
      orderBy: { created_at: "desc" },
    });
  }

  async listVoidRequests(
    ctx: TenantContext,
    filters?: {
      status?: string;
      entity_type?: string;
    }
  ): Promise<any[]> {
    const where: any = { tenant_id: ctx.tenant_id };
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.entity_type) {
      where.entity_type = filters.entity_type;
    }
    return this.prisma.void_requests.findMany({
      where,
      orderBy: { created_at: "desc" },
    });
  }

}
