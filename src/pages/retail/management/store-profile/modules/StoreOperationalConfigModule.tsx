import React from "react";
import { useStore } from "../StoreProfileLayout";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Zap, Clock, ShieldAlert, MonitorSmartphone } from "lucide-react";

export const StoreOperationalConfigModule: React.FC = () => {
  const { selectedStore, updateLocalConfig, selectedStoreId, canEditStore } =
    useStore();

  if (selectedStoreId === "all_stores") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Zap className="w-16 h-16 mb-4 opacity-20" />
        <h3 className="text-xl font-black italic tracking-wider">
          GLOBAL CAPABILITIES
        </h3>
        <p className="text-sm mt-2 max-w-md text-center">
          Select a specific node to configure operational rules, shifts, and
          capabilities.
        </p>
      </div>
    );
  }

  if (!selectedStore) return null;

  const config = selectedStore.operationalConfig || {};

  const handleUpdate = (updates: Partial<typeof config>) => {
    updateLocalConfig({
      operationalConfig: { ...config, ...updates },
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary rounded-xl text-primary">
          <Zap className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-black italic uppercase tracking-wider text-muted-foreground">
            Operational Capabilities
          </h2>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Rules of execution, shift boundaries, and functional modules
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Core Execution Rules */}
        <div className="space-y-6 bg-card p-6 rounded-2xl border border-border shadow-sm">
          <h3 className="text-sm font-black italic text-muted-foreground tracking-wider flex items-center gap-2 border-b border-border pb-3">
            <Clock className="w-4 h-4 text-muted-foreground" /> Boundary Conditions
          </h3>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Business Hours Template
              </Label>
              <Select
                value={config.business_hours_template || "standard_mall"}
                disabled={!canEditStore}
                onValueChange={(value) =>
                  handleUpdate({ business_hours_template: value })
                }
              >
                <SelectTrigger className="border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard_mall">
                    Standard Mall (10:00 - 22:00)
                  </SelectItem>
                  <SelectItem value="street_flagship">
                    Street Flagship (08:00 - 21:00)
                  </SelectItem>
                  <SelectItem value="24_7">Always Open (24/7)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Shift Rotation Model
              </Label>
              <Select
                value={config.default_shift_model || "two_shift_overlap"}
                disabled={!canEditStore}
                onValueChange={(value) =>
                  handleUpdate({ default_shift_model: value })
                }
              >
                <SelectTrigger className="border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="two_shift_overlap">
                    2 Shifts (Overlapping)
                  </SelectItem>
                  <SelectItem value="three_shift_strict">
                    3 Shifts (Strict Transfer)
                  </SelectItem>
                  <SelectItem value="single_flexible">
                    Single Shift (Flexible)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/5">
              <div className="space-y-0.5">
                <Label className="text-sm font-bold text-muted-foreground">
                  Auto-Close Orphaned Shifts
                </Label>
                <p className="text-xs text-muted-foreground">
                  Automatically seal cash drawers at EOD
                </p>
              </div>
              <Switch
                checked={config.auto_close_shift_setting ?? true}
                disabled={!canEditStore}
                onCheckedChange={(checked) =>
                  handleUpdate({ auto_close_shift_setting: checked })
                }
              />
            </div>
          </div>
        </div>

        {/* Sales & POS Policies */}
        <div className="space-y-6 bg-card p-6 rounded-2xl border border-border shadow-sm">
          <h3 className="text-sm font-black italic text-muted-foreground tracking-wider flex items-center gap-2 border-b border-border pb-3">
            <MonitorSmartphone className="w-4 h-4 text-muted-foreground" /> Sales &
            Execution Policies
          </h3>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Authorized POS Pool Limit
              </Label>
              <Input
                type="number"
                value={config.pos_device_limit || 5}
                disabled={!canEditStore}
                onChange={(e) =>
                  handleUpdate({
                    pos_device_limit: parseInt(e.target.value) || 0,
                  })
                }
                className="font-mono border-border"
              />
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                Max concurrent active terminal sessions
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <ShieldAlert className="w-3 h-3" /> Refund Authorization
                Constraint
              </Label>
              <Select
                value={config.refund_policy_mode || "manager_only"}
                disabled={!canEditStore}
                onValueChange={(value: any) =>
                  handleUpdate({ refund_policy_mode: value })
                }
              >
                <SelectTrigger className="border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strict">
                    Strict (Corporate Approval Required)
                  </SelectItem>
                  <SelectItem value="manager_only">
                    Manager Override Only
                  </SelectItem>
                  <SelectItem value="flexible">
                    Flexible (Cashier Allowed)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/5">
              <div className="space-y-0.5">
                <Label className="text-sm font-bold text-muted-foreground">
                  Enable Self-Checkout Engine
                </Label>
                <p className="text-xs text-muted-foreground">
                  Allow SCO topology and scanner pools
                </p>
              </div>
              <Switch
                checked={config.self_checkout_enabled ?? false}
                disabled={!canEditStore}
                onCheckedChange={(checked) =>
                  handleUpdate({ self_checkout_enabled: checked })
                }
              />
            </div>
          </div>
        </div>

        {/* Taxation & Fiscal Policy */}
        <div className="space-y-6 bg-card p-6 rounded-2xl border border-border shadow-sm md:col-span-2">
          <h3 className="text-sm font-black italic text-muted-foreground tracking-wider flex items-center gap-2 border-b border-border pb-3">
            <ShieldAlert className="w-4 h-4 text-destructive" /> Taxation & Fiscal Policy
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Default POS Sales Tax Rate (%)
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  value={config.tax_rate ?? 11}
                  disabled={!canEditStore}
                  onChange={(e) =>
                    handleUpdate({
                      tax_rate: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="font-mono border-border pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">%</span>
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                Standard rate applied to all POS transactions unless overridden
              </p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/5">
              <div className="space-y-0.5">
                <Label className="text-sm font-bold text-muted-foreground">
                  Tax Inclusive Pricing
                </Label>
                <p className="text-xs text-muted-foreground">
                  Shelf prices already include VAT/Sales Tax
                </p>
              </div>
              <Switch
                checked={config.tax_inclusive ?? false}
                disabled={!canEditStore}
                onCheckedChange={(checked) =>
                  handleUpdate({ tax_inclusive: checked })
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
