import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Zap, 
  Workflow, 
  Brain, 
  MousePointer2, 
  Activity, 
  ShieldCheck, 
  RefreshCw, 
  ArrowUpRight, 
  TrendingUp, 
  AlertCircle,
  Search,
  MoreVertical,
  Layers,
  Cpu,
  CheckCircle2,
  Sparkles,
  Network,
  Share2,
  Terminal,
  Play,
  Settings,
  History,
  Box
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { useSession } from "@/core/security/session";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageShell } from "@/core/ui/PageShell";
import { PageHeader } from "@/core/ui/PageHeader";

export default function AutomationLab() {
  const session = useSession();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"orchestrator" | "behavioral" | "runtime">("orchestrator");

  const refresh = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));

      if (isManual) toast.success("Automation matrix synchronized.");
    } catch (err) {
      console.error("Automation sync failure:", err);
      toast.error("Telemetry failure in automation suite.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-8">
          <div className="relative h-24 w-24">
             <div className="absolute inset-0 bg-primary/20 rounded-[2.5rem] blur-2xl animate-pulse" />
             <div className="relative h-full w-full bg-primary rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-primary/40 border border-border">
                <Zap className="h-12 w-12 text-primary-foreground" />
             </div>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Initializing Autonomous Lab...</p>
        </div>
      </div>
    );
  }

  return (
    <PageShell
      header={
        <PageHeader
          title="Advanced Automation Lab"
          subtitle="Autonomous workflow orchestration, behavioral mapping, and multi-channel dispatch."
          primaryAction={
            <Button className="rounded-[1.2rem] px-8 h-12 gap-3 font-black text-xs uppercase tracking-widest bg-primary hover:bg-primary shadow-xl shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95">
              <Play className="h-4 w-4" /> DEPLOY ENGINE
            </Button>
          }
          secondaryActions={
            <Button 
              variant="outline" 
              className="rounded-[1.2rem] px-6 h-12 font-black text-xs uppercase tracking-widest border-border bg-background/50 backdrop-blur-sm hover:bg-background transition-all"
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
        {/* Tier 1: Lab Intelligence Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="glass-card border-none shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
               <Cpu className="w-16 h-16 text-primary" />
            </div>
            <CardContent className="p-8">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Compute Availability</div>
              <div className="text-3xl font-black italic tracking-tighter flex items-end gap-2">
                98% <span className="text-sm font-bold text-success mb-1">OPTIMAL</span>
              </div>
              <div className="flex items-center gap-2 mt-4 text-[10px] font-bold text-success uppercase">
                <CheckCircle2 className="w-3 h-3" />
                Processing Node Verified
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-none shadow-xl relative overflow-hidden group">
            <CardContent className="p-8">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Active Workflows</div>
              <div className="text-3xl font-black italic tracking-tighter text-primary">24</div>
              <div className="flex items-center gap-2 mt-4 text-[10px] font-bold text-primary uppercase">
                <Workflow className="w-3 h-3" />
                Multi-Channel Active
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-none shadow-xl relative overflow-hidden group">
            <CardContent className="p-8">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Decision Latency</div>
              <div className="text-3xl font-black italic tracking-tighter text-primary">12ms</div>
              <div className="flex items-center gap-2 mt-4 text-[10px] font-bold text-primary uppercase">
                <Zap className="w-3 h-3" />
                Edge Compute Triggered
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-none shadow-xl relative overflow-hidden group">
            <CardContent className="p-8">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">AI Agent Status</div>
              <div className="text-3xl font-black italic tracking-tighter">LISTENING</div>
              <div className="flex items-center gap-2 mt-4 text-[10px] font-bold text-success uppercase">
                <Brain className="w-3 h-3" />
                Autonomous Mode Active
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tier 2: Navigation & Search */}
        <div className="flex flex-col md:flex-row gap-6 items-center justify-between glass-card p-6 rounded-[2.5rem]">
           <div className="relative w-full md:w-[400px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search workflows, triggers, or mapping nodes..." 
                className="pl-12 h-12 bg-secondary/50 border-none rounded-xl font-bold text-xs uppercase tracking-widest"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
           </div>
           <div className="flex items-center gap-4 bg-secondary/30 p-1.5 rounded-2xl">
              {(["orchestrator", "behavioral", "runtime"] as const).map(tab => (
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

        {/* Tier 3: Display Hub */}
        {activeTab === "orchestrator" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
             <Card className="lg:col-span-8 glass-card border-none shadow-2xl rounded-[3rem] p-12 bg-secondary/10 relative overflow-hidden flex flex-col justify-center items-center text-center space-y-8 min-h-[500px]">
                <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, var(--primary) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
                
                <div className="relative">
                   <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse" />
                   <div className="h-24 w-24 rounded-[2.5rem] bg-background border-2 border-primary/20 flex items-center justify-center text-primary relative z-10 shadow-2xl">
                      <Workflow className="h-10 w-10 animate-spin-slow" />
                   </div>
                </div>

                <div className="space-y-3 relative z-10">
                   <h3 className="text-4xl font-black italic tracking-tighter uppercase">Visual Workflow Orchestrator</h3>
                   <p className="text-muted-foreground font-medium italic max-w-xl mx-auto">
                     Define complex multi-channel automation sequences with real-time feedback loops and conditional branching.
                   </p>
                </div>

                <div className="flex gap-6 relative z-10">
                   <Button className="h-16 px-12 rounded-2xl bg-primary hover:bg-primary font-black text-xs uppercase tracking-widest shadow-2xl shadow-indigo-500/30 gap-3 group transition-all hover:scale-105">
                      <Sparkles className="h-5 w-5" />
                      AUTO-GENERATE FLOW
                   </Button>
                   <Button variant="outline" className="h-16 px-12 rounded-2xl font-black text-xs uppercase tracking-widest gap-3 border-2 hover:bg-background transition-all">
                      <Settings className="h-5 w-5" />
                      CONFIGURE TRIGGER
                   </Button>
                </div>
             </Card>

             <div className="lg:col-span-4 space-y-8">
                <Card className="glass-card border-none shadow-2xl rounded-[3rem] p-10 bg-muted text-white relative overflow-hidden group">
                   <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                   <div className="relative z-10 space-y-8">
                      <div className="flex items-center gap-4">
                         <div className="h-14 w-14 bg-primary/20 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-border">
                            <Brain className="h-7 w-7 text-primary" />
                         </div>
                         <div>
                            <h4 className="font-black text-xl uppercase tracking-tighter italic">Brain-Bridge</h4>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-40">AI Orchestration Core</p>
                         </div>
                      </div>
                      <p className="text-sm font-medium italic opacity-70 leading-relaxed italic">
                        "Autonomous agents are currently managing <strong>12 active sequences</strong>. Yield optimization is trending at +18.4%."
                      </p>
                      <Button className="w-full h-16 bg-primary text-white hover:bg-primary/90 border-none rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl transition-all hover:scale-105 active:scale-95">
                         VIEW AGENT LOGS
                      </Button>
                   </div>
                </Card>

                <Card className="glass-card border-none shadow-2xl rounded-[3rem] p-8">
                   <div className="space-y-6">
                      <h4 className="font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground italic flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-success" />
                        Automation Yield
                      </h4>
                      <div className="space-y-4">
                         {[
                           { name: 'Email Nurture', val: 92, color: 'bg-primary' },
                           { name: 'Ad Retargeting', val: 78, color: 'bg-primary' },
                           { name: 'WhatsApp Push', val: 84, color: 'bg-success' }
                         ].map(flow => (
                           <div key={flow.name} className="space-y-2">
                              <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                                 <span>{flow.name}</span>
                                 <span className="text-primary">{flow.val}%</span>
                              </div>
                              <Progress value={flow.val} className={cn("h-1", flow.color.replace('bg-', 'bg-opacity-10 '))} />
                           </div>
                         ))}
                      </div>
                   </div>
                </Card>
             </div>
          </div>
        )}

        {activeTab === "behavioral" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             <Card className="glass-card border-none shadow-2xl rounded-[3rem] p-10">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="font-black italic uppercase tracking-tighter text-2xl">Behavioral Intent Mapping</h3>
                   <Network className="h-6 w-6 text-primary" />
                </div>
                <div className="h-[400px] bg-secondary/30 rounded-[2.5rem] border-2 border-dashed border-border/50 flex items-center justify-center relative overflow-hidden">
                   <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
                   <div className="text-center space-y-6 relative z-10">
                      <MousePointer2 className="h-16 w-16 text-muted-foreground mx-auto animate-bounce-slow opacity-20" />
                      <p className="text-xs font-black uppercase text-muted-foreground tracking-[0.3em] italic">Deep Intent Clustering Active</p>
                   </div>
                </div>
             </Card>

             <div className="space-y-8">
                <Card className="glass-card border-none shadow-2xl rounded-[3rem] p-10 flex flex-col justify-between">
                   <div className="space-y-6">
                      <div className="h-12 w-12 rounded-2xl bg-primary text-primary flex items-center justify-center">
                         <Share2 className="h-6 w-6" />
                      </div>
                      <div className="space-y-2">
                         <h4 className="text-2xl font-black italic tracking-tighter uppercase">Cross-Channel Semantic Sync</h4>
                         <p className="text-muted-foreground font-medium italic italic">
                           Map customer behavior across all touchpoints into a unified semantic vector for hyper-personalized dispatch.
                         </p>
                      </div>
                   </div>
                   <Button className="w-full h-14 mt-8 rounded-2xl bg-primary hover:bg-primary text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-500/20">
                      MAP NEW SEMANTIC NODE
                   </Button>
                </Card>

                <div className="grid grid-cols-2 gap-6">
                   <Card className="glass-card border-none shadow-xl rounded-[2.5rem] p-6 text-center">
                      <p className="text-[10px] font-black uppercase text-muted-foreground mb-1 tracking-widest">Intent Confidence</p>
                      <p className="text-3xl font-black italic text-success">94.2%</p>
                   </Card>
                   <Card className="glass-card border-none shadow-xl rounded-[2.5rem] p-6 text-center">
                      <p className="text-[10px] font-black uppercase text-muted-foreground mb-1 tracking-widest">Action Velocity</p>
                      <p className="text-3xl font-black italic text-primary">2.1s</p>
                   </Card>
                </div>
             </div>
          </div>
        )}

        {activeTab === "runtime" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
             <Card className="lg:col-span-8 glass-card border-none shadow-2xl rounded-[3rem] overflow-hidden flex flex-col bg-muted text-primary font-mono">
                <div className="p-8 border-b border-border bg-secondary flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <Terminal className="h-5 w-5" />
                      <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic">Automation Runtime Logs</h3>
                   </div>
                   <Badge className="bg-primary text-primary border-none">ACTIVE SESSION</Badge>
                </div>
                <div className="flex-1 p-8 space-y-3 overflow-y-auto max-h-[500px] text-[10px]">
                   {[
                     { time: '21:58:01', msg: '[TRIGGER] BEHAVIORAL_NODE_CART_ABANDON DETECTED @ USER_442', type: 'info' },
                     { time: '21:57:45', msg: '[ACTION] DISPATCHING MULTI-CHANNEL RE-ENGAGEMENT SEQUENCE [ALPHA]', type: 'success' },
                     { time: '21:57:30', msg: '[WEBHOOK] META_PIXEL HANDSHAKE VERIFIED FOR CAMPAIGN_X', type: 'success' },
                     { time: '21:56:12', msg: '[AI] RE-OPTIMIZING BIDDING VECTOR FOR GOOGLE_ADS_CORE', type: 'warn' },
                     { time: '21:55:00', msg: '[INFO] ALL AUTOMATION GATEWAYS CONFIRMED HEALTHY', type: 'info' }
                   ].map((log, i) => (
                     <div key={i} className="flex gap-4 opacity-80 hover:opacity-100 transition-opacity">
                        <span className="text-muted-foreground shrink-0">[{log.time}]</span>
                        <span className={cn(
                          log.type === 'warn' ? 'text-warning' : 
                          log.type === 'success' ? 'text-success' : 'text-primary'
                        )}>{log.msg}</span>
                     </div>
                   ))}
                   <div className="flex gap-1.5 items-center animate-pulse pt-2">
                      <span className="w-1.5 h-3 bg-primary" />
                      <span className="text-[8px] font-black uppercase tracking-widest opacity-50">LISTENING FOR EVENTS...</span>
                   </div>
                </div>
             </Card>

             <div className="lg:col-span-4 space-y-8">
                <Card className="glass-card border-none shadow-2xl rounded-[3rem] p-10">
                   <div className="space-y-6">
                      <div className="h-12 w-12 rounded-2xl bg-secondary/50 flex items-center justify-center text-primary">
                         <History className="h-6 w-6" />
                      </div>
                      <h4 className="text-xl font-black italic tracking-tighter uppercase">Runtime Governance</h4>
                      <p className="text-muted-foreground font-medium italic text-xs leading-relaxed italic">
                        Monitor the live execution of all automation nodes. Override triggers and manage edge-compute quotas.
                      </p>
                      <div className="p-4 bg-secondary/30 rounded-2xl space-y-3">
                         <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                            <span>Quota Utilization</span>
                            <span>42%</span>
                         </div>
                         <Progress value={42} className="h-1" />
                      </div>
                      <Button className="w-full h-12 rounded-xl bg-primary text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20">
                         FLUSH RUNTIME CACHE
                      </Button>
                   </div>
                </Card>

                <Card className="glass-card border-none shadow-2xl rounded-[3rem] p-8 text-center bg-primary">
                   <Activity className="h-10 w-10 text-primary mx-auto mb-4" />
                   <h4 className="font-black text-xs uppercase tracking-widest text-primary mb-1">Engine Operational</h4>
                   <p className="text-[8px] font-bold text-primary uppercase">Runtime: 142h 12m 04s</p>
                </Card>
             </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
