import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ActivityItem } from '@/types/dashboard.types';
import { useNavigate } from 'react-router-dom';
import { Activity as ActivityIcon, Terminal, Globe, ShieldCheck } from 'lucide-react';

interface GlobalEventFeedProps {
  activities: ActivityItem[];
}

export const GlobalEventFeed: React.FC<GlobalEventFeedProps> = ({ activities = [] }) => {
  const navigate = useNavigate();

  const getSeverityStyles = (severity?: string) => {
    switch (severity) {
      case 'critical': return 'text-destructive-foreground bg-destructive border-destructive/20';
      case 'warning': return 'text-warning-foreground bg-warning border-warning/20';
      default: return 'text-primary-foreground bg-primary border-primary';
    }
  };

  const handleItemClick = (module?: string) => {
    const routes: Record<string, string> = {
      'RETAIL': '/m/retail/management',
      'FINANCE': '/core/finance',
      'HR': '/core/hr',
      'IT': '/core/it/health',
      'SYSTEM': '/core/it'
    };
    if (module && routes[module.toUpperCase()]) navigate(routes[module.toUpperCase()]);
  };

  return (
    <div className="flex flex-col h-full rounded-[3rem] border border-border bg-card p-10 shadow-2xl transition-all duration-500 hover:shadow-indigo-500/10 group overflow-hidden relative">
      <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
         <Globe className="h-40 w-40 text-foreground" />
      </div>

      <div className="flex items-center justify-between mb-10 relative z-10">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground border border-primary">
            <Terminal className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-xl font-black italic uppercase tracking-tighter text-foreground">Global Event Telemetry</h4>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Real-time multi-tenant activity stream</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted border border-border">
           <div className="h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
           <span className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Live Stream Active</span>
        </div>
      </div>

      <ScrollArea className="h-[450px] pr-6 relative z-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {activities.length > 0 ? activities.map((activity, i) => (
            <div 
              key={i} 
              onClick={() => handleItemClick(activity.module)}
              className="group/item flex items-start gap-5 rounded-3xl border border-border bg-white/2 p-6 transition-all hover:bg-muted hover:border-border cursor-pointer relative overflow-hidden"
            >
              <div className={cn(
                "mt-2 h-2.5 w-2.5 rounded-full shrink-0 shadow-lg", 
                activity.severity === 'critical' ? 'bg-destructive animate-pulse shadow-rose-500/40' : 
                activity.severity === 'warning' ? 'bg-warning shadow-amber-500/40' : 
                'bg-primary shadow-blue-500/40'
              )} />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-foreground group-hover/item:text-primary transition-colors">{activity.title}</p>
                  <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">{formatDistanceToNow(new Date(activity.time))} ago</span>
                </div>
                <p className="text-[11px] font-medium text-muted-foreground line-clamp-2 leading-relaxed group-hover/item:text-muted-foreground transition-colors">{activity.detail}</p>
                <div className="flex items-center gap-3 pt-2">
                  {activity.module && (
                    <div className="px-2.5 py-0.5 rounded-lg bg-primary border border-primary text-[8px] font-black uppercase text-primary-foreground tracking-widest">
                      {activity.module}
                    </div>
                  )}
                  <div className={cn("px-2.5 py-0.5 rounded-lg border text-[8px] font-black uppercase tracking-widest", getSeverityStyles(activity.severity))}>
                    {activity.status}
                  </div>
                </div>
              </div>
              
              {/* Hover highlight line */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary scale-y-0 group-hover/item:scale-y-100 transition-transform duration-300" />
            </div>
          )) : (
            <div className="col-span-2 flex h-[350px] flex-col items-center justify-center text-center opacity-30">
              <div className="rounded-3xl bg-muted p-6 border border-border">
                <ActivityIcon className="h-10 w-10 text-muted-foreground" />
              </div>
              <p className="mt-6 text-sm font-black uppercase tracking-[0.3em] text-muted-foreground italic">Static Environment</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2">Awaiting ingress events from core engine</p>
            </div>
          )}
        </div>
      </ScrollArea>
      
      {/* Footer info line */}
      <div className="mt-8 pt-6 border-t border-border flex items-center justify-between opacity-50 relative z-10">
         <div className="flex items-center gap-2">
            <ShieldCheck className="h-3 w-3 text-success" />
            <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Encrypted Stream Protocol TLS 1.3</span>
         </div>
         <span className="text-[8px] font-black uppercase text-muted-foreground">Buffer: 1024 Events</span>
      </div>
    </div>
  );
};
