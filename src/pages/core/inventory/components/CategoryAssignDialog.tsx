/**
 * CategoryAssignDialog — Assign or change item category.
 *
 * Allows users to reassign an inventory item to a different category.
 * Uses ModuleModal pattern with Zod validation and TanStack Query mutation.
 * Requirements: 1-6, 10
 */

import { ModuleModal } from "@/components/shared/ModuleModal";
import { categoryAssignSchema, type CategoryAssignInput } from "../schemas";
import { useCategoryAssign } from "../hooks/useInventoryQueries";
import { Input } from "@/components/ui/input";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

interface CategoryAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId?: string;
  itemName?: string;
  currentCategoryId?: string;
  onSuccess?: () => void;
}

export function CategoryAssignDialog({
  open,
  onOpenChange,
  itemId = "",
  itemName = "",
  currentCategoryId = "",
  onSuccess,
}: CategoryAssignDialogProps) {
  const categoryMutation = useCategoryAssign();

  const handleSubmit = async (data: CategoryAssignInput) => {
    await categoryMutation.mutateAsync(data);
    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <ModuleModal
      schema={categoryAssignSchema}
      defaultValues={{
        item_id: itemId,
        category_id: currentCategoryId,
      }}
      onSubmit={handleSubmit}
      onCancel={() => onOpenChange(false)}
      title="Assign Category"
      description={itemName ? `Change category for: ${itemName}` : "Assign or change the item category."}
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
            name="category_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Category ID or name" />
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

export default CategoryAssignDialog;
