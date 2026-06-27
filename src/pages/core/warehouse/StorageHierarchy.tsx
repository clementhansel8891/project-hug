import { MapPin, Layers, Building2 } from "lucide-react";
import { PageHeader } from "@/core/ui/PageHeader";

export default function StorageHierarchy() {
  const zones = [
    { name: "Zone A - Cold Storage", bins: 24, occupancy: 78, type: "Refrigerated" },
    { name: "Zone B - Dry Goods", bins: 48, occupancy: 92, type: "Ambient" },
    { name: "Zone C - Bulk Storage", bins: 16, occupancy: 45, type: "Open Floor" },
    { name: "Zone D - High Value", bins: 12, occupancy: 67, type: "Secured" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Storage Hierarchy"
        subtitle="Spatial zone mapping and bin allocation structure."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {zones.map((zone, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-sm">{zone.name}</p>
                  <p className="text-xs text-muted-foreground">{zone.type}</p>
                </div>
              </div>
              <span className="text-xs font-bold text-muted-foreground">{zone.bins} bins</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Occupancy</span>
                <span>{zone.occupancy}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${zone.occupancy}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
