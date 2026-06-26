import { TenantContext } from "../../gateway/tenant-context.interface";
import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { IRetailRepository } from "./repositories/retail.repository.interface";
import { SkuGeneratorService } from "../../core/inventory/sku-generator.service";
import { RetailPrintService } from "./retail-print.service";
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TransactionType } from "../../core/finance/dto/create-transaction.dto";
import {
  RetailStore,
  RetailProduct,
  RetailOrder,
  RetailShift,
} from "./entities/retail.entity";
import {
  CreateStoreDto,
  UpdateStoreDto,
  CreateOrderDto,
  CheckoutDto,
  OpenShiftDto,
  CloseShiftDto,
  CreateEcommerceStoreDto,
  UpdateEcommerceStoreDto,
  RegisterEcommerceBranchDto,
  CreateInventoryPoolDto,
  UpdateProductDto,
  RegisterBranchDeviceDto,
  RegisterCCTVCameraDto,
  RegisterBranchSensorDto,
  ReconcileShiftDto,
} from "./dto/retail.dto";
import { randomBytes, createHash } from "crypto";
import { AuditService } from "../../shared/audit/audit.service";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../persistence/prisma.service";
import { EventBusService } from "../../shared/events/event-bus.service";
import { InventoryService } from "../../core/inventory/inventory.service";
import { IFinanceRepository } from "../../core/finance/repositories/finance.repository.interface";
import { PaymentService } from "../../core/payment/payment.service";
import { CreatePaymentTransactionDto } from "../../core/payment/dto/create-payment-transaction.dto";

@Injectable()
export class RetailService {
  constructor(
    private readonly retailRepository: IRetailRepository,
    private readonly inventoryService: InventoryService,
    private readonly financeRepository: IFinanceRepository,
    private readonly paymentService: PaymentService,
    private readonly auditService: AuditService,
    private readonly skuGenerator: SkuGeneratorService,
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly retailPrint: RetailPrintService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Stores (Physical Branches)
  async listStores(ctx: TenantContext,
    location_id?: string,
  ): Promise<RetailStore[]> {
    return this.retailRepository.listStores(ctx, location_id);
  }

  private async resolveLocationId(ctx: TenantContext, inputId?: string): Promise<string | undefined> {
    if (!inputId) return undefined;
    
    // 1. Attempt to find a store where this input is the Store ID
    const stores = await this.retailRepository.listStores(ctx);
    console.log(`[RetailService] resolveLocationId: Checking ${stores.length} stores for tenant ${ctx.tenant_id}`);
    
    const storeById = stores.find((s) => s.id === inputId);
    if (storeById) {
      const resolved = storeById.location_id || storeById.id;
      console.log(`[RetailService] RESOLVE: Store ID ${inputId} -> Physical ID ${resolved} (Store: ${storeById.name})`);
      return resolved;
    }

    // 2. Fallback: Check if inputId is already a physical location ID
    const storeByLocation = stores.find((s) => s.location_id === inputId);
    if (storeByLocation) {
      console.log(`[RetailService] RESOLVE: Input ${inputId} is already a physical ID for store ${storeByLocation.name}`);
      return inputId;
    }

    console.log(`[RetailService] RESOLVE FAILED: Input ${inputId} not found in stores list. Returning as-is.`);
    return inputId;
  }

  async listCategories(ctx: TenantContext): Promise<any[]> {
    return this.retailRepository.listCategories(ctx);
  }

  async getStore(ctx: TenantContext, store_id: string): Promise<RetailStore | null> {
    return this.retailRepository.getStore(ctx, store_id);
  }

  async getStoreByLocation(ctx: TenantContext, location_id: string): Promise<RetailStore | null> {
    const store = await this.prisma.stores.findFirst({
      where: { tenant_id: ctx.tenant_id, location_id, status: 'active', deleted_at: null },
      orderBy: { created_at: 'desc' },
    });
    if (!store) return null;
    return { id: store.id, name: store.name, locationId: store.location_id } as any;
  }

  async createStore(ctx: TenantContext,
    data: CreateStoreDto,
    user_id: string,
  ): Promise<RetailStore> {
    const store = await this.retailRepository.createStore(ctx, data);
    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "retail",
      action: "CREATE",
      entity_type: "STORE",
      entity_id: store.id,
      metadata: { name: store.name, code: store.code },
    });
    return store;
  }

  async updateStore(ctx: TenantContext,
    store_id: string,
    data: UpdateStoreDto,
    user_id: string,
  ): Promise<RetailStore> {
    const store = await this.retailRepository.updateStore(
      ctx,
      store_id,
      data,
    );
    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "retail",
      action: "UPDATE",
      entity_type: "STORE",
      entity_id: store_id,
      metadata: { changes: data },
    });
    return store;
  }

  async deleteStore(ctx: TenantContext,
    store_id: string,
    user_id: string,
  ): Promise<void> {
    await this.prisma.retail_cart_items.deleteMany({ where: { cart_id: store_id } });
    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "retail",
      action: "DELETE",
      entity_type: "STORE",
      entity_id: store_id,
    });
  }

  // Inventory Pools
  async listInventoryPools(ctx: TenantContext): Promise<any[]> {
    return this.retailRepository.listInventoryPools(ctx);
  }

  async createInventoryPool(ctx: TenantContext,
    data: CreateInventoryPoolDto,
    user_id: string,
  ): Promise<any> {
    const pool = await this.retailRepository.createInventoryPool(
      ctx,
      data,
    );
    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "retail",
      action: "CREATE",
      entity_type: "INVENTORY_POOL",
      entity_id: pool.id,
      metadata: { name: pool.name },
    });
    return pool;
  }

  async getInventoryPool(ctx: TenantContext, poolId: string): Promise<any> {
    const pool = await this.retailRepository.getInventoryPool(ctx, poolId);
    if (!pool)
      throw new NotFoundException(`Inventory pool ${poolId} not found`);
    return pool;
  }

  async deleteInventoryPool(ctx: TenantContext,
    poolId: string,
    user_id: string,
  ): Promise<void> {
    await this.retailRepository.deleteInventoryPool(ctx, poolId);
    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "retail",
      action: "DELETE",
      entity_type: "INVENTORY_POOL",
      entity_id: poolId,
    });
  }

  // E-Commerce Stores
  async listEcommerceStores(ctx: TenantContext,
    store_id?: string,
  ): Promise<any[]> {
    return this.retailRepository.listEcommerceStores(ctx, store_id);
  }

  async getEcommerceStore(ctx: TenantContext, store_id: string): Promise<any> {
    const store = await this.retailRepository.getEcommerceStore(
      ctx,
      store_id,
    );
    if (!store)
      throw new NotFoundException(`E-commerce store ${store_id} not found`);
    return store;
  }

  async createEcommerceStore(ctx: TenantContext,
    data: CreateEcommerceStoreDto,
    user_id: string,
  ): Promise<any> {
    const store = await this.retailRepository.createEcommerceStore(
      ctx,
      data,
    );
    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "retail",
      action: "CREATE",
      entity_type: "ECOMMERCE_STORE",
      entity_id: store.id,
      metadata: { name: store.name },
    });
    return store;
  }

  /**
   * Unified e-commerce registration entry point.
   *
   * Creates an `"ecommerce"` {@link RetailStore} — a virtual branch that participates in
   * the standard branch hierarchy with the same configuration capabilities as a physical
   * branch — rather than a standalone connector/channel that links TO branches via
   * `branch_ids[]`. Optionally binds a {@link RetailChannel} to the new virtual branch so
   * the e-commerce presence enters the hierarchy with its sales channel attached.
   *
   * This is the single registration path referenced by Requirements 2.1, 2.2, 2.3.
   */
  async registerEcommerceBranch(
    ctx: TenantContext,
    data: RegisterEcommerceBranchDto,
    user_id: string,
  ): Promise<RetailStore & { boundChannel?: any }> {
    if (!data.name || !data.location_id) {
      throw new BadRequestException("name and location_id are required");
    }

    // Derive a unique code when the caller does not supply one. A short random suffix keeps
    // it readable while guaranteeing uniqueness (the (tenant,code) unique index previously
    // collided when two storefronts shared a domain/name prefix after truncation).
    const code =
      data.code ||
      `EC-${(data.domain || data.name)
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 8)
        .toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;

    // Build the virtual-branch creation payload. The "ecommerce" type places the new
    // presence INSIDE the hierarchy; channel_binding records the originating platform.
    const storeDto = {
      name: data.name,
      code,
      location_id: data.location_id,
      type: "ecommerce",
      inventory_pool_id: data.inventory_pool_id,
      manager_id: data.manager_id,
      channel_binding: data.platform
        ? { marketplace_integrations: [data.platform] }
        : undefined,
    } as unknown as CreateStoreDto;

    const store = await this.createStore(ctx, storeDto, user_id);

    // Optionally bind a sales channel to the new virtual branch (parent-child link).
    let boundChannel: any | undefined;
    if (data.channel) {
      boundChannel = await this.createChannel(
        ctx,
        {
          name: data.channel.name,
          type: data.channel.type || "OWNED",
          sync_frequency: data.channel.sync_frequency,
          integration_category: data.channel.integration_category,
          branch_id: store.id,
        },
        user_id,
      );
    }

    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "retail",
      action: "REGISTER_ECOMMERCE_BRANCH",
      entity_type: "STORE",
      entity_id: store.id,
      metadata: {
        name: store.name,
        platform: data.platform,
        domain: data.domain,
        boundChannelId: boundChannel?.id,
      },
    });

    return boundChannel ? { ...store, boundChannel } : store;
  }

  async updateEcommerceStore(ctx: TenantContext,
    store_id: string,
    data: UpdateEcommerceStoreDto,
    user_id: string,
  ): Promise<any> {
    const store = await this.retailRepository.updateEcommerceStore(
      ctx,
      store_id,
      data,
    );
    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "retail",
      action: "UPDATE",
      entity_type: "ECOMMERCE_STORE",
      entity_id: store_id,
      metadata: { changes: data },
    });
    return store;
  }

  async deleteEcommerceStore(ctx: TenantContext,
    store_id: string,
    user_id: string,
  ): Promise<void> {
    await this.retailRepository.deleteEcommerceStore(ctx, store_id);
    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "retail",
      action: "DELETE",
      entity_type: "ECOMMERCE_STORE",
      entity_id: store_id,
    });
  }

  async linkEcommerceToBranch(ctx: TenantContext,
    ecommerceId: string,
    branch_id: string,
    user_id: string,
  ): Promise<void> {
    await this.retailRepository.linkEcommerceToBranch(
      ctx,
      ecommerceId,
      branch_id,
    );
    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "retail",
      action: "LINK",
      entity_type: "ECOMMERCE_BRANCH",
      entity_id: ecommerceId,
      metadata: { branch_id },
    });
  }

  async unlinkEcommerceFromBranch(ctx: TenantContext,
    ecommerceId: string,
    branch_id: string,
    user_id: string,
  ): Promise<void> {
    await this.retailRepository.unlinkEcommerceFromBranch(
      ctx,
      ecommerceId,
      branch_id,
    );
    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "retail",
      action: "UNLINK",
      entity_type: "ECOMMERCE_BRANCH",
      entity_id: ecommerceId,
      metadata: { branch_id },
    });
  }

  // Products
  async listProducts(ctx: TenantContext,
    options?: {
      page?: number;
      pageSize?: number;
      category_id?: string;
      type?: string;
      minPrice?: number;
      maxPrice?: number;
      q?: string;
      sortBy?: "name" | "price" | "created_at";
      sortDir?: "asc" | "desc";
      location_id?: string;
    },
  ) {
    if (options?.location_id) {
      options.location_id = await this.resolveLocationId(ctx, options.location_id);
    }
    return this.retailRepository.listProducts(ctx, options);
  }

  async getProduct(ctx: TenantContext, product_id: string) {
    return this.retailRepository.getProduct(ctx, product_id);
  }

  async updateProduct(ctx: TenantContext,
    product_id: string,
    data: UpdateProductDto,
    user_id: string,
    location_id?: string,
  ) {
    const updated = await this.retailRepository.updateProduct(
      ctx,
      product_id,
      data,
      location_id,
    );
    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "retail",
      action: "UPDATE",
      entity_type: "PRODUCT",
      entity_id: product_id,
      metadata: { changes: data, location_id },
    });
    return updated;
  }

  async findProductBySku(ctx: TenantContext, sku: string): Promise<any> {
    return this.prisma.item_masters.findFirst({
      where: {
        tenant_id: ctx.tenant_id,
        sku,
        status: "active",
      },
    });
  }

  async generateNextSku(ctx: TenantContext,
    category_id: string,
  ): Promise<{ sku: string; barcode: string }> {
    const sku = await this.skuGenerator.generateSku(ctx, category_id);
    const barcode = this.skuGenerator.generateBarcode(ctx, sku);
    return { sku, barcode };
  }

  async listOrders(
    ctx: TenantContext,
    options?: {
      store_id?: string;
      customer_id?: string;
      ecommerce_id?: string;
      status?: string;
    },
  ): Promise<RetailOrder[]> {
    return this.retailRepository.listOrders(ctx, options);
  }

  async listCustomers(
    ctx: TenantContext,
    options?: { ecommerce_id?: string; q?: string },
  ) {
    return this.retailRepository.listCustomers(ctx, options);
  }

  async getEcommerceAnalytics(ctx: TenantContext, ecommerce_id?: string) {
    // Basic analytics implementation
    const orders = await this.retailRepository.listOrders(ctx, {
      ecommerce_id,
      status: "paid",
    });

    const revenue = orders.reduce(
      (sum, o) => sum + Number(o.grand_total),
      0,
    );
    const orderCount = orders.length;

    // Get top products
    const productMap = new Map<string, { name: string; count: number }>();
    orders.forEach((o) => {
      o.items.forEach((item) => {
        const existing = productMap.get(item.product_id);
        if (existing) {
          existing.count += Number(item.quantity);
        } else {
          productMap.set(item.product_id, {
            name: (item as any).item_masters?.name || "Unknown",
            count: Number(item.quantity),
          });
        }
      });
    });

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      revenue,
      orderCount,
      topProducts,
    };
  }

  async createOrder(ctx: TenantContext,
    location_id: string,
    data: CreateOrderDto,
    user_id: string,
  ): Promise<RetailOrder> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Reserve Stock
      for (const item of data.items) {
        const q = new Prisma.Decimal(item.quantity);
        
        // ATOMIC RESERVATION (Prevents Race Conditions)
        const updatedCount = await tx.$executeRaw`
          UPDATE stock_levels 
          SET available = available - ${Number(q)},
              reserved = reserved + ${Number(q)},
              updated_at = NOW()
          WHERE tenant_id = ${ctx.tenant_id}
            AND location_id = ${location_id}
            AND product_id = ${item.product_id}
            AND available >= ${Number(q)}
        `;

        if (updatedCount === 0) {
          throw new BadRequestException(`Insufficient stock for product ${item.product_id} at location ${location_id}`);
        }

        // Track Reservation
        await tx.stock_reservations.create({
          data: {
            id: uuidv4(),
            tenant_id: ctx.tenant_id,
            location_id,
            product_id: item.product_id,
            quantity: Number(q),
            status: 'PENDING',
            reference_id: 'pending_order', 
            reference_type: 'ECOMMERCE',
            expires_at: new Date(Date.now() + 30 * 60 * 1000), 
          }
        });
      }

      // 1.5 Auto-resolve Shift ID if not provided (Audit Integrity)
      let shiftId = data.shift_id;
      if (!shiftId && user_id) {
        const emp = await tx.employees.findFirst({ where: { user_id, tenant_id: ctx.tenant_id } });
        if (emp) {
          const activeShift = await tx.retail_shifts.findFirst({
            where: { store_id: data.store_id, employee_id: emp.id, status: "open", tenant_id: ctx.tenant_id }
          });
          if (activeShift) shiftId = activeShift.id;
        }
      }

      // 2. Initial creation (PENDING)
      // 3. Finalize Order
      const order = await this.retailRepository.createOrder(
        ctx,
        location_id,
        { 
          ...data, 
          shift_id: shiftId,
          currency: data.currency || "IDR"
        },
        user_id,
        tx,
      );

      // Emit events for core system synchronization
      this.eventEmitter.emit('retail.order.placed', { ctx, order });
      
      // If it's a paid order (common for ecommerce), signal completion
      if (order.status === 'paid' || order.payment_status === 'paid') {
        this.eventEmitter.emit('retail.order.completed', { ctx, order });
      }

      // 3. Update reservation with order_id
      await tx.stock_reservations.updateMany({
        where: { tenant_id: ctx.tenant_id, reference_id: 'pending_order', status: 'PENDING' },
        data: { reference_id: order.id }
      });

      // Audit initial creation
      await this.auditService.log({
        tenant_id: ctx.tenant_id,
        user_id,
        module: "retail",
        action: "CREATE",
        entity_type: "ORDER",
        entity_id: order.id,
        metadata: { total: order.grand_total, itemCount: order.items.length },
      }, tx);

      return order;
    });
  }

  async checkout(ctx: TenantContext,
    data: CheckoutDto,
    user_id: string,
    idempotency_key?: string,
  ): Promise<any> {
    const order = await this.retailRepository.atomicCheckout(
      ctx,
      data,
      user_id,
      idempotency_key,
    );

    // DELEGATE PAYMENT TO PaymentService
    const paymentDto: CreatePaymentTransactionDto = {
      type: "pos_payment",
      destination: data.store_id, // Route to the store
      externalReference: order.id,
      amount: Number(data.grand_total),
      currency: "IDR",
    };

    let paymentResult: any = null;
    if (data.payment_method === "GATEWAY") {
       paymentResult = await this.paymentService.createGatewayPayment(ctx, paymentDto, user_id);
    } else if (data.payment_method === "EDC") {
       paymentResult = await this.paymentService.confirmEDC(ctx, {...paymentDto, externalRef: data.external_ref}, user_id);
    } else {
       paymentResult = await this.paymentService.processCash(ctx, paymentDto, user_id);
    }

    // REAL-TIME SALES BONUS INTEGRATION (If Paid immediately)
    if (order.status === "paid" || order.status === "completed") {
      const bonusRate = 0.02; // 2% commission (standard)
      // atomicCheckout returns a mapped RetailOrder whose monetary field is `grand_total`
      // (mapped from the row's total_amount). Use it defensively.
      const orderTotal = (order as any).grand_total ?? (order as any).total_amount ?? 0;
      const bonusAmount = new Prisma.Decimal(orderTotal.toString()).mul(bonusRate);

      if (bonusAmount.gt(0) && order.cashier_id) {
        // Log to HR Sales Bonuses for payroll
        await this.prisma.hr_sales_bonuses.create({
          data: {
            id: `BON-${order.id.slice(-8).toUpperCase()}-${Date.now().toString().slice(-4)}`,
            tenant_id: ctx.tenant_id,
            employee_id: order.cashier_id,
            order_id: order.id,
            amount: bonusAmount,
            status: "PENDING",
            created_at: new Date(),
          },
        });

        // Update Order record with commission amount for auditability
        await this.prisma.retail_orders.update({
          where: { id: order.id },
          data: { commission_amount: bonusAmount }
        });
      }
    }

    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "retail",
      action: "CHECKOUT",
      entity_type: "ORDER",
      entity_id: order.id,
      metadata: { 
        total: (order as any).grand_total ?? (order as any).total_amount, 
        method: data.payment_method,
        idempotency_key: idempotency_key || "N/A"
      },
    });
    
    // Signal completion for Core Sync (Marketing, Sales, Finance)
    this.eventEmitter.emit('retail.order.completed', { ctx, order });

    return data.payment_method === "GATEWAY" 
      ? { ...order, client_secret: paymentResult?.client_secret, transaction_id: paymentResult?.transaction_id }
      : order;
  }


  async calculateTax(ctx: TenantContext,
    order_id: string,
    user_id?: string,
  ): Promise<number> {
    const order = await this.retailRepository.getOrder(ctx, order_id);
    if (!order) throw new NotFoundException("Order not found");

    // DECIMAL-SAFE: Precise tax calculation using Prisma.Decimal
    const subtotal = new Prisma.Decimal(String(order.subtotal));
    const taxRate = new Prisma.Decimal("0.1"); // Simple 10% rate
    const tax_total = subtotal.mul(taxRate);

    await this.retailRepository.updateOrderStatus(
      ctx,
      order_id,
      order.status,
      { tax_total: tax_total },
    );

    if (user_id) {
      await this.auditService.log({
        tenant_id: ctx.tenant_id,
        user_id,
        module: "retail",
        action: "CALCULATE_TAX",
        entity_type: "ORDER",
        entity_id: order_id,
        metadata: { tax_total: tax_total.toNumber() },
      });
    }

    return tax_total.toNumber();

  }

  async updateOrderStatus(ctx: TenantContext,
    order_id: string,
    status: string,
    metadata?: any,
    user_id?: string,
  ): Promise<RetailOrder> {
    const order = await this.retailRepository.updateOrderStatus(
      ctx,
      order_id,
      status,
      metadata,
    );
    if (user_id) {
      await this.auditService.log({
        tenant_id: ctx.tenant_id,
        user_id,
        module: "retail",
        action: "UPDATE_STATUS",
        entity_type: "ORDER",
        entity_id: order_id,
        metadata: { status, ...metadata },
      });
    }
    return order;
  }

  async voidOrder(ctx: TenantContext,
    order_id: string,
    user_id: string,
  ): Promise<RetailOrder> {
    const order = await this.retailRepository.voidOrder(
      ctx,
      order_id,
      user_id,
    );

    await this.eventBus.publish({
      event_type: "RETAIL_ORDER_VOIDED",
      tenant_id: ctx.tenant_id,
      entity_id: order_id,
      entity_type: "ORDER",
      source_module: "retail",
      payload: { order_id, total: order.grand_total },
      user_id,
    });

    return order;
  }

  async cancelOrder(ctx: TenantContext,
    order_id: string,
    user_id: string,
  ): Promise<RetailOrder> {
    const order = await this.retailRepository.cancelOrder(
      ctx,
      order_id,
      user_id,
    );

    await this.eventBus.publish({
      event_type: "RETAIL_ORDER_CANCELLED",
      tenant_id: ctx.tenant_id,
      entity_id: order_id,
      entity_type: "ORDER",
      source_module: "retail",
      payload: { order_id },
      user_id,
    });

    return order;
  }


  async getStockStatus(ctx: TenantContext, product_id: string) {
    return this.retailRepository.checkStock(ctx, product_id);
  }

  async getChannelStockStatus(ctx: TenantContext, channel_id: string, product_id: string) {
    return this.retailRepository.getChannelStock(ctx, channel_id, product_id);
  }

  async getInventoryStats(ctx: TenantContext,
    options?: { category_id?: string; q?: string; location_id?: string },
  ) {
    if (options?.location_id) {
      options.location_id = await this.resolveLocationId(ctx, options.location_id);
    }
    return this.retailRepository.getInventoryStats(ctx, options);
  }

  // Shifts
  async getActiveShift(ctx: TenantContext,
    store_id: string,
    employee_id: string,
  ): Promise<RetailShift | null> {
    // Shifts are persisted against the resolved `employees.id`, but controllers pass the
    // auth `user_id`. Resolve user_id -> employee_id (read-only, no auto-create) before the
    // lookup so the active-shift check actually matches the open shift. Falls back to the
    // supplied id when it is already an employee id (no employee row keyed by that user_id).
    let resolvedEmployeeId = employee_id;
    const employee = await this.prisma.employees.findFirst({
      where: { user_id: employee_id, tenant_id: ctx.tenant_id },
      select: { id: true },
    });
    if (employee) resolvedEmployeeId = employee.id;
    return this.retailRepository.getActiveShift(ctx, store_id, resolvedEmployeeId);
  }

  async openShift(ctx: TenantContext,
    location_id: string,
    userId: string,
    data: OpenShiftDto,
    user_id?: string,
  ): Promise<RetailShift & { cash_handover_warning?: { previous_closing_cash: number; opening_cash: number; variance: number; previous_shift_id: string; message: string } }> {
    // 1. Resolve Employee ID from User ID (Retail shifts require an Employee record)
    const resolvedEmployeeId = await this.resolveEmployeeId(ctx, userId);

    // Check if already has an active shift
    const active = await this.retailRepository.getActiveShift(
      ctx,
      data.store_id,
      resolvedEmployeeId,
    );
    if (active) {
      throw new BadRequestException("Shift already active for this employee and store.");
    }

    // 2. Check previous shift's closing cash at this store for handover validation
    let cashHandoverWarning: { previous_closing_cash: number; opening_cash: number; variance: number; previous_shift_id: string; message: string } | undefined;
    const previousShift = await this.prisma.retail_shifts.findFirst({
      where: {
        tenant_id: ctx.tenant_id,
        store_id: data.store_id,
        status: 'closed',
      },
      orderBy: { start_time: 'desc' },
      select: { id: true, closing_cash: true, expected_cash: true, employee_id: true },
    });

    if (previousShift && previousShift.closing_cash !== null) {
      const prevClosing = Number(previousShift.closing_cash);
      const currentOpening = Number(data.opening_cash || 0);
      const handoverVariance = currentOpening - prevClosing;
      
      // If the opening cash doesn't match the previous shift's closing cash, flag it
      if (Math.abs(handoverVariance) > 1) { // Allow Rp 1 tolerance for rounding
        cashHandoverWarning = {
          previous_closing_cash: prevClosing,
          opening_cash: currentOpening,
          variance: handoverVariance,
          previous_shift_id: previousShift.id,
          message: `Cash handover mismatch: previous shift closed with ${prevClosing.toLocaleString('id-ID')}, but this shift opens with ${currentOpening.toLocaleString('id-ID')}. Variance: ${handoverVariance > 0 ? '+' : ''}${handoverVariance.toLocaleString('id-ID')}. Please verify and provide clarification.`,
        };

        // Log audit event for the mismatch
        if (user_id) {
          await this.auditService.log({
            tenant_id: ctx.tenant_id,
            user_id,
            module: "retail",
            action: "CASH_HANDOVER_MISMATCH",
            entity_type: "SHIFT",
            entity_id: previousShift.id,
            metadata: {
              previous_closing_cash: prevClosing,
              opening_cash: currentOpening,
              variance: handoverVariance,
              store_id: data.store_id,
            },
          });
        }
      }
    }

    const shift = await this.retailRepository.openShift(
      ctx,
      location_id,
      resolvedEmployeeId,
      data,
      resolvedEmployeeId, // Track who opened it (physical operator)
    );

    if (user_id) {
      await this.auditService.log({
        tenant_id: ctx.tenant_id,
        user_id,
        module: "retail",
        action: "OPEN_SHIFT",
        entity_type: "SHIFT",
        entity_id: shift.id,
        metadata: { opening_cash: data.opening_cash, store_id: data.store_id },
      });
    }

    // Return shift with optional cash handover warning
    if (cashHandoverWarning) {
      return { ...shift, cash_handover_warning: cashHandoverWarning };
    }
    return shift;
  }

  async closeShift(ctx: TenantContext,
    shift_id: string,
    data: CloseShiftDto,
    user_id: string,
  ): Promise<RetailShift> {
    const closed_by_id = await this.resolveEmployeeId(ctx, user_id);

    const shift = await this.retailRepository.closeShift(
      ctx,
      shift_id,
      data,
      closed_by_id,
    );

    // Phase 1: Variance Alerting logic
    const expected = new Prisma.Decimal(String(shift.expected_cash || 0));
    const actual = new Prisma.Decimal(String(data.counted_cash ?? data.closing_cash));
    const variance = actual.minus(expected);
    
    if (variance.abs().gt(0.01)) {
        // Raise Audit Alert
        await this.auditService.log({
            tenant_id: ctx.tenant_id,
            user_id,
            module: "retail",
            action: "SHIFT_VARIANCE_DETECTED",
            entity_type: "SHIFT",
            entity_id: shift_id,
            metadata: { 
                expected: expected, 
                counted: actual, 
                variance: variance,
                notes: data.notes 
            },
        });

        // Trigger Event for downstream monitoring/notifications
        await this.eventBus.publish({
            event_type: 'RETAIL_SHIFT_VARIANCE',
            tenant_id: ctx.tenant_id,
            entity_id: shift_id,
            entity_type: 'SHIFT',
            source_module: 'retail',
            payload: { shift_id, variance, expected: expected },
            user_id
        });
    }

    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "retail",
      action: "CLOSE_SHIFT",
      entity_type: "SHIFT",
      entity_id: shift_id,
      metadata: { closing_cash: data.closing_cash, variance },
    });
    return shift;
  }

  async recordCashMovement(
    ctx: TenantContext,
    shift_id: string,
    data: {
      amount: number;
      type: "CASH_OUT" | "CASH_IN";
      reason?: string;
      notes?: string;
    },
    user_id: string,
  ) {
    const shift = await this.retailRepository.getShift(ctx, shift_id);
    if (!shift || shift.status !== "open") {
      throw new BadRequestException("Cannot record movement for a closed or missing shift");
    }

    const movement = await this.retailRepository.createCashMovement(ctx, {
      shift_id,
      store_id: shift.store_id,
      employee_id: shift.employee_id,
      amount: data.amount,
      type: data.type,
      reason: data.reason,
      notes: data.notes,
    });

    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "retail",
      action: "CASH_MOVEMENT",
      entity_type: "SHIFT",
      entity_id: shift_id,
      metadata: { amount: data.amount, type: data.type, reason: data.reason },
    });

    return movement;
  }

  async listShifts(ctx: TenantContext, store_id?: string, employee_id?: string): Promise<RetailShift[]> {
    return this.retailRepository.listShifts(ctx, store_id, employee_id);
  }

  async reconcileShift(ctx: TenantContext,
    shift_id: string,
    data: ReconcileShiftDto,
    user_id: string,
  ): Promise<RetailShift> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch shift
      const shift = await tx.retail_shifts.findFirst({
        where: { id: shift_id, tenant_id: ctx.tenant_id},
        include: { stores: true },
      });

      if (!shift) throw new NotFoundException("Shift not found");
      if (shift.status !== "closed") {
        throw new Error("Shift must be closed before reconciliation");
      }

      const expected = new Prisma.Decimal(String(shift.expected_cash || 0));
      const actual = new Prisma.Decimal(String(data.actual_amount));
      const variance = actual.minus(expected);
      const shiftData = shift as any;
      const location_id = shiftData.location_id || shiftData.stores?.location_id || "loc-central";

      // 2. Finance Posting (Location-Aware)
      if (variance.abs().gt(0.0001)) {
        await this.financeRepository.createJournal(
          ctx,
          {
            ref: `RECON-${shift_id.slice(-6).toUpperCase()}`,
            description: `Shift Recon: ${data.reason}`,
            lines: [
              {
                accountCode: "1001", // Cash
                debit: variance.gt(0) ? variance.abs().toNumber() : 0,
                credit: variance.lt(0) ? variance.abs().toNumber() : 0,
                description: `Cash Variance: ${data.reason}`,
                location_id, // Location Awareness
              },
              {
                accountCode: "6999", // Over/Short
                debit: variance.lt(0) ? variance.abs().toNumber() : 0,
                credit: variance.gt(0) ? variance.abs().toNumber() : 0,
                description: `Shift Variance Correction`,
                location_id, // Location Awareness
              },
            ],
          },
          tx,
        );
      }

      // 3. Update Retail State
      const updated = await this.retailRepository.reconcileShift(
        ctx,
        shift_id,
        {
          actual_cash: new Prisma.Decimal(actual),
          variance: new Prisma.Decimal(variance),
          reason: data.reason,
        },
        tx,
      );

      // 4. Audit
      await this.auditService.log({
        tenant_id: ctx.tenant_id,
        user_id,
        module: "retail",
        action: "RECONCILE_SHIFT",
        entity_type: "SHIFT",
        entity_id: shift_id,
        metadata: {
          actual,
          expected,
          variance,
          reason: data.reason,
          location_id,
        },
      });

      return updated;
    });
  }

  // Promotions
  async listPromotions(ctx: TenantContext): Promise<any[]> {
    return this.retailRepository.listPromotions(ctx);
  }

  async updatePromotion(ctx: TenantContext,
    promotionId: string,
    data: any,
    user_id: string,
  ): Promise<any> {
    const promo = await this.retailRepository.updatePromotion(
      ctx,
      promotionId,
      data,
    );
    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "retail",
      action: "UPDATE",
      entity_type: "PROMOTION",
      entity_id: promotionId,
      metadata: { changes: data },
    });
    return promo;
  }

  // Channels
  async listChannels(ctx: TenantContext): Promise<any[]> {
    return this.retailRepository.listChannels(ctx);
  }

  async createChannel(ctx: TenantContext,
    data: any,
    user_id: string,
  ): Promise<any> {
    const shouldProvision =
      typeof data?.provisionCredentials === "boolean"
        ? data.provisionCredentials
        : data?.type === "OWNED";

    let clientId: string | undefined = data?.credentials?.clientId;
    let clientSecret: string | undefined = data?.credentials?.clientSecret;

    if (shouldProvision && (!clientId || !clientSecret)) {
      clientId = this.generateClientId();
      clientSecret = this.generateClientSecret();
    }

    const payload = {
      ...data,
      credentials:
        clientId && clientSecret
          ? { clientId, clientSecret }
          : data?.credentials,
    };

    const channel = await this.retailRepository.createChannel(
      ctx,
      payload,
    );

    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "retail",
      action: "CREATE",
      entity_type: "CHANNEL",
      entity_id: channel.id,
      metadata: { name: channel.name, type: channel.type },
    });

    return {
      ...channel,
      ...(clientId ? { clientId } : {}),
      ...(clientSecret ? { clientSecret } : {}),
    };
  }

  async updateChannel(ctx: TenantContext,
    channelId: string,
    data: any,
    user_id: string,
  ): Promise<any> {
    const channel = await this.retailRepository.updateChannel(
      ctx,
      channelId,
      data,
    );
    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "retail",
      action: "UPDATE",
      entity_type: "CHANNEL",
      entity_id: channelId,
      metadata: { changes: data },
    });
    return channel;
  }

  async deleteChannel(ctx: TenantContext,
    channelId: string,
    user_id: string,
  ): Promise<{ success: boolean }> {
    const result = await this.retailRepository.deleteChannel(
      ctx,
      channelId,
    );
    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "retail",
      action: "DELETE",
      entity_type: "CHANNEL",
      entity_id: channelId,
    });
    return result;
  }

  async syncChannel(ctx: TenantContext,
    channelId: string,
    user_id: string,
  ): Promise<{ success: boolean }> {
    const result = await this.retailRepository.syncChannel(ctx, channelId);
    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "retail",
      action: "SYNC",
      entity_type: "CHANNEL",
      entity_id: channelId,
    });
    return result;
  }

  async getChannelById(ctx: TenantContext,
    channelId: string,
  ): Promise<any | null> {
    return this.retailRepository.getChannelById(ctx, channelId);
  }

  async rotateChannelCredentials(ctx: TenantContext,
    channelId: string,
    user_id: string,
  ): Promise<{ clientId: string; clientSecret: string }> {
    const channel = await this.retailRepository.getChannelById(
      ctx,
      channelId,
    );
    if (!channel) {
      throw new NotFoundException("Channel not found");
    }

    const existingCredentials = channel.credentials as {
      clientId?: string;
      branch_id?: string;
      gatewayUrl?: string;
      connector?: string;
    } | null;
    const clientId = existingCredentials?.clientId ?? this.generateClientId();
    const clientSecret = this.generateClientSecret();
    const credentialsPayload = {
      clientId,
      clientSecret,
      clientSecretHash: this.hashSecret(clientSecret),
      branch_id: existingCredentials?.branch_id,
      gatewayUrl: existingCredentials?.gatewayUrl,
      connector: existingCredentials?.connector,
      lastRotated: new Date().toISOString(),
      revoked: false,
    };

    await this.retailRepository.updateChannelCredentials(
      ctx,
      channelId,
      credentialsPayload,
    );

    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "retail",
      action: "ROTATE_CREDENTIALS",
      entity_type: "CHANNEL",
      entity_id: channelId,
    });

    return { clientId, clientSecret };
  }

  async revokeChannelCredentials(ctx: TenantContext,
    channelId: string,
    user_id: string,
  ): Promise<{ clientId: string }> {
    const channel = await this.retailRepository.getChannelById(
      ctx,
      channelId,
    );
    if (!channel) {
      throw new NotFoundException("Channel not found");
    }

    const existingCredentials = channel.credentials as {
      clientId?: string;
      clientSecret?: string;
      clientSecretHash?: string;
      branch_id?: string;
      gatewayUrl?: string;
      connector?: string;
    } | null;
    if (!existingCredentials?.clientId) {
      throw new NotFoundException("Channel credentials are missing");
    }

    const credentialsPayload = {
      clientId: existingCredentials.clientId,
      clientSecret: existingCredentials.clientSecret,
      clientSecretHash: existingCredentials.clientSecretHash ?? "",
      branch_id: existingCredentials.branch_id,
      gatewayUrl: existingCredentials.gatewayUrl,
      connector: existingCredentials.connector,
      revoked: true,
      revoked_at: new Date().toISOString(),
    };

    await this.retailRepository.updateChannelCredentials(
      ctx,
      channelId,
      credentialsPayload,
    );

    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "retail",
      action: "REVOKE_CREDENTIALS",
      entity_type: "CHANNEL",
      entity_id: channelId,
    });

    return { clientId: existingCredentials.clientId };
  }

  private generateClientId() {
    return `znx_${randomBytes(4).toString("hex")}`;
  }

  private generateClientSecret() {
    return `sk_test_${randomBytes(8).toString("hex")}`;
  }

  private hashSecret(secret: string) {
    return createHash("sha256").update(secret).digest("hex");
  }

  async findChannelByClientId(ctx: TenantContext,
    clientId: string,
  ): Promise<any | null> {
    return this.retailRepository.findChannelByClientId(ctx, clientId);
  }

  // Devices
  async listDevices(ctx: TenantContext, store_id?: string): Promise<any[]> {
    return this.retailRepository.listDevices(ctx, store_id);
  }

  async registerDevice(ctx: TenantContext,
    location_id: string,
    data: RegisterBranchDeviceDto,
    user_id: string,
  ): Promise<any> {
    const device = await this.retailRepository.registerDevice(
      ctx,
      location_id,
      data,
    );
    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "it",
      action: "REGISTER",
      entity_type: "DEVICE",
      entity_id: device.id,
      metadata: { name: device.name, type: device.type },
    });
    return device;
  }

  async listCCTVs(ctx: TenantContext, store_id?: string): Promise<any[]> {
    return this.retailRepository.listCCTVs(ctx, store_id);
  }

  async validateCCTVConnection(ctx: TenantContext,
    location_id: string,
    data: Partial<RegisterCCTVCameraDto>,
  ): Promise<{ success: boolean; message?: string }> {
    return this.retailRepository.validateCCTVConnection(
      ctx,
      location_id,
      data,
    );
  }

  async registerCCTV(ctx: TenantContext,
    location_id: string,
    data: RegisterCCTVCameraDto,
    user_id: string,
  ): Promise<any> {
    const camera = await this.retailRepository.registerCCTV(
      ctx,
      location_id,
      data,
    );
    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "it",
      action: "REGISTER",
      entity_type: "CCTV",
      entity_id: camera.id,
      metadata: { name: camera.name, provider: camera.provider },
    });
    return camera;
  }

  async listSensors(ctx: TenantContext, store_id?: string): Promise<any[]> {
    return this.retailRepository.listSensors(ctx, store_id);
  }

  async registerSensor(ctx: TenantContext,
    location_id: string,
    data: RegisterBranchSensorDto,
    user_id: string,
  ): Promise<any> {
    const sensor = await this.retailRepository.registerSensor(
      ctx,
      location_id,
      data,
    );
    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "it",
      action: "REGISTER",
      entity_type: "SENSOR",
      entity_id: sensor.id,
      metadata: { name: sensor.name, type: sensor.type },
    });
    return sensor;
  }

  async pingDevice(ctx: TenantContext,
    device_id: string,
  ): Promise<{ success: boolean }> {
    return this.retailRepository.pingDevice(ctx, device_id);
  }

  async scanDevices(ctx: TenantContext, location_id: string): Promise<any[]> {
    return this.retailRepository.scanDevices(ctx, location_id);
  }

  async commitScannedDevice(ctx: TenantContext,
    location_id: string,
    discoveryId: string,
    user_id: string,
  ): Promise<any> {
    const device = await this.retailRepository.commitScannedDevice(
      ctx,
      location_id,
      discoveryId,
    );
    if (device) {
      await this.auditService.log({
        tenant_id: ctx.tenant_id,
        user_id,
        module: "it",
        action: "REGISTER",
        entity_type: "DEVICE",
        entity_id: device.id,
        metadata: {
          name: device.name,
          type: device.type,
          method: "discovery_commit",
        },
      });
    }
    return device;
  }

  // Payments & Returns
  async processPayment(ctx: TenantContext,
    order_id: string,
    data: { amount: Prisma.Decimal; method: string; shift_id?: string },
    user_id: string,
  ): Promise<any> {
    const order = await this.retailRepository.getOrder(ctx, order_id);
    if (!order) throw new NotFoundException("Order not found");

    // ATOMIC CHECKOUT TRANSACTION
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Atomic Stock Deduction for each item
      const movements = [];
      for (const item of order.items) {
        const move = await this.inventoryService.consumeStock(
          ctx,
          {
            item_id: item.product_id,
            location_id: (order as any).location_id || "default",
            quantity: Number(item.quantity),
            reference_id: order_id,
            reference_type: "POS_SALE",
            performed_by: user_id,
          },
          user_id,
          tx,
        );
        movements.push(move);
      }

      // 2. Create Payment Record
      await tx.payment_transactions.create({
        data: {
          id: uuidv4(),
          tenant_id: ctx.tenant_id,
          type: "RETAIL_SALE",
          amount: data.amount,
          currency: "IDR",
          destination: "STORE_CASHIER",
          status: "PAID",
          channel: data.method,
          source: order.id,
          idempotency_key: `PAY-${order.id}`,
          created_by: user_id,
        },
      });

      // 3. Create Financial Journal Entry
      await this.financeRepository.createJournal(
        ctx,
        {
          ref: order.id,
          description: `POS Sale - Order ${order.id}`,
          lines: [
            {
              accountCode: "1001", // Cash/Bank
              debit: data.amount,
              credit: 0,
              description: `POS Payment - ${data.method}`,
            },
            {
              accountCode: "4000", // Sales Revenue
              debit: 0,
              credit: order.grand_total,
              description: `POS Sale Revenue`,
            },
          ],
        },
        tx,
      );

      // 4. Update Order Status
      const updatedOrder = await tx.retail_orders.update({
        where: { id: order_id },
        data: { status: "paid" },
      });

      // 4.5 Update Shift Expected Cash if cash payment
      if (data.method?.toLowerCase() === "cash") {
        const shiftId = data.shift_id || order.shift_id;
        if (shiftId) {
          await tx.retail_shifts.update({
            where: { id: shiftId },
            data: {
              expected_cash: { increment: data.amount }
            }
          });
        }
      }

      return { success: true, movements, order: updatedOrder };
    });

    // 5. Post-transaction tasks (Events, Audits)
    await this.eventBus.publish({
      event_type: "RETAIL_SALE_COMPLETED",
      tenant_id: ctx.tenant_id,
      entity_id: order_id,
      entity_type: "ORDER",
      source_module: "retail",
      payload: {
        order_id,
        location_id: result.movements[0]?.location_id || "default",
        movements: result.movements,
        amount: data.amount,
        method: data.method,
      },
      user_id,
    });

    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "retail",
      action: "PAYMENT_COMPLETE",
      entity_type: "ORDER",
      entity_id: order_id,
      metadata: {
        total: order.grand_total,
        payment_method: data.method,
        movementsCount: result.movements.length,
      },
    });

    return result;
  }

  async processReturn(ctx: TenantContext,
    order_id: string,
    data: { 
        itemIds: string[]; 
        shift_id?: string;
        conditions?: Array<{ productId: string; condition: 'good' | 'damaged_repairable' | 'damaged_unrepairable'; notes?: string }> 
    },
    user_id: string,
  ): Promise<{ success: boolean }> {
    return await this.prisma.$transaction(async (tx) => {
        // 1. Get Order Details with items
        const order = await tx.retail_orders.findUnique({
            where: { id: order_id, tenant_id: ctx.tenant_id },
            include: { retail_order_items: true, stores: true }
        });
        if (!order) throw new NotFoundException("Order not found");

        const location_id = order.stores?.location_id || 'default_loc';

        // 2. Filter items and check idempotency (delegated to repository for flag updates)
        // Note: Repository.processReturn handles the flag and basic checks
        await this.retailRepository.processReturn(ctx, order_id, data, tx);

        let totalRefundAmount = new Prisma.Decimal(0);
        let totalTaxReversal = new Prisma.Decimal(0);
        let totalCogsReversal = new Prisma.Decimal(0);

        // 3. Process Stock and Calculate Financials
        for (const itemId of data.itemIds) {
            const item = order.retail_order_items.find(i => i.id === itemId);
            if (!item) continue;

            const conditionData = data.conditions?.find(c => c.productId === item.product_id) || { condition: 'good' as const, notes: 'No notes provided' };
            const q = new Prisma.Decimal(String(item.quantity));
            const up = new Prisma.Decimal(String(item.unit_price));
            const unitCost = new Prisma.Decimal(String(item.unit_cost || 0));

            const orderTotal = new Prisma.Decimal(String(order.total_amount));
            const orderTax = new Prisma.Decimal(String(order.tax));
            const taxRatio = orderTotal.gt(0) ? orderTax.div(orderTotal) : new Prisma.Decimal(0);
            const itemTax = up.mul(q).mul(taxRatio);

            totalRefundAmount = totalRefundAmount.add(up.mul(q));
            totalTaxReversal = totalTaxReversal.add(itemTax);
            totalCogsReversal = totalCogsReversal.add(unitCost.mul(q));

            // 4. Restore Inventory via InventoryService (Standardized way)
            // This ensures movement logs and condition routing are applied correctly
            await this.inventoryService.intakeStock(ctx, {
                item_id: item.product_id,
                location_id: location_id,
                quantity: q.toNumber(),
                unit_cost: unitCost.toNumber(),
                reason: `RETURN: ${conditionData.condition}`,
                reference_type: 'RETAIL_ORDER',
                reference_id: order_id,
                created_by: user_id
            }, user_id, tx);

            // 5. Emit Enhanced Condition Events
            if (conditionData.condition === 'damaged_repairable') {
                await this.eventBus.publish({
                    event_type: 'INVENTORY_REPAIR_NEEDED',
                    tenant_id: ctx.tenant_id,
                    entity_id: item.product_id,
                    entity_type: 'PRODUCT',
                    source_module: 'retail',
                    payload: { order_id, notes: conditionData.notes },
                    user_id
                });
            } else if (conditionData.condition === 'damaged_unrepairable') {
                await this.eventBus.publish({
                    event_type: 'INVENTORY_WASTE_DETECTED',
                    tenant_id: ctx.tenant_id,
                    entity_id: item.product_id,
                    entity_type: 'PRODUCT',
                    source_module: 'retail',
                    payload: { order_id, notes: conditionData.notes },
                    user_id
                });
            }
        }

        // 6. Create Journal Entries (The 6-Line Reversal)
        // Revenue Reversal (Debit Returns, Debit Tax, Credit Cash/AR)
        await this.financeRepository.createJournal(ctx, {
            sourceEventId: `RET-${order_id}-${Date.now()}`,
            referenceType: 'RETAIL_RETURN',
            referenceId: order_id,
            description: `Return Reversal for Order ${order.id}`,
            lines: [
                { accountId: '4100-SALES-RETURNS', debit: totalRefundAmount, credit: 0 },
                { accountId: '2100-TAX-PAYABLE', debit: totalTaxReversal, credit: 0 },
                { accountId: '1010-CASH-ON-HAND', debit: 0, credit: totalRefundAmount.add(totalTaxReversal) },
                // COGS/Inventory Reversal (Debit Inventory, Credit COGS)
                { accountId: '1300-INVENTORY', debit: totalCogsReversal, credit: 0 },
                { accountId: '5100-COGS', debit: 0, credit: totalCogsReversal }
            ]
        }, tx);

        // 6.5 Update Shift Expected Cash if it was a cash sale
        if (order.payment_method?.toLowerCase() === "cash") {
            const shiftId = data.shift_id || order.shift_id;
            // employee_id FKs to employees.id — resolve from the auth user_id (fall back to
            // the order's cashier). Passing the raw user_id caused a FK violation -> 500.
            const refundEmployeeId =
                (await tx.employees.findFirst({ where: { user_id, tenant_id: ctx.tenant_id }, select: { id: true } }))?.id
                ?? order.cashier_id;
            if (shiftId && refundEmployeeId) {
                const refundTotal = totalRefundAmount.add(totalTaxReversal);
                await tx.retail_shifts.update({
                    where: { id: shiftId },
                    data: {
                        expected_cash: { decrement: refundTotal }
                    }
                });

                // Audit Cash Movement
                await tx.retail_cash_movements.create({
                    data: {
                        tenant_id: ctx.tenant_id,
                        store_id: order.store_id,
                        shift_id: shiftId,
                        employee_id: refundEmployeeId,
                        amount: refundTotal,
                        type: "CASH_OUT",
                        reason: `RETURN_REFUND: ${order_id}`,
                        notes: `Refund for order ${order.id}`
                    }
                });
            }
        }

        // 7. Audit Log
        await this.auditService.log({
            tenant_id: ctx.tenant_id,
            user_id,
            module: "retail",
            action: "RETURN_COMPLETE",
            entity_type: "ORDER",
            entity_id: order_id,
            metadata: { 
                refundedItems: data.itemIds.length, 
                refundTotal: totalRefundAmount,
                taxReversed: totalTaxReversal,
                cogsReversed: totalCogsReversal
            },
        });

        return { success: true };
    });
  }

  // Inventory Operations
  async submitOpname(ctx: TenantContext,
    data: { store_id: string; adjustments: any[]; shift_id?: string },
    user_id: string,
  ): Promise<{ success: boolean }> {
    console.log(`[RETAIL_SERVICE] Starting Opname Submission for store ${data.store_id} (User: ${user_id})`);
    console.log(`[RETAIL_SERVICE] Adjustment count: ${data.adjustments.length}`);

    // 1. Emit Opname Event (adjustments handled by listener)
    await this.eventBus.publish({
      event_type: "RETAIL_OPNAME_SUBMITTED",
      tenant_id: ctx.tenant_id,
      entity_id: data.store_id,
      entity_type: "STORE",
      source_module: "retail",
      payload: {
        store_id: data.store_id,
        adjustments: data.adjustments.filter((adj) => adj.variance !== 0),
        sessionId: data.shift_id || "SESSION",
      },
      user_id,
    });

    // 2. Call Repository
    console.log(`[RETAIL_SERVICE] Calling Repository submitOpname...`);
    try {
      const result = await this.retailRepository.submitOpname(ctx, data);
      console.log(`[RETAIL_SERVICE] Repository submitOpname result:`, result);

      // 3. Audit Log
      await this.auditService.log({
        tenant_id: ctx.tenant_id,
        user_id,
        module: "retail",
        action: "STOCK_OPNAME",
        entity_type: "STORE",
        entity_id: data.store_id,
        metadata: { adjustmentCount: data.adjustments.length },
      });

      return result;
    } catch (error) {
      console.error(`[RETAIL_SERVICE] Error in submitOpname:`, error);
      throw error;
    }
  }

  async receiveGoods(ctx: TenantContext,
    data: {
      store_id: string;
      shipment_id: string;
      items: any[];
      shift_id?: string;
    },
    user_id: string,
  ): Promise<{ success: boolean }> {
    // 1. Emit Goods Receipt Event to trigger Inventory Intake
    await this.eventBus.publish({
      event_type: "RETAIL_GOODS_RECEIVED",
      tenant_id: ctx.tenant_id,
      entity_id: data.shipment_id,
      entity_type: "SHIPMENT",
      source_module: "retail",
      payload: {
        store_id: data.store_id,
        shipment_id: data.shipment_id,
        items: data.items,
      },
      user_id,
    });

    // 2. Call Repository
    const result = await this.retailRepository.receiveGoods(ctx, data);

    // 3. Audit Log
    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "retail",
      action: "STOCK_INTAKE",
      entity_type: "SHIPMENT",
      entity_id: data.shipment_id,
      metadata: { itemCount: data.items.length },
    });

    return result;
  }

  async syncInventory(
    ctx: TenantContext,
    data: { store_id?: string },
    user_id: string,
  ): Promise<{ success: boolean; syncedAt: string; store_id?: string }> {
    const syncedAt = new Date().toISOString();

    // 1. Emit a sync event so downstream listeners (ERP reconciliation, stock projection)
    //    can refresh stock levels for the store.
    await this.eventBus.publish({
      event_type: "RETAIL_INVENTORY_SYNC_REQUESTED",
      tenant_id: ctx.tenant_id,
      entity_id: data.store_id || ctx.tenant_id,
      entity_type: "STORE",
      source_module: "retail",
      payload: {
        store_id: data.store_id,
        requested_at: syncedAt,
      },
      user_id,
    });

    // 2. Audit Log so the sync action is persisted and traceable.
    await this.auditService.log({
      tenant_id: ctx.tenant_id,
      user_id,
      module: "retail",
      action: "INVENTORY_SYNC",
      entity_type: "STORE",
      entity_id: data.store_id || ctx.tenant_id,
      metadata: { syncedAt },
    });

    return { success: true, syncedAt, store_id: data.store_id };
  }

  // --- Public Gateway (Customer, Cart, Wishlist) ---

  async findCustomerByEmail(ctx: TenantContext, email: string) {
    return this.retailRepository.findCustomerByEmail(ctx, email);
  }

  async findCustomerById(ctx: TenantContext, customer_id: string) {
    return this.retailRepository.getCustomerById(ctx, customer_id);
  }

  async createCustomer(ctx: TenantContext, data: any, user_id?: string) {
    const customer = await this.retailRepository.createCustomer(ctx, data);
    if (user_id) {
      await this.auditService.log({ tenant_id: ctx.tenant_id ,
        user_id,
        module: "retail",
        action: "CREATE",
        entity_type: "CUSTOMER",
        entity_id: customer.id,
        metadata: { name: customer.name, email: customer.email },
      });
    }
    return customer;
  }

  async updateCustomer(ctx: TenantContext,
    customer_id: string,
    data: any,
    user_id?: string,
  ) {
    const customer = await this.retailRepository.updateCustomer(
      ctx,
      customer_id,
      data,
    );
    if (user_id) {
      await this.auditService.log({
        tenant_id: ctx.tenant_id,
        user_id,
        module: "retail",
        action: "UPDATE",
        entity_type: "CUSTOMER",
        entity_id: customer_id,
        metadata: { changes: data },
      });
    }
    return customer;
  }

  async createCustomerSession(ctx: TenantContext, data: any) {
    return this.retailRepository.createCustomerSession(ctx, data);
  }

  async findCustomerSession(ctx: TenantContext, tokenHash: string) {
    return this.retailRepository.findCustomerSession(ctx, tokenHash);
  }

  async revokeCustomerSession(ctx: TenantContext, tokenHash: string) {
    return this.retailRepository.revokeCustomerSession(ctx, tokenHash);
  }

  async getCart(ctx: TenantContext, customer_id: string) {
    return this.retailRepository.getCart(ctx, customer_id);
  }

  async createCart(ctx: TenantContext, customer_id: string) {
    return this.retailRepository.createCart(ctx, customer_id);
  }

  async updateCartItem(ctx: TenantContext,
    cartId: string,
    product_id: string,
    data: { quantity: Prisma.Decimal; unit_price: Prisma.Decimal },
  ) {
    return this.retailRepository.updateCartItem(
      ctx,
      cartId,
      product_id,
      data,
    );
  }

  async removeCartItem(ctx: TenantContext, cartId: string, item_id: string) {
    return this.retailRepository.removeCartItem(ctx, cartId, item_id);
  }

  async clearCart(ctx: TenantContext, cartId: string) {
    return this.retailRepository.clearCart(ctx, cartId);
  }

  async getWishlist(ctx: TenantContext, customer_id: string) {
    return this.retailRepository.getWishlist(ctx, customer_id);
  }

  async upsertWishlist(ctx: TenantContext, customer_id: string) {
    return this.retailRepository.upsertWishlist(ctx, customer_id);
  }

  async addWishlistItem(ctx: TenantContext,
    wishlistId: string,
    product_id: string,
  ) {
    return this.retailRepository.addWishlistItem(
      ctx,
      wishlistId,
      product_id,
    );
  }

  async removeWishlistItem(ctx: TenantContext,
    wishlistId: string,
    item_id: string,
  ) {
    return this.retailRepository.removeWishlistItem(
      ctx,
      wishlistId,
      item_id,
    );
  }

  async getOrder(ctx: TenantContext, order_id: string): Promise<RetailOrder | null> {
    return this.retailRepository.getOrder(ctx, order_id);
  }

  async getShift(ctx: TenantContext, shift_id: string): Promise<RetailShift | null> {
    return this.retailRepository.getShift(ctx, shift_id);
  }

  async getCustomerById(ctx: TenantContext, id: string) {
    return this.retailRepository.getCustomerById(ctx, id);
  }

  async getCustomerByPhone(ctx: TenantContext, phone: string) {
    return this.retailRepository.getCustomerByPhone(ctx, phone);
  }

  async logEvent(ctx: TenantContext, data: any) {
    return this.retailRepository.logEvent(ctx, data);
  }

  async printOrder(ctx: TenantContext, order_id: string): Promise<Buffer> {
    const order = await this.retailRepository.getOrder(ctx, order_id);
    if (!order) throw new NotFoundException("Order not found");

    const store = await this.retailRepository.getStore(ctx, order.store_id);
    
    return this.retailPrint.generateReceiptPayload({
      storeName: store?.name || "Zenvix Retail",
      address: store?.address || "Digital Store", 
      orderNumber: order.id.slice(0, 8).toUpperCase(),
      date: new Date(order.created_at),
      items: order.items.map(item => ({
        name: item.name,
        quantity: Number(item.quantity),
        price: Number(item.unit_price),
        total: Number(item.total_price)
      })),
      tax: Number(order.tax_total),
      total: Number(order.grand_total),
      paymentMethod: order.payment_method || "CASH"
    });
  }

  private async resolveEmployeeId(ctx: TenantContext, userId: string): Promise<string> {
    const employee = await this.prisma.employees.findFirst({
      where: { user_id: userId, tenant_id: ctx.tenant_id }
    });

    if (employee) return employee.id;

    // Auto-create employee record for authenticated users to allow retail operations (Audit Integrity)
    const userRecord = await this.prisma.users.findUnique({ where: { id: userId } });
    const dept = await this.prisma.departments.findFirst({ where: { tenant_id: ctx.tenant_id } });
    
    // We need a location_id. Try to find the first store or use a default.
    const storeRecord = await this.prisma.stores.findFirst({ 
      where: { tenant_id: ctx.tenant_id } 
    });

    if (userRecord && dept && storeRecord) {
      const newEmp = await this.prisma.employees.create({
        data: {
          id: uuidv4(),
          tenant_id: ctx.tenant_id,
          user_id: userId,
          first_name: userRecord.first_name || "Retail",
          last_name: userRecord.last_name || "Operator",
          email: userRecord.email,
          employee_code: `EMP-${userId.slice(0, 8).toUpperCase()}`,
          department_id: dept.id,
          location_id: storeRecord.location_id,
          positions: "Operator",
          hire_date: new Date(),
          status: "active"
        }
      });
      return newEmp.id;
    }

    // Fallback to any existing employee if user/dept/store resolution fails
    const fallback = await this.prisma.employees.findFirst({
      where: { tenant_id: ctx.tenant_id }
    });
    return fallback ? fallback.id : userId; // userId as last resort
  }
}
