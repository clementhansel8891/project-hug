import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  TrendingUp, 
  Users, 
  Target, 
  Clock, 
  AlertCircle, 
  DollarSign, 
  ShieldCheck, 
  Zap,
  ArrowUpRight,
  Search,
  RefreshCw,
  BarChart3,
  Calendar,
  MessageSquare,
  Activity,
  ChevronRight,
  CheckCircle2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { GlassCard } from "@/components/shared/GlassCard";
import { EmptyState } from "@/components/shared/AsyncState";
import { useSession } from "@/core/security/session";
import { salesService } from "@/core/services/sales/salesService";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import type {
  SalesDashboardMetrics,
  SalesNextAction,
  SalesLead,
} from "@/core/types/sales/sales";

export default function SalesDashboard() {
  const navigate = useNavigate();
  const session = useSession();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<SalesDashboardMetrics | null>(null);
  const [nextActions, setNextActions] = useState<SalesNextAction[]>([]);
  const [leads, setLeads] = useState<SalesLead[]>([]);

  const refresh = useCallback(async (isManual = false) => {
    try {
      console.log(`[SalesDashboard] Refresh Triggered (manual=${isManual})`, {
        tenant_id: session.tenant_id,
        role: session.role,
      });

      if (isManual) setRefreshing(true);
      else setLoading(true);
      
      const [m, n, l] = await Promise.all([
        salesService.getDashboard(session.tenant_id, session),
        salesService.getNextBestActions(session.tenant_id, session),
        salesService.listLeads(session.tenant_id, session),
      ]);
      setMetrics(m);
      setNextActions(n);
      setLeads(
        (Array.isArray(l) ? l : []).filter((item) =>
          ["NEW", "ASSIGNED", "CONTACTED", "QUALIFIED"].includes(item.status),
        ),
      );
      if (isManual) toast.success("Command center synchronized.");
    } catch (err) {
      console.error("[SalesDashboard] Telemetry failure:", err);
      toast.error("Telemetry failure. Check neural link.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session.tenant_id, session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredLeads = useMemo(
    () =>
      (Array.isArray(leads) ? leads : []).filter((item) =>
        search
          ? `${item.companyName} ${item.contactName} ${item.ownerName}`
              .toLowerCase()
              .includes(search.toLowerCase())
          : true,
      ),
    [leads, search],
  );

  if (loading || !metrics) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted dark:bg-muted">
        <div className="flex flex-col items-center gap-6">
          <div className="h-20 w-20 bg-primary rounded-[2.5rem] animate-bounce flex items-center justify-center shadow-2xl shadow-indigo-500/20">
            <Zap className="h-10 w-10 text-white fill-white" />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground">Syncing Command Center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-10 animate-in fade-in duration-1000 max-w-[1600px] mx-auto">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row justify-between items-end gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge className="bg-primary text-white border-none font-black px-3 py-1 rounded-full shadow-lg shadow-indigo-500/20">LIVE TELEMETRY</Badge>
            <div className="flex items-center gap-1.5 text-success font-bold text-xs uppercase tracking-widest">
               <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
               Operational
            </div>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-foreground">Sales Command</h1>
          <p className="text-muted-foreground font-medium max-w-2xl text-lg leading-relaxed italic">"The art of war is of vital importance to the State. In sales, it is the art of the deal." — Neural Strategist.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white/50 dark:bg-muted backdrop-blur-xl p-2 rounded-[2rem] border border-border dark:border-border/20 shadow-2xl">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-11 h-14 w-[300px] rounded-[1.5rem] bg-transparent border-none focus-visible:ring-0 text-base font-medium"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search leads..."
            />
          </div>
          <Button
            variant="secondary"
            className="h-14 w-14 rounded-[1.5rem] bg-primary text-white hover:bg-primary transition-all shadow-xl shadow-indigo-500/20"
            onClick={() => refresh(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-6 w-6", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* High-Impact Metrics Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Active Pipeline", value: formatCurrency(metrics.pipelineValue), sub: "GROSS NOMINAL VALUE", icon: DollarSign, color: "indigo" },
          { label: "Weighted Forecast", value: formatCurrency(metrics.weightedPipelineValue), sub: "ADJUSTED PROBABILITY", icon: TrendingUp, color: "emerald" },
          { label: "Open Leads", value: metrics.openLeads, sub: "UNQUALIFIED DEMAND", icon: Users, color: "blue" },
          { label: "SLA Pressure", value: metrics.slaDueToday, sub: "DUE WITHIN 24H", icon: Clock, color: "rose" },
        ].map((stat, i) => (
          <Card key={i} className="group relative overflow-hidden rounded-[2.5rem] border-none bg-white dark:bg-muted shadow-xl transition-all duration-500 hover:shadow-2xl hover:-translate-y-1">
            <div className={cn("absolute top-0 right-0 h-32 w-32 -mr-8 -mt-8 rounded-full blur-3xl opacity-10", `bg-${stat.color}-500`)} />
            <CardContent className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center shadow-inner", `bg-${stat.color}-500/10`)}>
                  <stat.icon className={cn("h-7 w-7", `text-${stat.color}-500`)} />
                </div>
                <Badge variant="outline" className="rounded-full font-black text-[9px] px-2 py-0.5 border-border uppercase tracking-widest">+4.2%</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{stat.sub}</p>
                <h3 className="text-4xl font-black tracking-tighter">{stat.value}</h3>
                <p className="text-xs font-bold text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Main Content Area */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          {/* Today's Priority Queue */}
          <GlassCard className="rounded-[3rem] border-none shadow-2xl overflow-hidden">
            <CardHeader className="p-10 pb-6 border-b border-border dark:border-border/20">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                    <Activity className="h-6 w-6 text-primary" />
                    High-Priority Lead Queue
                  </CardTitle>
                  <CardDescription className="text-sm font-medium">SLA-aware lead pool requiring immediate executive engagement.</CardDescription>
                </div>
                <Button variant="outline" className="rounded-2xl h-12 font-black text-xs gap-2 border-border hover:bg-white" onClick={async () => {
                   await salesService.runSlaSweep(session.tenant_id, session);
                   refresh(true);
                }}>
                  <ShieldCheck className="h-4 w-4 text-success" /> RUN SLA SWEEP
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted dark:bg-muted">
                    <tr>
                      <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">Company Protocol</th>
                      <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">Owner</th>
                      <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">Risk Level</th>
                      <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">SLA Expiry</th>
                      <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border dark:divide-slate-800/10">
                    {filteredLeads.slice(0, 6).map((item) => (
                      <tr key={item.id} className="group hover:bg-white/40 dark:hover:bg-muted transition-colors">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-muted dark:bg-muted flex items-center justify-center font-black text-xs shadow-sm">
                              {item.companyName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-black text-sm">{item.companyName}</p>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">{item.contactName}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-2">
                             <div className="h-2 w-2 rounded-full bg-primary" />
                             <span className="text-xs font-bold text-muted-foreground dark:text-muted-foreground">{item.ownerName}</span>
                           </div>
                        </td>
                        <td className="px-8 py-6">
                          <Badge 
                            variant={item.priority === "URGENT" || item.priority === "HIGH" ? "destructive" : "secondary"}
                            className="rounded-full font-black text-[9px] px-3 py-1 border-none shadow-sm uppercase tracking-widest"
                          >
                            {item.priority}
                          </Badge>
                        </td>
                        <td className="px-8 py-6">
                          <div className="space-y-1">
                             <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                               <Calendar className="h-3 w-3" />
                               {item.slaDueAt ? formatDate(item.slaDueAt) : "TBD"}
                             </div>
                             <div className="h-1 w-20 bg-muted dark:bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary w-2/3" />
                             </div>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                           <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-primary hover:text-white transition-all">
                              <ChevronRight className="h-5 w-5" />
                           </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredLeads.length === 0 && (
                <EmptyState
                  title="No leads in queue"
                  description="No high-priority leads match the current scope. New qualified demand will surface here."
                  className="m-8"
                />
              )}
              <div className="p-8 border-t border-border dark:border-border/20 text-center">
                 <Button variant="link" className="text-primary font-black uppercase tracking-widest text-[10px] h-auto p-0 gap-2">
                    Access Complete Lead Registry <ArrowUpRight className="h-4 w-4" />
                 </Button>
              </div>
            </CardContent>
          </GlassCard>
        </div>

        {/* Sidebar Actions */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          {/* AI Advisor Panel */}
          <Card className="rounded-[3rem] border-none shadow-2xl bg-primary shadow-indigo-600/30 text-white overflow-hidden group">
            <div className="absolute top-0 right-0 h-40 w-40 -mr-10 -mt-10 bg-white/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
            <CardHeader className="p-10 pb-6">
               <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-border">
                     <Zap className="h-6 w-6 text-white fill-white" />
                  </div>
                  <CardTitle className="text-xl font-black tracking-tight">Neural Sales Advisor</CardTitle>
               </div>
               <CardDescription className="text-white/70 font-medium">Real-time predictive analytics and next-best-action orchestration.</CardDescription>
            </CardHeader>
            <CardContent className="px-10 pb-10 space-y-6">
              {(Array.isArray(nextActions) ? nextActions : []).map((item) => (
                <div key={item.id} className="relative p-5 rounded-3xl bg-white/10 backdrop-blur-xl border border-border space-y-4 hover:bg-white/20 transition-all cursor-pointer">
                  <div className="flex justify-between items-start">
                    <Badge className="bg-white text-primary border-none font-black text-[9px] px-2 py-0.5 rounded-full">{item.priority}</Badge>
                    <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                       <CheckCircle2 className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="font-black text-sm leading-tight">{item.title}</p>
                    <p className="text-[11px] font-medium text-white/60 leading-relaxed italic line-clamp-2">"{item.detail}"</p>
                  </div>
                  <Button 
                    className="w-full bg-white text-primary hover:bg-primary font-black rounded-xl h-11 text-xs"
                    onClick={() => navigate("/core/sales/intelligence")}
                  >
                    EXECUTE RECOMMENDATION
                  </Button>
                </div>
              ))}
              
              <div className="pt-4 space-y-4">
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">System Intelligence</p>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <p className="text-2xl font-black">94%</p>
                       <p className="text-[9px] font-bold uppercase opacity-60">Confidence</p>
                    </div>
                    <div className="space-y-1">
                       <p className="text-2xl font-black">12.4m</p>
                       <p className="text-[9px] font-bold uppercase opacity-60">Avg Close</p>
                    </div>
                 </div>
              </div>
            </CardContent>
          </Card>

          {/* Activity Pulse */}
          <GlassCard className="rounded-[3rem] border-none shadow-2xl overflow-hidden">
            <CardHeader className="p-10 pb-6 border-b border-border dark:border-border/20">
               <CardTitle className="text-xl font-black tracking-tight flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Secondary KPI Pulse
               </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
               {[
                 { label: "Pending Approvals", value: metrics.pendingQuoteApprovals, icon: ShieldCheck, color: "blue" },
                 { label: "At-Risk Deals", value: metrics.dealRiskCount, icon: AlertCircle, color: "rose" },
                 { label: "Open Opps", value: metrics.openOpportunities, icon: Target, color: "indigo" },
               ].map((item, i) => (
                 <div key={i} className="flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                       <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-inner", `bg-${item.color}-500/10`)}>
                          <item.icon className={cn("h-6 w-6", `text-${item.color}-500`)} />
                       </div>
                       <div>
                          <p className="text-sm font-black text-foreground">{item.label}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Current Lifecycle Stat</p>
                       </div>
                    </div>
                    <span className="text-2xl font-black tracking-tighter">{item.value}</span>
                 </div>
               ))}
               
               <div className="pt-6 border-t border-border dark:border-border/20">
                  <div className="flex items-center gap-3 text-success mb-4">
                     <TrendingUp className="h-5 w-5" />
                     <span className="text-xs font-black uppercase tracking-widest">Growth Vector: Positive</span>
                  </div>
                  <div className="h-2 w-full bg-muted dark:bg-muted rounded-full overflow-hidden">
                     <div className="h-full bg-success w-[78%] rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  </div>
               </div>
            </CardContent>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
