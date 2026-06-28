import React from "react";
import { useStore } from "../StoreProfileLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, MapPin, Clock, DollarSign } from "lucide-react";

export const StoreIdentityModule: React.FC = () => {
  const { selectedStore, updateLocalConfig, selectedStoreId, canEditStore } =
    useStore();

  if (selectedStoreId === "all_stores") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Building2 className="w-16 h-16 mb-4 opacity-20" />
        <h3 className="text-xl font-black italic tracking-wider">
          GLOBAL IDENTITY ENFORCEMENT
        </h3>
        <p className="text-sm mt-2 max-w-md text-center">
          Select a specific node to configure identity, address, timezone, and
          regional settings.
        </p>
      </div>
    );
  }

  if (!selectedStore) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary rounded-xl text-primary">
          <Building2 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-black italic uppercase tracking-wider text-muted-foreground">
            Node Identity & Registration
          </h2>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Authoritative naming and regional classification
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Core Identity */}
        <div className="space-y-6 bg-card p-6 rounded-2xl border border-border shadow-sm">
          <h3 className="text-sm font-black italic text-muted-foreground tracking-wider flex items-center gap-2 border-b border-border pb-3">
            <Building2 className="w-4 h-4 text-muted-foreground" /> Core Identity
          </h3>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Node Name
              </Label>
              <Input
                value={selectedStore.name || ""}
                onChange={(e) => updateLocalConfig({ name: e.target.value })}
                disabled={!canEditStore}
                className="font-bold border-border bg-secondary/5"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Registry Code (Locked)
              </Label>
              <Input
                value={selectedStore.code || ""}
                disabled
                className="font-mono bg-secondary/10 text-muted-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Classification Tier
              </Label>
              <Select
                value={selectedStore.type}
                disabled={!canEditStore}
                onValueChange={(value: any) =>
                  updateLocalConfig({ type: value })
                }
              >
                <SelectTrigger className="border-border bg-secondary/5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flagship" className="font-bold">
                    Flagship Hub
                  </SelectItem>
                  <SelectItem value="satellite" className="font-bold">
                    Satellite Node
                  </SelectItem>
                  <SelectItem value="warehouse" className="font-bold">
                    Distribution Warehouse
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Lifecycle Status
              </Label>
              <Select
                value={selectedStore.status}
                disabled={!canEditStore}
                onValueChange={(value: any) =>
                  updateLocalConfig({ status: value })
                }
              >
                <SelectTrigger className="border-border bg-secondary/5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value="active"
                    className="font-bold text-success"
                  >
                    Active (Production)
                  </SelectItem>
                  <SelectItem
                    value="frozen"
                    className="font-bold text-primary"
                  >
                    Frozen (Maintenance)
                  </SelectItem>
                  <SelectItem
                    value="archived"
                    className="font-bold text-warning"
                  >
                    Archived
                  </SelectItem>
                  <SelectItem
                    value="decommissioned"
                    className="font-bold text-destructive"
                  >
                    Decommissioned
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Regional Parameters */}
        <div className="space-y-6 bg-card p-6 rounded-2xl border border-border shadow-sm">
          <h3 className="text-sm font-black italic text-muted-foreground tracking-wider flex items-center gap-2 border-b border-border pb-3">
            <MapPin className="w-4 h-4 text-muted-foreground" /> Regional Parameters
          </h3>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Location ID (Physical Binding)
              </Label>
              <Input
                value={selectedStore.locationId || ""}
                disabled={!canEditStore}
                onChange={(e) =>
                  updateLocalConfig({ locationId: e.target.value })
                }
                className="font-mono border-border"
                placeholder="Linked via Branch Creation"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <Clock className="w-3 h-3" /> Operational Timezone
              </Label>
              <Select
                value={selectedStore.timezone || "UTC"}
                disabled={!canEditStore}
                onValueChange={(value) =>
                  updateLocalConfig({ timezone: value })
                }
              >
                <SelectTrigger className="border-border bg-secondary/5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">
                    UTC (Coordinated Universal Time)
                  </SelectItem>
                  <SelectItem value="America/New_York">
                    EST (New York)
                  </SelectItem>
                  <SelectItem value="Europe/London">GMT (London)</SelectItem>
                  <SelectItem value="Asia/Singapore">
                    SGT (Singapore)
                  </SelectItem>
                  <SelectItem value="Asia/Jakarta">WIB (Jakarta)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <DollarSign className="w-3 h-3" /> Settlement Currency
              </Label>
              <Select
                value={selectedStore.currency || "IDR"}
                disabled={!canEditStore}
                onValueChange={(value) =>
                  updateLocalConfig({ currency: value })
                }
              >
                <SelectTrigger className="border-border bg-secondary/5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($) - US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR (€) - Euro</SelectItem>
                  <SelectItem value="GBP">GBP (£) - British Pound</SelectItem>
                  <SelectItem value="SGD">
                    SGD ($) - Singapore Dollar
                  </SelectItem>
                  <SelectItem value="IDR">
                    IDR (Rp) - Indonesian Rupiah
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Fiscal Tax Zone
              </Label>
              <Input
                value={selectedStore.taxZone || "STANDARD"}
                onChange={(e) => updateLocalConfig({ taxZone: e.target.value })}
                disabled={!canEditStore}
                className="font-mono border-border bg-secondary/5 uppercase"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
