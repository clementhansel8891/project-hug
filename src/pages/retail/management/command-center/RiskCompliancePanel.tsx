import React from "react";
import { RiskCompliance as IRiskCompliance } from "@/core/types/retail/analytics";
import {
  ShieldAlert,
  Fingerprint,
  Banknote,
  ShieldCheck,
  AlertTriangle,
  Search,
} from "lucide-react";

interface RiskCompliancePanelProps {
  data: IRiskCompliance;
}

export const RiskCompliancePanel: React.FC<RiskCompliancePanelProps> = ({
  data,
}) => {
  return (
    <div className="bg-card backdrop-blur-3xl p-6 rounded-[2rem] border border-border shadow-2xl hover:bg-card hover:-translate-y-1 transition-all duration-700 group h-full flex flex-col relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-destructive/10 rounded-full blur-[130px] -mr-[15%] -mt-[15%] pointer-events-none" />

      <div className="flex items-center justify-between mb-10 relative z-10">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground italic">
          Risk & Compliance Matrix
        </h3>
        <ShieldCheck className="w-6 h-6 text-muted-foreground group-hover:text-destructive transition-colors" />
      </div>

      <div className="flex-1 space-y-12 relative z-10">
        {/* Suspicious Activity Feed */}
        <div className="p-8 rounded-2xl bg-destructive/10 border border-destructive/20 relative overflow-hidden group/alertfeed shadow-xl">
          <div className="absolute top-0 right-0 w-48 h-48 bg-destructive/20 blur-[80px] -mr-24 -mt-24 group-hover/alertfeed:scale-150 transition-all duration-1000" />

          <div className="flex items-center justify-between mb-8 relative z-10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-destructive/20 rounded-2xl border border-destructive/30 shadow-lg">
                <ShieldAlert className="w-6 h-6 text-destructive" />
              </div>
              <p className="text-[12px] font-black uppercase tracking-widest text-foreground italic">
                Active Anomalies
              </p>
            </div>
            <span className="flex items-center gap-2 px-5 py-2 rounded-xl bg-destructive text-[10px] font-black text-foreground animate-pulse shadow-lg tracking-widest italic">
              LIVE MONITOR
            </span>
          </div>

          <div className="space-y-5">
            {(data.suspiciousTransactions || []).map((tx, idx) => (
              <div
                key={idx}
                className="group/alert flex items-start gap-6 p-6 rounded-2xl bg-card border border-border hover:border-warning/30 hover:bg-card hover:shadow-2xl transition-all duration-500 cursor-default shadow-xl"
              >
                <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center group-hover/alert:scale-110 group-hover/alert:text-warning transition-all border border-border shadow-inner">
                  <AlertTriangle className="w-7 h-7 opacity-30 group-hover/alert:opacity-100 transition-opacity" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-lg font-black italic text-foreground group-hover/alert:text-warning transition-colors truncate tracking-tighter">
                      {tx.type}
                    </p>
                    <p className="text-xl font-black text-destructive ml-4 whitespace-nowrap tracking-tighter shadow-sm">
                      Rp {(tx.amount / 1000).toFixed(0)}k
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground italic">
                      ID: <span className="opacity-60">{tx.id}</span>
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover/alert:text-warning transition-colors italic">
                      {tx.time}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {(!data.suspiciousTransactions ||
              data.suspiciousTransactions.length === 0) && (
              <div className="py-12 text-center bg-card rounded-2xl border border-dashed border-border">
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground italic">
                  Zero threats detected in active stream
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Oversight Metrics */}
        <div className="grid grid-cols-2 gap-8 pt-4">
          <div className="group/metric p-8 rounded-2xl bg-card border border-border hover:bg-card hover:border-warning/30 hover:shadow-3xl transition-all duration-500 shadow-xl relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-warning rounded-full blur-2xl group-hover:scale-150 transition-all duration-700" />
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-secondary/40 rounded-2xl border border-border group-hover/metric:bg-warning group-hover/metric:text-foreground transition-all duration-500 shadow-inner">
                <Fingerprint className="w-5 h-5 text-muted-foreground group-hover/metric:text-foreground transition-colors" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground leading-none italic">
                Manual Overrides
              </span>
            </div>
            <div className="flex items-baseline gap-3 relative z-10">
              <p className="text-3xl font-black italic text-foreground tracking-tighter">
                {data.manualOverrides.length}
              </p>
              <span className="text-xl font-black text-muted-foreground italic uppercase tracking-tighter">
                Logs
              </span>
            </div>
          </div>

          <div className="group/metric p-8 rounded-2xl bg-card border border-border hover:bg-card hover:border-success/30 hover:shadow-3xl transition-all duration-500 shadow-xl flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-success/5 rounded-full blur-2xl group-hover:scale-150 transition-all duration-700" />
            <div className="flex items-center justify-center gap-4 mb-6 relative z-10">
              <Banknote className="w-5 h-5 text-muted-foreground group-hover/metric:text-success transition-colors" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground leading-none italic">
                Compliance Status
              </span>
            </div>
            <div className="flex-1 flex flex-col justify-center relative z-10">
              <div className="flex items-center justify-center gap-3 px-6 py-2.5 rounded-xl bg-success/10 text-[11px] font-black text-success uppercase tracking-widest border border-success/20 shadow-xl shadow-emerald-500/5 animate-pulse italic">
                <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                SLA NOMINAL
              </div>
              <p className="mt-4 text-[9px] font-black text-muted-foreground uppercase tracking-[0.3em] italic">
                Audit Finalized
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
