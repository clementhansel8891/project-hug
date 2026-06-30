/**
 * Storefront order lifecycle (the "WhatsApp flow").
 *
 * The storefront drives itself forward by polling `GET /orders/:id/status`,
 * which must return one of these ZENVIX stages exactly. Stages advance via
 * `POST /orders/:id/transitions` and via stage-implying lifecycle events
 * posted to `POST /events/orders`.
 */
export const ZENVIX_ORDER_STAGES = [
  "SUBMITTED",
  "QUOTATION_PENDING",
  "QUOTATION_SENT",
  "PAYMENT_PENDING",
  "PAYMENT_CONFIRMED",
  "PREPARED",
  "SHIPPED",
  "COMPLETED",
] as const;

export type ZenvixOrderStage = (typeof ZENVIX_ORDER_STAGES)[number];

/** audit_logs.action used to persist the current workflow stage of an order. */
export const ORDER_STAGE_ACTION = "retail.order.stage";

/** audit_logs.entity_type used for all storefront order lifecycle rows. */
export const ORDER_ENTITY_TYPE = "retail_order";

const STAGE_SET = new Set<string>(ZENVIX_ORDER_STAGES);

export function isValidStage(stage: unknown): stage is ZenvixOrderStage {
  return typeof stage === "string" && STAGE_SET.has(stage);
}

/**
 * Map the internal POS/order status (lowercase) onto a ZENVIX stage. Used as
 * the fallback for `GET /orders/:id/status` when no explicit stage marker has
 * been recorded yet (e.g. immediately after order creation).
 */
export function mapInternalStatusToStage(internalStatus?: string): ZenvixOrderStage {
  switch ((internalStatus ?? "").toLowerCase()) {
    case "reserved":
    case "received":
    case "pending":
    case "draft":
      return "SUBMITTED";
    case "paid":
      return "PAYMENT_CONFIRMED";
    case "prepared":
    case "preparing":
      return "PREPARED";
    case "shipped":
    case "dispatched":
      return "SHIPPED";
    case "completed":
    case "fulfilled":
      return "COMPLETED";
    default:
      return "SUBMITTED";
  }
}

/**
 * Lifecycle events posted to `POST /events/orders` that also imply a forward
 * workflow stage. Recording one of these advances the stage the storefront
 * sees when polling, in addition to being logged for analytics/audit.
 */
export const ORDER_EVENT_IMPLIED_STAGE: Record<string, ZenvixOrderStage> = {
  "order.quotation_recorded": "QUOTATION_SENT",
  "payment.completed": "PAYMENT_CONFIRMED",
  "sales.completion": "COMPLETED",
};
