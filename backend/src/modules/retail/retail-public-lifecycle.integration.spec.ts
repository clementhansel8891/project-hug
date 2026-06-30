import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "crypto";
import { RetailGatewayService } from "./retail-gateway.service";

/**
 * Integration-style test for the storefront order lifecycle (the WhatsApp flow):
 *
 *   register → create order → transition → poll status → sales.completion
 *
 * It wires the real RetailGatewayService against an in-memory `audit_logs`
 * store and a stubbed RetailService, so stage markers written by createOrder /
 * transitions / lifecycle events are genuinely read back by getOrderStatus.
 */

const CLIENT_ID = "client-abc";
const CLIENT_SECRET = "super-secret";
const TENANT_ID = "tnt-3rlhko";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function buildHarness() {
  // In-memory stores with the relevant query semantics.
  const auditRows: any[] = [];
  const orders = new Map<string, any>();
  let seq = 0;

  const prisma: any = {
    companies: {
      findFirst: vi.fn(async () => ({ id: "company-1" })),
    },
    employees: {
      findMany: vi.fn(async () => [{ id: "emp-system", first_name: "System" }]),
    },
    retail_orders: {
      findFirst: vi.fn(async ({ where }: any) => {
        const o = orders.get(where.id);
        if (!o) return null;
        if (where.tenant_id && o.tenant_id !== where.tenant_id) return null;
        return o;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const o = orders.get(where.id);
        if (!o || (where.tenant_id && o.tenant_id !== where.tenant_id)) {
          return { count: 0 };
        }
        Object.assign(o, data);
        return { count: 1 };
      }),
    },
    audit_logs: {
      create: vi.fn(async ({ data }: any) => {
        if (data.idempotency_key) {
          const dup = auditRows.find(
            (r) =>
              r.tenant_id === data.tenant_id &&
              r.idempotency_key === data.idempotency_key,
          );
          if (dup) {
            const err: any = new Error("Unique constraint failed");
            err.code = "P2002";
            throw err;
          }
        }
        const row = { ...data, _seq: ++seq };
        auditRows.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where, orderBy }: any) => {
        let rows = auditRows.filter(
          (r) =>
            (where.tenant_id === undefined || r.tenant_id === where.tenant_id) &&
            (where.entity_type === undefined ||
              r.entity_type === where.entity_type) &&
            (where.entity_id === undefined || r.entity_id === where.entity_id) &&
            (where.action === undefined || r.action === where.action),
        );
        if (orderBy?.created_at === "desc") {
          rows = [...rows].sort((a, b) => b._seq - a._seq);
        }
        return rows[0] ?? null;
      }),
    },
    _auditRows: auditRows,
    _orders: orders,
  };

  const retailService: any = {
    findChannelByClientId: vi.fn(async () => ({
      id: "chan-1",
      status: "active",
      credentials: { clientSecretHash: sha256(CLIENT_SECRET), revoked: false },
    })),
    findCustomerByEmail: vi.fn(async () => null),
    createCustomer: vi.fn(async (ctx: any, data: any) => ({
      id: "cust-1",
      tenant_id: ctx.tenant_id,
      name: data.name,
      email: data.email,
      phone: data.phone,
    })),
    createCustomerSession: vi.fn(async () => ({})),
    listStores: vi.fn(async () => [{ id: "store-1", location_id: "loc-1" }]),
    findProductBySku: vi.fn(async (_ctx: any, sku: string) => ({
      id: `prod-${sku}`,
      base_price: 100,
    })),
    createOrder: vi.fn(async (ctx: any) => {
      const row = {
        id: "order-1",
        tenant_id: ctx.tenant_id,
        status: "reserved",
        subtotal: 200,
        grand_total: 200,
        workflow_stage: "SUBMITTED",
        reservation_expires_at: null,
      };
      orders.set(row.id, row);
      return row;
    }),
    calculateTax: vi.fn(async () => 0),
    processPayment: vi.fn(async () => ({})),
  };

  const eventEmitter: any = { emit: vi.fn() };
  const chatService: any = {};

  const service = new RetailGatewayService(
    retailService,
    prisma,
    chatService,
    eventEmitter,
  );

  return { service, prisma, retailService, eventEmitter };
}

const ctx: any = { tenant_id: TENANT_ID, company_id: TENANT_ID };

describe("Storefront order lifecycle (register → order → transition → status → sales.completion)", () => {
  let h: ReturnType<typeof buildHarness>;

  beforeEach(() => {
    h = buildHarness();
  });

  it("registers a customer and issues tokens", async () => {
    const result = await h.service.registerCustomer(ctx, CLIENT_ID, CLIENT_SECRET, {
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "hunter2",
    } as any);

    expect(result.customer.id).toBe("cust-1");
    expect(typeof result.accessToken).toBe("string");
    expect(typeof result.refreshToken).toBe("string");
  });

  it("drives an order from SUBMITTED through to COMPLETED", async () => {
    // 1. Create order (PENDING) → initial SUBMITTED stage recorded.
    const order = await h.service.createOrder(ctx, CLIENT_ID, CLIENT_SECRET, {
      items: [{ sku: "SKU1", quantity: 2 }],
      customer: { name: "Ada", email: "ada@example.com" },
      payment_status: "PENDING",
      channel_record_id: "wa-123",
      external_reference: "EXT-9",
    } as any);

    expect(order.order_id).toBe("order-1");

    // Order is tagged with the channel id so the ecommerce-only sync includes it.
    expect(h.prisma._orders.get("order-1").ecommerce_id).toBe("chan-1");

    // 2. Poll status → SUBMITTED.
    let status = await h.service.getOrderStatus(ctx, CLIENT_ID, CLIENT_SECRET, "order-1");
    expect(status.status).toBe("SUBMITTED");

    // 3. Transition to QUOTATION_SENT, then poll.
    await h.service.recordTransition(ctx, CLIENT_ID, CLIENT_SECRET, "order-1", {
      from_stage: "SUBMITTED",
      to_stage: "QUOTATION_SENT",
    });
    status = await h.service.getOrderStatus(ctx, CLIENT_ID, CLIENT_SECRET, "order-1");
    expect(status.status).toBe("QUOTATION_SENT");

    // 4. Transition to PAYMENT_CONFIRMED.
    await h.service.recordTransition(ctx, CLIENT_ID, CLIENT_SECRET, "order-1", {
      from_stage: "QUOTATION_SENT",
      to_stage: "PAYMENT_CONFIRMED",
    });
    status = await h.service.getOrderStatus(ctx, CLIENT_ID, CLIENT_SECRET, "order-1");
    expect(status.status).toBe("PAYMENT_CONFIRMED");

    // 5. sales.completion → COMPLETED, emits exactly once.
    const completion = await h.service.recordOrderLifecycleEvent(
      ctx,
      CLIENT_ID,
      CLIENT_SECRET,
      {
        event_type: "sales.completion",
        order_id: "order-1",
        total: 200,
        items: [{ product_id: "prod-SKU1", quantity: 2, unit_price: 100 }],
        customer: { name: "Ada", email: "ada@example.com" },
        channel_record_id: "wa-123",
        timestamp: new Date().toISOString(),
      },
    );
    expect(completion.stage).toBe("COMPLETED");

    status = await h.service.getOrderStatus(ctx, CLIENT_ID, CLIENT_SECRET, "order-1");
    expect(status.status).toBe("COMPLETED");
    expect(h.eventEmitter.emit).toHaveBeenCalledWith(
      "retail.order.completed",
      expect.objectContaining({ order_id: "order-1" }),
    );
  });

  it("treats a repeated sales.completion as idempotent (no duplicate, no re-emit)", async () => {
    await h.service.createOrder(ctx, CLIENT_ID, CLIENT_SECRET, {
      items: [{ sku: "SKU1", quantity: 1 }],
      customer: { name: "Ada", email: "ada@example.com" },
      payment_status: "PENDING",
    } as any);

    const payload = {
      event_type: "sales.completion",
      order_id: "order-1",
      total: 100,
      timestamp: new Date().toISOString(),
    };

    const first = await h.service.recordOrderLifecycleEvent(ctx, CLIENT_ID, CLIENT_SECRET, payload);
    const second = await h.service.recordOrderLifecycleEvent(ctx, CLIENT_ID, CLIENT_SECRET, payload);

    expect((first as any).deduped).toBeUndefined();
    expect((second as any).deduped).toBe(true);

    // sales.completion persisted exactly once; emitted exactly once.
    const completions = h.prisma._auditRows.filter(
      (r: any) => r.action === "sales.completion",
    );
    expect(completions).toHaveLength(1);
    expect(h.eventEmitter.emit).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid transition target stage", async () => {
    await expect(
      h.service.recordTransition(ctx, CLIENT_ID, CLIENT_SECRET, "order-1", {
        to_stage: "NOT_A_REAL_STAGE",
      }),
    ).rejects.toThrow();
  });
});
