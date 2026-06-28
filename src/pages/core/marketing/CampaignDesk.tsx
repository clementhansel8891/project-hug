import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  Megaphone, 
  ShieldCheck, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Calendar, 
  ChevronRight, 
  Plus, 
  Search,
  Filter,
  MoreVertical,
  LayoutGrid,
  List as ListIcon,
  Layers,
  Target,
  Zap,
  Globe,
  ArrowRight,
  Activity,
  RefreshCw,
  PieChart,
  Target as TargetIcon,
  ArrowUpRight,
  Split,
  Box,
  CheckCircle2,
  Clock,
  ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSession } from "@/core/security/session";
import { marketingService } from "@/core/services/marketing/marketingService";
import { formatCurrency } from "@/lib/format";
import { EmptyState } from "@/components/shared/AsyncState";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { MarketingCampaign } from "@/core/types/marketing/marketing";
import { CreateCampaignModal } from "./modals/CreateCampaignModal";
import { UpdateCampaignStatusModal } from "./modals/UpdateCampaignStatusModal";

const OBJECTIVES: MarketingCampaign["objective"][] = [
  "LEAD_GENERATION",
  "AWARENESS",
  "NURTURE",
  "REMARKETING",
];

const CHANNEL_PRESETS: Record<MarketingCampaign["objective"], MarketingCampaign["channelMix"]> = {
  LEAD_GENERATION: ["META_ADS", "GOOGLE_ADS", "LANDING_PAGE"],
  AWARENESS: ["META_ADS", "GOOGLE_ADS", "EVENT"],
  NURTURE: ["EMAIL", "WHATSAPP", "WEBINAR"],
  REMARKETING: ["META_ADS", "GOOGLE_ADS", "EMAIL"],
};

export default function CampaignDesk() {
  const session = useSession();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<MarketingCampaign | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [objective, setObjective] = useState<MarketingCampaign["objective"]>("LEAD_GENERATION");
  const [budget, setBudget] = useState("50000");
  const [startDate, setStartDate] = useState("2026-06-01");
  const [endDate, setEndDate] = useState("2026-06-30");
  const [audience, setAudience] = useState("");

  const refresh = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      const c = await marketingService.listCampaigns(session.tenant_id, session);
      setCampaigns(c);
      if (isManual) toast.success("Campaign telemetry synchronized.");
    } catch (err) {
      console.error("Failed to fetch campaigns:", err);
      toast.error("Telemetry failure in campaign suite.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session.tenant_id, session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(
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

  const handleCreateCampaign = async () => {
    if (!name) {
      toast.error("Campaign designation required.");
      return;
    }
    try {
      setRefreshing(true);
      await marketingService.createCampaign(session.tenant_id, session, {
        name,
        objective,
        channelMix: CHANNEL_PRESETS[objective],
        budget: Number(budget),
        startDate,
        endDate,
        audience,
      });
      setIsWizardOpen(false);
      setWizardStep(1);
      setName("");
      toast.success("Strategic Campaign Injected", {
        description: `"${name}" has been added to the execution cluster.`
      });
      refresh(true);
    } catch (err) {
      toast.error("Campaign injection protocol failure.");
      setRefreshing(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: MarketingCampaign["status"]) => {
    try {
      await marketingService.updateCampaignStatus(session.tenant_id, session, id, status);
      toast.success(`Protocol ${status} successful.`);
      refresh(true);
      setSelectedCampaign(null);
    } catch (err) {
      toast.error("Status update failure.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted dark:bg-muted">
        <div className="flex flex-col items-center gap-6">
          <div className="h-20 w-20 bg-primary rounded-[2.5rem] animate-pulse flex items-center justify-center shadow-2xl shadow-indigo-500/20">
            <Megaphone className="h-10 w-10 text-white" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Orchestrating Strategic Nodes...</p>
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
            <Badge className="bg-primary text-white border-none font-black px-3 py-1 rounded-full uppercase tracking-widest text-[10px]">Growth Orchestration</Badge>
            <div className="flex items-center gap-1.5 text-primary font-bold text-xs uppercase tracking-widest">
               <Activity className="h-4 w-4 animate-pulse" />
               Campaign Cluster Active
            </div>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-foreground">Campaign Desk</h1>
          <p className="text-muted-foreground font-medium max-w-2xl text-lg leading-relaxed italic">"Strategic dominance is won through the coordination of elite channel execution."</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white/50 dark:bg-muted backdrop-blur-xl p-2 rounded-[2rem] border border-border dark:border-border/20 shadow-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-11 h-14 w-[300px] rounded-[1.5rem] bg-transparent border-none focus-visible:ring-0 text-base font-medium"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search cluster..."
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
          <Button 
            className="h-[4.5rem] px-10 rounded-[2rem] bg-primary hover:bg-primary shadow-2xl shadow-indigo-500/30 font-black text-sm gap-3 group transition-all hover:scale-105 active:scale-95"
            onClick={() => setIsWizardOpen(true)}
          >
            <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform duration-500" /> 
            NEW STRATEGIC CAMPAIGN
          </Button>
        </div>
      </div>

      {/* Strategic Metrics Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
         <Card className="rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-muted p-8 space-y-4 group hover:shadow-indigo-500/10 transition-all">
            <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center group-hover:scale-110 transition-transform">
               <Activity className="h-7 w-7 text-primary" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">ACTIVE PROTOCOLS</p>
               <h4 className="text-3xl font-black">{(Array.isArray(campaigns) ? campaigns : []).filter(c => c.status === 'ACTIVE').length}</h4>
               <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1 italic">Cluster Execution Live</p>
            </div>
         </Card>
         <Card className="rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-muted p-8 space-y-4 group hover:shadow-emerald-500/10 transition-all">
            <div className="h-14 w-14 rounded-2xl bg-success flex items-center justify-center group-hover:scale-110 transition-transform">
               <TrendingUp className="h-7 w-7 text-success" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">AVERAGE YIELD</p>
               <h4 className="text-3xl font-black text-success">4.2x ROI</h4>
               <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1 italic">Blended ROI Efficiency</p>
            </div>
         </Card>
         <Card className="rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-muted p-8 space-y-4 group hover:shadow-amber-500/10 transition-all">
            <div className="h-14 w-14 rounded-2xl bg-warning flex items-center justify-center group-hover:scale-110 transition-transform">
               <DollarSign className="h-7 w-7 text-warning" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">BUDGET BURN</p>
               <h4 className="text-3xl font-black text-warning">68%</h4>
               <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1 italic">Utilization Metric</p>
            </div>
         </Card>
         <Card className="rounded-[2.5rem] border-none shadow-xl bg-primary text-white p-8 space-y-4 group hover:shadow-indigo-500/30 transition-all">
            <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center group-hover:scale-110 transition-transform border border-border">
               <Zap className="h-7 w-7 text-white" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest opacity-60">LEAD VELOCITY</p>
               <h4 className="text-3xl font-black">+12.4%</h4>
               <p className="text-[10px] font-bold text-white/60 uppercase mt-1 italic">Growth Delta (Weekly)</p>
            </div>
         </Card>
      </div>

      {/* Main Campaign Registry */}
      <Card className="rounded-[3rem] border-none shadow-2xl glass-card overflow-hidden">
        <Tabs defaultValue="all" className="w-full">
          <CardHeader className="p-10 pb-0">
             <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
                <TabsList className="bg-muted dark:bg-muted p-1.5 rounded-2xl shadow-inner border-none">
                  <TabsTrigger value="all" className="rounded-xl px-6 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg h-10 border-none transition-all">Global Cluster</TabsTrigger>
                  <TabsTrigger value="active" className="rounded-xl px-6 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg h-10 border-none transition-all">Execution Live</TabsTrigger>
                  <TabsTrigger value="draft" className="rounded-xl px-6 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg h-10 border-none transition-all">Strategic Drafts</TabsTrigger>
                </TabsList>

                <div className="flex items-center gap-3 bg-muted dark:bg-muted p-1.5 rounded-2xl shadow-inner">
                   <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn("h-10 w-10 rounded-xl transition-all", view === "grid" ? "bg-white dark:bg-muted shadow-md text-primary" : "text-muted-foreground")}
                      onClick={() => setView("grid")}
                   >
                      <LayoutGrid className="h-5 w-5" />
                   </Button>
                   <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn("h-10 w-10 rounded-xl transition-all", view === "list" ? "bg-white dark:bg-muted shadow-md text-primary" : "text-muted-foreground")}
                      onClick={() => setView("list")}
                   >
                      <ListIcon className="h-5 w-5" />
                   </Button>
                </div>
             </div>
          </CardHeader>

          <TabsContent value="all" className="mt-0 outline-none">
            {view === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 p-10 pt-0">
                {(Array.isArray(filtered) ? filtered : []).map((campaign) => (
                  <Card key={campaign.id} className="group rounded-[2.5rem] border-none bg-white dark:bg-muted shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 overflow-hidden cursor-default relative">
                    <div className={cn("absolute top-0 right-0 h-24 w-24 rounded-full blur-3xl -mr-12 -mt-12 transition-all duration-700 opacity-20", campaign.status === 'ACTIVE' ? "bg-success" : "bg-muted")} />
                    <CardHeader className="p-8 pb-4">
                      <div className="flex justify-between items-start mb-4">
                        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-border dark:border-border text-muted-foreground">
                          {campaign.objective.replace('_', ' ')}
                        </Badge>
                        <Badge className={cn(
                          "rounded-full font-black text-[8px] px-3 py-0.5 border-none shadow-sm uppercase tracking-widest",
                          campaign.status === 'ACTIVE' ? "bg-success text-white shadow-emerald-500/20" : "bg-muted dark:bg-muted text-muted-foreground"
                        )}>
                          {campaign.status}
                        </Badge>
                      </div>
                      <CardTitle className="text-xl font-black uppercase tracking-tight group-hover:text-primary transition-colors">{campaign.name}</CardTitle>
                      <CardDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter line-clamp-1 italic italic">"{campaign.audience}"</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 pt-4 space-y-6">
                      <div className="flex justify-between items-end">
                         <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Yield Allocation</p>
                            <p className="text-xl font-black text-primary">{formatCurrency(campaign.budget, campaign.currency)}</p>
                         </div>
                         <div className="text-right">
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Burn Rate</p>
                            <p className="text-base font-black">72%</p>
                         </div>
                      </div>
                      <div className="h-1.5 w-full bg-muted dark:bg-muted rounded-full overflow-hidden shadow-inner">
                         <div className="h-full bg-primary rounded-full shadow-lg" style={{ width: '72%' }} />
                      </div>
                      <div className="flex flex-wrap gap-2 pt-2">
                        {(Array.isArray(campaign.channelMix) ? campaign.channelMix : []).map(ch => (
                          <Badge key={ch} variant="secondary" className="rounded-full text-[8px] font-black px-2 py-0 h-4 border-none bg-muted dark:bg-muted text-muted-foreground">{ch}</Badge>
                        ))}
                      </div>
                      <div className="flex items-center justify-between pt-6 border-t border-border dark:border-border">
                         <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 rounded-xl ring-2 ring-white dark:ring-slate-900">
                              <AvatarFallback className="text-[10px] font-black bg-primary text-white">
                                {campaign.ownerName.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <p className="text-[10px] font-black uppercase tracking-tight text-muted-foreground">Custodian {campaign.ownerName.split(' ')[0]}</p>
                         </div>
                         <Button 
                            variant="ghost" 
                            className="rounded-xl h-10 px-4 font-black text-[10px] uppercase tracking-widest text-primary hover:bg-primary gap-2"
                            onClick={() => setSelectedCampaign(campaign)}
                         >
                           DETAILS <ChevronRight className="h-3.5 w-3.5" />
                         </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {(Array.isArray(filtered) ? filtered : []).length === 0 && (
                  <EmptyState
                    className="col-span-full"
                    title="No campaigns found"
                    description="No strategic campaigns match the current search in this tenant scope."
                  />
                )}
              </div>
            ) : (
              <div className="px-10 pb-10 overflow-x-auto pt-0">
                <table className="w-full">
                  <thead className="bg-muted dark:bg-muted">
                    <tr>
                      <th className="px-6 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Strategic Node</th>
                      <th className="px-6 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Objective</th>
                      <th className="px-6 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Budget Yield</th>
                      <th className="px-6 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Efficiency</th>
                      <th className="px-6 py-6 text-right text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border dark:divide-slate-800/10">
                    {(Array.isArray(filtered) ? filtered : []).map((campaign) => (
                      <tr key={campaign.id} className="group hover:bg-white/60 dark:hover:bg-muted transition-all cursor-default">
                        <td className="px-6 py-8">
                           <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                                 <Rocket className="h-5 w-5" />
                              </div>
                              <div>
                                 <p className="font-black text-sm uppercase tracking-tight">{campaign.name}</p>
                                 <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">OWNER: {campaign.ownerName}</p>
                              </div>
                           </div>
                        </td>
                        <td className="px-6 py-8">
                           <Badge variant="outline" className="rounded-full font-black text-[8px] px-3 py-1 border-border dark:border-border uppercase tracking-widest text-muted-foreground">{campaign.objective}</Badge>
                        </td>
                        <td className="px-6 py-8">
                           <p className="text-sm font-black text-primary">{formatCurrency(campaign.budget, campaign.currency)}</p>
                        </td>
                        <td className="px-6 py-8">
                           <div className="flex items-center gap-3 w-[150px]">
                              <div className="h-1.5 w-full bg-muted dark:bg-muted rounded-full overflow-hidden shadow-inner">
                                 <div className="h-full bg-primary w-[45%] transition-all duration-1000" />
                              </div>
                              <span className="text-[10px] font-black text-muted-foreground">45%</span>
                           </div>
                        </td>
                        <td className="px-6 py-8 text-right">
                           <Badge variant={campaign.status === 'ACTIVE' ? 'default' : 'secondary'} className={cn("rounded-full font-black text-[8px] uppercase tracking-widest", campaign.status === 'ACTIVE' ? "bg-success" : "bg-muted dark:bg-muted text-muted-foreground")}>
                             {campaign.status}
                           </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(Array.isArray(filtered) ? filtered : []).length === 0 && (
                  <EmptyState
                    title="No campaigns found"
                    description="No strategic campaigns match the current search in this tenant scope."
                  />
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Create Campaign Modal */}
      <CreateCampaignModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onSuccess={() => refresh(true)}
      />

      {/* Detail Overlay */}
      <Dialog open={!!selectedCampaign} onOpenChange={() => setSelectedCampaign(null)}>
        <DialogContent className="max-w-6xl border-none bg-white dark:bg-muted p-0 overflow-hidden shadow-2xl rounded-[3rem]">
           {selectedCampaign && (
             <div className="grid grid-cols-12 min-h-[600px]">
                <div className="col-span-4 bg-muted dark:bg-muted p-10 flex flex-col justify-between border-r border-border dark:border-border">
                   <div className="space-y-8">
                      <div className="flex items-center gap-3">
                         <Badge className="bg-primary text-white font-black text-[9px] px-3 py-1 uppercase tracking-widest rounded-full">{selectedCampaign.status}</Badge>
                         <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Node: {selectedCampaign.id.slice(-8)}</p>
                      </div>
                      
                      <div className="space-y-2">
                         <h2 className="text-4xl font-black tracking-tighter uppercase leading-tight italic">{selectedCampaign.name}</h2>
                         <p className="text-sm font-medium text-muted-foreground italic">"{selectedCampaign.audience}"</p>
                      </div>
                      
                      <div className="space-y-6 pt-4">
                         <div className="flex items-center gap-4 group">
                            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                               <TargetIcon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                               <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Objective</p>
                               <span className="text-sm font-black uppercase">{selectedCampaign.objective.replace('_', ' ')}</span>
                            </div>
                         </div>
                         <div className="flex items-center gap-4 group">
                            <div className="h-10 w-10 rounded-xl bg-warning flex items-center justify-center group-hover:scale-110 transition-transform">
                               <Calendar className="h-5 w-5 text-warning" />
                            </div>
                            <div>
                               <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Tactical Horizon</p>
                               <span className="text-sm font-black uppercase tracking-tighter">{selectedCampaign.startDate} — {selectedCampaign.endDate}</span>
                            </div>
                         </div>
                         <div className="space-y-3">
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Channel Matrix</p>
                            <div className="flex gap-2 flex-wrap">
                               {(Array.isArray(selectedCampaign.channelMix) ? selectedCampaign.channelMix : []).map(ch => (
                                 <Badge key={ch} variant="outline" className="text-[9px] font-black uppercase px-2 py-0 h-5 border-border dark:border-border text-muted-foreground">{ch}</Badge>
                               ))}
                            </div>
                         </div>
                      </div>
                   </div>
                   
                   <div className="bg-white dark:bg-muted p-8 rounded-[2rem] border border-border dark:border-border shadow-xl space-y-4">
                      <div className="flex justify-between items-end">
                         <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Yield Multiple</p>
                            <p className="text-3xl font-black text-success">4.8x ROI</p>
                         </div>
                         <ArrowUpRight className="h-6 w-6 text-success" />
                      </div>
                      <div className="h-2 w-full bg-muted dark:bg-muted rounded-full overflow-hidden shadow-inner">
                         <div className="h-full bg-success w-[85%] transition-all duration-1000 shadow-lg" />
                      </div>
                   </div>
                </div>
                
                <div className="col-span-8 flex flex-col bg-white dark:bg-muted">
                   <div className="p-10 border-b border-border dark:border-border flex items-center justify-between bg-white/50 dark:bg-muted backdrop-blur-md relative z-10">
                      <div className="flex gap-12">
                         <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Global Budget</p>
                            <p className="text-2xl font-black text-primary">{formatCurrency(selectedCampaign.budget, selectedCampaign.currency)}</p>
                         </div>
                         <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Current Spend</p>
                            <p className="text-2xl font-black">Rp 12,4jt</p>
                         </div>
                         <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Leads</p>
                            <p className="text-2xl font-black">428</p>
                         </div>
                      </div>
                      <div className="flex gap-3">
                         <Button 
                            className="rounded-2xl h-12 px-8 bg-success hover:bg-success font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20" 
                            onClick={() => handleUpdateStatus(selectedCampaign.id, "ACTIVE")}
                         >
                            ACTIVATE NODE
                         </Button>
                         <Button 
                            variant="destructive" 
                            className="rounded-2xl h-12 px-8 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-500/20"
                            onClick={() => handleUpdateStatus(selectedCampaign.id, "PAUSED")}
                         >
                            PAUSE EXECUTION
                         </Button>
                      </div>
                   </div>
                   
                   <ScrollArea className="flex-1 p-10">
                      <div className="space-y-10">
                         <div className="grid grid-cols-2 gap-8">
                            <Card className="rounded-[2rem] border-none bg-muted dark:bg-muted p-8 space-y-4 group">
                               <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                     <Globe className="h-4 w-4 text-primary" /> Web Velocity
                                  </h4>
                                  <Badge className="bg-success text-white font-black text-[8px]">+8.4%</Badge>
                               </div>
                               <p className="text-4xl font-black tracking-tighter">12.5k <span className="text-sm font-bold text-muted-foreground uppercase">Hits</span></p>
                            </Card>
                            <Card className="rounded-[2rem] border-none bg-muted dark:bg-muted p-8 space-y-4 group">
                               <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                     <Zap className="h-4 w-4 text-warning" /> Conversion Ratio
                                  </h4>
                                  <p className="text-[10px] font-black uppercase text-muted-foreground italic">NOMINAL</p>
                               </div>
                               <p className="text-4xl font-black tracking-tighter">3.2% <span className="text-sm font-bold text-muted-foreground uppercase">Rate</span></p>
                            </Card>
                         </div>
                         
                         <div className="space-y-6">
                            <div className="flex items-center justify-between">
                               <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-3">
                                  <Clock className="h-5 w-5 text-primary" />
                                  Real-time Activity Stream
                               </h3>
                               <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Live Telemetry</p>
                            </div>
                            <div className="space-y-4">
                               {[1, 2, 3].map(i => (
                                 <div key={i} className="flex gap-6 items-start p-6 rounded-[1.5rem] hover:bg-muted dark:hover:bg-muted transition-all group">
                                    <div className="h-10 w-10 rounded-xl bg-white dark:bg-muted flex items-center justify-center shrink-0 shadow-sm group-hover:bg-primary group-hover:text-white transition-all">
                                       <Zap className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                       <div className="flex justify-between items-center">
                                          <p className="text-sm font-black uppercase tracking-tight">Lead Injection Detected</p>
                                          <span className="text-[10px] font-bold text-muted-foreground uppercase">2H AGO</span>
                                       </div>
                                       <p className="text-xs font-medium text-muted-foreground italic leading-relaxed">System identified a high-intent conversion event from the Google Ads cluster in the Enterprise Segment.</p>
                                    </div>
                                 </div>
                               ))}
                            </div>
                         </div>
                      </div>
                   </ScrollArea>
                   
                   <div className="p-8 border-t border-border dark:border-border bg-muted dark:bg-muted flex justify-end">
                      <Button variant="ghost" className="rounded-xl h-10 px-8 font-black text-[10px] uppercase tracking-widest text-muted-foreground" onClick={() => setSelectedCampaign(null)}>CLOSE PROTOCOL</Button>
                   </div>
                </div>
             </div>
           )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
