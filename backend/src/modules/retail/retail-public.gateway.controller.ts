import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Headers,
  Req,
  Body,
  UseInterceptors,
  Param,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { TenantInterceptor } from "../../gateway/tenant.interceptor";
import { TenantContext } from "../../gateway/tenant-context.interface";
import { RetailGatewayService } from "./retail-gateway.service";
import { CacheInterceptor, CacheTTL } from '../../shared/cache';
import {
  RetailPublicOrderRequestDto,
  CustomerRegisterDto,
  CustomerLoginDto,
  CustomerRefreshDto,
  CartItemDto,
  UpdateCartItemDto,
  WishlistItemDto,
  OrderTransitionDto,
} from "./dto/public-gateway.dto";
import * as jwt from "jsonwebtoken";

const AUTH_JWT_SECRET =
  process.env.RETAIL_AUTH_JWT_SECRET ||
  process.env.JWT_SECRET ||
  "dev_retail_auth_secret";

interface RequestWithTenant extends Request {
  tenantContext: TenantContext;
  customerAuth?: { sub: string; tenant_id: string };
}

@Controller('retail/public')
@UseInterceptors(TenantInterceptor)
export class RetailPublicGatewayController {
  constructor(private readonly gatewayService: RetailGatewayService) {}

  // --- Auth & Customer ---

  @Post("auth/register")
  async register(
    @Req() request: RequestWithTenant,
    @Headers("x-client-id") clientId: string,
    @Headers("x-client-secret") clientSecret: string,
    @Body() payload: CustomerRegisterDto,
  ) {
    const { tenant_id } = request.tenantContext;
    return this.gatewayService.registerCustomer(
      request.tenantContext,
      clientId,
      clientSecret,
      payload,
    );
  }

  @Post("auth/login")
  async login(
    @Req() request: RequestWithTenant,
    @Headers("x-client-id") clientId: string,
    @Headers("x-client-secret") clientSecret: string,
    @Body() payload: CustomerLoginDto,
  ) {
    const { tenant_id } = request.tenantContext;
    return this.gatewayService.loginCustomer(
      request.tenantContext,
      clientId,
      clientSecret,
      payload,
    );
  }

  @Post("auth/refresh")
  async refresh(
    @Req() request: RequestWithTenant,
    @Headers("x-client-id") clientId: string,
    @Headers("x-client-secret") clientSecret: string,
    @Body() payload: CustomerRefreshDto,
  ) {
    const { tenant_id } = request.tenantContext;
    return this.gatewayService.refreshTokens(
      request.tenantContext,
      clientId,
      clientSecret,
      payload,
    );
  }

  @Post("auth/logout")
  async logout(
    @Req() request: RequestWithTenant,
    @Body("refreshToken") refreshToken: string,
  ) {
    const { tenant_id } = request.tenantContext;
    return this.gatewayService.logoutCustomer(request.tenantContext, refreshToken);
  }

  @Get("auth/me")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getMe(@Req() request: RequestWithTenant) {
    const auth = this.getCustomerAuth(request);
    return this.gatewayService.mapToPublicCustomer(
      await this.gatewayService.findCustomerById(request.tenantContext, auth.sub),
    );
  }

  // --- Products ---

  @Get("products")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getProducts(
    @Req() request: RequestWithTenant,
    @Headers("x-client-id") clientId: string,
    @Headers("x-client-secret") clientSecret: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const { tenant_id } = request.tenantContext;
    const size = pageSize ? Math.max(1, parseInt(pageSize, 10) || 200) : 200;
    return this.gatewayService.getProducts(
      request.tenantContext,
      clientId,
      clientSecret,
      size,
    );
  }

  @Get("products/:id")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getProduct(
    @Req() request: RequestWithTenant,
    @Headers("x-client-id") clientId: string,
    @Headers("x-client-secret") clientSecret: string,
    @Param("id") product_id: string,
  ) {
    const { tenant_id } = request.tenantContext;
    return this.gatewayService.getProductById(
      request.tenantContext,
      clientId,
      clientSecret,
      product_id,
    );
  }

  @Get("categories")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getCategories(
    @Req() request: RequestWithTenant,
    @Headers("x-client-id") clientId: string,
    @Headers("x-client-secret") clientSecret: string,
  ) {
    const { tenant_id } = request.tenantContext;
    return this.gatewayService.getCategories(request.tenantContext, clientId, clientSecret);
  }

  @Get("promotions")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getPromotions(
    @Req() request: RequestWithTenant,
    @Headers("x-client-id") clientId: string,
    @Headers("x-client-secret") clientSecret: string,
  ) {
    const { tenant_id } = request.tenantContext;
    return this.gatewayService.getPromotions(request.tenantContext, clientId, clientSecret);
  }

  // --- Cart ---

  @Get("cart")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getCart(@Req() request: RequestWithTenant) {
    const auth = this.getCustomerAuth(request);
    return this.gatewayService.getCart(request.tenantContext, auth.sub);
  }

  @Post("cart/items")
  async addToCart(
    @Req() request: RequestWithTenant,
    @Body() payload: CartItemDto,
  ) {
    const auth = this.getCustomerAuth(request);
    return this.gatewayService.addToCart(request.tenantContext, auth.sub, payload);
  }

  @Patch("cart/items/:id")
  async updateCartItem(
    @Req() request: RequestWithTenant,
    @Param("id") item_id: string,
    @Body() payload: UpdateCartItemDto,
  ) {
    const auth = this.getCustomerAuth(request);
    return this.gatewayService.updateCartItem(
      request.tenantContext,
      auth.sub,
      item_id,
      payload,
    );
  }

  @Delete("cart/items/:id")
  async removeFromCart(
    @Req() request: RequestWithTenant,
    @Param("id") item_id: string,
  ) {
    const authCtx = this.getCustomerAuth(request);
    return this.gatewayService.removeFromCart(
      request.tenantContext,
      authCtx.sub,
      item_id,
    );
  }

  @Delete("cart")
  async clearCart(@Req() request: RequestWithTenant) {
    const auth = this.getCustomerAuth(request);
    return this.gatewayService.clearCart(request.tenantContext, auth.sub);
  }

  @Post("cart/clear")
  async clearCartAlias(@Req() request: RequestWithTenant) {
    const auth = this.getCustomerAuth(request);
    return this.gatewayService.clearCart(request.tenantContext, auth.sub);
  }

  // --- Wishlist ---

  @Get("wishlist")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getWishlist(@Req() request: RequestWithTenant) {
    const auth = this.getCustomerAuth(request);
    return this.gatewayService.getWishlist(request.tenantContext, auth.sub);
  }

  @Post("wishlist/items")
  async addToWishlist(
    @Req() request: RequestWithTenant,
    @Body() payload: WishlistItemDto,
  ) {
    const auth = this.getCustomerAuth(request);
    return this.gatewayService.addToWishlist(request.tenantContext, auth.sub, payload);
  }

  @Delete("wishlist/items/:id")
  async removeFromWishlist(
    @Req() request: RequestWithTenant,
    @Param("id") item_id: string,
  ) {
    const auth = this.getCustomerAuth(request);
    return this.gatewayService.removeFromWishlist(
      request.tenantContext,
      auth.sub,
      item_id,
    );
  }

  // --- Checkout ---

  @Get("orders")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getOrders(
    @Req() request: RequestWithTenant,
    @Headers("x-client-id") clientId: string,
    @Headers("x-client-secret") clientSecret: string,
  ) {
    const auth = this.getCustomerAuth(request);
    return this.gatewayService.getCustomerOrders(
      request.tenantContext,
      clientId,
      clientSecret,
      auth.sub,
    );
  }

  @Post("orders")
  async createOrder(
    @Req() request: RequestWithTenant,
    @Headers("x-client-id") clientId: string,
    @Headers("x-client-secret") clientSecret: string,
    @Body() payload: RetailPublicOrderRequestDto,
  ) {
    const { tenant_id } = request.tenantContext;
    return this.gatewayService.createOrder(
      request.tenantContext,
      clientId,
      clientSecret,
      payload,
    );
  }

  // --- Order lifecycle (storefront WhatsApp flow) ---

  @Get("orders/:id/status")
  async getOrderStatus(
    @Req() request: RequestWithTenant,
    @Headers("x-client-id") clientId: string,
    @Headers("x-client-secret") clientSecret: string,
    @Param("id") orderId: string,
  ) {
    return this.gatewayService.getOrderStatus(
      request.tenantContext,
      clientId,
      clientSecret,
      orderId,
    );
  }

  @Post("orders/:id/transitions")
  async recordOrderTransition(
    @Req() request: RequestWithTenant,
    @Headers("x-client-id") clientId: string,
    @Headers("x-client-secret") clientSecret: string,
    @Param("id") orderId: string,
    @Body() body: OrderTransitionDto,
  ) {
    return this.gatewayService.recordTransition(
      request.tenantContext,
      clientId,
      clientSecret,
      orderId,
      body,
    );
  }

  @Post("events/orders")
  async recordOrderLifecycleEvent(
    @Req() request: RequestWithTenant,
    @Headers("x-client-id") clientId: string,
    @Headers("x-client-secret") clientSecret: string,
    @Body() payload: any,
  ) {
    return this.gatewayService.recordOrderLifecycleEvent(
      request.tenantContext,
      clientId,
      clientSecret,
      payload,
    );
  }

  @Post("checkout")
  async checkout(@Req() request: RequestWithTenant, @Body() body: any) {
    const auth = this.getCustomerAuth(request);
    return this.gatewayService.checkout(
      request.tenantContext,
      auth.sub,
      body ?? {},
      auth.connectorId,
    );
  }

  @Post("chat/webhook")
  async handleExternalChatWebhook(
    @Req() request: RequestWithTenant,
    @Headers("x-client-id") clientId: string,
    @Headers("x-client-secret") clientSecret: string,
    @Body() body: any,
  ) {
    return this.gatewayService.processExternalChat(
      request.tenantContext,
      clientId,
      clientSecret,
      body,
    );
  }

  // --- Events ---

  @Post("events")
  async logEvent(
    @Req() request: RequestWithTenant,
    @Headers("x-client-id") clientId: string,
    @Headers("x-client-secret") clientSecret: string,
    @Body() payload: any,
  ) {
    const { tenant_id } = request.tenantContext;
    return this.gatewayService.logEvent(
      request.tenantContext,
      clientId,
      clientSecret,
      payload,
    );
  }

  // --- internal helper (simulating middleware) ---

  private getCustomerAuth(req: RequestWithTenant) {
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : (req.headers["x-access-token"] as string);

    if (!token) throw new UnauthorizedException("Missing access token");

    try {
      const payload = jwt.verify(token, AUTH_JWT_SECRET) as {
        sub: string;
        tenant_id: string;
        connectorId?: string;
      };
      return payload;
    } catch (e) {
      throw new UnauthorizedException("Invalid or expired access token");
    }
  }
}

