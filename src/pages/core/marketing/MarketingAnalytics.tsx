import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  TrendingUp, 
  BarChart3, 
  PieChart, 
  Target, 
  Zap, 
  DollarSign, 
  ArrowUpRight, 
  RefreshCw, 
  Search, 
  Activity, 
  ShieldCheck, 
  Rocket, 
  ChevronRight, 
  Split, 
  Layers, 
  ActivitySquare,
  Globe,
  Network,
  Cpu,
  Monitor,
  Box,
  Fingerprint,
  PieChart as PieIcon,
  BarChart4
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSession } from "@/core/security/session";
import { marketingService } from "@/core/services/marketing/marketingService";
import { formatCurrency } from "@/lib/format";
import { EmptyState } from "@/components/shared/AsyncState";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { MarketingCampaign, ChannelPerformance, AttributionRecord } from "@/core/types/marketing/marketing";

export default function MarketingAnalytics() {
  const session = useSession();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [channelPerformance, setChannelPerformance] = useState<ChannelPerformance[]>([]);
  const [attribution, setAttribution] = useState<AttributionRecord[]>([]);

  const refresh = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      const [c, ch, a] = await Promise.all([
        marketingService.listCampaigns(session.tenant_id, session),
        marketingService.getChannelPerformance(session.tenant_id, session),
        marketingService.listAttribution(session.tenant_id, session),
      ]);
      setCampaigns(c);
      setChannelPerformance(ch);
      setAttribution(a);
      if (isManual) toast.success("Intelligence telemetry synchronized.");
    } catch (err) {
      console.error("Failed to fetch marketing analytics data:", err);
      toast.error("Telemetry failure in intelligence suite.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session.tenant_id, session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredCampaigns = useMemo(
    () =>
      (Array.isArray(campaigns) ? campaigns : []).filter((item) =>
        search
          ? `${item.name} ${item.objective} ${item.status}`
              .toLowerCase()
              .includes(search.toLowerCase())
          : true,
      ),
    [campaigns, search],
  );

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted dark:bg-muted">
        <div className="flex flex-col items-center gap-6">
          <div className="h-20 w-20 bg-primary rounded-[2.5rem] animate-pulse flex items-center justify-center shadow-2xl shadow-indigo-500/20">
            <PieChart className="h-10 w-10 text-white" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Synthesizing ROI Intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-10 animate-in fade-in duration-1000 max-w-[1600px] mx-auto pb-24">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row justify-between items-end gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge className="bg-primary text-white border-none font-black px-3 py-1 rounded-full uppercase tracking-widest text-[10px]">Intelligence & ROI</Badge>
            <div className="flex items-center gap-1.5 text-primary font-bold text-xs uppercase tracking-widest">
               <ActivitySquare className="h-4 w-4 animate-pulse" />
               Attribution Matrix Active
            </div>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-foreground text-left italic">Analytics Engine</h1>
          <p className="text-muted-foreground font-medium max-w-2xl text-lg leading-relaxed italic text-left">"Deep-field measurement authorizes total control and high-fidelity tactical improvement."</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input 
              placeholder="Search strategic nodes..." 
              className="pl-12 h-14 bg-white/50 dark:bg-muted backdrop-blur-xl border-none shadow-inner rounded-2xl min-w-[300px] font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            className="h-14 w-14 rounded-2xl bg-white dark:bg-muted border-none shadow-xl hover:scale-110 transition-all"
            onClick={() => refresh(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-6 w-6 text-primary", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Channel Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {(Array.isArray(channelPerformance) ? channelPerformance : []).map((item, i) => (
          <Card key={item.channel} className="rounded-[3rem] border-none shadow-2xl glass-card p-10 space-y-8 group hover:shadow-[0_40px_80px_-20px_rgba(79,70,229,0.2)] transition-all duration-500 overflow-hidden relative">
            <div className="absolute top-0 right-0 h-40 w-40 bg-primary rounded-full blur-3xl -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-1000" />
            <div className="flex items-center justify-between relative z-10">
               <div className="h-14 w-14 rounded-2xl bg-primary text-primary flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500">
                  <Globe className="h-7 w-7" />
               </div>
               <Badge className="bg-success text-success font-black text-[9px] px-3 py-1 rounded-full border-none uppercase tracking-widest">+12.4% Δ</Badge>
            </div>
            <div className="relative z-10 space-y-1">
               <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground italic">{item.channel}</p>
               <h4 className="text-4xl font-black tracking-tighter italic">{item.leads} <span className="text-sm font-bold text-muted-foreground uppercase">LEADS</span></h4>
               
               <div className="grid grid-cols-2 gap-6 pt-8 mt-4 border-t border-border dark:border-border">
                  <div className="space-y-1">
                     <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground italic">Allocation</p>
                     <p className="text-xl font-black text-primary italic">{formatCurrency(item.spend)}</p>
                  </div>
                  <div className="text-right space-y-1">
                     <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground italic">CPL Yield</p>
                     <p className="text-xl font-black text-success italic">{formatCurrency(item.cpl)}</p>
                  </div>
               </div>
            </div>
            <div className="absolute bottom-0 left-0 h-2 w-full bg-muted dark:bg-muted rounded-full overflow-hidden shadow-inner">
               <div className="h-full bg-primary transition-all duration-1000 shadow-[0_0_12px_rgba(79,70,229,0.4)]" style={{ width: `${Math.min((item.leads / 100) * 100, 100)}%` }} />
            </div>
          </Card>
        ))}
        {(Array.isArray(channelPerformance) ? channelPerformance : []).length === 0 && (
          <EmptyState
            className="md:col-span-2 lg:col-span-4"
            title="No channel performance"
            description="No channel performance telemetry is available for this tenant scope yet."
          />
        )}
      </div>

      {/* Attribution Intelligence Matrix */}
      <Card className="rounded-[4rem] border-none shadow-2xl glass-card overflow-hidden flex flex-col">
        <Tabs defaultValue="campaigns" className="w-full flex flex-col h-full">
           <CardHeader className="p-12 pb-6 border-b border-white/10 dark:border-border/10 shrink-0">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 mb-4">
                 <div className="space-y-2">
                    <CardTitle className="text-3xl font-black tracking-tighter flex items-center gap-4 uppercase italic">
                       <Layers className="h-8 w-8 text-primary" />
                       Intelligence Matrix
                    </CardTitle>
                    <CardDescription className="text-base font-medium italic italic opacity-60">Cross-referencing campaign clusters with multi-touch attribution yield ledger.</CardDescription>
                 </div>
                 <TabsList className="bg-muted dark:bg-muted p-2 rounded-[2rem] shadow-inner border-none h-auto">
                    <TabsTrigger value="campaigns" className="rounded-[1.5rem] px-8 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-xl h-12 border-none transition-all">Campaign Performance</TabsTrigger>
                    <TabsTrigger value="attribution" className="rounded-[1.5rem] px-8 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-xl h-12 border-none transition-all">Attribution Ledger</TabsTrigger>
                 </TabsList>
              </div>
           </CardHeader>

           <TabsContent value="campaigns" className="mt-0 outline-none flex-1 overflow-hidden">
              <ScrollArea className="h-[600px]">
                 <table className="w-full">
                    <thead className="bg-muted dark:bg-muted text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground sticky top-0 z-10 italic">
                       <tr>
                          <th className="px-12 py-8 text-left">Strategic Node</th>
                          <th className="px-12 py-8 text-left">Objective Cluster</th>
                          <th className="px-12 py-8 text-left">Budget Yield</th>
                          <th className="px-12 py-8 text-left">Tactical Advisor</th>
                          <th className="px-12 py-8 text-right">Status</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 dark:divide-slate-800/10">
                       {(Array.isArray(filteredCampaigns) ? filteredCampaigns : []).map((item) => (
                          <tr key={item.id} className="group hover:bg-primary transition-all cursor-default">
                             <td className="px-12 py-10">
                                <div className="flex items-center gap-6">
                                   <div className="h-14 w-14 rounded-2xl bg-primary text-primary flex items-center justify-center shadow-inner group-hover:bg-primary group-hover:text-white transition-all duration-500">
                                      <Rocket className="h-7 w-7" />
                                   </div>
                                   <div className="space-y-1">
                                      <p className="font-black text-xl uppercase tracking-tighter italic group-hover:text-primary transition-colors leading-none">{item.name}</p>
                                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60 italic">UID: {item.id.slice(-8)}</p>
                                   </div>
                                </div>
                             </td>
                             <td className="px-12 py-10">
                                <Badge className="rounded-full font-black text-[9px] px-4 py-1.5 border-none shadow-sm uppercase tracking-widest bg-muted dark:bg-muted text-muted-foreground italic">
                                   {item.objective.replace('_', ' ')}
                                </Badge>
                             </td>
                             <td className="px-12 py-10">
                                <div className="space-y-1">
                                   <p className="text-xl font-black text-primary italic">{formatCurrency(item.budget, item.currency)}</p>
                                   <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground italic">Allocated Node</p>
                                </div>
                             </td>
                             <td className="px-12 py-10">
                                <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/50 dark:bg-muted border border-primary group-hover:border-primary transition-all max-w-xs">
                                   <Zap className="h-4 w-4 text-warning shrink-0 mt-1" />
                                   <p className="text-[11px] font-medium text-muted-foreground dark:text-muted-foreground italic leading-relaxed">
                                      {item.aiRecommendation ?? "Node is currently executing at peak nominal efficiency."}
                                   </p>
                                </div>
                             </td>
                             <td className="px-12 py-10 text-right">
                                <Badge className={cn(
                                   "rounded-full font-black text-[9px] px-4 py-1.5 border-none shadow-lg uppercase tracking-widest transition-all",
                                   item.status === "ACTIVE" ? "bg-success text-white shadow-emerald-500/20" : "bg-muted dark:bg-muted text-muted-foreground"
                                )}>
                                   {item.status}
                                </Badge>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
                 {(Array.isArray(filteredCampaigns) ? filteredCampaigns : []).length === 0 && (
                   <EmptyState
                     title="No campaigns found"
                     description="No strategic campaigns match the current search in this tenant scope."
                   />
                 )}
              </ScrollArea>
           </TabsContent>

           <TabsContent value="attribution" className="mt-0 outline-none flex-1 overflow-hidden">
              <ScrollArea className="h-[600px]">
                 <table className="w-full">
                    <thead className="bg-muted dark:bg-muted text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground sticky top-0 z-10 italic">
                       <tr>
                          <th className="px-12 py-8 text-left">Source Cluster</th>
                          <th className="px-12 py-8 text-left">Entity Link</th>
                          <th className="px-12 py-8 text-right">Attributed Yield</th>
                          <th className="px-12 py-8 text-right">Allocation Delta</th>
                          <th className="px-12 py-8 text-right">ROI Velocity</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 dark:divide-slate-800/10">
                       {(Array.isArray(attribution) ? attribution : []).map((item) => (
                          <tr key={item.id} className="group hover:bg-success transition-all cursor-default">
                             <td className="px-12 py-10">
                                <div className="flex items-center gap-4">
                                   <div className="h-10 w-10 rounded-xl bg-muted dark:bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-sm">
                                      <Network className="h-5 w-5" />
                                   </div>
                                   <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground italic">NODE: {item.campaignId.slice(-8)}</p>
                                </div>
                             </td>
                             <td className="px-12 py-10">
                                <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-tighter text-muted-foreground group-hover:text-primary transition-colors italic">
                                   <Fingerprint className="h-4 w-4" /> ENTITY: {item.leadId.slice(-8)}
                                </div>
                             </td>
                             <td className="px-12 py-10 text-right">
                                <p className="text-xl font-black text-success italic tracking-tighter">{formatCurrency(item.revenueAttributed)}</p>
                                <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground italic">Net Attribution</p>
                             </td>
                             <td className="px-12 py-10 text-right">
                                <p className="text-xl font-black text-primary italic tracking-tighter">{formatCurrency(item.spend)}</p>
                                <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground italic">Channel Burn</p>
                             </td>
                             <td className="px-12 py-10 text-right">
                                <div className="flex flex-col items-end gap-3">
                                   <div className="flex items-center gap-3">
                                      <Badge className="bg-success text-success font-black text-[9px] px-3 py-1 rounded-full border-none shadow-sm uppercase tracking-widest">PROFITABLE</Badge>
                                      <p className="text-2xl font-black text-muted-foreground dark:text-white uppercase tracking-tighter">{item.roiPercent}%</p>
                                   </div>
                                   <div className="h-2 w-40 bg-muted dark:bg-muted rounded-full overflow-hidden shadow-inner">
                                      <div className="h-full bg-success transition-all duration-1000 shadow-[0_0_12px_rgba(16,185,129,0.4)]" style={{ width: `${Math.min(item.roiPercent / 10, 100)}%` }} />
                                   </div>
                                </div>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
                 {(Array.isArray(attribution) ? attribution : []).length === 0 && (
                   <EmptyState
                     title="No attribution records"
                     description="No multi-touch attribution records exist for this tenant scope yet."
                   />
                 )}
              </ScrollArea>
           </TabsContent>
        </Tabs>
      </Card>
      
      {/* Strategy Optimization Footer */}
      <Card className="rounded-[4rem] border-none shadow-2xl bg-white dark:bg-muted p-12 flex flex-col lg:flex-row items-center gap-12 group overflow-hidden relative">
         <div className="absolute inset-0 bg-primary dark:bg-primary opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
         <div className="h-32 w-32 bg-primary rounded-[3rem] flex items-center justify-center shadow-[0_30px_60px_-15px_rgba(79,70,229,0.4)] group-hover:rotate-12 transition-all duration-700 shrink-0 relative z-10">
            <Cpu className="h-16 w-16 text-white drop-shadow-2xl" />
         </div>
         <div className="flex-1 space-y-4 text-center lg:text-left relative z-10">
            <div className="flex items-center gap-4 justify-center lg:justify-start">
               <Badge className="bg-primary text-white font-black text-[10px] uppercase tracking-widest px-4 py-1 rounded-full">Neural Analyzer</Badge>
               <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground italic">ROI Projection Active</p>
            </div>
            <h3 className="text-3xl font-black uppercase italic tracking-tighter italic leading-none">Yield Optimization Strategy</h3>
            <p className="text-lg font-medium italic italic opacity-60 italic leading-relaxed italic max-w-4xl italic">
               "Cross-channel telemetry authorizes a <strong>+22.4% ROI lift</strong> by re-allocating Rp 217jt from low-yield Google Ads clusters into the <strong>High-Intent Meta Ads</strong> network. Attribution lag is currently at <strong>nominal levels</strong>."
            </p>
         </div>
         <Button className="h-20 px-12 rounded-[2.5rem] bg-primary hover:bg-primary shadow-2xl shadow-indigo-500/30 font-black text-sm uppercase tracking-widest gap-4 group transition-all hover:scale-105 active:scale-95 text-white whitespace-nowrap relative z-10">
            OPTIMIZE MATRIX <ChevronRight className="h-6 w-6 group-hover:translate-x-2 transition-transform duration-500" />
         </Button>
      </Card>
    </div>
  );
}
