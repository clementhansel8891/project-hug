// src/core/events/retailEventTypes.ts

/**
 * Estela Gea Retail Event Types
 *
 * These are the ONLY allowed ecommerce → Estela Gea event names.
 * This is the contract that external ecommerce websites must follow.
 */

export type RetailEventType =
  | "user_register"
  | "user_login"
  | "user_logout"
  | "wishlist_add"
  | "wishlist_remove"
  | "cart_add"
  | "cart_remove"
  | "checkout_started"
  | "payment_success"
  | "payment_failed"
  | "product_view"
  | "search_query"
  | "filter_used"
  | "sort_used";
