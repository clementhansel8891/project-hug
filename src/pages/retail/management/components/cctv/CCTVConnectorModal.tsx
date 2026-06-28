/**
 * CCTVConnectorModal — CCTV camera registration & connection testing.
 *
 * Wired with React Hook Form + Zod + useMutation + getMutationToastHandlers.
 *
 * Requirements: 1 (Form Fields), 2 (Validation), 3 (API Submission),
 *               4 (Loading State), 5 (Error Handling), 6 (Success Handling),
 *               10 (Consistent Pattern)
 */

import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { retailService } from "@/core/services/retail/retailService";
import { CCTVCamera, CCTVProvider } from "@/core/types/retail/retail";
import { useSession } from "@/core/security/session";
import { apiRequest } from "@/core/api/apiClient";
import { getMutationToastHandlers } from "@/lib/modal-helpers";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, CheckCircle2, ChevronRight, Server, Wifi, Loader2 } from "lucide-react";

// ─── Zod Schema ─────────────────────────────────────────────────────────────────

const cctvConnectorSchema = z.object({
  name: z.string().min(1, "Camera name is required").max(100),
  provider: z.string().min(1, "Provider is required"),
  ipAddress: z.string().max(45).optional(),
  username: z.string().max(100).optional(),
  password: z.string().max(200).optional(),
  verificationCode: z.string().max(50).optional(),
  cloudAccountId: z.string().max(200).optional(),
  rtspUrl: z.string().max(500).optional(),
  hlsUrl: z.string().max(500).optional(),
  location: z.string().max(200).optional().default("Main Area"),
});

type CCTVConnectorFormValues = z.infer<typeof cctvConnectorSchema>;

interface CCTVConnectorModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (cam: CCTVCamera) => void;
}

const PROVIDERS = [
  {
    id: "ezviz",
    name: "EZVIZ Cloud",
    req: ["name", "cloudAccountId", "verificationCode"],
  },
  {
    id: "hikvision",
    name: "Hikvision NVR/IPC",
    req: ["name", "ipAddress", "username", "password"],
  },
  {
    id: "dahua",
    name: "Dahua NVR/IPC",
    req: ["name", "ipAddress", "username", "password"],
  },
  {
    id: "reolink",
    name: "Reolink",
    req: ["name", "ipAddress", "username", "password"],
  },
  {
    id: "axis",
    name: "AXIS Camera",
    req: ["name", "ipAddress", "username", "password"],
  },
  { id: "custom", name: "Custom RTSP/HLS", req: ["name", "rtspUrl", "hlsUrl"] },
];

export default function CCTVConnectorModal({
  open,
  onClose,
  onSuccess,
}: CCTVConnectorModalProps) {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [validated, setValidated] = useState(false);

  // ─── React Hook Form + Zod ────────────────────────────────────────────────────
  const form = useForm<CCTVConnectorFormValues>({
    resolver: zodResolver(cctvConnectorSchema),
    defaultValues: {
      name: "",
      provider: "ezviz",
      ipAddress: "",
      username: "",
      password: "",
      verificationCode: "",
      cloudAccountId: "",
      rtspUrl: "",
      hlsUrl: "",
      location: "Main Area",
    },
  });

  const { register, control, formState: { errors }, handleSubmit, watch, setValue } = form;
  const provider = watch("provider") as CCTVProvider;

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: async (data: CCTVConnectorFormValues) => {
      if (!session.tenant_id) throw new Error("No tenant");
      return retailService.validateCCTVConnection(
        session.tenant_id,
        session,
        { provider: data.provider, ...data },
      );
    },
    onSuccess: (res) => {
      if (res.success) {
        setValidated(true);
        toast({
          title: "Connection Successful",
          description: "Credentials are valid.",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: res.message,
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Test Failed",
        description: "Network error or invalid settings.",
        variant: "destructive",
      });
    },
  });

  // Register camera mutation
  const registerMutation = useMutation({
    mutationFn: async (data: CCTVConnectorFormValues) => {
      if (!session.tenant_id) throw new Error("No tenant");
      return retailService.registerCCTV(
        session.tenant_id,
        session,
        { provider: data.provider as CCTVProvider, ...data, status: "live" },
      );
    },
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["retail", "cctvs"]],
      onClose: () => {
        // handled below
      },
      form,
      successTitle: "Camera Registered",
      successDescription: "CCTV has been added and connected.",
    }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["retail", "cctvs"] });
      toast({ title: "Camera Registered", description: "CCTV has been added and connected." });
      form.reset();
      onSuccess(saved);
      onClose();
    },
  });

  const loading = testMutation.isPending || registerMutation.isPending;

  const handleTest = handleSubmit((data) => {
    testMutation.mutate(data);
  });

  const handleRegister = handleSubmit((data) => {
    registerMutation.mutate(data);
  });

  const handleClose = () => {
    if (loading) return;
    form.reset();
    setValidated(false);
    onClose();
  };

  // Reset validation on field changes
  const watchAll = watch();
  React.useEffect(() => {
    setValidated(false);
  }, [watchAll.name, watchAll.ipAddress, watchAll.username, watchAll.password, watchAll.cloudAccountId, watchAll.verificationCode, watchAll.rtspUrl]);

  const pConfig = PROVIDERS.find((p) => p.id === provider);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-border rounded-[28px]">
        <DialogHeader className="p-6 bg-secondary/5 border-b border-border">
          <DialogTitle className="text-xl font-black italic tracking-tighter text-muted-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-card shadow-sm border border-border flex items-center justify-center">
              <Camera className="w-5 h-5 text-primary" />
            </div>
            Connect CCTV
          </DialogTitle>
        </DialogHeader>

        <form>
          <fieldset disabled={loading} className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                  Protocol & Provider
                </Label>
                <Controller
                  control={control}
                  name="provider"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        setValidated(false);
                      }}
                    >
                      <SelectTrigger className="rounded-xl border-border text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Array.isArray(PROVIDERS) ? PROVIDERS : []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                  Camera Name
                </Label>
                <Input
                  placeholder="e.g. Front Door Feed"
                  {...register("name")}
                  aria-describedby={errors.name ? "cctv-name-error" : undefined}
                  aria-invalid={!!errors.name}
                  className="rounded-xl border-border text-sm"
                />
                {errors.name && (
                  <p id="cctv-name-error" className="text-[10px] text-destructive font-medium" role="alert">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {pConfig?.req.includes("ipAddress") && (
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    IP Address
                  </Label>
                  <Input
                    placeholder="192.168.1.100"
                    {...register("ipAddress")}
                    className="rounded-xl border-border font-mono text-sm"
                  />
                </div>
              )}

              {pConfig?.req.includes("username") && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                      Username
                    </Label>
                    <Input
                      placeholder="admin"
                      {...register("username")}
                      className="rounded-xl border-border text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                      Password
                    </Label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      {...register("password")}
                      className="rounded-xl border-border text-sm"
                    />
                  </div>
                </div>
              )}

              {pConfig?.req.includes("cloudAccountId") && (
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    Cloud Account ID
                  </Label>
                  <Input
                    placeholder="e.g. ezviz_user_123"
                    {...register("cloudAccountId")}
                    className="rounded-xl border-border font-mono text-sm"
                  />
                </div>
              )}

              {pConfig?.req.includes("verificationCode") && (
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    Verification Code
                  </Label>
                  <Input
                    type="password"
                    placeholder="6-letter code"
                    {...register("verificationCode")}
                    className="rounded-xl border-border font-mono text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground font-medium">
                    Found on the camera sticker
                  </p>
                </div>
              )}

              {pConfig?.req.includes("rtspUrl") && (
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    RTSP URL
                  </Label>
                  <Input
                    placeholder="rtsp://admin:pass@ip:554/stream1"
                    {...register("rtspUrl")}
                    className="rounded-xl border-border font-mono text-sm"
                  />
                </div>
              )}
            </div>
          </fieldset>
        </form>

        <div className="p-6 bg-secondary/5 border-t border-border flex items-center justify-between">
          <Button
            variant="outline"
            type="button"
            onClick={handleTest}
            disabled={!watch("name") || loading}
            className={`rounded-xl h-10 px-5 text-xs font-bold transition-all ${validated ? "border-success bg-success text-success hover:bg-success/10 hover:text-success" : "border-border text-muted-foreground"} gap-2`}
          >
            {testMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : validated ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Wifi className="w-4 h-4" />
            )}
            {validated ? "Verified" : "Test Connection"}
          </Button>

          <Button
            type="button"
            onClick={handleRegister}
            disabled={!validated || loading}
            className="rounded-xl bg-primary hover:bg-primary text-foreground font-black italic uppercase text-[10px] tracking-widest h-10 px-6 gap-2"
          >
            {registerMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>Connect <Server className="w-3.5 h-3.5" /></>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
