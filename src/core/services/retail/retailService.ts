import { apiRequest } from "@/core/api/apiClient";
import type { SessionContext } from "@/core/security/session";
import type {
  RetailOrder,
  RetailStore,
  RetailPromotion,
  RetailChannel,
  RetailShift,
  POSDevice,
  BranchDevice,
  CCTVCamera,
  BranchSensor,
  RetailOrderItem,
  RetailProduct,
} from "@/core/types/retail/retail";

export const retailService = {
  // --- 1. Access Control & Scope (Now handled by backend or thin wrapper) ---
  async validateAccess(
    tenantId: string,
    employeeId: string,
    storeId: string,
    session: SessionContext,
  ) {
    return apiRequest<{ valid: boolean }>(
      "/v1/retail/validate-access",
      "POST",
      session,
      { storeId },
    );
  },

  async enforceScope(
    tenantId: string,
    session: SessionContext,
    storeId: string,
    shiftId?: string,
  ) {
    // This is essentially a client-side guard that might call a validation endpoint
    // or simply rely on the fact that subsequent API calls will fail if scope is invalid.
    return apiRequest<{ valid: boolean }>(
      "/v1/retail/enforce-scope",
      "POST",
      session,
      { storeId, shiftId },
    );
  },

  async listStores(tenantId: string, session: SessionContext) {
    return apiRequest<RetailStore[]>("/v1/retail/stores", "GET", session);
  },

  async listCategories(tenantId: string, session: SessionContext) {
    return apiRequest<{ id: string; name: string }[]>(
      "/v1/retail/categories",
      "GET",
      session,
    );
  },

  async getStore(tenantId: string, storeId: string, session: SessionContext) {
    return apiRequest<RetailStore>(`/v1/retail/stores/${storeId}`, "GET", session);
  },


  async createStore(
    tenantId: string,
    session: SessionContext,
    store: Partial<RetailStore>,
  ) {
    // Map frontend camelCase to backend snake_case for CreateStoreDto
    // Support both if already mapped in caller
    const payload = {
      ...store,
      location_id: (store as any).location_id || store.locationId,
      manager_id: (store as any).manager_id || store.managerId,
      inventory_pool_id: (store as any).inventory_pool_id || store.inventoryPoolId,
      tax_zone: (store as any).tax_zone || store.taxZone,
    };
    return apiRequest<RetailStore>("/v1/retail/stores", "POST", session, payload);
  },

  async updateStore(
    tenantId: string,
    session: SessionContext,
    store: RetailStore,
  ) {
    const pickAndClean = (obj: unknown, keys: string[]) => {
      if (!obj || typeof obj !== "object") return undefined;
      const res = {} as Record<string, unknown>;
      keys.forEach((k) => {
        const val = (obj as Record<string, unknown>)[k];
        if (val !== undefined && val !== null) {
          res[k] = val;
        }
      });
      return Object.keys(res).length > 0 ? res : undefined;
    };

    const payload = {
      name: store.name,
      location_id: store.locationId,
      type: store.type,
      status: store.status,
      phone: store.phone,
      email: store.email,
      timezone: store.timezone,
      manager_id: store.managerId,
      inventory_pool_id: store.inventoryPoolId,
      currency: store.currency,
      tax_zone: store.taxZone,

      operational_config: pickAndClean(store.operationalConfig, [
        "business_hours_template",
        "default_shift_model",
        "enabled_modules",
        "pos_device_limit",
        "self_checkout_enabled",
        "payment_methods_allowed",
        "refund_policy_mode",
        "auto_close_shift_setting",
        "tax_rate",
        "tax_inclusive",
      ]),

      supply_config: pickAndClean(store.supplyConfig, [
        "default_inbound_warehouse_id",
        "transfer_priority_policy",
        "replenishment_rule_set",
        "safety_stock_policy",
        "auto_reorder_threshold_template",
        "fulfillment_fallback_routing",
      ]),

      infrastructure_registry: pickAndClean(store.infrastructureRegistry, [
        "registered_device_ids",
        "pos_clusters",
        "scanner_pools",
        "local_server_binding",
        "sync_interval",
        "offline_tolerance_threshold",
      ]),

      channel_binding: pickAndClean(store.channelBinding, [
        "linked_ecommerce_store_id",
        "marketplace_integrations",
        "channel_priority",
        "order_routing_logic",
        "online_to_offline_sync_policy",
      ]),

      governance: pickAndClean(store.governance, [
        "license_status",
        "activation_date",
        "activation_source",
        "compliance_level",
        "audit_frequency_tier",
        "data_retention_policy",
        "decommission_trigger",
      ]),
    };

    console.log("[retailService] updateStore payload:", payload);

    return apiRequest<RetailStore>(
      `/v1/retail/stores/${store.id}`,
      "PUT",
      session,
      payload,
    );
  },

  async deleteStore(
    tenantId: string,
    session: SessionContext,
    storeId: string,
  ) {
    return apiRequest<{ success: boolean }>(
      `/v1/retail/stores/${storeId}`,
      "DELETE",
      session,
    );
  },

  async listOrders(
    tenantId: string,
    session: SessionContext,
    options?: {
      store_id?: string;
      customer_id?: string;
      ecommerce_id?: string;
      status?: string;
    },
  ) {
    const qs = new URLSearchParams();
    if (options?.store_id) qs.set("store_id", options.store_id);
    if (options?.customer_id) qs.set("customer_id", options.customer_id);
    if (options?.ecommerce_id) qs.set("ecommerce_id", options.ecommerce_id);
    if (options?.status) qs.set("status", options.status);

    const path = qs.toString()
      ? `/v1/retail/orders?${qs.toString()}`
      : "/v1/retail/orders";
    return apiRequest<RetailOrder[]>(path, "GET", session);
  },

  async listCustomers(
    tenantId: string,
    session: SessionContext,
    options?: { ecommerce_id?: string; q?: string },
  ) {
    const qs = new URLSearchParams();
    if (options?.ecommerce_id) qs.set("ecommerce_id", options.ecommerce_id);
    if (options?.q) qs.set("q", options.q);

    const path = qs.toString()
      ? `/v1/retail/customers?${qs.toString()}`
      : "/v1/retail/customers";
    return apiRequest<any[]>(path, "GET", session);
  },

  async getEcommerceAnalytics(
    tenantId: string,
    session: SessionContext,
    ecommerce_id?: string,
  ) {
    const path = ecommerce_id
      ? `/v1/retail/analytics/ecommerce?ecommerce_id=${ecommerce_id}`
      : "/v1/retail/analytics/ecommerce";
    return apiRequest<any>(path, "GET", session);
  },

  async updateOrderStatus(
    tenantId: string,
    session: SessionContext,
    orderId: string,
    status: RetailOrder["status"],
  ) {
    return apiRequest<RetailOrder>(
      `/v1/retail/orders/${orderId}/status`,
      "PATCH",
      session,
      { status },
    );
  },

  async voidOrder(
    tenantId: string,
    session: SessionContext,
    orderId: string,
  ) {
    return apiRequest<RetailOrder>(
      `/v1/retail/orders/${orderId}/void`,
      "POST",
      session
    );
  },

  async cancelOrder(
    tenantId: string,
    session: SessionContext,
    orderId: string,
  ) {
    return apiRequest<RetailOrder>(
      `/v1/retail/orders/${orderId}/cancel`,
      "POST",
      session
    );
  },



  async listDevices(
    tenantId: string,
    session: SessionContext,
    storeId?: string,
  ) {
    const path = storeId
      ? `/v1/retail/devices?store_id=${storeId}`
      : "/v1/retail/devices";
    return apiRequest<BranchDevice[]>(path, "GET", session);
  },

  async registerDevice(
    tenantId: string,
    session: SessionContext,
    device: Partial<BranchDevice>,
  ) {
    const payload = {
      ...device,
      store_id: device.locationId,
      ip_address: device.ipAddress,
      serialNumber: device.serialNumber, // Check if backend expects serial_number
    };
    return apiRequest<BranchDevice>("/v1/retail/devices", "POST", session, payload);
  },

  async listCCTVs(tenantId: string, session: SessionContext, storeId?: string) {
    const path = storeId
      ? `/v1/retail/cctvs?store_id=${storeId}`
      : "/v1/retail/cctvs";
    return apiRequest<CCTVCamera[]>(path, "GET", session);
  },

  async validateCCTVConnection(
    tenantId: string,
    session: SessionContext,
    camera: Partial<CCTVCamera>,
  ) {
    return apiRequest<{ success: boolean; message?: string }>(
      "/v1/retail/cctvs/validate",
      "POST",
      session,
      camera,
    );
  },

  async registerCCTV(
    tenantId: string,
    session: SessionContext,
    camera: Partial<CCTVCamera>,
  ) {
    return apiRequest<CCTVCamera>("/v1/retail/cctvs", "POST", session, camera);
  },

  async listSensors(
    tenantId: string,
    session: SessionContext,
    storeId?: string,
  ) {
    const path = storeId
      ? `/v1/retail/sensors?store_id=${storeId}`
      : "/v1/retail/sensors";
    return apiRequest<BranchSensor[]>(path, "GET", session);
  },

  async registerSensor(
    tenantId: string,
    session: SessionContext,
    sensor: Partial<BranchSensor>,
  ) {
    const payload = {
      ...sensor,
      store_id: sensor.locationId,
    };
    return apiRequest<BranchSensor>("/v1/retail/sensors", "POST", session, payload);
  },

  async listInventory(
    tenantId: string,
    session: SessionContext,
    options?: {
      page?: number;
      pageSize?: number;
      categoryId?: string;
      type?: string;
      minPrice?: number;
      maxPrice?: number;
      q?: string;
      sortBy?: "name" | "price" | "createdAt" | "quantity";
      sortDir?: "asc" | "desc";
      locationId?: string;
    },
  ): Promise<
    RetailProduct[] & {
      meta: { total: number; page: number; pageSize: number };
    }
  > {
    type PaginatedArray<T> = T[] & {
      meta: { total: number; page: number; pageSize: number };
    };

    const qs = new URLSearchParams();
    if (options?.page) qs.set("page", String(options.page));
    if (options?.pageSize) qs.set("pageSize", String(options.pageSize));
    if (options?.categoryId) qs.set("category_id", options.categoryId);
    if (options?.type) qs.set("type", options.type);
    if (options?.minPrice !== undefined)
      qs.set("minPrice", String(options.minPrice));
    if (options?.maxPrice !== undefined)
      qs.set("maxPrice", String(options.maxPrice));
    if (options?.q) qs.set("q", options.q);
    if (options?.sortBy) qs.set("sortBy", options.sortBy);
    if (options?.sortDir) qs.set("sortDir", options.sortDir);
    if (options?.locationId) qs.set("location_id", options.locationId);
    const path = qs.toString()
      ? `/v1/retail/products?${qs.toString()}`
      : "/v1/retail/products";

    const response = await apiRequest<{
      items: unknown[]; // replaced any with unknown
      total: number;
      page: number;
      pageSize: number;
    }>(path, "GET", session);

    // apiRequest already extracts result.data.
    // Backend respond(payload) wraps payload in { success, data }.
    // So response IS the payload { items, total, page, pageSize }
    // or sometimes an array in legacy endpoints.

    const payload = Array.isArray(response)
      ? {
          items: response,
          total: response.length,
          page: 1,
          pageSize: response.length || 1,
        }
      : response || { items: [], total: 0, page: 1, pageSize: 1 };

    const items = payload.items || [];
    const totalCount = payload.total ?? items.length;
    const pageNum = payload.page ?? 1;
    const pageSizeNum = payload.pageSize ?? (items.length || 1);

    const mapped = (items || []).map((p: Record<string, unknown>) => ({
      ...p,
      tenantId: (p.tenant_id || p.tenantId || tenantId) as string,
      categoryId: (p.category_id || p.categoryId) as string,
      categoryName: (p.category_name ||
        p.categoryName ||
        (p.category as { name?: string })?.name) as string,
      basePrice: (p.base_price ?? p.basePrice ?? 0) as number,
      taxRate: (p.tax_rate ?? p.taxRate ?? 0) as number,
      unit: p.unit as string,
      status: (p.status as RetailProduct["status"]) ?? "active",
      createdAt: (p.created_at ?? p.createdAt) as string,
      updatedAt: (p.updated_at ?? p.updatedAt) as string,
      price: (p.base_price ?? p.basePrice ?? 0) as number,
      stock:
        (p.metadata as { stock_on_hand?: number; stockOnHand?: number })?.stock_on_hand ??
        (p.metadata as { stock_on_hand?: number; stockOnHand?: number })?.stockOnHand ??
        (p.stock as number) ??
        0,
      minBuffer: (p.metadata as { minBuffer?: number })?.minBuffer ?? 0,
    })) as RetailProduct[];

    const result = mapped as PaginatedArray<RetailProduct>;
    result.meta = { total: totalCount, page: pageNum, pageSize: pageSizeNum };
    return result;
  },

  async syncInventory(
    tenantId: string,
    session: SessionContext,
    options: { locationId: string },
  ) {
    // Triggers a backend inventory sync (ERP reconciliation) for the given location and
    // persists the resulting sync timestamp. Resolves to the sync summary so the caller can
    // surface success/error feedback and refresh stock levels.
    return apiRequest<{ success: boolean; syncedAt?: string; updatedCount?: number }>(
      "/v1/retail/inventory/sync",
      "POST",
      session,
      { store_id: options.locationId, location_id: options.locationId },
    );
  },

  // --- 2. Order Processing ---
  async createOrder(
    tenantId: string,
    session: SessionContext,
    storeId: string,
    deviceId: string,
    items: {
      productId: string;
      quantity: number;
      unitPrice: number;
      name?: string;
      discount?: number;
      taxRate?: number;
    }[],
    paymentMethod: "cash" | "card" | "qr" | "wallet",
    grandTotal: number,
    shiftId?: string,
    notes?: string,
    currency: string = "IDR",
    commissionAmount?: number,
  ) {
    return apiRequest<RetailOrder>("/v1/retail/orders", "POST", session, {
      store_id: storeId,
      terminal_id: deviceId, 
      items: items.map(item => ({
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        name: item.name,
        discount: item.discount,
        tax_rate: item.taxRate
      })),
      payment_method: paymentMethod,
      grand_total: grandTotal,
      shift_id: shiftId,
      currency: currency,
      commission_amount: commissionAmount,
      notes,
    });
  },

  async processPayment(
    tenantId: string,
    session: SessionContext,
    orderId: string,
    amount: number,
    method: "card" | "cash" | "qr",
    shiftId?: string,
  ) {
    return apiRequest<RetailOrder>(
      `/v1/retail/orders/${orderId}/payment`,
      "POST",
      session,
      {
        amount,
        method,
        shiftId,
        department_id: session.department_id,
      },
    );
  },

  async checkout(
    tenantId: string,
    session: SessionContext,
    checkoutData: {
      store_id: string;
      terminal_id: string;
      items: any[];
      payment_method: string;
      payment_received: number;
      grand_total: number;
      shift_id?: string;
      currency?: string;
      commission_amount?: number;
      payment_channel?: string;
      notes?: string;
    },
    idempotencyKey?: string,
  ) {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers["x-idempotency-key"] = idempotencyKey;
    }

    return apiRequest<RetailOrder>(
      "/v1/retail/checkout",
      "POST",
      session,
      {
        ...checkoutData,
        currency: checkoutData.currency || "IDR",
      },
      headers
    );
  },

  // --- 3. Promotion & Campaign Management ---
  async listPromotions(
    tenantId: string,
    session: SessionContext,
  ): Promise<RetailPromotion[]> {
    return apiRequest<RetailPromotion[]>("/v1/retail/promotions", "GET", session);
  },

  async createPromotion(
    tenantId: string,
    session: SessionContext,
    promotion: Omit<RetailPromotion, "id" | "tenantId" | "createdAt" | "updatedAt">,
  ) {
    return apiRequest<RetailPromotion>(
      "/v1/retail/promotions",
      "POST",
      session,
      promotion,
    );
  },

  async updatePromotion(
    tenantId: string,
    session: SessionContext,
    promotion: RetailPromotion,
  ) {
    return apiRequest<RetailPromotion>(
      `/v1/retail/promotions/${promotion.id}`,
      "PUT",
      session,
      promotion,
    );
  },

  // --- 4. Channel & Logic Estela Gea ---
  async listChannels(
    tenantId: string,
    session: SessionContext,
  ): Promise<RetailChannel[]> {
    return apiRequest<RetailChannel[]>("/v1/retail/channels", "GET", session);
  },

  async syncChannel(
    tenantId: string,
    session: SessionContext,
    channelId: string,
  ) {
    return apiRequest<{ success: boolean }>(
      `/v1/retail/channels/${channelId}/sync`,
      "POST",
      session,
    );
  },

  async createChannel(
    tenantId: string,
    session: SessionContext,
    channel: {
      name: string;
      type: RetailChannel["type"];
      sync_frequency?: string;
      provisionCredentials?: boolean;
      branchId?: string;
      domain?: string;
      gatewayUrl?: string;
      connector?: string;
      credentials?: {
        clientId: string;
        clientSecret: string;
      };
    },
  ) {
    const payload = {
      ...channel,
      branch_id: channel.branchId,
      sync_frequency: channel.syncFrequency || channel.sync_frequency,
    };
    return apiRequest<RetailChannel>(
      "/v1/retail/channels",
      "POST",
      session,
      payload,
    );
  },

  async deleteChannel(
    tenantId: string,
    session: SessionContext,
    channelId: string,
  ) {
    return apiRequest<{ success: boolean }>(
      `/v1/retail/channels/${channelId}`,
      "DELETE",
      session,
    );
  },

  async updateChannel(
    tenantId: string,
    session: SessionContext,
    channelId: string,
    updates: {
      name?: string;
      sync_frequency?: string;
      syncFrequency?: string;
      status?: RetailChannel["status"];
    },
  ) {
    return apiRequest<RetailChannel>(
      `/v1/retail/channels/${channelId}`,
      "PUT",
      session,
      updates,
    );
  },

  async rotateChannelCredentials(
    tenantId: string,
    session: SessionContext,
    channelId: string,
  ) {
    return apiRequest<{ clientId: string; clientSecret: string }>(
      `/v1/retail/channels/${channelId}/rotate-credentials`,
      "POST",
      session,
    );
  },

  async revokeChannelCredentials(
    tenantId: string,
    session: SessionContext,
    channelId: string,
  ) {
    return apiRequest<{ clientId: string }>(
      `/v1/retail/channels/${channelId}/revoke-credentials`,
      "POST",
      session,
    );
  },

  // --- 5. Device & IoT Fleet ---
  async pingDevice(
    tenantId: string,
    session: SessionContext,
    deviceId: string,
  ) {
    return apiRequest<{ success: boolean }>(
      `/v1/retail/devices/${deviceId}/ping`,
      "POST",
      session,
    );
  },

  async verifyTicket(
    tenantId: string,
    session: SessionContext,
    ticketId: string,
  ) {
    return apiRequest<{
      status: "valid" | "invalid" | "expired";
      type: string;
      issuedAt: string;
      balance: string;
    }>(`/v1/retail/verify/${ticketId}`, "GET", session);
  },


  async scanDevices(tenantId: string, session: SessionContext) {
    return apiRequest<unknown[]>("/v1/retail/devices/scan", "POST", session);
  },

  async commitScannedDevice(
    tenantId: string,
    session: SessionContext,
    discoveryId: string,
  ) {
    return apiRequest<BranchDevice>(
      `/v1/retail/devices/commit-scan/${discoveryId}`,
      "POST",
      session,
    );
  },

  // --- 6. Shift & Fiscal Integrity ---
  async openShift(
    tenantId: string,
    session: SessionContext,
    storeId: string,
    openingCash: number,
    terminalId: string = "terminal-pos"
  ) {
    return apiRequest<RetailShift>("/v1/retail/shifts/open", "POST", session, {
      store_id: storeId,
      opening_cash: openingCash,
      terminal_id: terminalId,
    });
  },

  async closeShift(
    tenantId: string,
    session: SessionContext,
    shiftId: string,
    closingCash: number,
    notes?: string,
    closingNote?: string,
    complianceNote?: string,
  ) {
    return apiRequest<RetailShift>(
      `/v1/retail/shifts/${shiftId}/close`,
      "PUT",
      session,
      {
        closing_cash: closingCash,
        notes,
        closing_note: closingNote,
        compliance_note: complianceNote,
      },
    );
  },

  async recordCashMovement(
    tenantId: string,
    shiftId: string,
    data: {
      amount: number;
      type: "CASH_OUT" | "CASH_IN";
      reason?: string;
      notes?: string;
    },
    session: SessionContext,
  ) {
    return apiRequest<any>(
      `/v1/retail/shifts/${shiftId}/cash-movement`,
      "POST",
      session,
      data,
    );
  },

  async reconcileShift(
    tenantId: string,
    session: SessionContext,
    shiftId: string,
  ) {
    return apiRequest<RetailShift>(
      `/v1/retail/shifts/${shiftId}/reconcile`,
      "POST",
      session
    );
  },


  async listShifts(
    tenantId: string,
    session: SessionContext,
    params?: {
      store_id?: string;
      employee_id?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    let path = "/v1/retail/shifts";
    if (params) {
      const query = new URLSearchParams();
      if (params.store_id) query.append("store_id", params.store_id);
      if (params.employee_id) query.append("employee_id", params.employee_id);
      if (params.limit) query.append("limit", params.limit.toString());
      if (params.offset) query.append("offset", params.offset.toString());
      path += `?${query.toString()}`;
    }
    return apiRequest<RetailShift[]>(path, "GET", session);
  },

  async processReturn(
    tenantId: string,
    session: SessionContext,
    orderId: string,
    itemIds: string[],
    shiftId?: string,
    conditions?: Array<{ productId: string; condition: 'good' | 'damaged_repairable' | 'damaged_unrepairable'; notes?: string }>,
  ) {
    return apiRequest<{ success: boolean }>(
      `/v1/retail/orders/${orderId}/return`,
      "POST",
      session,
      {
        itemIds,
        shiftId,
        conditions,
      },
    );
  },


  async submitOpname(
    tenantId: string,
    session: SessionContext,
    storeId: string,
    adjustments: { sku: string; actualCount: number }[],
    shiftId?: string,
  ) {
    return apiRequest<{ success: boolean }>(
      "/v1/retail/inventory/opname",
      "POST",
      session,
      {
        storeId,
        adjustments,
        shiftId,
      },
    );
  },

  async receiveGoods(
    tenantId: string,
    session: SessionContext,
    storeId: string,
    shipmentId: string,
    items: { itemId: string; received: number }[],
    shiftId?: string,
  ) {
    return apiRequest<{ success: boolean }>(
      "/v1/retail/inventory/receive",
      "POST",
      session,
      {
        storeId,
        shipmentId,
        items,
        shiftId,
      },
    );
  },

  async listInventoryPools(tenantId: string, session: SessionContext) {
    return apiRequest<Record<string, unknown>[]>(
      "/v1/retail/inventory-pools",
      "GET",
      session,
    );
  },

  async getInventoryStats(
    tenantId: string,
    session: SessionContext,
    options?: {
      categoryId?: string;
      type?: string;
      minPrice?: number;
      maxPrice?: number;
      q?: string;
    },
  ) {
    const qs = new URLSearchParams();
    if (options?.categoryId) qs.set("category_id", options.categoryId);
    if (options?.type) qs.set("type", options.type);
    if (options?.minPrice !== undefined)
      qs.set("minPrice", String(options.minPrice));
    if (options?.maxPrice !== undefined)
      qs.set("maxPrice", String(options.maxPrice));
    if (options?.q) qs.set("q", options.q);
    if (options?.locationId) qs.set("location_id", options.locationId);
    
    const path = qs.toString()
      ? `/v1/retail/inventory/stats?${qs.toString()}`
      : "/v1/retail/inventory/stats";

    const response = await apiRequest<{
      total: number;
      critical: number;
      lowStock: number;
      overstock: number;
      outOfStock: number;
      totalSOH: number;
      totalATS: number;
      totalItems: number;
      lowStockCount: number;
      outOfStockCount: number;
      totalValue: number;
      totalCapitalValue: number;
      currency?: string;
    }>(path, "GET", session);
    return response;
  },

  async updateProduct(
    tenantId: string,
    session: SessionContext,
    productId: string,
    data: Partial<RetailProduct> & {
      category_id?: string;
      base_price?: number;
    },
  ) {
    return apiRequest<RetailProduct>(
      `/v1/retail/products/${productId}`,
      "PATCH",
      session,
      data,
    );
  },

  async createProduct(
    tenantId: string,
    session: SessionContext,
    product: Partial<RetailProduct>,
  ) {
    const payload = {
      ...product,
      base_price: (product as any).base_price || product.price,
      category_id: (product as any).category_id || product.categoryId,
    };
    return apiRequest<RetailProduct>("/v1/retail/products", "POST", session, payload);
  },

  async deleteProduct(
    tenantId: string,
    session: SessionContext,
    productId: string,
  ) {
    return apiRequest<{ success: boolean }>(
      `/v1/retail/products/${productId}`,
      "DELETE",
      session,
    );
  },


  async listPendingItems(tenantId: string, session: SessionContext) {
    return apiRequest<RetailProduct[]>(
      "/v1/inventory/items/pending",
      "GET",
      session,
    );
  },

  async approveItem(tenantId: string, session: SessionContext, itemId: string) {
    return apiRequest<RetailProduct>(
      `/v1/inventory/items/${itemId}/approve`,
      "PUT",
      session,
    );
  },

  async rejectItem(tenantId: string, session: SessionContext, itemId: string) {
    return apiRequest<RetailProduct>(
      `/v1/inventory/items/${itemId}/reject`,
      "PUT",
      session,
    );
  },

  // --- 7. SKU & Barcode Generation (Wired to Backend) ---
  async generateSku(
    tenantId: string,
    session: SessionContext,
    category: string,
  ) {
    return apiRequest<{ sku: string }>(
      `/v1/inventory/generate-sku?category=${encodeURIComponent(category)}`,
      "GET",
      session,
    );
  },

  async generateBarcode(
    tenantId: string,
    session: SessionContext,
    sku: string,
  ) {
    return apiRequest<{ barcode: string }>(
      `/v1/inventory/generate-barcode?sku=${encodeURIComponent(sku)}`,
      "GET",
      session,
    );
  },

  async batchCreateItemsJson(
    tenantId: string,
    session: SessionContext,
    items: unknown[],
  ) {
    return apiRequest<{ success: boolean; data: unknown[] }>(
      "/v1/inventory/items/batch-json",
      "POST",
      session,
      { items },
    );
  },

  // --- 8. Governance & Auditing ---
  async logGovernanceAction(
    tenantId: string,
    session: SessionContext,
    entry: unknown,
  ) {
    return apiRequest<{ success: boolean }>(
      "/v1/retail/governance/log",
      "POST",
      session,
      entry,
    );
  },

  async getGovernanceAuditLog(
    tenantId: string,
    session: SessionContext,
    entityId: string,
  ) {
    return apiRequest<unknown[]>(
      `/v1/retail/governance/audit-log?entity_id=${encodeURIComponent(entityId)}`,
      "GET",
      session,
    );
  },

  async getCCTVEvents(
    tenantId: string,
    session: SessionContext,
    cameraId: string,
    date: string,
  ) {
    return apiRequest<Array<{ time: string; label: string; type: string }>>(
      `/v1/retail/cctvs/${cameraId}/events?date=${encodeURIComponent(date)}`,
      "GET",
      session,
    );
  },

  async getKioskTelemetry(
    tenantId: string,
    session: SessionContext,
    locationId: string,
  ) {
    return apiRequest<{ nodeId: string; powerStatus: string; latencyMs: number }>(
      `/v1/retail/kiosk/telemetry?location_id=${encodeURIComponent(locationId)}`,
      "GET",
      session,
    );
  },
  
  async recordHeartbeat(
    tenantId: string,
    session: SessionContext,
    data: {
      device_id: string;
      status: string;
      diagnostics?: any;
    }
  ) {
    return apiRequest<{ success: boolean }>(
      "/v1/retail/infrastructure/heartbeat",
      "POST",
      session,
      {
        deviceId: data.device_id,
        component: "TERMINAL_POS",
        status: data.status,
        metrics: data.diagnostics
      }
    );
  },

  // --- Inventory Bulk Operations ---
  async downloadInventoryTemplate(session: SessionContext) {
    return apiRequest<Blob>("/inventory/items/template", "GET", session, null, {
      responseType: "blob",
    });
  },

  async importInventoryCsv(session: SessionContext, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest<any>("/inventory/items/import", "POST", session, formData);
  },

  async bulkUploadInventoryImages(session: SessionContext, files: File[]) {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    return apiRequest<any>("/inventory/items/bulk-images", "POST", session, formData);
  },
};

