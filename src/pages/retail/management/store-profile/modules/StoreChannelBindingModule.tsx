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
import { Link, ShoppingCart, Repeat2 } from "lucide-react";

export const StoreChannelBindingModule: React.FC = () => {
  const { selectedStore, updateLocalConfig, selectedStoreId, canEditStore } =
    useStore();

  if (selectedStoreId === "all_stores") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Link className="w-16 h-16 mb-4 opacity-20" />
        <h3 className="text-xl font-black italic tracking-wider">
          OMNICHANNEL SYNCHRONIZATION
        </h3>
        <p className="text-sm mt-2 max-w-md text-center">
          Select a specific node to configure commerce bindings, order routing,
          and marketplace links.
        </p>
      </div>
    );
  }

  if (!selectedStore) return null;

  const config = selectedStore.channelBinding || {};

  const handleUpdate = (updates: Partial<typeof config>) => {
    updateLocalConfig({
      channelBinding: { ...config, ...updates },
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-xl text-primary">
          <Link className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-black italic uppercase tracking-wider text-muted-foreground">
            Channel Bindings
          </h2>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Cross-channel commerce logic, O2O mappings, and routing precedence
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Marketplace Connectors */}
        <div className="space-y-6 bg-card p-6 rounded-2xl border border-border shadow-sm">
          <h3 className="text-sm font-black italic text-muted-foreground tracking-wider flex items-center gap-2 border-b border-border pb-3">
            <ShoppingCart className="w-4 h-4 text-muted-foreground" /> Omnichannel
            Connectors
          </h3>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Primary Headless E-commerce Store ID
              </Label>
              <Input
                value={config.linked_ecommerce_store_id || ""}
                disabled={!canEditStore}
                onChange={(e) =>
                  handleUpdate({ linked_ecommerce_store_id: e.target.value })
                }
                placeholder="ECOM-HQ-01"
                className="font-mono border-border"
              />
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                Link this physical node to an online counterpart for BOPIS
                features
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Active Marketplace Integrations
              </Label>
              <Input
                value={config.marketplace_integrations?.join(", ") || ""}
                disabled={!canEditStore}
                onChange={(e) =>
                  handleUpdate({
                    marketplace_integrations: e.target.value
                      .split(",")
                      .map((s) => s.trim()),
                  })
                }
                placeholder="Tokopedia, Shopee, Lazada"
                className="font-mono border-border"
              />
            </div>
          </div>
        </div>

        {/* Sync & Routing */}
        <div className="space-y-6 bg-card p-6 rounded-2xl border border-border shadow-sm">
          <h3 className="text-sm font-black italic text-muted-foreground tracking-wider flex items-center gap-2 border-b border-border pb-3">
            <Repeat2 className="w-4 h-4 text-muted-foreground" /> Order & Sync Routing
          </h3>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Channel Precedence Policy
              </Label>
              <Input
                value={config.channel_priority?.join(", ") || ""}
                disabled={!canEditStore}
                onChange={(e) =>
                  handleUpdate({
                    channel_priority: e.target.value
                      .split(",")
                      .map((s) => s.trim()),
                  })
                }
                placeholder="B2B, Physical POS, VIP Marketplace, Standard Ecom"
                className="font-mono border-border"
              />
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                Stock reservation priority for competing channels during
                undersell events
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Order Injection Logic
              </Label>
              <Select
                value={config.order_routing_logic || "nearest_node"}
                disabled={!canEditStore}
                onValueChange={(value) =>
                  handleUpdate({ order_routing_logic: value })
                }
              >
                <SelectTrigger className="border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nearest_node">
                    Nearest Node Processing
                  </SelectItem>
                  <SelectItem value="central_dispatch">
                    Central Dispatch Only
                  </SelectItem>
                  <SelectItem value="split_fulfillment">
                    Allow Split Fulfillment
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                O2O (Online-To-Offline) Synchronization
              </Label>
              <Select
                value={
                  config.online_to_offline_sync_policy ||
                  "bi_directional_realtime"
                }
                disabled={!canEditStore}
                onValueChange={(value) =>
                  handleUpdate({ online_to_offline_sync_policy: value })
                }
              >
                <SelectTrigger className="border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bi_directional_realtime">
                    Bi-directional Realtime Sync
                  </SelectItem>
                  <SelectItem value="offline_master_push">
                    Offline Master (Push to Cloud)
                  </SelectItem>
                  <SelectItem value="cloud_master_pull">
                    Cloud Master (Pull to Edge)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-primary/5 p-4 rounded-xl border border-primary">
              <p className="text-xs text-primary font-medium">
                Channel configuration determines how global orders map to this
                physical node. Real-time marketplace credentials should be
                managed in <strong>Ecommerce Connectors</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
