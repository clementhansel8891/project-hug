import React from 'react';
import { RefreshCcw, AlertTriangle, CheckCircle2, Cloud, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GlobalSyncHealthPanelProps {
  data: {
    pending: number;
    failed: number;
    lastSyncAt: string;
    latencyMin: number;
    isHealthy: boolean;
  };
}

export const GlobalSyncHealthPanel: React.FC<GlobalSyncHealthPanelProps> = ({ data }) => {
  return (
    <div className="flex flex-col h-full rounded-2xl border border-border bg-card p-8 shadow-2xl transition-all duration-500 hover:shadow-indigo-500/10 overflow-hidden group">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h4 className="text-xl font-black italic uppercase tracking-tighter text-foreground">Global Sync Fabric</h4>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Database replication and outbox event integrity</p>
        </div>
        <div className={cn(
          "h-12 w-12 rounded-2xl flex items-center justify-center border transition-all duration-700",
          data.isHealthy ? "bg-success border-success/20 text-success-foreground" : "bg-destructive border-destructive/20 text-destructive-foreground"
        )}>
          <Cloud className="h-6 w-6" />
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-10 py-2">
        <div className="relative flex flex-col items-center gap-4">
          <div className={cn(
            "flex h-32 w-32 items-center justify-center rounded-full border-[12px] transition-all duration-1000 shadow-[0_0_30px_-5px]",
            data.isHealthy ? "border-success/10 text-success shadow-emerald-500/20" : "border-destructive/10 text-destructive shadow-rose-500/20"
          )}>
            <Zap className={cn("h-10 w-10", data.isHealthy ? "animate-pulse" : "")} />
          </div>
          <div className="flex flex-col items-center">
            <span className={cn(
              "text-[11px] font-black uppercase tracking-[0.2em]",
              data.isHealthy ? "text-success" : "text-destructive"
            )}>
              {data.isHealthy ? 'Operational' : 'Sync Latency'}
            </span>
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Status</span>
          </div>
        </div>

        <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-3 rounded-3xl bg-muted p-6 border border-border group-hover:border-border transition-colors">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10px] font-black uppercase tracking-widest">Pending</span>
              <RefreshCcw className="h-4 w-4 animate-spin-slow text-primary" />
            </div>
            <p className="text-4xl font-black tracking-tighter text-foreground">{data.pending}</p>
          </div>

          <div className={cn(
            "space-y-3 rounded-3xl p-6 border transition-all",
            data.failed > 0 ? "bg-destructive border-destructive/20" : "bg-muted border-white/5"
          )}>
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10px] font-black uppercase tracking-widest">Failed</span>
              <AlertTriangle className={cn("h-4 w-4", data.failed > 0 ? "text-destructive animate-bounce" : "text-muted-foreground")} />
            </div>
            <p className={cn("text-4xl font-black tracking-tighter", data.failed > 0 ? "text-destructive" : "text-foreground")}>{data.failed}</p>
          </div>

          <div className="col-span-1 sm:col-span-2 flex flex-col sm:flex-row items-center justify-between gap-4 px-2 pt-4 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_8px_rgb(16,185,129)]" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Latency: <span className="text-foreground font-black">{data.latencyMin}m</span>
              </span>
            </div>
            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-tighter">
              Last Heartbeat: {new Date(data.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
      </div>
      
      {/* Decorative background glow */}
      <div className="absolute -bottom-20 -right-20 h-48 w-48 rounded-full bg-primary blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
    </div>
  );
};
