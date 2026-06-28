import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../persistence/prisma.service";
import { RetailService } from "./retail.service";

type RetailEventActor = {
  id: string;
  type: string;
};

type RetailEventScope = {
  tenant_id: string;
  branch_id?: string;
  ecommerceId?: string;
};

export type RetailEvent = {
  type: string;
  actor: RetailEventActor;
  timestamp: string;
  payload?: Record<string, any>;
  scope?: RetailEventScope;
  audit?: { traceId?: string };
};

@Injectable()
export class RetailEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly retailService: RetailService,
  ) {}

  async appendEvent(event: RetailEvent) {
    const auditEntry = await this.prisma.audit_logs.create({
      data: {
          updated_at: new Date(),
        id: crypto.randomUUID(),
        tenant_id: event.scope?.tenant_id!,
        module: "retail",
        action: event.type,
        entity_type: "event",
        entity_id: event.audit?.traceId ?? crypto.randomUUID(),
        user_id: event.actor.id,
        changes: (event.payload as any) ?? {},
        metadata: {
          scope: event.scope,
          timestamp: event.timestamp,
          actorType: event.actor.type,
        } as any,
        created_at: new Date(),
      },
    });

    return {
      key: `audit:retail:${auditEntry.id}`,
      count: 1,
    };
  }

  async processEvent(event: RetailEvent) {
    switch (event.type) {
      case "payment_success": {
        return this.processPaymentSuccess(event);
      }
      case "cart_add": {
        return { action: "interest_logged", sku: event.payload?.sku };
      }
      case "user_register": {
        return {
          action: "customer_registration_received",
          customer_id: event.actor.id,
        };
      }
      default:
        return { action: "event_recorded", type: event.type };
    }
  }

  private async processPaymentSuccess(event: RetailEvent) {
    const payload = event.payload ?? {};
    const tenant_id = payload.tenant_id ?? event.scope?.tenant_id;

    if (!tenant_id) {
      return { action: "skipped", reason: "missing_tenant_id" };
    }

    const order_id = payload.order_id;
    if (order_id) {
      const existing = await this.prisma.retail_orders.findFirst({
        where: { id: order_id, tenant_id: tenant_id },
      });
      if (existing) {
        return { action: "ignored_duplicate", order_id };
      }
    }

    // 1. Resolve Fulfillment Store
    const stores = await this.retailService.listStores(tenant_id);
    const store =
      stores.find(
        (s) => s.id === payload.store_id || s.id === event.scope?.branch_id,
      ) ?? stores[0];

    if (!store) {
      return { action: "skipped", reason: "no_stores_configured" };
    }

    // 2. Resolve Items
    const itemsPayload = Array.isArray(payload.items) ? payload.items : [];
    const { items: availableProducts } = await this.retailService.listProducts(
      tenant_id,
      { page: 1, pageSize: 500 },
    );

    const resolvedItems = itemsPayload
      .map((item: any) => {
        const product = availableProducts.find(
          (p) =>
            p.sku === item.sku ||
            p.id === item.product_id ||
            p.id === item.item_id,
        );
        if (!product) return null;

        return {
          product_id: product.id,
          quantity: String(item.quantity ?? 1),
          unit_price: String(
            item.unit_price ?? item.unit_price ?? product.base_price,
          ),
        };
      })
      .filter((i): i is NonNullable<typeof i> => i !== null);

    if (resolvedItems.length === 0) {
      return { action: "skipped", reason: "no_valid_items" };
    }

    const grand_total = resolvedItems.reduce(
      (sum: Prisma.Decimal, item: any) =>
        sum.add(
          new Prisma.Decimal(String(item.unit_price)).mul(item.quantity),
        ),
      new Prisma.Decimal(0),
    );

    // 3. Create Order via Core Service (Triggers Stock Reservation & Auditing)
    const order = await this.retailService.createOrder(
      tenant_id,
      store.location_id,
      {
        store_id: store.id,
        terminal_id: payload.device_id ?? "event-processor",
        customer_id: payload.customer?.email ?? payload.customer_id,
        items: resolvedItems,
        payment_method: (payload.payment_method as any) ?? "card",
        grand_total: grand_total.toString(),
      },
      event.actor.id,
    );

    // 4. Process Payment via Core Service (Triggers Stock Consumption & Finance Ledger)
    const tax_amount = await this.retailService.calculateTax(tenant_id, order.id);
    await this.retailService.processPayment(
      tenant_id,
      order.id,
      {
        amount: (order.grand_total as unknown as Prisma.Decimal).add(tax_amount),
        method: (payload.payment_method as any) ?? "card",
      },
      event.actor.id,
    );

    return { action: "order_synced", order_id: order.id, status: "completed" };
  }
}
