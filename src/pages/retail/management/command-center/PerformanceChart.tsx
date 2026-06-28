import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

interface SalesDataPoint {
  time: string;
  sales: number;
  orders: number;
}

interface PerformanceChartProps {
  data: SalesDataPoint[];
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({ data }) => {
  return (
    <Card className="lg:col-span-2 rounded-[2rem] shadow-2xl border-none overflow-hidden bg-card">
      <div className="p-8 border-b flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black italic uppercase tracking-tighter">
            Intra-Day Performance
          </h3>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
            Real-time revenue stream tracking
          </div>
        </div>
        <div className="flex gap-2 p-1 bg-secondary/5 rounded-xl">
          <Button disabled title="Not available yet"
            variant="ghost"
            size="sm"
            className="h-8 px-4 rounded-lg bg-card shadow-sm font-black italic text-[10px] uppercase"
          >
            Minute
          </Button>
          <Button disabled title="Not available yet"
            variant="ghost"
            size="sm"
            className="h-8 px-4 rounded-lg font-black italic text-[10px] text-muted-foreground uppercase"
          >
            Hour
          </Button>
        </div>
      </div>
      <div className="p-6">
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f1f5f9"
              />
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{
                  fontSize: 10,
                  fontWeight: 800,
                  fill: "#94a3b8",
                }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{
                  fontSize: 10,
                  fontWeight: 800,
                  fill: "#94a3b8",
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "none",
                  borderRadius: "16px",
                  color: "#fff",
                  padding: "12px",
                }}
                itemStyle={{
                  fontSize: "12px",
                  fontWeight: "900",
                  fontStyle: "italic",
                  textTransform: "uppercase",
                }}
              />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="#2563eb"
                strokeWidth={4}
                fillOpacity={1}
                fill="url(#colorSales)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
};
