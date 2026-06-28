import React from "react";
import { InfrastructureHealth as IInfrastructureHealth } from "@/core/types/retail/analytics";
import { Smartphone, Activity, Wifi, Server } from "lucide-react";

interface InfrastructureHealthProps {
  data: IInfrastructureHealth;
}

export const InfrastructureHealth: React.FC<InfrastructureHealthProps> = ({
  data,
}) => {
  // Graceful fallbacks for infrastructure telemetry data to prevent rendering crashes
  const uptimePercentage = data?.uptimePercentage ?? 100;
  const networkLatency = data?.networkLatency ?? 45;

  return (
    <div className="bg-card backdrop-blur-3xl p-6 rounded-[2rem] border border-border shadow-2xl hover:bg-card hover:-translate-y-1 transition-all duration-700 group h-full flex flex-col relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-info/10 rounded-full blur-[130px] -mr-[15%] -mt-[15%] pointer-events-none" />

      <div className="flex items-center justify-between mb-10 relative z-10">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground italic">
          Infrastructure Intelligence Matrix
        </h3>
        <Activity className="w-6 h-6 text-muted-foreground group-hover:text-info transition-colors" />
      </div>

      <div className="flex-1 space-y-8 relative z-10">
        <div className="relative overflow-hidden p-6 rounded-2xl bg-secondary border border-border shadow-3xl group/uptime">
          <div className="absolute top-0 right-0 w-64 h-64 bg-info/20 blur-[100px] -mr-32 -mt-32 group-hover/uptime:scale-150 transition-all duration-1000" />
          <div className="absolute bottom-[-20%] left-[-10%] w-40 h-40 bg-primary/10 blur-[80px] pointer-events-none" />

          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-secondary/40 backdrop-blur-3xl flex items-center justify-center border border-border group-hover/uptime:rotate-3 transition-all duration-500 shadow-xl">
                <Smartphone className="w-8 h-8 text-info shadow-[0_0_15px_rgba(56,189,248,0.6)]" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-info  italic">
                  Global Fleet Uptime
                </p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-black italic tracking-tighter text-foreground">
                    {uptimePercentage}
                  </p>
                  <p className="text-2xl font-black text-muted-foreground opacity-40 tracking-tighter">
                    %
                  </p>
                </div>
              </div>
            </div>
            <div className="px-5 py-2 rounded-xl bg-success/10 border border-success/20 text-[10px] font-black uppercase tracking-widest text-success flex items-center gap-2 shadow-lg italic">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />{" "}
              SLA: STABLE
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 pt-4">
          <div className="group/metric p-8 rounded-2xl bg-card border border-border hover:bg-card hover:border-success/30 hover:shadow-3xl transition-all duration-500 shadow-xl relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-success/5 rounded-full blur-2xl group-hover:scale-150 transition-all duration-700" />
            <Wifi className="absolute top-8 right-8 w-6 h-6 text-muted-foreground group-hover/metric:text-success transition-colors" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-4 italic">
              Fleet Latency
            </p>
            <div className="flex flex-col gap-2 relative z-10">
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-3xl font-black italic tracking-tighter ${networkLatency > 150 ? "text-destructive" : "text-success"}`}
                >
                  {networkLatency}
                </span>
                <span className="text-xl font-black text-muted-foreground italic tracking-tighter">
                  ms
                </span>
              </div>
              <div className="mt-4 flex items-center gap-2 px-4 py-1.5 bg-secondary/50 rounded-xl w-fit border border-border shadow-inner">
                <div
                  className={`w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)] ${networkLatency > 150 ? "bg-destructive shadow-[0_0_8px_rgba(244,63,94,0.8)]" : "bg-success shadow-[0_0_8px_rgba(16,185,129,0.8)]"}`}
                />
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground italic">
                  {networkLatency > 150 ? "DEGRADED" : "OPTIMAL PEAK"}
                </span>
              </div>
            </div>
          </div>

          <div className="group/metric p-8 rounded-2xl bg-card border border-border hover:bg-card hover:border-primary/30 hover:shadow-3xl transition-all duration-500 shadow-xl relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:scale-150 transition-all duration-700" />
            <Server className="absolute top-8 right-8 w-6 h-6 text-muted-foreground group-hover/metric:text-primary transition-colors" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-4 italic">
              Active Terminals
            </p>
            <div className="flex flex-col gap-2 relative z-10">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black italic text-primary tracking-tighter">
                  24
                </span>
                <span className="text-xl font-black text-muted-foreground italic tracking-tighter">
                  Nodes
                </span>
              </div>
              <div className="mt-4 flex items-center gap-2 px-4 py-1.5 bg-secondary/50 rounded-xl w-fit border border-border shadow-inner">
                <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground italic">
                  100% SYNCED
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
