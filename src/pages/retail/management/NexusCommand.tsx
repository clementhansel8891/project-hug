import { useState, useEffect } from "react";
import { 
  Zap, 
  Cpu, 
  Users, 
  Settings, 
  Activity, 
  ShieldCheck, 
  Rocket, 
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Box
} from "lucide-react";
import { PageShell } from "@/core/ui/PageShell";
import { PageHeader } from "@/core/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function NexusCommand() {
  const [loading, setLoading] = useState(false);
  const [pulse, setPulse] = useState(98.4);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(p => +(p + (Math.random() * 0.4 - 0.2)).toFixed(1));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleDeploy = (resource: string) => {
    toast.success(`Resource Deployment Initialized`, {
      description: `Tactical ${resource} allocation is being synced with global nodes.`
    });
  };

  return (
    <PageShell
      header={
        <PageHeader
          title="Nexus Command"
          subtitle="Direct operational oversight and tactical resource deployment."
          primaryAction={
            <div className="flex items-center gap-6">
               <div className="flex flex-col items-end">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Grid Stability</span>
                  <div className="flex items-center gap-2">
                     <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                     <span className="text-xl font-black italic tracking-tighter">{pulse}%</span>
                  </div>
               </div>
               <Button className="h-12 px-8 rounded-2xl bg-primary hover:bg-primary/90 font-black text-[10px] uppercase tracking-widest gap-3 shadow-xl shadow-indigo-500/20">
                  <RefreshCw className="h-4 w-4" /> RE-SYNC GRID
               </Button>
            </div>
          }
        />
      }
    >
      <div className="space-y-12 pb-24">
        {/* Core Tactical Hubs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <Card className="glass-card p-6 rounded-[2rem] card-premium flex flex-col gap-6">
              <div className="h-16 w-16 rounded-3xl bg-primary text-foreground flex items-center justify-center shadow-2xl">
                 <Cpu className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                 <h3 className="text-2xl font-black italic uppercase tracking-tighter">Node Scaling</h3>
                 <p className="text-sm font-medium text-muted-foreground italic">Increase compute and storage allocation for high-velocity regional nodes.</p>
              </div>
              <div className="mt-auto pt-6 border-t border-border flex items-center justify-between">
                 <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase text-muted-foreground">Active Nodes</p>
                    <p className="text-lg font-black italic">142 Units</p>
                 </div>
                 <Button onClick={() => handleDeploy("Compute")} className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-black uppercase tracking-widest text-[9px] gap-2">
                    SCALE NODES <ChevronRight className="h-4 w-4" />
                 </Button>
              </div>
           </Card>

           <Card className="glass-card p-6 rounded-[2rem] card-premium flex flex-col gap-6">
              <div className="h-16 w-16 rounded-3xl bg-success text-foreground flex items-center justify-center shadow-2xl">
                 <Users className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                 <h3 className="text-2xl font-black italic uppercase tracking-tighter">Force Deployment</h3>
                 <p className="text-sm font-medium text-muted-foreground italic">Reallocate field personnel and logistics staff to handle traffic spikes.</p>
              </div>
              <div className="mt-auto pt-6 border-t border-border flex items-center justify-between">
                 <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase text-muted-foreground">Active Personnel</p>
                    <p className="text-lg font-black italic">840 Active</p>
                 </div>
                 <Button onClick={() => handleDeploy("Staff")} className="h-12 px-6 rounded-xl bg-success hover:bg-success text-foreground font-black uppercase tracking-widest text-[9px] gap-2">
                    DEPLOY STAFF <ChevronRight className="h-4 w-4" />
                 </Button>
              </div>
           </Card>

           <Card className="glass-card p-6 rounded-[2rem] card-premium flex flex-col gap-6">
              <div className="h-16 w-16 rounded-3xl bg-warning text-foreground flex items-center justify-center shadow-2xl">
                 <Box className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                 <h3 className="text-2xl font-black italic uppercase tracking-tighter">Inventory Sync</h3>
                 <p className="text-sm font-medium text-muted-foreground italic">Authorize automated replenishment protocols for low-stock subsidiaries.</p>
              </div>
              <div className="mt-auto pt-6 border-t border-border flex items-center justify-between">
                 <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase text-muted-foreground">Replenishment Status</p>
                    <p className="text-lg font-black italic">AUTO-ACTIVE</p>
                 </div>
                 <Button onClick={() => handleDeploy("Inventory")} className="h-12 px-6 rounded-xl bg-warning hover:bg-warning text-foreground font-black uppercase tracking-widest text-[9px] gap-2">
                    SYNC STOCKS <ChevronRight className="h-4 w-4" />
                 </Button>
              </div>
           </Card>
        </div>

        {/* Live Incident Stream */}
        <div className="grid grid-cols-12 gap-6">
           <Card className="col-span-12 xl:col-span-8 rounded-2xl border-none shadow-2xl bg-card dark:bg-secondary/40 p-6 overflow-hidden flex flex-col group">
              <div className="flex items-center justify-between mb-10">
                 <div className="space-y-2">
                    <h3 className="text-3xl font-black italic uppercase tracking-tighter flex items-center gap-4">
                       <ShieldCheck className="h-8 w-8 text-success" />
                       Incident Resolution Desk
                    </h3>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">Resolve critical deviations in real-time</p>
                 </div>
                 <Badge className="bg-success/10 text-success border-none px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest">
                    SYSTEM SECURE
                 </Badge>
              </div>

              <div className="space-y-6">
                 {[
                    { id: "INC-942", type: "LATENCY", node: "Jakarta Central", message: "Network jitter detected in L2 gateway.", severity: "LOW" },
                    { id: "INC-943", type: "CAPACITY", node: "Surabaya East", message: "Transaction volume reaching 85% of node capacity.", severity: "MEDIUM" },
                    { id: "INC-944", type: "SECURITY", node: "Bali Resort", message: "Unauthorized login attempt blocked by RLS protocol.", severity: "HIGH" },
                 ].map((inc) => (
                    <div key={inc.id} className="p-8 rounded-2xl bg-secondary/30 border border-border flex items-center justify-between group/inc hover:bg-secondary/50 transition-all">
                       <div className="flex items-center gap-8">
                          <div className={cn(
                             "h-12 w-12 rounded-2xl flex items-center justify-center",
                             inc.severity === "HIGH" ? "bg-destructive/10 text-destructive" : inc.severity === "MEDIUM" ? "bg-warning text-warning" : "bg-primary/10 text-primary"
                          )}>
                             <AlertTriangle className="h-6 w-6" />
                          </div>
                          <div>
                             <div className="flex items-center gap-3 mb-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{inc.id}</span>
                                <span className="text-xs font-black italic uppercase tracking-tight">{inc.node}</span>
                             </div>
                             <p className="text-sm font-medium italic italic">{inc.message}</p>
                          </div>
                       </div>
                       <Button className="h-12 px-6 rounded-xl bg-card border border-border text-[9px] font-black uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-all">
                          RESOLVE INCIDENT
                       </Button>
                    </div>
                 ))}
              </div>
           </Card>

           <Card className="col-span-12 xl:col-span-4 rounded-2xl border-none shadow-2xl bg-primary/20 text-foreground p-6 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 h-64 w-64 bg-primary/20 rounded-full blur-[100px] -mr-32 -mt-32" />
              <div className="space-y-6 relative z-10">
                 <div className="h-16 w-16 rounded-3xl bg-white/10 border border-border flex items-center justify-center backdrop-blur-xl">
                    <Rocket className="h-8 w-8 text-primary/70" />
                 </div>
                 <h3 className="text-2xl font-black italic tracking-tighter uppercase leading-none">Strategic <br /> Force Multiplier</h3>
                 <p className="text-sm font-medium text-muted-foreground italic leading-relaxed">
                    Deploy executive resources across global subsidiaries to maximize operational yield and minimize risk.
                 </p>
              </div>
              <div className="space-y-4 pt-10 relative z-10">
                 <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-primary/70 mb-2">
                    <span>Force Velocity</span>
                    <span>88%</span>
                 </div>
                 <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full w-[88%] bg-primary rounded-full" />
                 </div>
                 <Button className="w-full h-14 rounded-2xl bg-card text-primary hover:bg-primary/5 font-black uppercase tracking-widest text-xs mt-6">
                    AUTHORIZE FORCE SCALING
                 </Button>
              </div>
           </Card>
        </div>
      </div>
    </PageShell>
  );
}
