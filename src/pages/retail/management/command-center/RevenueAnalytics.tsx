import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { RevenueAnalytics as IRevenueAnalytics } from "@/core/types/retail/analytics";
import { TrendingUp, Wallet, Receipt, Zap } from "lucide-react";

interface RevenueAnalyticsProps {
  data: IRevenueAnalytics;
}

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#3b82f6"];

export const RevenueAnalytics: React.FC<RevenueAnalyticsProps> = ({ data }) => {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
      {/* Revenue Trend Area */}
      <div className="xl:col-span-3 bg-card backdrop-blur-3xl p-6 rounded-[2rem] border border-border shadow-2xl hover:bg-card hover:-translate-y-1 transition-all duration-700 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-primary/10 rounded-full blur-[130px] -mr-[15%] -mt-[15%] group-hover:bg-primary/20 transition-all duration-1000" />

        <div className="flex items-center justify-between mb-12 relative z-10">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-foreground shadow-xl shadow-indigo-600/20 group-hover:rotate-6 transition-transform duration-500">
              <TrendingUp className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground italic">
                Revenue Flow Matrix
              </h3>
              <p className="text-2xl font-black italic text-foreground tracking-tighter">
                Live Performance
              </p>
            </div>
          </div>
          <div className="bg-success/10 backdrop-blur-3xl px-8 py-4 rounded-2xl border border-success/20 text-right group/growth shadow-xl">
            <p className="text-[10px] font-black uppercase tracking-widest text-success mb-1 italic">
              Velocity Uptick
            </p>
            <p className="text-3xl font-black italic text-success leading-none group-hover/growth:scale-110 transition-transform origin-right tracking-tighter">
              +{data.growthPercentage}%
            </p>
          </div>
        </div>

        <div className="h-[380px] w-full relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.daily}>
              <defs>
                <linearGradient
                  id="revenueGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="50%" stopColor="#8b5cf6" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="12 12"
                vertical={false}
                stroke="rgba(255,255,255,0.03)"
              />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 900, fill: "#475569", fontStyle: 'italic' }}
                dy={20}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 900, fill: "#475569", fontStyle: 'italic' }}
                tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`}
                dx={-20}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-secondary/90 backdrop-blur-3xl border border-border p-6 rounded-[2rem] shadow-3xl">
                        <p className="text-[10px] font-black italic text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
                        <p className="text-2xl font-black italic text-foreground tracking-tighter">
                          Rp {payload[0].value?.toLocaleString()}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#6366f1"
                strokeWidth={5}
                fillOpacity={1}
                fill="url(#revenueGradient)"
                animationDuration={2500}
                animationEasing="ease-in-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Side Insights */}
      <div className="space-y-10 flex flex-col">
        {/* Payment Mix Widget */}
        <div className="bg-card backdrop-blur-3xl p-8 rounded-[2rem] border border-border shadow-2xl flex-1 flex flex-col hover:bg-card hover:-translate-y-1 transition-all duration-700 group">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground italic">
              Payment Typology
            </h3>
            <Wallet className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <div className="h-[160px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.paymentMethodDistribution}
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={10}
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={1500}
                    stroke="none"
                  >
                    {(Array.isArray(data.paymentMethodDistribution) ? data.paymentMethodDistribution : []).map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                        className="hover:opacity-80 transition-opacity cursor-pointer"
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">
                  Active
                </span>
                <span className="text-2xl font-black italic text-foreground leading-none tracking-tighter">
                  {data.paymentMethodDistribution.length}
                </span>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              {(Array.isArray(data.paymentMethodDistribution) ? data.paymentMethodDistribution : []).map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between group/item cursor-default"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-3 h-3 rounded-full transition-all shadow-[0_0_8px_rgba(255,255,255,0.1)]"
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                    <span className="text-[11px] font-bold text-muted-foreground group-hover/item:text-foreground transition-colors uppercase tracking-widest italic">
                      {item.method}
                    </span>
                  </div>
                  <span className="text-[11px] font-black text-foreground bg-secondary/40 px-3 py-1 rounded-xl group-hover/item:bg-primary transition-all shadow-inner">
                    {item.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Refund & Anomaly Card */}
        <div className="bg-primary p-8 rounded-[2rem] text-foreground shadow-3xl relative overflow-hidden group hover:-translate-y-1 transition-all duration-700 border-none">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/20 blur-[90px] -mr-20 -mt-20 group-hover:scale-150 transition-all duration-1000" />
          <div className="absolute bottom-[-20%] left-[-10%] w-32 h-32 bg-success/20 blur-[70px] pointer-events-none" />

          <div className="flex items-center justify-between mb-6 relative z-10">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary italic">
              Loss Prevention
            </h3>
            <Receipt className="w-6 h-6 text-foreground opacity-50 group-hover:rotate-12 transition-transform duration-500" />
          </div>

          <div className="flex items-baseline gap-3 relative z-10">
            <p className="text-6xl font-black italic tracking-tighter text-foreground">
              {data.refundRatio}
            </p>
            <p className="text-2xl font-black text-foreground/40 tracking-tighter">%</p>
          </div>

          <div className="mt-12 relative z-10">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] italic">
                Refund Ratio
              </span>
              <span className="px-4 py-1.5 rounded-xl bg-white/10 border border-border text-[9px] font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />{" "}
                NOMINAL
              </span>
            </div>
            <div className="w-full bg-secondary/50 h-3 rounded-full overflow-hidden p-0.5 border border-border shadow-inner">
              <div
                className="bg-white h-full rounded-full shadow-[0_0_15px_rgba(255,255,255,0.6)] transition-all duration-2000 ease-out"
                style={{
                  width: `${Math.min(100, (data.refundRatio / 5) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
