import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { OperationalEfficiency as IOperationalEfficiency } from "@/core/types/retail/analytics";
import { Clock, Box, Zap, Activity } from "lucide-react";

interface OperationalEfficiencyProps {
  data: IOperationalEfficiency;
}

export const OperationalEfficiency: React.FC<OperationalEfficiencyProps> = ({
  data,
}) => {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Backlog Trend Area */}
      <div className="xl:col-span-2 bg-card backdrop-blur-3xl p-5 rounded-2xl border border-border shadow-2xl hover:bg-muted hover:-translate-y-0.5 transition-all duration-700 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-primary rounded-full blur-[130px] -mr-[15%] -mt-[15%] group-hover:bg-primary transition-all duration-1000" />

        <div className="flex items-center justify-between mb-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-foreground shadow-xl shadow-violet-600/20 group-hover:rotate-6 transition-transform duration-500">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground italic">
                Logistics Velocity Matrix
              </h3>
              <p className="text-xl font-black italic text-foreground tracking-tighter uppercase leading-none">
                Fulfillment Backlog
              </p>
            </div>
          </div>
        </div>

        <div className="h-[280px] w-full relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={
                data.fulfillmentBacklogTrend.length
                  ? data.fulfillmentBacklogTrend
                  : [
                      { time: "08:00", count: 12 },
                      { time: "10:00", count: 18 },
                      { time: "12:00", count: 45 },
                      { time: "14:00", count: 32 },
                      { time: "16:00", count: 28 },
                      { time: "18:00", count: 15 },
                    ]
              }
            >
              <defs>
                <linearGradient id="colorBacklog" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="50%" stopColor="#c084fc" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="12 12"
                vertical={false}
                stroke="rgba(255,255,255,0.03)"
              />
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 900, fill: "#475569", fontStyle: 'italic' }}
                dy={20}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 900, fill: "#475569", fontStyle: 'italic' }}
                dx={-20}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-secondary/90 backdrop-blur-3xl border border-border p-6 rounded-[2rem] shadow-3xl">
                        <p className="text-[10px] font-black italic text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
                        <p className="text-2xl font-black italic text-foreground tracking-tighter">
                          {payload[0].value} Units
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#8b5cf6"
                strokeWidth={5}
                fillOpacity={1}
                fill="url(#colorBacklog)"
                animationDuration={2500}
                animationEasing="ease-in-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Critical Efficiency Alerts */}
      <div className="bg-card backdrop-blur-3xl p-5 rounded-2xl border border-border shadow-2xl flex flex-col hover:bg-muted hover:-translate-y-0.5 transition-all duration-700 group/efficiency">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground italic">
            Efficiency Latency
          </h3>
          <Box className="w-5 h-5 text-muted-foreground group-hover/efficiency:text-warning transition-colors" />
        </div>

        <div className="space-y-5 flex-1">
          {(Array.isArray(data.slowestSkus) ? data.slowestSkus : []).map((sku, idx) => (
            <div
              key={idx}
              className="group/item flex items-start gap-4 p-4 rounded-xl bg-card border border-border hover:border-warning/30 hover:bg-muted transition-all duration-500 cursor-default shadow-lg"
            >
              <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center shrink-0 group-hover/item:scale-110 group-hover/item:text-warning transition-all border border-border shadow-inner">
                <Clock className="w-6 h-6 opacity-40 group-hover/item:opacity-100 transition-opacity" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <p className="text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground italic">
                    {sku.sku}
                  </p>
                  <p className="text-xs font-black text-warning italic tracking-tighter">
                    {sku.avgTime}m
                  </p>
                </div>
                <p className="text-base font-black italic text-foreground leading-tight tracking-tighter group-hover/item:text-warning transition-colors">
                  {sku.name}
                </p>
                <div className="mt-4 w-full bg-secondary/40 h-2 rounded-full overflow-hidden p-[1px] border border-border">
                  <div
                    className="h-full bg-warning rounded-full shadow-[0_0_12px_rgba(245,158,11,0.6)] transition-all duration-2000 ease-out"
                    style={{
                      width: `${Math.min(100, (sku.avgTime / 15) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 p-6 rounded-2xl bg-primary text-foreground relative overflow-hidden group/insight shadow-3xl hover:scale-[1.02] transition-all duration-500 border-none">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/20 blur-[60px] -mr-20 -mt-20 group-hover/insight:scale-150 transition-all duration-1000" />
          <div className="absolute bottom-[-20%] left-[-10%] w-24 h-24 bg-sky-400/20 blur-[50px] pointer-events-none" />

          <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-3xl border border-border shadow-xl">
              <Zap className="w-5 h-5 text-primary/10 animate-pulse" />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/10 italic">
              AI Prediction Engine
            </p>
          </div>
          <p className="text-sm font-black italic relative z-10 leading-relaxed text-primary tracking-tight">
            Peak processing latency detected between 12:00 - 14:00. Recommend
            dynamic scaling of fulfillment protocols.
          </p>
        </div>
      </div>
    </div>
  );
};
