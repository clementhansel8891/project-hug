import React from "react";
import { useStore } from "../StoreProfileLayout";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldAlert, Fingerprint, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const StoreGovernanceModule: React.FC = () => {
  const { selectedStore, updateLocalConfig, selectedStoreId, canEditStore } =
    useStore();

  if (selectedStoreId === "all_stores") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <ShieldCheck className="w-16 h-16 mb-4 opacity-20" />
        <h3 className="text-xl font-black italic tracking-wider">
          GLOBAL COMPLIANCE PROTOCOL
        </h3>
        <p className="text-sm mt-2 max-w-md text-center">
          Select a specific node to configure localized governance, license
          entitlements, and audit layers.
        </p>
      </div>
    );
  }

  if (!selectedStore) return null;

  const config = selectedStore.governance || {
    license_status: "active",
    activation_source: "Cloud",
    compliance_level: 1,
    audit_frequency_tier: "standard",
  };

  const handleUpdate = (updates: Partial<typeof config>) => {
    updateLocalConfig({
      governance: { ...config, ...updates } as any,
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-destructive rounded-xl text-destructive">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-black italic uppercase tracking-wider text-muted-foreground">
            Governance & Risk Control
          </h2>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            License enforcement, compliance scoring, and system freeze
            parameters
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Entitlements & Licensing */}
        <div className="space-y-6 bg-card p-6 rounded-2xl border border-border shadow-sm relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-destructive rounded-full blur-3xl opacity-50 pointer-events-none" />
          <h3 className="text-sm font-black italic text-muted-foreground tracking-wider flex items-center gap-2 border-b border-border pb-3 relative z-10">
            <Fingerprint className="w-4 h-4 text-muted-foreground" /> Digital
            Entitlements
          </h3>

          <div className="space-y-6 relative z-10">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Platform License Status
              </Label>
              <Select
                value={config.license_status || "active"}
                disabled={!canEditStore}
                onValueChange={(value: any) =>
                  handleUpdate({ license_status: value })
                }
              >
                <SelectTrigger className="border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value="active"
                    className="text-success font-bold"
                  >
                    Valid & Active
                  </SelectItem>
                  <SelectItem
                    value="frozen"
                    className="text-primary font-bold"
                  >
                    Suspended (Billing)
                  </SelectItem>
                  <SelectItem
                    value="expired"
                    className="text-destructive font-bold"
                  >
                    License Revoked / Expired
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Activation Source Vector
              </Label>
              <Select
                value={config.activation_source || "Cloud"}
                disabled={!canEditStore}
                onValueChange={(value: any) =>
                  handleUpdate({ activation_source: value })
                }
              >
                <SelectTrigger className="border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cloud">
                    Estela Gea Commercial Cloud (ZCC)
                  </SelectItem>
                  <SelectItem value="LAN-first">
                    On-Premises Edge Auth (Offline Key)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Activation Date (UTC)
              </Label>
              <Input
                type="date"
                disabled={!canEditStore}
                value={
                  config.activation_date
                    ? new Date(config.activation_date)
                        .toISOString()
                        .split("T")[0]
                    : ""
                }
                onChange={(e) =>
                  handleUpdate({
                    activation_date: new Date(e.target.value).toISOString(),
                  })
                }
                className="font-mono border-border"
              />
            </div>
          </div>
        </div>

        {/* Security & Audit Parameters */}
        <div className="space-y-6 bg-card p-6 rounded-2xl border border-border shadow-sm relative overflow-hidden">
          <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-secondary/10 rounded-full blur-3xl opacity-50 pointer-events-none" />
          <h3 className="text-sm font-black italic text-muted-foreground tracking-wider flex items-center gap-2 border-b border-border pb-3 relative z-10">
            <Lock className="w-4 h-4 text-muted-foreground" /> Security & Compliance
          </h3>

          <div className="space-y-6 relative z-10">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Compliance Layer (Tier 1-5)
              </Label>
              <Select
                value={config.compliance_level?.toString() || "1"}
                disabled={!canEditStore}
                onValueChange={(value) =>
                  handleUpdate({ compliance_level: parseInt(value) })
                }
              >
                <SelectTrigger className="border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Tier 1: Minimal Tracking</SelectItem>
                  <SelectItem value="2">Tier 2: Standard Auditing</SelectItem>
                  <SelectItem value="3">Tier 3: Strict Data Escrow</SelectItem>
                  <SelectItem value="4">
                    Tier 4: Regulated Entity (e.g. Pharmacy)
                  </SelectItem>
                  <SelectItem value="5">
                    Tier 5: Federal / Maximum Security
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Auditory Sweep Frequency
              </Label>
              <Select
                value={config.audit_frequency_tier || "standard"}
                disabled={!canEditStore}
                onValueChange={(value: any) =>
                  handleUpdate({ audit_frequency_tier: value })
                }
              >
                <SelectTrigger className="border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">
                    Standard (Daily Rollup)
                  </SelectItem>
                  <SelectItem value="high">
                    High Velocity (Hourly Check)
                  </SelectItem>
                  <SelectItem value="critical">
                    Critical (Per-Transaction Signing)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Decommission Trigger Webhook
              </Label>
              <Input
                value={config.decommission_trigger || ""}
                disabled={!canEditStore}
                onChange={(e) =>
                  handleUpdate({ decommission_trigger: e.target.value })
                }
                placeholder="https://api.internal/webhooks/wipe-node"
                className="font-mono border-border"
              />
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                Endpoint to hit when this node is permanently closed and data
                needs wiping
              </p>
            </div>

            <div className="bg-destructive p-4 rounded-xl border border-destructive mt-6 hidden group-hover:block transition-all">
              <p className="text-xs text-destructive font-medium mb-3">
                <strong>DANGER ZONE</strong>
              </p>
              <Button
                variant="destructive"
                size="sm"
                disabled={!canEditStore}
                className="w-full font-black italic uppercase tracking-widest text-[10px]"
              >
                Initiate Node Freeze Protocol
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
