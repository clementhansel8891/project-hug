import { TenantContext } from "../../../gateway/tenant-context.interface";
import { MultiTenancyUtil } from "../../../shared/utils/multi-tenancy.util";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../persistence/prisma.service";

import { IRetailRepository } from "./retail.repository.interface";
import {
  RetailStore,
  RetailProduct,
  RetailOrder,
  RetailShift,
  RetailOrderItem,
} from "../entities/retail.entity";
import {
  CreateStoreDto,
  UpdateStoreDto,
  CreateOrderDto,
  OpenShiftDto,
  CloseShiftDto,
  CreateEcommerceStoreDto,
  UpdateEcommerceStoreDto,
  CreateInventoryPoolDto,
  UpdateProductDto,
  CheckoutDto,
} from "../dto/retail.dto";
import { v4 as uuidv4 } from "uuid";
import { createHash } from "crypto";
import {
  stores,
  item_masters,
  retail_orders as prismaOrder,
  retail_order_items as prismaOrderItem,
  retail_shifts as prismaShift,
  retail_channels,
  retail_customers,
  retail_customer_sessions,
  retail_carts,
  retail_cart_items,
  retail_wishlists,
  retail_wishlist_items,
  retail_promotions,
  Prisma,
} from "@prisma/client";

@Injectable()
export class RetailDbRepository implements IRetailRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to run logic within a transaction if one isn't already active.
   * This is critical for integration tests that run in a rollback transaction.
   */
  private async runInTx<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if ((this.prisma as any).$transaction) {
      return (this.prisma as any).$transaction(callback);
    }
    return callback(this.prisma as any);
  }

  // ============================================================
  // BRANCHES (Physical store)
  // ============================================================

  async listStores(ctx: TenantContext,
    location_id?: string,
  ): Promise<RetailStore[]> {
    // Don't filter by company_id for stores - stores belong to the tenant level
    const where: any = { 
      tenant_id: ctx.tenant_id,
      deleted_at: null 
    };
    if (location_id) where.location_id = location_id;

    const store = await this.prisma.stores.findMany({
      where,
      orderBy: { created_at: "desc" },
    });
    console.log(`[RetailDbRepository] listStores: Found ${store.length} stores for where:`, JSON.stringify(where));
    return store.map((s: stores) => this.mapStore(s));
  }

  async listCategories(ctx: TenantContext): Promise<any[]> {
    return this.prisma.product_categories.findMany({
      where: { tenant_id: ctx.tenant_id },
      orderBy: { name: "asc" },
    });
  }

  async getStore(ctx: TenantContext,
    store_id: string,
  ): Promise<RetailStore | null> {
    const store = await this.prisma.stores.findFirst({
      where: { id: store_id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), deleted_at: null },
    });
    return store ? this.mapStore(store) : null;
  }

  async createStore(ctx: TenantContext,
    data: CreateStoreDto,
  ): Promise<RetailStore> {
    return await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        let finalLocationId = data.location_id;

        // If location_id is a placeholder or missing, create a new Location for this Branch
                // If location_id is a placeholder or missing, try to find an existing location with the same code or name
        if (
          !finalLocationId ||
          finalLocationId === "loc-default" ||
          finalLocationId === "placeholder"
        ) {
          const existingLoc = await tx.locations.findFirst({
            where: {
              tenant_id: ctx.tenant_id,
              OR: [
                { code: data.code },
                { name: data.name }
              ],
              deleted_at: null
            }
          });

          if (existingLoc) {
            finalLocationId = existingLoc.id;
          } else {
            const newLocation = await tx.locations.create({
              data: {
                id: uuidv4(),
                updated_at: new Date(),
                ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true, excludeEcommerce: true }),
                name: data.name,
                code: data.code,
                address: data.address || "Main Street",
                type: "branch",
                latitude: data.latitude,
                longitude: data.longitude,
                geofence_radius: data.geofenceRadius || 200,
                country: data.country,
                currency: data.currency,
              },
            });
            finalLocationId = newLocation.id;
          }
        }

        const store = await tx.stores.create({
          data: {
            id: uuidv4(),
            updated_at: new Date(),
            ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
            location_id: finalLocationId,
            name: data.name,
            code: data.code,
            type: data.type,
            phone: data.phone,
            email: data.email,
            timezone: data.timezone ?? "Asia/Jakarta",
            operating_hours: (data as any).operatingHours as any,
            inventory_pool_id: data.inventory_pool_id,
            manager_id: data.manager_id,
            settings: {
              operational_config: data.operational_config,
              supply_config: data.supply_config,
              infrastructure_registry: data.infrastructure_registry,
              channel_binding: data.channel_binding,
              governance: data.governance,
            } as any,
            country: data.country,
            currency: data.currency,
          },
        });
        return this.mapStore(store);
      },
    );
  }

  async updateStore(ctx: TenantContext,
    store_id: string,
    data: UpdateStoreDto,
  ): Promise<RetailStore> {
    const existing = await this.prisma.stores.findUnique({
      where: { id: store_id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
    });
    if (!existing) throw new Error("Store not found");

    const currentSettings = (existing.settings as any) || {};

    const store = await this.prisma.stores.update({
      where: { id: store_id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      data: {
        name: data.name,
        location_id: data.location_id,
        currency: data.currency,
        type: data.type,
        phone: data.phone,
        email: data.email,
        timezone: data.timezone,
        manager_id: data.manager_id,
        inventory_pool_id: data.inventory_pool_id,
        operating_hours: (data as any).operatingHours as any,
        settings: {
          ...currentSettings,
          operational_config:
            data.operational_config ?? currentSettings.operational_config,
          supply_config: data.supply_config ?? currentSettings.supply_config,
          infrastructure_registry:
            data.infrastructure_registry ??
            currentSettings.infrastructure_registry,
          channel_binding:
            data.channel_binding ?? currentSettings.channel_binding,
          governance: data.governance ?? currentSettings.governance,
          tax_zone: data.tax_zone ?? currentSettings.tax_zone,
        } as any,
        status: data.status,
      },
    });
    return this.mapStore(store);
  }

  async deleteStore(ctx: TenantContext, store_id: string): Promise<void> {
    await this.prisma.stores.update({
      where: { id: store_id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      data: { deleted_at: new Date(), status: "decommissioned" },
    });
  }

  // ============================================================
  // INVENTORY POOLS
  // ============================================================

  async listInventoryPools(ctx: TenantContext): Promise<any[]> {
    return this.prisma.inventory_pools.findMany({
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), deleted_at: null },
      orderBy: { created_at: "desc" },
    });
  }

  async createInventoryPool(ctx: TenantContext,
    data: CreateInventoryPoolDto,
  ): Promise<any> {
    return this.prisma.inventory_pools.create({
      data: {
        id: uuidv4(),
        updated_at: new Date(),
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        name: data.name,
        description: data.description,
        type: data.type ?? "shared",
      },
    });
  }

  async getInventoryPool(ctx: TenantContext,
    poolId: string,
  ): Promise<any | null> {
    return this.prisma.inventory_pools.findFirst({
      where: { id: poolId, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true, excludeEcommerce: true }), deleted_at: null },
      include: { inventory_pool_stock: { include: { item_masters: true } } },
    });
  }

  async deleteInventoryPool(ctx: TenantContext, poolId: string): Promise<void> {
    await this.prisma.inventory_pools.update({
      where: { id: poolId, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true, excludeEcommerce: true }) },
      data: { deleted_at: new Date() },
    });
  }

  // ============================================================
  // E-COMMERCE STORES
  // ============================================================

  async listEcommerceStores(ctx: TenantContext,
    store_id?: string,
  ): Promise<any[]> {
    const where: any = { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true, excludeEcommerce: true }), deleted_at: null };
    if (store_id) {
      where.stores = { some: { id: store_id } };
    }

    const store = await this.prisma.ecommerce_connectors.findMany({
      where,
      include: { stores: { select: { id: true, name: true, code: true } } },
      orderBy: { created_at: "desc" },
    });
    return store.map((s: any) => this.mapEcommerceStore(s));
  }

  async getEcommerceStore(ctx: TenantContext,
    store_id: string,
  ): Promise<any | null> {
    const store = await this.prisma.ecommerce_connectors.findFirst({
      where: { id: store_id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true, excludeEcommerce: true }), deleted_at: null },
      include: { stores: { select: { id: true, name: true, code: true } } },
    });
    return store ? this.mapEcommerceStore(store) : null;
  }

  async createEcommerceStore(ctx: TenantContext,
    data: CreateEcommerceStoreDto,
  ): Promise<any> {
    const plainClientId = uuidv4().slice(0, 8);
    const plainClientSecret = uuidv4();
    const clientSecretHash = createHash("sha256")
      .update(plainClientSecret)
      .digest("hex");

    const channel = await this.prisma.retail_channels.create({
      data: {
        id: uuidv4(),
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        name: data.name,
        type: data.platform || "CUSTOM",
        status: "active",
        sync_frequency: "daily",
        adapter_type: "HEADLESS",
        integration_category: "PRESET",
        credentials: {
          clientId: plainClientId,
          clientSecretHash,
          domain: data.domain,
          inventory_pool_id: data.inventory_pool_id,
          settings: data.settings || {},
        } as any,
      },
    });

    return {
      ...this.mapEcommerceStore(channel as any),
      id: channel.id,
      apiKey: plainClientSecret,
    };
  }

  async updateEcommerceStore(ctx: TenantContext,
    store_id: string,
    data: UpdateEcommerceStoreDto,
  ): Promise<any> {
    const store = await this.prisma.ecommerce_connectors.update({
      where: { id: store_id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true, excludeEcommerce: true }) },
      data: {
        name: data.name,
        domain: data.domain,
        status: data.status,
        inventory_pool_id: data.inventory_pool_id,
        manager_id: data.manager_id,
        settings: data.settings as any,
      },
      include: { stores: { select: { id: true, name: true, code: true } } },
    });
    return this.mapEcommerceStore(store);
  }

  async deleteEcommerceStore(ctx: TenantContext, store_id: string): Promise<void> {
    await this.prisma.ecommerce_connectors.update({
      where: { id: store_id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true, excludeEcommerce: true }) },
      data: { deleted_at: new Date(), status: "inactive" },
    });
  }

  async linkEcommerceToBranch(ctx: TenantContext,
    ecommerceId: string,
    branch_id: string,
  ): Promise<void> {
    await this.prisma.ecommerce_connectors.update({
      where: { id: ecommerceId, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true, excludeEcommerce: true }) },
      data: { stores: { connect: { id: branch_id } } },
    });
  }

  async unlinkEcommerceFromBranch(ctx: TenantContext,
    ecommerceId: string,
    branch_id: string,
  ): Promise<void> {
    await this.prisma.ecommerce_connectors.update({
      where: { id: ecommerceId, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true, excludeEcommerce: true }) },
      data: { stores: { disconnect: { id: branch_id } } },
    });
  }

  // ============================================================
  // PRODUCTS
  // ============================================================

  async listProducts(ctx: TenantContext,
    options?: {
      page?: number;
      pageSize?: number;
      category_id?: string;
      type?: string;
      minPrice?: number;
      maxPrice?: number;
      q?: string;
      sortBy?: "name" | "price" | "created_at" | "quantity";
      sortDir?: "asc" | "desc";
      location_id?: string;
    },
  ): Promise<{
    items: RetailProduct[];
    display_labels?: any;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = Math.max(1, options?.page ?? 1);
    const pageSize = Math.max(1, Math.min(options?.pageSize ?? 20, 50000));
    const skip = (page - 1) * pageSize;
    const orderField =
      options?.sortBy === "price"
        ? "base_price"
        : options?.sortBy === "created_at"
          ? "created_at"
          : "name";
    const orderDir = options?.sortDir === "desc" ? "desc" : "asc";

        const scope = MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true });
    const where: any = { 
      tenant_id: scope.tenant_id,
      status: "active" 
    };

    if (options?.category_id) where.category_id = options.category_id;
    if (options?.type) where.type = options.type;


    if (options?.minPrice !== undefined || options?.maxPrice !== undefined) {
      where.base_price = {};
      if (options.minPrice !== undefined)
        where.base_price.gte = options.minPrice;
      if (options.maxPrice !== undefined)
        where.base_price.lte = options.maxPrice;
    }
    if (options?.q) {
      const q = options.q;
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

    // NOTE: Do NOT filter by stock_levels.some here.
    // All active products should always be returned; the included stock_levels
    // are filtered per-location inside the include clause, so on_hand shows 0
    // for branches where the product has no stock record.

    // Handle Quantity Sort (Requires Raw SQL or manual reordering)
    if (options?.sortBy === "quantity") {
      const locationId = options.location_id || "";
      const rawSql = `
        SELECT p.id
        FROM item_masters p
        LEFT JOIN stock_levels s ON s.product_id = p.id ${locationId ? `AND s.location_id = '${locationId}'` : ""}
        LEFT JOIN locations l ON s.location_id = l.id
        WHERE p.tenant_id = '${scope.tenant_id}' AND p.status = 'active'
        ${!locationId ? "AND (l.type IS NULL OR l.type != 'headquarters')" : ""}
        ${options.category_id ? `AND p.category_id = '${options.category_id}'` : ""}
        ${options.type ? `AND p.type = '${options.type}'` : ""}
        GROUP BY p.id
        ORDER BY SUM(COALESCE(s.on_hand, 0)) ${orderDir.toUpperCase()}
        LIMIT ${pageSize} OFFSET ${skip}
      `;
      
      const orderedIds = await this.prisma.$queryRawUnsafe<{ id: string }[]>(rawSql);
      
      const products = await this.prisma.item_masters.findMany({
        where: { id: { in: (orderedIds || []).map(p => p.id) } },
        include: {
          product_categories: true,
          stock_levels: options?.location_id 
            ? { where: { location_id: options.location_id } } 
            : { 
                where: { 
                  locations: { 
                    type: { not: 'headquarters' } 
                  } 
                },
                include: { locations: true } 
              },
          product_projections: true,
          item_images: { where: { is_primary: true }, take: 1 },
        },
      });

      const total = await this.prisma.item_masters.count({ where });
      const configs = await this.prisma.label_configs.findMany({
        where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), module_type: "RETAIL" },
      });

      const productMap = new Map(products.map(p => [p.id, p]));
      const orderedProducts = (orderedIds || []).map(o => productMap.get(o.id)).filter(Boolean);

      let display_labels = {};
      const locConfig = configs.find((c: any) => c.location_id === options?.location_id);
      const globalConfig = configs.find((c: any) => c.location_id === null);
      if (locConfig) display_labels = locConfig.labels as any;
      else if (globalConfig) display_labels = globalConfig.labels as any;

      return {
        items: orderedProducts.map((p: any) => this.mapProduct(p, options?.location_id, "USD")),
        display_labels,
        total,
        page,
        pageSize,
      };
    }

    const [total, products, configs] = await this.prisma.$transaction([
      this.prisma.item_masters.count({
        where,
      }),
      this.prisma.item_masters.findMany({
        where,
        orderBy: { [orderField]: orderDir },
        skip,
        take: pageSize,
        include: {
          product_categories: true,
          stock_levels: options?.location_id 
            ? { where: { location_id: options.location_id } } 
            : { 
                where: { 
                  locations: { 
                    type: { not: 'headquarters' } 
                  } 
                },
                include: { locations: true } 
              },
          product_projections: true,
          item_images: { where: { is_primary: true }, take: 1 },
        },
      }),
      this.prisma.label_configs.findMany({
        where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), module_type: "RETAIL" },
      }),
    ]);

    let display_labels = {};
    const locConfig = configs.find(
      (c: any) => c.location_id === options?.location_id,
    );
    const globalConfig = configs.find((c: any) => c.location_id === null);
    if (locConfig) display_labels = locConfig.labels as any;
    else if (globalConfig) display_labels = globalConfig.labels as any;

    return {
      items: products.map((p: any) => this.mapProduct(p, options?.location_id, "USD")), // Default USD for listing, will be refined if needed
      display_labels,
      total,
      page,
      pageSize,
    };
  }

  async getProduct(ctx: TenantContext,
    product_id: string,
  ): Promise<RetailProduct | null> {
    const product = await this.prisma.item_masters.findFirst({
      where: { id: product_id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
    });
    return product ? this.mapProduct(product) : null;
  }

  async updateProduct(ctx: TenantContext,
    product_id: string,
    data: UpdateProductDto,
    location_id?: string,
  ): Promise<RetailProduct> {
    const txOperations: any[] = [
      this.prisma.item_masters.update({
        where: { id: product_id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
        data: {
          name: data.name,
          description: data.description,
          category_id: data.category_id,
          base_price: data.base_price,
          unit: data.unit,
          sku: data.sku,
          barcode: data.barcode,
          type: data.type,
          status: data.status,
        },
      }),
      // Sync global projection (location_id: null) if it exists
      this.prisma.product_projections.updateMany({
        where: {
          item_master_id: product_id,
          ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
          location_id: null,
          module_type: "RETAIL",
        },
        data: {
          custom_name: data.name,
          custom_description: data.description,
          price: data.base_price,
        },
      }),
    ];

    if (
      (data.stock_on_hand !== undefined || data.reserved !== undefined || data.min_buffer !== undefined) &&
      location_id
    ) {
      const existingStock = await this.prisma.stock_levels.findFirst({
        where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), location_id: location_id, product_id: product_id },
      });

      const onHand =
        data.stock_on_hand !== undefined
          ? data.stock_on_hand
          : existingStock?.on_hand || 0;
      const reserved =
        data.reserved !== undefined
          ? data.reserved
          : existingStock?.reserved || 0;
      const min_buffer = 
        data.min_buffer !== undefined
          ? data.min_buffer
          : existingStock?.min_buffer || 0;
      const available = (onHand as unknown as Prisma.Decimal).sub(
        reserved as unknown as Prisma.Decimal,
      );

      if (existingStock) {
        txOperations.push(
          this.prisma.stock_levels.update({
            where: { id: existingStock.id },
            data: { on_hand: onHand, reserved, available, min_buffer },
          }),
        );
      } else {
        txOperations.push(
          this.prisma.stock_levels.create({
            data: {
              id: uuidv4(),
              updated_at: new Date(),
              tenant_id: ctx.tenant_id,
              location_id: location_id,
              product_id: product_id,
              on_hand: onHand,
              reserved,
              available,
              min_buffer,
            },
          }),
        );
      }
    }

    await this.prisma.$transaction(txOperations);

    // Re-fetch with all necessary fields for mapProduct logic
    const fullProduct = await this.prisma.item_masters.findUnique({
      where: { id: product_id },
      include: { product_categories: true, stock_levels: true, product_projections: true },
    });

    if (!fullProduct) throw new Error("Product re-fetch failed");
    return this.mapProduct(fullProduct);
  }

  // ─── SKU Generator Engine ────────────────────────────────────────────────────
  // Queries the DB to produce the next unique, sequential SKU for a category.
  // Format:  <PREFIX>-<YYYYMMDD>-<SEQUENCE>
  //   PREFIX   = up to 6 chars from the category name (A-Z0-9)
  //   SEQUENCE = zero-padded 4-digit counter, incrementing from highest in DB
  //
  // Retries up to 5 times to handle rare concurrent insertion races.
  async generateNextSku(ctx: TenantContext,
    category_id: string,
  ): Promise<{ sku: string; barcode: string }> {
    // 1. Resolve category name → prefix
    const category = await this.prisma.product_categories.findFirst({
      where: { id: category_id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true, excludeEcommerce: true }) },
      select: { name: true },
    });
    const prefix =
      (category?.name ?? "ITEM")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6) || "ITEM";

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD

    // 2. Find the highest sequence already used for this prefix on this date
    const pattern = `${prefix}-${dateStr}-%`;
    const latest = await this.prisma.item_masters.findFirst({
      where: {
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true, excludeEcommerce: true }),
        sku: { startsWith: `${prefix}-${dateStr}-` },
      },
      orderBy: { sku: "desc" },
      select: { sku: true },
    });

    // 3. Parse the sequence from the last SKU and increment
    let seq = 1;
    if (latest?.sku) {
      const parts = latest.sku.split("-");
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    // 4. Build candidate SKU and verify uniqueness (retry on collision)
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidateSku = `${prefix}-${dateStr}-${String(seq + attempt).padStart(4, "0")}`;
      const existing = await this.prisma.item_masters.findUnique({
        where: { tenant_id_sku: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), sku: candidateSku } },
        select: { id: true },
      });
      if (!existing) {
        const barcode =
          candidateSku.replace(/[^A-Z0-9]/g, "") + String(Date.now()).slice(-4);
        return { sku: candidateSku, barcode };
      }
    }

    // 5. Absolute fallback: timestamp-based SKU (should never reach here in practice)
    const fallbackSku = `${prefix}-${dateStr}-${Date.now().toString().slice(-6)}`;
    return {
      sku: fallbackSku,
      barcode: fallbackSku.replace(/[^A-Z0-9]/g, "") + "0000",
    };
  }

  async listOrders(ctx: TenantContext, options?: { store_id?: string; customer_id?: string; ecommerce_id?: string; status?: string }): Promise<RetailOrder[]> {
    const where: any = { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) };
    if (options?.store_id) where.store_id = options.store_id;
    if (options?.customer_id) where.customer_id = options.customer_id;
    if (options?.ecommerce_id) where.ecommerce_id = options.ecommerce_id;
    if (options?.status) where.status = options.status;

    const orders = await this.prisma.retail_orders.findMany({
      where,
      include: {
        retail_order_items: { include: { item_masters: true } },
        retail_customers: true,
        stores: true,
      },
      orderBy: { created_at: "desc" },
      take: 100,
    });

    return (orders as any).map((o: any) => this.mapOrder(o));
  }

  async listCustomers(ctx: TenantContext, options?: { ecommerce_id?: string; q?: string }): Promise<any[]> {
    // Customers are tenant-scoped only (company_id may not match admin's company vs customer's company)
    const where: any = { tenant_id: ctx.tenant_id };
    if (options?.ecommerce_id) where.ecommerce_id = options.ecommerce_id;
    if (options?.q) {
      where.OR = [
        { name: { contains: options.q, mode: 'insensitive' } },
        { email: { contains: options.q, mode: 'insensitive' } },
        { phone: { contains: options.q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.retail_customers.findMany({
      where,
      include: {
        retail_carts: { include: { retail_cart_items: true } },
        retail_wishlists: { include: { retail_wishlist_items: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async getOrder(ctx: TenantContext,
    order_id: string,
  ): Promise<RetailOrder | null> {
    const order = await this.prisma.retail_orders.findFirst({
      where: { id: order_id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      include: {
        retail_order_items: { include: { item_masters: true } },
        retail_customers: true,
        stores: true,
      },
    });
    return order ? this.mapOrder(order) : null;
  }

  async createOrder(ctx: TenantContext,
    location_id: string,
    data: CreateOrderDto,
    user_id: string,
    tx?: any,
  ): Promise<RetailOrder> {
    const client = tx || this.prisma;
    let subtotal = new Prisma.Decimal(0) as any;

    const itemsData = await Promise.all(
      data.items.map(async (item) => {
        const product = await client.item_masters.findUnique({
          where: { id: item.product_id },
        });
        if (!product) throw new Error(`Product ${item.product_id} not found`);

        // qty × unit_price — both via Prisma.Decimal; no native JS * or +
        const decimalQty   = new Prisma.Decimal(String(item.quantity) as any);
        const decimalPrice = new Prisma.Decimal(String(item.unit_price) as any);
        const itemSubtotal = decimalQty.mul(decimalPrice);
        subtotal = subtotal.add(itemSubtotal);

        return {
          ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
          product_id: item.product_id,
          quantity:   decimalQty,
          unit_price:  decimalPrice,
          total_price: itemSubtotal,
          discount: 0,
          tax_rate: item.tax_rate ? new Prisma.Decimal(item.tax_rate) : undefined,
          commission_rate: item.commission_rate ? new Prisma.Decimal(item.commission_rate) : undefined,
          commission_amount: item.commission_amount ? new Prisma.Decimal(item.commission_amount) : undefined,
        };
      }),
    );

    const grand_total = new Prisma.Decimal(String(data.grand_total) as any);
    const tax = grand_total.sub(subtotal);

    const order = await client.retail_orders.create({
      data: {
        updated_at: new Date(),
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        store_id: data.store_id,
        device_id: data.terminal_id || undefined,
        cashier_id: user_id || undefined,
        customer_id: data.customer_id || undefined,
        shift_id: data.shift_id || undefined,
        status: "pending",
        subtotal,
        tax,
        total_amount: grand_total,
        currency: data.currency || "IDR",
        commission_amount: data.commission_amount ? new Prisma.Decimal(data.commission_amount) : undefined,
        payment_method: data.payment_method,
        notes: data.notes,
        retail_order_items: { create: itemsData },
      } as any,
      include: {
        retail_order_items: { include: { item_masters: true } },
        stores: true,
      },
    });

    return this.mapOrder(order);
  }

  async updateOrderStatus(ctx: TenantContext,
    order_id: string,
    status: string,
    metadata?: any,
  ): Promise<RetailOrder> {
    const order = await this.prisma.retail_orders.update({
      where: { id: order_id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      data: {
        status,
        ...(metadata?.tax_total !== undefined && { tax: metadata.tax_total }),
      },
      include: { retail_order_items: { include: { item_masters: true } } },
    });
    return this.mapOrder(order);
  }

  // ============================================================
  // INVENTORY / STOCK
  // ============================================================

   async reserveStock(ctx: TenantContext,
    location_id: string,
    product_id: string,
    quantity: Prisma.Decimal,
    reference_id: string = "system",
    reference_type: string = "ecommerce"
  ): Promise<{ success: boolean; reservationId?: string }> {
    return this.prisma.$transaction(async (tx) => {
      const stock = await tx.stock_levels.findUnique({
        where: {
          tenant_id_location_id_product_id_department_id: {
            tenant_id: ctx.tenant_id,
            location_id,
            product_id,
            department_id: "DEFAULT",
          },
        },
      });

      if (!stock || (stock.available as unknown as Prisma.Decimal).lessThan(quantity)) {
        return { success: false };
      }

      const reservationId = uuidv4();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 mins

      await Promise.all([
        tx.stock_levels.update({
          where: { id: stock.id },
          data: {
            available: { decrement: quantity },
            reserved: { increment: quantity },
            updated_at: new Date(),
          },
        }),
        tx.stock_reservations.create({
          data: {
            id: reservationId,
            ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
            location_id,
            product_id,
            quantity: Number(quantity),
            status: "PENDING",
            reference_id,
            reference_type,
            expires_at: expiresAt,
          },
        }),
      ]);

      return { success: true, reservationId };
    });
  }

  async releaseStock(ctx: TenantContext,
    product_id: string,
    quantity: Prisma.Decimal,
    location_id?: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // 1. Release Stock Level
      const where: any = { product_id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) };
      if (location_id) where.location_id = location_id;

      await tx.stock_levels.updateMany({
        where,
        data: {
          available: { increment: quantity },
          reserved: { decrement: quantity },
          updated_at: new Date(),
        },
      });

      // 2. Mark reservations as CANCELLED/RELEASED
      await tx.stock_reservations.updateMany({
        where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), product_id, ...(location_id && { location_id }), status: "PENDING" },
        data: { status: "RELEASED", updated_at: new Date() },
      });
    });
  }

  async checkStock(ctx: TenantContext,
    product_id: string,
    location_id?: string,
  ): Promise<{ available: Prisma.Decimal; on_hand: Prisma.Decimal; reserved: Prisma.Decimal; status: string }> {
    const stock = await this.prisma.stock_levels.findFirst({
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), product_id, ...(location_id && { location_id }) },
    });
    const avail = (stock?.available as unknown as Prisma.Decimal) || new Prisma.Decimal(0);
    const onHand = (stock?.on_hand as unknown as Prisma.Decimal) || new Prisma.Decimal(0);
    const reserved = (stock?.reserved as unknown as Prisma.Decimal) || new Prisma.Decimal(0);
    
    return { 
      available: avail, 
      on_hand: onHand,
      reserved: reserved,
      status: avail.greaterThan(0) ? "IN_STOCK" : "OUT_OF_STOCK" 
    };
  }

  async getInventoryStats(ctx: TenantContext,
    options?: { category_id?: string; q?: string; location_id?: string },
  ): Promise<{
    total: number;
    critical: number;
    lowStock: number;
    overstock: number;
    outOfStock: number;
    totalSOH: Prisma.Decimal;
    totalATS: Prisma.Decimal;
    totalItems: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalValue: Prisma.Decimal;
    totalCapitalValue: Prisma.Decimal;
    currency?: string;
  }> {
    const scope = MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true });
    const where: any = { 
      tenant_id: scope.tenant_id,
      status: "active" 
    };

    if (options?.category_id) where.category_id = options.category_id;
    if (options?.q) {
      const q = options.q;
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

    const targetLocationId = options?.location_id || scope.location_id;
    if (targetLocationId) {
      where.stock_levels = {
        some: {
          location_id: targetLocationId
        }
      };
    }

    const [products, company] = await Promise.all([
      this.prisma.item_masters.findMany({
        where,
        select: {
          base_price: true,
          selling_price: true,
          product_projections: true,
          stock_levels: {
            where: targetLocationId ? { location_id: targetLocationId } : undefined,
            select: {
              on_hand: true,
              available: true,
              reserved: true,
              min_buffer: true,
              max_capacity: true,
            },
          },
        },
      }),
      this.prisma.companies.findFirst({
        where: { tenant_id: ctx.tenant_id },
        select: { currency: true }
      })
    ]);

    const stats = {
      total: products.length,
      critical: 0,
      lowStock: 0,
      overstock: 0,
      outOfStock: 0,
      totalSOH: new Prisma.Decimal(0) as any,
      totalATS: new Prisma.Decimal(0) as any,
      totalItems: products.length,
      lowStockCount: 0,
      outOfStockCount: 0,
      totalValue: new Prisma.Decimal(0) as any,
      totalCapitalValue: new Prisma.Decimal(0) as any,
      currency: company?.currency || "USD"
    };

    products.forEach((p: any) => {
      const totalOnHand = p.stock_levels.reduce(
        (sum: Prisma.Decimal, s: any) =>
          sum.add(new Prisma.Decimal(s.on_hand?.toString() || "0")),
        new Prisma.Decimal(0) as any,
      );

      const currentATS = p.stock_levels.reduce(
        (sum: Prisma.Decimal, s: any) =>
          sum.add(new Prisma.Decimal(s.available?.toString() || "0")),
        new Prisma.Decimal(0) as any,
      );

      const minBuffer = p.stock_levels.reduce(
        (sum: number, s: any) => sum + (s.min_buffer || 0),
        0
      );

      // Resolve price (branch specific or base)
      let price = new Prisma.Decimal(p.selling_price?.toString() || p.base_price?.toString() || "0");
      if (p.product_projections && p.product_projections.length > 0) {
        const locProj = p.product_projections.find(
          (proj: any) =>
            proj.location_id === scope.location_id && proj.module_type === "RETAIL",
        );
        const globalProj = p.product_projections.find(
          (proj: any) => proj.location_id === null && proj.module_type === "RETAIL",
        );
        const activeProj = locProj || globalProj;
        if (activeProj?.price) {
          price = new Prisma.Decimal(activeProj.price.toString());
        }
      }

      // Capital/supplier price
      const basePrice = new Prisma.Decimal(p.base_price?.toString() || "0");

      stats.totalSOH = stats.totalSOH.add(totalOnHand);
      stats.totalATS = stats.totalATS.add(currentATS);
      stats.totalValue = stats.totalValue.add(totalOnHand.mul(price));
      stats.totalCapitalValue = stats.totalCapitalValue.add(totalOnHand.mul(basePrice));

      if (totalOnHand.lte(0)) {
        stats.outOfStockCount++;
        stats.outOfStock++;
        stats.critical++;
      } else if (minBuffer > 0 && totalOnHand.lte(minBuffer)) {
        stats.lowStockCount++;
        stats.lowStock++;
      } else if (minBuffer === 0 && totalOnHand.lte(5)) {
        stats.lowStockCount++;
        stats.lowStock++;
      }
    });

    console.log(`[RetailDbRepository] getInventoryStats RESULT for ${targetLocationId}:`, JSON.stringify(stats));
    return stats;
  }

  // ============================================================
  // SHIFTS
  // ============================================================

  async getActiveShift(ctx: TenantContext,
    store_id: string,
    employee_id: string,
  ): Promise<RetailShift | null> {
    const shift = await this.prisma.retail_shifts.findFirst({
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), store_id: store_id, employee_id: employee_id, status: "open" },
    });
    return shift ? this.mapShift(shift) : null;
  }

  async openShift(ctx: TenantContext,
    location_id: string,
    employee_id: string,
    data: OpenShiftDto,
    opened_by_id?: string,
  ): Promise<RetailShift> {
    // Fetch the store to get its company_id (retail_shifts.company_id must reference a valid company)
    const store = await this.prisma.stores.findUnique({
      where: { id: data.store_id },
      select: { company_id: true },
    });

    if (!store) {
      throw new Error(`Store ${data.store_id} not found`);
    }

    const shift = await this.prisma.retail_shifts.create({
      data: {
        updated_at: new Date(),
        tenant_id: ctx.tenant_id,
        company_id: store.company_id, // Use the store's company_id instead of context company_id
        store_id: data.store_id,
        employee_id: employee_id,
        opened_by_id: opened_by_id,
        start_time: new Date(),
        opening_cash: data.opening_cash,
        expected_cash: data.opening_cash,
        status: "open",
      },
    });
    return this.mapShift(shift);
  }

  async closeShift(ctx: TenantContext,
    shift_id: string,
    data: CloseShiftDto,
    closed_by_id?: string,
  ): Promise<RetailShift> {
    // Only use id and tenant_id for lookup - shift id is already unique (PK)
    // Including company_id from context can cause mismatch if shift was created
    // with a different company_id or if context company_id doesn't match
    const shift = await this.prisma.retail_shifts.update({
      where: { 
        id: shift_id, 
        tenant_id: ctx.tenant_id 
      },
      data: {
        end_time: new Date(),
        closing_cash: data.closing_cash,
        status: "closed",
        notes: data.notes,
        closing_note: data.closing_note,
        compliance_note: data.compliance_note,
        closed_by_id: closed_by_id,
      },
    });
    return this.mapShift(shift);
  }

  async createCashMovement(ctx: TenantContext, data: {
    shift_id: string;
    store_id: string;
    employee_id: string;
    amount: number;
    type: string;
    reason?: string;
    notes?: string;
  }) {
    const amount = new Prisma.Decimal(String(data.amount));
    const [movement, shift] = await this.prisma.$transaction([
      this.prisma.retail_cash_movements.create({
        data: {
          tenant_id: ctx.tenant_id,
          store_id: data.store_id,
          shift_id: data.shift_id,
          employee_id: data.employee_id,
          amount: amount,
          type: data.type,
          reason: data.reason,
          notes: data.notes,
        }
      }),
      this.prisma.retail_shifts.update({
        where: { id: data.shift_id, tenant_id: ctx.tenant_id },
        data: {
          expected_cash: {
            increment: data.type === "CASH_IN" ? amount : amount.negated()
          }
        }
      })
    ]);
    return movement;
  }

  async listShifts(ctx: TenantContext, store_id?: string, employee_id?: string): Promise<RetailShift[]> {
    const where: any = { tenant_id: ctx.tenant_id };
    if (store_id) where.store_id = store_id;
    if (employee_id) {
      where.OR = [
        { employee_id: employee_id },
        { employees: { user_id: employee_id } }
      ];
    }

    console.log(`[RetailRepository] listShifts for tenant ${ctx.tenant_id}, store ${store_id}, employee ${employee_id}. Where:`, JSON.stringify(where, null, 2));

    const shifts = await this.prisma.retail_shifts.findMany({
      where,
      include: { retail_cash_movements: true },
      orderBy: { start_time: "desc" },
      take: 50,
    });
    
    console.log(`[RetailRepository] Found ${shifts.length} shifts`);
    return shifts.map((s: prismaShift) => this.mapShift(s));
  }

  async getShift(ctx: TenantContext,
    shift_id: string,
  ): Promise<RetailShift | null> {
    // Only use id and tenant_id - shift id is unique (PK)
    const shift = await this.prisma.retail_shifts.findFirst({
      where: { 
        id: shift_id, 
        tenant_id: ctx.tenant_id 
      },
      include: { retail_cash_movements: true }
    });
    return shift ? this.mapShift(shift) : null;
  }

  async updateShiftStatus(ctx: TenantContext,
    shift_id: string,
    status: string,
  ): Promise<RetailShift> {
    // Only use id and tenant_id - shift id is unique (PK)
    const shift = await this.prisma.retail_shifts.update({
      where: { 
        id: shift_id, 
        tenant_id: ctx.tenant_id 
      },
      data: { status: status as any },
    });
    return this.mapShift(shift);
  }

  async reconcileShift(ctx: TenantContext,
    shift_id: string,
    data: {
      actual_cash: Prisma.Decimal;
      variance: Prisma.Decimal;
      reason: string;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<RetailShift> {
    const db = tx || this.prisma;
    // Only use id and tenant_id - shift id is unique (PK)
    const shift = await db.retail_shifts.update({
      where: { 
        id: shift_id, 
        tenant_id: ctx.tenant_id 
      },
      data: {
        status: "reconciled",
        actual_cash: data.actual_cash,
        variance: data.variance,
        reconciliation_reason: data.reason,
      },
    });
    return this.mapShift(shift);
  }


  // ============================================================
  // PROMOTIONS
  // ============================================================

  async listPromotions(ctx: TenantContext): Promise<any[]> {
    const promotions = await this.prisma.retail_promotions.findMany({
      where: MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
      orderBy: { created_at: "desc" },
    });
    return promotions.map((p: retail_promotions) => ({
      id: p.id,
      tenant_id: p.tenant_id,
      title: p.title,
      type: p.type,
      value: Number(p.value),
      start_date: p.start_date,
      end_date: p.end_date,
      status: p.status,
      target: p.target,
      created_at: p.created_at,
      updated_at: p.updated_at,
    }));
  }

  async updatePromotion(ctx: TenantContext,
    promotionId: string,
    data: any,
  ): Promise<any> {
    const promotion = await this.prisma.retail_promotions.update({
      where: { id: promotionId, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      data: {
        status: data.status,
        ...(data.value && { value: data.value }),
        ...(data.end_date && { end_date: new Date(data.end_date) }),
      },
    });
    return {
      id: promotion.id,
      tenant_id: promotion.tenant_id,
      title: promotion.title,
      type: promotion.type,
      value: Number(promotion.value),
      start_date: promotion.start_date,
      end_date: promotion.end_date,
      status: promotion.status,
      target: promotion.target,
      created_at: promotion.created_at,
      updated_at: promotion.updated_at,
    };
  }

  // ============================================================
  // CHANNELS (Legacy Ecommerce Hub)
  // ============================================================

  async listChannels(ctx: TenantContext): Promise<any[]> {
    const channels = await this.prisma.retail_channels.findMany({
      where: MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
      orderBy: { created_at: "desc" },
    });
    return channels.map((c: retail_channels) => {
      const credentials = c.credentials as {
        clientId?: string;
        clientSecret?: string;
        branch_id?: string;
        gatewayUrl?: string;
        connector?: string;
      } | null;
      return {
        id: c.id,
        tenant_id: c.tenant_id,
        branch_id: credentials?.branch_id,
        name: c.name,
        type: c.type,
        status: c.status,
        sync_frequency: c.sync_frequency,
        last_sync_at: c.last_sync_at,
        clientId: credentials?.clientId,
        channel_id: credentials?.clientId,
        clientSecret: credentials?.clientSecret,
        gatewayUrl: credentials?.gatewayUrl,
        connector: credentials?.connector,
        created_at: c.created_at,
        updated_at: c.updated_at,
      };
    });
  }

  async createChannel(ctx: TenantContext, data: any): Promise<any> {
    const credentials = data.credentials
      ? {
          clientId: data.credentials.clientId,
          clientSecret: data.credentials.clientSecret,
          clientSecretHash: this.hashSecret(data.credentials.clientSecret),
          branch_id: data.branch_id ?? "branch_main",
          domain: data.domain ?? null,
          ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
          gatewayUrl: data.gatewayUrl ?? null,
          connector: data.connector ?? data.name ?? null,
          revoked: false,
          lastRotated: new Date().toISOString(),
        }
      : undefined;

    const channel = await this.prisma.retail_channels.create({
      data: {
        id: uuidv4(),
        updated_at: new Date(),
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        name: data.name,
        type: data.type,
        status: "active",
        sync_frequency: data.sync_frequency || data.syncFrequency || "hourly",
        credentials: credentials as any,
      },
    });
    const creds = channel.credentials as {
      clientId?: string;
      clientSecret?: string;
      branch_id?: string;
      gatewayUrl?: string;
      connector?: string;
    } | null;
    return {
      id: channel.id,
      tenant_id: channel.tenant_id,
      branch_id: creds?.branch_id,
      name: channel.name,
      type: channel.type,
      status: channel.status,
      sync_frequency: channel.sync_frequency,
      last_sync_at: channel.last_sync_at,
      clientId: creds?.clientId,
      channel_id: creds?.clientId,
      clientSecret: creds?.clientSecret,
      gatewayUrl: creds?.gatewayUrl,
      connector: creds?.connector,
      created_at: channel.created_at,
      updated_at: channel.updated_at,
    };
  }

  async updateChannel(ctx: TenantContext,
    channelId: string,
    data: any,
  ): Promise<any> {
    const updates: any = {};
    if (typeof data.name === "string") updates.name = data.name;
    const nextSync = data.sync_frequency ?? data.syncFrequency;
    if (typeof nextSync === "string") updates.syncFrequency = nextSync;
    if (typeof data.status === "string") updates.status = data.status;

    const channel =
      Object.keys(updates).length === 0
        ? await this.prisma.retail_channels.findFirst({
            where: { id: channelId, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
          })
        : await this.prisma.retail_channels.update({
            where: { id: channelId, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
            data: updates,
          });

    if (!channel) throw new Error("Channel not found");

    const credentials = channel.credentials as {
      clientId?: string;
      clientSecret?: string;
      branch_id?: string;
      gatewayUrl?: string;
      connector?: string;
    } | null;
    return {
      id: channel.id,
      tenant_id: channel.tenant_id,
      branch_id: credentials?.branch_id,
      name: channel.name,
      type: channel.type,
      status: channel.status,
      sync_frequency: channel.sync_frequency,
      last_sync_at: channel.last_sync_at,
      clientId: credentials?.clientId,
      channel_id: credentials?.clientId,
      clientSecret: credentials?.clientSecret,
      gatewayUrl: credentials?.gatewayUrl,
      connector: credentials?.connector,
      created_at: channel.created_at,
      updated_at: channel.updated_at,
    };
  }

  async deleteChannel(ctx: TenantContext,
    channelId: string,
  ): Promise<{ success: boolean }> {
    await this.prisma.retail_channels.update({
      where: { id: channelId, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      data: { status: "inactive" },
    });
    return { success: true };
  }

  async syncChannel(ctx: TenantContext,
    channelId: string,
  ): Promise<{ success: boolean }> {
    await this.prisma.retail_channels.update({
      where: { id: channelId, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      data: { last_sync_at: new Date() },
    });
    return { success: true };
  }

  async getChannelById(ctx: TenantContext,
    channelId: string,
  ): Promise<any | null> {
    return this.prisma.retail_channels.findFirst({
      where: { id: channelId, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
    });
  }

  async updateChannelCredentials(ctx: TenantContext,
    channelId: string,
    credentials: any,
  ): Promise<any> {
    return this.prisma.retail_channels.update({
      where: { id: channelId, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      data: { credentials },
    });
  }

  async findChannelByClientId(ctx: TenantContext,
    clientId: string,
  ): Promise<any | null> {
    // Channel lookup is tenant-scoped only (company_id may be NULL for channels)
    const channels = await this.prisma.retail_channels.findMany({
      where: { tenant_id: ctx.tenant_id },
    });
    return (
      channels.find((c: retail_channels) => {
        const creds = c.credentials as { clientId?: string } | null;
        return creds?.clientId === clientId;
      }) || null
    );
  }

  // ============================================================
  // DEVICES
  // ============================================================

  async listDevices(ctx: TenantContext, store_id?: string): Promise<any[]> {
    const where: any = { tenant_id: ctx.tenant_id };
    if (store_id) where.store_id = store_id;
    const devices = await this.prisma.pos_devices.findMany({
      where,
      orderBy: { created_at: "desc" },
    });
    return devices.map((d: any) => ({
      id: d.id,
      tenant_id: d.tenant_id,
      store_id: d.store_id,
      name: d.name,
      type: d.type,
      is_active: d.is_active,
      mac_address: d.mac_address,
      created_at: d.created_at,
      updated_at: d.updated_at,
    }));
  }

  async registerDevice(ctx: TenantContext,
    location_id: string,
    data: any,
  ): Promise<any> {
    try {
      const device = await this.prisma.pos_devices.create({
        data: {
          ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
          store_id: data.store_id,
          name: data.name,
          type: data.type,
          mac_address: data.mac_address || "",
          is_active: data.is_active !== undefined ? data.is_active : true,
        },
      });
      return {
        id: device.id,
        tenant_id: device.tenant_id,
        store_id: device.store_id,
        name: device.name,
        type: device.type,
        is_active: device.is_active,
        mac_address: device.mac_address,
        created_at: device.created_at,
        updated_at: device.updated_at,
      };
    } catch (error) {
      console.error("[RetailDbRepository] Error in registerDevice:", error);
      throw error;
    }
  }

  async listCCTVs(ctx: TenantContext, store_id?: string): Promise<any[]> {
    return []; // DB logic deferred for Phase 3
  }

  async validateCCTVConnection(ctx: TenantContext,
    location_id: string,
    data: any,
  ): Promise<{ success: boolean; message?: string }> {
    throw new Error(
      "DB integration for validateCCTVConnection pending Phase 3",
    );
  }

  async registerCCTV(ctx: TenantContext,
    location_id: string,
    data: any,
  ): Promise<any> {
    return null; // DB logic deferred for Phase 3
  }

  async listSensors(ctx: TenantContext, store_id?: string): Promise<any[]> {
    return []; // DB logic deferred for Phase 3
  }

  async registerSensor(ctx: TenantContext,
    location_id: string,
    data: any,
  ): Promise<any> {
    return null; // DB logic deferred for Phase 3
  }

  async scanDevices(ctx: TenantContext, location_id: string): Promise<any[]> {
    return []; // DB logic deferred for Phase 3
  }

  async commitScannedDevice(ctx: TenantContext,
    location_id: string,
    discoveryId: string,
  ): Promise<any> {
    return null; // DB logic deferred for Phase 3
  }

  async pingDevice(ctx: TenantContext,
    device_id: string,
  ): Promise<{ success: boolean }> {
    await this.prisma.pos_devices.update({
      where: { id: device_id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      data: { updated_at: new Date() },
    });
    return { success: true };
  }

  // ============================================================
  // PAYMENTS & RETURNS
  // ============================================================

  async processPayment(ctx: TenantContext,
    order_id: string,
    data: { amount: Prisma.Decimal; method: string; shift_id?: string },
  ): Promise<any> {
    const order = await this.prisma.retail_orders.findUnique({
      where: { id: order_id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
    });
    if (!order) throw new Error("Order not found");

    return this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.retail_orders.update({
        where: { id: order_id },
        data: { status: "paid" },
      });

      // Simple audit entry as payment log
      await tx.audit_logs.create({
        data: {
          id: uuidv4(),
          ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
          module: "retail",
          action: "PAYMENT",
          entity_type: "ORDER",
          entity_id: order_id,
          user_id: "system",
          changes: { method: data.method, amount: data.amount },
          created_at: new Date(),
        },
      });

      return updatedOrder;
    });
  }

  async processReturn(ctx: TenantContext,
    order_id: string,
    data: {
      itemIds: string[];
      shift_id?: string;
      conditions?: Array<{
        productId: string;
        condition: "good" | "damaged_repairable" | "damaged_unrepairable";
        notes?: string;
      }>;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<{ success: boolean }> {
    const db = tx ?? this.prisma;

    // 1. Fetch Order Items to verify existence and check idempotency
    const orderItems = await db.retail_order_items.findMany({
      where: {
        id: { in: data.itemIds },
        order_id: order_id,
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
      },
    });

    if (orderItems.length !== data.itemIds.length) {
      throw new Error("Some items not found in order");
    }

    // 2. Idempotency Check: Fail if any item already returned
    const alreadyReturned = orderItems.filter((i) => i.returned_at !== null);
    if (alreadyReturned.length > 0) {
      throw new Error(
        `Items already returned: ${alreadyReturned.map((i) => i.id).join(", ")}`,
      );
    }

    // 3. Mark items as returned
    await db.retail_order_items.updateMany({
      where: { id: { in: data.itemIds } },
      data: { returned_at: new Date() },
    });

    // 4. Update order status to refunded
    await db.retail_orders.update({
      where: { id: order_id },
      data: { status: "refunded" },
    });

    return { success: true };
  }


  async voidOrder(ctx: TenantContext,
    order_id: string,
    user_id: string,
  ): Promise<RetailOrder> {
    const order = await this.prisma.retail_orders.findUnique({
      where: { id: order_id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      include: { retail_order_items: true },
    });


    if (!order) throw new Error("Order not found");
    if (order.status === "cancelled" || order.status === "refunded") {
      throw new Error("Order already finalized and cannot be voided");
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Mark as cancelled (voided)
      const updated = await tx.retail_orders.update({
        where: { id: order_id },
        data: { status: "cancelled" },
      });

      // 2. Full Inventory Restoration
      // 2. Full Inventory Restoration
      for (const item of (order as any).retail_order_items) {
        await tx.stock_levels.updateMany({
          where: {
            ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
            product_id: item.product_id,
            location_id: (order as any).store_id,
          },
          data: {
            on_hand: { increment: item.quantity },
            available: { increment: item.quantity },
          },
        });
      }



      // 3. Audit Log
      await tx.audit_logs.create({
        data: {
          id: Math.random().toString(36).substring(2, 10),
          ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
          module: "retail",
          action: "VOID",
          entity_type: "ORDER",
          entity_id: order_id,
          user_id: user_id,
          created_at: new Date(),
        },
      });

      // 4. Adjust Shift Finance if it was a cash sale
      if (updated.payment_method?.toLowerCase() === "cash" && updated.shift_id) {
        await tx.retail_shifts.update({
          where: { id: updated.shift_id },
          data: {
            expected_cash: {
              decrement: new Prisma.Decimal(updated.total_amount || 0)
            }
          }
        });

        // 5. Audit Cash Movement (Reversal)
        await tx.retail_cash_movements.create({
          data: {
            tenant_id: ctx.tenant_id,
            store_id: updated.store_id || (order as any).store_id,
            shift_id: updated.shift_id,
            employee_id: user_id,
            amount: new Prisma.Decimal(updated.total_amount || 0),
            type: "CASH_OUT",
            reason: `ORDER_VOID: ${order_id}`,
            notes: "Automatic reversal for voided cash order"
          }
        });
      }

      return this.mapOrder(updated);
    });
  }

  async cancelOrder(ctx: TenantContext,
    order_id: string,
    user_id: string,
  ): Promise<RetailOrder> {
    // Cancellation before payment usually just releases reservations
    const order = await this.prisma.retail_orders.findUnique({
      where: { id: order_id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      include: { retail_order_items: true },
    });


    if (!order) throw new Error("Order not found");

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.retail_orders.update({
        where: { id: order_id },
        data: { status: "cancelled" },
      });

      if (order.status === "reserved") {
        for (const item of (order as any).retail_order_items) {
          await tx.stock_levels.updateMany({
            where: {
              ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
              product_id: item.product_id,
              location_id: (order as any).store_id,
            },
            data: {
              reserved: { decrement: item.quantity },
              available: { increment: item.quantity },
            },
          });
        }
      }



      // 2. Adjust Shift Finance if it was a cash sale
      if (updated.payment_method?.toLowerCase() === "cash" && updated.shift_id) {
        await tx.retail_shifts.update({
          where: { id: updated.shift_id },
          data: {
            expected_cash: {
              decrement: updated.total_amount || 0
            }
          }
        });

        // 3. Audit Cash Movement (Reversal)
        await tx.retail_cash_movements.create({
          data: {
            tenant_id: ctx.tenant_id,
            store_id: updated.store_id || (order as any).store_id,
            shift_id: updated.shift_id,
            employee_id: user_id,
            amount: updated.total_amount || 0,
            type: "CASH_OUT",
            reason: `ORDER_CANCEL: ${order_id}`,
            notes: "Automatic reversal for cancelled cash order"
          }
        });
      }

      return this.mapOrder(updated);
    });
  }


  async atomicCheckout(ctx: TenantContext,
    data: CheckoutDto,
    user_id: string,
    idempotency_key?: string,
  ): Promise<RetailOrder> {
    return this.prisma.$transaction(async (tx: any) => {
      // 1. Idempotency Gatekeeper
      if (idempotency_key) {
        const existing = await tx.sys_idempotency_keys.findUnique({
          where: { tenant_id_key: { tenant_id: ctx.tenant_id, key: idempotency_key } },
        });

        if (existing) {
          if (existing.status === "COMPLETED") {
            return existing.response_snapshot as unknown as RetailOrder;
          }
          if (existing.status === "PENDING") {
            throw new Error(
              "Transaction is already being processed. Please wait.",
            );
          }
        }

        // Create initial pending record
        await tx.sys_idempotency_keys.create({
          data: {
            id: uuidv4(),
            tenant_id: ctx.tenant_id,
            key: idempotency_key,
            endpoint: "/retail/checkout",
            status: "PENDING",
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            response_snapshot: {},
          },
        });
      }

      // 2. Context Verification
      const store = await tx.stores.findUnique({
        where: { id: data.store_id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      });
      if (!store) throw new Error("Store not found");
      if (!store.location_id) {
        throw new Error(
          `Store ${store.name} is missing location_id. Atomic checkout aborted to prevent inventory corruption.`,
        );
      }
      const location_id = store.location_id;

      // 3. Fetch Finance Context
      const [dept, mappings] = await Promise.all([
        tx.departments.findFirst({ where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), code: "RET" } }),
        tx.finance_system_mappings.findMany({
          where: {
            ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
            system_code: { in: ["RETAIL_SALES", "RETAIL_CASH"] },
            status: "ACTIVE",
          },
        }),
      ]);
      let activePeriod = await tx.finance_fiscal_periods.findFirst({
        where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), status: "OPEN" },
      });
      
      if (!activePeriod) {
        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        // fiscal_year_id is a required non-null column; generate a deterministic identifier
        // scoped to the tenant + calendar year (no FK model exists in the schema).
        const fiscalYearId = `FY-${ctx.tenant_id}-${now.getFullYear()}`;
        activePeriod = await tx.finance_fiscal_periods.create({
          data: {
            id: require('crypto').randomUUID(),
            ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
            name: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
            start_date: periodStart,
            end_date: periodEnd,
            status: 'OPEN',
            fiscal_year_id: fiscalYearId,
            updated_at: new Date(),
          },
        });
      }

      // Resolve the GL accounts for the sale. Mappings/accounts may not be seeded for this
      // tenant yet, and the previous hardcoded fallbacks ("ACC-4000"/"ACC-1001") are not
      // real finance_chart_of_accounts ids -> journal-line FK violation -> checkout 500.
      // Resolve-or-create the real accounts (by tenant+code) and persist the system mapping
      // so subsequent sales reuse them and the GL stays consistent.
      const resolveGlAccount = async (
        systemCode: string,
        accountCode: string,
        accountName: string,
        accountType: string,
      ): Promise<string> => {
        const scope = MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true });
        // 1. Existing active mapping pointing at a real account?
        const mapping = mappings.find((m: any) => m.system_code === systemCode);
        if (mapping?.account_id) {
          const acc = await tx.finance_chart_of_accounts.findUnique({ where: { id: mapping.account_id } });
          if (acc) return acc.id;
        }
        // 2. Find-or-create the account by (tenant, code).
        let account = await tx.finance_chart_of_accounts.findUnique({
          where: { tenant_id_code: { tenant_id: ctx.tenant_id, code: accountCode } },
        });
        if (!account) {
          account = await tx.finance_chart_of_accounts.create({
            data: { id: uuidv4(), ...scope, code: accountCode, name: accountName, type: accountType, status: "ACTIVE", updated_at: new Date() },
          });
        }
        // 3. Upsert the system mapping so future sales resolve instantly.
        await tx.finance_system_mappings.upsert({
          where: { tenant_id_system_code: { tenant_id: ctx.tenant_id, system_code: systemCode } },
          update: { account_id: account.id, status: "ACTIVE" },
          create: { id: uuidv4(), ...scope, system_code: systemCode, account_id: account.id, status: "ACTIVE", updated_at: new Date() },
        });
        return account.id;
      };

      const salesAccountId = await resolveGlAccount("RETAIL_SALES", "4000", "Retail Sales Revenue", "REVENUE");
      const cashAccountId = await resolveGlAccount("RETAIL_CASH", "1001", "Cash on Hand", "ASSET");

      let departmentId = dept?.id;
      if (!departmentId) {
        const existingDept = await tx.departments.findFirst({
          where: { tenant_id: ctx.tenant_id, code: "RET" },
          select: { id: true },
        });
        if (existingDept) {
          departmentId = existingDept.id;
        } else {
          const newDept = await tx.departments.create({
            data: {
              id: uuidv4(),
              updated_at: new Date(),
              ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
              name: "Retail Operations",
              code: "RET",
              status: "active",
            },
          });
          departmentId = newDept.id;
        }
      }

      // 4. Process Items & Order
      let subtotal = new Prisma.Decimal(0);
      let totalDiscount = new Prisma.Decimal(0);
      const orderId = uuidv4();
      const itemsData = [];

      for (const item of data.items) {
        const product = await tx.item_masters.findUnique({
          where: { id: item.product_id },
        });
        if (!product) throw new Error(`Product ${item.product_id} not found`);

        const q = new Prisma.Decimal(item.quantity);
        const up = new Prisma.Decimal(item.unit_price);
        const itemDiscount = new Prisma.Decimal(item.discount || 0);
        const itemSubtotal = q.mul(up);
        
        subtotal = subtotal.add(itemSubtotal);
        totalDiscount = totalDiscount.add(itemDiscount);

        // Calculate Unit Cost (Valuation Lock)
        const costLayers = await tx.cost_layers.findMany({
          where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), sku_id: product.sku, location_id, remaining_qty: { gt: 0 } }
        });
        
        let totalQty = 0;
        let totalVal = 0;
        for (const cl of costLayers) {
          totalQty += Number(cl.remaining_qty);
          totalVal += Number(cl.remaining_qty) * Number(cl.unit_cost);
        }
        const unitCost = totalQty > 0 ? totalVal / totalQty : 0;

        itemsData.push({
          ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
          product_id: item.product_id,
          // retail_order_items.quantity is an Int column — pass a JS integer, not a
          // Prisma.Decimal (passing the Decimal object made Prisma reject the nested
          // create and 500 the whole checkout transaction before any order was written).
          quantity: Math.round(q.toNumber()),
          unit_price: up,
          total_price: itemSubtotal.minus(itemDiscount),
          unit_cost: new Prisma.Decimal(unitCost),
          discount: itemDiscount,
          tax_rate: item.tax_rate ? new Prisma.Decimal(item.tax_rate) : undefined,
        });

        // 5. ATOMIC STOCK DEDUCTION (Race Condition Prevention)
        // Note: Raw query field names must match DB (snake_case)
        console.log(`Deducting stock for Tenant: ${ctx.tenant_id}, Location: ${location_id}, Product: ${item.product_id}, Qty: ${q}`);
        const updatedCount = await tx.$executeRaw`
          UPDATE stock_levels 
          SET on_hand = on_hand - ${q},
              available = available - ${q},
              updated_at = NOW()
          WHERE tenant_id = ${ctx.tenant_id}
            AND location_id = ${location_id}
            AND product_id = ${item.product_id}
            AND available >= ${q}
        `;
        console.log(`Updated Count: ${updatedCount}`);

        if (updatedCount === 0) {
          throw new Error(
            `Insufficient stock for product ${product.name} (ID: ${item.product_id})`,
          );
        }

        // Stock Movement
        await tx.stock_movements.create({
          data: {
            id: uuidv4(),
            updated_at: new Date(),
            ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
            product_id: item.product_id,
            from_location_id: location_id,
            location_id: location_id,
            type: "RETAIL_SALE",
            reference_id: orderId,
            quantity: q,
            performed_by: user_id,
          },
        });
      }

      // 6. Create Order (Status: PAID)
      const employee = await tx.employees.findFirst({
        where: { user_id: user_id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) }
      });

      const netSubtotal = subtotal.minus(totalDiscount).minus(new Prisma.Decimal(data.cart_discount || 0));

      const order = await tx.retail_orders.create({
        data: {
          id: orderId,
          updated_at: new Date(),
          ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
          store_id: data.store_id,
          device_id: null,
          cashier_id: employee ? employee.id : null,
          customer_id: data.customer_id,
          shift_id: data.shift_id,
          status: data.payment_method === "GATEWAY" || data.payment_method === "qr" ? "pending" : "paid",
          subtotal: netSubtotal,
          tax: new Prisma.Decimal(data.grand_total).minus(netSubtotal),
          total_amount: new Prisma.Decimal(data.grand_total),
          currency: "IDR",
          payment_method: data.payment_method,
          notes: data.notes,
          retail_order_items: { create: itemsData },
        },
        include: {
          retail_order_items: { include: { item_masters: true } },
          stores: true,
        },
      });

      // 7. Finance Tracking
      if (data.shift_id) {
        const cashIncrement = data.payment_method.toLowerCase() === "cash"
          ? new Prisma.Decimal(data.grand_total)
          : new Prisma.Decimal(0);

        await tx.retail_shifts.update({
          where: { id: data.shift_id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
          data: {
            expected_cash: {
              increment: cashIncrement,
            },
          },
        });

        if (cashIncrement.gt(0) && employee?.id) {
          // Audit Cash Movement. employee_id FKs to employees.id — use the resolved
          // employee.id (cashier), NOT the auth user_id (which is not an employees.id and
          // caused a retail_cash_movements_employee_id_fkey violation that 500-ed checkout).
          await tx.retail_cash_movements.create({
            data: {
              tenant_id: ctx.tenant_id,
              store_id: data.store_id,
              shift_id: data.shift_id,
              employee_id: employee.id,
              amount: cashIncrement,
              type: "CASH_IN",
              reason: `RETAIL_SALE: ${order.id}`,
              notes: `POS Transaction: ${data.payment_method}`
            }
          });
        }
      }

      // Journal Entry
      await tx.finance_journal_entries.create({
        data: {
          id: uuidv4(),
          updated_at: new Date(),
          ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
          ref: `POS-SALE-${orderId.slice(-6).toUpperCase()}`,
          description: `POS Sale (${data.payment_method})`,
          fiscal_period_id: activePeriod.id,
          posting_date: new Date(),
          status: "POSTED",
          finance_journal_lines: {
            create: [
              {
                ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
                account_id: salesAccountId,
                account_code: salesAccountId, // Fallback for now
                description: `Sale ${orderId}`,
                side: "CREDIT",
                amount: new Prisma.Decimal(Number(data.grand_total)),
                debit: new Prisma.Decimal(0),
                credit: new Prisma.Decimal(Number(data.grand_total)),
              },
              {
                ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
                account_id: cashAccountId,
                account_code: cashAccountId, // Fallback for now
                description: `POS Payment`,
                side: "DEBIT",
                amount: new Prisma.Decimal(Number(data.grand_total)),
                debit: new Prisma.Decimal(Number(data.grand_total)),
                credit: new Prisma.Decimal(0),
              },
            ],
          },
        },
      });

      // Payment Transaction is now delegated to PaymentService (called by RetailService.checkout)

      const result = this.mapOrder(order);

      // 8. Finalize Idempotency
      if (idempotency_key) {
        await tx.sys_idempotency_keys.update({
          where: { tenant_id_key: { tenant_id: ctx.tenant_id, key: idempotency_key } },
          data: {
            status: "COMPLETED",
            response_snapshot: result as any,
          },
        });
      }

      return result;
    });
  }

  // ============================================================
  // INVENTORY OPERATIONS
  // ============================================================

  async submitOpname(ctx: TenantContext,
    data: { store_id: string; adjustments: any[]; shift_id?: string },
  ): Promise<{ success: boolean; skipped: string[]; created: any[] }> {
    const skipped: string[] = [];
    const created: any[] = [];
    let defaultCategoryId: string | null = null;
    // Unique reference per opname session so repeated counts of the same product/location
    // don't collide on the stock_movements unique key (tenant,reference_id,reference_type,
    // type,product_id,location_id). Previously a constant "OPNAME" fallback collided.
    const opnameRef = `OPNAME-${data.shift_id ? data.shift_id + "-" : ""}${uuidv4().slice(0, 8)}`;
    await this.prisma.$transaction(async (tx: any) => {
      const store = await tx.stores.findUnique({
        where: { id: data.store_id },
        select: { location_id: true, company_id: true },
      });

      if (!store) throw new Error("Store not found");

      let totalExpected = 0;
      let totalCounted = 0;

      for (const adj of data.adjustments) {
        // Hybrid Logic: Check if this is a Unit Barcode or a SKU Barcode
        // In the scanner, if Serialization Mode is ON, adj.serial_number will be provided.
        
        let productId = adj.product_id;

        // If product_id is missing but SKU is provided, resolve it. Use findFirst — sku is
        // only unique together with tenant_id (composite), so findUnique({sku,tenant_id}) is
        // invalid and threw a 500.
        if (!productId && adj.sku) {
          const product = await tx.item_masters.findFirst({
            where: { sku: adj.sku, tenant_id: ctx.tenant_id },
            select: { id: true }
          });
          if (product) productId = product.id;
        }

        // Verify the resolved product_id actually exists in the master for this tenant. A
        // provided-but-unknown product_id is truthy and would otherwise FK-violate on
        // stock_levels/stock_movements (500). Treat unknown items as skipped, not fatal.
        if (productId) {
          const exists = await tx.item_masters.findFirst({
            where: { id: productId, tenant_id: ctx.tenant_id },
            select: { id: true },
          });
          if (!exists) productId = undefined;
        }

        if (!productId) {
          console.warn(`[RETAIL_OPNAME] Could not resolve item: ${adj.sku || adj.product_id}`);
          skipped.push(String(adj.sku || adj.product_id || "unknown"));
          continue;
        }
        
        // If a serial number is provided, ensure the unit record exists
        if (adj.serial_number) {
          const existingUnit = await tx.inventory_units.findUnique({
            where: { id: adj.serial_number },
          });

          if (!existingUnit) {
            // Register new unique instance for this SKU
            await tx.inventory_units.create({
              data: {
                id: adj.serial_number,
                tenant_id: ctx.tenant_id,
                company_id: store.company_id,
                location_id: store.location_id,
                product_id: productId,
                status: "AVAILABLE",
                metadata: { source: "OPNAME_INITIAL_TAGGING", date: new Date() },
              }
            });
          } else {
            // Update existing unit location and status
            await tx.inventory_units.update({
              where: { id: adj.serial_number },
              data: { 
                location_id: store.location_id,
                status: "AVAILABLE",
                updated_at: new Date(),
              }
            });
            productId = existingUnit.product_id;
          }
        }

        const stock = await tx.stock_levels.findFirst({
          where: {
            tenant_id: ctx.tenant_id,
              location_id: store.location_id,
              product_id: productId,


          },
        });

        const actualCount = adj.actualCount ?? adj.actual_count ?? 0;
        const currentOnHand = stock ? Number(stock.on_hand) : 0;
        totalExpected += currentOnHand;
        totalCounted += actualCount;

        if (stock) {
          console.log(`[RETAIL_OPNAME] Updating Product ${productId} at ${store.location_id} to ${actualCount}`);
          await tx.stock_levels.update({
            where: { id: stock.id },
            data: {
              on_hand: actualCount,
              available: new Prisma.Decimal(actualCount.toString()).minus(stock.reserved),
              last_stock_take_at: new Date(),
            },
          });
        } else {
          console.log(`[RETAIL_OPNAME] Creating new stock level for Product ${productId} with Count ${actualCount}`);
          await tx.stock_levels.create({
            data: {
              id: uuidv4(),
              updated_at: new Date(),
              ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
              location_id: store.location_id,
              product_id: productId,
              department_id: null,
              on_hand: actualCount,
              available: actualCount,
              last_stock_take_at: new Date(),
            },
          });
        }

        // Log movement (column names must match the stock_movements schema exactly)
        await tx.stock_movements.create({
          data: {
            id: uuidv4(),
            updated_at: new Date(),
            ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
            product_id: productId,
            location_id: store.location_id,
            to_location_id: store.location_id,
            quantity: actualCount - currentOnHand,
            type: "STOCK_OPNAME",
            reference_id: opnameRef,
            reference_type: adj.serial_number ? "UNIT_SCAN" : "BULK_SCAN",
            performed_by: "system",
          },
        });
      }

      // Create a formal Audit Cycle record for this session
      await tx.inventory_audit_cycles.create({
        data: {
          id: uuidv4(),
          tenant_id: ctx.tenant_id,
          company_id: store.company_id,
          location_code: store.location_id,
          scope: "STORE_OPNAME",
          status: "COMPLETED",
          expected_value: totalExpected,
          counted_value: totalCounted,
          variance_value: totalCounted - totalExpected,
          opened_by: "system",
          closed_by: "system",
          created_at: new Date(),
          updated_at: new Date(),
        }
      });
    });

    return { success: true, skipped, created };
  }

  async receiveGoods(ctx: TenantContext,
    data: {
      store_id: string;
      shipment_id: string;
      items: any[];
      shift_id?: string;
    },
  ): Promise<{ success: boolean }> {
    await this.prisma.$transaction(async (tx: any) => {
      const store = await tx.stores.findUnique({
        where: { id: data.store_id },
        select: { location_id: true },
      });

      if (!store) throw new Error("Store not found");

      for (const item of data.items) {
        const stock = await tx.stock_levels.findFirst({
          where: {
            tenant_id: ctx.tenant_id,
            location_id: store.location_id,
            product_id: item.product_id,
          },
        });

        if (stock) {
          await tx.stock_levels.update({
            where: { id: stock.id },
            data: {
              on_hand: { increment: item.quantity },
              available: { increment: item.quantity },
            },
          });
        } else {
          await tx.stock_levels.create({
            data: {
              id: uuidv4(),
              updated_at: new Date(),
              ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
              location_id: store.location_id,
              product_id: item.product_id,
              department_id: null,
              on_hand: item.quantity,
              available: item.quantity,
            },
          });
        }

        // Log movement (column names must match the stock_movements schema exactly)
        await tx.stock_movements.create({
          data: {
            id: uuidv4(),
            updated_at: new Date(),
            ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
            product_id: item.product_id,
            location_id: store.location_id,
            to_location_id: store.location_id,
            quantity: item.quantity,
            type: "RECEIVE_GOODS",
            reference_id: data.shipment_id,
            reference_type: "GRN",
            performed_by: "system",
          },
        });
      }
    });

    return { success: true };
  }

  // ============================================================
  // PUBLIC GATEWAY — CUSTOMERS
  // ============================================================

  async findCustomerByEmail(ctx: TenantContext,
    email: string,
  ): Promise<any | null> {
    return this.prisma.retail_customers.findFirst({
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), email },
      include: { retail_customer_auth: true },
    });
  }

  async findCustomerById(ctx: TenantContext,
    customer_id: string,
  ): Promise<any | null> {
    return this.prisma.retail_customers.findFirst({
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), id: customer_id },
      include: { retail_customer_auth: true },
    });
  }

  async createCustomer(ctx: TenantContext, data: any): Promise<any> {
    return this.prisma.retail_customers.create({
      data: {
        id: uuidv4(),
        updated_at: new Date(),
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        name: data.name,
        email: data.email,
        phone: data.phone,
        ecommerce_id: data.ecommerce_id ?? undefined,
        retail_customer_auth: data.password_hash
          ? {
              create: {
                id: uuidv4(),
                password_hash: data.password_hash,
                password_updated_at: new Date(),
              },
            }
          : undefined,
      },
    });
  }

  async updateCustomer(ctx: TenantContext,
    customer_id: string,
    data: any,
  ): Promise<any> {
    return this.prisma.retail_customers.update({
      where: { id: customer_id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        points: data.points,
        tier: data.tier,
      },
    });
  }

  // --- Sessions ---

  async getChannelStock(ctx: TenantContext,
    channel_id: string,
    product_id: string
  ): Promise<{ available: Prisma.Decimal; on_hand: Prisma.Decimal; reserved: Prisma.Decimal; status: string }> {
    // 1. Get Channel & linked Stores
    const channel = await this.prisma.retail_channels.findUnique({
      where: { id: channel_id },
      include: { retail_channel_products: { where: { product_id } } }
    });
    if (!channel) return this.checkStock(ctx, product_id);

    // 2. Find Ecommerce Connector with same name/clientId to get linked stores
    // (Assuming name parity or we can use settings)
    const connector = await this.prisma.ecommerce_connectors.findFirst({
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), name: channel.name },
      include: { stores: { select: { location_id: true } } }
    });

    const locationIds = connector?.stores?.map((s: any) => s.location_id) || [];
    
    // 3. Sum stock across locations
    const stockLevels = await this.prisma.stock_levels.findMany({
      where: { 
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        product_id, 
        ...(locationIds.length > 0 && { location_id: { in: locationIds } }) 
      }
    });

    let totalAvail = new Prisma.Decimal(0);
    let totalOnHand = new Prisma.Decimal(0);
    let totalReserved = new Prisma.Decimal(0);

    for (const s of stockLevels) {
      totalAvail = totalAvail.add(s.available as any);
      totalOnHand = totalOnHand.add(s.on_hand as any);
      totalReserved = totalReserved.add(s.reserved as any);
    }

    // 4. Apply Channel Limit
    const channelProduct = channel.retail_channel_products[0];
    if (channelProduct?.stock_limit && totalAvail.greaterThan(channelProduct.stock_limit)) {
      totalAvail = new Prisma.Decimal(channelProduct.stock_limit);
    }

    return {
      available: totalAvail,
      on_hand: totalOnHand,
      reserved: totalReserved,
      status: totalAvail.greaterThan(0) ? "IN_STOCK" : "OUT_OF_STOCK"
    };
  }

  async createCustomerSession(ctx: TenantContext, data: any): Promise<any> {
    return this.prisma.retail_customer_sessions.create({
      data: {
        id: uuidv4(),
        updated_at: new Date(),
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        customer_id: data.customer_id,
        token_hash: data.token_hash,
        expires_at: data.expires_at,
        ip_address: data.ip_address,
        user_agent: data.user_agent,
      },
    });
  }

  async findCustomerSession(ctx: TenantContext,
    tokenHash: string,
  ): Promise<any | null> {
    return this.prisma.retail_customer_sessions.findFirst({
      where: {
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        token_hash: tokenHash,
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
    });
  }

  async revokeCustomerSession(ctx: TenantContext,
    tokenHash: string,
  ): Promise<void> {
    await this.prisma.retail_customer_sessions.updateMany({
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), token_hash: tokenHash, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  // --- Cart ---

  async getCart(ctx: TenantContext, customer_id: string): Promise<any | null> {
    return this.prisma.retail_carts.findFirst({
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), customer_id: customer_id },
      include: { retail_cart_items: { include: { item_masters: true } } },
    });
  }

  async createCart(ctx: TenantContext, customer_id: string): Promise<any> {
    return this.prisma.retail_carts.create({
      data: {
        id: uuidv4(),
        updated_at: new Date(),
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        customer_id: customer_id,
        status: "active",
      },
    });
  }

  async updateCartItem(ctx: TenantContext,
    cartId: string,
    product_id: string,
    data: { quantity: Prisma.Decimal; unit_price: Prisma.Decimal },
  ): Promise<any> {
    const existing = await this.prisma.retail_cart_items.findFirst({
      where: { cart_id: cartId, product_id: product_id },
    });

    if (existing) {
      return this.prisma.retail_cart_items.update({
        where: { id: existing.id },
        // @ts-ignore - Decimal precision typing mismatch patched automatically
        data: { quantity: data.quantity, unit_price: data.unit_price },
      });
    } else {
      return this.prisma.retail_cart_items.create({
        data: {
          id: uuidv4(),
          updated_at: new Date(),
          cart_id: cartId,
          product_id: product_id,
          // @ts-ignore - Decimal precision typing mismatch patched automatically
          quantity: data.quantity,
          unit_price: data.unit_price,
        },
      });
    }
  }

  async removeCartItem(ctx: TenantContext,
    cartId: string,
    item_id: string,
  ): Promise<void> {
    await this.prisma.retail_cart_items.deleteMany({
      where: { id: item_id, cart_id: cartId },
    });
  }

  async clearCart(ctx: TenantContext, cartId: string): Promise<void> {
    await this.prisma.retail_cart_items.deleteMany({ where: { cart_id: cartId } });
  }

  // --- Wishlist ---

  async getWishlist(ctx: TenantContext, customer_id: string): Promise<any | null> {
    return this.prisma.retail_wishlists.findFirst({
      where: { ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), customer_id: customer_id },
      include: { retail_wishlist_items: { include: { item_masters: true } } },
    });
  }
  // Duplicate getWishlist removed

  async upsertWishlist(ctx: TenantContext, customer_id: string): Promise<any> {
    return this.prisma.retail_wishlists.upsert({
      where: { customer_id: customer_id },
      update: {},
      create: { id: uuidv4(), ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }), customer_id: customer_id },
    });
  }

  async addWishlistItem(ctx: TenantContext,
    wishlistId: string,
    product_id: string,
  ): Promise<any> {
    const existing = await this.prisma.retail_wishlist_items.findFirst({
      where: { wishlist_id: wishlistId, product_id: product_id },
    });
    if (existing) return existing;
    return this.prisma.retail_wishlist_items.create({
      data: {
        id: uuidv4(),
        updated_at: new Date(),
        wishlist_id: wishlistId,
        product_id: product_id,
      },
    });
  }

  async removeWishlistItem(ctx: TenantContext,
    wishlistId: string,
    item_id: string,
  ): Promise<void> {
    await this.prisma.retail_wishlist_items.deleteMany({
      where: { id: item_id, wishlist_id: wishlistId },
    });
  }

  // --- Events ---

  async logEvent(ctx: TenantContext, data: any): Promise<any> {
    return this.prisma.audit_logs.create({
      data: {
        id: uuidv4(),
        ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }),
        module: "retail",
        action: data.type,
        entity_type: "event",
        entity_id:
          data.audit?.traceId ??
          createHash("md5").update(Date.now().toString()).digest("hex"),
        user_id: data.actor?.id ?? "anonymous",
        changes: data.payload as any,
        metadata: {
          scope: data.scope,
          timestamp: data.timestamp,
          actorType: data.actor?.type,
        } as any,
        created_at: new Date(),
      },
    });
  }

  // ============================================================
  // MAPPERS
  // ============================================================

  private mapStore(s: any): RetailStore {
    const settings = (s.settings as any) || {};
    return {
      id: s.id,
      tenant_id: s.tenant_id,
      tenantId: s.tenant_id,
      location_id: s.location_id,
      locationId: s.location_id,
      name: s.name,
      code: s.code,
      type: s.type as any,
      status: s.status as any,
      address: "",
      phone: s.phone,
      email: s.email,
      timezone: s.timezone ?? "Asia/Jakarta",
      currency: s.currency || "IDR",
      tax_zone: settings.tax_zone,
      manager_id: s.manager_id,
      managerId: s.manager_id,
      inventory_pool_id: s.inventory_pool_id,
      inventoryPoolId: s.inventory_pool_id,
      operational_config: settings.operational_config,
      operationalConfig: settings.operational_config,
      supply_config: settings.supply_config,
      supplyConfig: settings.supply_config,
      infrastructure_registry: settings.infrastructure_registry,
      infrastructureRegistry: settings.infrastructure_registry,
      channel_binding: settings.channel_binding,
      channelBinding: settings.channel_binding,
      governance: settings.governance,
      created_at: s.created_at,
      updated_at: s.updated_at,
    };
  }

  private mapEcommerceStore(s: any): any {
    return {
      id: s.id,
      tenant_id: s.tenant_id,
      name: s.name,
      platform: s.platform,
      domain: s.domain,
      apiKey: s.apiKey,
      status: s.status,
      inventory_pool_id: s.inventory_pool_id,
      manager_id: s.manager_id,
      branches: s.stores ?? [],
      settings: s.settings,
      created_at: s.created_at,
      updated_at: s.updated_at,
    };
  }

  private mapProduct(p: any, location_id?: string, currency: string = "USD"): RetailProduct {
    const stockLevels = location_id
      ? (p.stock_levels || []).filter((s: any) => s.location_id === location_id)
      : (p.stock_levels || []).filter((s: any) => s.locations?.type !== 'headquarters');

    const soh = stockLevels.reduce(
      (sum: Prisma.Decimal, s: any) => sum.add((s.on_hand as unknown as Prisma.Decimal) || 0),
      new Prisma.Decimal(0) as any,
    );
    const reserved = stockLevels.reduce(
      (sum: Prisma.Decimal, s: any) => sum.add((s.reserved as unknown as Prisma.Decimal) || 0),
      new Prisma.Decimal(0) as any,
    );
    const available = stockLevels.reduce(
      (sum: Prisma.Decimal, s: any) => sum.add((s.available as unknown as Prisma.Decimal) || 0),
      new Prisma.Decimal(0) as any,
    );

    let customName = p.name;
    let customDesc = p.description || "";
    let customPrice = (p.selling_price || p.base_price as unknown as Prisma.Decimal);

    if (p.product_projections && p.product_projections.length > 0) {
      const locProj = p.product_projections.find(
        (proj: any) =>
          proj.location_id === location_id && proj.module_type === "RETAIL",
      );
      const globalProj = p.product_projections.find(
        (proj: any) => proj.location_id === null && proj.module_type === "RETAIL",
      );
      const activeProj = locProj || globalProj;

      if (activeProj) {
        if (activeProj.custom_name) customName = activeProj.custom_name;
        if (activeProj.custom_description)
          customDesc = activeProj.custom_description;
        if (activeProj.price) customPrice = (activeProj.price as unknown as Prisma.Decimal);
      }
    }

    return {
      id: p.id,
      tenant_id: p.tenant_id,
      sku: p.sku,
      barcode: p.barcode,
      name: customName,
      description: customDesc,
      imageUrl: (() => {
        // Priority 1: item_images table (primary image)
        // item_images.url already contains the full path: /v1/inventory/images/tnt-.../file.jpg
        // so we only prefix /api (not /api/v1/inventory/images/ again)
        const primaryImg = p.item_images?.find((img: any) => img.is_primary) || p.item_images?.[0];
        if (primaryImg?.url) {
          const url = primaryImg.url as string;
          return url.startsWith('/api') ? url : `/api${url}`;
        }
        // Priority 2: legacy image_url field (just a filename, needs full prefix)
        if (p.image_url) return `/api/v1/inventory/images/${p.image_url}`;
        return null;
      })(),
      category_id: p.category_id,
      categoryName: p.product_categories?.name,
      base_price: customPrice,
      currency: currency,
      prices: [{ amount: customPrice, currency: currency }],
      tax_rate: (p.tax_rate as unknown as Prisma.Decimal) || new Prisma.Decimal(0) as any,
      unit: p.unit,
      type: p.type as any,
      status: p.status as any,
      variants: [],
      seo: {
        title: `${p.name} | Zenvix Store`,
        metaDescription: p.description || `Buy ${p.name} at the best price.`,
        keywords: [p.name],
      },
      metadata: {
        stockOnHand: soh,
        reserved: reserved,
        available: available,
        minBuffer: p.stock_levels.reduce((sum: number, s: any) => sum + (s.min_buffer || 0), 0),
      },
      stock: soh,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  }

  async getCustomerById(ctx: TenantContext, id: string) {
    return this.prisma.retail_customers.findUnique({
      where: { id, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
    });
  }

  async getCustomerByPhone(ctx: TenantContext, phone: string) {
    return this.prisma.retail_customers.findFirst({
      where: { phone, ...MultiTenancyUtil.getScope(ctx, {}, { excludeBranch: true }) },
    });
  }

  private mapOrder(o: any): RetailOrder {
    return {
      id: o.id,
      tenant_id: o.tenant_id,
      location_id: o.stores?.location_id || "",
      store_id: o.store_id || o.stores_id, // Support both potential keys
      terminal_id: o.device_id,
      cashier_id: o.cashier_id,
      customer_id: o.customer_id,
      customer_name: o.retail_customers?.name || o.customer?.name,
      shift_id: o.shift_id,
      status: o.status as any,
      items: (o.retail_order_items || []).map((item: any) => this.mapOrderItem(item)) || [],
      subtotal: (o.subtotal as unknown as Prisma.Decimal) || new Prisma.Decimal(0) as any,
      tax_total: (o.tax as unknown as Prisma.Decimal) || new Prisma.Decimal(0) as any,
      discount_total: new Prisma.Decimal(0) as any,
      grand_total: (o.total_amount as unknown as Prisma.Decimal) || new Prisma.Decimal(0) as any,
      currency: o.currency || "IDR",
      commission_amount: (o.commission_amount as unknown as Prisma.Decimal) || undefined,
      payment_method: o.payment_method as any,
      payment_status: "paid",
      created_at: o.created_at,
      updated_at: o.updated_at,
    };
  }

  private mapOrderItem(item: any): RetailOrderItem {
    return {
      product_id: item.product_id,
      variant_id: undefined,
      sku: item.item_masters?.sku || item.product?.sku || "",
      name: item.item_masters?.name || item.product?.name || "",
      quantity: (item.quantity as unknown as Prisma.Decimal) || new Prisma.Decimal(0) as any,
      unit_price: (item.unit_price as unknown as Prisma.Decimal) || new Prisma.Decimal(0) as any,
      tax_amount: new Prisma.Decimal(0) as any,
      discount_amount: (item.discount as unknown as Prisma.Decimal) || new Prisma.Decimal(0) as any,
      total_price: (item.total_price as unknown as Prisma.Decimal) || new Prisma.Decimal(0) as any,
      commission_rate: (item.commission_rate as unknown as Prisma.Decimal) || undefined,
      commission_amount: (item.commission_amount as unknown as Prisma.Decimal) || undefined,
    };
  }

  private mapShift(s: any): RetailShift {
    return {
      id: s.id,
      tenant_id: s.tenant_id,
      location_id: "",
      store_id: s.store_id || s.stores_id,
      employee_id: s.employee_id,
      employeeId: s.employee_id, // Frontend alias
      terminal_id: "",
      start_time: s.start_time,
      end_time: s.end_time,
      opening_cash: (s.opening_cash as unknown as Prisma.Decimal) || new Prisma.Decimal(0),
      openingCash: (s.opening_cash as unknown as Prisma.Decimal) || new Prisma.Decimal(0) as any, // Frontend alias
      closing_cash: (s.closing_cash as unknown as Prisma.Decimal) || undefined,
      closingCash: (s.closing_cash as unknown as Prisma.Decimal) || undefined as any, // Frontend alias
      expected_cash: (s.expected_cash as unknown as Prisma.Decimal) || new Prisma.Decimal(0),
      expectedCash: (s.expected_cash as unknown as Prisma.Decimal) || new Prisma.Decimal(0) as any, // Frontend alias
      actual_cash: (s.actual_cash as unknown as Prisma.Decimal) || undefined,
      actualCash: (s.actual_cash as unknown as Prisma.Decimal) || undefined as any, // Frontend alias
      variance: (s.variance as unknown as Prisma.Decimal) || undefined,
      reconciliation_reason: s.reconciliation_reason,
      status: s.status as any,
      notes: s.notes,
      cash_movements: s.retail_cash_movements || [],
    };
  }

  private hashSecret(secret: string): string {
    return createHash("sha256").update(secret).digest("hex");
  }

  // Stubs for IRetailRepository interface satisfaction (implemented in RetailMockRepository)
  async listChannelProducts(ctx: TenantContext, channel_id: string): Promise<any[]> {
    return [];
  }
  async updateChannelProducts(ctx: TenantContext, channel_id: string, updates: any[]): Promise<void> {}
  async updateChannelCategories(ctx: TenantContext, channel_id: string, categories: string[]): Promise<void> {}
  async getChannelCategories(ctx: TenantContext, channel_id: string): Promise<string[]> {
    return [];
  }
}
