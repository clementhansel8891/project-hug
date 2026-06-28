import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { InventoryIntelligence as IInventoryIntelligence } from "@/core/types/retail/analytics";
import { AlertTriangle, PackageSearch, Activity } from "lucide-react";

interface InventoryIntelligenceProps {
  data: IInventoryIntelligence;
}

export const InventoryIntelligence: React.FC<InventoryIntelligenceProps> = ({
  data,
}) => {
  return (
    <div className="bg-white/[0.03] backdrop-blur-3xl p-6 rounded-[2rem] border border-white/5 shadow-2xl hover:bg-white/[0.05] hover:-translate-y-1 transition-all duration-700 group h-full flex flex-col relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-primary/10 rounded-full blur-[130px] -mr-[15%] -mt-[15%] pointer-events-none" />

      <div className="flex items-center justify-between mb-10 relative z-10">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground italic">
          Stock Intelligence Matrix
        </h3>
        <PackageSearch className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>

      <div className="flex-1 space-y-12 relative z-10">
        {/* Stock Aging */}
        <div className="relative">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Activity className="w-4 h-4 text-primary" />
              <p className="text-[11px] font-black uppercase tracking-widest text-foreground italic">
                Health Distribution
              </p>
            </div>
            <div className="flex gap-2 px-4 py-1.5 rounded-xl bg-secondary/40 border border-border shadow-inner">
              <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
              <div className="w-2.5 h-2.5 rounded-full bg-primary/30 shadow-[0_0_8px_rgba(165,180,252,0.4)]" />
              <div className="w-2.5 h-2.5 rounded-full bg-destructive shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
            </div>
          </div>

          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.stockAging}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                    <stop offset="100%" stopColor="#a5b4fc" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="bracket"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 900, fill: "#475569", fontStyle: 'italic' }}
                  dy={15}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: "rgba(255, 255, 255, 0.03)", radius: 15 }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-secondary/90 backdrop-blur-3xl border border-border p-5 rounded-xl shadow-3xl">
                          <p className="text-[10px] font-black italic text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
                          <p className="text-xl font-black italic text-foreground tracking-tighter">
                            {payload[0].value} Units
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" radius={[10, 10, 5, 5]} barSize={32}>
                  {(data.stockAging || []).map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        index === (data.stockAging || []).length - 1
                          ? "#f43f5e"
                          : "url(#barGradient)"
                      }
                      className="hover:opacity-80 transition-opacity"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Prediction List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-destructive/10 rounded-2xl border border-destructive/20 shadow-lg">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <p className="text-[11px] font-black uppercase tracking-widest text-foreground italic">
                Critical Depletion (7D)
              </p>
            </div>
            <span className="text-[10px] font-black text-destructive bg-destructive/10 px-4 py-1.5 rounded-xl border border-destructive/20 animate-pulse tracking-widest italic">
              ACTION REQUIRED
            </span>
          </div>
          <div className="grid grid-cols-1 gap-5">
            {(data.lowStockPrediction || []).map((item, idx) => (
              <div
                key={idx}
                className="group/item flex items-center gap-6 p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-destructive/30 hover:bg-white/[0.04] transition-all duration-500 cursor-default shadow-xl"
              >
                <div className="min-w-[5.5rem] h-16 rounded-[1.75rem] bg-secondary/50 flex flex-col items-center justify-center text-muted-foreground group-hover/item:bg-destructive group-hover/item:text-foreground transition-all duration-500 border border-white/5 shadow-inner">
                  <span className="text-xl font-black italic leading-none mb-1 tracking-tighter">
                    {item.currentStock > 999
                      ? `${(item.currentStock / 1000).toFixed(1)}k`
                      : item.currentStock}
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-[0.1em] ">
                    Units
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-black italic text-foreground group-hover/item:text-destructive transition-colors truncate mb-2 tracking-tighter">
                    {item.name}
                  </h4>
                  <div className="flex items-center gap-4">
                    <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground group-hover/item:text-destructive whitespace-nowrap italic">
                      EST DEPLETION: {item.predictedOutDate}
                    </p>
                    <div className="h-2 flex-1 bg-secondary/40 rounded-full overflow-hidden p-[1px] border border-white/5">
                      <div
                        className="h-full bg-destructive rounded-full shadow-[0_0_12px_rgba(244,63,94,0.6)] transition-all duration-2000 ease-out"
                        style={{
                          width: `${Math.max(10, Math.min(100, (item.currentStock / 50) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
