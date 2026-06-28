/**
 * LocationAssignDialog — Assign item to location/warehouse.
 *
 * Allows users to assign an inventory item to a specific location or bin.
 * Uses ModuleModal pattern with Zod validation and TanStack Query mutation.
 * Requirements: 1-6, 10
 */

import { ModuleModal } from "@/components/shared/ModuleModal";
import { locationAssignSchema, type LocationAssignInput } from "../schemas";
import { useLocationAssign } from "../hooks/useInventoryQueries";
import { Input } from "@/components/ui/input";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";

interface LocationAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId?: string;
  itemName?: string;
  onSuccess?: () => void;
}

export function LocationAssignDialog({
  open,
  onOpenChange,
  itemId = "",
  itemName = "",
  onSuccess,
}: LocationAssignDialogProps) {
  const locationMutation = useLocationAssign();

  const handleSubmit = async (data: LocationAssignInput) => {
    await locationMutation.mutateAsync(data);
    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <ModuleModal
      schema={locationAssignSchema}
      defaultValues={{
        item_id: itemId,
        location_id: "",
        bin_code: "",
        initial_quantity: 0,
      }}
      onSubmit={handleSubmit}
      onCancel={() => onOpenChange(false)}
      title="Assign Location"
      description={itemName ? `Assign location for: ${itemName}` : "Assign item to a warehouse location."}
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
                  <Input {...field} placeholder="Warehouse / location ID" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bin_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bin Code</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g. A-01-03 (optional)" />
                </FormControl>
                <FormDescription>Specific bin or shelf within the location.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="initial_quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Initial Quantity</FormLabel>
                <FormControl>
                  <Input {...field} type="number" min={0} placeholder="0" />
                </FormControl>
                <FormDescription>Starting stock quantity at this location.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    </ModuleModal>
  );
}

export default LocationAssignDialog;
