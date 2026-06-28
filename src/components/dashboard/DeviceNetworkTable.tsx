import React from 'react';
import { cn } from '@/lib/utils';
import { Smartphone, Monitor, Cpu, Battery, Wifi, WifiOff, Radio } from 'lucide-react';

interface Device {
  id: string;
  name: string;
  type: string;
  location: string;
  status: 'ONLINE' | 'OFFLINE' | 'ALERT';
  lastSeen: string;
  battery?: number;
}

interface DeviceNetworkTableProps {
  data: Device[];
}

export const DeviceNetworkTable: React.FC<DeviceNetworkTableProps> = ({ data = [] }) => {
  const getIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'POS': return Smartphone;
      case 'KIOSK': return Monitor;
      default: return Cpu;
    }
  };

  return (
    <div className="flex flex-col h-full rounded-2xl border border-border bg-card p-8 shadow-2xl transition-all duration-500 hover:shadow-indigo-500/10 group overflow-hidden relative">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground border border-primary">
            <Radio className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-xl font-black italic uppercase tracking-tighter text-foreground">Edge Infrastructure</h4>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Live status of hardware nodes & IoT network</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-border">
           <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
           <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">{data.length} Nodes Online</span>
        </div>
      </div>

      <div className="overflow-x-auto relative z-10">
        <table className="w-full text-left border-separate border-spacing-y-4">
          <thead>
            <tr>
              <th className="px-4 pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Hardware Node</th>
              <th className="px-4 pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Deployment</th>
              <th className="px-4 pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Connectivity</th>
              <th className="px-4 pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">Telemetry</th>
            </tr>
          </thead>
          <tbody>
            {data.map((device, i) => {
              const Icon = getIcon(device.type);
              return (
                <tr key={i} className="group/row">
                  <td className="px-4 py-4 bg-white/2 rounded-l-[1.25rem] border-y border-l border-border group-hover/row:bg-white/5 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted border border-border text-muted-foreground group-hover/row:text-primary group-hover/row:border-primary transition-all">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-foreground">{device.name}</p>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{device.type}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 bg-white/2 border-y border-white/5 group-hover/row:bg-white/5 transition-colors">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover/row:text-muted-foreground transition-colors">{device.location}</span>
                  </td>
                  <td className="px-4 py-4 bg-white/2 border-y border-white/5 group-hover/row:bg-white/5 transition-colors">
                    <div className="flex items-center gap-2.5">
                      {device.status === 'ONLINE' ? (
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-success border border-success/20 text-success-foreground">
                           <Wifi className="h-3 w-3" />
                           <span className="text-[9px] font-black uppercase tracking-[0.1em]">Signal Active</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-destructive border border-destructive/20 text-destructive-foreground">
                           <WifiOff className="h-3 w-3" />
                           <span className="text-[9px] font-black uppercase tracking-[0.1em]">Signal Lost</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 bg-white/2 rounded-r-[1.25rem] border-y border-r border-border group-hover/row:bg-white/5 text-right transition-colors">
                    {device.battery !== undefined && (
                      <div className="flex items-center justify-end gap-2">
                        <span className={cn(
                          "text-[10px] font-black",
                          device.battery < 20 ? 'text-destructive' : 'text-muted-foreground'
                        )}>{device.battery}%</span>
                        <div className="relative w-6 h-3 border border-border rounded-[2px] p-[1px]">
                           <div 
                             className={cn(
                               "h-full rounded-[1px]",
                               device.battery < 20 ? 'bg-destructive' : 'bg-success'
                             )} 
                             style={{ width: `${device.battery}%` }} 
                           />
                           <div className="absolute -right-[3px] top-1/2 -translate-y-1/2 w-[2px] h-1 bg-muted rounded-r-sm" />
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Subtle background glow */}
      <div className="absolute -bottom-20 -left-20 h-48 w-48 bg-primary blur-[80px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
    </div>
  );
};
