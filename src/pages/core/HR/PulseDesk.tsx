import React, { useState, useEffect, useMemo } from "react";
import { 
  HeartPulse, 
  Users, 
  TrendingUp, 
  Zap, 
  Target, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Activity,
  Smile,
  Frown,
  Meh,
  Search,
  RefreshCcw,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  BrainCircuit
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/core/security/session";
import { cn } from "@/lib/utils";

export default function PulseDesk() {
  const session = useSession();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const stats = [
    { label: "Culture Score", value: "88", unit: "/100", trend: "+2.4%", color: "rose", icon: HeartPulse },
    { label: "Active Talent", value: "1,242", unit: "Global", trend: "+12", color: "blue", icon: Users },
    { label: "Growth Velocity", value: "94", unit: "%", trend: "+5.1%", color: "amber", icon: TrendingUp },
    { label: "Retention Rate", value: "97.2", unit: "%", trend: "Stable", color: "emerald", icon: ShieldCheck },
  ];

  const workforceHealth = [
    { label: "Engagement", score: 92, status: "Healthy", trend: "up" },
    { label: "Wellness", score: 84, status: "Monitor", trend: "stable" },
    { label: "Alignment", score: 88, status: "Healthy", trend: "up" },
    { label: "Growth", score: 76, status: "Tactical", trend: "down" },
  ];

  return (
    <div className="min-h-full p-8 space-y-10 bg-muted dark:bg-muted">
      {/* Tactical Header */}
      <div className="flex items-end justify-between border-b border-border dark:border-border pb-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-destructive font-black text-[10px] uppercase tracking-[0.3em]">
            <BrainCircuit className="h-3 w-3" /> Human Capital Intelligence Node
          </div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic text-foreground">
            Pulse Desk
          </h1>
          <p className="text-sm text-muted-foreground font-medium">Real-time organizational health, culture metrics, and workforce telemetry.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-destructive transition-colors" />
            <Input 
              placeholder="Query Culture Data..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-white dark:bg-muted border-border dark:border-border w-64 rounded-xl focus:ring-rose-500/20"
            />
          </div>
          <Button 
            className="rounded-xl bg-destructive hover:bg-destructive text-white shadow-lg shadow-rose-600/20 gap-2"
          >
            <Plus className="h-4 w-4" />
            New Pulse
          </Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {(Array.isArray(stats) ? stats : []).map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="group relative p-8 rounded-[2.5rem] bg-white dark:bg-muted border border-border dark:border-border shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 overflow-hidden">
              <div className="absolute top-0 right-0 h-32 w-32 bg-muted dark:bg-muted rounded-full -mr-16 -mt-16 transition-transform duration-700 group-hover:scale-150" />
              <div className="relative z-10 space-y-6">
                <div className={cn(
                  "h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-500 group-hover:rotate-12",
                  stat.color === 'rose' ? "bg-destructive text-white shadow-rose-500/20" :
                  stat.color === 'blue' ? "bg-primary text-white shadow-blue-500/20" :
                  stat.color === 'amber' ? "bg-warning text-white shadow-amber-500/20" :
                  "bg-success text-white shadow-emerald-500/20"
                )}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">{stat.label}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black tracking-tighter text-foreground leading-none">{stat.value}</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{stat.unit}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3 w-3 text-success" />
                  <span className="text-[10px] font-black text-success uppercase tracking-widest">{stat.trend}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Culture & Workforce Grid */}
      <div className="grid gap-10 lg:grid-cols-3">
        {/* Workforce Health Map */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
             <h3 className="text-xl font-black tracking-tight uppercase italic text-foreground flex items-center gap-3">
               <Activity className="h-6 w-6 text-destructive" /> Organizational Health Map
             </h3>
             <Badge className="bg-destructive text-destructive border-none px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-full">Active Monitoring</Badge>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {(Array.isArray(workforceHealth) ? workforceHealth : []).map((item, i) => (
              <div key={i} className="group p-8 rounded-[2rem] bg-white dark:bg-muted border border-border dark:border-border hover:shadow-xl transition-all duration-500">
                <div className="flex items-center justify-between mb-6">
                  <div className="space-y-1">
                    <p className="text-sm font-black text-foreground uppercase tracking-tight italic">{item.label}</p>
                    <p className={cn(
                      "text-[9px] font-black uppercase tracking-[0.2em]",
                      item.status === 'Healthy' ? "text-success" : 
                      item.status === 'Monitor' ? "text-warning" : "text-destructive"
                    )}>{item.status}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black tracking-tighter text-foreground">{item.score}%</span>
                  </div>
                </div>
                <div className="h-2 w-full bg-muted dark:bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-1000 group-hover:opacity-80",
                      item.score > 85 ? "bg-success" :
                      item.score > 75 ? "bg-warning" : "bg-destructive"
                    )}
                    style={{ width: `${item.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tactical Pulse Panel */}
        <div className="space-y-6">
           <div className="flex items-center gap-3">
             <h3 className="text-xl font-black tracking-tight uppercase italic text-foreground flex items-center gap-3">
               <Zap className="h-6 w-6 text-warning" /> Tactical Insights
             </h3>
           </div>

           <div className="p-8 rounded-[3rem] bg-card border border-border text-foreground relative overflow-hidden group shadow-2xl">
              <div className="absolute top-0 right-0 h-40 w-40 bg-primary/5 rounded-full -mr-20 -mt-20 blur-3xl group-hover:scale-150 transition-transform duration-1000" />
              <div className="relative z-10 space-y-8">
                 <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground italic">Culture Pulse Sync</p>
                    <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                 </div>

                 <div className="space-y-2">
                    <div className="flex items-center justify-between text-4xl font-black tracking-tighter uppercase italic leading-none">
                       <span>Positive</span>
                       <Smile className="h-10 w-10 text-success" />
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sentiment Hub Verification</p>
                 </div>

                 <div className="space-y-4 pt-6 border-t border-border">
                    {[
                      { label: "Direct Reports", score: "94%" },
                      { label: "Cross-Functional", score: "82%" },
                      { label: "Leadership", score: "89%" },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between">
                         <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{row.label}</span>
                         <span className="text-[10px] font-black tracking-widest text-success">{row.score}</span>
                      </div>
                    ))}
                 </div>

                 <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-[10px] font-black uppercase tracking-[0.2em] py-8 rounded-[2rem] shadow-xl group">
                    View Talent Heatmap
                    <ArrowUpRight className="ml-2 h-4 w-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                 </Button>
              </div>
           </div>

           {/* Alerts */}
           <div className="p-8 rounded-[2.5rem] bg-warning border border-warning/20 space-y-4">
              <div className="flex items-center gap-3 text-warning">
                 <AlertCircle className="h-6 w-6" />
                 <span className="text-xs font-black uppercase tracking-widest italic">Node Alert: Performance Gap</span>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                Growth velocity in the Logistics department has dropped 4.2% below baseline. Recommend tactical intervention via Skill Track module.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}
