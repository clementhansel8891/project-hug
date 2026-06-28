import React from "react";
import { useStore } from "../StoreProfileLayout";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Monitor, HardDrive, WifiOff } from "lucide-react";

export const StoreInfrastructureModule: React.FC = () => {
  const { selectedStore, updateLocalConfig, selectedStoreId, canEditStore } =
    useStore();

  if (selectedStoreId === "all_stores") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Monitor className="w-16 h-16 mb-4 opacity-20" />
        <h3 className="text-xl font-black italic tracking-wider">
          HARDWARE GRID OVERVIEW
        </h3>
        <p className="text-sm mt-2 max-w-md text-center">
          Select a specific node to configure physical infrastructure, local
          servers, and offline resilience.
        </p>
      </div>
    );
  }

  if (!selectedStore) return null;

  const config = selectedStore.infrastructureRegistry || {};

  const handleUpdate = (updates: Partial<typeof config>) => {
    updateLocalConfig({
      infrastructureRegistry: { ...config, ...updates },
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-secondary/10 rounded-xl text-muted-foreground">
          <Monitor className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-black italic uppercase tracking-wider text-muted-foreground">
            Infrastructure Registry
          </h2>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Hardware arrays, local computing nodes, and continuity rules
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Hardware Topologies */}
        <div className="space-y-6 bg-card p-6 rounded-2xl border border-border shadow-sm">
          <h3 className="text-sm font-black italic text-muted-foreground tracking-wider flex items-center gap-2 border-b border-border pb-3">
            <HardDrive className="w-4 h-4 text-muted-foreground" /> Computing Arrays
          </h3>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Local Edge Server Binding
              </Label>
              <Input
                value={config.local_server_binding || ""}
                disabled={!canEditStore}
                onChange={(e) =>
                  handleUpdate({ local_server_binding: e.target.value })
                }
                placeholder="SRV-EDGE-01"
                className="font-mono border-border"
              />
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                ID of the physical gateway node located at this branch
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Approved POS Clusters
              </Label>
              <Input
                value={config.pos_clusters?.join(", ") || ""}
                disabled={!canEditStore}
                onChange={(e) =>
                  handleUpdate({
                    pos_clusters: e.target.value
                      .split(",")
                      .map((s) => s.trim()),
                  })
                }
                placeholder="CLUSTER-A, CLUSTER-B"
                className="font-mono border-border"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Registered Scanner Pools
              </Label>
              <Input
                value={config.scanner_pools?.join(", ") || ""}
                disabled={!canEditStore}
                onChange={(e) =>
                  handleUpdate({
                    scanner_pools: e.target.value
                      .split(",")
                      .map((s) => s.trim()),
                  })
                }
                placeholder="POOL-HANDHELD-1, POOL-RF-2"
                className="font-mono border-border"
              />
            </div>
          </div>
        </div>

        {/* Resilience & Continuity */}
        <div className="space-y-6 bg-card p-6 rounded-2xl border border-border shadow-sm">
          <h3 className="text-sm font-black italic text-muted-foreground tracking-wider flex items-center gap-2 border-b border-border pb-3">
            <WifiOff className="w-4 h-4 text-muted-foreground" /> Continuity &
            Resilience
          </h3>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Cloud Sync Interval (Seconds)
              </Label>
              <Input
                type="number"
                value={config.sync_interval || 60}
                disabled={!canEditStore}
                onChange={(e) =>
                  handleUpdate({ sync_interval: parseInt(e.target.value) || 0 })
                }
                className="font-mono border-border"
              />
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                Frequency for edge-to-cloud telemetry sync
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Offline Tolerance Threshold (Transactions)
              </Label>
              <Input
                type="number"
                value={config.offline_tolerance_threshold || 100}
                disabled={!canEditStore}
                onChange={(e) =>
                  handleUpdate({
                    offline_tolerance_threshold: parseInt(e.target.value) || 0,
                  })
                }
                className="font-mono border-border"
              />
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                Max offline transaction cache before forced lockout
              </p>
            </div>

            <div className="bg-warning p-4 rounded-xl border border-warning">
              <p className="text-xs text-warning font-medium">
                Note: Device registration, diagnostics, and real-time fleet
                health are managed in the <strong>Device Control Center</strong>{" "}
                module. This registry defines structural assignments only.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
