/**
 * Zod validation schemas for the Inventory module.
 *
 * Covers: Items, Stock Adjustments, Transfers, Import Jobs, Movements, and Images.
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 16.1
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Item Schemas
// ---------------------------------------------------------------------------

export const createItemSchema = z.object({
  sku: z
    .string()
    .min(1, "SKU is required")
    .max(50, "SKU must be at most 50 characters"),
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name must be at most 200 characters"),
  category: z.string().min(1, "Category is required"),
  uom: z.string().min(1, "Unit of measure is required"),
  base_price: z.coerce.number().min(0, "Base price must be 0 or greater").default(0),
  description: z.string().max(1000).optional().default(""),
  minStock: z.coerce.number().min(0).optional().default(0),
  status: z.string().optional().default("active"),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;

export const updateItemSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name must be at most 200 characters")
    .optional(),
  sku: z
    .string()
    .min(1, "SKU is required")
    .max(50, "SKU must be at most 50 characters")
    .optional(),
  category: z.string().min(1, "Category is required").optional(),
  category_id: z.string().optional(),
  uom: z.string().min(1, "Unit of measure is required").optional(),
  base_price: z.coerce.number().min(0, "Base price must be 0 or greater").optional(),
  selling_price: z.coerce.number().min(0).optional(),
  discount_rate: z.coerce.number().min(0).max(100).optional(),
  description: z.string().max(1000).optional(),
  status: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateItemInput = z.infer<typeof updateItemSchema>;

// ---------------------------------------------------------------------------
// Stock Adjustment Schema
// ---------------------------------------------------------------------------

export const stockAdjustmentSchema = z.object({
  item_id: z.string().min(1, "Item is required"),
  location_id: z.string().min(1, "Location is required"),
  department_id: z.string().optional().default(""),
  requested_delta: z.coerce.number().refine((val) => val !== 0, {
    message: "Delta must be non-zero",
  }),
  reason: z
    .string()
    .min(1, "Reason is required")
    .max(500, "Reason must be at most 500 characters"),
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

/**
 * Validates that applying a delta to the current balance won't result in a negative balance.
 * Returns an error message or null if valid.
 */
export function validateNonNegativeBalance(
  currentBalance: number,
  delta: number
): string | null {
  const newBalance = currentBalance + delta;
  if (newBalance < 0) {
    return `Insufficient stock: current balance is ${currentBalance}, adjustment of ${delta} would result in ${newBalance}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Transfer Schema
// ---------------------------------------------------------------------------

export const createTransferSchema = z
  .object({
    item_id: z.string().min(1, "Item is required"),
    from_location_id: z.string().min(1, "Origin location is required"),
    to_location_id: z.string().min(1, "Destination location is required"),
    quantity: z.coerce.number().positive("Quantity must be greater than 0"),
    from_department_id: z.string().optional().default(""),
    to_department_id: z.string().optional().default(""),
    reason: z.string().max(500).optional().default("Stock transfer"),
  })
  .refine((data) => data.from_location_id !== data.to_location_id, {
    message: "Origin and destination must be different",
    path: ["to_location_id"],
  });

export type CreateTransferInput = z.infer<typeof createTransferSchema>;

// ---------------------------------------------------------------------------
// Import Job Schema
// ---------------------------------------------------------------------------

export const importJobSchema = z.object({
  format: z.enum(["CSV", "Excel"], {
    required_error: "Format is required",
  }),
});

export type ImportJobInput = z.infer<typeof importJobSchema>;

// ---------------------------------------------------------------------------
// Movement Schema
// ---------------------------------------------------------------------------

export const createMovementSchema = z.object({
  item_id: z.string().min(1, "Item is required"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  type: z.enum(["IN", "OUT", "TRANSFER"], {
    required_error: "Movement type is required",
  }),
  location_id: z.string().min(1, "Location is required"),
  notes: z.string().max(500).optional().default(""),
});

export type CreateMovementInput = z.infer<typeof createMovementSchema>;

// ---------------------------------------------------------------------------
// Batch Intake Schema
// ---------------------------------------------------------------------------

export const batchIntakeRowSchema = z.object({
  item_id: z.string().min(1, "Product ID/SKU is required"),
  location_id: z.string().min(1, "Location is required"),
  department_id: z.string().optional().default(""),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unit_cost: z.coerce.number().min(0, "Unit cost must be 0 or greater").default(0),
  reason: z.string().optional().default("Batch Intake"),
});

export const batchIntakeSchema = z.object({
  items: z
    .array(batchIntakeRowSchema)
    .min(1, "At least one item is required"),
});

export type BatchIntakeInput = z.infer<typeof batchIntakeSchema>;

// ---------------------------------------------------------------------------
// Batch Transfer Schema
// ---------------------------------------------------------------------------

export const batchTransferSchema = z.object({
  to_location_id: z.string().min(1, "Destination location is required"),
  to_department_id: z.string().optional().default(""),
  reason: z.string().max(500).optional().default("Batch Internal Transfer"),
});

export type BatchTransferInput = z.infer<typeof batchTransferSchema>;

// ---------------------------------------------------------------------------
// Receiving Schema (Procurement Receipt)
// ---------------------------------------------------------------------------

export const receivingItemSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unit_cost: z.coerce.number().min(0, "Unit cost must be 0 or greater").default(0),
});

export const receivingSchema = z.object({
  location_id: z.string().min(1, "Location is required"),
  items: z
    .array(receivingItemSchema)
    .min(1, "At least one item is required"),
});

export type ReceivingInput = z.infer<typeof receivingSchema>;

// ---------------------------------------------------------------------------
// Audit Cycle Schema
// ---------------------------------------------------------------------------

export const startAuditCycleSchema = z.object({
  location_id: z.string().min(1, "Location is required"),
  department_id: z.string().optional().default(""),
  scope: z.enum(["LOCATION", "DEPARTMENT", "ITEM"], {
    required_error: "Scope is required",
  }),
});

export type StartAuditCycleInput = z.infer<typeof startAuditCycleSchema>;

// ---------------------------------------------------------------------------
// Courier/Integration Schema (replaces FutureIntegrationDialog stub)
// ---------------------------------------------------------------------------

export const courierDispatchSchema = z.object({
  transfer_id: z.string().min(1, "Transfer is required"),
  courier_name: z.string().min(1, "Courier name is required").max(100),
  tracking_number: z.string().max(100).optional().default(""),
  estimated_arrival: z.string().optional().default(""),
  notes: z.string().max(500).optional().default(""),
});

export type CourierDispatchInput = z.infer<typeof courierDispatchSchema>;

// ---------------------------------------------------------------------------
// Stock Count Schema (Physical Count Reconciliation)
// ---------------------------------------------------------------------------

export const stockCountSchema = z.object({
  item_id: z.string().min(1, "Item is required"),
  location_id: z.string().min(1, "Location is required"),
  counted_quantity: z.coerce.number().min(0, "Counted quantity must be 0 or greater"),
  notes: z.string().max(500).optional().default(""),
});

export type StockCountInput = z.infer<typeof stockCountSchema>;

// ---------------------------------------------------------------------------
// Reorder Point Schema (Set reorder point/level for items)
// ---------------------------------------------------------------------------

export const reorderPointSchema = z.object({
  item_id: z.string().min(1, "Item is required"),
  reorder_point: z.coerce.number().min(0, "Reorder point must be 0 or greater"),
  reorder_quantity: z.coerce.number().min(1, "Reorder quantity must be at least 1"),
  max_stock: z.coerce.number().min(1, "Max stock must be at least 1"),
});

export type ReorderPointInput = z.infer<typeof reorderPointSchema>;

// ---------------------------------------------------------------------------
// Category Assign Schema (Assign/change item category)
// ---------------------------------------------------------------------------

export const categoryAssignSchema = z.object({
  item_id: z.string().min(1, "Item is required"),
  category_id: z.string().min(1, "Category is required"),
});

export type CategoryAssignInput = z.infer<typeof categoryAssignSchema>;

// ---------------------------------------------------------------------------
// Image Upload Schema (Upload product images — metadata only, file is separate)
// ---------------------------------------------------------------------------

export const imageUploadSchema = z.object({
  item_id: z.string().min(1, "Item is required"),
  alt_text: z.string().max(200).optional().default(""),
  is_primary: z.boolean().optional().default(false),
});

export type ImageUploadInput = z.infer<typeof imageUploadSchema>;

// ---------------------------------------------------------------------------
// Location Assign Schema (Assign item to location/warehouse)
// ---------------------------------------------------------------------------

export const locationAssignSchema = z.object({
  item_id: z.string().min(1, "Item is required"),
  location_id: z.string().min(1, "Location is required"),
  bin_code: z.string().max(50).optional().default(""),
  initial_quantity: z.coerce.number().min(0, "Quantity must be 0 or greater").default(0),
});

export type LocationAssignInput = z.infer<typeof locationAssignSchema>;

// ---------------------------------------------------------------------------
// Bundle Config Schema (Configure item bundles/kits)
// ---------------------------------------------------------------------------

export const bundleConfigSchema = z.object({
  bundle_name: z.string().min(1, "Bundle name is required").max(200),
  bundle_sku: z.string().min(1, "Bundle SKU is required").max(50),
  description: z.string().max(500).optional().default(""),
  items: z
    .string()
    .min(1, "At least one item is required (comma-separated item IDs)"),
  price: z.coerce.number().min(0, "Price must be 0 or greater").default(0),
});

export type BundleConfigInput = z.infer<typeof bundleConfigSchema>;

// ---------------------------------------------------------------------------
// Variant Create Schema (Create product variants — size, color, etc.)
// ---------------------------------------------------------------------------

export const variantCreateSchema = z.object({
  parent_item_id: z.string().min(1, "Parent item is required"),
  variant_name: z.string().min(1, "Variant name is required").max(200),
  variant_sku: z.string().min(1, "Variant SKU is required").max(50),
  attributes: z.string().min(1, "Attributes are required (e.g. Color: Red, Size: L)"),
  price_adjustment: z.coerce.number().default(0),
});

export type VariantCreateInput = z.infer<typeof variantCreateSchema>;

// ---------------------------------------------------------------------------
// Price Update Schema (Update item pricing)
// ---------------------------------------------------------------------------

export const priceUpdateSchema = z.object({
  item_id: z.string().min(1, "Item is required"),
  base_price: z.coerce.number().min(0, "Base price must be 0 or greater"),
  selling_price: z.coerce.number().min(0, "Selling price must be 0 or greater"),
  discount_rate: z.coerce.number().min(0).max(100, "Discount must be 0-100%").default(0),
});

export type PriceUpdateInput = z.infer<typeof priceUpdateSchema>;

// ---------------------------------------------------------------------------
// Supplier Link Schema (Link items to suppliers)
// ---------------------------------------------------------------------------

export const supplierLinkSchema = z.object({
  item_id: z.string().min(1, "Item is required"),
  supplier_id: z.string().min(1, "Supplier is required"),
  supplier_sku: z.string().max(100).optional().default(""),
  lead_time_days: z.coerce.number().min(0, "Lead time must be 0 or greater").default(0),
  unit_cost: z.coerce.number().min(0, "Unit cost must be 0 or greater").default(0),
});

export type SupplierLinkInput = z.infer<typeof supplierLinkSchema>;

// ---------------------------------------------------------------------------
// Archive Item Schema (Archive/deactivate items)
// ---------------------------------------------------------------------------

export const archiveItemSchema = z.object({
  item_id: z.string().min(1, "Item is required"),
  reason: z.string().min(1, "Reason is required").max(500),
  archive_stock: z.boolean().optional().default(false),
});

export type ArchiveItemInput = z.infer<typeof archiveItemSchema>;
