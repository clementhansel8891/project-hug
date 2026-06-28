/**
 * ChannelDetailDialog — Channel detail & configuration dialog.
 *
 * Wired with React Hook Form + Zod + useMutation + getMutationToastHandlers.
 * Manages channel metadata, sync settings, and security actions.
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
  Globe,
  ShoppingBag,
  AlertCircle,
  RefreshCw,
  ShieldOff,
  Zap,
  Activity,
  Server,
  Key,
  Database,
  ShieldCheck,
  ArrowRight,
  Trash2,
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { CredentialField } from "../shared/SharedUI";
import { Roles } from "@/core/security/roles";
import { type SessionContext } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/core/api/apiClient";
import { getMutationToastHandlers } from "@/lib/modal-helpers";
import type { ChannelRecord } from "@/core/services/retail/ecommerceHubService";
import type { RetailChannel, ChannelStatus } from "@/core/types/retail/retail";

// ─── Zod Schema ─────────────────────────────────────────────────────────────────

const channelDetailSchema = z.object({
  name: z.string().min(1, "Channel name is required").max(100, "Name must be 100 characters or fewer"),
  syncFrequency: z.enum(["5min", "15min", "1h"], { required_error: "Sync frequency is required" }),
  settings: z.object({
    autoSyncStock: z.boolean().optional(),
    overwritePrices: z.boolean().optional(),
    syncOrders: z.boolean().optional(),
    notifyStatus: z.boolean().optional(),
  }).optional(),
});

type ChannelDetailFormValues = z.infer<typeof channelDetailSchema>;

// ─── Props ───────────────────────────────────────────────────────────────────────

interface ChannelDetailDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedChannel: ChannelRecord | null;
  detailName: string;
  setDetailName: (val: string) => void;
  detailSyncFreq: string;
  setDetailSyncFreq: (val: string) => void;
  detailSettings: Partial<RetailChannel["settings"]>;
  setDetailSettings: (val: Partial<RetailChannel["settings"]>) => void;
  detailClientId: string;
  detailClientSecret: string;
  approvalStatus: string;
  approvalRequestId: string | null;
  canEdit: boolean;
  isSaving: boolean;
  rotationLoading: string | null;
  revocationLoading: string | null;
  session: SessionContext;
  branchIds: string[];
  gatewayUrl: string;
  handleRotateChannel: (id: string, options: { showDialog?: boolean }) => void;
  handleRevokeChannel: (id: string) => void;
  handleDelete: (id: string) => void;
  handleSaveChannel: () => void;
  handleRequestApproval: () => void;
  copyCredential: (value: string, label: string) => void;
}

export const ChannelDetailDialog = ({
  isOpen,
  onOpenChange,
  selectedChannel,
  detailName,
  setDetailName,
  detailSyncFreq,
  setDetailSyncFreq,
  detailSettings,
  setDetailSettings,
  detailClientId,
  detailClientSecret,
  approvalStatus,
  approvalRequestId,
  canEdit,
  isSaving,
  rotationLoading,
  revocationLoading,
  session,
  branchIds,
  gatewayUrl,
  handleRotateChannel,
  handleRevokeChannel,
  handleDelete,
  handleSaveChannel,
  handleRequestApproval,
  copyCredential,
}: ChannelDetailDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ChannelDetailFormValues>({
    resolver: zodResolver(channelDetailSchema),
    defaultValues: {
      name: detailName || "",
      syncFrequency: (detailSyncFreq as "5min" | "15min" | "1h") || "15min",
      settings: {
        autoSyncStock: !!detailSettings?.autoSyncStock,
        overwritePrices: !!detailSettings?.overwritePrices,
        syncOrders: !!detailSettings?.syncOrders,
        notifyStatus: !!detailSettings?.notifyStatus,
      },
    },
  });

  // Sync form with parent state when channel changes
  useEffect(() => {
    if (selectedChannel) {
      form.reset({
        name: detailName || selectedChannel.name || "",
        syncFrequency: (detailSyncFreq as "5min" | "15min" | "1h") || "15min",
        settings: {
          autoSyncStock: !!detailSettings?.autoSyncStock,
          overwritePrices: !!detailSettings?.overwritePrices,
          syncOrders: !!detailSettings?.syncOrders,
          notifyStatus: !!detailSettings?.notifyStatus,
        },
      });
    }
  }, [selectedChannel?.id]);

  // Keep parent state in sync with form
  const watchName = form.watch("name");
  const watchSyncFreq = form.watch("syncFrequency");

  useEffect(() => {
    if (watchName !== detailName) setDetailName(watchName);
  }, [watchName]);

  useEffect(() => {
    if (watchSyncFreq !== detailSyncFreq) setDetailSyncFreq(watchSyncFreq);
  }, [watchSyncFreq]);

  const mutation = useMutation({
    mutationFn: (data: ChannelDetailFormValues) =>
      apiRequest(`/v1/retail/channels/${selectedChannel?.id}`, "PATCH", session, data),
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["retail", "channels"]],
      onClose: () => onOpenChange(false),
      form,
      successTitle: "Channel Updated",
      successDescription: "Channel configuration saved successfully.",
    }),
  });

  const isPending = mutation.isPending || isSaving;

  const onSubmit = form.handleSubmit((data) => {
    mutation.mutate(data);
    handleSaveChannel();
  });

  if (!selectedChannel) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl rounded-[2rem] p-0 overflow-hidden border-none shadow-[0_40px_100px_rgba(0,0,0,0.25)] flex flex-col max-h-[90vh]">
        <div className="bg-secondary p-6 text-foreground relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            {selectedChannel.type === "OWNED" ? (
              <Globe className="w-32 h-32 text-primary" />
            ) : (
              <ShoppingBag className="w-32 h-32 text-success" />
            )}
          </div>

          <div className="relative z-10 flex items-start justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge className="bg-primary/20 text-primary border-none font-black italic text-[9px] uppercase tracking-[0.2em] px-4 py-1">
                  Channel Configuration
                </Badge>
                <Badge
                  className={
                    selectedChannel.status === "active"
                      ? "bg-success/20 text-success border-none font-black italic text-[9px] uppercase tracking-[0.2em] px-4 py-1"
                      : "bg-secondary text-muted-foreground border-none font-black italic text-[9px] uppercase tracking-[0.2em] px-4 py-1"
                  }
                >
                  {selectedChannel.status}
                </Badge>
              </div>
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter leading-none">
                {selectedChannel.name || "UNNAMED_NODE"}
              </DialogTitle>
              <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest italic">
                Node {selectedChannel.id} • {selectedChannel.type}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar controls */}
          <div className="w-72 border-r border-border bg-secondary/5 p-8 space-y-8 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground italic">
                Security Actions
              </div>
              <div className="space-y-3">
                <Button
                  variant="ghost"
                  onClick={() =>
                    handleRotateChannel(selectedChannel.id, {
                      showDialog: false,
                    })
                  }
                  disabled={!canEdit || !!rotationLoading}
                  className="w-full h-12 justify-start rounded-xl px-4 gap-3 font-black italic uppercase text-[9px] tracking-widest text-muted-foreground hover:bg-white hover:text-primary transition-all border border-transparent hover:border-border"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${rotationLoading === selectedChannel.id ? "animate-spin" : ""}`}
                  />
                  Rotate Secret
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleRevokeChannel(selectedChannel.id)}
                  disabled={!canEdit || !!revocationLoading}
                  className="w-full h-12 justify-start rounded-xl px-4 gap-3 font-black italic uppercase text-[9px] tracking-widest text-muted-foreground hover:bg-white hover:text-destructive transition-all border border-transparent hover:border-border"
                >
                  <ShieldOff className="w-3.5 h-3.5" />
                  Revoke Access
                </Button>
                <Separator className="bg-muted/20" />
                <Button
                  variant="ghost"
                  onClick={() => handleDelete(selectedChannel.id)}
                  disabled={!canEdit}
                  className="w-full h-12 justify-start rounded-xl px-4 gap-3 font-black italic uppercase text-[9px] tracking-widest text-destructive hover:bg-destructive transition-all border border-transparent"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Destroy Node
                </Button>
              </div>
            </div>

            {!canEdit && (
              <div className="p-6 rounded-2xl bg-warning border border-warning space-y-4">
                <div className="flex items-center gap-2 text-warning">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-[9px] font-black uppercase tracking-widest italic">
                    LOCKED
                  </span>
                </div>
                <p className="text-[10px] font-bold text-warning leading-relaxed italic uppercase italic tracking-tighter">
                  Approval required to modify vault configurations.
                </p>
                <Button
                  size="sm"
                  onClick={handleRequestApproval}
                  className="w-full bg-warning text-foreground font-black italic uppercase text-[8px] h-8 rounded-lg"
                >
                  Request Unlock
                </Button>
              </div>
            )}
          </div>

          {/* Main Content Areas */}
          <div className="flex-1 overflow-y-auto p-6 pb-24 relative bg-white">
            <Tabs defaultValue="vault" className="space-y-12">
              <div className="px-1">
                <TabsList className="bg-secondary/10 rounded-2xl p-1 h-14 w-full">
                  <TabsTrigger
                    value="vault"
                    className="flex-1 rounded-xl font-black italic uppercase text-[10px] tracking-widest"
                  >
                    Secret Vault
                  </TabsTrigger>
                  <TabsTrigger
                    value="sync"
                    className="flex-1 rounded-xl font-black italic uppercase text-[10px] tracking-widest"
                  >
                    Sync Pulse
                  </TabsTrigger>
                  <TabsTrigger
                    value="metadata"
                    className="flex-1 rounded-xl font-black italic uppercase text-[10px] tracking-widest"
                  >
                    Metadata
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent
                value="vault"
                className="space-y-12 m-0 border-none outline-none"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-8">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground italic flex items-center gap-3">
                      <Database className="w-3 h-3" /> Core Identity
                    </div>
                    <div className="space-y-4">
                      <CredentialField
                        label="Tenant Scope"
                        value={selectedChannel.tenantId ?? session.tenant_id}
                        copyable
                      />
                      <CredentialField
                        label="Fulfillment Scope"
                        value={branchIds.join(", ")}
                        copyable
                      />
                      <CredentialField
                        label="API Endpoint"
                        value={selectedChannel.gatewayUrl ?? gatewayUrl}
                        copyable
                      />
                    </div>
                  </div>
                  <div className="space-y-8">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-primary italic flex items-center gap-3">
                      <Key className="w-3 h-3" /> Handshake Keys
                    </div>
                    <div className="space-y-4">
                      <CredentialField
                        label="Client ID"
                        value={detailClientId}
                        placeholder="PENDING_ROTATION"
                        copyable={!!detailClientId}
                      />
                      <CredentialField
                        label="Client Secret"
                        value={detailClientSecret}
                        placeholder="PENDING_ROTATION"
                        copyable={!!detailClientSecret}
                        isMasked
                      />
                      <div className="p-6 rounded-[2rem] bg-secondary/5 border border-border mt-6">
                        <p className="text-[9px] font-black text-muted-foreground uppercase leading-relaxed italic uppercase italic tracking-widest">
                          Keys are rotate-only. Previous secrets are immediately
                          invalidated upon rotation.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent
                value="sync"
                className="space-y-12 m-0 border-none outline-none"
              >
                <div className="space-y-8">
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground italic flex items-center gap-3">
                    <Activity className="w-3 h-3" /> Propagation Rules
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      {
                        id: "autoSyncStock",
                        label: "Inventory Mirroring",
                        desc: "Push stock levels in real-time",
                      },
                      {
                        id: "overwritePrices",
                        label: "Price Overlays",
                        desc: "Allow channel-specific pricing",
                      },
                      {
                        id: "syncOrders",
                        label: "Order Polling",
                        desc: "Fetch orders automatically",
                      },
                      {
                        id: "notifyStatus",
                        label: "Webhooks",
                        desc: "Send status updates to node",
                      },
                    ].map((rule) => (
                      <div
                        key={rule.id}
                        className="p-8 rounded-[2rem] bg-secondary/5 border border-border flex items-center justify-between group hover:bg-white transition-all"
                      >
                        <div>
                          <div className="text-sm font-black italic text-foreground uppercase italic tracking-tighter">
                            {rule.label}
                          </div>
                          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                            {rule.desc}
                          </div>
                        </div>
                        <Switch
                          checked={!!(detailSettings?.[rule.id] as boolean)}
                          onCheckedChange={(val) =>
                            setDetailSettings({
                              ...detailSettings,
                              [rule.id]: val,
                            })
                          }
                          disabled={!canEdit}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent
                value="metadata"
                className="space-y-8 m-0 border-none outline-none"
              >
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground italic">
                    Identity Mapping
                  </Label>
                  <div className="grid grid-cols-3 gap-6">
                    <div className="col-span-2 space-y-2">
                      <Input
                        placeholder="Channel Display Name"
                        {...form.register("name")}
                        disabled={!canEdit || isPending}
                        aria-describedby={form.formState.errors.name ? "channel-name-error" : undefined}
                        aria-invalid={!!form.formState.errors.name}
                        className="h-16 px-6 rounded-2xl bg-secondary/5 border-none font-black italic text-lg text-foreground shadow-inner"
                      />
                      {form.formState.errors.name && (
                        <p id="channel-name-error" className="text-[10px] text-destructive font-medium" role="alert">
                          {form.formState.errors.name.message}
                        </p>
                      )}
                    </div>
                    <Controller
                      control={form.control}
                      name="syncFrequency"
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={!canEdit || isPending}
                        >
                          <SelectTrigger className="h-16 rounded-2xl bg-secondary/5 border-none font-black italic uppercase text-[10px] tracking-widest text-foreground shadow-inner">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-none shadow-2xl p-2 bg-white">
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
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <DialogFooter className="p-8 bg-secondary/5 border-t border-border flex flex-row items-center justify-end gap-6 shrink-0">
          <Button
            variant="ghost"
            disabled={isPending}
            onClick={() => { form.reset(); onOpenChange(false); }}
            className="font-black italic uppercase text-[10px] tracking-[0.2em] text-muted-foreground"
          >
            CANCEL SESSION
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!canEdit || isPending}
            className="h-16 px-12 rounded-2xl bg-secondary text-foreground font-black italic uppercase tracking-widest text-[10px] flex items-center gap-3 shadow-xl hover:scale-[1.02] transition-transform"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "COMMIT CHANGES"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
