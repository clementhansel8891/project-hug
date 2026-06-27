import { ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/core/ui/PageHeader";

export default function WarehouseAudit() {
  const auditHistory = [
    { date: "2026-06-25", zone: "Zone A", discrepancies: 0, status: "Pass", auditor: "System" },
    { date: "2026-06-20", zone: "Zone B", discrepancies: 2, status: "Review", auditor: "Andi S." },
    { date: "2026-06-15", zone: "Zone C", discrepancies: 0, status: "Pass", auditor: "System" },
    { date: "2026-06-10", zone: "Zone D", discrepancies: 1, status: "Resolved", auditor: "Budi R." },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouse Audit"
        subtitle="Cycle count history, discrepancy tracking, and compliance reports."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Accuracy Rate</p>
          <p className="text-4xl font-black text-success">99.2%</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Open Discrepancies</p>
          <p className="text-4xl font-black text-warning">2</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Last Full Audit</p>
          <p className="text-4xl font-black">5d ago</p>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-5 gap-4 p-4 border-b border-border text-xs font-black uppercase tracking-widest text-muted-foreground">
          <span>Date</span>
          <span>Zone</span>
          <span>Discrepancies</span>
          <span>Auditor</span>
          <span>Status</span>
        </div>
        {auditHistory.map((item, i) => (
          <div key={i} className="grid grid-cols-5 gap-4 p-4 border-b border-border last:border-0 items-center">
            <span className="text-sm">{item.date}</span>
            <span className="text-sm font-bold">{item.zone}</span>
            <span className="text-sm">{item.discrepancies}</span>
            <span className="text-sm text-muted-foreground">{item.auditor}</span>
            <span className={`text-xs font-bold px-2 py-1 rounded-full w-fit ${item.status === 'Pass' ? 'bg-success/10 text-success' : item.status === 'Review' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'}`}>
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
