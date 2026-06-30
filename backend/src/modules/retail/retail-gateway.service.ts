import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../persistence/prisma.service";
import { TenantContext } from "../../gateway/tenant-context.interface";
import { RetailService } from "./retail.service";
import {
  RetailPublicOrderRequestDto,
  CustomerRegisterDto,
  CustomerLoginDto,
  CustomerRefreshDto,
  CartItemDto,
  UpdateCartItemDto,
  WishlistItemDto,
} from "./dto/public-gateway.dto";
import { createHash, randomBytes, randomUUID } from "crypto";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { ChatService } from "../../shared/comms/chat.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  ORDER_ENTITY_TYPE,
  ORDER_EVENT_IMPLIED_STAGE,
  ORDER_STAGE_ACTION,
  ZenvixOrderStage,
  isValidStage,
  mapInternalStatusToStage,
} from "./order-lifecycle.constants";

const AUTH_JWT_SECRET =
  process.env.RETAIL_AUTH_JWT_SECRET ||
  process.env.JWT_SECRET ||
  "dev_retail_auth_secret";
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_DAYS = 30;

export interface PublicProductView {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock_levels: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  category: string;
  maxQuantity: number;
  images: string[];
  tags: string[];
  material: string | null;
  style: string | null;
}

@Injectable()
export class RetailGatewayService {
  constructor(
    private readonly retailService: RetailService,
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * For public/headless routes the TenantInterceptor fallback sets company_id =
   * tenant_id (a valid string but NOT a valid FK in the companies table). This
   * helper resolves the actual company record for the tenant so FK constraints
   * are satisfied when creating customer/order records.
   */
  private async resolveCompanyCtx(ctx: TenantContext): Promise<TenantContext> {
    if (ctx.company_id && ctx.company_id !== ctx.tenant_id) return ctx;
    const company = await this.prisma.companies.findFirst({
      where: { tenant_id: ctx.tenant_id },
      select: { id: true },
    });
    if (company) {
      return { ...ctx, company_id: company.id };
    }
    return ctx;
  }

  // --- Products ---

  async getProducts(
    ctx: TenantContext,
    clientId: string | undefined,
    clientSecret: string | undefined,
    pageSize = 200,
  ): Promise<{ products: PublicProductView[] }> {
    const channel = await this.authenticateChannel(ctx, clientId, clientSecret);
    
    // Check if channel has specific product selections configured
    const channelProducts = await this.prisma.retail_channel_products.findMany({
      where: { tenant_id: ctx.tenant_id, channel_id: channel.id, visible: true },
      include: { item_masters: true },
    });
    
    let products: any[];
    
    if (channelProducts.length > 0) {
      // Use channel-specific product list (from the Product Wizard)
      products = channelProducts.map((cp: any) => ({
        id: cp.item_masters.id,
        name: cp.item_masters.name,
        sku: cp.item_masters.sku,
        base_price: cp.item_masters.selling_price || cp.item_masters.base_price,
        category_id: cp.item_masters.category_id,
      }));
    } else {
      // Fallback: return all products from master inventory (no wizard config yet)
      const result = await this.retailService.listProducts(ctx, { page: 1, pageSize });
      products = result.items || result;
    }

    // Enrich with media/merchandising fields the storefront expects (images,
    // tags, material, style). listProducts()/mapProduct() drops these, so read
    // them straight from item_masters in a single query.
    const enrichment = await this.loadProductEnrichment(
      ctx,
      products.map((p: any) => p.id),
    );

    const mapped = await Promise.all(products.map(async (product: any) => {
      const stock = await this.retailService.getChannelStockStatus(ctx, channel.id, product.id);
      const extra = enrichment.get(product.id);
      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        price: Number(product.base_price),
        stock_levels: stock.status as any,
        category: product.category_id,
        maxQuantity: Number(stock.available),
        images: extra?.images ?? [],
        tags: extra?.tags ?? [],
        material: extra?.material ?? null,
        style: extra?.style ?? null,
      };
    }));

    return { products: mapped };
  }

  /**
   * Load merchandising fields (images, tags, material, style) for a set of
   * product ids directly from item_masters in one query.
   */
  private async loadProductEnrichment(
    ctx: TenantContext,
    productIds: string[],
  ): Promise<
    Map<string, { images: string[]; tags: string[]; material: string | null; style: string | null }>
  > {
    const map = new Map<
      string,
      { images: string[]; tags: string[]; material: string | null; style: string | null }
    >();
    const ids = Array.from(new Set(productIds.filter(Boolean)));
    if (ids.length === 0) return map;

    const masters = await this.prisma.item_masters.findMany({
      where: { tenant_id: ctx.tenant_id, id: { in: ids } },
      select: {
        id: true,
        image_url: true,
        module_tags: true,
        metadata: true,
        item_images: {
          select: { url: true, is_primary: true, order: true },
        },
      },
    });

    for (const m of masters) {
      const images = this.buildImageUrls(m);
      const meta = (m.metadata as any) ?? {};
      map.set(m.id, {
        images,
        tags: Array.isArray(m.module_tags) ? m.module_tags : [],
        material: meta.material ?? null,
        style: meta.style ?? null,
      });
    }
    return map;
  }

  /** Build an ordered image URL list (primary first), matching mapProduct's /api prefixing. */
  private buildImageUrls(master: {
    image_url?: string | null;
    item_images?: { url: string; is_primary: boolean; order: number }[];
  }): string[] {
    const prefix = (url: string) => (url.startsWith("/api") ? url : `/api${url}`);
    const imgs = [...(master.item_images ?? [])].sort((a, b) => {
      if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
      return (a.order ?? 0) - (b.order ?? 0);
    });
    if (imgs.length > 0) {
      return imgs.map((i) => prefix(i.url));
    }
    if (master.image_url) {
      return [`/api/v1/inventory/images/${master.image_url}`];
    }
    return [];
  }

  async getProductById(
    ctx: TenantContext,
    clientId: string | undefined,
    clientSecret: string | undefined,
    product_id: string,
  ): Promise<any> {
    const channel = await this.authenticateChannel(ctx, clientId, clientSecret);
    const { items: products } = await this.retailService.listProducts(
      ctx,
      { page: 1, pageSize: 200 },
    );
    const product = products.find((p) => p.id === product_id);
    if (!product) throw new NotFoundException("Product not found");

    const stock = await this.retailService.getChannelStockStatus(ctx, channel.id, product_id);

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      base_price: product.base_price,
      currency: product.currency,
      prices: product.prices,
      variants: product.variants,
      seo: product.seo,
      stock_levels: stock.status,
      maxQuantity: Number(stock.available),
    };
  }

  async getCategories(
    ctx: TenantContext,
    clientId: string | undefined,
    clientSecret: string | undefined,
  ): Promise<any[]> {
    await this.authenticateChannel(ctx, clientId, clientSecret);
    // Mocking tree structure since repository doesn't support it yet
    return [
      {
        id: "cat-1",
        name: "Electronics",
        slug: "electronics",
        children: [
          { id: "cat-1-1", name: "Laptops", slug: "laptops", children: [] },
          { id: "cat-1-2", name: "Phones", slug: "phones", children: [] },
        ],
      },
      {
        id: "cat-2",
        name: "Clothing",
        slug: "clothing",
        children: [],
      },
    ];
  }

  async getPromotions(
    ctx: TenantContext,
    clientId: string | undefined,
    clientSecret: string | undefined,
    category_id?: string,
  ): Promise<any[]> {
    await this.authenticateChannel(ctx, clientId, clientSecret);
    const promos = await this.retailService.listPromotions(ctx);
    return promos.map((p) => ({
      id: p.id,
      code: p.code || `PROMO-${p.id.slice(0, 4)}`,
      label: p.title || p.label,
      discountType: p.type === "percent" ? "PERCENT" : "FIXED",
      value: p.value,
      scope: p.target === "category" ? "CATEGORY" : "GLOBAL",
    }));
  }

  // --- Auth & Customer ---

  async registerCustomer(
    ctx: TenantContext,
    clientId: string,
    clientSecret: string,
    data: CustomerRegisterDto,
  ) {
    const scope = await this.authenticateChannel(
      ctx,
      clientId,
      clientSecret,
    );

    // Resolve real company_id for FK constraints
    const resolvedCtx = await this.resolveCompanyCtx(ctx);

    const existing = await this.retailService.findCustomerByEmail(
      resolvedCtx,
      data.email,
    );
    if (existing) {
      throw new ConflictException("Email already registered");
    }

    const password_hash = await bcrypt.hash(data.password, 10);
    const customer = await this.retailService.createCustomer(resolvedCtx, {
      name: data.name,
      email: data.email,
      phone: data.phone,
      password_hash,
      ecommerce_id: scope.id,
    });

    const tokens = await this.issueTokens(customer, scope, resolvedCtx);
    
    this.eventEmitter.emit('retail.customer.created', { ctx: resolvedCtx, customer });

    return {
      customer: this.mapToPublicCustomer(customer),
      ...tokens,
    };
  }

  async loginCustomer(
    ctx: TenantContext,
    clientId: string,
    clientSecret: string,
    data: CustomerLoginDto,
  ) {
    const scope = await this.authenticateChannel(
      ctx,
      clientId,
      clientSecret,
    );

    const resolvedCtx = await this.resolveCompanyCtx(ctx);

    const customer = await this.retailService.findCustomerByEmail(
      resolvedCtx,
      data.email,
    );
    const customerAuth = customer?.retail_customer_auth || customer?.auth;
    if (!customer || !customerAuth) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const isValid = await bcrypt.compare(
      data.password,
      customerAuth.password_hash,
    );
    if (!isValid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const tokens = await this.issueTokens(customer, scope, resolvedCtx);
    return {
      customer: this.mapToPublicCustomer(customer),
      ...tokens,
    };
  }

  async refreshTokens(
    ctx: TenantContext,
    clientId: string,
    clientSecret: string,
    data: CustomerRefreshDto,
  ) {
    const scope = await this.authenticateChannel(
      ctx,
      clientId,
      clientSecret,
    );

    const tokenHash = this.hashToken(data.refreshToken);
    const session = await this.retailService.findCustomerSession(
      ctx,
      tokenHash,
    );
    if (!session) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    const customer = await this.retailService.findCustomerById(
      ctx,
      session.customer_id,
    );
    if (!customer) {
      throw new UnauthorizedException("Customer not found");
    }

    // Revoke old session
    await this.retailService.revokeCustomerSession(ctx, tokenHash);

    const tokens = await this.issueTokens(customer, scope);
    return tokens;
  }

  async logoutCustomer(ctx: TenantContext, refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.retailService.revokeCustomerSession(ctx, tokenHash);
    return { success: true };
  }

  // --- Cart ---

  async getCart(ctx: TenantContext, customer_id: string) {
    const rCtx = await this.resolveCompanyCtx(ctx);
    let cart = await this.retailService.getCart(rCtx, customer_id);
    if (!cart) {
      await this.retailService.createCart(rCtx, customer_id);
      cart = await this.retailService.getCart(rCtx, customer_id);
    }
    return this.mapCartResponse(cart || { id: null, retail_cart_items: [] });
  }

  async addToCart(ctx: TenantContext, customer_id: string, data: CartItemDto) {
    const rCtx = await this.resolveCompanyCtx(ctx);
    let cart = await this.retailService.getCart(rCtx, customer_id);
    if (!cart) {
      cart = await this.retailService.createCart(rCtx, customer_id);
    }

    const { items: products } = await this.retailService.listProducts(
      rCtx,
      { page: 1, pageSize: 200 },
    );
    const product = products.find((p) => p.id === data.product_id);
    if (!product) throw new NotFoundException("Product not found");

    await this.retailService.updateCartItem(rCtx, cart.id, data.product_id, {
      quantity: new Prisma.Decimal(data.quantity),
      unit_price: new Prisma.Decimal(String(product.base_price)),
    });

    return this.getCart(rCtx, customer_id);
  }

  async updateCartItem(
    ctx: TenantContext,
    customer_id: string,
    item_id: string,
    data: UpdateCartItemDto,
  ) {
    const rCtx = await this.resolveCompanyCtx(ctx);
    const cart = await this.retailService.getCart(rCtx, customer_id);
    if (!cart) throw new NotFoundException("Cart not found");

    const item = cart.items.find((i: any) => i.id === item_id);
    if (!item) throw new NotFoundException("Item not found in cart");

    await this.retailService.updateCartItem(rCtx, cart.id, item.product_id, {
      quantity: new Prisma.Decimal(data.quantity),
      unit_price: new Prisma.Decimal(String(item.unit_price)),
    });

    return this.getCart(rCtx, customer_id);
  }

  async removeFromCart(ctx: TenantContext, customer_id: string, item_id: string) {
    const rCtx = await this.resolveCompanyCtx(ctx);
    const cart = await this.retailService.getCart(rCtx, customer_id);
    if (!cart) throw new NotFoundException("Cart not found");

    await this.retailService.removeCartItem(rCtx, cart.id, item_id);
    return this.getCart(rCtx, customer_id);
  }

  async clearCart(ctx: TenantContext, customer_id: string) {
    const rCtx = await this.resolveCompanyCtx(ctx);
    const cart = await this.retailService.getCart(rCtx, customer_id);
    if (!cart) return { success: true };

    await this.retailService.clearCart(rCtx, cart.id);
    return { success: true };
  }

  // --- Wishlist ---

  async getWishlist(ctx: TenantContext, customer_id: string) {
    const rCtx = await this.resolveCompanyCtx(ctx);
    let wishlist = await this.retailService.getWishlist(rCtx, customer_id);
    if (!wishlist) {
      await this.retailService.upsertWishlist(rCtx, customer_id);
      wishlist = await this.retailService.getWishlist(rCtx, customer_id);
    }
    return this.mapWishlistResponse(wishlist || { id: null, retail_wishlist_items: [] });
  }

  async addToWishlist(
    ctx: TenantContext,
    customer_id: string,
    data: WishlistItemDto,
  ) {
    const rCtx = await this.resolveCompanyCtx(ctx);
    let wishlist = await this.retailService.getWishlist(rCtx, customer_id);
    if (!wishlist) {
      wishlist = await this.retailService.upsertWishlist(rCtx, customer_id);
    }

    let product_id = data.product_id;
    if (!product_id && data.sku) {
      const { items: products } = await this.retailService.listProducts(
        rCtx,
        { page: 1, pageSize: 200 },
      );
      const product = products.find((p) => p.sku === data.sku);
      if (product) product_id = product.id;
    }

    if (!product_id) throw new NotFoundException("Product not found");

    await this.retailService.addWishlistItem(rCtx, wishlist.id, product_id);
    return this.getWishlist(rCtx, customer_id);
  }

  async removeFromWishlist(
    ctx: TenantContext,
    customer_id: string,
    item_id: string,
  ) {
    const rCtx = await this.resolveCompanyCtx(ctx);
    const wishlist = await this.retailService.getWishlist(rCtx, customer_id);
    if (!wishlist) throw new NotFoundException("Wishlist not found");

    await this.retailService.removeWishlistItem(rCtx, wishlist.id, item_id);
    return this.getWishlist(rCtx, customer_id);
  }

  // --- Orders ---

  async createOrder(
    ctx: TenantContext,
    clientId: string | undefined,
    clientSecret: string | undefined,
    payload: RetailPublicOrderRequestDto,
  ) {
    const channel = await this.authenticateChannel(ctx, clientId, clientSecret);
    const resolvedCtx = await this.resolveCompanyCtx(ctx);
    
    // Find a system employee to act as cashier for public orders
    const employees = await this.prisma.employees.findMany({
      where: { tenant_id: resolvedCtx.tenant_id },
      take: 1
    });
    console.log(`[Gateway] Found ${employees.length} employees for tenant ${resolvedCtx.tenant_id}`);
    const systemEmployee = employees.find((e: any) => e.first_name === 'System') || employees[0];
    const cashier_id = systemEmployee?.id || "";
    console.log(`[Gateway] Using cashier_id: ${cashier_id}`);

    // Find or create customer
    let customerId = null;
    if (payload.customer?.email) {
      const customer = await this.retailService.findCustomerByEmail(resolvedCtx, payload.customer.email);
      if (customer) {
        customerId = customer.id;
      } else {
        const newCust = await this.retailService.createCustomer(resolvedCtx, {
          email: payload.customer.email,
          name: payload.customer.name || payload.customer.email,
          ecommerce_id: channel.id,
        });
        customerId = newCust.id;
      }
    }

    const stores = await this.retailService.listStores(resolvedCtx);
    const store = stores[0];
    if (!store) {
      throw new NotFoundException(
        "No fulfillment store configured for this tenant.",
      );
    }

    const resolvedItems = await Promise.all(
      payload.items.map(async (item) => {
        // Optimization: Find by SKU directly instead of listing 200 products
        const product = await this.retailService.findProductBySku(
          resolvedCtx,
          item.sku,
        );
        if (!product) {
          throw new NotFoundException(`SKU not found: ${item.sku}`);
        }
        return {
          product_id: product.id,
          quantity: item.quantity,
          unit_price: String(product.base_price),
        };
      }),
    );

    const grand_total = resolvedItems.reduce(
      (sum: Prisma.Decimal, current) =>
        sum.add(
          new Prisma.Decimal(current.unit_price).mul(current.quantity),
        ),
      new Prisma.Decimal(0),
    );
    const payment_method = this.normalizePaymentMethod(payload.payment_method);

    const order = await this.retailService.createOrder(
      resolvedCtx,
      store.location_id,
      {
        store_id: store.id,
        terminal_id: "",
        customer_id: customerId,
        items: resolvedItems.map(i => ({ ...i, quantity: String(i.quantity) })),
        payment_method: payment_method,
        grand_total: grand_total.toString(),
      },
      cashier_id,
    );

    // Calculate tax via service
    const tax_amount = await this.retailService.calculateTax(resolvedCtx, order.id);

    if (payload.payment_status === "PAID") {
      // NOTE: In a production environment, this should be verified against a payment provider webhook.
      // We log this as an 'EXTERNAL_TRUSTED_PAYMENT' for audit visibility.
      await this.retailService.processPayment(
        resolvedCtx,
        order.id,
        {
          amount: (order.grand_total as unknown as Prisma.Decimal).add(tax_amount),
          method: payment_method,
        },
        clientId ?? "api-gateway",
      );
    }

    // Record the initial workflow stage so GET /orders/:id/status returns a
    // valid ZENVIX stage immediately, and capture the storefront correlation
    // ids (channel_record_id / external_reference) on the order audit trail.
    const initialStage: ZenvixOrderStage =
      payload.payment_status === "PAID" ? "PAYMENT_CONFIRMED" : "SUBMITTED";
    const channelRecordId = payload.channel_record_id ?? null;
    const externalReference =
      payload.external_reference ?? payload.externalReference ?? null;
    await this.writeOrderStageMarker(
      resolvedCtx,
      order.id,
      initialStage,
      "order.created",
      {
        channel_record_id: channelRecordId,
        external_reference: externalReference,
        payment_status: payload.payment_status,
      },
      {
        channel_record_id: channelRecordId,
        external_reference: externalReference,
        ecommerce_id: channel.id,
      },
    );

    return {
      order_id: order.id,
      status: order.status === "reserved" ? "RESERVED" : "RECEIVED",
      reservationTimeout: order.reservation_expires_at?.toISOString(),
      totals: {
        subtotal: Number(order.subtotal),
        tax: tax_amount,
        grand_total: Number(order.subtotal) + tax_amount,
      },
      estimatedDelivery: "3-5 Business Days",
      message: `Order ${order.status} from channel ${clientId ?? "headless-api"}.`,
    };
  }

  async findCustomerById(ctx: TenantContext, customer_id: string) {
    const customer = await this.retailService.findCustomerById(
      ctx,
      customer_id,
    );
    if (!customer) throw new NotFoundException("Customer not found");
    return this.mapToPublicCustomer(customer);
  }

  async getCustomerOrders(
    ctx: TenantContext,
    clientId: string | undefined,
    clientSecret: string | undefined,
    customer_id: string,
  ) {
    const channel = await this.authenticateChannel(ctx, clientId, clientSecret);
    const orders = await this.retailService.listOrders(ctx, {
      customer_id,
      ecommerce_id: channel.id,
    });

    return orders.map((o) => this.mapOrderResponse(o));
  }

  /**
   * POST /checkout — convert the customer's current cart into an order.
   * (Kept for storefront compatibility; the canonical order path is POST /orders.)
   */
  async checkout(
    ctx: TenantContext,
    customer_id: string,
    payload: {
      payment_status?: string;
      payment_method?: string;
    },
    ecommerceId?: string,
  ) {
    const rCtx = await this.resolveCompanyCtx(ctx);

    const cart = await this.retailService.getCart(rCtx, customer_id);
    const cartItems = (cart?.retail_cart_items || cart?.items || []) as any[];
    if (!cart || cartItems.length === 0) {
      throw new BadRequestException("Cart is empty");
    }

    const stores = await this.retailService.listStores(rCtx);
    const store = stores[0];
    if (!store) {
      throw new NotFoundException("No fulfillment store configured for this tenant.");
    }

    const orderItems = cartItems.map((item: any) => ({
      product_id: item.product_id,
      quantity: String(item.quantity),
      unit_price: String(item.unit_price),
    }));

    const subtotal = orderItems.reduce(
      (sum: number, item: any) =>
        sum + Number(item.unit_price) * Number(item.quantity),
      0,
    );

    const paymentStatus = String(payload?.payment_status ?? "PENDING");
    const paymentMethod = this.normalizePaymentMethod(payload?.payment_method);

    const order = await this.retailService.createOrder(
      rCtx,
      store.location_id,
      {
        store_id: store.id,
        terminal_id: "api-gateway",
        customer_id,
        items: orderItems,
        payment_method: paymentMethod,
        grand_total: String(subtotal),
      },
      customer_id,
    );

    if (paymentStatus === "PAID") {
      const tax = await this.retailService.calculateTax(rCtx, order.id);
      await this.retailService.processPayment(
        rCtx,
        order.id,
        {
          amount: (order.grand_total as unknown as Prisma.Decimal).add(tax),
          method: paymentMethod,
        },
        customer_id,
      );
    }

    await this.retailService.clearCart(rCtx, cart.id);

    const initialStage: ZenvixOrderStage =
      paymentStatus === "PAID" ? "PAYMENT_CONFIRMED" : "SUBMITTED";
    await this.writeOrderStageMarker(
      rCtx,
      order.id,
      initialStage,
      "checkout",
      { payment_status: paymentStatus },
      ecommerceId ? { ecommerce_id: ecommerceId } : {},
    );

    return {
      order_id: order.id,
      status: order.status === "reserved" ? "RESERVED" : "RECEIVED",
      totals: { subtotal: Number(order.subtotal ?? subtotal) },
    };
  }

  // --- Events ---

  async logEvent(
    ctx: TenantContext,
    clientId: string,
    clientSecret: string,
    data: any,
  ) {
    await this.authenticateChannel(ctx, clientId, clientSecret);

    // Add validation to prevent 500 errors on missing mandatory fields
    if (!data?.type || !data?.actor || !data?.timestamp) {
      return {
        success: false,
        error: "Invalid Event Schema",
        required: ["type", "actor", "timestamp"],
      };
    }

    // Add audit info like in Express
    const processedData = {
      ...data,
      audit: {
        traceId: data.audit?.traceId ?? randomBytes(16).toString("hex"),
        receivedAt: new Date().toISOString(),
      },
    };

    const entry = await this.retailService.logEvent(ctx, processedData);
    return {
      success: true,
      data: {
        key: `audit:retail:${entry.id}`,
        count: 1,
      },
    };
  }

  // --- Order lifecycle (storefront WhatsApp flow) ---

  /**
   * GET /orders/:id/status — returns the current ZENVIX workflow stage.
   * Reads the latest recorded stage marker; falls back to mapping the internal
   * order status when no marker exists yet.
   */
  async getOrderStatus(
    ctx: TenantContext,
    clientId: string | undefined,
    clientSecret: string | undefined,
    orderId: string,
  ): Promise<{ status: ZenvixOrderStage }> {
    await this.authenticateChannel(ctx, clientId, clientSecret);

    const orderRow = await this.prisma.retail_orders.findFirst({
      where: { id: orderId, tenant_id: ctx.tenant_id },
      select: { status: true, workflow_stage: true },
    });
    if (!orderRow) throw new NotFoundException("Order not found");

    const status = isValidStage(orderRow.workflow_stage)
      ? orderRow.workflow_stage
      : mapInternalStatusToStage(orderRow.status);

    return { status };
  }

  /**
   * POST /orders/:id/transitions — records a stage transition
   * ({ from_stage, to_stage, timestamp }) and advances the current stage.
   */
  async recordTransition(
    ctx: TenantContext,
    clientId: string | undefined,
    clientSecret: string | undefined,
    orderId: string,
    body: { from_stage?: string; to_stage?: string; timestamp?: string },
  ) {
    await this.authenticateChannel(ctx, clientId, clientSecret);

    const { from_stage, to_stage, timestamp } = body ?? {};
    if (!isValidStage(to_stage)) {
      throw new BadRequestException(
        `to_stage must be one of the valid ZENVIX stages`,
      );
    }
    if (from_stage && !isValidStage(from_stage)) {
      throw new BadRequestException(`from_stage is not a valid ZENVIX stage`);
    }

    const exists = await this.prisma.retail_orders.findFirst({
      where: { id: orderId, tenant_id: ctx.tenant_id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException("Order not found");

    await this.writeOrderStageMarker(ctx, orderId, to_stage, "transition", {
      from_stage: from_stage ?? null,
      to_stage,
      timestamp: timestamp ?? new Date().toISOString(),
    });

    return { success: true, order_id: orderId, stage: to_stage };
  }

  /**
   * POST /events/orders — order lifecycle events (quotation / payment /
   * sales.completion / audit.*). Persisted for analytics + audit; stage-implying
   * events also advance the polled status. `sales.completion` is idempotent per
   * order_id (DB unique constraint on idempotency_key is the safety net).
   */
  async recordOrderLifecycleEvent(
    ctx: TenantContext,
    clientId: string | undefined,
    clientSecret: string | undefined,
    payload: any,
  ) {
    await this.authenticateChannel(ctx, clientId, clientSecret);

    const eventType: string | undefined = payload?.event_type;
    const orderId: string | undefined = payload?.order_id;
    if (!eventType || !orderId || !payload?.timestamp) {
      throw new BadRequestException(
        "event_type, order_id and timestamp are required",
      );
    }

    const isSalesCompletion = eventType === "sales.completion";
    const idempotencyKey = isSalesCompletion
      ? `sales.completion:${orderId}`
      : undefined;

    // Idempotency guard for sales.completion (client guards once per order; this
    // is the server-side safety net the storefront contract requires).
    if (isSalesCompletion) {
      const existing = await this.prisma.audit_logs.findFirst({
        where: {
          tenant_id: ctx.tenant_id,
          entity_type: ORDER_ENTITY_TYPE,
          entity_id: orderId,
          action: "sales.completion",
        },
      });
      if (existing) {
        return { success: true, deduped: true, order_id: orderId };
      }
    }

    try {
      await this.prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: ctx.tenant_id,
          module: "retail",
          action: eventType,
          entity_type: ORDER_ENTITY_TYPE,
          entity_id: orderId,
          user_id: payload?.actor?.id ?? "storefront",
          changes: payload as any,
          metadata: { timestamp: payload.timestamp } as any,
          idempotency_key: idempotencyKey,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
    } catch (err: any) {
      // Unique-constraint race on (tenant_id, idempotency_key) → already recorded.
      if (err?.code === "P2002" && isSalesCompletion) {
        return { success: true, deduped: true, order_id: orderId };
      }
      throw err;
    }

    const impliedStage = ORDER_EVENT_IMPLIED_STAGE[eventType];
    if (impliedStage) {
      await this.writeOrderStageMarker(ctx, orderId, impliedStage, eventType, {
        timestamp: payload.timestamp,
      });
    }

    if (isSalesCompletion) {
      // Emit a completed-order event so downstream modules (sales mirror,
      // marketing) sync. Load the real order with items/customer and expose
      // grand_total (the listener reads order.grand_total; the column is
      // total_amount) so the consolidated-sale mirror records real figures.
      const orderRow = await this.prisma.retail_orders.findFirst({
        where: { id: orderId, tenant_id: ctx.tenant_id },
        include: {
          retail_order_items: { include: { item_masters: true } },
          retail_customers: true,
        },
      });
      this.eventEmitter.emit("retail.order.completed", {
        ctx,
        order: orderRow
          ? { ...orderRow, grand_total: orderRow.total_amount }
          : { id: orderId },
      });
    }

    return {
      success: true,
      order_id: orderId,
      event_type: eventType,
      ...(impliedStage ? { stage: impliedStage } : {}),
    };
  }

  /** Persist the current workflow stage on the order row (source of truth for
   * status + delta sync) and append an immutable audit entry for stage history. */
  private async writeOrderStageMarker(
    ctx: TenantContext,
    orderId: string,
    stage: ZenvixOrderStage,
    source: string,
    extra: Record<string, any> = {},
    orderFields: Record<string, any> = {},
  ): Promise<void> {
    // 1. Update the order row. updated_at is bumped explicitly (the column is
    //    not @updatedAt) so /sync/delta/retail-orders surfaces the change.
    await this.prisma.retail_orders.updateMany({
      where: { id: orderId, tenant_id: ctx.tenant_id },
      data: { workflow_stage: stage, updated_at: new Date(), ...orderFields },
    });

    // 2. Append an immutable stage-history entry.
    await this.prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        tenant_id: ctx.tenant_id,
        module: "retail",
        action: ORDER_STAGE_ACTION,
        entity_type: ORDER_ENTITY_TYPE,
        entity_id: orderId,
        user_id: "storefront",
        changes: extra as any,
        metadata: { stage, source } as any,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
  }

  // --- Helpers ---

  async authenticateChannel(
    ctx: TenantContext,
    clientId: string | undefined,
    clientSecret: string | undefined,
  ) {
    return this.authenticate(ctx, clientId, clientSecret);
  }

  private normalizePaymentMethod(
    method?: string,
  ): "cash" | "card" | "qr" | "wallet" {
    const normalized = (method ?? "card").toLowerCase();
    const allowed: Array<"cash" | "card" | "qr" | "wallet"> = [
      "cash",
      "card",
      "qr",
      "wallet",
    ];
    if (allowed.includes(normalized as any)) {
      return normalized as (typeof allowed)[number];
    }
    return "card";
  }

  private async authenticate(
    ctx: TenantContext,
    clientId: string | undefined,
    clientSecret: string | undefined,
  ) {
    if (!clientId || !clientSecret) {
      throw new UnauthorizedException(
        "x-client-id and x-client-secret headers are required.",
      );
    }

    const channel = await this.retailService.findChannelByClientId(
      ctx,
      clientId,
    );
    if (!channel) {
      throw new UnauthorizedException("Invalid channel credentials.");
    }

    const credentials = channel.credentials as {
      clientSecretHash?: string;
      revoked?: boolean;
    } | null;
    if (!credentials?.clientSecretHash) {
      throw new ForbiddenException("Channel credentials are not configured.");
    }

    if (credentials.revoked) {
      throw new ForbiddenException("Channel credentials have been revoked.");
    }

    if (credentials.clientSecretHash !== this.hashSecret(clientSecret)) {
      throw new UnauthorizedException("Invalid channel secret.");
    }

    if (channel.status !== "active") {
      throw new ForbiddenException("Channel is not active.");
    }

    return channel;
  }

  private async issueTokens(customer: any, scope: any, ctx?: TenantContext) {
    const tenantId = ctx?.tenant_id || customer.tenantContext?.tenant_id || customer.tenant_id;
    const accessToken = (jwt.sign as any)(
      {
        sub: customer.id,
        tenant_id: tenantId,
        connectorId: scope.id,
        scope: "retail.public",
      },
      AUTH_JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_TTL },
    );

    const refreshToken = randomBytes(48).toString("hex");
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    await this.retailService.createCustomerSession(ctx || customer.tenantContext || { tenant_id: tenantId }, {
      customer_id: customer.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    return { accessToken, refreshToken, expires_at: expiresAt.toISOString() };
  }

  private hashSecret(secret: string): string {
    return createHash("sha256").update(secret).digest("hex");
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  public mapToPublicCustomer(customer: any) {
    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      tier: customer.tier,
      points: customer.points,
    };
  }

  private mapCartResponse(cart: any) {
    const rawItems = cart.retail_cart_items || cart.items || [];
    const items = rawItems.map((item: any) => {
      const master = item.item_masters || item.product || {};
      const unitPrice = Number(item.unit_price);
      const quantity = Number(item.quantity);
      const lineTotal = unitPrice * quantity;
      const image = master.image_url
        ? (String(master.image_url).startsWith("/api")
            ? master.image_url
            : `/api/v1/inventory/images/${master.image_url}`)
        : null;
      return {
        id: item.id,
        productId: item.product_id,
        product_id: item.product_id,
        productTitle: master.name ?? null,
        productImage: image,
        sku: master.sku ?? null,
        name: master.name ?? null,
        price: unitPrice,
        unit_price: unitPrice,
        quantity,
        subtotal: lineTotal,
        totalPrice: lineTotal,
      };
    });

    const total = items.reduce(
      (sum: number, item: any) => sum + item.subtotal,
      0,
    );
    const itemCount = items.reduce(
      (sum: number, item: any) => sum + item.quantity,
      0,
    );

    return {
      id: cart.id,
      items,
      subtotal: total,
      tax: 0,
      total,
      currency: cart.currency || "IDR",
      itemCount,
    };
  }

  private mapWishlistResponse(wishlist: any) {
    const rawItems = wishlist.retail_wishlist_items || wishlist.items || [];
    return {
      id: wishlist.id,
      items: rawItems.map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        sku: item.item_masters?.sku || item.product?.sku,
        name: item.item_masters?.name || item.product?.name,
      })),
    };
  }

  async processExternalChat(
    ctx: TenantContext,
    clientId: string,
    clientSecret: string,
    payload: {
      from?: string;
      from_phone?: string;
      body: string;
      external_id?: string;
      customer_id?: string;
    },
  ) {
    await this.authenticateChannel(ctx, clientId, clientSecret);
    const rCtx = await this.resolveCompanyCtx(ctx);

    const phone = payload.from_phone || payload.from;

    // 1. Identify or register customer by phone
    let customer = phone ? await this.retailService.getCustomerByPhone(rCtx, phone) : null;
    if (!customer && payload.customer_id) {
      customer = await this.retailService.getCustomerById(rCtx, payload.customer_id);
    }

    if (!customer && phone) {
      // Auto-register customer from WhatsApp contact
      customer = await this.retailService.createCustomer(rCtx, {
        name: `WhatsApp ${phone}`,
        email: `wa-${phone.replace(/[^0-9]/g, '')}@storefront.local`,
        phone: phone,
      });
    }

    if (!customer) {
      console.warn(`[Chat Bridge] Unknown sender ${phone}. Cannot resolve customer.`);
      return { success: false, error: "Customer not found and no phone provided" };
    }

    // 2. Resolve or create chat room for this customer
    // We assume a system user "RETAIL_ADMIN" exists or we map to a specific bot
    const room = await this.chatService.createRoom({
      tenant_id: ctx.tenant_id,
      createdBy: "SYSTEM_GATEWAY",
      type: "DIRECT",
      memberUserIds: [customer.id, "RETAIL_ADMIN"],
    });

    // 3. Forward message to internal chat service
    const result = await this.chatService.sendMessage({
      tenant_id: ctx.tenant_id,
      roomId: room.id,
      senderId: customer.id,
      body: payload.body,
      type: "whatsapp",
      refModule: "retail",
      refEntityId: customer.id,
    });

    this.eventEmitter.emit('retail.chat.initiated', { 
      ctx, 
      customerId: customer.id, 
      context: { source: 'whatsapp_bridge', external_id: payload.external_id } 
    });

    return result;
  }

  private mapOrderResponse(order: any) {
    return {
      id: order.id,
      status: order.status,
      total: Number(order.grand_total),
      subtotal: Number(order.subtotal),
      tax: Number(order.tax_total || 0),
      payment_method: order.payment_method,
      created_at: order.created_at,
      items: order.items.map((item: any) => ({
        product_id: item.product_id,
        sku: item.sku,
        name: item.name,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        total_price: Number(item.total_price),
      })),
    };
  }
}
