/**
 * BatchTransferDialog — Bulk stock transfer (batch operation).
 *
 * Refactored to use React Hook Form + Zod validation + TanStack Query mutation.
 * Requirements: 1-6, 10
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input as UIInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useSession } from "@/core/security/session";
import { batchTransferSchema, type BatchTransferInput } from "../schemas";
import { useBatchTransfer } from "../hooks/useInventoryQueries";
import type { InventoryStockBalance } from "@/core/types/inventory/inventory";

interface BatchTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  balances: InventoryStockBalance[];
  onSuccess: () => void;
}

export function BatchTransferDialog({ open, onOpenChange, selectedIds, balances, onSuccess }: BatchTransferDialogProps) {
  const session = useSession();
  const batchTransferMutation = useBatchTransfer();

  const form = useForm<BatchTransferInput>({
    resolver: zodResolver(batchTransferSchema),
    defaultValues: {
      to_location_id: "",
      to_department_id: "",
      reason: "Batch Internal Transfer",
    },
  });

  const { formState: { errors }, register, handleSubmit, reset } = form;
  const selectedBalances = (Array.isArray(balances) ? balances : []).filter(b => selectedIds.includes(b.id));

  const handleBatchTransfer = handleSubmit(async (data) => {
    const transfers = selectedBalances.map(b => ({
      item_id: b.item_id,
      from_location_id: b.location_id,
      from_department_id: b.department_id,
      to_location_id: data.to_location_id,
      to_department_id: data.to_department_id || undefined,
      quantity: b.quantity,
      reason: data.reason || "Batch transfer",
    }));
    await batchTransferMutation.mutateAsync({ transfers });
    onSuccess();
    onOpenChange(false);
    reset();
  });

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !batchTransferMutation.isPending) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Batch Stock Transfer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleBatchTransfer}>
          <fieldset disabled={batchTransferMutation.isPending} className="space-y-4 py-4">
            <div className="rounded bg-muted p-2 text-xs">
              <p className="font-semibold mb-1">Items to Move ({selectedIds.length}):</p>
              <ul className="list-disc ml-4 opacity-80 max-h-24 overflow-y-auto">
                {selectedBalances.map(b => (
                  <li key={b.id}>{b.item_id} from {b.location_id} ({b.quantity} units)</li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="batch-to-loc">Destination Location <span className="text-destructive">*</span></Label>
                <UIInput
                  id="batch-to-loc"
                  placeholder="Loc Code"
                  {...register("to_location_id")}
                  aria-invalid={!!errors.to_location_id}
                  aria-describedby={errors.to_location_id ? "batch-loc-error" : undefined}
                />
                {errors.to_location_id && (
                  <p id="batch-loc-error" role="alert" className="text-xs text-destructive">
                    {errors.to_location_id.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="batch-to-dept">Destination Dept</Label>
                <UIInput
                  id="batch-to-dept"
                  placeholder="Dept Code"
                  {...register("to_department_id")}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="batch-reason">Reason</Label>
              <UIInput
                id="batch-reason"
                placeholder="e.g. Consolidation"
                {...register("reason")}
              />
            </div>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={batchTransferMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={batchTransferMutation.isPending || selectedIds.length === 0}>
              {batchTransferMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {batchTransferMutation.isPending ? "Moving..." : "Perform Bulk Move"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
