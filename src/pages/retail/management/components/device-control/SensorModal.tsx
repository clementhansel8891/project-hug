/**
 * SensorModal — Sensor detail & threshold configuration modal.
 *
 * Wired with React Hook Form + Zod + useMutation + getMutationToastHandlers.
 * Displays sensor info and provides threshold configuration action.
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
import { Settings2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SIcon, ssc } from "./DeviceControlUI";
import type { BranchSensor } from "@/core/types/retail/retail";
import { apiRequest } from "@/core/api/apiClient";
import { useSession } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";
import { getMutationToastHandlers } from "@/lib/modal-helpers";

// ─── Zod Schema ─────────────────────────────────────────────────────────────────

const sensorThresholdSchema = z.object({
  sensor_id: z.string().min(1, "Sensor ID is required"),
  thresholds: z.object({
    min: z.coerce.number({ required_error: "Min threshold is required" }),
    max: z.coerce.number({ required_error: "Max threshold is required" }),
  }).refine((d) => d.max > d.min, {
    message: "Max must be greater than min",
    path: ["max"],
  }),
});

type SensorThresholdFormValues = z.infer<typeof sensorThresholdSchema>;

// ─── Component ──────────────────────────────────────────────────────────────────

interface SensorModalProps {
  sensor: BranchSensor | null;
  onClose: () => void;
}

const SensorModal = ({ sensor, onClose }: SensorModalProps) => {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<SensorThresholdFormValues>({
    resolver: zodResolver(sensorThresholdSchema),
    defaultValues: {
      sensor_id: sensor?.id ?? "",
      thresholds: {
        min: sensor?.thresholdMin ?? 0,
        max: sensor?.thresholdMax ?? 100,
      },
    },
  });

  const { register, formState: { errors }, handleSubmit, reset } = form;

  // Update defaults when sensor changes
  React.useEffect(() => {
    if (sensor) {
      form.reset({
        sensor_id: sensor.id ?? "",
        thresholds: {
          min: sensor.thresholdMin ?? 0,
          max: sensor.thresholdMax ?? 100,
        },
      });
    }
  }, [sensor?.id]);

  const mutation = useMutation({
    mutationFn: (data: SensorThresholdFormValues) =>
      apiRequest("/kernel/iot/telemetry", "POST", session, data),
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["retail", "sensors"]],
      onClose,
      form,
      successTitle: "Threshold Configured",
      successDescription: `Thresholds updated for ${sensor?.name ?? "sensor"}.`,
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
    <Dialog
      open={!!sensor}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="max-w-md rounded-3xl border-none shadow-2xl bg-card">
        {sensor && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${sensor.status === "normal" ? "bg-success text-success" : sensor.status === "warning" ? "bg-warning text-warning" : sensor.status === "critical" ? "bg-destructive text-destructive" : "bg-secondary/10 text-muted-foreground"}`}
                >
                  <SIcon type={sensor.type} cls="w-6 h-6" />
                </div>
                <div>
                  <DialogTitle className="text-base font-black italic tracking-tighter">
                    {sensor.name}
                  </DialogTitle>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {sensor.type.replace(/_/g, " ").toUpperCase()}
                  </div>
                </div>
                <Badge
                  className={`ml-auto text-[9px] font-black italic uppercase border ${ssc(sensor.status)}`}
                >
                  {sensor.status}
                </Badge>
              </div>
            </DialogHeader>
            <form onSubmit={onSubmit}>
              <fieldset disabled={isPending} className="space-y-4 pt-2">
                {sensor.currentValue !== undefined && (
                  <div
                    className={`rounded-2xl p-5 flex items-center justify-between ${sensor.status === "warning" ? "bg-warning" : sensor.status === "critical" ? "bg-destructive" : "bg-success"}`}
                  >
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                        Current Reading
                      </div>
                      <div
                        className={`text-3xl font-black italic tracking-tighter mt-1 ${sensor.status === "warning" ? "text-warning" : sensor.status === "critical" ? "text-destructive" : "text-success"}`}
                      >
                        {sensor.currentValue}
                        <span className="text-sm ml-1 opacity-60">
                          {sensor.unit}
                        </span>
                      </div>
                    </div>
                    {(sensor.thresholdMin !== undefined ||
                      sensor.thresholdMax !== undefined) && (
                      <div className="text-right text-[11px] text-muted-foreground font-semibold space-y-1">
                        {sensor.thresholdMin !== undefined && (
                          <div>
                            Min: {sensor.thresholdMin}
                            {sensor.unit}
                          </div>
                        )}
                        {sensor.thresholdMax !== undefined && (
                          <div>
                            Max: {sensor.thresholdMax}
                            {sensor.unit}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  {[
                    { l: "Model", v: sensor.model },
                    { l: "Serial No.", v: sensor.serialNumber },
                    { l: "Placement", v: sensor.placement },
                    {
                      l: "Last Reading",
                      v: sensor.lastReading
                        ? new Date(sensor.lastReading).toLocaleString()
                        : undefined,
                    },
                  ]
                    .filter((r) => r.v)
                    .map((r, i) => (
                      <div key={i} className="bg-secondary/5 rounded-2xl p-3">
                        <div className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-1">
                          {r.l}
                        </div>
                        <div className="font-semibold text-muted-foreground font-mono">
                          {r.v}
                        </div>
                      </div>
                    ))}
                </div>

                {/* Threshold configuration fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="sensor-threshold-min"
                      className="text-[10px] font-black uppercase text-muted-foreground tracking-widest"
                    >
                      Min Threshold {sensor.unit ? `(${sensor.unit})` : ""}
                    </Label>
                    <Input
                      id="sensor-threshold-min"
                      type="number"
                      {...register("thresholds.min")}
                      aria-describedby={errors.thresholds?.min ? "sensor-min-error" : undefined}
                      aria-invalid={!!errors.thresholds?.min}
                      className="rounded-xl border-border text-sm"
                    />
                    {errors.thresholds?.min && (
                      <p id="sensor-min-error" className="text-[10px] text-destructive font-medium" role="alert">
                        {errors.thresholds.min.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="sensor-threshold-max"
                      className="text-[10px] font-black uppercase text-muted-foreground tracking-widest"
                    >
                      Max Threshold {sensor.unit ? `(${sensor.unit})` : ""}
                    </Label>
                    <Input
                      id="sensor-threshold-max"
                      type="number"
                      {...register("thresholds.max")}
                      aria-describedby={errors.thresholds?.max ? "sensor-max-error" : undefined}
                      aria-invalid={!!errors.thresholds?.max}
                      className="rounded-xl border-border text-sm"
                    />
                    {errors.thresholds?.max && (
                      <p id="sensor-max-error" className="text-[10px] text-destructive font-medium" role="alert">
                        {errors.thresholds.max.message}
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isPending}
                  className="w-full h-10 rounded-xl bg-secondary text-foreground font-black italic uppercase text-[10px] tracking-widest gap-2"
                >
                  {isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Settings2 className="w-3.5 h-3.5" />
                  )}
                  {isPending ? "Configuring…" : "Configure Threshold"}
                </Button>
              </fieldset>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SensorModal;
