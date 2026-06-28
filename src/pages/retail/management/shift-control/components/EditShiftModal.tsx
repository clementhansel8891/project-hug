/**
 * EditShiftModal — Edit shift assignment with React Hook Form + Zod + useMutation.
 *
 * Wired according to the canonical pattern:
 * 1. Zod schema for validation (employee, time range, role required)
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

import React, { useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { User, Clock, Trash2, Loader2 } from "lucide-react";
import { useSession } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/core/api/apiClient";
import { getMutationToastHandlers } from "@/lib/modal-helpers";
import type { ScheduledShift } from "./ScheduleGrid";

// ─── Zod Schema ─────────────────────────────────────────────────────────────────

const editShiftAssignmentSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  role: z.string().min(1, "Role is required"),
}).refine(
  (data) => data.endTime > data.startTime,
  { message: "End time must be after start time", path: ["endTime"] }
);

export type EditShiftAssignmentFormValues = z.infer<typeof editShiftAssignmentSchema>;

// ─── Props ──────────────────────────────────────────────────────────────────────

interface EditShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: ScheduledShift | null;
  onSave: (updatedShift: ScheduledShift) => void;
  onDelete: (shiftId: string) => void;
  availableStaff: { id: string; name: string; role: string }[];
}

// ─── Component ──────────────────────────────────────────────────────────────────

export const EditShiftModal: React.FC<EditShiftModalProps> = ({
  isOpen,
  onClose,
  shift,
  onSave,
  onDelete,
  availableStaff,
}) => {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<EditShiftAssignmentFormValues>({
    resolver: zodResolver(editShiftAssignmentSchema),
    defaultValues: {
      employeeId: "",
      startTime: "",
      endTime: "",
      role: "",
    },
  });

  const { control, formState: { errors }, handleSubmit, reset, register } = form;

  // Reset form when shift prop changes
  useEffect(() => {
    if (shift) {
      reset({
        employeeId: shift.employeeId === "NEW" ? "" : shift.employeeId,
        startTime: shift.startTime,
        endTime: shift.endTime,
        role: shift.role,
      });
    }
  }, [shift, reset]);

  // ─── useMutation — Save shift ──────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (data: EditShiftAssignmentFormValues) =>
      apiRequest(`/v1/retail/shifts/${shift?.id}`, "PATCH", session, {
        employee_id: data.employeeId,
        start_time: data.startTime,
        end_time: data.endTime,
        role: data.role,
      }),
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["retail", "shifts"]],
      onClose: () => {
        // Also call the parent callback for local state sync
        if (shift) {
          const emp = availableStaff.find((s) => s.id === form.getValues("employeeId"));
          onSave({
            ...shift,
            employeeId: form.getValues("employeeId"),
            name: emp?.name || shift.name,
            role: form.getValues("role"),
            startTime: form.getValues("startTime"),
            endTime: form.getValues("endTime"),
          });
        }
        onClose();
      },
      form,
      successTitle: "Shift Updated",
      successDescription: "Shift assignment saved successfully.",
    }),
  });

  // ─── useMutation — Delete shift ────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/retail/shifts/${shift?.id}`, "DELETE", session),
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["retail", "shifts"]],
      onClose: () => {
        if (shift) onDelete(shift.id);
        onClose();
      },
      form,
      successTitle: "Shift Deleted",
      successDescription: "Shift block removed.",
    }),
  });

  if (!shift) return null;

  const isPending = saveMutation.isPending || deleteMutation.isPending;
  const onSubmit = handleSubmit((data) => saveMutation.mutate(data));

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  const handleClose = () => {
    if (isPending) return;
    reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-md bg-card rounded-2xl p-8 border border-border shadow-2xl" aria-describedby="edit-shift-description">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-xl font-black italic tracking-tighter flex items-center gap-3 text-foreground">
            <div className="p-2.5 rounded-2xl bg-primary/5 text-primary">
              <User className="w-5 h-5" />
            </div>
            {shift.name === "Unassigned"
              ? "ASSIGN SHIFT"
              : "EDIT ASSIGNMENT"}
          </DialogTitle>
          <p id="edit-shift-description" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-14">
            {shift.dayOfWeek === 1
              ? "Monday"
              : shift.dayOfWeek === 2
                ? "Tuesday"
                : shift.dayOfWeek === 3
                  ? "Wednesday"
                  : shift.dayOfWeek === 4
                    ? "Thursday"
                    : shift.dayOfWeek === 5
                      ? "Friday"
                      : shift.dayOfWeek === 6
                        ? "Saturday"
                        : "Sunday"}{" "}
            Block
          </p>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate>
          <fieldset disabled={isPending} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="edit-shift-employee" className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground">
                Personnel *
              </label>
              <Controller
                control={control}
                name="employeeId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger
                      id="edit-shift-employee"
                      className="w-full h-12 bg-secondary/5 border-border text-foreground font-bold italic rounded-xl"
                      aria-describedby={errors.employeeId ? "edit-shift-employee-error" : undefined}
                      aria-invalid={!!errors.employeeId}
                    >
                      <SelectValue placeholder="Select Employee..." />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border rounded-xl">
                      {(Array.isArray(availableStaff) ? availableStaff : []).map((emp) => (
                        <SelectItem
                          key={emp.id}
                          value={emp.id}
                          className="font-bold cursor-pointer italic text-xs hover:bg-secondary/5"
                        >
                          {emp.name}{" "}
                          <span className="text-[9px] text-muted-foreground ml-2 uppercase">
                            {emp.role}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.employeeId && (
                <p id="edit-shift-employee-error" className="text-[10px] text-destructive font-medium" role="alert">
                  {errors.employeeId.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="edit-shift-start" className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> Start Time *
                </label>
                <Input
                  id="edit-shift-start"
                  type="time"
                  {...register("startTime")}
                  className="h-12 bg-secondary/5 border-border rounded-xl font-bold italic"
                  aria-describedby={errors.startTime ? "edit-shift-start-error" : undefined}
                  aria-invalid={!!errors.startTime}
                />
                {errors.startTime && (
                  <p id="edit-shift-start-error" className="text-[10px] text-destructive font-medium" role="alert">
                    {errors.startTime.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label htmlFor="edit-shift-end" className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> End Time *
                </label>
                <Input
                  id="edit-shift-end"
                  type="time"
                  {...register("endTime")}
                  className="h-12 bg-secondary/5 border-border rounded-xl font-bold italic"
                  aria-describedby={errors.endTime ? "edit-shift-end-error" : undefined}
                  aria-invalid={!!errors.endTime}
                />
                {errors.endTime && (
                  <p id="edit-shift-end-error" className="text-[10px] text-destructive font-medium" role="alert">
                    {errors.endTime.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="edit-shift-role" className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground">
                Assigned Role *
              </label>
              <Input
                id="edit-shift-role"
                {...register("role")}
                className="h-12 bg-secondary/5 border-border rounded-xl font-bold italic text-foreground"
                aria-describedby={errors.role ? "edit-shift-role-error" : undefined}
                aria-invalid={!!errors.role}
              />
              {errors.role && (
                <p id="edit-shift-role-error" className="text-[10px] text-destructive font-medium" role="alert">
                  {errors.role.message}
                </p>
              )}
            </div>
          </fieldset>

          <DialogFooter className="mt-8 flex justify-between items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={handleDelete}
              className="text-[10px] font-black italic uppercase tracking-widest text-destructive hover:text-destructive hover:bg-destructive rounded-xl h-11"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={handleClose}
                className="text-[10px] font-black italic uppercase tracking-widest rounded-xl h-11 border-border"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="text-[10px] font-black italic uppercase tracking-widest bg-primary hover:bg-primary text-foreground rounded-xl h-11 px-6 shadow-md"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Confirm
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
