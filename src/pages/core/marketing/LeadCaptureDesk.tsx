import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  Users, 
  Target, 
  Zap, 
  ArrowUpRight, 
  Filter, 
  Search, 
  MoreHorizontal, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  Phone,
  Mail,
  Building2,
  TrendingUp,
  Clock,
  RefreshCw,
  Plus,
  ShieldCheck,
  ChevronRight,
  Activity,
  Rocket,
  Globe,
  PieChart,
  Layers,
  Box,
  Fingerprint
} from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import type { MarketingLead, MarketingCampaign } from "@/core/types/marketing/marketing";
import { EmptyState } from "@/components/shared/AsyncState";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CaptureLeadModal } from "./modals/CaptureLeadModal";

const SOURCES: MarketingLead["source"][] = [
  "LANDING_PAGE",
  "EMBEDDED_FORM",
  "CHATBOT",
  "WEBINAR",
  "META_LEAD_ADS",
  "GOOGLE_ADS",
  "PARTNER_API",
];

export default function LeadCaptureDesk() {
  const session = useSession();
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<MarketingLead["source"]>("LANDING_PAGE");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [industry, setIndustry] = useState("Retail");
  const [employeeBand, setEmployeeBand] = useState("51-200");
  const [campaignId, setCampaignId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leads, setLeads] = useState<MarketingLead[]>([]);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [captureOpen, setCaptureOpen] = useState(false);

  const refresh = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      const [l, c] = await Promise.all([
        marketingService.listLeads(session.tenant_id, session),
        marketingService.listCampaigns(session.tenant_id, session),
      ]);
      setLeads(l);
      setCampaigns(c);
      if (c.length > 0 && !campaignId) {
        setCampaignId(c[0].id);
      }
      if (isManual) toast.success("Intelligence registry synchronized.");
    } catch (err) {
      console.error("Failed to fetch lead capture data:", err);
      toast.error("Telemetry failure in capture suite.");
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
      (Array.isArray(leads) ? leads : []).filter((item) =>
        search
          ? `${item.companyName} ${item.contactName} ${item.source} ${item.status}`
              .toLowerCase()
              .includes(search.toLowerCase())
          : true,
      ),
    [leads, search],
  );

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success bg-success";
    if (score >= 60) return "text-warning bg-warning";
    return "text-destructive bg-destructive";
  };

  const handleCapture = async () => {
    if (!companyName || !contactName) {
      toast.error("Company and Contact designation required.");
      return;
    }
    try {
      setRefreshing(true);
      await marketingService.captureLead(session.tenant_id, session, {
        source,
        companyName,
        contactName,
        email,
        campaignId,
        industry,
        employeeBand,
      });
      setCaptureOpen(false);
      setCompanyName("");
      setContactName("");
      setEmail("");
      toast.success("Lead Ingested & Scored", {
        description: `Entity ${companyName} has been authorized for strategic nurturing.`
      });
      refresh(true);
    } catch (err) {
      toast.error("Ingestion failure.");
      setRefreshing(false);
    }
  };

  const handleHandoff = async (id: string) => {
    try {
      setRefreshing(true);
      await marketingService.markLeadHandoffReady(session.tenant_id, session, id);
      toast.success("Strategic Handoff Authorized", {
        description: "Entity has been transitioned to Sales Core for final conversion."
      });
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
             <Fingerprint className="h-10 w-10 text-white" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Booting Intelligence Ingestion...</p>
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
            <Badge className="bg-primary text-white border-none font-black px-3 py-1 rounded-full uppercase tracking-widest text-[10px]">Strategic Ingestion</Badge>
            <div className="flex items-center gap-1.5 text-primary font-bold text-xs uppercase tracking-widest">
               <Activity className="h-4 w-4 animate-pulse" />
               Scoring Matrix Active
            </div>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-foreground text-left italic">Lead Capture</h1>
          <p className="text-muted-foreground font-medium max-w-2xl text-lg leading-relaxed italic text-left">"Intelligent ingestion engine authorizing high-intent entities for strategic conversion."</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Search entity matrix..." 
              className="pl-12 h-14 bg-white/50 dark:bg-muted backdrop-blur-xl border-none shadow-inner rounded-2xl min-w-[300px] font-bold text-sm"
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
          <Button 
            className="h-[4.5rem] px-10 rounded-[2rem] bg-primary hover:bg-primary shadow-2xl shadow-indigo-500/30 font-black text-sm gap-3 group transition-all hover:scale-105 active:scale-95"
            onClick={() => setCaptureOpen(true)}
          >
            <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform duration-500" /> 
            AUTHORIZE ENTRY
          </Button>
        </div>
      </div>

      {/* Top Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Ingestion Today', val: '24', icon: Users, color: 'text-primary' },
          { label: 'Avg Intelligence', val: '72', icon: Zap, color: 'text-warning' },
          { label: 'Qualified Rate', val: '35%', icon: Target, color: 'text-success' },
          { label: 'Handoff Ready', val: '8', icon: Rocket, color: 'text-primary' },
        ].map((stat, i) => (
          <Card key={i} className="rounded-[2.5rem] border-none shadow-xl glass-card group hover:shadow-2xl transition-all">
            <CardContent className="p-8 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground italic leading-none">{stat.label}</p>
                <p className={cn("text-3xl font-black tracking-tighter uppercase italic leading-none", stat.color)}>{stat.val}</p>
              </div>
              <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform", stat.color.replace('text', 'bg').replace('600', '100').replace('500', '100'))}>
                <stat.icon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-10 flex-1 min-h-0">
        {/* Left: Intelligence Feed */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
           <Card className="flex-1 rounded-[3rem] border-none shadow-2xl glass-card overflow-hidden flex flex-col">
              <CardHeader className="p-10 pb-6 border-b border-border dark:border-border/10 flex flex-row items-center justify-between">
                 <div className="space-y-1">
                    <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-3 uppercase italic">
                       <Layers className="h-6 w-6 text-primary" />
                       Intelligence Feed
                    </CardTitle>
                    <CardDescription className="text-xs font-medium italic italic">Real-time queue of incoming entities and their strategic scores.</CardDescription>
                 </div>
                 <Badge variant="outline" className="rounded-full font-black text-[9px] px-3 py-1 border-border dark:border-border uppercase tracking-widest text-muted-foreground flex gap-2">
                   <Clock className="h-3 w-3 animate-pulse" /> LIVE SYNCING
                 </Badge>
              </CardHeader>
              <ScrollArea className="flex-1">
                 <div className="p-0">
                    <table className="w-full text-sm">
                       <thead className="bg-muted dark:bg-muted text-[10px] uppercase text-muted-foreground sticky top-0 z-10 font-black tracking-[0.2em] italic">
                          <tr>
                             <th className="p-8 text-left">Target Entity</th>
                             <th className="p-8 text-left">Source / Matrix</th>
                             <th className="p-8 text-left">Intelligence IQ</th>
                             <th className="p-8 text-left">Status</th>
                             <th className="p-8 text-right">Actions</th>
                          </tr>
                       </thead>
                       <tbody>
                          {(Array.isArray(filtered) ? filtered : []).map((lead) => (
                            <tr key={lead.id} className="border-t border-border dark:border-border/10 group hover:bg-primary transition-all">
                               <td className="p-8">
                                  <div className="flex items-center gap-4">
                                     <Avatar className="h-14 w-14 rounded-2xl shadow-xl ring-2 ring-white/10 transition-transform duration-500 group-hover:scale-110">
                                        <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-sm italic">
                                           {lead.companyName[0]}{lead.contactName[0]}
                                        </AvatarFallback>
                                     </Avatar>
                                     <div className="space-y-1">
                                        <div className="font-black uppercase tracking-tight italic flex items-center gap-3 text-muted-foreground dark:text-white group-hover:text-primary transition-colors">
                                           {lead.companyName}
                                           <Link to={`/core/marketing/customer-360?id=${lead.id}`}>
                                             <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all hover:text-primary" />
                                           </Link>
                                        </div>
                                        <div className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-60 italic">{lead.contactName}</div>
                                     </div>
                                  </div>
                               </td>
                               <td className="p-8">
                                  <div className="flex flex-col gap-2">
                                     <Badge className="bg-muted dark:bg-muted text-muted-foreground font-black text-[9px] px-3 py-1 rounded-full border-none uppercase tracking-widest w-fit">
                                        {lead.source}
                                     </Badge>
                                     <span className="text-[9px] text-muted-foreground font-black uppercase tracking-tighter italic opacity-60 truncate max-w-[120px]">
                                        {campaigns.find(c => c.id === lead.campaignId)?.name || "DIRECT PROTOCOL"}
                                     </span>
                                  </div>
                               </td>
                               <td className="p-8">
                                  <div className="flex items-center gap-6">
                                     <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center font-black text-xs shadow-lg", getScoreColor(lead.score))}>
                                        {lead.score}
                                     </div>
                                     <div className="flex-1 space-y-2 min-w-[100px]">
                                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest italic">
                                           <span className="text-muted-foreground">Intent IQ</span>
                                           <span className={lead.intent === 'HIGH' ? 'text-success' : 'text-muted-foreground'}>{lead.intent}</span>
                                        </div>
                                        <div className="h-1 w-full bg-muted dark:bg-muted rounded-full overflow-hidden shadow-inner">
                                           <Progress value={lead.score} className="h-full bg-primary transition-all duration-1000" />
                                        </div>
                                     </div>
                                  </div>
                               </td>
                               <td className="p-8">
                                  <Badge className={cn(
                                    "text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border-none shadow-sm",
                                    lead.status === 'HANDOFF_READY' ? "bg-success text-white shadow-emerald-500/20" : 
                                    lead.status === 'QUALIFIED' ? "bg-primary text-white shadow-indigo-500/20" : "bg-muted dark:bg-muted text-muted-foreground"
                                  )}>
                                     {lead.status.replace('_', ' ')}
                                  </Badge>
                               </td>
                               <td className="p-8 text-right">
                                  <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                     <Button 
                                       size="icon" 
                                       className="h-10 w-10 rounded-xl bg-success text-white shadow-lg shadow-emerald-500/20 hover:scale-110 active:scale-95 transition-all" 
                                       onClick={() => handleHandoff(lead.id)}
                                     >
                                        <CheckCircle2 className="h-5 w-5" />
                                     </Button>
                                     <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl hover:bg-muted dark:hover:bg-muted"><MoreHorizontal className="h-4 w-4 text-muted-foreground" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 border-none shadow-2xl">
                                           <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest opacity-50 px-3 py-2">Entity Actions</DropdownMenuLabel>
                                           <DropdownMenuSeparator />
                                           <DropdownMenuItem className="gap-3 py-3 rounded-xl font-bold"><ShieldCheck className="h-4 w-4" /> Verify IQ Data</DropdownMenuItem>
                                           <DropdownMenuItem className="gap-3 py-3 rounded-xl font-bold"><TrendingUp className="h-4 w-4" /> Manual Scoring</DropdownMenuItem>
                                           <DropdownMenuSeparator />
                                           <DropdownMenuItem className="gap-3 text-destructive py-3 rounded-xl font-bold"><AlertCircle className="h-4 w-4" /> Mark as Spore/Fraud</DropdownMenuItem>
                                        </DropdownMenuContent>
                                     </DropdownMenu>
                                  </div>
                               </td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                    {(Array.isArray(filtered) ? filtered : []).length === 0 && (
                      <EmptyState
                        title="No leads captured"
                        description="No leads match the current search in this tenant scope yet."
                        icon={Users}
                      />
                    )}
                 </div>
              </ScrollArea>
           </Card>
        </div>

        {/* Right: Attribution & Intelligence */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-10">
           <Card className="rounded-[3rem] border-none shadow-2xl bg-primary text-white p-10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 h-40 w-40 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-1000" />
              <div className="relative z-10 space-y-8">
                 <div className="flex items-center gap-4">
                    <div className="h-14 w-14 bg-primary rounded-2xl flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-transform">
                       <Zap className="h-7 w-7 text-white fill-white" />
                    </div>
                    <div>
                       <h4 className="font-black text-xl uppercase tracking-tighter italic">Ingestion</h4>
                       <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Tactical Entry Node</p>
                    </div>
                 </div>
                 <p className="text-sm font-medium italic italic opacity-70 leading-relaxed italic">
                    "Intelligence scroring is active. <strong>87% of incoming nodes</strong> from Meta Ads are being qualified for Enterprise Q4 protocols."
                 </p>
                 <Button 
                   className="w-full h-16 bg-white text-primary hover:bg-muted border-none rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl gap-3 group/btn"
                   onClick={() => setCaptureOpen(true)}
                 >
                    <Plus className="h-5 w-5 group-hover/btn:rotate-90 transition-transform duration-500" />
                    INITIALIZE MANUAL ENTRY
                 </Button>
              </div>
           </Card>

           <Card className="rounded-[3rem] border-none shadow-2xl bg-white dark:bg-muted overflow-hidden group">
              <CardHeader className="p-8 pb-4">
                 <div className="flex items-center justify-between mb-4">
                    <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground italic">Source Attribution Matrix</CardTitle>
                    <PieChart className="h-4 w-4 text-primary" />
                 </div>
              </CardHeader>
              <CardContent className="p-8 pt-0 space-y-8">
                 {[
                   { name: 'GOOGLE ADS', val: 45, color: 'bg-primary' },
                   { name: 'LANDING PAGE', val: 30, color: 'bg-success' },
                   { name: 'WEBINARS', val: 15, color: 'bg-primary' },
                   { name: 'OTHERS', val: 10, color: 'bg-muted dark:bg-muted' }
                 ].map(item => (
                   <div key={item.name} className="space-y-2 group/bar">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest italic leading-none">
                         <span className="text-muted-foreground">{item.name}</span>
                         <span className="group-hover/bar:text-primary transition-colors">{item.val}%</span>
                      </div>
                      <div className="h-2 w-full bg-muted dark:bg-muted rounded-full overflow-hidden shadow-inner">
                         <div className={cn("h-full transition-all duration-1000", item.color)} style={{ width: `${item.val}%` }} />
                      </div>
                   </div>
                 ))}
              </CardContent>
           </Card>

           <Card className="rounded-[2.5rem] border-none shadow-2xl bg-primary dark:bg-primary p-8 border border-primary">
              <div className="flex items-start gap-4">
                 <div className="h-10 w-10 rounded-xl bg-white dark:bg-muted flex items-center justify-center shadow-lg shrink-0">
                    <Activity className="h-5 w-5 text-primary animate-pulse" />
                 </div>
                 <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Scoring Advisory</p>
                    <p className="text-xs font-medium italic leading-relaxed text-muted-foreground dark:text-muted-foreground italic">
                       "Incoming traffic from <strong>LinkedIn Direct</strong> shows a <strong>+22% increase</strong> in intent IQ. Recommend scaling budget for Q4 Enterprise links."
                    </p>
                 </div>
              </div>
           </Card>
        </div>
      </div>

      {/* Capture Lead Modal */}
      <CaptureLeadModal
        isOpen={captureOpen}
        onClose={() => setCaptureOpen(false)}
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
