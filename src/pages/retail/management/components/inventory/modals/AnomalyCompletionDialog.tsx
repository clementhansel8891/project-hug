/**
 * AnomalyCompletionDialog — Wired modal for completing anomaly inventory items.
 *
 * Allows operators to update incomplete item details (name, category, price)
 * and optionally clear the anomaly flag when category changes.
 *
 * Requirements: 1 (Form Fields), 2 (Validation), 3 (API Submission),
 *               4 (Loading State), 5 (Error Handling), 6 (Success Handling),
 *               10 (Consistent Pattern)
 */

import React, { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useSession } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/core/api/apiClient";
import { getMutationToastHandlers } from "@/lib/modal-helpers";
import { InventoryItemView } from "../types";

// ─── Zod Schema ─────────────────────────────────────────────────────────────────

const anomalyCompletionSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  category_id: z.string().min(1, "Category is required"),
  base_price: z.coerce.number().positive("Price must be greater than 0"),
});

export type AnomalyCompletionFormValues = z.infer<typeof anomalyCompletionSchema>;

// ─── Exported helpers (preserved for backward compat / tests) ───────────────────

export interface CompletionFormData {
  name: string;
  category_id: string;
  base_price: string | number;
}

export interface CompletionSubmitPayload extends Partial<CompletionFormData> {
  is_anomaly?: boolean;
}

/**
 * Determines whether the anomaly flag should be cleared based on category change.
 */
export function shouldClearAnomalyFlag(
  item: InventoryItemView | null,
  newCategoryId: string,
  previousCategoryId: string,
): boolean {
  if (!item) return false;
  const isCurrentlyAnomaly = item.category?.toLowerCase() === "anomaly";
  const categoryChanged = newCategoryId !== previousCategoryId;
  return isCurrentlyAnomaly && categoryChanged;
}

/**
 * Builds the payload for the completion API call.
 */
export function buildCompletionPayload(
  formData: CompletionFormData,
  item: InventoryItemView | null,
  previousCategoryId: string,
): CompletionSubmitPayload {
  const payload: CompletionSubmitPayload = { ...formData };
  if (shouldClearAnomalyFlag(item, formData.category_id, previousCategoryId)) {
    payload.is_anomaly = false;
  }
  return payload;
}

// ─── Props ──────────────────────────────────────────────────────────────────────

export interface AnomalyCompletionDialogProps {
  item: InventoryItemView | null;
  open: boolean;
  onClose: () => void;
  categories: { id: string; name: string }[];
  onSubmit?: (itemId: string, data: CompletionSubmitPayload) => Promise<void>;
  isLoading?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export const AnomalyCompletionDialog: React.FC<AnomalyCompletionDialogProps> = ({
  item,
  open,
  onClose,
  categories,
  onSubmit,
  isLoading: externalLoading = false,
}) => {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AnomalyCompletionFormValues>({
    resolver: zodResolver(anomalyCompletionSchema),
    defaultValues: {
      name: "",
      category_id: "",
      base_price: 0,
    },
  });

  const { register, control, formState: { errors }, handleSubmit, reset, watch } = form;

  // Reset form when item changes
  useEffect(() => {
    if (item && open) {
      reset({
        name: item.name || "",
        category_id: item.categoryId || "",
        base_price: item.price || 0,
      });
    }
  }, [item, open, reset]);

  const previousCategoryId = item?.categoryId || "";
  const watchedCategoryId = watch("category_id");

  const mutation = useMutation({
    mutationFn: async (data: AnomalyCompletionFormValues) => {
      if (!item) throw new Error("No item selected");

      const payload: Record<string, unknown> = {
        name: data.name,
        category_id: data.category_id,
        base_price: data.base_price,
      };

      if (shouldClearAnomalyFlag(item, data.category_id, previousCategoryId)) {
        payload.is_anomaly = false;
      }

      // If external onSubmit is provided, use it (backward compat)
      if (onSubmit) {
        await onSubmit(item.id, payload as CompletionSubmitPayload);
        return;
      }

      return apiRequest(
        `/v1/inventory/items/${item.id}/complete`,
        "PATCH",
        session,
        payload,
      );
    },
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["retail", "inventory"], ["retail", "inventory", "anomalies"]],
      onClose,
      form,
      successTitle: "Item Completed",
      successDescription: `${item?.name || "Item"} has been updated successfully.`,
    }),
  });

  const onFormSubmit = handleSubmit((data) => mutation.mutate(data));
  const isPending = mutation.isPending || externalLoading;

  const isAnomalyCategory = item?.category?.toLowerCase() === "anomaly";
  const willClearAnomaly = shouldClearAnomalyFlag(item, watchedCategoryId, previousCategoryId);

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
      <DialogContent
        className="max-w-2xl rounded-2xl p-8 border-none shadow-2xl bg-white/95 backdrop-blur-xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <DialogHeader className="px-8 pt-8 pb-4 border-b bg-white/90 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center">
              <span className="text-xl font-black italic text-primary">C</span>
            </div>
            <div>
              <DialogTitle className="text-2xl font-black italic tracking-tight text-foreground">
                Complete Anomaly Item
              </DialogTitle>
              <DialogDescription className="font-bold italic text-xs uppercase tracking-widest text-muted-foreground">
                Update incomplete item details • {item?.sku || "Unknown SKU"}
              </DialogDescription>
            </div>
          </div>
          {isAnomalyCategory && (
            <div className="flex items-center gap-2 text-xs text-warning font-bold bg-warning px-3 py-1.5 rounded-xl mt-2">
              <span className="w-2 h-2 rounded-full bg-warning animate-pulse"></span>
              {willClearAnomaly
                ? "Category changed — anomaly flag will be cleared on save."
                : "This item is in Anomaly category. Changing category will clear the anomaly flag."}
            </div>
          )}
        </DialogHeader>

        <form onSubmit={onFormSubmit} noValidate>
          <fieldset disabled={isPending} className="flex-1 overflow-y-auto px-8 py-6">
            <div className="grid grid-cols-2 gap-6 py-2">
              {/* Row 1: Name */}
              <div className="col-span-2 space-y-2">
                <Label
                  htmlFor="anomaly-name"
                  className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1"
                >
                  Product Name *
                </Label>
                <Input
                  id="anomaly-name"
                  {...register("name")}
                  aria-describedby={errors.name ? "anomaly-name-error" : undefined}
                  aria-invalid={!!errors.name}
                  className="h-12 rounded-2xl font-bold bg-secondary/5 border-none focus-visible:ring-2 focus-visible:ring-blue-500/20 transition-all px-5"
                  placeholder="e.g. Leather Jacket"
                />
                {errors.name && (
                  <p id="anomaly-name-error" className="text-[10px] text-destructive font-medium" role="alert">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* Row 2: Category */}
              <div className="col-span-2 space-y-2">
                <Label
                  htmlFor="anomaly-category"
                  className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1"
                >
                  Category *
                </Label>
                <Controller
                  control={control}
                  name="category_id"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        id="anomaly-category"
                        className="h-12 rounded-2xl font-bold bg-secondary/5 border-none px-5"
                        aria-describedby={errors.category_id ? "anomaly-category-error" : undefined}
                        aria-invalid={!!errors.category_id}
                      >
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-2xl p-2">
                        {(Array.isArray(categories) ? categories : []).map((cat) => (
                          <SelectItem
                            key={cat.id}
                            value={cat.id}
                            className="rounded-xl font-bold italic py-3"
                          >
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.category_id && (
                  <p id="anomaly-category-error" className="text-[10px] text-destructive font-medium" role="alert">
                    {errors.category_id.message}
                  </p>
                )}
                {isAnomalyCategory && (
                  <p className="text-[10px] text-muted-foreground font-bold">
                    Changing from Anomaly category will remove this item from anomaly review.
                  </p>
                )}
              </div>

              {/* Row 3: Price */}
              <div className="col-span-2 space-y-2">
                <Label
                  htmlFor="anomaly-price"
                  className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1"
                >
                  Base Price *
                </Label>
                <div className="relative">
                  <Input
                    id="anomaly-price"
                    type="number"
                    {...register("base_price", { valueAsNumber: true })}
                    aria-describedby={errors.base_price ? "anomaly-price-error" : undefined}
                    aria-invalid={!!errors.base_price}
                    className="h-12 rounded-2xl font-black italic bg-secondary/5 border-none pl-12 pr-5 focus-visible:ring-2 focus-visible:ring-blue-500/20 transition-all"
                  />
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[10px] font-black italic text-muted-foreground">
                    Rp
                  </span>
                </div>
                {errors.base_price && (
                  <p id="anomaly-price-error" className="text-[10px] text-destructive font-medium" role="alert">
                    {errors.base_price.message}
                  </p>
                )}
              </div>
            </div>
          </fieldset>

          <DialogFooter className="px-8 py-6 border-t bg-white/90 backdrop-blur-xl shrink-0 gap-3 sm:justify-start">
            <Button
              type="submit"
              disabled={isPending}
              className="flex-1 h-14 rounded-2xl bg-primary text-primary-foreground font-black italic shadow-xl shadow-slate-900/10 transition-all hover:-translate-y-0.5 hover:bg-primary/90"
            >
              {isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Completing...</>
              ) : (
                "Complete Item"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => { reset(); onClose(); }}
              className="h-14 px-8 rounded-2xl font-black italic bg-card border-2 border-border hover:bg-secondary/5 transition-all"
            >
              Cancel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
