/**
 * StockCountDialog — Physical stock count reconciliation modal.
 *
 * Allows users to record a physical count for an item at a location.
 * Uses ModuleModal pattern with Zod validation and TanStack Query mutation.
 * Requirements: 1-6, 10
 */

import { ModuleModal } from "@/components/shared/ModuleModal";
import { stockCountSchema, type StockCountInput } from "../schemas";
import { useStockCount } from "../hooks/useInventoryQueries";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

interface StockCountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId?: string;
  itemName?: string;
  locationId?: string;
  onSuccess?: () => void;
}

export function StockCountDialog({
  open,
  onOpenChange,
  itemId = "",
  itemName = "",
  locationId = "",
  onSuccess,
}: StockCountDialogProps) {
  const stockCountMutation = useStockCount();

  const handleSubmit = async (data: StockCountInput) => {
    await stockCountMutation.mutateAsync(data);
    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <ModuleModal
      schema={stockCountSchema}
      defaultValues={{
        item_id: itemId,
        location_id: locationId,
        counted_quantity: 0,
        notes: "",
      }}
      onSubmit={handleSubmit}
      onCancel={() => onOpenChange(false)}
      title="Stock Count Reconciliation"
      description={itemName ? `Record physical count for: ${itemName}` : "Record physical stock count for reconciliation."}
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
            name="location_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Location / warehouse ID" disabled={!!locationId} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="counted_quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Counted Quantity</FormLabel>
                <FormControl>
                  <Input {...field} type="number" min={0} placeholder="Physical count" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea {...field} placeholder="Additional count notes..." rows={2} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    </ModuleModal>
  );
}

export default StockCountDialog;
