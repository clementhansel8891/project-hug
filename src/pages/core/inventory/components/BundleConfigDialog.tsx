/**
 * BundleConfigDialog — Configure item bundles/kits.
 *
 * Allows users to create product bundles consisting of multiple items.
 * Uses ModuleModal pattern with Zod validation and TanStack Query mutation.
 * Requirements: 1-6, 10
 */

import { ModuleModal } from "@/components/shared/ModuleModal";
import { bundleConfigSchema, type BundleConfigInput } from "../schemas";
import { useBundleConfig } from "../hooks/useInventoryQueries";
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

interface BundleConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function BundleConfigDialog({
  open,
  onOpenChange,
  onSuccess,
}: BundleConfigDialogProps) {
  const bundleMutation = useBundleConfig();

  const handleSubmit = async (data: BundleConfigInput) => {
    await bundleMutation.mutateAsync(data);
    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <ModuleModal
      schema={bundleConfigSchema}
      defaultValues={{
        bundle_name: "",
        bundle_sku: "",
        description: "",
        items: "",
        price: 0,
      }}
      onSubmit={handleSubmit}
      onCancel={() => onOpenChange(false)}
      title="Configure Bundle"
      description="Create a product bundle or kit from existing inventory items."
      isOpen={open}
    >
      {(form) => (
        <>
          <FormField
            control={form.control}
            name="bundle_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bundle Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g. Starter Kit" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bundle_sku"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bundle SKU</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g. BDL-STARTER-001" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="items"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bundle Items</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Enter item IDs separated by commas"
                    rows={3}
                  />
                </FormControl>
                <FormDescription>Comma-separated list of item IDs to include in this bundle.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bundle Price</FormLabel>
                <FormControl>
                  <Input {...field} type="number" min={0} step="0.01" placeholder="0.00" />
                </FormControl>
                <FormDescription>Set price for the entire bundle.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea {...field} placeholder="Bundle description..." rows={2} />
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

export default BundleConfigDialog;
