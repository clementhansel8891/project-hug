import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  Target, 
  ShieldCheck, 
  Search, 
  Plus, 
  RefreshCw, 
  Filter, 
  ChevronRight, 
  Activity,
  DollarSign,
  User,
  Building2,
  Mail,
  Phone,
  Clock,
  ArrowUpRight,
  TrendingUp,
  AlertCircle,
  MoreVertical,
  CheckCircle2,
  Zap,
  Info,
  MessageSquare
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { GlassCard } from "@/components/shared/GlassCard";
import { EmptyState } from "@/components/shared/AsyncState";
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
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { useSession } from "@/core/security/session";
import { salesService } from "@/core/services/sales/salesService";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, safeText } from "@/lib/format";
import { toast } from "sonner";
import type { SalesLead } from "@/core/types/sales/sales";
import { CreateLeadModal, ConvertLeadModal } from "./modals";

export default function LeadDesk() {
  const navigate = useNavigate();
  const session = useSession();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leads, setLeads] = useState<SalesLead[]>([]);
  
  // Create Lead State
  const [createOpen, setCreateOpen] = useState(false);

  // Convert Lead State
  const [convertLead, setConvertLead] = useState<SalesLead | null>(null);

  // Filter State
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Selection/Detail State
  const [selectedLead, setSelectedLead] = useState<SalesLead | null>(null);

  const refresh = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      const data = await salesService.listLeads(session.tenant_id, session);
      setLeads(data);
      if (isManual) toast.success("Lead registry synchronized.");
    } catch (err) {
      console.error("Failed to fetch leads:", err);
      toast.error("Telemetry failure in lead pool.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session.tenant_id, session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    let result = leads;
    if (statusFilter === "QUALIFIED") {
      result = (Array.isArray(result) ? result : []).filter(l => l.status === "QUALIFIED");
    } else if (statusFilter === "SLA_DELINQUENT") {
      // Logic for SLA delinquent leads (e.g. status NEW and older than 24h)
      // For now, mapping to a feature expansion trigger since it's a complex logic
      return (Array.isArray(result) ? result : []).filter(l => l.status === "NEW"); 
    }
    
    return (Array.isArray(result) ? result : []).filter((lead) =>
      search
        ? `${lead.companyName} ${lead.contactName} ${lead.ownerName} ${lead.status}`
            .toLowerCase()
            .includes(search.toLowerCase())
        : true,
    );
  }, [leads, search, statusFilter]);

  const handleUpdateStatus = async (leadId: string, status: any) => {
    try {
      await salesService.updateLeadStatus(session.tenant_id, session, leadId, status);
      toast.success(`Protocol updated to ${status}`);
      refresh(true);
    } catch (err) {
      toast.error("Protocol update failure.");
    }
  };

  const handleConvert = (lead: SalesLead) => {
    setConvertLead(lead);
  };

  return (
    <div className="p-8 space-y-10 animate-in fade-in duration-1000 max-w-[1600px] mx-auto">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row justify-between items-end gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge className="bg-success text-success border-none font-black px-3 py-1 rounded-full uppercase tracking-widest text-[10px]">Registry Intake</Badge>
            <div className="flex items-center gap-1.5 text-primary font-bold text-xs uppercase tracking-widest">
               <Activity className="h-4 w-4 animate-pulse" />
               Lead Flow Active
            </div>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-foreground italic">Lead Reception</h1>

          <p className="text-muted-foreground font-medium max-w-2xl text-lg leading-relaxed">Systematic demand qualification and SLA-backed ownership orchestration.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white/50 dark:bg-muted backdrop-blur-xl p-2 rounded-[2rem] border border-border dark:border-border/20 shadow-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-11 h-14 w-[300px] rounded-[1.5rem] bg-transparent border-none focus-visible:ring-0 text-base font-medium"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search registry..."
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
            onClick={() => setCreateOpen(true)}
            className="h-[4.5rem] px-10 rounded-[2rem] bg-primary hover:bg-primary shadow-2xl shadow-indigo-500/30 font-black text-sm gap-3 group transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform duration-500" /> 
            INJECT NEW LEAD
          </Button>
        </div>
      </div>

      {/* Main Registry Area */}
      <GlassCard className="rounded-[3rem] border-none shadow-2xl overflow-hidden">
        <CardHeader className="p-10 pb-6 border-b border-border dark:border-border/20">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                <Target className="h-6 w-6 text-primary" />
                Active Registry Pool
              </CardTitle>
              <CardDescription className="text-sm font-medium">Real-time lifecycle management and qualification matrix.</CardDescription>
            </div>
            <div className="flex gap-4">
                <div className="flex bg-muted dark:bg-muted p-1.5 rounded-[1.5rem] shadow-inner">
                  <Button 
                    variant="ghost" size="sm" 
                    onClick={() => setStatusFilter(null)}
                    className={cn("h-10 rounded-xl px-4 font-black text-[10px] tracking-widest transition-all", !statusFilter ? "bg-white dark:bg-muted shadow-md text-primary" : "text-muted-foreground")}
                  >
                    ALL RECORDS
                  </Button>
                  <Button 
                    variant="ghost" size="sm" 
                    onClick={() => setStatusFilter("QUALIFIED")}
                    className={cn("h-10 rounded-xl px-4 font-black text-[10px] tracking-widest transition-all", statusFilter === "QUALIFIED" ? "bg-white dark:bg-muted shadow-md text-primary" : "text-muted-foreground")}
                  >
                    QUALIFIED
                  </Button>
                  <Button 
                    variant="ghost" size="sm" 
                    onClick={() => navigate("/core/sales/intelligence")}
                    className="h-10 rounded-xl px-4 font-black text-[10px] tracking-widest text-muted-foreground hover:text-muted-foreground transition-colors"
                  >
                    SLA DELINQUENT
                  </Button>
               </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted dark:bg-muted">
                <tr>
                  <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Designation</th>
                  <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Intake Detail</th>
                  <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Custodian</th>
                  <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Potential Yield</th>
                  <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Lifecycle State</th>
                  <th className="px-10 py-6 text-right text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Action Matrix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-slate-800/10">
                {(Array.isArray(filtered) ? filtered : []).map((lead) => (
                  <tr 
                    key={lead.id} 
                    className="group hover:bg-primary dark:hover:bg-primary transition-all cursor-pointer"
                    onClick={() => setSelectedLead(lead)}
                  >
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-5">
                        <div className="h-12 w-12 rounded-2xl bg-white dark:bg-muted flex items-center justify-center font-black text-sm shadow-xl transition-all group-hover:scale-110 group-hover:bg-primary group-hover:text-white">
                          {lead.companyName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-black text-base">{lead.companyName}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight italic">Protocol ID: {lead.id.slice(-6)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                       <div className="space-y-1">
                          <p className="text-sm font-bold text-muted-foreground dark:text-muted-foreground">{lead.contactName}</p>
                          <p className="text-[10px] font-medium text-muted-foreground">{lead.contactEmail || "No digital link"}</p>
                       </div>
                    </td>
                    <td className="px-10 py-8">
                       <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                          <span className="text-xs font-black uppercase tracking-tight">{lead.ownerName}</span>
                       </div>
                    </td>
                    <td className="px-10 py-8">
                       <div className="space-y-1">
                          <p className="text-sm font-black text-primary">{formatCurrency(lead.potentialValue, lead.currency)}</p>
                          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{lead.currency}</p>
                       </div>
                    </td>
                    <td className="px-10 py-8">
                       <div className="flex flex-col gap-2">
                          <Badge 
                            variant={lead.status === "NEW" ? "destructive" : "outline"}
                            className="w-fit rounded-full font-black text-[9px] px-3 py-1 border-none shadow-sm uppercase tracking-widest bg-muted dark:bg-muted text-muted-foreground"
                          >
                            {lead.status}
                          </Badge>
                          <div className="flex items-center gap-1">
                             <div className="h-1 w-12 bg-muted dark:bg-muted rounded-full overflow-hidden">
                                <div className={cn(
                                  "h-full bg-primary transition-all",
                                  lead.status === "NEW" ? "w-1/4" : 
                                  lead.status === "CONTACTED" ? "w-1/2" :
                                  lead.status === "QUALIFIED" ? "w-3/4" : "w-full"
                                )} />
                             </div>
                          </div>
                       </div>
                    </td>
                    <td className="px-10 py-8 text-right">
                       <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-white transition-all shadow-sm">
                                <MoreVertical className="h-5 w-5 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-2xl border-none">
                               <DropdownMenuItem className="gap-3 py-3 rounded-xl font-bold" onClick={() => handleUpdateStatus(lead.id, 'CONTACTED')} disabled={lead.status !== "NEW"}><MessageSquare className="h-4 w-4" /> Log Contact</DropdownMenuItem>
                               <DropdownMenuItem className="gap-3 py-3 rounded-xl font-bold" onClick={() => handleUpdateStatus(lead.id, 'QUALIFIED')} disabled={lead.status !== "CONTACTED"}><ShieldCheck className="h-4 w-4" /> Qualify Node</DropdownMenuItem>
                               <DropdownMenuSeparator />
                               <DropdownMenuItem className="gap-3 py-3 rounded-xl font-black text-primary" onClick={() => handleConvert(lead)} disabled={lead.status !== "QUALIFIED"}><Zap className="h-4 w-4" /> CONVERT TO OPP</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && filtered.length === 0 && (
            <EmptyState
              title="No leads yet"
              description="No leads match the current filter. Inject a new lead to begin qualification."
              icon={Target}
              className="m-10"
            />
          )}
          <div className="p-10 border-t border-border dark:border-border/20 flex justify-between items-center">
             <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Showing {filtered.length} Active Records</p>
             <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="rounded-xl font-black text-[10px] h-10 px-6 uppercase tracking-widest border-border"
                  onClick={() => navigate("/core/sales/intelligence")}
                >
                  Export Registry
                </Button>
                <Button 
                  variant="outline" 
                  className="rounded-xl font-black text-[10px] h-10 px-6 uppercase tracking-widest border-border"
                  onClick={() => navigate("/core/sales/intelligence")}
                >
                  Bulk Operations
                </Button>
             </div>
          </div>
        </CardContent>
      </GlassCard>

      {/* Lead Detail Modal */}
      <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <DialogContent className="max-w-4xl rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-muted">
          <div className="grid md:grid-cols-[1.5fr_2.5fr]">
            <div className="bg-primary p-12 text-white relative overflow-hidden flex flex-col justify-between">
               <div className="absolute top-0 right-0 h-64 w-64 -mr-20 -mt-20 bg-white/10 rounded-full blur-3xl" />
               <div className="space-y-8 relative z-10">
                  <div className="h-20 w-20 rounded-[2rem] bg-white/20 backdrop-blur-md flex items-center justify-center border border-border shadow-xl">
                     <Target className="h-10 w-10" />
                  </div>
                  <div>
                     <h2 className="text-4xl font-black tracking-tighter leading-none mb-4 italic">{selectedLead?.companyName}</h2>
                     <Badge className="bg-white/20 text-white border-none font-black px-3 py-1 rounded-full uppercase tracking-widest text-[9px]">PROTOCOL SNAPSHOT</Badge>
                  </div>
                  <p className="text-white/60 font-medium text-sm leading-relaxed italic">"Intelligent demand qualification ensures the strategic alignment of sales resources."</p>
               </div>
               
               <div className="pt-12 space-y-6 relative z-10">
                  <div className="p-5 rounded-3xl bg-white/10 border border-border space-y-1">
                     <p className="text-[10px] font-black uppercase tracking-widest opacity-60">SLA Matrix</p>
                     <p className="text-sm font-black flex items-center gap-2 text-success">
                        <CheckCircle2 className="h-4 w-4" /> Compliant Execution
                     </p>
                  </div>
               </div>
            </div>
            
            <div className="p-12 space-y-10">
               <div className="grid grid-cols-2 gap-x-12 gap-y-8">
                  <div className="space-y-1">
                     <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Core Contact</p>
                     <p className="text-lg font-black">{selectedLead?.contactName}</p>
                     <p className="text-xs font-bold text-primary">{safeText(selectedLead?.contactEmail)}</p>
                  </div>
                  <div className="space-y-1">
                     <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Financial Designation</p>
                     <p className="text-lg font-black text-success">{formatCurrency(selectedLead?.potentialValue, selectedLead?.currency)}</p>
                     <p className="text-xs font-bold text-muted-foreground uppercase tracking-tighter">{selectedLead?.currency} Potential</p>
                  </div>
                  <div className="space-y-1">
                     <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Operational Owner</p>
                     <div className="flex items-center gap-2 pt-1">
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-black text-muted-foreground border border-border">
                           {selectedLead?.ownerName.charAt(0)}
                        </div>
                        <span className="text-sm font-bold">{selectedLead?.ownerName}</span>
                     </div>
                  </div>
                  <div className="space-y-1">
                     <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status Vector</p>
                     <Badge className="bg-muted dark:bg-muted text-muted-foreground border-none font-black px-3 py-1 rounded-full uppercase tracking-widest text-[9px] mt-1">{selectedLead?.status}</Badge>
                  </div>
               </div>
               
               <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                     <Clock className="h-3 w-3" /> LIFECYCLE CHRONOLOGY
                  </p>
                  <div className="p-6 rounded-3xl bg-muted dark:bg-muted border border-border dark:border-border space-y-4">
                     <div className="flex items-center gap-4">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        <div className="flex-1 border-b border-border dark:border-border pb-2">
                           <p className="text-xs font-black">Node Initialized</p>
                           <p className="text-[10px] font-bold text-muted-foreground italic">Created on {formatDate(selectedLead?.createdAt)}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-4">
                        <div className="h-2 w-2 rounded-full bg-muted" />
                        <div className="flex-1 pb-2">
                           <p className="text-xs font-black text-muted-foreground">Pending Transition...</p>
                        </div>
                     </div>
                  </div>
               </div>
               
               <div className="flex gap-4 pt-6">
                  <Button 
                    onClick={() => navigate("/core/sales/intelligence")}
                    className="flex-1 h-14 rounded-2xl bg-primary font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/20"
                  >
                    Action Workspace
                  </Button>
                  <Button variant="outline" className="h-14 w-14 rounded-2xl border-border" onClick={() => setSelectedLead(null)}>
                     <ChevronRight className="h-5 w-5" />
                  </Button>
               </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Zod-validated Create Lead Modal (via ModuleModal + TanStack Query) */}
      <CreateLeadModal
        isOpen={createOpen}
        onClose={() => { setCreateOpen(false); refresh(true); }}
      />

      {/* Lead-to-Opportunity Conversion Modal */}
      {convertLead && (
        <ConvertLeadModal
          isOpen={!!convertLead}
          onClose={() => { setConvertLead(null); refresh(true); }}
          leadId={convertLead.id}
          leadCompany={convertLead.companyName}
          leadContact={convertLead.contactName}
          leadValue={convertLead.potentialValue}
        />
      )}

    </div>
  );
}
