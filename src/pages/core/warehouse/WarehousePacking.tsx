import { ClipboardList, Package, Truck } from "lucide-react";
import { PageHeader } from "@/core/ui/PageHeader";

export default function WarehousePacking() {
  const packingQueue = [
    { id: "PAK-201", order: "SO-4520", items: 8, weight: "12.5 kg", carrier: "JNE", status: "Packing" },
    { id: "PAK-202", order: "SO-4519", items: 3, weight: "4.2 kg", carrier: "SiCepat", status: "Labeled" },
    { id: "PAK-203", order: "SO-4518", items: 15, weight: "22.1 kg", carrier: "JNT", status: "Ready to Ship" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Packing"
        subtitle="Pack station queue, label generation, and outbound readiness."
      />
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-6 gap-4 p-4 border-b border-border text-xs font-black uppercase tracking-widest text-muted-foreground">
          <span>Pack ID</span>
          <span>Order</span>
          <span>Items</span>
          <span>Weight</span>
          <span>Carrier</span>
          <span>Status</span>
        </div>
        {packingQueue.map((item, i) => (
          <div key={i} className="grid grid-cols-6 gap-4 p-4 border-b border-border last:border-0 items-center">
            <span className="text-sm font-bold">{item.id}</span>
            <span className="text-sm">{item.order}</span>
            <span className="text-sm">{item.items}</span>
            <span className="text-sm text-muted-foreground">{item.weight}</span>
            <span className="text-sm">{item.carrier}</span>
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-primary/10 text-primary w-fit">{item.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
