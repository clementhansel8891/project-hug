import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  Workflow, 
  Play, 
  Pause, 
  Settings2, 
  Plus, 
  Clock, 
  Mail, 
  MessageSquare, 
  Zap, 
  ArrowDown, 
  Trash2,
  Edit2,
  ChevronRight,
  Sparkles,
  Target,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Activity,
  Layers,
  Box,
  Fingerprint,
  ChevronDown,
  ArrowUpRight,
  MoreVertical,
  ActivitySquare,
  Network
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/core/security/session";
import { marketingService } from "@/core/services/marketing/marketingService";
import type { NurtureWorkflow } from "@/core/types/marketing/marketing";
import { EmptyState } from "@/components/shared/AsyncState";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CreateWorkflowModal } from "./modals/CreateWorkflowModal";

const TRIGGERS: NurtureWorkflow["trigger"][] = [
  "NEW_LEAD",
  "SCORE_BELOW_THRESHOLD",
  "REENGAGEMENT",
];

export default function NurtureStudio() {
  const navigate = useNavigate();
  const session = useSession();
  const [selectedWorkflow, setSelectedWorkflow] = useState<NurtureWorkflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workflows, setWorkflows] = useState<NurtureWorkflow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      const w = await marketingService.listWorkflows(session.tenant_id, session);
      setWorkflows(w);
      if (w.length > 0 && !selectedWorkflow) {
         setSelectedWorkflow(w[0]);
      }
      if (isManual) toast.success("Automation registry synchronized.");
    } catch (err) {
      console.error("Failed to fetch nurture workflows:", err);
      toast.error("Telemetry failure in automation suite.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session.tenant_id, selectedWorkflow]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleUpdateStatus = async (id: string, status: "ACTIVE" | "PAUSED") => {
    try {
      setRefreshing(true);
      await marketingService.updateWorkflowStatus(session.tenant_id, session, id, status);
      toast.success(`Protocol ${status} executed for workflow.`);
      refresh(true);
    } catch (err) {
      toast.error("Authorization protocol failure.");
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted dark:bg-muted">
        <div className="flex flex-col items-center gap-6">
          <div className="h-20 w-20 bg-primary rounded-[2.5rem] animate-pulse flex items-center justify-center shadow-2xl shadow-indigo-500/20">
             <Workflow className="h-10 w-10 text-white" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Booting Growth Orchestrator...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-10 animate-in fade-in duration-1000 max-w-[1600px] mx-auto pb-24 h-screen overflow-hidden flex flex-col">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row justify-between items-end gap-6 shrink-0">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge className="bg-primary text-white border-none font-black px-3 py-1 rounded-full uppercase tracking-widest text-[10px]">Strategic Studio</Badge>
            <div className="flex items-center gap-1.5 text-primary font-bold text-xs uppercase tracking-widest">
               <Activity className="h-4 w-4 animate-pulse" />
               Engine V4.2.0 Online
            </div>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-foreground text-left italic">Nurture Studio</h1>
          <p className="text-muted-foreground font-medium max-w-2xl text-lg leading-relaxed italic text-left">"Orchestrate event-driven growth workflows with total operational command."</p>
        </div>
        
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            className="h-14 w-14 rounded-2xl bg-white dark:bg-muted border-none shadow-xl hover:scale-110 transition-all"
            onClick={() => refresh(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-6 w-6 text-primary", refreshing && "animate-spin")} />
          </Button>
          <Button 
            className="h-[4.5rem] px-10 rounded-[2rem] bg-primary hover:bg-primary shadow-2xl shadow-indigo-500/30 font-black text-sm gap-3 group transition-all hover:scale-105 active:scale-95"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform duration-500" /> 
            INITIALIZE RULE
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-10 flex-1 min-h-0">
        {/* Left: Automation Registry */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 overflow-hidden">
           <Card className="flex-1 rounded-[3rem] border-none shadow-2xl glass-card overflow-hidden flex flex-col">
              <CardHeader className="p-8 pb-4 border-b border-border dark:border-border/10 flex flex-row items-center justify-between">
                 <div className="space-y-1">
                    <CardTitle className="text-xl font-black tracking-tight flex items-center gap-3 uppercase italic">
                       <Layers className="h-5 w-5 text-primary" />
                       Active Protocols
                    </CardTitle>
                 </div>
                 <Badge variant="outline" className="rounded-full font-black text-[9px] px-2 py-0 h-5 border-border dark:border-border text-muted-foreground uppercase tracking-widest">{workflows.length} RULES</Badge>
              </CardHeader>
              <ScrollArea className="flex-1">
                 <div className="p-3 space-y-2">
                    {(Array.isArray(workflows) ? workflows : []).map((wf) => (
                      <button
                        key={wf.id}
                        onClick={() => setSelectedWorkflow(wf)}
                        className={cn(
                          "w-full flex items-center gap-5 p-5 rounded-[2rem] text-left transition-all duration-300 group relative overflow-hidden",
                          selectedWorkflow?.id === wf.id 
                            ? "bg-white dark:bg-muted shadow-2xl shadow-indigo-500/10 translate-x-2 border-l-4 border-l-indigo-600" 
                            : "hover:bg-muted0 dark:hover:bg-muted hover:translate-x-1"
                        )}
                      >
                         <div className={cn(
                           "h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg transition-transform duration-500 group-hover:scale-110",
                           wf.status === 'ACTIVE' ? "bg-primary text-white shadow-indigo-500/20" : "bg-muted dark:bg-muted text-muted-foreground"
                         )}>
                            <Zap className="h-7 w-7" />
                         </div>
                         <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center justify-between">
                               <p className="text-sm font-black uppercase tracking-tight group-hover:text-primary transition-colors italic leading-none truncate pr-2">{wf.name}</p>
                               <Badge className={cn(
                                 "text-[8px] font-black uppercase tracking-widest px-2 py-0 h-4 border-none shadow-sm",
                                 wf.status === 'ACTIVE' ? "bg-success text-white shadow-emerald-500/10" : "bg-muted dark:bg-muted text-muted-foreground"
                               )}>
                                 {wf.status}
                               </Badge>
                            </div>
                            <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.2em] italic opacity-60">
                               {wf.trigger.replace('_', ' ')}
                            </p>
                         </div>
                         <ChevronRight className={cn("h-4 w-4 transition-transform", selectedWorkflow?.id === wf.id ? "text-primary translate-x-1" : "text-muted-foreground")} />
                      </button>
                    ))}
                    {(Array.isArray(workflows) ? workflows : []).length === 0 && (
                      <EmptyState
                        title="No automation protocols"
                        description="No nurture workflows exist for this tenant scope yet."
                        icon={Workflow}
                      />
                    )}
                 </div>
              </ScrollArea>
           </Card>

           <Card className="rounded-[3rem] border-none shadow-2xl bg-primary text-white p-10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 h-40 w-40 bg-muted rounded-full blur-3xl -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-1000" />
              <div className="relative z-10 space-y-6">
                 <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-primary rounded-2xl flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-transform">
                       <Sparkles className="h-6 w-6 text-white fill-white" />
                    </div>
                    <div>
                       <h4 className="font-black text-lg uppercase tracking-tighter italic leading-none">AI Advisory</h4>
                       <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Neural Optimization</p>
                    </div>
                 </div>
                 <p className="text-xs font-medium italic italic opacity-70 leading-relaxed italic">
                    "{selectedWorkflow?.aiSuggestion || "Select a workflow to see AI-driven performance tips."}"
                 </p>
                 <Button variant="link" className="text-[9px] font-black uppercase tracking-widest h-auto p-0 text-primary hover:text-white transition-colors"
                    onClick={() => navigate("/core/marketing/automation")}
                  >
                    AUTHORIZE OPTIMIZATION
                  </Button>
              </div>
           </Card>
        </div>

        {/* Right: Builder Canvas */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6 overflow-hidden">
           {selectedWorkflow ? (
             <div className="h-full flex flex-col gap-6">
                <Card className="shrink-0 rounded-[2.5rem] border-none bg-primary shadow-2xl p-1 relative overflow-hidden group">
                   <div className="absolute top-0 right-0 h-64 w-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32 group-hover:scale-150 transition-transform duration-1000" />
                   <CardContent className="p-8 flex items-center justify-between text-white relative z-10">
                      <div className="flex items-center gap-6">
                         <div className="h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shadow-xl border border-border">
                            <Workflow className="h-8 w-8 text-white" />
                         </div>
                         <div className="space-y-1">
                            <h2 className="text-3xl font-black tracking-tighter uppercase italic">{selectedWorkflow.name}</h2>
                            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest opacity-60">
                               <span className="flex items-center gap-2"><Network className="h-4 w-4" /> NODE ID: {selectedWorkflow.id}</span>
                               <span className="flex items-center gap-2 text-success"><ShieldCheck className="h-4 w-4" /> LOGIC VERIFIED</span>
                            </div>
                         </div>
                      </div>
                      <div className="flex items-center gap-4">
                         <Button variant="outline" className="h-14 px-8 rounded-2xl bg-white/10 border-none shadow-xl hover:scale-110 transition-all text-white font-black text-[10px] uppercase tracking-widest gap-2 group"
                            onClick={() => navigate("/core/marketing/automation")}
                          >
                            <Settings2 className="h-4 w-4 group-hover:rotate-90 transition-transform duration-500" /> CONFIGURATION
                         </Button>
                         {selectedWorkflow.status === 'ACTIVE' ? (
                            <Button 
                              className="h-14 px-8 rounded-2xl bg-destructive text-white hover:bg-destructive shadow-xl shadow-rose-500/20 font-black text-[10px] uppercase tracking-widest gap-2"
                              onClick={() => handleUpdateStatus(selectedWorkflow.id, "PAUSED")}
                            >
                               <Pause className="h-4 w-4" /> DEACTIVATE
                            </Button>
                         ) : (
                            <Button 
                              className="h-14 px-8 rounded-2xl bg-white text-primary hover:bg-muted shadow-xl font-black text-[10px] uppercase tracking-widest gap-2"
                              onClick={() => handleUpdateStatus(selectedWorkflow.id, "ACTIVE")}
                            >
                               <Play className="h-4 w-4" /> AUTHORIZE
                            </Button>
                         )}
                      </div>
                   </CardContent>
                </Card>

                <Card className="flex-1 rounded-[4rem] border-none shadow-2xl glass-card overflow-hidden relative">
                   <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.07] pointer-events-none" 
                        style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                   <ScrollArea className="h-full">
                      <div className="p-20 flex flex-col items-center gap-10 relative z-10">
                         {/* Trigger Node */}
                         <div className="relative group">
                            <Card className="bg-primary text-white border-none shadow-[0_20px_40px_-10px_rgba(79,70,229,0.4)] w-80 text-center z-10 relative overflow-hidden rounded-[2rem] group-hover:scale-105 transition-all duration-500">
                               <div className="absolute top-0 right-0 h-32 w-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16" />
                               <CardContent className="p-8 space-y-2">
                                  <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-1">Trigger Event</p>
                                  <p className="font-black text-xl uppercase italic tracking-tighter">{selectedWorkflow.trigger.replace('_', ' ')}</p>
                               </CardContent>
                            </Card>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-[2px] h-10 bg-primary" />
                         </div>

                         {/* Step Nodes */}
                         {(Array.isArray(selectedWorkflow.steps) ? selectedWorkflow.steps : []).map((step, idx) => (
                            <div key={step.id} className="flex flex-col items-center gap-10 w-full max-w-2xl">
                               <div className="relative group w-full">
                                  <Card className="bg-white/80 dark:bg-muted backdrop-blur-md border-none shadow-xl rounded-[2.5rem] p-8 flex gap-8 items-center relative z-10 hover:shadow-2xl hover:translate-x-1 transition-all duration-500">
                                     <div className={cn(
                                       "h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg transition-transform duration-500 group-hover:scale-110",
                                       step.channel === 'EMAIL' ? "bg-primary text-white" : "bg-success text-white"
                                     )}>
                                        {step.channel === 'EMAIL' ? <Mail className="h-8 w-8" /> : <MessageSquare className="h-8 w-8" />}
                                     </div>
                                     <div className="flex-1 min-w-0 space-y-3">
                                        <div className="flex justify-between items-center">
                                           <div className="space-y-1">
                                              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest italic">Node Step {idx + 1}</p>
                                              <p className="text-xl font-black uppercase italic tracking-tight group-hover:text-primary transition-colors truncate pr-4">{step.messageTemplate}</p>
                                           </div>
                                           <Badge variant="outline" className="rounded-full font-black text-[9px] px-3 py-1 border-border dark:border-border uppercase tracking-widest text-muted-foreground flex gap-2">
                                              <Clock className="h-3 w-3" /> {step.waitHours}H LATENCY
                                           </Badge>
                                        </div>
                                        <div className="flex gap-3">
                                           <Button variant="secondary" size="sm" className="h-9 px-4 rounded-xl bg-muted dark:bg-muted font-black text-[9px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-sm"
                                              onClick={() => navigate("/core/marketing/automation")}
                                            >
                                              EDIT PROTOCOL
                                            </Button>
                                           <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-destructive hover:bg-destructive dark:hover:bg-destructive"><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                     </div>
                                  </Card>
                                  {idx < selectedWorkflow.steps.length - 1 ? (
                                     <div className="absolute top-full left-1/2 -translate-x-1/2 w-[2px] h-10 bg-primary" />
                                  ) : (
                                     <div className="absolute top-full left-1/2 -translate-x-1/2 w-[2px] h-10 bg-primary" />
                                  )}
                               </div>
                            </div>
                         ))}

                         {/* Add Step Connector */}
                         <div className="flex flex-col items-center">
                            <Button 
                              variant="outline" 
                              className="h-20 w-20 rounded-[2rem] border-4 border-dashed border-border dark:border-border bg-transparent flex flex-col gap-4 hover:bg-white dark:hover:bg-muted hover:border-primary hover:text-primary transition-all group shadow-inner"
                              onClick={() => navigate("/core/marketing/automation")}
                            >
                               <Plus className="h-8 w-8 group-hover:rotate-90 transition-transform duration-500" />
                            </Button>
                            <div className="mt-4 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-60">Integrate Strategy</div>
                            <div className="w-[2px] h-10 bg-primary mt-4" />
                         </div>

                         {/* Outcome Node */}
                         <div className="relative group">
                            <Card className="bg-success text-white border-none shadow-[0_20px_40px_-10px_rgba(16,185,129,0.3)] w-80 text-center z-10 relative overflow-hidden rounded-[2rem] group-hover:scale-105 transition-all duration-500">
                               <div className="absolute top-0 right-0 h-32 w-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16" />
                               <CardContent className="p-8 space-y-2">
                                  <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-1">Strategic Outcome</p>
                                  <p className="font-black text-xl uppercase italic tracking-tighter flex items-center justify-center gap-3">
                                     <Target className="h-6 w-6" /> QUALIFICATION GOAL
                                  </p>
                               </CardContent>
                            </Card>
                         </div>
                      </div>
                   </ScrollArea>
                </Card>
             </div>
           ) : (
             <div className="h-full flex flex-col items-center justify-center rounded-[4rem] border-2 border-dashed border-border dark:border-border/20 bg-white/10 dark:bg-muted grayscale opacity-30 space-y-12 animate-in zoom-in duration-1000">
                <div className="relative">
                   <div className="absolute inset-0 bg-primary blur-[100px] rounded-full scale-[3] animate-pulse" />
                   <div className="h-48 w-48 rounded-[4rem] bg-white dark:bg-muted flex items-center justify-center shadow-[0_50px_100px_-20px_rgba(79,70,229,0.3)] relative z-10 border border-border">
                      <Workflow className="h-24 w-24 text-primary drop-shadow-2xl" />
                   </div>
                </div>
                <div className="text-center space-y-4">
                  <h3 className="text-4xl font-black uppercase tracking-tighter italic">Studio Inactive</h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground max-w-[400px] mx-auto leading-relaxed italic italic">Select an automation protocol from the registry to authorize total workflow synchronization.</p>
                </div>
                <Button 
                  className="h-[4.5rem] px-12 rounded-[2.5rem] bg-primary hover:bg-primary shadow-2xl shadow-indigo-500/30 font-black text-sm gap-4 group transition-all hover:scale-105 active:scale-95 text-white"
                  onClick={() => navigate("/core/marketing/automation")}
                >
                  <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform duration-500" />
                  INITIALIZE STRATEGY
                </Button>
             </div>
           )}
        </div>
      </div>
      
      {/* Create Workflow Modal */}
      <CreateWorkflowModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => refresh(true)}
      />
    </div>
  );
}
