/**
 * DeviceModal — Device detail & configuration modal.
 *
 * Wired with React Hook Form + Zod + useMutation + getMutationToastHandlers.
 * Displays device info and provides a "Configure" (pair) action.
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
import { X, Settings2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeviceIcon, ConnIcon, connLabel, dsc } from "./DeviceControlUI";
import type { ExtDevice } from "./DeviceControlTypes";
import { apiRequest } from "@/core/api/apiClient";
import { useSession } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";
import { getMutationToastHandlers } from "@/lib/modal-helpers";

// ─── Zod Schema ─────────────────────────────────────────────────────────────────

const deviceConfigSchema = z.object({
  mac_address: z.string().min(1, "MAC address is required"),
  type: z.string().min(1, "Device type is required"),
});

type DeviceConfigFormValues = z.infer<typeof deviceConfigSchema>;

// ─── Component ──────────────────────────────────────────────────────────────────

interface DeviceModalProps {
  dev: ExtDevice | null;
  onClose: () => void;
}

const DeviceModal = ({ dev, onClose }: DeviceModalProps) => {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<DeviceConfigFormValues>({
    resolver: zodResolver(deviceConfigSchema),
    defaultValues: {
      mac_address: dev?.macAddress ?? "",
      type: dev?.type ?? "",
    },
  });

  // Update defaults when dev changes
  React.useEffect(() => {
    if (dev) {
      form.reset({
        mac_address: dev.macAddress ?? "",
        type: dev.type ?? "",
      });
    }
  }, [dev?.id]);

  const mutation = useMutation({
    mutationFn: (data: DeviceConfigFormValues) =>
      apiRequest("/kernel/iot/pair", "POST", session, data),
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["retail", "devices"]],
      onClose,
      form,
      successTitle: "Device Configured",
      successDescription: `${dev?.name ?? "Device"} has been paired successfully.`,
    }),
  });

  const isPending = mutation.isPending;

  const onSubmit = form.handleSubmit((data) => mutation.mutate(data));

  const handleClose = () => {
    if (isPending) return;
    form.reset();
    onClose();
  };

  return (
    <Dialog
      open={!!dev}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="max-w-lg rounded-3xl border-none shadow-2xl bg-white">
        {dev && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${dev.status === "online" ? "bg-success text-success" : dev.status === "maintenance" ? "bg-warning text-warning" : "bg-secondary/10 text-muted-foreground"}`}
                >
                  <DeviceIcon type={dev.type} cls="w-6 h-6" />
                </div>
                <div>
                  <DialogTitle className="text-base font-black italic tracking-tighter text-foreground">
                    {dev.name}
                  </DialogTitle>
                  <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    {dev.type.replace(/_/g, " ").toUpperCase()}
                  </div>
                </div>
                <Badge
                  className={`ml-auto text-[9px] font-black italic uppercase tracking-widest border ${dsc(dev.status)}`}
                >
                  {dev.status}
                </Badge>
              </div>
            </DialogHeader>
            <form onSubmit={onSubmit}>
              <fieldset disabled={isPending} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  {[
                    { l: "Model", v: dev.model },
                    { l: "Serial No.", v: dev.serialNumber },
                    { l: "MAC Address", v: dev.macAddress },
                    { l: "IP Address", v: dev.ipAddress },
                    {
                      l: "Connection",
                      v: dev.connType ? connLabel[dev.connType] : undefined,
                      icon: <ConnIcon t={dev.connType} />,
                    },
                    { l: "COM Port", v: dev.comPort },
                    { l: "USB Port", v: dev.usbPort },
                    { l: "Usage / Role", v: dev.assignment?.role },
                    { l: "Firmware", v: dev.firmwareVersion },
                    { l: "Driver", v: dev.driverVersion },
                    {
                      l: "Last Seen",
                      v: dev.lastSeen
                        ? new Date(dev.lastSeen).toLocaleString()
                        : undefined,
                    },
                  ]
                    .filter((r) => r.v)
                    .map((r, i) => (
                      <div key={i} className="bg-secondary/5 rounded-2xl p-3">
                        <div className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-1">
                          {r.l}
                        </div>
                        <div className="flex items-center gap-1.5 font-semibold text-muted-foreground font-mono">
                          {r.icon}
                          {r.v}
                        </div>
                      </div>
                    ))}
                </div>
                {dev.notes && (
                  <div className="bg-secondary/5 rounded-2xl p-3 text-[11px] text-muted-foreground">
                    {dev.notes}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button
                    type="submit"
                    disabled={isPending}
                    className="flex-1 h-10 rounded-xl bg-secondary text-foreground font-black italic uppercase text-[10px] tracking-widest gap-2"
                  >
                    {isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Settings2 className="w-3.5 h-3.5" />
                    )}
                    {isPending ? "Configuring…" : "Configure"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending}
                    onClick={handleClose}
                    className="h-10 w-10 rounded-xl border-border text-muted-foreground flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </fieldset>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DeviceModal;
