/**
 * TanStack Query hooks for the Inventory module.
 *
 * Provides mutation hooks for all 14 inventory modal operations,
 * plus query hooks for movements, balances, and images.
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 10.1–10.8, 16.1
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/core/api/apiClient";
import { useSession } from "@/core/security/session";
import { inventoryService } from "@/core/services/inventory/inventoryService";
import { toast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const INVENTORY_KEYS = {
  items: "/v1/inventory/items",
  balances: "/v1/inventory/balances",
  movements: "/v1/inventory/movements",
  adjustments: "/v1/inventory/adjustments",
  transfers: "/v1/inventory/stock-transfers",
  importJobs: "/v1/inventory/import/jobs",
  auditCycles: "/v1/inventory/audit-cycles",
  dashboard: "/v1/inventory/dashboard",
  categories: "/v1/inventory/categories",
  alerts: "/v1/inventory/alerts",
  images: (itemId: string) => `/v1/inventory/items/${itemId}/images`,
} as const;

// ---------------------------------------------------------------------------
// Mutation: Create Item
// ---------------------------------------------------------------------------

export function useCreateItem() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation<any, ApiError, any>({
    mutationFn: (data) =>
      inventoryService.createItem(session.tenant_id, session, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.items] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.dashboard] });
      toast({ title: "Item Created", description: "New inventory item has been added." });
    },
    onError: (error) => {
      toast({ title: "Creation Failed", description: error.message || "Failed to create item.", variant: "destructive" });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: Update Item (PATCH)
// ---------------------------------------------------------------------------

export function useUpdateItem(itemId: string) {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation<any, ApiError, any>({
    mutationFn: (data) =>
      inventoryService.updateItem(session.tenant_id, session, itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.items] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.dashboard] });
      toast({ title: "Item Updated", description: "Item details have been saved." });
    },
    onError: (error) => {
      toast({ title: "Update Failed", description: error.message || "Failed to update item.", variant: "destructive" });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: Delete Item (soft-delete)
// ---------------------------------------------------------------------------

export function useDeleteItem() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation<any, ApiError, string>({
    mutationFn: (itemId) =>
      inventoryService.deleteItem(session.tenant_id, session, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.items] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.dashboard] });
      toast({ title: "Item Archived", description: "Item has been soft-deleted." });
    },
    onError: (error) => {
      toast({ title: "Delete Failed", description: error.message || "Failed to archive item.", variant: "destructive" });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: Stock Adjustment
// ---------------------------------------------------------------------------

export function useStockAdjustment() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation<any, ApiError, any>({
    mutationFn: (data) =>
      inventoryService.requestAdjustment(session.tenant_id, session, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.balances] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.adjustments] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.movements] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.dashboard] });
      toast({ title: "Adjustment Submitted", description: "Stock adjustment request recorded." });
    },
    onError: (error) => {
      toast({ title: "Adjustment Failed", description: error.message || "Failed to submit adjustment.", variant: "destructive" });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: Transfer Stock
// ---------------------------------------------------------------------------

export function useCreateTransfer() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation<any, ApiError, any>({
    mutationFn: (data) =>
      inventoryService.createStockTransfer(session.tenant_id, session, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.transfers] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.balances] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.movements] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.dashboard] });
      toast({ title: "Transfer Initiated", description: "Stock transfer has been created." });
    },
    onError: (error) => {
      toast({ title: "Transfer Failed", description: error.message || "Failed to create transfer.", variant: "destructive" });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: Record Transfer (single-item direct)
// ---------------------------------------------------------------------------

export function useRecordTransfer() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation<any, ApiError, any>({
    mutationFn: (data) =>
      inventoryService.recordTransfer(session.tenant_id, session, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.transfers] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.balances] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.movements] });
      toast({ title: "Transfer Complete", description: "Stock has been transferred." });
    },
    onError: (error) => {
      toast({ title: "Transfer Failed", description: error.message || "Failed to transfer stock.", variant: "destructive" });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: Batch Intake
// ---------------------------------------------------------------------------

export function useBatchIntake() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation<any, ApiError, any[]>({
    mutationFn: (items) =>
      inventoryService.batchRecordIntake(session.tenant_id, session, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.items] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.balances] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.movements] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.dashboard] });
      toast({ title: "Batch Intake Complete", description: "Stock has been added." });
    },
    onError: (error) => {
      toast({ title: "Batch Intake Failed", description: error.message || "Failed to process batch intake.", variant: "destructive" });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: Batch Transfer
// ---------------------------------------------------------------------------

export function useBatchTransfer() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation<any, ApiError, { transfers: any[] }>({
    mutationFn: ({ transfers }) =>
      Promise.all(
        transfers.map((t) =>
          inventoryService.recordTransfer(session.tenant_id, session, t)
        )
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.transfers] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.balances] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.movements] });
      toast({ title: "Batch Transfer Complete", description: "All items transferred." });
    },
    onError: (error) => {
      toast({ title: "Batch Transfer Failed", description: error.message || "Failed to process batch transfer.", variant: "destructive" });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: Approve Adjustment
// ---------------------------------------------------------------------------

export function useApproveAdjustment() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation<any, ApiError, string>({
    mutationFn: (adjustmentId) =>
      inventoryService.approveAdjustment(session.tenant_id, session, adjustmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.adjustments] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.balances] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.dashboard] });
      toast({ title: "Adjustment Approved", description: "Stock adjustment has been approved." });
    },
    onError: (error) => {
      toast({ title: "Approval Failed", description: error.message || "Failed to approve adjustment.", variant: "destructive" });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: Start Audit Cycle
// ---------------------------------------------------------------------------

export function useStartAuditCycle() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation<any, ApiError, any>({
    mutationFn: (data) =>
      inventoryService.startAuditCycle(session.tenant_id, session, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.auditCycles] });
      toast({ title: "Audit Started", description: "New audit cycle has been initiated." });
    },
    onError: (error) => {
      toast({ title: "Audit Failed", description: error.message || "Failed to start audit cycle.", variant: "destructive" });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: Delete Import Job
// ---------------------------------------------------------------------------

export function useDeleteImportJob() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation<any, ApiError, string>({
    mutationFn: (jobId) =>
      apiRequest<any>(`/inventory/import/jobs/${jobId}`, "DELETE", session),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.importJobs] });
      toast({ title: "Job Aborted", description: "Import job has been cancelled." });
    },
    onError: (error) => {
      toast({ title: "Abort Failed", description: error.message || "Failed to abort job.", variant: "destructive" });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: Upload Image
// ---------------------------------------------------------------------------

export function useUploadImage(itemId: string) {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation<any, Error, File>({
    mutationFn: (file) =>
      inventoryService.uploadItemImage(session.tenant_id, session, itemId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.images(itemId)] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.items] });
      toast({ title: "Image Uploaded", description: "Image has been added to the item." });
    },
    onError: (error) => {
      toast({ title: "Upload Failed", description: error.message || "Failed to upload image.", variant: "destructive" });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: Set Primary Image
// ---------------------------------------------------------------------------

export function useSetPrimaryImage(itemId: string) {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation<any, ApiError, string>({
    mutationFn: (imageId) =>
      inventoryService.setPrimaryItemImage(session.tenant_id, session, itemId, imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.images(itemId)] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.items] });
      toast({ title: "Primary Updated", description: "Primary image has been set." });
    },
    onError: (error) => {
      toast({ title: "Failed", description: error.message || "Failed to set primary image.", variant: "destructive" });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: Delete Image
// ---------------------------------------------------------------------------

export function useDeleteImage(itemId: string) {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation<any, ApiError, string>({
    mutationFn: (imageId) =>
      inventoryService.deleteItemImage(session.tenant_id, session, itemId, imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.images(itemId)] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.items] });
      toast({ title: "Image Removed", description: "Image has been deleted." });
    },
    onError: (error) => {
      toast({ title: "Delete Failed", description: error.message || "Failed to delete image.", variant: "destructive" });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: Ship Transfer (courier dispatch)
// ---------------------------------------------------------------------------

export function useShipTransfer() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation<any, ApiError, { transferId: string; trackingNumber: string }>({
    mutationFn: ({ transferId, trackingNumber }) =>
      inventoryService.shipStockTransfer(session.tenant_id, session, transferId, trackingNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.transfers] });
      toast({ title: "Shipped", description: "Transfer has been dispatched." });
    },
    onError: (error) => {
      toast({ title: "Ship Failed", description: error.message || "Failed to mark as shipped.", variant: "destructive" });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: Stock Count (Physical reconciliation)
// ---------------------------------------------------------------------------

export function useStockCount() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation<any, ApiError, { item_id: string; location_id: string; counted_quantity: number; notes?: string }>({
    mutationFn: (data) =>
      apiRequest<any>("/v1/inventory/adjustments", "POST", session, {
        item_id: data.item_id,
        location_id: data.location_id,
        requested_delta: data.counted_quantity,
        reason: `Stock count reconciliation${data.notes ? `: ${data.notes}` : ""}`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.balances] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.auditCycles] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.dashboard] });
      toast({ title: "Count Recorded", description: "Physical stock count has been submitted." });
    },
    onError: (error) => {
      toast({ title: "Count Failed", description: error.message || "Failed to record stock count.", variant: "destructive" });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: Reorder Point Update
// ---------------------------------------------------------------------------

export function useUpdateReorderPoint(itemId: string) {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation<any, ApiError, { reorder_point: number; reorder_quantity: number; max_stock: number }>({
    mutationFn: (data) =>
      inventoryService.updateItem(session.tenant_id, session, itemId, {
        metadata: { min_stock: data.reorder_point, reorder_qty: data.reorder_quantity, max_stock: data.max_stock },
      } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.items] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.alerts] });
      toast({ title: "Reorder Point Set", description: "Inventory thresholds have been updated." });
    },
    onError: (error) => {
      toast({ title: "Update Failed", description: error.message || "Failed to set reorder point.", variant: "destructive" });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: Category Assign
// ---------------------------------------------------------------------------

export function useCategoryAssign() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation<any, ApiError, { item_id: string; category_id: string }>({
    mutationFn: (data) =>
      inventoryService.updateItemCategory(session.tenant_id, session, data.item_id, data.category_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.items] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.categories] });
      toast({ title: "Category Updated", description: "Item category has been reassigned." });
    },
    onError: (error) => {
      toast({ title: "Assignment Failed", description: error.message || "Failed to assign category.", variant: "destructive" });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: Location Assign
// ---------------------------------------------------------------------------

export function useLocationAssign() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation<any, ApiError, { item_id: string; location_id: string; bin_code?: string; initial_quantity?: number }>({
    mutationFn: (data) =>
      apiRequest<any>("/v1/inventory/intake", "POST", session, {
        item_id: data.item_id,
        location_id: data.location_id,
        quantity: data.initial_quantity || 0,
        unit_cost: 0,
        reason: `Location assignment${data.bin_code ? ` — Bin: ${data.bin_code}` : ""}`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.balances] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.items] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.dashboard] });
      toast({ title: "Location Assigned", description: "Item has been assigned to the location." });
    },
    onError: (error) => {
      toast({ title: "Assignment Failed", description: error.message || "Failed to assign location.", variant: "destructive" });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: Bundle Config
// ---------------------------------------------------------------------------

export function useBundleConfig() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation<any, ApiError, { bundle_name: string; bundle_sku: string; description?: string; items: string; price: number }>({
    mutationFn: (data) =>
      apiRequest<any>("/v1/inventory/items", "POST", session, {
        name: data.bundle_name,
        sku: data.bundle_sku,
        description: data.description || "",
        category: "BUNDLE",
        uom: "kit",
        base_price: data.price,
        metadata: { is_bundle: true, bundle_items: data.items.split(",").map(s => s.trim()) },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.items] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.dashboard] });
      toast({ title: "Bundle Created", description: "Item bundle/kit has been configured." });
    },
    onError: (error) => {
      toast({ title: "Bundle Failed", description: error.message || "Failed to create bundle.", variant: "destructive" });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: Variant Create
// ---------------------------------------------------------------------------

export function useVariantCreate() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation<any, ApiError, { parent_item_id: string; variant_name: string; variant_sku: string; attributes: string; price_adjustment: number }>({
    mutationFn: (data) =>
      apiRequest<any>("/v1/inventory/items", "POST", session, {
        name: data.variant_name,
        sku: data.variant_sku,
        category: "VARIANT",
        uom: "pcs",
        base_price: data.price_adjustment,
        metadata: {
          parent_item_id: data.parent_item_id,
          is_variant: true,
          attributes: data.attributes,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.items] });
      toast({ title: "Variant Created", description: "Product variant has been added." });
    },
    onError: (error) => {
      toast({ title: "Variant Failed", description: error.message || "Failed to create variant.", variant: "destructive" });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: Price Update
// ---------------------------------------------------------------------------

export function usePriceUpdate(itemId: string) {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation<any, ApiError, { base_price: number; selling_price: number; discount_rate: number }>({
    mutationFn: (data) =>
      inventoryService.updateItem(session.tenant_id, session, itemId, {
        base_price: data.base_price,
        selling_price: data.selling_price,
        discount_rate: data.discount_rate,
      } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.items] });
      toast({ title: "Price Updated", description: "Item pricing has been saved." });
    },
    onError: (error) => {
      toast({ title: "Update Failed", description: error.message || "Failed to update price.", variant: "destructive" });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: Supplier Link
// ---------------------------------------------------------------------------

export function useSupplierLink() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation<any, ApiError, { item_id: string; supplier_id: string; supplier_sku?: string; lead_time_days?: number; unit_cost?: number }>({
    mutationFn: (data) =>
      inventoryService.updateItem(session.tenant_id, session, data.item_id, {
        metadata: {
          supplier_id: data.supplier_id,
          supplier_sku: data.supplier_sku || "",
          lead_time_days: data.lead_time_days || 0,
          supplier_unit_cost: data.unit_cost || 0,
        },
      } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.items] });
      toast({ title: "Supplier Linked", description: "Item has been linked to supplier." });
    },
    onError: (error) => {
      toast({ title: "Link Failed", description: error.message || "Failed to link supplier.", variant: "destructive" });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: Archive Item
// ---------------------------------------------------------------------------

export function useArchiveItem() {
  const session = useSession();
  const queryClient = useQueryClient();

  return useMutation<any, ApiError, { item_id: string; reason: string; archive_stock: boolean }>({
    mutationFn: (data) =>
      inventoryService.deleteItem(session.tenant_id, session, data.item_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.items] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.balances] });
      queryClient.invalidateQueries({ queryKey: [INVENTORY_KEYS.dashboard] });
      toast({ title: "Item Archived", description: "Item has been deactivated and archived." });
    },
    onError: (error) => {
      toast({ title: "Archive Failed", description: error.message || "Failed to archive item.", variant: "destructive" });
    },
  });
}

// ---------------------------------------------------------------------------
// Query: Item Movements
// ---------------------------------------------------------------------------

export function useItemMovements(itemId: string | undefined) {
  const session = useSession();

  return useQuery({
    queryKey: [INVENTORY_KEYS.movements, itemId],
    queryFn: () => inventoryService.listMovements(session.tenant_id, session, itemId),
    enabled: !!itemId,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Query: Item Balances
// ---------------------------------------------------------------------------

export function useItemBalances(itemId: string | undefined) {
  const session = useSession();

  return useQuery({
    queryKey: [INVENTORY_KEYS.balances, itemId],
    queryFn: () =>
      inventoryService.listBalances(session.tenant_id, session, undefined, undefined, 1, 100),
    enabled: !!itemId,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Query: Item Images
// ---------------------------------------------------------------------------

export function useItemImages(itemId: string | undefined) {
  const session = useSession();

  return useQuery({
    queryKey: [INVENTORY_KEYS.images(itemId || "")],
    queryFn: () => inventoryService.listItemImages(session.tenant_id, session, itemId!),
    enabled: !!itemId,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Query: Inventory Items (for summary/stub element replacement)
// ---------------------------------------------------------------------------

export function useInventoryItems(options?: {
  page?: number;
  limit?: number;
  search?: string;
  category_id?: string;
}) {
  const session = useSession();

  return useQuery({
    queryKey: [INVENTORY_KEYS.items, options],
    queryFn: () =>
      inventoryService.listItems(
        session.tenant_id,
        session,
        undefined,
        options?.page || 1,
        options?.limit || 10,
        options?.search,
        options?.category_id
      ),
    staleTime: 30_000,
  });
}
