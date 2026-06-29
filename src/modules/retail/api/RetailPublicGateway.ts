import { retailService } from "@/core/services/retail/retailService";
import type {
  ApiAuthHeaders,
  PublicProductDTO,
  PublicOrderRequestDTO,
  PublicOrderResponseDTO,
  ApiErrorResponse,
} from "@/core/types/retail/api";
import type { RetailChannel } from "@/core/types/retail/retail";
import type { SessionContext } from "@/core/security/session";
import { Roles } from "@/core/security/roles";

const createSystemSession = (tenantId: string): SessionContext => ({
  userId: "sys-api-gateway",
  tenantId,
  locationId: "system",
  role: Roles.SYSTEM,
  departmentId: "ops-retail",
  permissions: ["*"],
});

const isApiErrorResponse = (value: unknown): value is ApiErrorResponse =>
  typeof value === "object" &&
  value !== null &&
  "error" in value &&
  "code" in value &&
  typeof (value as Record<string, unknown>).code === "number";

export type RetailGatewayPushEvent = {
  eventId?: string;
  source?: string;
  type: string;
  tenantId: string;
  channelId?: string;
  payload?: Record<string, unknown>;
  occurredAt: string;
};

type RetailGatewayPushListener = (event: RetailGatewayPushEvent) => void;

/**
 * SIMULATED BACKEND CONTROLLER
 * In a real NestJS app, this would be decorated with @Controller('retail/public')
 */
export class RetailPublicGateway {
  private pushListeners = new Set<RetailGatewayPushListener>();
  private credentialRegistry = new Map<
    string,
    {
      tenantId: string;
      channelId?: string;
      clientSecret: string;
      updatedAt: string;
    }
  >();

  registerChannelCredentials(
    tenantId: string,
    credentials: { clientId: string; clientSecret: string; channelId?: string },
  ) {
    this.credentialRegistry.set(credentials.clientId, {
      tenantId,
      channelId: credentials.channelId,
      clientSecret: credentials.clientSecret,
      updatedAt: new Date().toISOString(),
    });
  }

  onPush(listener: RetailGatewayPushListener) {
    this.pushListeners.add(listener);
    return () => {
      this.pushListeners.delete(listener);
    };
  }

  emitPushEvent(event: Omit<RetailGatewayPushEvent, "occurredAt">) {
    this.dispatchPushEvent({
      ...event,
      occurredAt: new Date().toISOString(),
    });
  }

  private dispatchPushEvent(event: RetailGatewayPushEvent) {
    this.pushListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.warn("Retail Gateway push listener failed:", error);
      }
    });
    console.log("[RetailGateway] Push event", event);
  }

  private resolveRegisteredSecret(tenantId: string, clientId: string) {
    const entry = this.credentialRegistry.get(clientId);
    if (!entry || entry.tenantId !== tenantId) {
      return null;
    }
    return entry.clientSecret;
  }

  private async validateCredentials(
    tenantId: string,
    headers: ApiAuthHeaders,
  ): Promise<RetailChannel> {
    const clientId = headers["x-client-id"];
    const clientSecret = headers["x-client-secret"];

    if ((clientId && !clientSecret) || (!clientId && clientSecret)) {
      throw {
        code: 401,
        error: "Unauthorized",
        details: "Missing Channel Client Credentials",
      };
    }

    if (!clientId && !clientSecret) {
      throw {
        code: 401,
        error: "Unauthorized",
        details: "Missing Channel Client Credentials",
      };
    }

    const resolvedClientSecret = clientSecret ?? "";
    const resolvedClientId = clientId ?? "";

    if (resolvedClientId && resolvedClientId === "YOUR_CLIENT_ID") {
      throw {
        code: 403,
        error: "Configuration Error",
        details:
          "You must replace 'YOUR_CLIENT_ID' with the actual client id generated in the Commerce Hub.",
      };
    }

    if (resolvedClientSecret === "YOUR_CLIENT_SECRET") {
      throw {
        code: 403,
        error: "Configuration Error",
        details:
          "You must replace the placeholder secret with the Channel Client Secret generated in the Commerce Hub.",
      };
    }

    if (resolvedClientId && !resolvedClientId.startsWith("znx_")) {
      throw {
        code: 403,
        error: "Forbidden",
        details: `Invalid Client ID Format. Expected 'znx_' but got '${resolvedClientId.substring(0, 4)}...'`,
      };
    }

    if (!resolvedClientSecret.startsWith("sk_test_")) {
      throw {
        code: 403,
        error: "Forbidden",
        details: `Invalid Client Secret Format. Expected 'sk_test_' but got '${resolvedClientSecret.substring(0, 6)}...'`,
      };
    }

    const session = createSystemSession(tenantId);
    const channels = await retailService.listChannels(tenantId, session);
    const matchedChannel = channels.find(
      (channel) => (channel.clientId ?? channel.channelId) === resolvedClientId,
    );

    if (!matchedChannel) {
      throw {
        code: 403,
        error: "Forbidden",
        details: "Client ID not recognized for this tenant.",
      };
    }

    const storedSecret =
      matchedChannel.clientSecret ??
      this.resolveRegisteredSecret(tenantId, resolvedClientId);

    if (!storedSecret) {
      throw {
        code: 403,
        error: "Forbidden",
        details: "Client secret not registered for this channel.",
      };
    }

    if (storedSecret !== resolvedClientSecret) {
      throw {
        code: 403,
        error: "Forbidden",
        details: "Client secret mismatch.",
      };
    }

    return matchedChannel;
  }

  async getProducts(
    tenantId: string,
    headers: ApiAuthHeaders,
  ): Promise<PublicProductDTO[] | ApiErrorResponse> {
    try {
      await this.validateCredentials(tenantId, headers);

      const session = createSystemSession(tenantId);
      const internalProducts = await retailService.listInventory(
        tenantId,
        session,
      );

      return (Array.isArray(internalProducts) ? internalProducts : []).map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        price: p.price,
        stockLevel:
          p.stock > 10
            ? "IN_STOCK"
            : p.stock > 0
              ? "LOW_STOCK"
              : "OUT_OF_STOCK",
        categoryId: p.categoryId,
        maxQuantity: p.stock,
      }));
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  async createOrder(
    tenantId: string,
    headers: ApiAuthHeaders,
    body: PublicOrderRequestDTO,
  ): Promise<PublicOrderResponseDTO | ApiErrorResponse> {
    try {
      await this.validateCredentials(tenantId, headers);

      if (!body.items || body.items.length === 0) {
        throw {
          code: 400,
          error: "Bad Request",
          details: "Order must contain items",
        };
      }

      // Convert Public DTO to Internal Service Call
      // We need a "System Session" context for this background job
      const session = createSystemSession(tenantId);

      // We need to resolve SKU to Item ID
      const inventory = await retailService.listInventory(tenantId, session);
      const orderItems = (Array.isArray(body.items) ? body.items : []).map((pubItem) => {
        const internalItem = inventory.find((i) => i.sku === pubItem.sku);
        if (!internalItem) {
          throw {
            code: 404,
            error: "Not Found",
            details: `SKU ${pubItem.sku} not found in catalog`,
          };
        }
        return {
          productId: internalItem.id,
          quantity: pubItem.quantity,
          unitPrice: internalItem.price,
          name: internalItem.name,
        };
      });

      // Pick a default store for online orders (First active store)
      const stores = await retailService.listStores(tenantId, session);
      const fulfillmentStore = stores[0];
      if (!fulfillmentStore)
        throw {
          code: 500,
          error: "Config Error",
          details: "No active fulfillment store configured",
        };

      // Calculate total amount from items
      const grandTotal = orderItems.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0,
      );

      // Create Order
      const order = await retailService.createOrder(
        tenantId,
        session,
        fulfillmentStore.id,
        "dev-api-gateway",
        orderItems,
        (body.paymentMethod?.toLowerCase() || "card") as any,
        grandTotal,
        undefined,
      );

      // Auto-Process Payment if marked as PAID
      if (body.paymentStatus === "PAID") {
        await retailService.processPayment(
          tenantId,
          session,
          order.id,
          order.totalAmount,
          (body.paymentMethod?.toLowerCase() || "card") as
            | "card"
            | "cash"
            | "qr",
          undefined,
        );
      }

      return {
        orderId: order.id,
        status: "PROCESSING",
        totalAmount: order.totalAmount,
        estimatedDelivery: "3-5 Business Days",
        message: "Order received and pushed to fulfillment queue.",
      };
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  async handleRequest(
    tenantId: string,
    request: {
      method: string;
      path: string;
      headers: ApiAuthHeaders;
      body?: unknown;
    },
  ) {
    try {
      const method = request.method.toUpperCase();
      const path = request.path.startsWith("/")
        ? request.path
        : `/${request.path}`;

      if (method === "GET" && path === "/products") {
        return await this.getProducts(tenantId, request.headers);
      }

      if (method === "POST" && path === "/orders") {
        return await this.createOrder(
          tenantId,
          request.headers,
          request.body as PublicOrderRequestDTO,
        );
      }

      if (method === "POST") {
        const syncMatch = path.match(/^\/channels\/([^/]+)\/sync$/);
        const requestedChannelId =
          syncMatch?.[1] ?? this.resolveChannelIdFromBody(request.body);
        if (path === "/sync" || syncMatch) {
          const channel = await this.validateCredentials(
            tenantId,
            request.headers,
          );
          const channelId = requestedChannelId ?? channel.id;

          if (requestedChannelId && requestedChannelId !== channel.id) {
            throw {
              code: 403,
              error: "Forbidden",
              details: "Channel mismatch for provided credentials.",
            };
          }

          const session = createSystemSession(tenantId);
          const result = await retailService.syncChannel(
            tenantId,
            session,
            channelId,
          );
          this.emitPushEvent({
            type: "channel.sync",
            tenantId,
            channelId,
            payload: result as Record<string, unknown>,
          });
          return result;
        }
      }

      throw {
        code: 404,
        error: "Not Found",
        details: "Endpoint not implemented in simulation",
      };
    } catch (error: unknown) {
      return this.handleError(error);
    }
  }

  private resolveChannelIdFromBody(body: unknown): string | null {
    if (!body || typeof body !== "object") {
      return null;
    }
    const payload = body as Record<string, unknown>;
    if (typeof payload.channelId === "string") {
      return payload.channelId;
    }
    if (typeof payload.id === "string") {
      return payload.id;
    }
    return null;
  }

  private handleError(error: unknown): ApiErrorResponse {
    console.error("API Gateway Error:", error);
    if (isApiErrorResponse(error)) {
      return error;
    }

    if (error instanceof Error) {
      return {
        error: error.message || "Internal Server Error",
        code: 500,
        details: error.stack ?? error.message,
      };
    }

    if (typeof error === "object" && error !== null) {
      const errObj = error as Record<string, unknown>;
      return {
        error:
          typeof errObj.error === "string"
            ? errObj.error
            : "Internal Server Error",
        code: typeof errObj.code === "number" ? errObj.code : 500,
        details:
          typeof errObj.details === "string"
            ? errObj.details
            : "No additional details provided",
      };
    }

    return {
      error: "Internal Server Error",
      code: 500,
      details: "Unknown error",
    };
  }
}

interface RetailWindow extends Window {
  Estela Gea?: {
    RetailGateway?: RetailPublicGateway;
  };
}

export const retailGateway = new RetailPublicGateway();

// Expose for "External Website" Simulation (Window Bridge)
if (typeof window !== "undefined") {
  const estelageaWindow = window as RetailWindow;
  estelageaWindow.Estela Gea = estelageaWindow.Estela Gea || {};
  estelageaWindow.Estela Gea.RetailGateway = retailGateway;
  console.log(
    "🔌 Retail Public Gateway exposed at window.Estela Gea.RetailGateway",
  );
}
