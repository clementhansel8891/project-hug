/**
 * ReorderPointDialog — Set reorder point/level for inventory items.
 *
 * Allows users to configure min stock, reorder qty, and max stock levels.
 * Uses ModuleModal pattern with Zod validation and TanStack Query mutation.
 * Requirements: 1-6, 10
 */

import { ModuleModal } from "@/components/shared/ModuleModal";
import { reorderPointSchema, type ReorderPointInput } from "../schemas";
import { useUpdateReorderPoint } from "../hooks/useInventoryQueries";
import { Input } from "@/components/ui/input";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";

interface ReorderPointDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId?: string;
  itemName?: string;
  currentReorderPoint?: number;
  currentMaxStock?: number;
  onSuccess?: () => void;
}

export function ReorderPointDialog({
  open,
  onOpenChange,
  itemId = "",
  itemName = "",
  currentReorderPoint = 0,
  currentMaxStock = 100,
  onSuccess,
}: ReorderPointDialogProps) {
  const reorderMutation = useUpdateReorderPoint(itemId);

  const handleSubmit = async (data: ReorderPointInput) => {
    await reorderMutation.mutateAsync({
      reorder_point: data.reorder_point,
      reorder_quantity: data.reorder_quantity,
      max_stock: data.max_stock,
    });
    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <ModuleModal
      schema={reorderPointSchema}
      defaultValues={{
        item_id: itemId,
        reorder_point: currentReorderPoint,
        reorder_quantity: Math.max(1, currentReorderPoint * 2),
        max_stock: currentMaxStock,
      }}
      onSubmit={handleSubmit}
      onCancel={() => onOpenChange(false)}
      title="Set Reorder Point"
      description={itemName ? `Configure stock thresholds for: ${itemName}` : "Set reorder level and replenishment quantities."}
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
            name="reorder_point"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reorder Point</FormLabel>
                <FormControl>
                  <Input {...field} type="number" min={0} placeholder="Minimum stock level" />
                </FormControl>
                <FormDescription>Alert triggers when stock falls below this level.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="reorder_quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reorder Quantity</FormLabel>
                <FormControl>
                  <Input {...field} type="number" min={1} placeholder="Qty to reorder" />
                </FormControl>
                <FormDescription>Suggested quantity for purchase orders.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="max_stock"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Stock Level</FormLabel>
                <FormControl>
                  <Input {...field} type="number" min={1} placeholder="Maximum stock capacity" />
                </FormControl>
                <FormDescription>Upper limit for this item at this location.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    </ModuleModal>
  );
}

export default ReorderPointDialog;
