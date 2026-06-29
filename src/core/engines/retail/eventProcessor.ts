// src/core/engines/retail/eventProcessor.ts

import { RetailEvent } from "@/core/events/retailEvents";
import { retailRepo } from "@/core/repositories/retail/retailRepo";
import type { CreateRetailOrderPayload } from "@/core/repositories/retail/retailRepo";

type PaymentSuccessPayload = Partial<CreateRetailOrderPayload> & {
  orderId?: string;
  tenantId?: string;
};

/**
 * processRetailEvent
 *
 * This is the REAL Retail Event Engine.
 *
 * Ledger stores events.
 * Engine decides which events produce business objects:
 *
 * - payment_success → create Order
 * - user_register   → create Customer profile (next step)
 * - cart_add        → update trending scores (future)
 */
export async function processRetailEvent(event: RetailEvent) {
  switch (event.type) {
    /**
     * PAYMENT SUCCESS → ORDER CREATION
     *
     * Requirement:
     * Ecommerce payment confirmation triggers Order creation in Estela Gea.
     */
    case "payment_success": {
      const payload = event.payload as PaymentSuccessPayload;
      const tenantId =
        payload.tenantId ?? event.scope?.tenantId;
      const orderId = payload.orderId ?? `ord-${Date.now()}`;
      const storeId = payload.storeId ?? event.scope?.branchId ?? "store-001";

      const orderPayload: CreateRetailOrderPayload = {
        id: orderId,
        storeId,
        deviceId: payload.deviceId ?? "api-gateway",
        cashierId: payload.cashierId ?? event.actor.id,
        status: payload.status ?? "paid",
        items: payload.items ?? [],
        totalAmount: payload.totalAmount ?? 0,
        subtotal: payload.subtotal,
        tax: payload.tax,
        paymentMethod: payload.paymentMethod,
        paymentReference: payload.paymentReference,
        customer: payload.customer,
      };

      const existing = (await retailRepo.listOrders(tenantId)).find(
        (o) => o.id === orderId,
      );

      if (existing) {
        return {
          action: "ignored_duplicate",
          orderId,
        };
      }

      await retailRepo.createOrder(tenantId, orderPayload);

      return {
        action: "order_created",
        orderId,
      };
    }

    /**
     * CART INTEREST EVENT
     */
    case "cart_add": {
      return {
        action: "interest_logged",
        sku: event.payload.sku,
      };
    }

    /**
     * USER REGISTER (Next milestone)
     */
    case "user_register": {
      return {
        action: "customer_registration_received",
        customerId: event.actor.id,
      };
    }

    /**
     * Default: Only audit log
     */
    default:
      return {
        action: "event_recorded",
        type: event.type,
      };
  }
}
