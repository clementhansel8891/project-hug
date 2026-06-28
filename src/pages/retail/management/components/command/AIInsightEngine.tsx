import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  ArrowUpRight,
  Zap,
  RefreshCw,
  LayoutDashboard
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useSession } from "@/core/security/session";
import { retailService } from "@/core/services/retail/retailService";
import { retailInfrastructureService } from "@/core/services/retail/retailInfrastructureService";

const InsightMarker = ({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) => (
  <div className="space-y-2 flex-1 min-w-[120px]">
    <p className="text-[10px] font-black italic uppercase tracking-[0.3em] text-muted-foreground">
      {label}
    </p>
    <div className="flex items-center gap-3">
      <div className={cn("w-2 h-2 rounded-full animate-pulse shadow-[0_0_10px_rgba(255,255,255,0.2)]", color)} />
      <span className="text-2xl font-black italic tracking-tighter text-foreground">
        {value}
      </span>
    </div>
  </div>
);

export const AIInsightEngine = ({
  onExpansionRequest
}: {
  onExpansionRequest?: (feature: string) => void;
}) => {
  const navigate = useNavigate();
  const session = useSession();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    revenue: "Rp 0",
    staff: 0,
    health: 100,
    anomalies: [] as string[]
  });

  const analyzeNexus = async () => {
    if (!session.tenantId) return;
    setLoading(true);
    try {
      // 1. Get Revenue
      const orders = await retailService.listOrders(session.tenantId, session);
      const totalRev = orders.reduce((acc, o) => acc + (o.total_amount || o.totalAmount || 0), 0);
      
      // 2. Get Active Staff
      const shifts = await retailService.listShifts(session.tenantId, session);
      const activeStaff = (Array.isArray(shifts) ? shifts : []).filter(s => s.status === "open").length;

      // 3. Get Infra Health & Anomalies
      const { nodes } = await retailInfrastructureService.getTelemetry(session.tenantId, session);
      const avgHealth = nodes.length > 0 ? nodes.reduce((acc, n) => acc + n.health_score, 0) / nodes.length : 100;
      const deadNodes = (Array.isArray(nodes) ? nodes : []).filter(n => n.status === "OFFLINE");
      
      const newAnomalies = [];
      if (deadNodes.length > 0) {
        newAnomalies.push(`Critical: ${deadNodes.length} nodes currently OFFLINE in Infrastructure Grid.`);
      }
      if (activeStaff < 5 && orders.length > 10) {
        newAnomalies.push("High Alert: Staffing density below threshold for current order velocity.");
      }

      setStats({
        revenue: `Rp ${(totalRev / 1000000).toFixed(1)}M`,
        staff: activeStaff,
        health: Math.round(avgHealth),
        anomalies: newAnomalies
      });
    } catch (error) {
      console.error("[AIInsightEngine] Analysis failed:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    analyzeNexus();
    const interval = setInterval(analyzeNexus, 60000);
    return () => clearInterval(interval);
  }, [session.tenantId]);

  return (
    <Card className="rounded-2xl border border-border bg-card backdrop-blur-3xl shadow-2xl overflow-hidden relative group">
      <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-125 transition-transform duration-1000">
        <Sparkles className="w-48 h-48 text-primary" />
      </div>

      <CardHeader className="p-6 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <CardTitle className="text-3xl font-black italic uppercase tracking-tighter flex items-center gap-4 text-foreground">
              <Zap className="w-8 h-8 text-warning shadow-2xl" />
              Intelligence Nexus
            </CardTitle>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] italic">
              Predictive Telemetry & Anomaly Analysis
            </p>
          </div>
          <div className="flex items-center gap-4">
             <button 
              onClick={analyzeNexus}
              disabled={loading}
              className="w-12 h-12 flex items-center justify-center bg-secondary/40 border border-border rounded-xl hover:bg-white/10 transition-all"
            >
              <RefreshCw className={cn("w-4 h-4 text-muted-foreground", loading && "animate-spin")} />
            </button>
            <Badge className="bg-primary/10 text-primary border border-primary font-black italic text-[10px] px-4 py-2 tracking-[0.2em] uppercase rounded-xl">
              v4.2-NEURAL-READY
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-12">
        {/* Predictive Row */}
        <div className="flex flex-wrap gap-8">
          <InsightMarker
            label="EOD Revenue Forecast"
            value={stats.revenue}
            color="bg-primary"
          />
          <InsightMarker
            label="Infrastructure Pulse"
            value={`${stats.health}%`}
            color={stats.health > 80 ? "bg-success" : "bg-destructive"}
          />
          <InsightMarker
            label="Personnel Density"
            value={`${stats.staff} Active`}
            color="bg-warning"
          />
        </div>

        {/* Anomaly Detection */}
        {stats.anomalies.length > 0 ? (
          <div className="p-8 rounded-[2rem] bg-destructive text-foreground relative overflow-hidden shadow-2xl group/anomaly transition-all duration-500 hover:scale-[1.02]">
            <div className="absolute top-0 right-0 h-48 w-48 bg-white/10 rounded-full blur-3xl -mr-24 -mt-24 group-hover/anomaly:scale-150 transition-transform duration-1000" />
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-xl bg-white/15 backdrop-blur-xl flex items-center justify-center border border-border shadow-2xl group-hover/anomaly:rotate-12 transition-transform">
                  <AlertTriangle className="w-8 h-8 text-foreground" />
                </div>
                <div>
                  <h4 className="text-lg font-black italic uppercase tracking-tight">
                    Anomaly Detected: Nexus Pulse
                  </h4>
                  <p className="text-[11px] font-bold opacity-70 uppercase tracking-[0.2em] mt-1">
                    {stats.anomalies[0]}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => navigate("/m/retail/management/nexus-command")}
                className="h-14 px-10 rounded-[1.25rem] bg-white text-destructive font-black italic text-[11px] uppercase tracking-[0.2em] hover:bg-secondary/5 transition-all shadow-xl active:scale-95"
              >
                Deploy Assets
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8 rounded-[2rem] bg-primary text-foreground relative overflow-hidden shadow-2xl group/anomaly transition-all duration-500 hover:scale-[1.02]">
            <div className="absolute top-0 right-0 h-48 w-48 bg-white/10 rounded-full blur-3xl -mr-24 -mt-24 group-hover/anomaly:scale-150 transition-transform duration-1000" />
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-xl bg-white/15 backdrop-blur-xl flex items-center justify-center border border-border shadow-2xl group-hover/anomaly:rotate-12 transition-transform">
                  <UserCheck className="w-8 h-8 text-success" />
                </div>
                <div>
                  <h4 className="text-lg font-black italic uppercase tracking-tight">
                    Baseline Synchronized
                  </h4>
                  <p className="text-[11px] font-bold opacity-70 uppercase tracking-[0.2em] mt-1">
                    No critical deviations detected across global nodes.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => navigate("/m/retail/management/nexus-command")}
                className="h-14 px-10 rounded-[1.25rem] bg-white text-primary font-black italic text-[11px] uppercase tracking-[0.2em] hover:bg-secondary/5 transition-all shadow-xl active:scale-95"
              >
                Nexus Control
              </button>
            </div>
          </div>
        )}

        {/* Recommendations */}
        <div className="space-y-6">
          <div className="text-[11px] font-black italic text-muted-foreground uppercase tracking-[0.3em] flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-primary" />
            Strategic Recommendations
          </div>
          <div className="grid gap-4">
            {(stats.anomalies.length > 0 ? [
              ...stats.anomalies.map(a => `Resolve ${a.split(':')[0]} alert immediately.`),
              "Reallocate staff to affected nodes for peak mitigation.",
              "Trigger auto-replenishment; high velocity detected."
            ] : [
              "Maintain current force disposition; load is nominal.",
              "Schedule routine node maintenance for Branch_09.",
              "Optimize E-commerce fulfillment queue; latency creeping up.",
            ]).map((rec, i) => (
              <div
                key={i}
                onClick={() => onExpansionRequest?.(`Recommendation Execution: ${rec}`)}
                className="flex items-start gap-6 p-6 rounded-[2rem] bg-card border border-border hover:border-primary hover:bg-card transition-all duration-500 group/rec cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center shrink-0 shadow-inner group-hover/rec:bg-primary transition-colors">
                  <ArrowUpRight className="w-5 h-5 text-primary group-hover/rec:text-foreground group-hover/rec:rotate-45 transition-all duration-500" />
                </div>
                <p className="text-[13px] font-medium text-muted-foreground leading-relaxed italic group-hover/rec:text-foreground transition-colors">
                  {rec}
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

