/**
 * CreatePromoModal — Create promotion with React Hook Form + Zod + useMutation.
 *
 * Wired according to the canonical pattern:
 * 1. Zod schema for validation (title, type, value, dates required)
 * 2. useForm with zodResolver
 * 3. useMutation with apiRequest
 * 4. getMutationToastHandlers for standardized success/error
 * 5. Loading states (isPending disables submit/cancel/fields via fieldset)
 * 6. Accessibility: aria-describedby on error fields, aria-invalid, role="alert"
 *
 * Requirements: 1 (Form Fields), 2 (Validation), 3 (API Submission),
 *               4 (Loading State), 5 (Error Handling), 6 (Success Handling),
 *               10 (Consistent Pattern)
 */

import React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Percent, Target } from "lucide-react";
import { useSession } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/core/api/apiClient";
import { getMutationToastHandlers } from "@/lib/modal-helpers";

// ─── Zod Schema ─────────────────────────────────────────────────────────────────

const createPromoSchema = z.object({
  title: z.string().min(1, "Campaign title is required").max(200, "Title must be 200 characters or fewer"),
  type: z.enum(["percentage", "fixed_amount"], { required_error: "Promo type is required" }),
  value: z.coerce.number().positive("Discount value must be greater than 0"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  target: z.enum(["all", "category", "specific_items"], { required_error: "Target scope is required" }),
}).refine(
  (data) => data.endDate >= data.startDate,
  { message: "End date must be on or after start date", path: ["endDate"] }
);

export type CreatePromoFormValues = z.infer<typeof createPromoSchema>;

// ─── Props ──────────────────────────────────────────────────────────────────────

interface CreatePromoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (promo: unknown) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export const CreatePromoModal: React.FC<CreatePromoModalProps> = ({ isOpen, onClose, onCreated }) => {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CreatePromoFormValues>({
    resolver: zodResolver(createPromoSchema),
    defaultValues: {
      title: "",
      type: "percentage",
      value: undefined as unknown as number,
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      target: "all",
    },
  });

  const { register, formState: { errors }, handleSubmit, reset, watch } = form;
  const promoType = watch("type");

  function handleClose() {
    if (mutation.isPending) return;
    reset();
    onClose();
  }

  const mutation = useMutation({
    mutationFn: (data: CreatePromoFormValues) =>
      apiRequest("/v1/retail/promotions", "POST", session, {
        title: data.title,
        type: data.type,
        value: data.value,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
        status: "draft",
        target: data.target,
      }),
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["retail", "promotions"]],
      onClose: () => {
        onCreated?.(null);
        handleClose();
      },
      form,
      successTitle: "Proposal Issued",
      successDescription: "Promotion has been added to the governance queue.",
    }),
  });

  const isPending = mutation.isPending;
  const onSubmit = handleSubmit((data) => mutation.mutate(data));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-md rounded-[2rem] p-6 border border-border shadow-2xl bg-muted backdrop-blur-2xl text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-black italic tracking-tighter uppercase flex items-center gap-2 text-foreground">
            <Plus className="w-5 h-5 text-primary" /> Issue Promo Proposal
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-6 mt-4">
          <fieldset disabled={isPending} className="space-y-4">
            <div>
              <label htmlFor="promo-title" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2 mb-1 block">
                Campaign Title *
              </label>
              <Input
                id="promo-title"
                {...register("title")}
                className="h-12 rounded-xl border-border font-bold italic bg-card text-foreground focus:border-primary/50 placeholder:text-muted-foreground/50"
                placeholder="e.g. End of Season Sale"
                aria-describedby={errors.title ? "promo-title-error" : undefined}
                aria-invalid={!!errors.title}
              />
              {errors.title && (
                <p id="promo-title-error" className="text-[10px] text-destructive font-medium mt-1 ml-2" role="alert">
                  {errors.title.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="promo-type" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2 mb-1 block">
                  Promo Type *
                </label>
                <select
                  id="promo-type"
                  {...register("type")}
                  className="w-full h-12 px-3 rounded-xl border border-border font-bold italic bg-muted text-foreground text-sm outline-none focus:border-primary/50"
                  aria-describedby={errors.type ? "promo-type-error" : undefined}
                  aria-invalid={!!errors.type}
                >
                  <option value="percentage" className="bg-muted text-foreground">Percentage (%)</option>
                  <option value="fixed_amount" className="bg-muted text-foreground">Fixed Amount (Rp)</option>
                </select>
                {errors.type && (
                  <p id="promo-type-error" className="text-[10px] text-destructive font-medium mt-1 ml-2" role="alert">
                    {errors.type.message}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="promo-value" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2 mb-1 block">
                  Discount Value *
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {promoType === "percentage" ? <Percent className="w-4 h-4" /> : <span className="font-bold text-xs italic">Rp</span>}
                  </div>
                  <Input
                    id="promo-value"
                    type="number"
                    {...register("value")}
                    className="h-12 pl-10 rounded-xl border-border font-black italic bg-card text-foreground focus:border-primary/50 placeholder:text-muted-foreground/50"
                    placeholder="0"
                    aria-describedby={errors.value ? "promo-value-error" : undefined}
                    aria-invalid={!!errors.value}
                  />
                </div>
                {errors.value && (
                  <p id="promo-value-error" className="text-[10px] text-destructive font-medium mt-1 ml-2" role="alert">
                    {errors.value.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="promo-start-date" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2 mb-1 block">
                  Start Date *
                </label>
                <Input
                  id="promo-start-date"
                  type="date"
                  {...register("startDate")}
                  className="h-12 rounded-xl border-border font-bold bg-card text-foreground focus:border-primary/50"
                  aria-describedby={errors.startDate ? "promo-start-date-error" : undefined}
                  aria-invalid={!!errors.startDate}
                />
                {errors.startDate && (
                  <p id="promo-start-date-error" className="text-[10px] text-destructive font-medium mt-1 ml-2" role="alert">
                    {errors.startDate.message}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="promo-end-date" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2 mb-1 block">
                  End Date *
                </label>
                <Input
                  id="promo-end-date"
                  type="date"
                  {...register("endDate")}
                  className="h-12 rounded-xl border-border font-bold bg-card text-foreground focus:border-primary/50"
                  aria-describedby={errors.endDate ? "promo-end-date-error" : undefined}
                  aria-invalid={!!errors.endDate}
                />
                {errors.endDate && (
                  <p id="promo-end-date-error" className="text-[10px] text-destructive font-medium mt-1 ml-2" role="alert">
                    {errors.endDate.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="promo-target" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2 mb-1 block flex items-center gap-1">
                <Target className="w-3 h-3" /> Target Scope *
              </label>
              <select
                id="promo-target"
                {...register("target")}
                className="w-full h-12 px-3 rounded-xl border border-border font-bold italic bg-muted text-foreground text-sm outline-none focus:border-primary/50"
                aria-describedby={errors.target ? "promo-target-error" : undefined}
                aria-invalid={!!errors.target}
              >
                <option value="all" className="bg-muted text-foreground">All Items (Global)</option>
                <option value="category" className="bg-muted text-foreground">Specific Category</option>
                <option value="specific_items" className="bg-muted text-foreground">Specific Items</option>
              </select>
              {errors.target && (
                <p id="promo-target-error" className="text-[10px] text-destructive font-medium mt-1 ml-2" role="alert">
                  {errors.target.message}
                </p>
              )}
            </div>
          </fieldset>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              className="flex-1 h-12 rounded-xl font-bold uppercase tracking-wider text-xs border-border hover:bg-muted/10 text-muted-foreground hover:text-foreground"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black italic uppercase tracking-wider text-xs shadow-lg shadow-primary/20"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Queue Proposal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
