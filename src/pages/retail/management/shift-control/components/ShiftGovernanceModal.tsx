/**
 * ShiftGovernanceModal — Publish schedule with mandatory justification.
 *
 * Wired according to the canonical pattern:
 * 1. Zod schema for validation (reason required)
 * 2. useForm with zodResolver
 * 3. useMutation with apiRequest
 * 4. getMutationToastHandlers for standardized success/error
 * 5. Loading states (isPending disables submit/cancel/fields)
 * 6. Accessibility: aria-describedby on error fields, aria-invalid, role="alert"
 *
 * Requirements: 1 (Form Fields), 2 (Validation), 3 (API Submission),
 *               4 (Loading State), 5 (Error Handling), 6 (Success Handling),
 *               10 (Consistent Pattern)
 */

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert, AlertTriangle, Fingerprint, Loader2 } from "lucide-react";
import { useSession } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/core/api/apiClient";
import { getMutationToastHandlers } from "@/lib/modal-helpers";

// ─── Zod Schema ─────────────────────────────────────────────────────────────────

const shiftPublishSchema = z.object({
  reason: z.string().min(1, "Publication justification is required"),
});

type ShiftPublishFormValues = z.infer<typeof shiftPublishSchema>;

// ─── Props ──────────────────────────────────────────────────────────────────────

interface ShiftGovernanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublish: (reason: string) => Promise<void>;
  affectedShiftsCount: number;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export const ShiftGovernanceModal: React.FC<ShiftGovernanceModalProps> = ({
  isOpen,
  onClose,
  onPublish,
  affectedShiftsCount,
}) => {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ShiftPublishFormValues>({
    resolver: zodResolver(shiftPublishSchema),
    defaultValues: { reason: "" },
  });

  const { register, formState: { errors }, handleSubmit, reset } = form;

  // ─── useMutation — Publish schedule ─────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async (data: ShiftPublishFormValues) => {
      // Call the API to publish the schedule
      await apiRequest("/v1/retail/shifts/publish", "POST", session, {
        reason: data.reason,
        affected_count: affectedShiftsCount,
      });
      // Also call the parent callback for legacy compatibility
      await onPublish(data.reason);
    },
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["retail", "shifts"]],
      onClose,
      form,
      successTitle: "Schedule Published",
      successDescription: `${affectedShiftsCount} shift assignments published to Core HR.`,
    }),
  });

  const isPending = mutation.isPending;
  const onSubmit = handleSubmit((data) => mutation.mutate(data));

  const handleClose = () => {
    if (isPending) return;
    reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent
        className="max-w-md bg-secondary border-border p-8 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] text-foreground"
        aria-describedby="shift-governance-description"
      >
        <DialogHeader className="mb-6">
          <DialogTitle className="text-xl font-black italic tracking-tighter flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/20 text-primary">
              <ShieldAlert className="w-6 h-6" />
            </div>
            PUBLISH SCHEDULE
          </DialogTitle>
          <p id="shift-governance-description" className="text-[10px] font-black text-primary/80 uppercase tracking-widest mt-2 pl-14">
            Core HR Synchronization
          </p>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate>
          <fieldset disabled={isPending} className="space-y-6">
            <div className="p-4 rounded-3xl bg-primary/20 border border-primary flex gap-4">
              <AlertTriangle className="w-6 h-6 text-primary shrink-0" />
              <div className="text-[10px] font-bold italic text-primary/70 uppercase leading-relaxed">
                You are about to publish {affectedShiftsCount} shift assignments
                to the Zenvix Core HR module. Once published, devices will enforce
                these schedules for clock-in/out protocols.
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="governance-reason" className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground block mb-2">
                  Mandatory: Publication Justification *
                </label>
                <textarea
                  id="governance-reason"
                  className="w-full h-24 bg-secondary/60 border-border text-foreground rounded-xl p-4 font-bold italic text-sm placeholder:text-muted-foreground focus:border-primary outline-none resize-none transition-colors"
                  placeholder="E.g., Weekly Schedule generation approved by..."
                  {...register("reason")}
                  aria-describedby={errors.reason ? "governance-reason-error" : undefined}
                  aria-invalid={!!errors.reason}
                />
                {errors.reason && (
                  <p id="governance-reason-error" className="text-[10px] text-destructive font-medium mt-1" role="alert">
                    {errors.reason.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 text-muted-foreground">
              <Fingerprint className="w-4 h-4" />
              <span className="text-[9px] font-black italic uppercase tracking-widest">
                Superadmin Audit Subsystem Auto-Attached
              </span>
            </div>
          </fieldset>

          <DialogFooter className="mt-8 gap-3 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={handleClose}
              className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-xl h-11"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="text-[10px] font-black italic uppercase tracking-widest bg-primary hover:bg-primary text-foreground rounded-xl h-11 px-6 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Commit payload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
