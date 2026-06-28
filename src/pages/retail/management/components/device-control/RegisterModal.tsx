/**
 * RegisterModal — Canonical reference implementation for the wiring pattern.
 *
 * This modal demonstrates the full pattern used across all 182 modals:
 * 1. Zod schema defining form shape (co-located)
 * 2. useForm with zodResolver
 * 3. useMutation with apiRequest
 * 4. getMutationToastHandlers for standardized success/error
 * 5. Form fields bound via register() or Controller
 * 6. Error display from formState.errors
 * 7. Loading/disabled states from mutation.isPending
 * 8. Submit button disabled during mutation
 * 9. Cancel/close button disabled during mutation
 * 10. Form reset on close
 *
 * Requirements: 1 (Form Fields), 2 (Validation), 3 (API Submission),
 *               4 (Loading State), 5 (Error Handling), 6 (Success Handling),
 *               7 (Cancel/Close), 8 (Accessibility), 10 (Consistent Pattern)
 */

import React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { RefreshCw, PlusCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/core/api/apiClient";
import { getMutationToastHandlers } from "@/lib/modal-helpers";
import {
  DEVICE_TYPES,
  CAM_PROVIDERS,
  SENSOR_TYPES,
  CONN_TYPES,
} from "./DeviceControlTypes";
import type { Tab, ConnType } from "./DeviceControlTypes";

// ─── Zod Schema (co-located) ───────────────────────────────────────────────────

const connTypeValues = ["tcp_ip", "usb", "bluetooth", "com_port", "wifi", "other", ""] as const;

const registerDeviceFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or fewer"),
  subType: z.string().min(1, "Type is required"),
  model: z.string().max(100).optional().default(""),
  serial: z.string().max(100).optional().default(""),
  ip: z.string().max(45).optional().default(""),
  mac: z.string().max(17).optional().default(""),
  connType: z.enum(connTypeValues).optional().default(""),
  comPort: z.string().max(20).optional().default(""),
  usbPort: z.string().max(50).optional().default(""),
  placement: z.string().max(200).optional().default(""),
  notes: z.string().max(500).optional().default(""),
});

export type RegisterDeviceFormValues = z.infer<typeof registerDeviceFormSchema>;

// ─── API Endpoints by Tab ───────────────────────────────────────────────────────

const API_ENDPOINTS: Record<Tab, string> = {
  devices: "/v1/retail/devices",
  cctv: "/v1/retail/cctvs",
  sensors: "/v1/retail/sensors",
};

const QUERY_KEYS: Record<Tab, readonly string[]> = {
  devices: ["retail", "devices"],
  cctv: ["retail", "cctvs"],
  sensors: ["retail", "sensors"],
};

// ─── Props ──────────────────────────────────────────────────────────────────────

interface RegisterModalProps {
  open: boolean;
  tab: Tab;
  onClose: () => void;
  onSave?: (f: RegisterDeviceFormValues | null) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────────

const RegisterModal = ({ open, tab, onClose, onSave }: RegisterModalProps) => {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ─── React Hook Form with Zod resolver ────────────────────────────────────────
  const form = useForm<RegisterDeviceFormValues>({
    resolver: zodResolver(registerDeviceFormSchema),
    defaultValues: {
      name: "",
      subType: "",
      model: "",
      serial: "",
      ip: "",
      mac: "",
      connType: "",
      comPort: "",
      usbPort: "",
      placement: "",
      notes: "",
    },
  });

  const { register, control, formState: { errors }, handleSubmit, reset } = form;

  // ─── Derived state (moved above mutation to avoid TDZ) ────────────────────────
  const label =
    tab === "devices" ? "Device" : tab === "cctv" ? "Camera" : "Sensor";

  // ─── useMutation with apiRequest ──────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: (data: RegisterDeviceFormValues) => {
      const endpoint = API_ENDPOINTS[tab];
      // Map form data to API payload shape
      const payload = {
        name: data.name,
        type: data.subType,
        model: data.model,
        serialNumber: data.serial,
        ipAddress: data.ip,
        macAddress: data.mac,
        connType: data.connType || undefined,
        comPort: data.comPort || undefined,
        usbPort: data.usbPort || undefined,
        placement: data.placement || undefined,
        notes: data.notes || undefined,
      };
      return apiRequest(endpoint, "POST", session, payload);
    },
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [QUERY_KEYS[tab]],
      onClose,
      form,
      successTitle: `${label} Registered`,
      successDescription: `The ${label.toLowerCase()} has been successfully added.`,
    }),
  });

  // ─── Derived state ────────────────────────────────────────────────────────────
  const opts =
    tab === "devices"
      ? DEVICE_TYPES
      : tab === "cctv"
        ? CAM_PROVIDERS
        : SENSOR_TYPES;

  const typeLabel = tab === "cctv" ? "Brand / Provider" : "Type";
  const showConn = tab === "devices";

  const watchConnType = form.watch("connType") as ConnType | "";
  const isPending = mutation.isPending;

  // ─── Handlers ─────────────────────────────────────────────────────────────────
  const onSubmit = handleSubmit((data) => mutation.mutate(data));

  const handleClose = () => {
    if (isPending) return; // Prevent close during mutation
    reset();
    onClose();
  };

  const handleAutoScan = () => {
    if (isPending) return;
    reset();
    onClose();
    onSave?.(null); // Trigger scan parent-side
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent
        className="max-w-lg rounded-3xl border-none shadow-2xl bg-white max-h-[90vh] overflow-y-auto"
        aria-describedby="register-modal-description"
      >
        <DialogHeader>
          <DialogTitle
            id="register-modal-title"
            className="text-base font-black italic tracking-tighter"
          >
            Register New {label}
          </DialogTitle>
          <DialogDescription id="register-modal-description" className="text-[11px] text-muted-foreground font-medium">
            This {label.toLowerCase()} will be scoped to the selected branch only.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate>
          <fieldset disabled={isPending} className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              {/* Name field */}
              <div className="col-span-2 space-y-1.5">
                <Label
                  htmlFor="register-name"
                  className="text-[10px] font-black uppercase text-muted-foreground tracking-widest"
                >
                  {label} Name *
                </Label>
                <Input
                  id="register-name"
                  placeholder={`e.g. "Cashier PC #1"`}
                  {...register("name")}
                  aria-describedby={errors.name ? "register-name-error" : undefined}
                  aria-invalid={!!errors.name}
                  className="rounded-xl border-border text-sm"
                  autoFocus
                />
                {errors.name && (
                  <p id="register-name-error" className="text-[10px] text-destructive font-medium" role="alert">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* Type / SubType field */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="register-subtype"
                  className="text-[10px] font-black uppercase text-muted-foreground tracking-widest"
                >
                  {typeLabel} *
                </Label>
                <Controller
                  control={control}
                  name="subType"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger
                        id="register-subtype"
                        className="rounded-xl border-border text-sm"
                        aria-describedby={errors.subType ? "register-subtype-error" : undefined}
                        aria-invalid={!!errors.subType}
                      >
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        {(Array.isArray(opts) ? opts : []).map((o) => (
                          <SelectItem key={o.v} value={o.v}>
                            {o.l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.subType && (
                  <p id="register-subtype-error" className="text-[10px] text-destructive font-medium" role="alert">
                    {errors.subType.message}
                  </p>
                )}
              </div>

              {/* Model field */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="register-model"
                  className="text-[10px] font-black uppercase text-muted-foreground tracking-widest"
                >
                  Model
                </Label>
                <Input
                  id="register-model"
                  placeholder="e.g. Postek C168"
                  {...register("model")}
                  className="rounded-xl border-border text-sm"
                />
              </div>

              {/* Serial field */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="register-serial"
                  className="text-[10px] font-black uppercase text-muted-foreground tracking-widest"
                >
                  Serial No.
                </Label>
                <Input
                  id="register-serial"
                  placeholder="SN-XXXX"
                  {...register("serial")}
                  className="rounded-xl border-border text-sm"
                />
              </div>

              {/* Connection fields (devices tab only) */}
              {showConn && (
                <>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="register-conntype"
                      className="text-[10px] font-black uppercase text-muted-foreground tracking-widest"
                    >
                      Connection Type
                    </Label>
                    <Controller
                      control={control}
                      name="connType"
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger
                            id="register-conntype"
                            className="rounded-xl border-border text-sm"
                          >
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            {(Array.isArray(CONN_TYPES) ? CONN_TYPES : []).map((o) => (
                              <SelectItem key={o.v} value={o.v}>
                                {o.l}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {(watchConnType === "tcp_ip" || watchConnType === "wifi") && (
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="register-ip"
                        className="text-[10px] font-black uppercase text-muted-foreground tracking-widest"
                      >
                        IP Address
                      </Label>
                      <Input
                        id="register-ip"
                        placeholder="192.168.1.x"
                        {...register("ip")}
                        className="rounded-xl border-border text-sm font-mono"
                      />
                    </div>
                  )}

                  {watchConnType === "com_port" && (
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="register-comport"
                        className="text-[10px] font-black uppercase text-muted-foreground tracking-widest"
                      >
                        COM Port
                      </Label>
                      <Input
                        id="register-comport"
                        placeholder="e.g. COM3"
                        {...register("comPort")}
                        className="rounded-xl border-border text-sm font-mono"
                      />
                    </div>
                  )}

                  {watchConnType === "usb" && (
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="register-usbport"
                        className="text-[10px] font-black uppercase text-muted-foreground tracking-widest"
                      >
                        USB Port Label
                      </Label>
                      <Input
                        id="register-usbport"
                        placeholder="e.g. USB-A Port 3"
                        {...register("usbPort")}
                        className="rounded-xl border-border text-sm font-mono"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="register-mac"
                      className="text-[10px] font-black uppercase text-muted-foreground tracking-widest"
                    >
                      MAC Address
                    </Label>
                    <Input
                      id="register-mac"
                      placeholder="AA:BB:CC:DD:EE:FF"
                      {...register("mac")}
                      className="rounded-xl border-border text-sm font-mono"
                    />
                  </div>
                </>
              )}

              {/* Placement field */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="register-placement"
                  className="text-[10px] font-black uppercase text-muted-foreground tracking-widest"
                >
                  Placement / Location
                </Label>
                <Input
                  id="register-placement"
                  placeholder="e.g. Cashier Counter"
                  {...register("placement")}
                  className="rounded-xl border-border text-sm"
                />
              </div>

              {/* Notes field */}
              <div className="col-span-2 space-y-1.5">
                <Label
                  htmlFor="register-notes"
                  className="text-[10px] font-black uppercase text-muted-foreground tracking-widest"
                >
                  Notes
                </Label>
                <Textarea
                  id="register-notes"
                  placeholder="Usage context, setup notes…"
                  {...register("notes")}
                  className="rounded-xl border-border text-sm resize-none h-16"
                />
              </div>
            </div>
          </fieldset>

          {/* Action buttons */}
          <div className="flex gap-2 pt-3">
            {tab === "devices" && (
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={handleAutoScan}
                className="rounded-xl border-border text-muted-foreground font-bold text-xs gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Auto-Scan LAN
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={handleClose}
              className="rounded-xl text-muted-foreground font-bold text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-xl bg-secondary text-foreground font-black italic uppercase text-[10px] tracking-widest"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <PlusCircle className="w-3.5 h-3.5 mr-1" />
                  Register {label}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RegisterModal;
