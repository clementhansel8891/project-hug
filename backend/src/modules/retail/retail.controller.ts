import { RetailExportService } from './retail-export.service';
import { Prisma } from "@prisma/client";
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Put,
  Delete,
  UseInterceptors,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Patch,
  Headers,
  BadRequestException,
} from "@nestjs/common";
import { Request } from "express";
import { RetailService } from "./retail.service";
import { RetailSeeder } from "./seeders/retail.seeder";
import { AuditService } from "../../shared/audit/audit.service";
import {
  CreateStoreDto,
  UpdateStoreDto,
  CreateOrderDto,
  CheckoutDto,
  OpenShiftDto,
  CloseShiftDto,
  CreateEcommerceStoreDto,
  UpdateEcommerceStoreDto,
  CreateInventoryPoolDto,
  LinkBranchDto,
  UpdateProductDto,
  RegisterBranchDeviceDto,
  RegisterCCTVCameraDto,
  RegisterBranchSensorDto,
  ReconcileShiftDto,
} from "./dto/retail.dto";
import { TenantContext } from "../../gateway/tenant-context.interface";
import { ModuleStateGuard } from "../../core/auth/guards/module-state.guard";
import {
  BranchGatingGuard,
  SkipBranchCheck,
} from "../../core/auth/guards/branch-gating.guard";
import { RequiredModule } from "../../shared/decorators/required-module.decorator";
import { LocationGuard, SkipLocationCheck } from "../../shared/guards/location.guard";

interface RequestWithTenant extends Request {
  tenantContext: TenantContext;
}

@Controller('retail')
@UseGuards(ModuleStateGuard, LocationGuard, BranchGatingGuard)
@RequiredModule("retail")
export class RetailController {
  constructor(
    private readonly retailService: RetailService,
    private readonly retailExport: RetailExportService,
    private readonly retailSeeder: RetailSeeder,
    private readonly auditService: AuditService,
  ) {
    console.log("[RetailController] Instantiated and routes registered.");
  }

  /** Diagnostic route to verify controller reachability */
  @Get("debug/ping")
  @SkipBranchCheck()
  async debugPing() {
    return { success: true, message: "RetailController is reachable", timestamp: new Date().toISOString() };
  }

  /** DEV ONLY: Trigger full retail seed (products + showcase orders) */
  @Post("dev/seed")
  @SkipBranchCheck()
  @HttpCode(HttpStatus.OK)
  async triggerSeed() {
    await this.retailSeeder.seed();
    return { success: true, message: "Retail seed completed" };
  }

  @Get("inventory/stats")
  async getInventoryStats(
    @Req() request: RequestWithTenant,
    @Query("category_id") category_id?: string,
    @Query("location_id") location_id?: string,
    @Query("q") q?: string,
  ) {
    const ctx = request.tenantContext;
    if (location_id) {
      ctx.location_id = location_id;
    }
    const stats = await this.retailService.getInventoryStats(ctx, {
      category_id,
      location_id: location_id || ctx.location_id,
      q,
    });
    return this.respond(ctx, stats);
  }

  @Get("inventory/status")
  async getInventoryStatus(
    @Req() request: RequestWithTenant,
    @Query("productId") productId: string,
  ) {
    const { tenant_id } = request.tenantContext;
    const stock = await this.retailService.getChannelStockStatus(request.tenantContext, "", productId);
    return this.respond(request.tenantContext, stock);
  }

  private respond<T>(ctx: TenantContext | string, payload: T) {
    const tenant_id = typeof ctx === 'string' ? ctx : ctx.tenant_id;
    return {
      success: true,
      tenant_id,
      data: payload,
    };
  }

  private toIso(value?: Date | string | null) {
    if (!value) return undefined;
    return value instanceof Date ? value.toISOString() : value;
  }

  /**
   * Validate that an active shift exists for POS operations
   * Returns active shift or throws HTTP 422 with RFC 7807 error
   */
  private validateActiveShift(
    request: RequestWithTenant,
    storeId: string,
  ): { shiftId: string; employeeId: string } {
    const { tenant_id, user_id, location_id, role } = request.tenantContext;

    // Determine effective store_id based on role
    const effectiveStoreId =
      role === "SUPERADMIN" || role === "OWNER" || role === "ADMIN"
        ? storeId
        : location_id;

    if (!effectiveStoreId) {
      throw new BadRequestException({
        type: 'shift/missing-store',
        title: 'Store ID Required',
        detail: 'Store ID is required to validate active shift',
        tenant_id: tenant_id,
      });
    }

    // Get active shift for this store
    return { shiftId: effectiveStoreId, employeeId: user_id! };
  }

  private mapChannel(channel: any) {
    return {
      id: channel.id,
      tenant_id: channel.tenant_id ?? channel.tenant_id ?? channel.tenant_id,
      branch_id: channel.branch_id ?? channel.branch_id,
      name: channel.name,
      type: channel.type,
      status: channel.status,
      syncFrequency: channel.syncFrequency ?? channel.sync_frequency,
      lastSync: this.toIso(channel.lastSync ?? channel.last_sync_at),
      channel_id: channel.channel_id ?? channel.clientId,
      clientId: channel.clientId ?? channel.channel_id,
      clientSecret: channel.clientSecret,
      gatewayUrl: channel.gatewayUrl,
      connector: channel.connector,
      created_at: this.toIso(channel.created_at ?? channel.created_at),
      updated_at: this.toIso(channel.updated_at ?? channel.updated_at),
    };
  }

  @Get("stores")
  async listStores(@Req() request: RequestWithTenant) {
    const { tenant_id, location_id, role } = request.tenantContext;

    // All retail-module users can see all stores since SPG staff rotate between
    // branches according to external schedules. Access control is enforced at the
    // shift level (users can only open shifts at stores they're scheduled for).
    const stores = await this.retailService.listStores(
      request.tenantContext,
      undefined,
    );
    return this.respond(request.tenantContext, stores);
  }

  @Get("stores/:id")
  async getStore(
    @Req() request: RequestWithTenant,
    @Param("id") store_id: string,
  ) {
    const { tenant_id } = request.tenantContext;
    console.log(`[RetailController] Fetching store detail for ID: ${store_id} | Tenant: ${tenant_id}`);
    const store = await this.retailService.getStore(request.tenantContext, store_id);
    return this.respond(request.tenantContext, store);
  }

  @Get("categories")
  async listCategories(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const categories = await this.retailService.listCategories(request.tenantContext);
    return this.respond(request.tenantContext, categories);
  }

  @Post("stores")
  @SkipBranchCheck()
  async createStore(
    @Req() request: RequestWithTenant,
    @Body() data: CreateStoreDto,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const store = await this.retailService.createStore(request.tenantContext, data, user_id!);
    return this.respond(request.tenantContext, store);
  }

  @Put("stores/:id")
  async updateStore(
    @Req() request: RequestWithTenant,
    @Param("id") store_id: string,
    @Body() data: UpdateStoreDto,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    console.log(
      `[RetailController] Updating store ${store_id} for tenant ${tenant_id}. Data:`,
      JSON.stringify(data, null, 2),
    );
    const store = await this.retailService.updateStore(
      request.tenantContext,
      store_id,
      data,
      user_id!,
    );
    return this.respond(request.tenantContext, store);
  }

  @Delete("stores/:id")
  @HttpCode(HttpStatus.OK)
  async deleteStore(
    @Req() request: RequestWithTenant,
    @Param("id") store_id: string,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    await this.retailService.deleteStore(request.tenantContext, store_id, user_id!);
    return this.respond(request.tenantContext, {
      message: "Store decommissioned successfully",
    });
  }

  // ============================================================
  // INVENTORY POOLS
  // ============================================================

  @Get("inventory-pools")
  async listInventoryPools(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const pools = await this.retailService.listInventoryPools(request.tenantContext);
    return this.respond(request.tenantContext, pools);
  }

  @Post("inventory-pools")
  async createInventoryPool(
    @Req() request: RequestWithTenant,
    @Body() data: CreateInventoryPoolDto,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const pool = await this.retailService.createInventoryPool(
      request.tenantContext,
      data,
      user_id!,
    );
    return this.respond(request.tenantContext, pool);
  }

  @Get("inventory-pools/:id")
  async getInventoryPool(
    @Req() request: RequestWithTenant,
    @Param("id") poolId: string,
  ) {
    const { tenant_id } = request.tenantContext;
    const pool = await this.retailService.getInventoryPool(request.tenantContext, poolId);
    return this.respond(request.tenantContext, pool);
  }

  @Delete("inventory-pools/:id")
  @HttpCode(HttpStatus.OK)
  async deleteInventoryPool(
    @Req() request: RequestWithTenant,
    @Param("id") poolId: string,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    await this.retailService.deleteInventoryPool(request.tenantContext, poolId, user_id!);
    return this.respond(request.tenantContext, { message: "Pool deleted" });
  }

  // ============================================================
  // E-COMMERCE STORES
  // ============================================================

  @Get("ecommerce-stores")
  async listEcommerceStores(@Req() request: RequestWithTenant) {
    const { tenant_id, location_id } = request.tenantContext;
    const stores = await this.retailService.listEcommerceStores(
      request.tenantContext,
      location_id!,
    );
    return this.respond(request.tenantContext, stores);
  }

  @Post("ecommerce-stores")
  async createEcommerceStore(
    @Req() request: RequestWithTenant,
    @Body() data: CreateEcommerceStoreDto,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const store = await this.retailService.createEcommerceStore(
      request.tenantContext,
      data,
      user_id!,
    );
    return this.respond(request.tenantContext, store);
  }

  @Get("ecommerce-stores/:id")
  async getEcommerceStore(
    @Req() request: RequestWithTenant,
    @Param("id") store_id: string,
  ) {
    const { tenant_id } = request.tenantContext;
    const store = await this.retailService.getEcommerceStore(request.tenantContext, store_id);
    return this.respond(request.tenantContext, store);
  }

  @Put("ecommerce-stores/:id")
  async updateEcommerceStore(
    @Req() request: RequestWithTenant,
    @Param("id") store_id: string,
    @Body() data: UpdateEcommerceStoreDto,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const store = await this.retailService.updateEcommerceStore(
      request.tenantContext,
      store_id,
      data,
      user_id!,
    );
    return this.respond(request.tenantContext, store);
  }

  @Delete("ecommerce-stores/:id")
  @HttpCode(HttpStatus.OK)
  async deleteEcommerceStore(
    @Req() request: RequestWithTenant,
    @Param("id") store_id: string,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    await this.retailService.deleteEcommerceStore(request.tenantContext, store_id, user_id!);
    return this.respond(request.tenantContext, { message: "E-commerce store removed" });
  }

  @Post("ecommerce-stores/:id/link-branch")
  async linkEcommerceToBranch(
    @Req() request: RequestWithTenant,
    @Param("id") ecommerceId: string,
    @Body() data: LinkBranchDto,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    await this.retailService.linkEcommerceToBranch(
      request.tenantContext,
      ecommerceId,
      data.branch_id,
      user_id!,
    );
    return this.respond(request.tenantContext, { message: "Branch linked successfully" });
  }

  @Delete("ecommerce-stores/:id/unlink-branch/:branch_id")
  @HttpCode(HttpStatus.OK)
  async unlinkEcommerceFromBranch(
    @Req() request: RequestWithTenant,
    @Param("id") ecommerceId: string,
    @Param("branch_id") branch_id: string,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    await this.retailService.unlinkEcommerceFromBranch(
      request.tenantContext,
      ecommerceId,
      branch_id,
      user_id!,
    );
    return this.respond(request.tenantContext, { message: "Branch unlinked successfully" });
  }

  @Get("products/next-sku")
  @SkipBranchCheck()
  async getNextSku(
    @Req() request: RequestWithTenant,
    @Query("category_id") category_id: string,
  ) {
    const { tenant_id } = request.tenantContext;
    const result = await this.retailService.generateNextSku(
      request.tenantContext,
      category_id,
    );
    return this.respond(request.tenantContext, result);
  }

  @Get("products")
  async listProducts(
    @Req() request: RequestWithTenant,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("category_id") category_id?: string,
    @Query("type") type?: string,
    @Query("minPrice") minPrice?: string,
    @Query("maxPrice") maxPrice?: string,
    @Query("q") q?: string,
    @Query("sortBy") sortBy?: "name" | "price" | "created_at",
    @Query("sortDir") sortDir?: "asc" | "desc",
    @Query("location_id") querylocation_id?: string,
  ) {
    const { tenant_id, location_id: sessionlocation_id } = request.tenantContext;
    const effectivelocation_id = querylocation_id || sessionlocation_id;
    const products = await this.retailService.listProducts(request.tenantContext, {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      category_id: category_id || undefined,
      type: type || undefined,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      q: q || undefined,
      sortBy,
      sortDir,
      location_id: effectivelocation_id || undefined,
    });
    return this.respond(request.tenantContext, products);
  }

  @Patch("products/:id")
  async updateProduct(
    @Req() request: RequestWithTenant,
    @Param("id") product_id: string,
    @Body() data: UpdateProductDto,
  ) {
    const {
      tenant_id,
      user_id,
      location_id: sessionlocation_id,
    } = request.tenantContext;
    const effectivelocation_id = data.location_id || sessionlocation_id;

    const updated = await this.retailService.updateProduct(
      request.tenantContext,
      product_id,
      data,
      user_id!,
      effectivelocation_id,
    );
    return this.respond(request.tenantContext, updated);
  }

  @Get("products/:id")
  async getProduct(
    @Req() request: RequestWithTenant,
    @Param("id") product_id: string,
  ) {
    const product = await this.retailService.getProduct(request.tenantContext, product_id);
    return this.respond(request.tenantContext, product);
  }

  @Get("orders")
  async listOrders(
    @Req() request: RequestWithTenant,
    @Query("store_id") store_id?: string,
    @Query("customer_id") customer_id?: string,
    @Query("ecommerce_id") ecommerce_id?: string,
    @Query("status") status?: string,
  ) {
    const { tenant_id, role, location_id } = request.tenantContext;

    const effectivestore_id =
      role === "SUPERADMIN" || role === "OWNER" || role === "ADMIN"
        ? store_id
        : location_id;

    const orders = await this.retailService.listOrders(request.tenantContext, {
      store_id: effectivestore_id,
      customer_id,
      ecommerce_id,
      status,
    });
    return this.respond(request.tenantContext, orders);
  }

  @Get("orders/:id")
  async getOrder(
    @Req() request: RequestWithTenant,
    @Param("id") order_id: string,
  ) {
    const order = await this.retailService.getOrder(request.tenantContext, order_id);
    return this.respond(request.tenantContext, order);
  }

  @Get("customers")
  async listCustomers(
    @Req() request: RequestWithTenant,
    @Query("ecommerce_id") ecommerce_id?: string,
    @Query("q") q?: string,
  ) {
    const customers = await this.retailService.listCustomers(request.tenantContext, {
      ecommerce_id,
      q,
    });
    return this.respond(request.tenantContext, customers);
  }

  @Get("analytics/ecommerce")
  async getEcommerceAnalytics(
    @Req() request: RequestWithTenant,
    @Query("ecommerce_id") ecommerce_id?: string,
  ) {
    const analytics = await this.retailService.getEcommerceAnalytics(
      request.tenantContext,
      ecommerce_id,
    );
    return this.respond(request.tenantContext, analytics);
  }

  @Post("orders")
  async createOrder(
    @Req() request: RequestWithTenant,
    @Body() data: CreateOrderDto,
  ) {
    const { tenant_id, location_id, user_id } = request.tenantContext;
    const order = await this.retailService.createOrder(
      request.tenantContext,
      location_id!,
      data,
      user_id!,
    );
    return this.respond(request.tenantContext, order);
  }

  @Post("checkout")
  async checkout(
    @Req() request: RequestWithTenant,
    @Body() data: CheckoutDto,
    @Headers("x-idempotency-key") idempotencyKey?: string,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    
    // BUG-10 FIX: Validate active shift before processing checkout
    const storeId = data.store_id || request.tenantContext.location_id;
    if (!storeId) {
      throw new BadRequestException({
        type: 'shift/missing-store',
        title: 'Store ID Required',
        detail: 'Store ID is required to validate active shift',
        tenant_id: tenant_id,
      });
    }
    
    // Get active shift to verify it exists and is open
    const activeShift = await this.retailService.getActiveShift(
      request.tenantContext,
      storeId,
      user_id!,
    );
    
    if (!activeShift) {
      throw new BadRequestException({
        type: 'shift/no-active-shift',
        title: 'No Active Shift',
        detail: 'An active shift is required to process transactions. Please open a shift first.',
        tenant_id: tenant_id,
        store_id: storeId,
        user_id: user_id,
      });
    }
    
    if (activeShift.status !== "open") {
      throw new BadRequestException({
        type: 'shift/shift-closed',
        title: 'Shift is Closed',
        detail: `Cannot process transactions with a ${activeShift.status} shift. Please open a new shift.`,
        tenant_id: tenant_id,
        shift_id: activeShift.id,
        shift_status: activeShift.status,
      });
    }
    
    // Add shift_id to checkout data for service layer
    const checkoutData = {
      ...data,
      shift_id: activeShift.id,
    };
    
    const order = await this.retailService.checkout(
      request.tenantContext,
      checkoutData,
      user_id!,
      idempotencyKey,
    );
    return this.respond(request.tenantContext, order);
  }

  @Get("shifts/active")
  @SkipLocationCheck()
  async getActiveShift(
    @Req() request: RequestWithTenant,
    @Query("store_id") store_id: string,
  ) {
    const { tenant_id, role, location_id, user_id } = request.tenantContext;

    const effectivestore_id =
      role === "SUPERADMIN" || role === "OWNER" || role === "ADMIN"
        ? store_id
        : location_id;

    const shift = await this.retailService.getActiveShift(
      request.tenantContext,
      effectivestore_id!,
      user_id!,
    );
    return this.respond(request.tenantContext, shift);
  }

  @Post("shifts/open")
  @SkipLocationCheck()
  async openShift(
    @Req() request: RequestWithTenant,
    @Body() data: OpenShiftDto,
  ) {
    const { location_id, user_id } = request.tenantContext;

    const shift = await this.retailService.openShift(
      request.tenantContext,
      data.store_id || location_id!,
      user_id!,
      data,
      user_id!,
    );
    return this.respond(request.tenantContext, shift);
  }

  @Put("shifts/:id/close")
  @SkipLocationCheck()
  async closeShift(
    @Req() request: RequestWithTenant,
    @Param("id") shift_id: string,
    @Body() data: CloseShiftDto,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const shift = await this.retailService.closeShift(
      request.tenantContext,
      shift_id,
      data,
      user_id!,
    );
    return this.respond(request.tenantContext, shift);
  }

  @Post("shifts/:id/reconcile")
  @SkipLocationCheck()
  async reconcileShift(
    @Req() request: RequestWithTenant,
    @Param("id") shift_id: string,
    @Body() data: ReconcileShiftDto,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const shift = await this.retailService.reconcileShift(
      request.tenantContext,
      shift_id,
      data,
      user_id!,
    );
    return this.respond(request.tenantContext, shift);
  }

  @Post("shifts/:id/cash-movement")
  @SkipLocationCheck()
  async recordCashMovement(
    @Req() request: RequestWithTenant,
    @Param("id") shift_id: string,
    @Body() data: { amount: number; type: "CASH_OUT" | "CASH_IN"; reason?: string; notes?: string },
  ) {
    const { user_id } = request.tenantContext;
    const movement = await this.retailService.recordCashMovement(
      request.tenantContext,
      shift_id,
      data,
      user_id!,
    );
    return this.respond(request.tenantContext, movement);
  }


  @Get("shifts")
  @SkipLocationCheck()
  async listShifts(
    @Req() request: RequestWithTenant,
    @Query("store_id") store_id?: string,
    @Query("employee_id") employee_id?: string,
  ) {
    const shifts = await this.retailService.listShifts(
      request.tenantContext,
      store_id, // Pass undefined if not provided, letting service/repo handle it
      employee_id,
    );
    return this.respond(request.tenantContext, shifts);
  }

  @Get("shifts/:id")
  @SkipLocationCheck()
  async getShift(
    @Req() request: RequestWithTenant,
    @Param("id") shift_id: string,
  ) {
    const shift = await this.retailService.getShift(request.tenantContext, shift_id);
    return this.respond(request.tenantContext, shift);
  }

  @Get("promotions")
  async listPromotions(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const promos = await this.retailService.listPromotions(request.tenantContext);
    return this.respond(request.tenantContext, promos);
  }

  @Put("promotions/:id")
  async updatePromotion(
    @Req() request: RequestWithTenant,
    @Param("id") promotionId: string,
    @Body() data: any,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const promo = await this.retailService.updatePromotion(
      request.tenantContext,
      promotionId,
      data,
      user_id!,
    );
    return this.respond(request.tenantContext, promo);
  }

  @Get("channels")
  async listChannels(@Req() request: RequestWithTenant) {
    const { tenant_id } = request.tenantContext;
    const channels = await this.retailService.listChannels(request.tenantContext);
    return this.respond(
      request.tenantContext,
      channels.map((channel) => this.mapChannel(channel)),
    );
  }

  @Post("channels")
  async createChannel(@Req() request: RequestWithTenant, @Body() data: any) {
    const { tenant_id, user_id } = request.tenantContext;
    const channel = await this.retailService.createChannel(
      request.tenantContext,
      data,
      user_id!,
    );
    return this.respond(request.tenantContext, this.mapChannel(channel));
  }

  @Put("channels/:id")
  async updateChannel(
    @Req() request: RequestWithTenant,
    @Param("id") channelId: string,
    @Body() data: any,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const channel = await this.retailService.updateChannel(
      request.tenantContext,
      channelId,
      data,
      user_id!,
    );
    return this.respond(request.tenantContext, this.mapChannel(channel));
  }

  @Delete("channels/:id")
  async deleteChannel(
    @Req() request: RequestWithTenant,
    @Param("id") channelId: string,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const result = await this.retailService.deleteChannel(
      request.tenantContext,
      channelId,
      user_id!,
    );
    return this.respond(request.tenantContext, result);
  }

  @Post("channels/:id/sync")
  async syncChannel(
    @Req() request: RequestWithTenant,
    @Param("id") channelId: string,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const result = await this.retailService.syncChannel(
      request.tenantContext,
      channelId,
      user_id!,
    );
    return this.respond(request.tenantContext, result);
  }

  @Post("channels/:id/rotate-credentials")
  async rotateChannelCredentials(
    @Req() request: RequestWithTenant,
    @Param("id") channelId: string,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const creds = await this.retailService.rotateChannelCredentials(
      request.tenantContext,
      channelId,
      user_id!,
    );
    return this.respond(request.tenantContext, creds);
  }

  @Post("channels/:id/revoke-credentials")
  async revokeChannelCredentials(
    @Req() request: RequestWithTenant,
    @Param("id") channelId: string,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const result = await this.retailService.revokeChannelCredentials(
      request.tenantContext,
      channelId,
      user_id!,
    );
    return this.respond(request.tenantContext, result);
  }
  @Get("devices")
  async listDevices(
    @Req() request: RequestWithTenant,
    @Query("store_id") store_id?: string,
  ) {
    const { tenant_id, role, location_id } = request.tenantContext;
    const effectivestore_id =
      role === "SUPERADMIN" || role === "OWNER" || role === "ADMIN"
        ? store_id
        : location_id;
    const devices = await this.retailService.listDevices(
      request.tenantContext,
      effectivestore_id,
    );
    return this.respond(request.tenantContext, devices);
  }

  @Post("devices")
  async registerDevice(
    @Req() request: RequestWithTenant,
    @Body() data: RegisterBranchDeviceDto,
  ) {
    const { tenant_id, user_id, location_id } = request.tenantContext;
    const device = await this.retailService.registerDevice(
      request.tenantContext,
      location_id!,
      data,
      user_id!,
    );
    return this.respond(request.tenantContext, device);
  }

  @Get("cctvs")
  async listCCTVs(
    @Req() request: RequestWithTenant,
    @Query("store_id") store_id?: string,
  ) {
    const { tenant_id, role, location_id } = request.tenantContext;
    const effectivestore_id =
      role === "SUPERADMIN" || role === "OWNER" || role === "ADMIN"
        ? store_id
        : location_id;
    const cctvs = await this.retailService.listCCTVs(
      request.tenantContext,
      effectivestore_id,
    );
    return this.respond(request.tenantContext, cctvs);
  }

  @Post("cctvs")
  async registerCCTV(
    @Req() request: RequestWithTenant,
    @Body() data: RegisterCCTVCameraDto,
  ) {
    const { tenant_id, user_id, location_id } = request.tenantContext;
    const camera = await this.retailService.registerCCTV(
      request.tenantContext,
      location_id!,
      data,
      user_id!,
    );
    return this.respond(request.tenantContext, camera);
  }

  @Post("cctvs/validate")
  async validateCCTVConnection(
    @Req() request: RequestWithTenant,
    @Body() data: RegisterCCTVCameraDto,
  ) {
    const { tenant_id, location_id } = request.tenantContext;
    const result = await this.retailService.validateCCTVConnection(
      request.tenantContext,
      location_id!,
      data,
    );
    return this.respond(request.tenantContext, result);
  }

  @Get("sensors")
  async listSensors(
    @Req() request: RequestWithTenant,
    @Query("store_id") store_id?: string,
  ) {
    const { tenant_id, role, location_id } = request.tenantContext;
    const effectivestore_id =
      role === "SUPERADMIN" || role === "OWNER" || role === "ADMIN"
        ? store_id
        : location_id;
    const sensors = await this.retailService.listSensors(
      request.tenantContext,
      effectivestore_id,
    );
    return this.respond(request.tenantContext, sensors);
  }

  @Post("sensors")
  async registerSensor(
    @Req() request: RequestWithTenant,
    @Body() data: RegisterBranchSensorDto,
  ) {
    const { tenant_id, user_id, location_id } = request.tenantContext;
    const sensor = await this.retailService.registerSensor(
      request.tenantContext,
      location_id!,
      data,
      user_id!,
    );
    return this.respond(request.tenantContext, sensor);
  }

  @Post("devices/:id/ping")
  async pingDevice(
    @Req() request: RequestWithTenant,
    @Param("id") device_id: string,
  ) {
    const { tenant_id } = request.tenantContext;
    const result = await this.retailService.pingDevice(request.tenantContext, device_id);
    return this.respond(request.tenantContext, result);
  }

  @Post("devices/scan")
  async scanDevices(@Req() request: RequestWithTenant) {
    const { tenant_id, location_id } = request.tenantContext;
    const discovered = await this.retailService.scanDevices(
      request.tenantContext,
      location_id!,
    );
    return this.respond(request.tenantContext, discovered);
  }

  @Post("devices/commit-scan/:discoveryId")
  async commitScannedDevice(
    @Req() request: RequestWithTenant,
    @Param("discoveryId") discoveryId: string,
  ) {
    const { tenant_id, location_id, user_id } = request.tenantContext;
    const device = await this.retailService.commitScannedDevice(
      request.tenantContext,
      location_id!,
      discoveryId,
      user_id!,
    );
    return this.respond(request.tenantContext, device);
  }

  @Post("orders/:id/payment")
  async processPayment(
    @Req() request: RequestWithTenant,
    @Param("id") order_id: string,
    @Body() data: { amount: number; method: string; shift_id?: string },
  ) {
    const { tenant_id, user_id, location_id, role } = request.tenantContext;
    
    // BUG-10 FIX: Validate active shift before processing payment
    const storeId = data.shift_id ? undefined : location_id;
    
    if (!data.shift_id && !storeId) {
      throw new BadRequestException({
        type: 'shift/missing-store',
        title: 'Store ID Required',
        detail: 'Store ID or shift_id is required to validate active shift',
        tenant_id: tenant_id,
      });
    }
    
    // Get active shift if not provided
    const effectiveStoreId = role === "SUPERADMIN" || role === "OWNER" || role === "ADMIN"
      ? data.shift_id
      : storeId;
    
    if (!data.shift_id && effectiveStoreId) {
      const activeShift = await this.retailService.getActiveShift(
        request.tenantContext,
        effectiveStoreId,
        user_id!,
      );
      
      if (!activeShift) {
        throw new BadRequestException({
          type: 'shift/no-active-shift',
          title: 'No Active Shift',
          detail: 'An active shift is required to process payments. Please open a shift first.',
          tenant_id: tenant_id,
          store_id: effectiveStoreId,
          user_id: user_id,
        });
      }
      
      if (activeShift.status !== "open") {
        throw new BadRequestException({
          type: 'shift/shift-closed',
          title: 'Shift is Closed',
          detail: `Cannot process payments with a ${activeShift.status} shift. Please open a new shift.`,
          tenant_id: tenant_id,
          shift_id: activeShift.id,
          shift_status: activeShift.status,
        });
      }
      
      // Use active shift
      data.shift_id = activeShift.id;
    }
    
    const payment = await this.retailService.processPayment(
      request.tenantContext,
      order_id,
      { ...data, amount: new Prisma.Decimal(String(data.amount)) },
      user_id!,
    );
    return this.respond(request.tenantContext, payment);
  }

  @Post("orders/:id/return")
  async processReturn(
    @Req() request: RequestWithTenant,
    @Param("id") order_id: string,
    @Body() data: { 
      itemIds: string[]; 
      shift_id?: string;
      conditions?: Array<{ productId: string; condition: 'good' | 'damaged_repairable' | 'damaged_unrepairable'; notes?: string }>;
    },
  ) {
    const { tenant_id, user_id, location_id, role } = request.tenantContext;
    
    // BUG-10 FIX: Validate active shift before processing return
    const storeId = data.shift_id ? undefined : location_id;
    
    if (!data.shift_id && !storeId) {
      throw new BadRequestException({
        type: 'shift/missing-store',
        title: 'Store ID Required',
        detail: 'Store ID or shift_id is required to validate active shift',
        tenant_id: tenant_id,
      });
    }
    
    // Get active shift if not provided
    const effectiveStoreId = role === "SUPERADMIN" || role === "OWNER" || role === "ADMIN"
      ? data.shift_id
      : storeId;
    
    if (!data.shift_id && effectiveStoreId) {
      const activeShift = await this.retailService.getActiveShift(
        request.tenantContext,
        effectiveStoreId,
        user_id!,
      );
      
      if (!activeShift) {
        throw new BadRequestException({
          type: 'shift/no-active-shift',
          title: 'No Active Shift',
          detail: 'An active shift is required to process returns. Please open a shift first.',
          tenant_id: tenant_id,
          store_id: effectiveStoreId,
          user_id: user_id,
        });
      }
      
      if (activeShift.status !== "open") {
        throw new BadRequestException({
          type: 'shift/shift-closed',
          title: 'Shift is Closed',
          detail: `Cannot process returns with a ${activeShift.status} shift. Please open a new shift.`,
          tenant_id: tenant_id,
          shift_id: activeShift.id,
          shift_status: activeShift.status,
        });
      }
      
      // Use active shift
      data.shift_id = activeShift.id;
    }
    
    const result = await this.retailService.processReturn(
      request.tenantContext,
      order_id,
      data,
      user_id!,
    );
    return this.respond(request.tenantContext, result);
  }

  @Post("orders/:id/void")
  async voidOrder(
    @Req() request: RequestWithTenant,
    @Param("id") order_id: string,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const order = await this.retailService.voidOrder(
      request.tenantContext,
      order_id,
      user_id!,
    );
    return this.respond(request.tenantContext, order);
  }

  @Post("orders/:id/cancel")
  async cancelOrder(
    @Req() request: RequestWithTenant,
    @Param("id") order_id: string,
  ) {
    const { tenant_id, user_id } = request.tenantContext;
    const order = await this.retailService.cancelOrder(
      request.tenantContext,
      order_id,
      user_id!,
    );
    return this.respond(request.tenantContext, order);
  }


  @Post("inventory/opname")
  async submitOpname(
    @Req() request: RequestWithTenant,
    @Body() data: { store_id: string; adjustments: any[]; shift_id?: string },
  ) {
    const { tenant_id, user_id, role, location_id } = request.tenantContext;

    // For non-admin roles without an explicit store_id, resolve from location
    if (role !== "SUPERADMIN" && role !== "OWNER" && role !== "ADMIN") {
      if (!data.store_id || data.store_id === location_id) {
        // Look up store by location_id instead of using raw location_id as store_id
        const storeByLocation = await this.retailService.getStoreByLocation(request.tenantContext, location_id!);
        if (storeByLocation) {
          data.store_id = storeByLocation.id;
        }
      }
    }

    // BUG-10 FIX: Validate active shift before submitting opname
    if (!data.shift_id && !data.store_id) {
      throw new BadRequestException({
        type: 'shift/missing-store',
        title: 'Store ID Required',
        detail: 'Store ID or shift_id is required to validate active shift',
        tenant_id: tenant_id,
      });
    }

    // Get active shift if not provided
    const effectiveStoreId = role === "SUPERADMIN" || role === "OWNER" || role === "ADMIN"
      ? data.shift_id
      : data.store_id || location_id;

    if (!data.shift_id && effectiveStoreId) {
      const activeShift = await this.retailService.getActiveShift(
        request.tenantContext,
        effectiveStoreId,
        user_id!,
      );
      
      if (!activeShift) {
        throw new BadRequestException({
          type: 'shift/no-active-shift',
          title: 'No Active Shift',
          detail: 'An active shift is required to submit opname. Please open a shift first.',
          tenant_id: tenant_id,
          store_id: effectiveStoreId,
          user_id: user_id,
        });
      }
      
      if (activeShift.status !== "open") {
        throw new BadRequestException({
          type: 'shift/shift-closed',
          title: 'Shift is Closed',
          detail: `Cannot submit opname with a ${activeShift.status} shift. Please open a new shift.`,
          tenant_id: tenant_id,
          shift_id: activeShift.id,
          shift_status: activeShift.status,
        });
      }
      
      // Use active shift
      data.shift_id = activeShift.id;
    }

    const result = await this.retailService.submitOpname(
      request.tenantContext,
      data,
      user_id!,
    );
    return this.respond(request.tenantContext, result);
  }

  @Post("inventory/receive")
  async receiveGoods(
    @Req() request: RequestWithTenant,
    @Body()
    data: {
      store_id: string;
      shipment_id: string;
      items: any[];
      shift_id?: string;
    },
  ) {
    const { tenant_id, user_id, role, location_id } = request.tenantContext;

    // For non-admin roles without an explicit store_id, resolve from location
    if (role !== "SUPERADMIN" && role !== "OWNER" && role !== "ADMIN") {
      if (!data.store_id || data.store_id === location_id) {
        const storeByLocation = await this.retailService.getStoreByLocation(request.tenantContext, location_id!);
        if (storeByLocation) {
          data.store_id = storeByLocation.id;
        }
      }
    }

    // BUG-10 FIX: Validate active shift before receiving goods
    if (!data.shift_id && !data.store_id) {
      throw new BadRequestException({
        type: 'shift/missing-store',
        title: 'Store ID Required',
        detail: 'Store ID or shift_id is required to validate active shift',
        tenant_id: tenant_id,
      });
    }

    // Get active shift if not provided
    const effectiveStoreId = role === "SUPERADMIN" || role === "OWNER" || role === "ADMIN"
      ? data.shift_id
      : data.store_id || location_id;

    if (!data.shift_id && effectiveStoreId) {
      const activeShift = await this.retailService.getActiveShift(
        request.tenantContext,
        effectiveStoreId,
        user_id!,
      );
      
      if (!activeShift) {
        throw new BadRequestException({
          type: 'shift/no-active-shift',
          title: 'No Active Shift',
          detail: 'An active shift is required to receive goods. Please open a shift first.',
          tenant_id: tenant_id,
          store_id: effectiveStoreId,
          user_id: user_id,
        });
      }
      
      if (activeShift.status !== "open") {
        throw new BadRequestException({
          type: 'shift/shift-closed',
          title: 'Shift is Closed',
          detail: `Cannot receive goods with a ${activeShift.status} shift. Please open a new shift.`,
          tenant_id: tenant_id,
          shift_id: activeShift.id,
          shift_status: activeShift.status,
        });
      }
      
      // Use active shift
      data.shift_id = activeShift.id;
    }

    const result = await this.retailService.receiveGoods(
      request.tenantContext,
      data,
      user_id!,
    );
    return this.respond(request.tenantContext, result);
  }

  @Post("inventory/sync")
  async syncInventory(
    @Req() request: RequestWithTenant,
    @Body() data: { store_id?: string; location_id?: string },
  ) {
    const { user_id, role, location_id } = request.tenantContext;

    // Resolve the effective store: privileged roles may target any store; everyone else is
    // pinned to their assigned location.
    const isPrivileged = role === "SUPERADMIN" || role === "OWNER" || role === "ADMIN";
    const effectiveStoreId = isPrivileged
      ? data.store_id || data.location_id || location_id
      : location_id || data.store_id || data.location_id;

    const result = await this.retailService.syncInventory(
      request.tenantContext,
      { store_id: effectiveStoreId },
      user_id!,
    );
    return this.respond(request.tenantContext, result);
  }
  @HttpCode(HttpStatus.OK)
  async exportReturns(@Req() request: RequestWithTenant) {
     const { tenant_id } = request.tenantContext;
     if (!tenant_id || tenant_id === 'mock') throw new Error("Invalid tenant context for export");
     const csv = await this.retailExport.generateReturnCsv(request.tenantContext);
     return csv;
  }

  @Get("audit/export")
  @HttpCode(HttpStatus.OK)
  async exportAudit(@Req() request: RequestWithTenant) {
     const { tenant_id } = request.tenantContext;
     const csv = await this.retailExport.generateAuditCsv(request.tenantContext);
     return csv;
  }

  @Get("dashboard/export")
  @HttpCode(HttpStatus.OK)
  async exportDashboard(@Req() request: RequestWithTenant) {
     const { tenant_id } = request.tenantContext;
     const csv = await this.retailExport.generateDashboardKpiCsv(request.tenantContext);
     return csv;
  }

  @Get("orders/:id/print")
  @HttpCode(HttpStatus.OK)
  async printOrder(
    @Req() request: RequestWithTenant,
    @Param("id") order_id: string,
  ) {
    const { tenant_id } = request.tenantContext;
    const buffer = await this.retailService.printOrder(request.tenantContext, order_id);
    return buffer;
  }

  /**
   * Governance audit log for a specific retail entity (e.g. GLOBAL_STAFF_ROSTER).
   * Proxies into the shared audit_logs table filtered by module='retail' and the
   * optional entity_id query parameter so the frontend compliance ledger can work.
   */
  @Get("governance/audit-log")
  @SkipBranchCheck()
  async getGovernanceAuditLog(
    @Req() request: RequestWithTenant,
    @Query("entity_id") entity_id?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const ctx = request.tenantContext;
    const result = await this.auditService.query(ctx.tenant_id, {
      module: "retail",
      entity_id,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
    return {
      success: true,
      tenant_id: ctx.tenant_id,
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

}
