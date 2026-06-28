import React from 'react';
import { cn } from '@/lib/utils';
import { Activity, Zap, Clock, ShieldCheck } from 'lucide-react';

interface ModuleActivity {
  name: string;
  status: 'STABLE' | 'DEGRADED' | 'DOWN';
  throughput: number;
  latency: number;
  lastChecked: string;
}

interface LiveModuleActivityProps {
  data: ModuleActivity[];
}

export const LiveModuleActivity: React.FC<LiveModuleActivityProps> = ({ data = [] }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
         <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground border border-primary">
               <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
               <h4 className="text-xs font-black uppercase tracking-[0.2em] text-foreground">Live Module Telemetry</h4>
               <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Real-time throughput and latency per domain</p>
            </div>
         </div>
         <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-success border border-success/20">
            <div className="h-1.5 w-1.5 rounded-full bg-success-foreground animate-pulse" />
            <span className="text-[8px] font-black uppercase text-success-foreground tracking-widest">Global Integrity Optimal</span>
         </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {data.map((module, i) => (
          <div key={i} className="group relative flex flex-col gap-6 rounded-[2rem] border border-border bg-card p-6 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground group-hover:text-foreground transition-colors">{module.name}</span>
              <div className={cn(
                "h-2 w-2 rounded-full shadow-[0_0_10px]",
                module.status === 'STABLE' ? "bg-success shadow-emerald-500/50" : 
                module.status === 'DEGRADED' ? "bg-warning shadow-amber-500/50" : 
                "bg-destructive shadow-rose-500/50"
              )} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-muted-foreground group-hover:text-primary transition-colors">
                  <Zap className="h-3 w-3" />
                  <span className="text-[8px] font-black uppercase tracking-widest">Flow</span>
                </div>
                <p className="text-2xl font-black tracking-tighter text-foreground">
                  {module.throughput}
                  <span className="text-[9px] font-bold text-muted-foreground ml-1 uppercase">r/s</span>
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-muted-foreground group-hover:text-primary transition-colors">
                  <Clock className="h-3 w-3" />
                  <span className="text-[8px] font-black uppercase tracking-widest">Wait</span>
                </div>
                <p className="text-2xl font-black tracking-tighter text-foreground">
                  {module.latency}
                  <span className="text-[9px] font-bold text-muted-foreground ml-1 uppercase">ms</span>
                </p>
              </div>
            </div>

            <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted">
              <div 
                className={cn(
                  "h-full transition-all duration-1000 ease-out",
                  module.status === 'STABLE' ? "bg-primary" : "bg-warning"
                )}
                style={{ width: `${Math.min(100, (module.throughput / 500) * 100)}%` }}
              />
            </div>

            {/* Subtle corner glow */}
            <div className="absolute -top-10 -left-10 h-20 w-20 rounded-full bg-primary blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          </div>
        ))}
      </div>
    </div>
  );
};
