import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Target, Zap, Activity } from "lucide-react";
import type { RetailOrder, RetailStore, RetailChannel } from "@/core/types/retail/retail";
import { useSession } from "@/core/security/session";
import { apiRequest } from "@/core/api/apiClient";
import { useToast } from "@/hooks/use-toast";

interface FleetRevenueMatrixProps {
  orders: RetailOrder[];
  stores: RetailStore[];
  channels: RetailChannel[];
}

export const FleetRevenueMatrix: React.FC<FleetRevenueMatrixProps> = ({
  orders,
  stores,
  channels,
}) => {
  const session = useSession();
  const { toast } = useToast();

  // Aggregate sales by node (store or channel)
  const nodeSales = useMemo(() => {
    const salesMap: Record<string, { name: string; amount: number; type: 'store' | 'channel' }> = {};
    
    // Initialize with all stores
    stores.forEach(s => {
      salesMap[s.id] = { name: s.name, amount: 0, type: 'store' };
    });
    
    // Initialize with all channels
    channels.forEach(c => {
      salesMap[c.id] = { name: c.name, amount: 0, type: 'channel' };
    });

    // Aggregate orders
    orders.forEach(o => {
      const node_id = o.storeId || o.channelId;
      if (node_id && salesMap[node_id]) {
        salesMap[node_id].amount += (o.total_amount || o.totalAmount || 0);
      }
    });

    return Object.values(salesMap)
      .filter(n => n.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [orders, stores, channels]);

  // Aggregate sales by time (last 7 days simulation based on order creation)
  const timeSeries = useMemo(() => {
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      days[date.toISOString().split('T')[0]] = 0;
    }

    orders.forEach(o => {
      const day = new Date(o.created_at || o.createdAt || "").toISOString().split('T')[0];
      if (days[day] !== undefined) {
        days[day] += (o.total_amount || o.totalAmount || 0);
      }
    });

    return Object.entries(days).map(([name, value]) => ({
      name: new Date(name).toLocaleDateString('en-US', { weekday: 'short' }),
      value,
    }));
  }, [orders]);

  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || o.totalAmount || 0), 0);
  const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

  return (
    <div className="space-y-10 animate-in fade-in duration-1000">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* REVENUE DISTRIBUTION */}
        <Card className="lg:col-span-2 border-none bg-white/[0.03] backdrop-blur-3xl shadow-2xl rounded-[2rem] overflow-hidden border border-white/5 group relative">
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full blur-[120px] -mr-40 -mt-40 group-hover:bg-primary/20 transition-all duration-1000" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-center justify-between mb-12">
              <div className="space-y-2">
                <h3 className="text-[10px] font-black italic uppercase tracking-[0.4em] text-muted-foreground">
                  Multi-Node Performance
                </h3>
                <div className="flex items-center gap-4">
                  <Activity className="w-8 h-8 text-primary" />
                  <p className="text-2xl font-black italic text-foreground tracking-tighter uppercase">
                    Revenue Matrix
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-3">
                 <div className="px-6 py-3 bg-primary/10 border border-primary rounded-2xl flex items-center gap-3 shadow-xl backdrop-blur-xl">
                  <Target className="w-5 h-5 text-primary" />
                  <span className="text-[10px] font-black italic uppercase text-primary tracking-[0.2em]">
                    LIVE TELEMETRY
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] italic">Fleet Total</p>
                  <p className="text-2xl font-black italic text-foreground tracking-tighter">Rp {(totalRevenue / 1000000).toFixed(1)}M</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={async () => {
                      try {
                        await apiRequest("/retail/analytics/fleet-serialize", "POST", session);
                        toast({ title: "Export Complete", description: "Fleet revenue data serialized to CSV." });
                      } catch (e) {
                        toast({ title: "Export Failed", description: "Could not serialize fleet revenue data.", variant: "destructive" });
                      }
                    }}
                    className="px-4 py-2 bg-secondary/40 border border-border rounded-xl text-[9px] font-black italic uppercase text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all tracking-widest"
                  >
                    Export CSV
                  </button>
                  <button 
                    onClick={async () => {
                      try {
                        await apiRequest("/retail/analytics/strategic-yield", "POST", session);
                        toast({ title: "Forecast Generated", description: "Strategic yield projections computed successfully." });
                      } catch (e) {
                        toast({ title: "Forecast Failed", description: "Could not generate strategic yield projections.", variant: "destructive" });
                      }
                    }}
                    className="px-4 py-2 bg-primary/20 border border-primary rounded-xl text-[9px] font-black italic uppercase text-primary hover:text-primary hover:bg-primary/40 transition-all tracking-widest"
                  >
                    AI Forecast
                  </button>
                </div>
              </div>
            </div>

            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={nodeSales} layout="vertical" margin={{ left: 40, right: 40 }}>
                  <CartesianGrid horizontal={false} vertical={true} stroke="rgba(255,255,255,0.03)" strokeDasharray="12 12" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#475569', fontSize: 10, fontWeight: 900, fontStyle: 'italic' }}
                    width={100}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background/90 backdrop-blur-3xl border border-border p-6 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                            <p className="text-[10px] font-black italic text-muted-foreground uppercase tracking-widest mb-2">{payload[0].payload.name}</p>
                            <p className="text-2xl font-black italic text-foreground tracking-tighter">Rp {payload[0].value?.toLocaleString()}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="amount" radius={[0, 12, 12, 0]} barSize={32}>
                    {(Array.isArray(nodeSales) ? nodeSales : []).map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.type === 'store' ? '#4f46e5' : '#10b981'} 
                        className="transition-all duration-500 hover:opacity-80"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* GROWTH TERMINAL */}
        <div className="flex flex-col gap-6">
          <Card className="border-none bg-white/[0.03] backdrop-blur-3xl shadow-2xl rounded-[2rem] p-6 flex flex-col justify-between group border border-white/5 relative overflow-hidden flex-1">
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-success/5 rounded-full blur-[60px] -ml-16 -mb-16 group-hover:bg-success/10 transition-all duration-1000" />
            <div className="space-y-6 relative z-10">
              <div className="w-16 h-16 rounded-xl bg-primary/10 text-primary border border-primary flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-2xl">
                <Zap className="w-8 h-8" />
              </div>
              <div>
                <p className="text-[10px] font-black italic uppercase tracking-[0.3em] text-muted-foreground">Avg Transaction Value</p>
                <h4 className="text-2xl font-black italic tracking-tighter text-foreground mt-2">
                  Rp {Math.round(avgOrderValue).toLocaleString()}
                </h4>
              </div>
            </div>
            <div className="flex items-center gap-3 text-success font-black italic mt-6 relative z-10">
              <TrendingUp className="w-5 h-5" />
              <span className="text-[10px] font-black italic uppercase tracking-[0.2em]">+12.4% vs prev shift</span>
            </div>
          </Card>

          <Card className="border-none bg-primary shadow-[0_30px_60px_-15px_rgba(79,70,229,0.5)] rounded-[2rem] p-6 text-foreground relative overflow-hidden group/velocity flex-1">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[80px] -mr-32 -mt-32 group-hover/velocity:scale-150 transition-transform duration-1000" />
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <h4 className="text-[10px] font-black italic uppercase tracking-[0.3em]  mb-8">Velocity Stream (7D)</h4>
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeSeries}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#fff" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#fff" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white/95 backdrop-blur-xl p-5 rounded-xl shadow-3xl border-none">
                                 <p className="text-xl font-black italic text-foreground tracking-tighter">Rp {payload[0].value?.toLocaleString()}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#fff" 
                        strokeWidth={5} 
                        fillOpacity={1} 
                        fill="url(#colorValue)" 
                        animationDuration={2000}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="pt-8 border-t border-border flex items-center justify-between">
                 <p className="text-[10px] font-black uppercase tracking-[0.3em] ">Strategic Peak Yield</p>
                 <TrendingUp className="w-5 h-5 text-foreground/40" />
              </div>
            </div>
          </Card>
      </div>
    </div>
  </div>
  );
};
