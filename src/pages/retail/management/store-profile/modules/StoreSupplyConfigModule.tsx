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
import { PackageCheck, Truck, ArrowRightLeft } from "lucide-react";

export const StoreSupplyConfigModule: React.FC = () => {
  const { selectedStore, updateLocalConfig, selectedStoreId, canEditStore } =
    useStore();

  if (selectedStoreId === "all_stores") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <PackageCheck className="w-16 h-16 mb-4 opacity-20" />
        <h3 className="text-xl font-black italic tracking-wider">
          GLOBAL SUPPLY ROUTING
        </h3>
        <p className="text-sm mt-2 max-w-md text-center">
          Select a specific node to configure inventory ingestion and outbound
          fulfillment logic.
        </p>
      </div>
    );
  }

  if (!selectedStore) return null;

  const config = selectedStore.supplyConfig || {};

  const handleUpdate = (updates: Partial<typeof config>) => {
    updateLocalConfig({
      supplyConfig: { ...config, ...updates },
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-success/10 rounded-xl text-success">
          <PackageCheck className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-black italic uppercase tracking-wider text-muted-foreground">
            Logistics & Routing
          </h2>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Inventory flow, replenishment rules, and fulfillment policies
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Inbound Supply */}
        <div className="space-y-6 bg-card p-6 rounded-2xl border border-border shadow-sm">
          <h3 className="text-sm font-black italic text-muted-foreground tracking-wider flex items-center gap-2 border-b border-border pb-3">
            <Truck className="w-4 h-4 text-muted-foreground" /> Inbound Logistics
          </h3>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Default Inbound Warehouse
              </Label>
              <Input
                value={config.default_inbound_warehouse_id || ""}
                disabled={!canEditStore}
                onChange={(e) =>
                  handleUpdate({ default_inbound_warehouse_id: e.target.value })
                }
                placeholder="Region Central Warehouse (WH-01)"
                className="font-mono border-border"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Stock Transfer Priority
              </Label>
              <Select
                value={config.transfer_priority_policy || "balanced"}
                disabled={!canEditStore}
                onValueChange={(value: any) =>
                  handleUpdate({ transfer_priority_policy: value })
                }
              >
                <SelectTrigger className="border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="speed">
                    Speed-Optimized (Express Lanes)
                  </SelectItem>
                  <SelectItem value="balanced">
                    Balanced (Cost/Speed tradeoff)
                  </SelectItem>
                  <SelectItem value="cost">
                    Cost-Optimized (Batch Delivery)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Replenishment Rule Set
              </Label>
              <Select
                value={config.replenishment_rule_set || "dynamic_mto"}
                disabled={!canEditStore}
                onValueChange={(value) =>
                  handleUpdate({ replenishment_rule_set: value })
                }
              >
                <SelectTrigger className="border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="static_min_max">
                    Static Min/Max Target
                  </SelectItem>
                  <SelectItem value="dynamic_mto">
                    Dynamic (Make-to-Order)
                  </SelectItem>
                  <SelectItem value="predictive_ai">
                    Predictive Demand Forecast
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Outbound & Fulfillment */}
        <div className="space-y-6 bg-card p-6 rounded-2xl border border-border shadow-sm">
          <h3 className="text-sm font-black italic text-muted-foreground tracking-wider flex items-center gap-2 border-b border-border pb-3">
            <ArrowRightLeft className="w-4 h-4 text-muted-foreground" /> Outbound
            Routing
          </h3>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Safety Stock Algorithm
              </Label>
              <Select
                value={config.safety_stock_policy || "standard_buffer"}
                disabled={!canEditStore}
                onValueChange={(value) =>
                  handleUpdate({ safety_stock_policy: value })
                }
              >
                <SelectTrigger className="border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zero_tolerance">
                    Strict Zero Tolerance (Reject oversell)
                  </SelectItem>
                  <SelectItem value="standard_buffer">
                    Standard Buffer (-5 units)
                  </SelectItem>
                  <SelectItem value="aggressive_sell">
                    Aggressive (Allow Backorders)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Reorder Threshold Template
              </Label>
              <Select
                value={
                  config.auto_reorder_threshold_template || "high_velocity"
                }
                disabled={!canEditStore}
                onValueChange={(value) =>
                  handleUpdate({ auto_reorder_threshold_template: value })
                }
              >
                <SelectTrigger className="border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high_velocity">
                    High Velocity (Reactive)
                  </SelectItem>
                  <SelectItem value="steady_state">
                    Steady State (Weekly)
                  </SelectItem>
                  <SelectItem value="manual_only">
                    Manual Review Required
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Fallback Nodes (If Stockout)
              </Label>
              <Input
                value={config.fulfillment_fallback_routing?.join(", ") || ""}
                disabled={!canEditStore}
                onChange={(e) =>
                  handleUpdate({
                    fulfillment_fallback_routing: e.target.value
                      .split(",")
                      .map((s) => s.trim()),
                  })
                }
                placeholder="STORE-002, WH-01"
                className="font-mono border-border"
              />
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                Comma-separated list of secondary fulfillment locations
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
