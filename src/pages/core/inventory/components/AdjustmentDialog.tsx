/**
 * AdjustmentDialog — Manual stock adjustment with reason.
 *
 * Refactored to use React Hook Form + Zod validation + TanStack Query mutation.
 * Requirements: 1-6, 10
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input as UIInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useSession } from "@/core/security/session";
import { stockAdjustmentSchema, validateNonNegativeBalance } from "../schemas";
import { useStockAdjustment } from "../hooks/useInventoryQueries";
import type {
  InventoryStockBalance,
  InventoryItemMaster,
} from "@/core/types/inventory/inventory";

type AdjustmentFormValues = {
  item_id: string;
  location_id: string;
  department_id: string;
  requested_delta: number;
  reason: string;
};

interface AdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedBalance: {
    balance: InventoryStockBalance;
    item: InventoryItemMaster;
  } | null;
  onSuccess: () => void;
}

export function AdjustmentDialog({
  open,
  onOpenChange,
  selectedBalance,
  onSuccess,
}: AdjustmentDialogProps) {
  const session = useSession();
  const adjustMutation = useStockAdjustment();

  const form = useForm<AdjustmentFormValues>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: {
      item_id: selectedBalance?.item.id || "",
      location_id: selectedBalance?.balance.location_id || "",
      department_id: selectedBalance?.balance.department_id || "",
      requested_delta: 0,
      reason: "",
    },
  });

  const { formState: { errors }, register, handleSubmit, reset, watch, setError } = form;
  const delta = watch("requested_delta");
  const currentQty = selectedBalance?.balance.quantity || 0;
  const newQty = currentQty + (Number(delta) || 0);

  const handleAdjust = handleSubmit(async (data) => {
    if (!selectedBalance) return;

    // Additional business rule: non-negative balance check
    const balanceError = validateNonNegativeBalance(currentQty, data.requested_delta);
    if (balanceError) {
      setError("requested_delta", { message: balanceError });
      return;
    }

    const formData = {
      item_id: selectedBalance.item.id,
      location_id: selectedBalance.balance.location_id,
      department_id: selectedBalance.balance.department_id || "",
      requested_delta: data.requested_delta,
      reason: data.reason.trim(),
    };

    await adjustMutation.mutateAsync(formData);
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
        if (!o && !adjustMutation.isPending) handleClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Stock Adjustment Request</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleAdjust}>
          <fieldset disabled={adjustMutation.isPending} className="space-y-4 py-4">
            {/* Item info */}
            <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
              <p className="font-semibold">
                {selectedBalance?.item.name}{" "}
                <span className="font-mono text-xs text-muted-foreground">
                  ({selectedBalance?.item.sku})
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedBalance?.balance.location_id}
                {selectedBalance?.balance.department_id &&
                  ` · ${selectedBalance.balance.department_id}`}
                {" — "}Current Qty: {currentQty}
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="delta">
                Quantity Delta{" "}
                <span className="text-muted-foreground text-xs">(+/- amount)</span>
              </Label>
              <UIInput
                id="delta"
                type="number"
                {...register("requested_delta", { valueAsNumber: true })}
                aria-invalid={!!errors.requested_delta}
                aria-describedby={errors.requested_delta ? "delta-error" : "delta-preview"}
              />
              {errors.requested_delta ? (
                <p id="delta-error" role="alert" className="text-xs text-destructive">
                  {errors.requested_delta.message}
                </p>
              ) : (
                <p id="delta-preview" className="text-xs text-muted-foreground">
                  {Number(delta) !== 0 && (
                    <>
                      {currentQty} → <strong>{newQty}</strong>
                      {newQty < 0 && (
                        <span className="ml-1 text-destructive">
                          (Warning: will go negative)
                        </span>
                      )}
                    </>
                  )}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="adj-reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <UIInput
                id="adj-reason"
                placeholder="e.g. Damage write-off, Cycle count correction"
                {...register("reason")}
                aria-invalid={!!errors.reason}
                aria-describedby={errors.reason ? "reason-error" : "reason-hint"}
              />
              {errors.reason ? (
                <p id="reason-error" role="alert" className="text-xs text-destructive">
                  {errors.reason.message}
                </p>
              ) : (
                <p id="reason-hint" className="text-xs text-muted-foreground">
                  This adjustment will go to the approval queue.
                </p>
              )}
            </div>
          </fieldset>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={adjustMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={adjustMutation.isPending || Number(delta) === 0}>
              {adjustMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {adjustMutation.isPending ? "Submitting..." : "Submit Adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
