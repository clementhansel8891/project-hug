import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  Play, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Server, 
  Activity, 
  Cpu, 
  BarChart3, 
  Plus, 
  Search,
  MoreVertical,
  History,
  Zap,
  Globe,
  Radio,
  Settings,
  RefreshCw,
  Rocket,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Target,
  Box,
  Layers,
  Terminal,
  ActivitySquare
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
import { Progress } from "@/components/ui/progress";
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
import type { CampaignExecutionRun, MarketingCampaign } from "@/core/types/marketing/marketing";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { EmptyState } from "@/components/shared/AsyncState";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ScheduleExecutionModal } from "./modals/ScheduleExecutionModal";

const CHANNELS: CampaignExecutionRun["channel"][] = [
  "META_ADS",
  "GOOGLE_ADS",
  "EMAIL",
  "WHATSAPP",
  "WEBINAR",
  "LANDING_PAGE",
  "EVENT",
];

export default function ExecutionDesk() {
  const navigate = useNavigate();
  const session = useSession();
  const [search, setSearch] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [channel, setChannel] = useState<CampaignExecutionRun["channel"]>("META_ADS");
  const [scheduledAt, setScheduledAt] = useState(
    new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString().slice(0, 16),
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [executions, setExecutions] = useState<CampaignExecutionRun[]>([]);
  const [runOpen, setRunOpen] = useState(false);

  const refresh = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      const [c, e] = await Promise.all([
        marketingService.listCampaigns(session.tenant_id, session),
        marketingService.listExecutions(session.tenant_id, session),
      ]);
      setCampaigns(c);
      setExecutions(e);
      if (c.length > 0 && !campaignId) {
        setCampaignId(c[0].id);
      }
      if (isManual) toast.success("Execution matrix synchronized.");
    } catch (err) {
      console.error("Failed to fetch execution desk data:", err);
      toast.error("Telemetry failure in execution suite.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session.tenant_id, campaignId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(
    () =>
      (Array.isArray(executions) ? executions : []).filter((item) =>
        search
          ? `${item.id} ${item.channel} ${item.status}`.toLowerCase().includes(search.toLowerCase())
          : true,
      ),
    [executions, search],
  );

  const handleInitializeRun = async () => {
    if (!campaignId) {
      toast.error("Strategic campaign selection required.");
      return;
    }
    try {
      setRefreshing(true);
      await marketingService.scheduleExecution(session.tenant_id, session, {
        campaignId,
        channel,
        scheduledAt: new Date(scheduledAt).toISOString(),
      });
      setRunOpen(false);
      toast.success("Strategic Run Initialized", {
        description: `${channel} protocol scheduled for ${formatDateTime(scheduledAt)}.`
      });
      refresh(true);
    } catch (err) {
      toast.error("Initialization failure.");
      setRefreshing(false);
    }
  };

  const handleExecuteNow = async (id: string) => {
    try {
      setRefreshing(true);
      await marketingService.runExecution(session.tenant_id, session, id);
      toast.success("Immediate Dispatch Authorized", {
        description: "Payload transmission is now live in the global matrix."
      });
      refresh(true);
    } catch (err) {
      toast.error("Dispatch authorization failure.");
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted dark:bg-muted">
        <div className="flex flex-col items-center gap-6">
          <div className="h-20 w-20 bg-primary rounded-[2.5rem] animate-pulse flex items-center justify-center shadow-2xl shadow-indigo-500/20">
             <Rocket className="h-10 w-10 text-white" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Booting Execution Control...</p>
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
            <Badge className="bg-primary text-white border-none font-black px-3 py-1 rounded-full uppercase tracking-widest text-[10px]">Mission Control</Badge>
            <div className="flex items-center gap-1.5 text-primary font-bold text-xs uppercase tracking-widest">
               <Activity className="h-4 w-4 animate-pulse" />
               Engine V4.2 Online
            </div>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-foreground text-left italic">Execution Desk</h1>
          <p className="text-muted-foreground font-medium max-w-2xl text-lg leading-relaxed italic text-left">"Orchestrate multi-channel campaign dispatch with total operational command."</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Search strategic runs..." 
              className="pl-12 h-14 bg-muted0 dark:bg-muted backdrop-blur-xl border-none shadow-inner rounded-2xl min-w-[300px] font-bold text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            className="h-14 w-14 rounded-2xl bg-card dark:bg-muted border-none shadow-xl hover:scale-110 transition-all"
            onClick={() => refresh(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-6 w-6 text-primary", refreshing && "animate-spin")} />
          </Button>
          <Button 
            className="h-[4.5rem] px-10 rounded-[2rem] bg-primary hover:bg-primary shadow-2xl shadow-indigo-500/30 font-black text-sm gap-3 group transition-all hover:scale-105 active:scale-95 text-white"
            onClick={() => navigate("/core/marketing/automation")}
          >
            <Play className="h-6 w-6 group-hover:scale-110 transition-transform" /> 
            RUN AUTOMATION
          </Button>
          <Button 
            variant="outline"
            className="h-[4.5rem] px-10 rounded-[2rem] border-border dark:border-border bg-card dark:bg-muted shadow-2xl font-black text-sm gap-3 group transition-all hover:scale-105 active:scale-95"
            onClick={() => setRunOpen(true)}
          >
            <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform duration-500" /> 
            SCHEDULE DISPATCH
          </Button>
        </div>
      </div>

      {/* Channel Health Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
         {[
           { name: 'Meta Ads', status: 'Healthy', color: 'text-success', icon: Globe },
           { name: 'Google Ads', status: 'Healthy', color: 'text-success', icon: Zap },
           { name: 'Email API', status: 'Warning', color: 'text-warning', icon: Radio },
           { name: 'WhatsApp', status: 'Healthy', color: 'text-success', icon: Activity }
         ].map(ch => (
           <Card key={ch.name} className="rounded-[2rem] border-none shadow-xl glass-card group hover:shadow-2xl transition-all">
              <CardContent className="p-6 flex items-center gap-4">
                 <div className="h-12 w-12 rounded-2xl bg-card dark:bg-muted flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <ch.icon className="h-6 w-6 text-primary" />
                 </div>
                 <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest italic">{ch.name}</p>
                    <div className="flex items-center gap-2">
                       <span className={cn("h-2 w-2 rounded-full animate-pulse", ch.color.replace('text', 'bg'))} />
                       <span className={cn("text-xs font-black uppercase tracking-tighter", ch.color)}>{ch.status}</span>
                    </div>
                 </div>
              </CardContent>
           </Card>
         ))}
      </div>

      <div className="grid grid-cols-12 gap-10 flex-1 min-h-0">
         {/* Left: Execution Matrix */}
         <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
            <Card className="flex-1 rounded-[3rem] border-none shadow-2xl glass-card overflow-hidden flex flex-col">
               <CardHeader className="p-10 pb-6 border-b border-border dark:border-border/10 flex flex-row items-center justify-between">
                  <div className="space-y-1">
                     <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-3 uppercase italic">
                        <Layers className="h-6 w-6 text-primary" />
                        Run History & Queue
                     </CardTitle>
                     <CardDescription className="text-xs font-medium italic italic">Monitor scheduled and past execution performance across the grid.</CardDescription>
                  </div>
                  <Badge variant="outline" className="rounded-full font-black text-[9px] px-3 py-1 border-border dark:border-border uppercase tracking-widest text-muted-foreground">LIVE FEED</Badge>
               </CardHeader>
               <ScrollArea className="flex-1">
                  <div className="p-0">
                    <table className="w-full text-sm">
                       <thead className="bg-muted dark:bg-muted text-[10px] uppercase text-muted-foreground sticky top-0 z-10 font-black tracking-[0.2em] italic">
                          <tr>
                             <th className="p-8 text-left">Strategic Campaign</th>
                             <th className="p-8 text-left">Channel</th>
                             <th className="p-8 text-left">Schedule</th>
                             <th className="p-8 text-left">Yield Matrix</th>
                             <th className="p-8 text-left">Status</th>
                             <th className="p-8 text-right">Actions</th>
                          </tr>
                       </thead>
                       <tbody>
                          {(Array.isArray(filtered) ? filtered : []).map((run) => (
                            <tr key={run.id} className="border-t border-border dark:border-border/10 group hover:bg-primary transition-all">
                               <td className="p-8">
                                  <div className="flex items-center gap-4">
                                     <div className="h-12 w-12 rounded-xl bg-primary text-primary flex items-center justify-center shadow-sm">
                                        <Target className="h-6 w-6" />
                                     </div>
                                     <div className="space-y-0.5">
                                        <p className="font-black uppercase tracking-tight italic group-hover:text-primary transition-colors">
                                           {campaigns.find(c => c.id === run.campaignId)?.name || "Unknown Protocol"}
                                        </p>
                                        <div className="text-[9px] text-muted-foreground font-black uppercase tracking-widest opacity-60 flex items-center gap-2 italic">
                                           <Hash className="h-3 w-3" /> ID: {run.id.slice(0, 8)}
                                        </div>
                                     </div>
                                  </div>
                               </td>
                               <td className="p-8">
                                  <Badge className="bg-muted dark:bg-muted text-muted-foreground font-black text-[9px] px-3 py-1 rounded-full border-none uppercase tracking-widest">
                                     {run.channel}
                                  </Badge>
                               </td>
                               <td className="p-8">
                                  <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground italic">
                                     <Clock className="h-4 w-4 text-primary" />
                                     {formatDateTime(run.scheduledAt, "short", "short")}
                                  </div>
                               </td>
                               <td className="p-8">
                                  <div className="space-y-3 min-w-[120px]">
                                     <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                        <span className="text-muted-foreground italic">{run.leadsGenerated} Leads</span>
                                        <span className="text-success italic">{formatCurrency(run.spend)}</span>
                                     </div>
                                     <div className="h-1.5 w-full bg-muted dark:bg-muted rounded-full overflow-hidden shadow-inner">
                                        <Progress value={Math.min(100, (run.leadsGenerated / 50) * 100)} className="h-full bg-primary transition-all duration-1000" />
                                     </div>
                                  </div>
                               </td>
                               <td className="p-8">
                                  <Badge className={cn(
                                    "text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border-none shadow-sm",
                                    run.status === 'COMPLETED' ? "bg-success text-white shadow-emerald-500/20" :
                                    run.status === 'FAILED' ? "bg-destructive text-white shadow-rose-500/20" : "bg-muted dark:bg-muted text-muted-foreground"
                                  )}>
                                     {run.status}
                                  </Badge>
                               </td>
                               <td className="p-8 text-right">
                                  <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                     <Button 
                                       size="icon" 
                                       className="h-10 w-10 rounded-xl bg-primary text-white shadow-lg shadow-indigo-500/20 hover:scale-110 active:scale-95 transition-all" 
                                       onClick={() => handleExecuteNow(run.id)}
                                     >
                                        <Play className="h-4 w-4" />
                                     </Button>
                                     <Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl hover:bg-muted dark:hover:bg-muted">
                                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                                     </Button>
                                  </div>
                               </td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                    {(Array.isArray(filtered) ? filtered : []).length === 0 && (
                      <EmptyState
                        title="No execution runs"
                        description="No scheduled or past dispatch runs match the current view in this tenant scope."
                        icon={Rocket}
                      />
                    )}
                  </div>
               </ScrollArea>
            </Card>
         </div>

         {/* Right: Runtime Intelligence */}
         <div className="col-span-12 lg:col-span-4 flex flex-col gap-10">
            <Card className="rounded-[3rem] border-none shadow-2xl bg-primary text-white p-10 relative overflow-hidden group">
               <div className="absolute top-0 right-0 h-40 w-40 bg-muted rounded-full blur-3xl -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-1000" />
               <div className="relative z-10 space-y-8">
                  <div className="flex items-center gap-4">
                     <div className="h-14 w-14 bg-primary rounded-2xl flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-transform">
                        <Cpu className="h-7 w-7 text-white" />
                     </div>
                     <div>
                        <h4 className="font-black text-xl uppercase tracking-tighter italic">Orchestrator</h4>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Tactical Dispatch Node</p>
                     </div>
                  </div>
                  <p className="text-sm font-medium italic italic opacity-70 leading-relaxed italic">
                     "Campaign runs are currently optimized for <strong>High-Conversion Windows</strong>. Automated sync with Google Ads is live."
                  </p>
                  <Button 
                    className="w-full h-16 bg-card text-primary hover:bg-muted border-none rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl gap-3 group/btn"
                    onClick={() => setRunOpen(true)}
                  >
                     <Plus className="h-5 w-5 group-hover/btn:rotate-90 transition-transform duration-500" />
                     INITIALIZE NEW RUN
                  </Button>
               </div>
            </Card>

            <Card className="flex-1 rounded-[3rem] border-none shadow-2xl bg-muted overflow-hidden flex flex-col group/terminal">
               <CardHeader className="p-8 pb-4 border-b border-border flex flex-row items-center justify-between bg-secondary">
                  <div className="flex items-center gap-3">
                     <Terminal className="h-4 w-4 text-success" />
                     <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground italic">
                        Runtime Logs
                     </CardTitle>
                  </div>
                  <div className="flex gap-1.5">
                     <div className="h-2 w-2 rounded-full bg-destructive" />
                     <div className="h-2 w-2 rounded-full bg-warning" />
                     <div className="h-2 w-2 rounded-full bg-success" />
                  </div>
               </CardHeader>
               <ScrollArea className="flex-1 bg-black/95 p-8 font-mono text-[10px] leading-relaxed">
                  <div className="space-y-3 opacity-80">
                     <p className="text-primary flex items-center gap-2"><ChevronRight className="h-3 w-3" /> [SYSTEM] INITIALIZING EXECUTION ENGINE V4.2.0</p>
                     <p className="text-success flex items-center gap-2"><ChevronRight className="h-3 w-3" /> [INFO] ALL CHANNEL GATEWAYS CONFIRMED HEALTHY</p>
                     <p className="text-muted-foreground flex items-center gap-2"><ChevronRight className="h-3 w-3" /> [IDLE] WAITING FOR NEXT STRATEGIC DISPATCH...</p>
                     <p className="text-warning flex items-center gap-2"><ChevronRight className="h-3 w-3" /> [WARN] HIGH LATENCY DETECTED ON EMAIL API GATEWAY</p>
                     <p className="text-success flex items-center gap-2"><ChevronRight className="h-3 w-3" /> [SUCCESS] AUTOMATED SYNC WITH GOOGLE ADS COMPLETED</p>
                     <p className="text-primary flex items-center gap-2"><ChevronRight className="h-3 w-3" /> [META] PIXEL HANDSHAKE VERIFIED FOR PI-442</p>
                     <div className="flex gap-1.5 items-center animate-pulse pt-2">
                        <span className="w-1.5 h-3 bg-success" />
                        <span className="text-[8px] font-black text-success uppercase tracking-widest italic opacity-50">LISTENING FOR EVENTS...</span>
                     </div>
                  </div>
               </ScrollArea>
            </Card>
         </div>
      </div>

      {/* Schedule Execution Modal */}
      <ScheduleExecutionModal
        isOpen={runOpen}
        onClose={() => setRunOpen(false)}
        campaigns={campaigns.map(c => ({ id: c.id, name: c.name }))}
        onSuccess={() => refresh(true)}
      />
    </div>
  );
}

function Label({ className, children, ...props }: any) {
  return (
    <label className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)} {...props}>
      {children}
    </label>
  );
}

function Hash({ className }: any) {
   return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
         <line x1="4" y1="9" x2="20" y2="9" />
         <line x1="4" y1="15" x2="20" y2="15" />
         <line x1="10" y1="3" x2="8" y2="21" />
         <line x1="16" y1="3" x2="14" y2="21" />
      </svg>
   );
}
