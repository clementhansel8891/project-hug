/**
 * BatchIntakeDialog — Bulk stock intake (batch operation).
 *
 * Refactored to use React Hook Form + Zod validation + TanStack Query mutation.
 * Requirements: 1-6, 10
 */

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useSession } from "@/core/security/session";
import { batchIntakeSchema, type BatchIntakeInput } from "../schemas";
import { useBatchIntake } from "../hooks/useInventoryQueries";

interface BatchIntakeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function BatchIntakeDialog({
  open,
  onOpenChange,
  onSuccess,
}: BatchIntakeDialogProps) {
  const session = useSession();
  const batchMutation = useBatchIntake();

  const form = useForm<BatchIntakeInput>({
    resolver: zodResolver(batchIntakeSchema),
    defaultValues: {
      items: [
        { item_id: "", location_id: "", department_id: "", quantity: 1, unit_cost: 0, reason: "Batch Intake" },
      ],
    },
  });

  const { formState: { errors }, register, handleSubmit, reset, control } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const handleBatchIntake = handleSubmit(async (data) => {
    await batchMutation.mutateAsync(data.items);
    onSuccess();
    onOpenChange(false);
    reset();
  });

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !batchMutation.isPending) handleClose();
      }}
    >
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Batch Stock Intake</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleBatchIntake}>
          <fieldset disabled={batchMutation.isPending} className="space-y-4 py-4">
            {errors.items?.root && (
              <p role="alert" className="text-xs text-destructive">
                {errors.items.root.message}
              </p>
            )}

            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-xs uppercase">
                  <th className="p-2 text-left">Product ID / SKU</th>
                  <th className="p-2 text-left">Location / Dept</th>
                  <th className="p-2 text-left w-24">Qty</th>
                  <th className="p-2 text-left w-28">Unit Cost</th>
                  <th className="p-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, idx) => (
                  <tr key={field.id} className="border-b">
                    <td className="p-2">
                      <input
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="SKU or ID"
                        {...register(`items.${idx}.item_id`)}
                        aria-invalid={!!errors.items?.[idx]?.item_id}
                      />
                      {errors.items?.[idx]?.item_id && (
                        <p role="alert" className="text-[10px] text-destructive mt-0.5">
                          {errors.items[idx]?.item_id?.message}
                        </p>
                      )}
                    </td>
                    <td className="p-2 space-y-1">
                      <input
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Location ID"
                        {...register(`items.${idx}.location_id`)}
                        aria-invalid={!!errors.items?.[idx]?.location_id}
                      />
                      <input
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Dept ID (opt.)"
                        {...register(`items.${idx}.department_id`)}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        type="number"
                        min={1}
                        {...register(`items.${idx}.quantity`, { valueAsNumber: true })}
                        aria-invalid={!!errors.items?.[idx]?.quantity}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        type="number"
                        min={0}
                        {...register(`items.${idx}.unit_cost`, { valueAsNumber: true })}
                      />
                    </td>
                    <td className="p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(idx)}
                        disabled={fields.length === 1}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() =>
                append({ item_id: "", location_id: "", department_id: "", quantity: 1, unit_cost: 0, reason: "Batch Intake" })
              }
            >
              <Plus className="h-4 w-4" /> Add Row
            </Button>
          </fieldset>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={batchMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={batchMutation.isPending}>
              {batchMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {batchMutation.isPending ? "Processing..." : "Confirm Batch Intake"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
