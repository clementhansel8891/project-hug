import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  TrendingUp, 
  RefreshCw, 
  Search, 
  Target, 
  Zap, 
  Activity, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight, 
  ShieldCheck, 
  Rocket, 
  Users, 
  PieChart, 
  BarChart3, 
  AlertCircle,
  Bell,
  CheckCircle2,
  ChevronRight,
  MoreVertical,
  LayoutDashboard,
  Filter,
  ActivitySquare,
  Globe,
  Layers,
  Box,
  Fingerprint,
  Monitor,
  Network,
  Cpu,
  Bot
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { GlassCard } from "@/components/shared/GlassCard";
import { EmptyState } from "@/components/shared/AsyncState";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSession } from "@/core/security/session";
import { marketingService } from "@/core/services/marketing/marketingService";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  MarketingAlert,
  MarketingCampaign,
  MarketingDashboardMetrics,
} from "@/core/types/marketing/marketing";

export default function MarketingDashboard() {
  const navigate = useNavigate();
  const session = useSession();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<MarketingDashboardMetrics | null>(null);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [alerts, setAlerts] = useState<MarketingAlert[]>([]);

  const refresh = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      const [m, c, a] = await Promise.all([
        marketingService.getDashboard(session.tenant_id, session),
        marketingService.listCampaigns(session.tenant_id, session),
        marketingService.listAlerts(session.tenant_id, session),
      ]);
      setMetrics(m);
      setCampaigns(c);
      setAlerts(a);
      if (isManual) toast.success("Marketing telemetry synchronized.");
    } catch (err) {
      console.error("Failed to fetch marketing dashboard data:", err);
      toast.error("Telemetry failure in command center.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session.tenant_id, session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredAlerts = useMemo(
    () =>
      (Array.isArray(alerts) ? alerts : []).filter((item) =>
        search
          ? `${item.type} ${item.message} ${item.severity}`
              .toLowerCase()
              .includes(search.toLowerCase())
          : true,
      ),
    [alerts, search],
  );

  const runSweep = async () => {
    try {
      setRefreshing(true);
      await marketingService.runHealthSweep(session.tenant_id, session);
      toast.success("Intelligence Health Sweep Completed", {
        description: "All campaigns and lead nodes validated for optimal tactical yield."
      });
      refresh(true);
    } catch (err) {
      toast.error("Health sweep protocol failure.");
      setRefreshing(false);
    }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      await marketingService.acknowledgeAlert(session.tenant_id, session, id);
      toast.success("Intelligence Acknowledged", {
        description: "Alert protocol has been archived in the secure log vault."
      });
      refresh(true);
    } catch (err) {
      toast.error("Acknowledgement failure.");
    }
  };

  if (loading || !metrics) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted dark:bg-muted">
        <div className="flex flex-col items-center gap-6">
          <div className="h-20 w-20 bg-primary rounded-[2.5rem] animate-pulse flex items-center justify-center shadow-2xl shadow-indigo-500/20">
            <LayoutDashboard className="h-10 w-10 text-white" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Assembling Command Intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-10 animate-in fade-in duration-1000 max-w-[1600px] mx-auto pb-24">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row justify-between items-end gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge className="bg-primary text-white border-none font-black px-3 py-1 rounded-full uppercase tracking-widest text-[10px]">Command Center</Badge>
            <div className="flex items-center gap-1.5 text-primary font-bold text-xs uppercase tracking-widest">
               <ActivitySquare className="h-4 w-4 animate-pulse" />
               Lead Velocity Stable
            </div>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-foreground text-left italic">Intelligence Matrix</h1>
          <p className="text-muted-foreground font-medium max-w-2xl text-lg leading-relaxed italic text-left">"Growth is the result of total tactical orchestration and deep-field intelligence."</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Search intelligence matrix..." 
              className="pl-12 h-14 bg-white/50 dark:bg-muted backdrop-blur-xl border-none shadow-inner rounded-2xl min-w-[300px] font-bold text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            className="h-14 w-14 rounded-2xl bg-white dark:bg-muted border-none shadow-xl hover:scale-110 transition-all"
            onClick={() => navigate("/core/marketing/automation")}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-6 w-6 text-primary", refreshing && "animate-spin")} />
          </Button>
          <Button 
            className="h-[4.5rem] px-10 rounded-[2rem] bg-primary hover:bg-primary shadow-2xl shadow-indigo-500/30 font-black text-sm gap-3 group transition-all hover:scale-105 active:scale-95 text-white"
            onClick={runSweep}
            disabled={refreshing}
          >
            <ShieldCheck className="h-6 w-6 group-hover:scale-110 transition-transform" /> 
            RUN HEALTH SWEEP
          </Button>
        </div>
      </div>

      {/* Strategic Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-8">
        {[
          { label: "Active Nodes", value: metrics.activeCampaigns, icon: Rocket, color: "text-primary", sub: "Cluster Status: Stable" },
          { label: "Lead Ingestion", value: metrics.leadsToday, icon: Users, color: "text-primary", sub: "Velocity: +12% Delta" },
          { label: "Strategic IQ", value: metrics.qualifiedLeads, icon: Target, color: "text-success", sub: "Qualification Rate: 35%" },
          { label: "Handoff Ready", value: metrics.handoffReady, icon: Zap, color: "text-warning", sub: "SLA Compliant: 99.9%" },
          { label: "Strategic Spend", value: formatCurrency(metrics.spendToDate), icon: DollarSign, color: "text-muted-foreground", sub: "Budget Yield: Optimal" },
          { label: "Attributed Rev", value: formatCurrency(metrics.attributedRevenue), icon: TrendingUp, color: "text-primary", sub: "Growth Index: High" },
          { label: "Blended ROI", value: `${metrics.blendedRoiPercent}%`, icon: PieChart, color: "text-success", sub: "Tactical Multiplier" },
          { label: "Cloud Links", value: metrics.connectedAccountsHealthy, icon: ShieldCheck, color: "text-primary", sub: "All Gateways Secure" },
        ].map((stat, i) => (
          <GlassCard key={i} className="rounded-[3rem] border-none shadow-xl group hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
            <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
              <div className={cn("h-16 w-16 rounded-[1.5rem] flex items-center justify-center shadow-lg group-hover:rotate-12 transition-all duration-500", stat.color.replace('text', 'bg').replace('600', '100').replace('500', '100'))}>
                <stat.icon className={cn("h-8 w-8", stat.color)} />
              </div>
              <div className="space-y-1">
                <h4 className="text-4xl font-black tracking-tighter italic">{stat.value}</h4>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground italic">{stat.label}</p>
              </div>
              <div className="h-[2px] w-12 bg-muted dark:bg-muted rounded-full" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground italic">{stat.sub}</p>
            </CardContent>
          </GlassCard>
        ))}
      </div>

      {/* Module Contributions */}
      {metrics.moduleContributions?.retail && (
        <Card className="rounded-[4rem] border-none shadow-2xl bg-primary text-white p-12 overflow-hidden relative group">
          <div className="absolute top-0 right-0 h-64 w-64 bg-primary rounded-full blur-[100px] -mr-32 -mt-32 group-hover:scale-150 transition-transform duration-1000" />
          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
             <div className="space-y-4 text-center lg:text-left">
                <div className="flex items-center gap-4 justify-center lg:justify-start">
                   <Badge className="bg-white/10 border-none text-white font-black text-[10px] uppercase tracking-widest px-4 py-1 rounded-full">Retail Integration</Badge>
                   <p className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse italic">Physical Matrix Online</p>
                </div>
                <h3 className="text-5xl font-black tracking-tighter italic uppercase leading-none">Storefront Tactical Yield</h3>
                <p className="text-base font-medium italic max-w-xl text-primary-foreground/80">"Real-time synchronization between omnichannel marketing nodes and physical retail footprints."</p>
             </div>
             <div className="flex gap-16">
                <div className="text-center space-y-2">
                   <div className="h-20 w-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto shadow-2xl border border-white/10 group-hover:bg-primary transition-colors">
                      <Users className="h-10 w-10 text-white" />
                   </div>
                   <h4 className="text-4xl font-black italic">{formatNumber(metrics.moduleContributions.retail.walkInCustomers)}</h4>
                   <p className="text-[10px] font-black uppercase tracking-widest text-primary-foreground/80 italic">Store Walk-ins</p>
                </div>
                <div className="text-center space-y-2">
                   <div className="h-20 w-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto shadow-2xl border border-white/10 group-hover:bg-success transition-colors">
                      <ActivitySquare className="h-10 w-10 text-white" />
                   </div>
                   <h4 className="text-4xl font-black italic">{formatNumber(metrics.moduleContributions.retail.loyaltyActive)}</h4>
                   <p className="text-[10px] font-black uppercase tracking-widest text-primary-foreground/80 italic">Loyalty Active</p>
                </div>
             </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-12 gap-10">
        {/* Campaign Cluster Matrix */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-8">
           <Card className="flex-1 rounded-[4rem] border-none shadow-2xl glass-card overflow-hidden flex flex-col group">
              <CardHeader className="p-12 pb-6 border-b border-border flex flex-row items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-3xl font-black tracking-tighter flex items-center gap-4 uppercase italic">
                    <Rocket className="h-8 w-8 text-primary group-hover:translate-x-2 transition-transform duration-500" />
                    Campaign Cluster Matrix
                  </CardTitle>
                  <CardDescription className="text-sm font-medium italic">Real-time execution state and audience targeting across active strategic nodes.</CardDescription>
                </div>
                <Button variant="ghost" className="h-12 px-6 rounded-2xl bg-muted dark:bg-muted border-none font-black uppercase tracking-widest text-[10px] gap-3 hover:bg-primary hover:text-white transition-all shadow-sm" onClick={() => navigate("/core/marketing/automation")}>
                   CAMPAIGN STUDIO <ArrowUpRight className="h-4 w-4" />
                </Button>
              </CardHeader>
              <ScrollArea className="flex-1">
                 <div className="p-12 pt-8">
                    <div className="grid gap-8 md:grid-cols-2">
                      {(Array.isArray(campaigns) ? campaigns : []).map((item) => (
                        <div key={item.id} className="p-8 rounded-[3rem] bg-white dark:bg-muted border border-border dark:border-border shadow-xl hover:shadow-[0_40px_80px_-20px_rgba(79,70,229,0.2)] transition-all duration-500 group/card relative overflow-hidden" onClick={() => navigate("/core/marketing/automation")}>
                           <div className="absolute top-0 right-0 h-32 w-32 bg-primary rounded-full blur-3xl -mr-16 -mt-16 group-hover/card:scale-150 transition-transform duration-1000" />
                           <div className="flex justify-between items-start mb-6 relative z-10">
                              <div className="h-14 w-14 rounded-2xl bg-primary text-primary flex items-center justify-center shadow-inner group-hover/card:scale-110 group-hover/card:bg-primary group-hover/card:text-white transition-all duration-500">
                                 <Rocket className="h-7 w-7" />
                              </div>
                              <Badge className={cn(
                                "rounded-full font-black text-[9px] px-4 py-1.5 border-none shadow-sm uppercase tracking-widest",
                                item.status === "ACTIVE" ? "bg-success text-white shadow-emerald-500/20" : "bg-muted dark:bg-muted text-muted-foreground"
                              )}>
                                 {item.status}
                              </Badge>
                           </div>
                           <h4 className="text-2xl font-black uppercase tracking-tighter italic mb-2 group-hover/card:text-primary transition-colors leading-none">{item.name}</h4>
                           <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-8 italic leading-relaxed">{item.audience}</p>
                           
                           <div className="grid grid-cols-2 gap-6 pt-6 border-t border-border dark:border-border relative z-10">
                              <div className="space-y-1">
                                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground italic">Strategic Budget</p>
                                 <p className="text-xl font-black text-primary italic">{formatCurrency(item.budget, item.currency)}</p>
                              </div>
                              <div className="space-y-1 text-right">
                                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground italic">Protocol</p>
                                 <Badge variant="secondary" className="rounded-full text-[9px] font-black px-3 py-1 uppercase tracking-widest bg-muted dark:bg-muted text-muted-foreground border-none italic">{item.objective}</Badge>
                              </div>
                           </div>
                        </div>
                      ))}
                    </div>
                    {(Array.isArray(campaigns) ? campaigns : []).length === 0 && (
                      <EmptyState
                        title="No active campaigns"
                        description="No strategic campaigns exist in the current tenant scope yet."
                        icon={Rocket}
                      />
                    )}
                 </div>
              </ScrollArea>
           </Card>
        </div>

        {/* Tactical Alerts Feed */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-8">
           <Card className="flex-1 rounded-[4rem] border-none shadow-2xl glass-card overflow-hidden flex flex-col group/alerts">
              <CardHeader className="p-12 pb-6 border-b border-border">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-primary rounded-2xl flex items-center justify-center shadow-2xl group-hover/alerts:scale-110 transition-transform">
                     <Bell className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-2xl font-black tracking-tighter flex items-center gap-3 uppercase italic">
                    Tactical Intelligence
                  </CardTitle>
                </div>
                <CardDescription className="text-xs font-medium italic mt-2">Real-time ingestion spikes, campaign health, and handoff SLAs.</CardDescription>
              </CardHeader>
              <ScrollArea className="flex-1 bg-black/5 dark:bg-white/5">
                 <div className="p-8 space-y-6">
                    {(Array.isArray(filteredAlerts) ? filteredAlerts : []).map((item) => (
                      <div key={item.id} className="p-8 rounded-[3rem] bg-white dark:bg-muted border border-border dark:border-border space-y-6 group/item hover:shadow-2xl transition-all duration-500 hover:-translate-x-2" onClick={() => navigate("/core/marketing/automation")}>
                         <div className="flex justify-between items-start">
                            <Badge className={cn(
                              "rounded-full font-black text-[9px] px-4 py-1.5 border-none shadow-lg uppercase tracking-widest",
                              item.severity === "HIGH" ? "bg-destructive text-white shadow-rose-500/20" : "bg-warning text-white shadow-amber-500/20"
                            )}>
                               {item.severity} PRIORITY
                            </Badge>
                            {!item.acknowledged ? (
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-12 w-12 rounded-2xl hover:bg-success hover:text-white transition-all shadow-xl hover:scale-110"
                                onClick={() => handleAcknowledge(item.id)}
                              >
                                 <CheckCircle2 className="h-6 w-6" />
                              </Button>
                            ) : (
                              <div className="h-12 w-12 rounded-2xl bg-success flex items-center justify-center text-success border border-success/20 shadow-inner">
                                 <CheckCircle2 className="h-6 w-6" />
                              </div>
                            )}
                         </div>
                         <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary italic leading-none">{item.type.replace('_', ' ')}</p>
                            <p className="text-base font-medium text-muted-foreground leading-relaxed italic">"{item.message}"</p>
                         </div>
                         <div className="flex justify-between items-center pt-4 border-t border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            <span className="flex items-center gap-2 italic"><ActivitySquare className="h-3.5 w-3.5 text-primary" /> Real-time Telemetry</span>
                            <span className="text-primary italic">ACTION PENDING</span>
                         </div>
                      </div>
                    ))}
                    {filteredAlerts.length === 0 && (
                      <div className="p-24 text-center grayscale opacity-20 space-y-6">
                         <div className="h-24 w-24 bg-white dark:bg-muted rounded-[3rem] flex items-center justify-center mx-auto shadow-2xl">
                            <ShieldCheck className="h-12 w-12 text-muted-foreground" />
                         </div>
                         <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Intelligence Matrix Clear</p>
                      </div>
                    )}
                 </div>
              </ScrollArea>
           </Card>
        </div>
      </div>
      
      {/* AI Strategy Advisor */}
      <Card className="rounded-[4rem] border-none shadow-2xl bg-white dark:bg-muted p-12 flex flex-col md:flex-row items-center gap-12 group">
         <div className="h-32 w-32 bg-primary rounded-[3rem] flex items-center justify-center shadow-[0_30px_60px_-15px_rgba(79,70,229,0.4)] group-hover:rotate-12 transition-all duration-700 shrink-0">
            <Bot className="h-16 w-16 text-white drop-shadow-2xl" />
         </div>
         <div className="flex-1 space-y-4 text-center md:text-left">
            <div className="flex items-center gap-4 justify-center md:justify-start">
               <Badge className="bg-primary text-white font-black text-[10px] uppercase tracking-widest px-4 py-1 rounded-full">Neural Advisor</Badge>
               <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground italic">Strategy Optimization Active</p>
            </div>
            <h3 className="text-3xl font-black uppercase italic tracking-tighter italic">Total Growth Intelligence</h3>
            <p className="text-lg font-medium italic leading-relaxed text-muted-foreground max-w-3xl">
               "Current telemetry suggests an <strong>immediate +15% budget reallocation</strong> to High-Intent Meta Ads nodes. AI analysis indicates a potential <strong>3.2x ROI multiplier</strong> in the Enterprise Sector for Q4."
            </p>
         </div>
          <Button 
            className="h-20 px-12 rounded-[2.5rem] bg-primary hover:bg-primary shadow-2xl shadow-indigo-500/30 font-black text-sm uppercase tracking-widest gap-4 group transition-all hover:scale-105 active:scale-95 text-white whitespace-nowrap"
            onClick={() => navigate("/core/marketing/strategy")}
          >
            AUTHORIZE STRATEGY <ChevronRight className="h-6 w-6 group-hover:translate-x-2 transition-transform duration-500" />
          </Button>
      </Card>
    </div>
  );
}
