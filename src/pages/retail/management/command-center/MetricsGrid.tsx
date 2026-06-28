import React from "react";
import { DollarSign, ShoppingBag, Users, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MetricsGridProps {
  stats: {
    totalSales: number;
    orderCount: number;
    avgTicket: number;
    activeDevices: number;
  };
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({ stats }) => {
  const metrics = [
    {
      label: "Gross Revenue",
      val: `Rp ${(stats.totalSales / 1000000).toFixed(1)}M`,
      sub: "Daily Accumulation",
      icon: DollarSign,
      color: "blue",
    },
    {
      label: "Volume Index",
      val: stats.orderCount.toString(),
      sub: `${(stats.avgTicket / 1000).toFixed(0)}k Avg Ticket`,
      icon: ShoppingBag,
      color: "indigo",
    },
    {
      label: "Human Assets",
      val: "12 Online",
      sub: `${stats.activeDevices} Active Terminals`,
      icon: Users,
      color: "emerald",
    },
    {
      label: "Policy Guard",
      val: "PLATINUM",
      sub: "0 Violations Logged",
      icon: ShieldCheck,
      color: "amber",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {(Array.isArray(metrics) ? metrics : []).map((m, i) => (
        <Card
          key={i}
          className="rounded-[2rem] p-6 bg-card border-border shadow-xl group hover:border-primary transition-all cursor-pointer"
        >
          <div className="flex justify-between items-start mb-8">
            <div
              className={cn(
                "p-4 rounded-2xl",
                m.color === "blue" && "bg-primary/5 text-primary",
                m.color === "indigo" && "bg-primary/5 text-primary",
                m.color === "emerald" && "bg-success text-success",
                m.color === "amber" && "bg-warning text-warning",
              )}
            >
              <m.icon className="w-5 h-5" />
            </div>
            <Badge className="bg-secondary/5 text-muted-foreground font-bold italic text-[8px] uppercase tracking-widest border-none">
              Vitals
            </Badge>
          </div>
          <div className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground mb-1">
            {m.label}
          </div>
          <div className="text-3xl font-black italic tracking-tighter text-foreground group-hover:text-primary transition-colors uppercase">
            {m.val}
          </div>
          <div className="text-[10px] font-bold italic text-muted-foreground mt-2 uppercase">
            {m.sub}
          </div>
        </Card>
      ))}
    </div>
  );
};
