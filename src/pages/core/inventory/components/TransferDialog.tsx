/**
 * TransferDialog — Inter-location stock transfer modal.
 *
 * Refactored to use React Hook Form + Zod validation + TanStack Query mutation.
 * Requirements: 1-6, 10
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { AlertCircle, Loader2 } from "lucide-react";
import { useSession } from "@/core/security/session";
import { useRecordTransfer } from "../hooks/useInventoryQueries";
import type {
  InventoryStockBalance,
  InventoryItemMaster,
} from "@/core/types/inventory/inventory";

const transferFormSchema = z.object({
  to_location_id: z.string().min(1, "Destination location is required"),
  to_department_id: z.string().optional().default(""),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  reason: z.string().max(500).optional().default("Stock transfer"),
});

type TransferFormValues = z.infer<typeof transferFormSchema>;

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedBalance: {
    balance: InventoryStockBalance;
    item: InventoryItemMaster;
  } | null;
  onSuccess: () => void;
}

export function TransferDialog({
  open,
  onOpenChange,
  selectedBalance,
  onSuccess,
}: TransferDialogProps) {
  const session = useSession();
  const transferMutation = useRecordTransfer();

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferFormSchema),
    defaultValues: {
      to_location_id: "",
      to_department_id: "",
      quantity: 1,
      reason: "",
    },
  });

  const { formState: { errors }, register, handleSubmit, reset } = form;

  const handleTransfer = handleSubmit(async (data) => {
    if (!selectedBalance) return;
    await transferMutation.mutateAsync({
      item_id: selectedBalance.item.id,
      from_location_id: selectedBalance.balance.location_id,
      from_department_id: selectedBalance.balance.department_id,
      to_location_id: data.to_location_id,
      to_department_id: data.to_department_id || undefined,
      quantity: data.quantity,
      reason: data.reason || "Stock transfer",
    });
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
        if (!o && !transferMutation.isPending) handleClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer Stock</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleTransfer}>
          <fieldset disabled={transferMutation.isPending} className="space-y-4 py-4">
            {/* Source item info */}
            <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
              <p className="font-semibold">
                {selectedBalance?.item.name}{" "}
                <span className="font-mono text-xs text-muted-foreground">
                  ({selectedBalance?.item.sku})
                </span>
              </p>
              <p className="text-muted-foreground text-xs mt-0.5">
                From: {selectedBalance?.balance.location_id}
                {selectedBalance?.balance.department_id &&
                  ` · ${selectedBalance.balance.department_id}`}{" "}
                — Qty: {selectedBalance?.balance.quantity}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="to-location">
                  Destination Location <span className="text-destructive">*</span>
                </Label>
                <UIInput
                  id="to-location"
                  placeholder="e.g. JKT-WH-B"
                  {...register("to_location_id")}
                  aria-invalid={!!errors.to_location_id}
                  aria-describedby={errors.to_location_id ? "to-location-error" : undefined}
                />
                {errors.to_location_id && (
                  <p id="to-location-error" role="alert" className="text-xs text-destructive">
                    {errors.to_location_id.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="to-dept">Destination Dept</Label>
                <UIInput
                  id="to-dept"
                  placeholder="e.g. PRODUCTION"
                  {...register("to_department_id")}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="qty">
                Quantity <span className="text-destructive">*</span>
              </Label>
              <UIInput
                id="qty"
                type="number"
                min={1}
                {...register("quantity")}
                aria-invalid={!!errors.quantity}
                aria-describedby={errors.quantity ? "qty-error" : undefined}
              />
              {errors.quantity && (
                <p id="qty-error" role="alert" className="text-xs text-destructive">
                  {errors.quantity.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="reason">Reason</Label>
              <UIInput
                id="reason"
                placeholder="e.g. Replenishment, Rebalancing"
                {...register("reason")}
              />
            </div>
          </fieldset>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={transferMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={transferMutation.isPending}>
              {transferMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {transferMutation.isPending ? "Processing..." : "Execute Transfer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
