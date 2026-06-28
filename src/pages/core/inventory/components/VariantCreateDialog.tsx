/**
 * VariantCreateDialog — Create product variants (size, color, etc.)
 *
 * Allows users to create item variants from a parent product.
 * Uses ModuleModal pattern with Zod validation and TanStack Query mutation.
 * Requirements: 1-6, 10
 */

import { ModuleModal } from "@/components/shared/ModuleModal";
import { variantCreateSchema, type VariantCreateInput } from "../schemas";
import { useVariantCreate } from "../hooks/useInventoryQueries";
import { Input } from "@/components/ui/input";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";

interface VariantCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentItemId?: string;
  parentItemName?: string;
  onSuccess?: () => void;
}

export function VariantCreateDialog({
  open,
  onOpenChange,
  parentItemId = "",
  parentItemName = "",
  onSuccess,
}: VariantCreateDialogProps) {
  const variantMutation = useVariantCreate();

  const handleSubmit = async (data: VariantCreateInput) => {
    await variantMutation.mutateAsync(data);
    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <ModuleModal
      schema={variantCreateSchema}
      defaultValues={{
        parent_item_id: parentItemId,
        variant_name: "",
        variant_sku: "",
        attributes: "",
        price_adjustment: 0,
      }}
      onSubmit={handleSubmit}
      onCancel={() => onOpenChange(false)}
      title="Create Variant"
      description={parentItemName ? `Add variant for: ${parentItemName}` : "Create a new product variant."}
      isOpen={open}
    >
      {(form) => (
        <>
          <FormField
            control={form.control}
            name="parent_item_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Parent Item</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Parent item ID" disabled={!!parentItemId} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="variant_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Variant Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g. MacBook Pro 14-inch Space Gray" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="variant_sku"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Variant SKU</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g. MBP-14-SG" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="attributes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Attributes</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g. Color: Space Gray, Size: 14-inch" />
                </FormControl>
                <FormDescription>Comma-separated attribute pairs (Key: Value).</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price_adjustment"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price Adjustment</FormLabel>
                <FormControl>
                  <Input {...field} type="number" step="0.01" placeholder="0.00" />
                </FormControl>
                <FormDescription>Price difference from parent item (positive or negative).</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    </ModuleModal>
  );
}

export default VariantCreateDialog;
