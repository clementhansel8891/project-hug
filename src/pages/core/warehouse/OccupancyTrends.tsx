import { BarChart3, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";

export default function OccupancyTrends() {
  const monthlyData = [
    { month: "Jan", occupancy: 72 },
    { month: "Feb", occupancy: 78 },
    { month: "Mar", occupancy: 81 },
    { month: "Apr", occupancy: 75 },
    { month: "May", occupancy: 83 },
    { month: "Jun", occupancy: 79 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Occupancy Trends"
        subtitle="Historical storage utilization and capacity planning analytics."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Current Occupancy</p>
          <p className="text-4xl font-black">79%</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Available Bins</p>
          <p className="text-4xl font-black">21</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Peak Usage (30d)</p>
          <p className="text-4xl font-black">92%</p>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">Monthly Trend</h3>
        <div className="flex items-end gap-3 h-40">
          {monthlyData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full bg-primary/20 rounded-t-lg relative" style={{ height: `${d.occupancy}%` }}>
                <div className="absolute inset-0 bg-primary rounded-t-lg" style={{ height: '100%' }} />
              </div>
              <span className="text-[10px] font-bold text-muted-foreground">{d.month}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
