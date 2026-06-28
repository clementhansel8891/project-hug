import React from "react";
import { WorkforceAnalytics as IWorkforceAnalytics } from "@/core/types/retail/analytics";
import { Users, TrendingUp, Clock, AlertCircle, Award } from "lucide-react";

interface WorkforceAnalyticsProps {
  data: IWorkforceAnalytics;
}

export const WorkforceAnalytics: React.FC<WorkforceAnalyticsProps> = ({
  data,
}) => {
  return (
    <div className="bg-card backdrop-blur-3xl p-6 rounded-[2rem] border border-border shadow-2xl hover:bg-card hover:-translate-y-1 transition-all duration-700 group h-full flex flex-col relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-sky-500/10 rounded-full blur-[130px] -mr-[15%] -mt-[15%] pointer-events-none" />

      <div className="flex items-center justify-between mb-10 relative z-10">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground italic">
          Workforce Intelligence Matrix
        </h3>
        <Users className="w-6 h-6 text-muted-foreground group-hover:text-sky-400 transition-colors" />
      </div>

      <div className="flex-1 space-y-12 relative z-10">
        {/* Staff Leaderboard */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-sky-500/10 rounded-2xl border border-sky-500/20 shadow-lg">
              <TrendingUp className="w-5 h-5 text-sky-500" />
            </div>
            <p className="text-[11px] font-black uppercase tracking-widest text-foreground italic">
              Peak Performance (Live)
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5">
            {(data.staffPerformance || []).map((staff, idx) => {
              const percentage = Math.min(100, (staff.sales / 15000000) * 100);
              return (
                <div
                  key={idx}
                  className="group/staff cursor-default bg-card border border-border p-6 rounded-2xl hover:border-sky-500/30 hover:bg-card hover:shadow-2xl transition-all duration-500 shadow-xl"
                >
                  <div className="flex justify-between items-center mb-5">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-2xl bg-secondary/50 flex items-center justify-center text-lg font-black text-muted-foreground group-hover/staff:bg-sky-600 group-hover/staff:text-foreground group-hover/staff:rotate-6 transition-all duration-500 border border-border shadow-inner">
                        {idx + 1}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-lg font-black italic text-foreground group-hover/staff:text-sky-400 transition-colors truncate max-w-[160px] tracking-tighter">
                          {staff.name}
                        </span>
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest italic">
                          Senior Operations
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-black text-foreground italic block leading-none mb-2 tracking-tighter">
                        Rp {(staff.sales / 1000000).toFixed(1)}M
                      </span>
                      <div className="flex items-center justify-end gap-2 px-3 py-1 rounded-xl bg-success/10 border border-success/20 shadow-lg">
                        <Award className="w-3 h-3 text-success" />
                        <span className="text-[8px] font-black text-success uppercase tracking-widest leading-none italic">
                          TOP PERFORMANCE
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="relative w-full h-2 bg-secondary/40 rounded-full overflow-hidden p-[1px] border border-border shadow-inner">
                    <div
                      className="absolute top-0 left-0 h-full bg-sky-500 rounded-full transition-all duration-2500 ease-out shadow-[0_0_12px_rgba(14,165,233,0.6)]"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Efficiency Tiles */}
        <div className="grid grid-cols-2 gap-8 pt-4">
          <div className="group/tile relative bg-card backdrop-blur-3xl p-8 rounded-2xl border border-border hover:bg-card hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 shadow-xl overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-sky-500/10 rounded-full blur-2xl group-hover:scale-150 transition-all duration-700" />
            <Clock className="absolute top-8 right-8 w-6 h-6 text-muted-foreground group-hover/tile:text-sky-400 transition-colors duration-500" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-4 italic">
              Shift Utilization
            </p>
            <div className="flex items-baseline gap-2 relative z-10">
              <span className="text-3xl font-black italic text-foreground tracking-tighter">
                {(data.shiftUtilization * 100).toFixed(0)}
              </span>
              <span className="text-xl font-black text-sky-400 italic">%</span>
            </div>
            <div className="mt-6 flex items-center gap-2 relative z-10">
              <div className="flex-1 h-2 bg-secondary/40 rounded-full overflow-hidden border border-border p-[1px] shadow-inner">
                <div
                  className="h-full bg-sky-400 rounded-full shadow-[0_0_10px_rgba(56,189,248,0.4)]"
                  style={{ width: `${data.shiftUtilization * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="group/tile relative bg-card backdrop-blur-3xl p-8 rounded-2xl border border-border hover:bg-card hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 shadow-xl overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-destructive/10 rounded-full blur-2xl group-hover:scale-150 transition-all duration-700" />
            <AlertCircle className="absolute top-8 right-8 w-6 h-6 text-muted-foreground group-hover/tile:text-destructive transition-colors duration-500" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-4 italic">
              Workforce Alerts
            </p>
            <div className="flex items-baseline gap-2 relative z-10">
              <span className="text-3xl font-black italic text-foreground tracking-tighter">
                0
              </span>
              <span className="text-xl font-black text-destructive italic uppercase tracking-tighter leading-none">
                CRIT
              </span>
            </div>
            <div className="mt-6 flex items-center gap-3 relative z-10 px-4 py-1.5 rounded-xl bg-success/10 border border-success/20 w-fit shadow-lg">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="text-[9px] font-black text-success uppercase tracking-widest italic">
                Nominal
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
