/**
 * StaffDetailsModal — Staff details view/edit with React Hook Form + Zod + useMutation.
 *
 * Wired according to the canonical pattern:
 * 1. Zod schema for validation (editable fields: roleTitle, location, phone)
 * 2. useForm with zodResolver + defaultValues from staff prop
 * 3. useMutation with apiRequest (PATCH to update staff)
 * 4. getMutationToastHandlers for standardized success/error
 * 5. Loading states (isPending disables submit/cancel/fields via fieldset)
 * 6. Accessibility: aria-describedby on error fields, aria-invalid, role="alert"
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, User, Building, MapPin, Briefcase, Loader2 } from "lucide-react";
import { useSession } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/core/api/apiClient";
import { getMutationToastHandlers } from "@/lib/modal-helpers";
import type { Employee } from "@/core/types/hr/employee";

// ─── Zod Schema ─────────────────────────────────────────────────────────────────

const staffDetailsSchema = z.object({
  roleTitle: z.string().min(1, "Role title is required").max(100, "Role title must be 100 characters or fewer"),
  location: z.string().max(200, "Location must be 200 characters or fewer").optional().default(""),
  phone: z.string().max(20, "Phone must be 20 characters or fewer").optional().default(""),
});

export type StaffDetailsFormValues = z.infer<typeof staffDetailsSchema>;

// ─── Props ──────────────────────────────────────────────────────────────────────

interface StaffDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: Employee | null;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export const StaffDetailsModal: React.FC<StaffDetailsModalProps> = ({
  isOpen,
  onClose,
  staff,
}) => {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<StaffDetailsFormValues>({
    resolver: zodResolver(staffDetailsSchema),
    defaultValues: {
      roleTitle: "",
      location: "",
      phone: "",
    },
  });

  const { register, formState: { errors }, handleSubmit, reset } = form;

  // Reset form values when staff changes
  useEffect(() => {
    if (staff) {
      reset({
        roleTitle: staff.roleTitle || "",
        location: staff.location || "",
        phone: staff.phone || "",
      });
    }
  }, [staff, reset]);

  const mutation = useMutation({
    mutationFn: (data: StaffDetailsFormValues) =>
      apiRequest(`/v1/retail/staff/${staff?.id}`, "PATCH", session, data),
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["retail", "staff"]],
      onClose: handleClose,
      form,
      successTitle: "Staff Updated",
      successDescription: "Staff details have been updated successfully.",
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
      <DialogContent className="max-w-xl bg-secondary border-border p-8 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] text-foreground">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-xl font-black italic tracking-tighter flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/20 text-primary">
              <User className="w-6 h-6" />
            </div>
            PERSONNEL DOSSIER: {staff.fullName.toUpperCase()}
          </DialogTitle>
          <div className="text-[10px] font-black text-primary uppercase tracking-widest mt-2 pl-14">
            Editable Access Record
          </div>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate>
          <fieldset disabled={isPending} className="space-y-6">
            {/* Read-only info cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-secondary/60 p-4 rounded-3xl border border-border space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground italic">
                  <ShieldCheck className="w-3.5 h-3.5 text-success" /> Security Status
                </div>
                <Badge
                  className={
                    staff.status === "active"
                      ? "bg-success/20 text-success border-none px-3"
                      : "bg-secondary/50 text-muted-foreground border-none px-3"
                  }
                >
                  {staff.status.toUpperCase()}
                </Badge>
              </div>
              <div className="bg-secondary/60 p-4 rounded-3xl border border-border space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground italic">
                  <Building className="w-3.5 h-3.5 text-primary" /> Department
                </div>
                <div className="text-sm font-bold">{staff.departmentId}</div>
              </div>
            </div>

            {/* Editable fields */}
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="staff-role-title"
                  className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground block mb-2 flex items-center gap-2"
                >
                  <Briefcase className="w-3.5 h-3.5 text-primary" /> Role Title *
                </label>
                <Input
                  id="staff-role-title"
                  {...register("roleTitle")}
                  className="h-12 bg-secondary/60 rounded-xl border border-border px-4 font-bold text-sm text-foreground"
                  aria-describedby={errors.roleTitle ? "staff-role-title-error" : undefined}
                  aria-invalid={!!errors.roleTitle}
                />
                {errors.roleTitle && (
                  <p id="staff-role-title-error" className="text-[10px] text-destructive font-medium mt-1" role="alert">
                    {errors.roleTitle.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="staff-location"
                  className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground block mb-2 flex items-center gap-2"
                >
                  <MapPin className="w-3.5 h-3.5 text-warning" /> Location Node
                </label>
                <Input
                  id="staff-location"
                  {...register("location")}
                  className="h-12 bg-secondary/60 rounded-xl border border-border px-4 font-bold text-sm text-foreground"
                  aria-describedby={errors.location ? "staff-location-error" : undefined}
                  aria-invalid={!!errors.location}
                />
                {errors.location && (
                  <p id="staff-location-error" className="text-[10px] text-destructive font-medium mt-1" role="alert">
                    {errors.location.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="staff-phone"
                  className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground block mb-2"
                >
                  Contact Phone
                </label>
                <Input
                  id="staff-phone"
                  {...register("phone")}
                  className="h-12 bg-secondary/60 rounded-xl border border-border px-4 font-bold text-sm text-foreground"
                  placeholder="+62..."
                  aria-describedby={errors.phone ? "staff-phone-error" : undefined}
                  aria-invalid={!!errors.phone}
                />
                {errors.phone && (
                  <p id="staff-phone-error" className="text-[10px] text-destructive font-medium mt-1" role="alert">
                    {errors.phone.message}
                  </p>
                )}
              </div>
            </div>

            {/* Access sub-scopes (read-only display) */}
            <div className="bg-secondary/60 p-5 rounded-3xl border border-border">
              <div className="text-[10px] font-black uppercase text-muted-foreground italic mb-3">
                Access Sub-Scopes
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-secondary border border-border text-muted-foreground font-black italic tracking-widest text-[9px] uppercase px-3 py-1">
                  RETAIL_CORE
                </Badge>
                <Badge className="bg-secondary border border-border text-muted-foreground font-black italic tracking-widest text-[9px] uppercase px-3 py-1">
                  POS_EXEC
                </Badge>
                {staff.roleTitle.includes("Head") ||
                staff.roleTitle.includes("Manager") ? (
                  <Badge className="bg-primary border border-primary text-primary font-black italic tracking-widest text-[9px] uppercase px-3 py-1">
                    SHIFT_SUPERVISOR
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="text-center pt-2">
              <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">
                Zenvix Global ID: {staff.id}
              </div>
            </div>
          </fieldset>

          <DialogFooter className="mt-6 gap-3 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={handleClose}
              className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-xl h-11"
            >
              Close
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="text-[10px] font-black italic uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-11 px-6"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
