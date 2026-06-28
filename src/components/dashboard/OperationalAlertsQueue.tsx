import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, AlertTriangle, Info, ArrowRight, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface Alert {
  id: string;
  title: string;
  detail: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  module: string;
  time: string;
  actionUrl?: string;
}

interface OperationalAlertsQueueProps {
  data: Alert[];
}

export const OperationalAlertsQueue: React.FC<OperationalAlertsQueueProps> = ({ data = [] }) => {
  const navigate = useNavigate();

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return { icon: AlertCircle, color: 'text-destructive-foreground', glow: 'shadow-rose-500/20', bg: 'bg-destructive', border: 'border-destructive/20' };
      case 'HIGH': return { icon: AlertTriangle, color: 'text-warning-foreground', glow: 'shadow-amber-500/20', bg: 'bg-warning', border: 'border-warning/20' };
      case 'MEDIUM': return { icon: Info, color: 'text-primary-foreground', glow: 'shadow-blue-500/20', bg: 'bg-primary', border: 'border-primary' };
      default: return { icon: Info, color: 'text-muted-foreground', glow: 'shadow-slate-500/10', bg: 'bg-white/5', border: 'border-border' };
    }
  };

  return (
    <div className="flex flex-col h-full rounded-2xl border border-border bg-card p-8 shadow-2xl transition-all duration-500 hover:shadow-indigo-500/10">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive text-destructive-foreground border border-destructive/20">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-[0.15em] text-foreground">Alerts Queue</h4>
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Critical issues requiring intervention</p>
          </div>
        </div>
        <div className="flex h-8 w-16 items-center justify-center rounded-lg bg-white/5 border border-border">
           <span className="text-[10px] font-black text-foreground">{data.length}</span>
           <span className="text-[8px] font-bold text-muted-foreground ml-1 uppercase tracking-tighter">Live</span>
        </div>
      </div>

      <ScrollArea className="h-[300px] pr-4">
        <div className="space-y-4">
          {data.length > 0 ? (
            data.map((alert, i) => {
              const style = getSeverityStyle(alert.severity);
              return (
                <div 
                  key={i} 
                  className={cn(
                    "group relative flex items-start gap-4 rounded-2xl border p-5 transition-all duration-300 hover:translate-x-1 cursor-pointer overflow-hidden",
                    style.bg, style.border
                  )}
                  onClick={() => alert.actionUrl && navigate(alert.actionUrl)}
                >
                  <div className={cn("mt-1 shrink-0 rounded-full p-2 bg-muted border border-border", style.color, style.glow)}>
                    <style.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">{alert.module}</span>
                      <span className="text-[9px] font-bold text-muted-foreground">{new Date(alert.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-xs font-black text-foreground">{alert.title}</p>
                    <p className="text-[10px] leading-relaxed text-muted-foreground group-hover:text-muted-foreground transition-colors line-clamp-2">{alert.detail}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 self-center text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-[260px] gap-4 opacity-40">
               <div className="h-16 w-16 rounded-3xl bg-success flex items-center justify-center border border-success/10">
                  <Info className="h-8 w-8 text-success" />
               </div>
               <div className="text-center">
                 <p className="text-[10px] font-black uppercase tracking-[0.25em] text-success">System Neutral</p>
                 <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground mt-1">No active critical alerts</p>
               </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
