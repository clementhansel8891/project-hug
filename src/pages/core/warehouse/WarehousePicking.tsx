import { Boxes, Clock, User } from "lucide-react";
import { PageHeader } from "@/core/ui/PageHeader";

export default function WarehousePicking() {
  const pickLists = [
    { id: "PCK-101", order: "SO-4521", items: 5, picker: "Andi S.", status: "In Progress", progress: 60 },
    { id: "PCK-102", order: "SO-4522", items: 3, picker: "Budi R.", status: "Queued", progress: 0 },
    { id: "PCK-103", order: "SO-4520", items: 8, picker: "Citra M.", status: "Complete", progress: 100 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Picking"
        subtitle="Active pick lists, wave assignments, and fulfillment tracking."
      />
      <div className="grid gap-4">
        {pickLists.map((pick, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center">
                <Boxes className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="font-bold text-sm">{pick.id} — {pick.order}</p>
                <p className="text-xs text-muted-foreground">{pick.items} items · Assigned to {pick.picker}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-32">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-success rounded-full" style={{ width: `${pick.progress}%` }} />
                </div>
              </div>
              <span className="text-xs font-bold text-muted-foreground w-20 text-right">{pick.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
