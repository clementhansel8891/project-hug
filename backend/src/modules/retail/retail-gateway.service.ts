import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
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
import { createHash, randomBytes } from "crypto";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { ChatService } from "../../shared/comms/chat.service";
import { EventEmitter2 } from "@nestjs/event-emitter";

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
  ): Promise<PublicProductView[]> {
    const channel = await this.authenticateChannel(ctx, clientId, clientSecret);
    const { items: products } = await this.retailService.listProducts(
      ctx,
      { page: 1, pageSize: 200 },
    );
    
    return Promise.all(products.map(async (product) => {
      const stock = await this.retailService.getChannelStockStatus(ctx, channel.id, product.id);
      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        price: Number(product.base_price),
        stock_levels: stock.status as any,
        category: product.category_id,
        maxQuantity: Number(stock.available),
      };
    }));
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
      cart = await this.retailService.createCart(rCtx, customer_id);
    }
    return this.mapCartResponse(cart);
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
      wishlist = await this.retailService.upsertWishlist(rCtx, customer_id);
    }
    return this.mapWishlistResponse(wishlist);
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
    await this.authenticateChannel(ctx, clientId, clientSecret);
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
          name: payload.customer.name || payload.customer.email
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
    const items = cart.items.map((item: any) => ({
      id: item.id,
      product_id: item.product_id,
      sku: item.product?.sku,
      name: item.product?.name,
      quantity: item.quantity,
      unit_price: Number(item.unit_price),
      totalPrice: Number(item.unit_price) * item.quantity,
    }));

    const subtotal = items.reduce(
      (sum: number, item: any) => sum + item.totalPrice,
      0,
    );

    return {
      id: cart.id,
      items,
      subtotal,
      tax: 0,
      total: subtotal,
    };
  }

  private mapWishlistResponse(wishlist: any) {
    return {
      id: wishlist.id,
      items: wishlist.items.map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        sku: item.product?.sku,
        name: item.product?.name,
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
