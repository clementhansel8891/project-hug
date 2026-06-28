/**
 * ArchiveItemDialog — Archive/deactivate items.
 *
 * Allows users to archive an inventory item with a reason.
 * Uses ModuleModal pattern with Zod validation and TanStack Query mutation.
 * Requirements: 1-6, 10
 */

import { ModuleModal } from "@/components/shared/ModuleModal";
import { archiveItemSchema, type ArchiveItemInput } from "../schemas";
import { useArchiveItem } from "../hooks/useInventoryQueries";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";

interface ArchiveItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId?: string;
  itemName?: string;
  onSuccess?: () => void;
}

export function ArchiveItemDialog({
  open,
  onOpenChange,
  itemId = "",
  itemName = "",
  onSuccess,
}: ArchiveItemDialogProps) {
  const archiveMutation = useArchiveItem();

  const handleSubmit = async (data: ArchiveItemInput) => {
    await archiveMutation.mutateAsync(data);
    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <ModuleModal
      schema={archiveItemSchema}
      defaultValues={{
        item_id: itemId,
        reason: "",
        archive_stock: false,
      }}
      onSubmit={handleSubmit}
      onCancel={() => onOpenChange(false)}
      title="Archive Item"
      description={itemName ? `Archive: ${itemName}` : "Archive and deactivate an inventory item."}
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
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reason for Archive</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="e.g. Product discontinued, End of lifecycle, Replaced by newer model"
                    rows={3}
                  />
                </FormControl>
                <FormDescription>Provide a reason for archiving this item.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="archive_stock"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={field.onChange}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Archive remaining stock</FormLabel>
                  <FormDescription>
                    Also zero out any remaining stock balances for this item.
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
        </>
      )}
    </ModuleModal>
  );
}

export default ArchiveItemDialog;
