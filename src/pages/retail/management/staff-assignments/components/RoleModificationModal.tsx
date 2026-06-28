/**
 * RoleModificationModal — Role assignment/modification with React Hook Form + Zod + useMutation.
 *
 * Wired according to the canonical pattern:
 * 1. Zod schema for validation (newRole, reason required)
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldHalf, Lock, AlertTriangle, Loader2 } from "lucide-react";
import { useSession } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/core/api/apiClient";
import { getMutationToastHandlers } from "@/lib/modal-helpers";
import type { Employee } from "@/core/types/hr/employee";

// ─── Zod Schema ─────────────────────────────────────────────────────────────────

const roleModificationSchema = z.object({
  newRole: z.string().min(1, "Role selection is required"),
  reason: z.string().min(5, "Justification must be at least 5 characters").max(500, "Justification must be 500 characters or fewer"),
});

export type RoleModificationFormValues = z.infer<typeof roleModificationSchema>;

// ─── Constants ──────────────────────────────────────────────────────────────────

const AVAILABLE_ROLES = [
  "Cashier",
  "Shift Supervisor",
  "Store Manager",
  "Inventory Specialist",
  "Retail HOD",
];

// ─── Props ──────────────────────────────────────────────────────────────────────

interface RoleModificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: Employee | null;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export const RoleModificationModal: React.FC<RoleModificationModalProps> = ({
  isOpen,
  onClose,
  staff,
}) => {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<RoleModificationFormValues>({
    resolver: zodResolver(roleModificationSchema),
    defaultValues: {
      newRole: "",
      reason: "",
    },
  });

  const { control, register, formState: { errors }, handleSubmit, reset } = form;

  const mutation = useMutation({
    mutationFn: (data: RoleModificationFormValues) =>
      apiRequest("/v1/retail/staff/roles", "POST", session, {
        employeeId: staff?.id,
        newRole: data.newRole,
        reason: data.reason,
      }),
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["retail", "staff"], ["retail", "roles"]],
      onClose: handleClose,
      form,
      successTitle: "Role Modified",
      successDescription: `Role has been updated successfully.`,
    }),
  });

  const isPending = mutation.isPending;

  function handleClose() {
    if (isPending) return;
    reset();
    onClose();
  }

  const onSubmit = handleSubmit((data) => mutation.mutate(data));

  if (!staff) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-md bg-secondary border-border p-8 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] text-foreground">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-xl font-black italic tracking-tighter flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-warning text-warning">
              <ShieldHalf className="w-6 h-6" />
            </div>
            MODIFY PERMISSIONS
          </DialogTitle>
          <div className="text-[10px] font-black text-warning uppercase tracking-widest mt-2 pl-14">
            Security Clearance Override
          </div>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate>
          <fieldset disabled={isPending} className="space-y-6">
            <div className="p-4 rounded-3xl bg-warning border border-warning/20 flex gap-4">
              <AlertTriangle className="w-6 h-6 text-warning shrink-0" />
              <div className="text-[10px] font-bold italic text-warning uppercase leading-relaxed">
                Warning: Elevating access scope requires an audit trail entry.
                This action will be logged into the Zenvix Vault permanently.
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground block mb-2">
                  Target Personnel
                </label>
                <div className="h-12 bg-secondary/60 rounded-xl border border-border flex items-center px-4 font-bold text-sm text-muted-foreground/60">
                  {staff.fullName} ({staff.roleTitle})
                </div>
              </div>

              <div>
                <label
                  htmlFor="role-mod-newrole"
                  className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground block mb-2"
                >
                  New Assignable Role *
                </label>
                <Controller
                  control={control}
                  name="newRole"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        id="role-mod-newrole"
                        className="w-full h-12 bg-secondary/60 border-border text-foreground font-bold italic rounded-xl"
                        aria-describedby={errors.newRole ? "role-mod-newrole-error" : undefined}
                        aria-invalid={!!errors.newRole}
                      >
                        <SelectValue placeholder="Select Governance Role..." />
                      </SelectTrigger>
                      <SelectContent className="bg-secondary/60 border-border text-foreground rounded-xl">
                        {AVAILABLE_ROLES.map((role) => (
                          <SelectItem
                            key={role}
                            value={role}
                            className="font-bold cursor-pointer italic text-xs hover:bg-secondary"
                          >
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.newRole && (
                  <p id="role-mod-newrole-error" className="text-[10px] text-destructive font-medium mt-1" role="alert">
                    {errors.newRole.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="role-mod-reason"
                  className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground block mb-2"
                >
                  Required: Justification *
                </label>
                <textarea
                  id="role-mod-reason"
                  className="w-full h-24 bg-secondary/60 border-border text-foreground rounded-xl p-4 font-bold italic text-sm placeholder:text-muted-foreground focus:border-warning outline-none resize-none transition-colors"
                  placeholder="Enter cryptographic audit reason..."
                  {...register("reason")}
                  aria-describedby={errors.reason ? "role-mod-reason-error" : undefined}
                  aria-invalid={!!errors.reason}
                />
                {errors.reason && (
                  <p id="role-mod-reason-error" className="text-[10px] text-destructive font-medium mt-1" role="alert">
                    {errors.reason.message}
                  </p>
                )}
              </div>
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
              Cancel Protocol
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="text-[10px] font-black italic uppercase tracking-widest bg-warning hover:bg-warning text-foreground rounded-xl h-11 px-6 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 mr-2" /> Sign & Modify
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
