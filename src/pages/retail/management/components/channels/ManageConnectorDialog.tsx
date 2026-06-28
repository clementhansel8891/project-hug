/**
 * ManageConnectorDialog — Channel provisioning with connector creation.
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
  Globe,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Key,
  ShieldCheck,
  Zap,
  ArrowRight,
  Server,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CredentialField } from "../shared/SharedUI";
import { ecommerceHubService } from "@/core/services/retail/ecommerceHubService";
import { apiRequest } from "@/core/api/apiClient";
import { getMutationToastHandlers } from "@/lib/modal-helpers";
import type { RetailChannel } from "@/core/types/retail/retail";
import { useSession } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";

// ─── Zod Schema ─────────────────────────────────────────────────────────────────

const connectorSchema = z.object({
  channelName: z.string().min(1, "Deployment name is required").max(100),
  channelType: z.enum(["OWNED", "MARKETPLACE"]),
  syncFreq: z.enum(["5min", "15min", "1h"]).default("15min"),
  platform: z.string().default("custom"),
  marketplaceApiKey: z.string().optional(),
  marketplaceApiSecret: z.string().optional(),
});

type ConnectorFormValues = z.infer<typeof connectorSchema>;

interface ManageConnectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  branchIds: string[];
  gatewayUrl: string;
  copyCredential: (value: string, label: string) => void;
}

export const ManageConnectorDialog = ({
  isOpen,
  onClose,
  onSuccess,
  branchIds,
  gatewayUrl,
  copyCredential,
}: ManageConnectorDialogProps) => {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [step, setStep] = useState<"CONFIG" | "SUCCESS">("CONFIG");
  const [generatedCreds, setGeneratedCreds] = useState<{
    connectorId: string;
    apiKey: string;
    channelId: string;
    clientId: string;
    clientSecret: string;
  } | null>(null);

  // ─── React Hook Form + Zod ────────────────────────────────────────────────────
  const form = useForm<ConnectorFormValues>({
    resolver: zodResolver(connectorSchema),
    defaultValues: {
      channelName: "",
      channelType: "OWNED",
      syncFreq: "15min",
      platform: "custom",
      marketplaceApiKey: "",
      marketplaceApiSecret: "",
    },
  });

  const { register, control, formState: { errors }, handleSubmit, watch } = form;
  const channelType = watch("channelType");

  const mutation = useMutation({
    mutationFn: async (data: ConnectorFormValues) => {
      if (data.channelType === "OWNED") {
        const conn = await ecommerceHubService.createConnector(session, {
          name: data.channelName,
          platform: data.platform,
          domain: `${data.channelName.toLowerCase().replace(/\s+/g, "-")}.zenvix.io`,
          branchIds,
        });

        const ch = await ecommerceHubService.createChannel(session, {
          name: data.channelName,
          type: "OWNED",
          adapterType: data.platform.toUpperCase() as any,
          integrationCategory: "HEADLESS",
          syncFrequency: data.syncFreq,
          settings: { connectorId: conn.connector.id },
        });

        return {
          connectorId: conn.connector.id,
          apiKey: conn.plainApiKey,
          channelId: ch.channel.id,
          clientId: ch.plainClientId,
          clientSecret: ch.plainClientSecret,
        };
      } else {
        await ecommerceHubService.createChannel(session, {
          name: data.channelName,
          type: "MARKETPLACE",
          adapterType: data.platform.toUpperCase() as any,
          integrationCategory: "PRESET",
          syncFrequency: data.syncFreq,
          settings: {
            apiKey: data.marketplaceApiKey,
            apiSecret: data.marketplaceApiSecret,
          },
        });
        return null;
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["retail", "channels"] });
      if (result) {
        setGeneratedCreds(result);
        setStep("SUCCESS");
      } else {
        toast({
          title: "Marketplace Linked",
          description: "Connection established successfully.",
        });
        onSuccess?.();
        onClose();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Provisioning Failed",
        description: error?.message || "Could not establish secure handshake.",
        variant: "destructive",
      });
    },
  });

  const isProcessing = mutation.isPending;

  const handleCreate = handleSubmit((data) => {
    mutation.mutate(data);
  });

  const handleClose = () => {
    if (isProcessing) return;
    setStep("CONFIG");
    setGeneratedCreds(null);
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-3xl rounded-[2rem] p-0 overflow-hidden border-none shadow-[0_40px_100px_rgba(0,0,0,0.25)] flex flex-col max-h-[90vh]">
        <div className="bg-secondary p-6 text-foreground relative overflow-hidden shrink-0">
          <Zap className="absolute -right-12 -top-6 w-64 h-64 opacity-10 text-primary" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="space-y-2">
              <Badge className="bg-primary/20 text-primary border-none font-black italic text-[9px] uppercase tracking-[0.2em] px-4 py-1 mb-4">
                Secure Channel Provisioning
              </Badge>
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter leading-none">
                {step === "CONFIG" ? "New Digital Node" : "Deployment Status"}
              </DialogTitle>
              <DialogDescription className="text-sm font-bold text-muted-foreground italic">
                {step === "CONFIG"
                  ? "Initialize a secure handshake between Zenvix and your external commerce storefront."
                  : "All secure keys have been issued. Critical data is now active in your vault."}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-12 flex-1 overflow-y-auto bg-card">
          {step === "SUCCESS" && generatedCreds ? (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="bg-success border-2 border-success rounded-[2rem] p-8 flex items-center gap-6">
                <div className="w-16 h-16 bg-success rounded-3xl flex items-center justify-center shadow-lg shadow-emerald-900/10">
                  <CheckCircle2 className="w-8 h-8 text-foreground" />
                </div>
                <div>
                  <div className="text-xl font-black italic text-success uppercase italic">
                    Handshake Successful
                  </div>
                  <div className="text-[11px] font-bold text-success uppercase tracking-widest mt-1">
                    Credentials Issued • Vault Update Complete
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-8">
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground italic flex items-center gap-3">
                    <Globe className="w-3 h-3" /> Gateway Identity
                  </div>
                  <div className="space-y-4">
                    <CredentialField
                      label="Tenant ID"
                      value={session.tenant_id}
                      copyable
                    />
                    <CredentialField
                      label="Branch Scope"
                      value={branchIds.join(", ")}
                      copyable
                    />
                    <CredentialField
                      label="API Endpoint"
                      value={gatewayUrl}
                      copyable
                    />
                    <CredentialField
                      label="Gateway API Key"
                      value={generatedCreds.apiKey}
                      copyable
                      isMasked
                    />
                  </div>
                </div>
                <div className="space-y-8">
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-primary italic flex items-center gap-3">
                    <Key className="w-3 h-3" /> Storefront Secrets
                  </div>
                  <div className="space-y-4">
                    <CredentialField
                      label="Client ID"
                      value={generatedCreds.clientId}
                      copyable
                    />
                    <CredentialField
                      label="Client Secret"
                      value={generatedCreds.clientSecret}
                      copyable
                      isMasked
                    />
                    <Separator className="my-4" />
                    <div className="p-6 rounded-[2rem] bg-primary/5 border border-primary space-y-3">
                      <div className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest">
                        <AlertCircle className="w-4 h-4 text-primary" />{" "}
                        Security Notice
                      </div>
                      <p className="text-[10px] font-bold text-primary leading-relaxed italic uppercase italic tracking-tighter">
                        Client secrets are only visible once. Ensure they are
                        safely stored in your application vault.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleClose}
                className="w-full h-20 rounded-[2rem] bg-secondary text-foreground font-black italic uppercase tracking-[0.3em] text-xs shadow-2xl hover:scale-[0.98] transition-transform"
              >
                CLOSE SESSION & HANDOVER
              </Button>
            </div>
          ) : (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-2 gap-8">
                <div
                  onClick={() => form.setValue("channelType", "OWNED")}
                  className={`p-8 rounded-2xl border-2 transition-all cursor-pointer group ${channelType === "OWNED" ? "border-primary bg-primary/5" : "border-border hover:border-border"}`}
                >
                  <Globe
                    className={`w-10 h-10 mb-6 transition-transform ${channelType === "OWNED" ? "text-primary scale-110" : "text-muted-foreground/60"}`}
                  />
                  <div
                    className={`text-lg font-black italic uppercase italic tracking-tighter ${channelType === "OWNED" ? "text-primary" : "text-muted-foreground"}`}
                  >
                    Headless API
                  </div>
                  <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-2">
                    Next.js / Custom App
                  </div>
                </div>
                <div
                  onClick={() => form.setValue("channelType", "MARKETPLACE")}
                  className={`p-8 rounded-2xl border-2 transition-all cursor-pointer group ${channelType === "MARKETPLACE" ? "border-success bg-success" : "border-border hover:border-border"}`}
                >
                  <ShoppingBag
                    className={`w-10 h-10 mb-6 transition-transform ${channelType === "MARKETPLACE" ? "text-success scale-110" : "text-muted-foreground/60"}`}
                  />
                  <div
                    className={`text-lg font-black italic uppercase italic tracking-tighter ${channelType === "MARKETPLACE" ? "text-success" : "text-muted-foreground"}`}
                  >
                    Marketplace Hub
                  </div>
                  <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-2">
                    Shopee / Tokopedia
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground italic">
                    Core Specifications
                  </Label>
                  <div className="grid grid-cols-3 gap-6">
                    <div className="col-span-2 space-y-2">
                      <Input
                        placeholder="Deployment Name (e.g. Flagship Store)"
                        {...register("channelName")}
                        aria-describedby={errors.channelName ? "connector-name-error" : undefined}
                        aria-invalid={!!errors.channelName}
                        className="h-16 px-6 rounded-2xl bg-secondary/5 border-none font-black italic text-lg text-foreground placeholder:text-muted-foreground/60 shadow-inner"
                      />
                      {errors.channelName && (
                        <p id="connector-name-error" className="text-[10px] text-destructive font-medium" role="alert">
                          {errors.channelName.message}
                        </p>
                      )}
                    </div>
                    <Controller
                      control={control}
                      name="syncFreq"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="h-16 rounded-2xl bg-secondary/5 border-none font-black italic uppercase text-[10px] tracking-widest text-foreground shadow-inner">
                            <SelectValue placeholder="Sync Pulse" />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-none shadow-2xl p-2 bg-card">
                            <SelectItem
                              value="5min"
                              className="rounded-xl font-black italic uppercase text-[10px] py-4"
                            >
                              5m Pulse
                            </SelectItem>
                            <SelectItem
                              value="15min"
                              className="rounded-xl font-black italic uppercase text-[10px] py-4"
                            >
                              15m Pulse
                            </SelectItem>
                            <SelectItem
                              value="1h"
                              className="rounded-xl font-black italic uppercase text-[10px] py-4"
                            >
                              60m Pulse
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>

                {channelType === "MARKETPLACE" && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-4 p-6 bg-warning rounded-2xl border border-warning">
                      <ShieldCheck className="w-6 h-6 text-warning" />
                      <p className="text-[10px] font-bold text-warning uppercase italic tracking-tighter">
                        External authorization required. Provide your platform
                        API secrets.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <Input
                        type="password"
                        placeholder="Marketplace API Key"
                        {...register("marketplaceApiKey")}
                        className="h-16 px-6 rounded-2xl bg-secondary/5 border-none font-mono text-sm text-muted-foreground shadow-inner"
                      />
                      <Input
                        type="password"
                        placeholder="Marketplace Secret"
                        {...register("marketplaceApiSecret")}
                        className="h-16 px-6 rounded-2xl bg-secondary/5 border-none font-mono text-sm text-muted-foreground shadow-inner"
                      />
                    </div>
                  </div>
                )}
              </div>

              <Button
                onClick={handleCreate}
                disabled={isProcessing}
                className="w-full h-20 rounded-[2rem] bg-primary text-foreground font-black italic uppercase tracking-[0.3em] text-xs shadow-2xl hover:bg-primary hover:scale-[0.98] transition-all"
              >
                {isProcessing ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <div className="flex items-center gap-3">
                    EXECUTE HANDSHAKE <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
