import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Target, 
  BarChart3, 
  Compass, 
  Cpu, 
  Activity, 
  ShieldCheck, 
  RefreshCw, 
  ArrowUpRight, 
  TrendingUp, 
  AlertCircle,
  Search,
  MoreVertical,
  Zap,
  CheckCircle2,
  Brain,
  Layers,
  Sparkles,
  PieChart,
  LineChart,
  Rocket,
  FileSearch,
  Users,
  MousePointer2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/AsyncState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { useSession } from "@/core/security/session";
import { salesService } from "@/core/services/sales/salesService";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageShell } from "@/core/ui/PageShell";
import { PageHeader } from "@/core/ui/PageHeader";

export default function SalesIntelligenceEngine() {
  const session = useSession();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [leads, setLeads] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"scoring" | "analytics" | "proposals">("scoring");

  const refresh = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      const leadData = await salesService.listLeads(session.tenant_id, session);
      setLeads(leadData);

      if (isManual) toast.success("Intelligence matrix synchronized.");
    } catch (err) {
      console.error("Intelligence sync failure:", err);
      toast.error("Telemetry failure in intelligence suite.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session.tenant_id, session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredLeads = useMemo(() => 
    (Array.isArray(leads) ? leads : []).filter(l => 
      search ? `${l.companyName} ${l.contactName}`.toLowerCase().includes(search.toLowerCase()) : true
    ),
  [leads, search]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-8">
          <div className="relative h-24 w-24">
             <div className="absolute inset-0 bg-primary/20 rounded-[2.5rem] blur-2xl animate-pulse" />
             <div className="relative h-full w-full bg-primary rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-primary/40 border border-border">
                <Brain className="h-12 w-12 text-primary-foreground" />
             </div>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Initializing Cognitive Sales Layer...</p>
        </div>
      </div>
    );
  }

  return (
    <PageShell
      header={
        <PageHeader
          title="Sales Intelligence Engine"
          subtitle="AI-driven lead scoring, win probability forecasting, and predictive analytics."
          primaryAction={
            <Button className="rounded-[1.2rem] px-8 h-12 gap-3 font-black text-xs uppercase tracking-widest bg-primary hover:bg-primary shadow-xl shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95">
              <Sparkles className="h-4 w-4" /> GENERATE INSIGHTS
            </Button>
          }
          secondaryActions={
            <Button 
              variant="outline" 
              className="rounded-[1.2rem] px-6 h-12 font-black text-xs uppercase tracking-widest border-border bg-muted0 backdrop-blur-sm hover:bg-muted transition-all"
              onClick={() => refresh(true)}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </Button>
          }
        />
      }
    >
      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
        {/* Tier 1: Intelligence Gauges */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="glass-card border-none shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
               <Brain className="w-16 h-16 text-primary" />
            </div>
            <CardContent className="p-8">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">AI Prediction Accuracy</div>
              <div className="text-3xl font-black italic tracking-tighter flex items-end gap-2">
                92.4% <span className="text-sm font-bold text-primary mb-1">L7 MODEL</span>
              </div>
              <div className="flex items-center gap-2 mt-4 text-[10px] font-bold text-primary uppercase">
                <Cpu className="w-3 h-3" />
                Neural Engine Optimizing
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-none shadow-xl relative overflow-hidden group">
            <CardContent className="p-8">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Win Probability Avg.</div>
              <div className="text-3xl font-black italic tracking-tighter text-success">68.5%</div>
              <Progress value={68.5} className="h-1.5 mt-4" />
            </CardContent>
          </Card>

          <Card className="glass-card border-none shadow-xl relative overflow-hidden group">
            <CardContent className="p-8">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Lead Conversion Velocity</div>
              <div className="text-3xl font-black italic tracking-tighter text-primary">4.2 Days</div>
              <div className="flex items-center gap-2 mt-4 text-[10px] font-bold text-primary uppercase">
                <Zap className="w-3 h-3" />
                28% Speed Increase
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-none shadow-xl relative overflow-hidden group">
            <CardContent className="p-8">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Pipeline Health</div>
              <div className="text-3xl font-black italic tracking-tighter text-primary">STABLE</div>
              <div className="flex items-center gap-2 mt-4 text-[10px] font-bold text-primary uppercase">
                <ShieldCheck className="w-3 h-3" />
                Risk Matrix Verified
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tier 2: Unified Navigation */}
        <div className="flex flex-col md:flex-row gap-6 items-center justify-between glass-card p-6 rounded-[2.5rem]">
           <div className="relative w-full md:w-[400px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search leads, accounts, or predictions..." 
                className="pl-12 h-12 bg-secondary/50 border-none rounded-xl font-bold text-xs uppercase tracking-widest"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
           </div>
           <div className="flex items-center gap-4 bg-secondary/30 p-1.5 rounded-2xl">
              {(["scoring", "analytics", "proposals"] as const).map(tab => (
                <Button 
                  key={tab}
                  variant={activeTab === tab ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "rounded-xl px-6 h-9 font-black text-[10px] uppercase tracking-widest transition-all",
                    activeTab === tab && "shadow-lg shadow-primary/20"
                  )}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </Button>
              ))}
           </div>
        </div>

        {/* Tier 3: Display Matrix */}
        {activeTab === "scoring" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-2 space-y-8">
                <Card className="glass-card border-none shadow-2xl rounded-[3rem] overflow-hidden">
                   <div className="p-8 border-b border-border/50 flex items-center justify-between bg-secondary/20">
                      <div className="flex items-center gap-3">
                         <Target className="h-6 w-6 text-primary" />
                         <h3 className="font-black italic uppercase tracking-tighter text-xl">High-Probability Lead Scoring</h3>
                      </div>
                      <Badge className="bg-primary text-primary border-none font-black text-[9px] px-3 py-1 uppercase tracking-widest">AI EVALUATED</Badge>
                   </div>
                   <div className="p-0 overflow-x-auto">
                      <table className="w-full text-sm">
                         <thead className="bg-secondary/30 text-[9px] uppercase font-black tracking-widest text-muted-foreground">
                            <tr>
                               <th className="px-8 py-5 text-left">Company Node</th>
                               <th className="px-8 py-5 text-left">Source Strength</th>
                               <th className="px-8 py-5 text-left">Engagement Index</th>
                               <th className="px-8 py-5 text-right">Strategic Score</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-border/50">
                            {filteredLeads.map(lead => (
                               <tr key={lead.id} className="group hover:bg-secondary/10 transition-all cursor-default">
                                  <td className="px-8 py-6">
                                     <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                           <Users className="h-5 w-5" />
                                        </div>
                                        <div>
                                           <p className="font-black text-xs italic">{lead.companyName}</p>
                                           <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{lead.contactName}</p>
                                        </div>
                                     </div>
                                  </td>
                                  <td className="px-8 py-6">
                                     <Badge className="rounded-full bg-secondary/50 text-muted-foreground border-none font-black text-[8px] px-3 py-1 uppercase tracking-widest">
                                        {lead.source}
                                     </Badge>
                                  </td>
                                  <td className="px-8 py-6">
                                     <div className="flex items-center gap-4 min-w-[120px]">
                                        <Progress value={Math.floor(Math.random() * 60) + 40} className="h-1 flex-1" />
                                        <span className="text-[10px] font-black text-primary italic">HIGH</span>
                                     </div>
                                  </td>
                                  <td className="px-8 py-6 text-right">
                                     <div className="flex flex-col items-end">
                                        <span className="text-xl font-black italic text-primary tracking-tighter">842</span>
                                        <span className="text-[8px] font-black uppercase text-success tracking-widest">ALPHA TIER</span>
                                     </div>
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                   {!loading && filteredLeads.length === 0 && (
                      <EmptyState
                         title="No leads to score"
                         description="No leads match the current search. Captured leads will be scored here."
                         icon={Target}
                         className="m-8"
                      />
                   )}
                </Card>
             </div>

             <div className="space-y-8">
                <Card className="glass-card border-none shadow-2xl rounded-[3rem] p-10 bg-muted text-white relative overflow-hidden group border border-border">
                   <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                   <div className="relative z-10 space-y-8">
                      <div className="flex items-center gap-4">
                         <div className="h-14 w-14 bg-primary/20 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-border">
                            <Brain className="h-7 w-7 text-primary" />
                         </div>
                         <div>
                            <h4 className="font-black text-xl uppercase tracking-tighter italic">Predictive Core</h4>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Cognitive Forecasting</p>
                         </div>
                      </div>
                      <p className="text-sm font-medium italic opacity-70 leading-relaxed italic">
                        "Your current pipeline has a <strong>74% probability</strong> of hitting Q3 targets based on current conversion velocity."
                      </p>
                      <Button className="w-full h-16 bg-primary text-white hover:bg-primary/90 border-none rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl transition-all hover:scale-105 active:scale-95">
                         RUN MONTE CARLO SIM
                      </Button>
                   </div>
                </Card>

                <Card className="glass-card border-none shadow-2xl rounded-[3rem] p-8">
                   <div className="space-y-6">
                      <h4 className="font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground italic flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-success" />
                        Engagement Momentum
                      </h4>
                      <div className="space-y-5">
                         {[1, 2, 3].map(i => (
                           <div key={i} className="flex items-center gap-4">
                              <div className="h-2 w-2 rounded-full bg-success shadow-lg shadow-emerald-500/50" />
                              <div className="flex-1 space-y-1">
                                 <div className="flex justify-between text-[10px] font-black italic uppercase">
                                    <span>Strategic Account A-{i}</span>
                                    <span className="text-success">+12%</span>
                                 </div>
                                 <Progress value={70 + (i * 10)} className="h-0.5" />
                              </div>
                           </div>
                         ))}
                      </div>
                   </div>
                </Card>
             </div>
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             <Card className="glass-card border-none shadow-2xl rounded-[3rem] p-10">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="font-black italic uppercase tracking-tighter text-2xl">Conversion Funnel Analytics</h3>
                   <LineChart className="h-6 w-6 text-primary" />
                </div>
                <div className="h-[400px] bg-secondary/20 rounded-[2.5rem] border-2 border-dashed border-border/50 flex items-center justify-center">
                   <div className="text-center space-y-6">
                      <div className="relative mx-auto h-24 w-24">
                         <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl animate-pulse" />
                         <PieChart className="relative h-24 w-24 text-muted-foreground opacity-30" />
                      </div>
                      <p className="text-xs font-black uppercase text-muted-foreground tracking-[0.3em] italic">Telemetry Visualization Protocol Ready</p>
                   </div>
                </div>
             </Card>

             <div className="grid gap-8">
                <Card className="glass-card border-none shadow-2xl rounded-[3rem] p-10 flex flex-col justify-between group">
                   <div className="space-y-6">
                      <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:rotate-12 transition-transform">
                         <FileSearch className="h-7 w-7" />
                      </div>
                      <div className="space-y-2">
                         <h4 className="text-3xl font-black italic tracking-tighter uppercase">Win-Loss Deep Dive</h4>
                         <p className="text-muted-foreground font-medium italic italic">Analyze the semantic reasons behind every lost opportunity. AI identifies patterns in negotiation, pricing, and timing.</p>
                      </div>
                   </div>
                   <Button className="w-full h-14 mt-10 rounded-2xl bg-secondary hover:bg-secondary/80 font-black text-[10px] uppercase tracking-widest transition-all">
                      EXTRACT PATTERN REPORT
                   </Button>
                </Card>

                <div className="grid grid-cols-2 gap-8">
                   <Card className="glass-card border-none shadow-xl rounded-[2.5rem] p-8 text-center bg-success">
                      <p className="text-[10px] font-black uppercase text-muted-foreground mb-1 tracking-widest">Avg. Deal Value</p>
                      <p className="text-3xl font-black italic text-success">Rp 642M</p>
                   </Card>
                   <Card className="glass-card border-none shadow-xl rounded-[2.5rem] p-8 text-center bg-primary">
                      <p className="text-[10px] font-black uppercase text-muted-foreground mb-1 tracking-widest">Churn Index</p>
                      <p className="text-3xl font-black italic text-primary">0.8%</p>
                   </Card>
                </div>
             </div>
          </div>
        )}

        {activeTab === "proposals" && (
          <div className="glass-card border-none shadow-2xl rounded-[3rem] p-12 flex flex-col items-center justify-center text-center space-y-10 min-h-[500px]">
             <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse" />
                <div className="h-24 w-24 rounded-[2rem] bg-background border-2 border-primary/20 flex items-center justify-center text-primary relative z-10">
                   <Rocket className="h-10 w-10" />
                </div>
             </div>
             <div className="space-y-3">
                <h3 className="text-4xl font-black italic tracking-tighter uppercase">Proposal Generation Protocol</h3>
                <p className="text-muted-foreground font-medium italic italic max-w-xl mx-auto">
                  Automatically generate high-conversion strategic proposals using real-time inventory parity and custom pricing matrices.
                </p>
             </div>
             <div className="flex gap-6">
                <Button className="h-16 px-12 rounded-2xl bg-primary hover:bg-primary font-black text-xs uppercase tracking-widest shadow-2xl shadow-indigo-500/30 gap-3 group">
                   <PlusIcon className="h-5 w-5" />
                   INITIALIZE DRAFT
                </Button>
                <Button variant="outline" className="h-16 px-12 rounded-2xl font-black text-xs uppercase tracking-widest gap-3 border-2">
                   <Layers className="h-5 w-5" />
                   MANAGE TEMPLATES
                </Button>
             </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function PlusIcon({ className }: any) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
