/**
 * DiscoveryModal — Network discovery results & device onboarding.
 *
 * Wired with React Hook Form + Zod + useMutation + getMutationToastHandlers.
 * Displays discovered hardware and provides "Onboard" action per device.
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
import { Wifi, RefreshCw, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DeviceIcon } from "./DeviceControlUI";
import type { DiscoveredDevice } from "./DeviceControlTypes";
import { apiRequest } from "@/core/api/apiClient";
import { useSession } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";
import { getMutationToastHandlers } from "@/lib/modal-helpers";

// ─── Zod Schema ─────────────────────────────────────────────────────────────────

const onboardDeviceSchema = z.object({
  discoveryId: z.string().min(1, "Discovery ID is required"),
});

type OnboardDeviceFormValues = z.infer<typeof onboardDeviceSchema>;

// ─── Component ──────────────────────────────────────────────────────────────────

interface DiscoveryModalProps {
  open: boolean;
  loading: boolean;
  results: DiscoveredDevice[];
  onClose: () => void;
  onCommit: (id: string) => void;
}

const DiscoveryModal = ({
  open,
  loading,
  results,
  onClose,
  onCommit,
}: DiscoveryModalProps) => {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<OnboardDeviceFormValues>({
    resolver: zodResolver(onboardDeviceSchema),
    defaultValues: { discoveryId: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: OnboardDeviceFormValues) =>
      apiRequest("/v1/retail/devices/onboard", "POST", session, data),
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["retail", "devices"]],
      onClose: () => {
        // Don't auto-close the modal — let user onboard multiple
      },
      form,
      successTitle: "Device Onboarded",
      successDescription: "The device has been registered successfully.",
    }),
  });

  const isPending = mutation.isPending;

  const handleOnboard = (discoveryId: string) => {
    form.setValue("discoveryId", discoveryId);
    mutation.mutate({ discoveryId });
    onCommit(discoveryId);
  };

  const handleClose = () => {
    if (isPending) return;
    form.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-xl rounded-3xl border-none shadow-2xl bg-card max-h-[80vh] overflow-hidden flex flex-col font-sans">
        <DialogHeader>
          <DialogTitle className="text-base font-black italic tracking-tighter flex items-center gap-2">
            <Wifi className={`w-4 h-4 ${loading ? "animate-pulse" : ""}`} />
            Network Discovery Results
          </DialogTitle>
          <p className="text-[11px] text-muted-foreground font-medium">
            Found hardware using mDNS, SNMP, and ONVIF on your local branch LAN.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <RefreshCw className="w-10 h-10 text-muted-foreground animate-spin" />
              <div className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground">
                Scanning Branch LAN…
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <div className="text-xs font-bold">No new hardware found.</div>
              <div className="text-[10px] mt-1">
                Ensure the Branch Agent is online and devices are discoverable.
              </div>
            </div>
          ) : (
            (Array.isArray(results) ? results : []).map((r, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-secondary/5 hover:bg-muted hover:shadow-md transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center shadow-sm">
                  <DeviceIcon type={r.type} cls="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-black text-foreground truncate">
                    {r.name}
                  </div>
                  <div className="text-[9px] text-muted-foreground font-mono mt-0.5 truncate uppercase">
                    {r.model} · {r.ipAddress}
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleOnboard(r.discoveryId)}
                  className="rounded-xl h-8 bg-secondary text-foreground font-black italic uppercase text-[9px] tracking-widest px-4 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Onboard"
                  )}
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="pt-2">
          <Button
            variant="outline"
            disabled={isPending}
            onClick={handleClose}
            className="w-full rounded-xl border-border text-muted-foreground font-black italic uppercase text-[10px] tracking-widest h-10"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DiscoveryModal;
