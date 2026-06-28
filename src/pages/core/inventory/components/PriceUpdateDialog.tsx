/**
 * PriceUpdateDialog — Update item pricing.
 *
 * Allows users to update base price, selling price, and discount rate.
 * Uses ModuleModal pattern with Zod validation and TanStack Query mutation.
 * Requirements: 1-6, 10
 */

import { ModuleModal } from "@/components/shared/ModuleModal";
import { priceUpdateSchema, type PriceUpdateInput } from "../schemas";
import { usePriceUpdate } from "../hooks/useInventoryQueries";
import { Input } from "@/components/ui/input";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";

interface PriceUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId?: string;
  itemName?: string;
  currentBasePrice?: number;
  currentSellingPrice?: number;
  currentDiscountRate?: number;
  onSuccess?: () => void;
}

export function PriceUpdateDialog({
  open,
  onOpenChange,
  itemId = "",
  itemName = "",
  currentBasePrice = 0,
  currentSellingPrice = 0,
  currentDiscountRate = 0,
  onSuccess,
}: PriceUpdateDialogProps) {
  const priceMutation = usePriceUpdate(itemId);

  const handleSubmit = async (data: PriceUpdateInput) => {
    await priceMutation.mutateAsync({
      base_price: data.base_price,
      selling_price: data.selling_price,
      discount_rate: data.discount_rate,
    });
    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <ModuleModal
      schema={priceUpdateSchema}
      defaultValues={{
        item_id: itemId,
        base_price: currentBasePrice,
        selling_price: currentSellingPrice,
        discount_rate: currentDiscountRate,
      }}
      onSubmit={handleSubmit}
      onCancel={() => onOpenChange(false)}
      title="Update Pricing"
      description={itemName ? `Update pricing for: ${itemName}` : "Update item pricing details."}
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
            name="base_price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Base Price</FormLabel>
                <FormControl>
                  <Input {...field} type="number" min={0} step="0.01" placeholder="0.00" />
                </FormControl>
                <FormDescription>Cost/purchase price of the item.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="selling_price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Selling Price</FormLabel>
                <FormControl>
                  <Input {...field} type="number" min={0} step="0.01" placeholder="0.00" />
                </FormControl>
                <FormDescription>Retail/selling price to customers.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="discount_rate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Discount Rate (%)</FormLabel>
                <FormControl>
                  <Input {...field} type="number" min={0} max={100} step="0.1" placeholder="0" />
                </FormControl>
                <FormDescription>Percentage discount applied to selling price.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    </ModuleModal>
  );
}

export default PriceUpdateDialog;
