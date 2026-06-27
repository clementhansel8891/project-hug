import { Package, Clock, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";

export default function WarehouseReceiving() {
  const inboundOrders = [
    { id: "RCV-001", supplier: "PT Sumber Makmur", items: 12, eta: "2 hours", status: "In Transit" },
    { id: "RCV-002", supplier: "CV Jaya Sentosa", items: 8, eta: "Arrived", status: "Pending QC" },
    { id: "RCV-003", supplier: "UD Berkah", items: 24, eta: "Tomorrow", status: "Scheduled" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receiving"
        subtitle="Inbound shipment tracking and quality control processing."
      />
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-5 gap-4 p-4 border-b border-border text-xs font-black uppercase tracking-widest text-muted-foreground">
          <span>ID</span>
          <span>Supplier</span>
          <span>Items</span>
          <span>ETA</span>
          <span>Status</span>
        </div>
        {inboundOrders.map((order, i) => (
          <div key={i} className="grid grid-cols-5 gap-4 p-4 border-b border-border last:border-0 items-center">
            <span className="text-sm font-bold">{order.id}</span>
            <span className="text-sm">{order.supplier}</span>
            <span className="text-sm">{order.items} SKUs</span>
            <span className="text-sm text-muted-foreground">{order.eta}</span>
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-warning/10 text-warning w-fit">{order.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
