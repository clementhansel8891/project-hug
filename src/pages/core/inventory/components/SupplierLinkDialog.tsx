/**
 * SupplierLinkDialog — Link items to suppliers.
 *
 * Allows users to associate an inventory item with a supplier,
 * including supplier SKU, lead time, and unit cost.
 * Uses ModuleModal pattern with Zod validation and TanStack Query mutation.
 * Requirements: 1-6, 10
 */

import { ModuleModal } from "@/components/shared/ModuleModal";
import { supplierLinkSchema, type SupplierLinkInput } from "../schemas";
import { useSupplierLink } from "../hooks/useInventoryQueries";
import { Input } from "@/components/ui/input";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";

interface SupplierLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId?: string;
  itemName?: string;
  onSuccess?: () => void;
}

export function SupplierLinkDialog({
  open,
  onOpenChange,
  itemId = "",
  itemName = "",
  onSuccess,
}: SupplierLinkDialogProps) {
  const supplierMutation = useSupplierLink();

  const handleSubmit = async (data: SupplierLinkInput) => {
    await supplierMutation.mutateAsync(data);
    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <ModuleModal
      schema={supplierLinkSchema}
      defaultValues={{
        item_id: itemId,
        supplier_id: "",
        supplier_sku: "",
        lead_time_days: 0,
        unit_cost: 0,
      }}
      onSubmit={handleSubmit}
      onCancel={() => onOpenChange(false)}
      title="Link Supplier"
      description={itemName ? `Link supplier for: ${itemName}` : "Associate item with a supplier."}
      isOpen={open}
    >
      {(form) => (
        <>
          <FormField
            control={form.control}
            name="item_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Item ID</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Item identifier" disabled={!!itemId} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="supplier_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Supplier ID or name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="supplier_sku"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier SKU</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Supplier's product code (optional)" />
                </FormControl>
                <FormDescription>The supplier's own SKU/reference for this item.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lead_time_days"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lead Time (days)</FormLabel>
                <FormControl>
                  <Input {...field} type="number" min={0} placeholder="0" />
                </FormControl>
                <FormDescription>Average delivery time from this supplier.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="unit_cost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit Cost</FormLabel>
                <FormControl>
                  <Input {...field} type="number" min={0} step="0.01" placeholder="0.00" />
                </FormControl>
                <FormDescription>Purchase price per unit from this supplier.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    </ModuleModal>
  );
}

export default SupplierLinkDialog;
