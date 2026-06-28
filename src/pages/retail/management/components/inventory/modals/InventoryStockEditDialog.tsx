/**
 * InventoryStockEditDialog — Wired modal for editing stock buffer/threshold.
 *
 * Allows operators to set minimum buffer stock levels, specify effective dates,
 * provide reasons, and optionally notify procurement.
 *
 * Requirements: 1 (Form Fields), 2 (Validation), 3 (API Submission),
 *               4 (Loading State), 5 (Error Handling), 6 (Success Handling),
 *               10 (Consistent Pattern)
 */

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/core/api/apiClient";
import { getMutationToastHandlers } from "@/lib/modal-helpers";
import { InventoryItemView } from "../types";

// ─── Zod Schema ─────────────────────────────────────────────────────────────────

const inventoryStockEditSchema = z.object({
  minBuffer: z.coerce.number().min(0, "Buffer must be 0 or more"),
  reason: z.string().min(5, "Reason must be at least 5 characters"),
  effectiveDate: z.string().min(1, "Effective date is required"),
  notifyProcurement: z.boolean(),
});

export type InventoryStockEditFormValues = z.infer<typeof inventoryStockEditSchema>;

// ─── Backward compat type ───────────────────────────────────────────────────────

export type BufferUpdatePayload = {
  id: string;
  minBuffer: number;
  reason: string;
  effectiveDate: string;
  notifyProcurement: boolean;
};

// ─── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  item: InventoryItemView | null;
  open: boolean;
  onClose: () => void;
  canWrite: boolean;
  onSubmit?: (payload: BufferUpdatePayload) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export const InventoryStockEditDialog: React.FC<Props> = ({
  item,
  open,
  onClose,
  canWrite,
  onSubmit,
}) => {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InventoryStockEditFormValues>({
    resolver: zodResolver(inventoryStockEditSchema),
    defaultValues: {
      minBuffer: 0,
      reason: "",
      effectiveDate: new Date().toISOString().slice(0, 10),
      notifyProcurement: true,
    },
  });

  const { register, formState: { errors }, handleSubmit, reset, setValue, watch } = form;

  // Reset form when item changes
  useEffect(() => {
    if (item && open) {
      reset({
        minBuffer: item.minBuffer || 0,
        reason: "",
        effectiveDate: new Date().toISOString().slice(0, 10),
        notifyProcurement: true,
      });
    }
  }, [item, open, reset]);

  const mutation = useMutation({
    mutationFn: async (data: InventoryStockEditFormValues) => {
      if (!item) throw new Error("No item selected");

      const payload: BufferUpdatePayload = {
        id: item.id,
        minBuffer: data.minBuffer,
        reason: data.reason,
        effectiveDate: data.effectiveDate,
        notifyProcurement: data.notifyProcurement,
      };

      // If external onSubmit is provided, use it (backward compat)
      if (onSubmit) {
        onSubmit(payload);
        return;
      }

      return apiRequest(
        `/v1/retail/inventory/${item.id}`,
        "PATCH",
        session,
        {
          metadata: {
            minBuffer: data.minBuffer,
            min_stock: data.minBuffer,
          },
          reason: data.reason,
          effectiveDate: data.effectiveDate,
          notifyProcurement: data.notifyProcurement,
        },
      );
    },
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["retail", "inventory"]],
      onClose,
      form,
      successTitle: "Threshold Updated",
      successDescription: `Buffer for ${item?.name || "item"} has been updated.`,
    }),
  });

  const onFormSubmit = handleSubmit((data) => mutation.mutate(data));
  const isPending = mutation.isPending;
  const notifyProcurement = watch("notifyProcurement");

  if (!item) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !isPending) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-sm rounded-[2rem]">
        <DialogHeader>
          <DialogTitle className="font-black italic tracking-tight">
            {item.name}
          </DialogTitle>
          <DialogDescription className="font-bold italic text-xs">
            {item.sku} • Current SOH: {item.onHand}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onFormSubmit} noValidate>
          <fieldset disabled={isPending} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label
                  htmlFor="stock-buffer"
                  className="text-[10px] font-black uppercase tracking-widest"
                >
                  Min Buffer Stock *
                </Label>
                <Input
                  id="stock-buffer"
                  type="number"
                  min="0"
                  {...register("minBuffer", { valueAsNumber: true })}
                  aria-describedby={errors.minBuffer ? "stock-buffer-error" : undefined}
                  aria-invalid={!!errors.minBuffer}
                  className="h-12 rounded-xl font-bold"
                />
                {errors.minBuffer && (
                  <p id="stock-buffer-error" className="text-[10px] text-destructive font-medium" role="alert">
                    {errors.minBuffer.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="stock-date"
                  className="text-[10px] font-black uppercase tracking-widest"
                >
                  Effective Date *
                </Label>
                <Input
                  id="stock-date"
                  type="date"
                  {...register("effectiveDate")}
                  aria-describedby={errors.effectiveDate ? "stock-date-error" : undefined}
                  aria-invalid={!!errors.effectiveDate}
                  className="h-12 rounded-xl font-bold"
                />
                {errors.effectiveDate && (
                  <p id="stock-date-error" className="text-[10px] text-destructive font-medium" role="alert">
                    {errors.effectiveDate.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="stock-reason"
                className="text-[10px] font-black uppercase tracking-widest"
              >
                Reason for Change * (min 5 chars)
              </Label>
              <Textarea
                id="stock-reason"
                {...register("reason")}
                aria-describedby={errors.reason ? "stock-reason-error" : undefined}
                aria-invalid={!!errors.reason}
                className="rounded-xl font-bold resize-none"
                rows={3}
                placeholder="State reason..."
              />
              {errors.reason && (
                <p id="stock-reason-error" className="text-[10px] text-destructive font-medium" role="alert">
                  {errors.reason.message}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
              <div className="text-xs font-bold text-muted-foreground">
                Notify procurement / replenish
              </div>
              <Switch
                checked={notifyProcurement}
                onCheckedChange={(checked) => setValue("notifyProcurement", checked)}
              />
            </div>
          </fieldset>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => { reset(); onClose(); }}
              className="rounded-xl font-black italic"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className={cn(
                "rounded-xl font-black italic gap-2",
                canWrite ? "bg-secondary" : "bg-warning hover:bg-warning",
              )}
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : canWrite ? (
                "Save Changes"
              ) : (
                "Request Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
