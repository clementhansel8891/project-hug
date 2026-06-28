import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  FileText, 
  RefreshCw, 
  Search, 
  Plus, 
  ChevronRight, 
  DollarSign, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Send,
  MoreVertical,
  Activity,
  ArrowUpRight,
  User,
  Zap,
  Info,
  Layers,
  History
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useSession } from "@/core/security/session";
import { salesService } from "@/core/services/sales/salesService";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import type { SalesOpportunity, SalesQuote } from "@/core/types/sales/sales";

export default function QuoteDesk() {
  const session = useSession();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [opportunities, setOpportunities] = useState<SalesOpportunity[]>([]);
  const [quotes, setQuotes] = useState<SalesQuote[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING_APPROVAL" | "APPROVED">("ALL");
  
  // Create Quote State
  const [createOpen, setCreateOpen] = useState(false);
  const [newQuote, setNewQuote] = useState({
    opportunityId: "",
    amount: "0",
    discountPercent: "0",
    notes: ""
  });

  const refresh = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      const [o, q] = await Promise.all([
        salesService.listOpportunities(session.tenant_id, session),
        salesService.listQuotes(session.tenant_id, session),
      ]);
      setOpportunities(o);
      setQuotes(q);
      
      if (o.length > 0 && !newQuote.opportunityId) {
        setNewQuote(prev => ({ ...prev, opportunityId: o[0].id, amount: o[0].amount.toString() }));
      }
      if (isManual) toast.success("Proposal registry synchronized.");
    } catch (err) {
      console.error("Failed to fetch quote desk data:", err);
      toast.error("Telemetry failure in proposal desk.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session.tenant_id, session, newQuote.opportunityId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    let result = quotes;
    if (statusFilter !== "ALL") {
      result = (Array.isArray(result) ? result : []).filter(q => q.status === statusFilter);
    }
    return (Array.isArray(result) ? result : []).filter((item) =>
      search
        ? `${item.id} ${item.accountName} ${item.status}`
            .toLowerCase()
            .includes(search.toLowerCase())
        : true,
    );
  }, [quotes, search, statusFilter]);

  const handleCreateQuote = async () => {
    if (!newQuote.opportunityId) return;
    try {
      await salesService.createQuote(session.tenant_id, session, {
        opportunityId: newQuote.opportunityId,
        amount: Number(newQuote.amount),
        discountPercent: Number(newQuote.discountPercent),
        notes: newQuote.notes
      });
      toast.success("Quote version generated successfully.");
      setCreateOpen(false);
      refresh(true);
    } catch (err) {
      toast.error("Generation failure.");
    }
  };

  const handleAction = async (quoteId: string, action: 'submit' | 'approve' | 'reject' | 'send') => {
    try {
      if (action === 'submit') await salesService.submitQuoteForApproval(session.tenant_id, session, quoteId);
      else if (action === 'approve') await salesService.decideQuoteApproval(session.tenant_id, session, quoteId, true);
      else if (action === 'reject') await salesService.decideQuoteApproval(session.tenant_id, session, quoteId, false);
      else if (action === 'send') await salesService.sendQuoteToCustomer(session.tenant_id, session, quoteId);
      
      toast.success(`Protocol executed: ${action.toUpperCase()}`);
      refresh(true);
    } catch (err) {
      toast.error("Action execution failure.");
    }
  };

  return (
    <div className="p-8 space-y-10 animate-in fade-in duration-1000 max-w-[1600px] mx-auto">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row justify-between items-end gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge className="bg-primary text-primary border-none font-black px-3 py-1 rounded-full uppercase tracking-widest text-[10px]">Financial Modeling</Badge>
            <div className="flex items-center gap-1.5 text-primary font-bold text-xs uppercase tracking-widest">
               <Activity className="h-4 w-4 animate-pulse" />
               Proposal Stream Active
            </div>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-foreground italic">Quote Desk</h1>
          <p className="text-muted-foreground font-medium max-w-2xl text-lg leading-relaxed italic">"Versioned proposal orchestration with automated approval workflows."</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-muted0 dark:bg-muted backdrop-blur-xl p-2 rounded-[2rem] border border-border dark:border-border/20 shadow-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-11 h-14 w-[300px] rounded-[1.5rem] bg-transparent border-none focus-visible:ring-0 text-base font-medium"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search proposals..."
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

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="h-[4.5rem] px-10 rounded-[2rem] bg-primary hover:bg-primary shadow-2xl shadow-indigo-500/30 font-black text-sm gap-3 group transition-all hover:scale-105 active:scale-95">
                <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform duration-500" /> 
                GENERATE PROPOSAL
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white dark:bg-muted">
              <div className="h-2 bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-500" />
              <div className="p-10 space-y-8">
                <DialogHeader>
                  <DialogTitle className="text-3xl font-black tracking-tight">Proposal Generation Matrix</DialogTitle>
                  <DialogDescription>Select an active deal context to initialize a new versioned quote.</DialogDescription>
                </DialogHeader>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Target Opportunity</Label>
                    <Select 
                      value={newQuote.opportunityId} 
                      onValueChange={(val) => {
                        const opp = opportunities.find(o => o.id === val);
                        setNewQuote({...newQuote, opportunityId: val, amount: opp?.amount.toString() || "0"});
                      }}
                    >
                      <SelectTrigger className="h-14 rounded-2xl bg-muted dark:bg-muted border-none shadow-inner font-bold">
                        <SelectValue placeholder="Select deal context" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-2xl p-2">
                        {(Array.isArray(opportunities) ? opportunities : []).map(o => (
                          <SelectItem key={o.id} value={o.id} className="rounded-xl py-3 font-bold">{o.accountName} ({formatCurrency(o.amount)})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nominal Amount</Label>
                      <Input 
                        type="number"
                        className="h-14 rounded-2xl bg-muted dark:bg-muted border-none shadow-inner font-black text-primary"
                        value={newQuote.amount}
                        onChange={(e) => setNewQuote({...newQuote, amount: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Discount Matrix (%)</Label>
                      <Input 
                        type="number"
                        className="h-14 rounded-2xl bg-muted dark:bg-muted border-none shadow-inner font-black text-success"
                        value={newQuote.discountPercent}
                        onChange={(e) => setNewQuote({...newQuote, discountPercent: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Strategic Notes</Label>
                    <Input 
                      className="h-14 rounded-2xl bg-muted dark:bg-muted border-none shadow-inner"
                      value={newQuote.notes}
                      onChange={(e) => setNewQuote({...newQuote, notes: e.target.value})}
                      placeholder="Pricing includes enterprise-tier support..."
                    />
                  </div>
                </div>
                <DialogFooter className="pt-4">
                  <Button onClick={handleCreateQuote} className="w-full h-16 rounded-[1.5rem] bg-primary hover:bg-primary font-black text-sm">INITIALIZE GENERATION</Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Quote Registry Area */}
      <GlassCard className="rounded-[3rem] border-none shadow-2xl overflow-hidden">
        <CardHeader className="p-10 pb-6 border-b border-border dark:border-border/20">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                <FileText className="h-6 w-6 text-primary" />
                Proposal Registry Pool
              </CardTitle>
              <CardDescription className="text-sm font-medium">Version-controlled quote lifecycle and approval matrix.</CardDescription>
            </div>
            <div className="flex gap-4">
               <div className="flex bg-muted dark:bg-muted p-1.5 rounded-[1.5rem] shadow-inner">
                  <Button variant="ghost" size="sm" onClick={() => setStatusFilter("ALL")} className={cn("h-10 rounded-xl px-4 font-black text-[10px] tracking-widest transition-all", statusFilter === "ALL" ? "bg-white dark:bg-muted shadow-md text-primary" : "text-muted-foreground hover:text-muted-foreground")}>ALL VERSIONS</Button>
                  <Button variant="ghost" size="sm" onClick={() => setStatusFilter("PENDING_APPROVAL")} className={cn("h-10 rounded-xl px-4 font-black text-[10px] tracking-widest transition-all", statusFilter === "PENDING_APPROVAL" ? "bg-white dark:bg-muted shadow-md text-primary" : "text-muted-foreground hover:text-muted-foreground")}>PENDING APPROVAL</Button>
                  <Button variant="ghost" size="sm" onClick={() => setStatusFilter("APPROVED")} className={cn("h-10 rounded-xl px-4 font-black text-[10px] tracking-widest transition-all", statusFilter === "APPROVED" ? "bg-white dark:bg-muted shadow-md text-primary" : "text-muted-foreground hover:text-muted-foreground")}>APPROVED</Button>
               </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted dark:bg-muted">
                <tr>
                  <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Protocol Designation</th>
                  <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Account</th>
                  <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Yield Configuration</th>
                  <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Lifecycle Node</th>
                  <th className="px-10 py-6 text-right text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Action Matrix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-slate-800/10">
                {(Array.isArray(filtered) ? filtered : []).map((item) => (
                  <tr key={item.id} className="group hover:bg-primary dark:hover:bg-primary transition-all cursor-default">
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-5">
                        <div className="h-12 w-12 rounded-2xl bg-white dark:bg-muted flex items-center justify-center font-black text-sm shadow-xl transition-all group-hover:scale-110 group-hover:bg-primary group-hover:text-white">
                          <Layers className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="font-black text-base italic">{item.id.slice(-8)}</p>
                          <Badge variant="outline" className="text-[9px] font-black px-2 py-0 h-4 border-border uppercase tracking-widest mt-1">VERSION {item.version}.0</Badge>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                       <p className="text-sm font-black text-muted-foreground dark:text-muted-foreground">{item.accountName}</p>
                    </td>
                    <td className="px-10 py-8">
                       <div className="space-y-1">
                          <p className="text-sm font-black text-success">{formatCurrency(item.netAmount)}</p>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase">Gross: {formatCurrency(item.amount)} ({item.discountPercent}% OFF)</p>
                       </div>
                    </td>
                    <td className="px-10 py-8">
                       <Badge 
                        variant={item.status === "PENDING_APPROVAL" ? "destructive" : "outline"}
                        className={cn(
                          "rounded-full font-black text-[9px] px-3 py-1 border-none shadow-sm uppercase tracking-widest",
                          item.status === "APPROVED" ? "bg-success text-success" :
                          item.status === "DRAFT" ? "bg-muted dark:bg-muted text-muted-foreground" :
                          item.status === "SENT" ? "bg-primary text-primary" : "bg-destructive text-destructive"
                        )}
                       >
                        {item.status.replace('_', ' ')}
                       </Badge>
                    </td>
                    <td className="px-10 py-8 text-right">
                       <div className="flex justify-end gap-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-white transition-all shadow-sm">
                                <MoreVertical className="h-5 w-5 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 shadow-2xl border-none">
                               <DropdownMenuItem className="gap-3 py-3 rounded-xl font-bold" onClick={() => handleAction(item.id, 'submit')} disabled={item.status !== "DRAFT"}><Zap className="h-4 w-4 text-primary" /> Submit for Review</DropdownMenuItem>
                               <DropdownMenuItem className="gap-3 py-3 rounded-xl font-bold" onClick={() => handleAction(item.id, 'approve')} disabled={item.status !== "PENDING_APPROVAL"}><CheckCircle2 className="h-4 w-4 text-success" /> Approve Proposal</DropdownMenuItem>
                               <DropdownMenuItem className="gap-3 py-3 rounded-xl font-bold" onClick={() => handleAction(item.id, 'reject')} disabled={item.status !== "PENDING_APPROVAL"}><XCircle className="h-4 w-4 text-destructive" /> Reject Version</DropdownMenuItem>
                               <DropdownMenuSeparator />
                               <DropdownMenuItem className="gap-3 py-3 rounded-xl font-black text-primary" onClick={() => handleAction(item.id, 'send')} disabled={item.status !== "APPROVED"}><Send className="h-4 w-4" /> TRANSMIT TO CLIENT</DropdownMenuItem>
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
              title="No proposals yet"
              description="No quotes match the current filter. Generate a proposal from an active opportunity."
              icon={FileText}
              className="m-10"
            />
          )}
        </CardContent>
      </GlassCard>

      {/* Tactical Insights Overlay */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <GlassCard className="rounded-[2.5rem] border-none shadow-xl p-8 flex items-center gap-6">
            <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center">
               <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">COMPLIANCE INDEX</p>
               <h4 className="text-2xl font-black">100%</h4>
            </div>
         </GlassCard>
         <GlassCard className="rounded-[2.5rem] border-none shadow-xl p-8 flex items-center gap-6">
            <div className="h-14 w-14 rounded-2xl bg-success flex items-center justify-center">
               <History className="h-7 w-7 text-success" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">AVG APPROVAL TIME</p>
               <h4 className="text-2xl font-black text-success">4.2h</h4>
            </div>
         </GlassCard>
         <Card className="rounded-[2.5rem] border-none shadow-xl bg-primary text-white p-8 flex items-center gap-6 shadow-indigo-600/20">
            <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-border">
               <DollarSign className="h-7 w-7" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest opacity-60">PROPOSAL VOLUME</p>
               <h4 className="text-2xl font-black">{formatCurrency(quotes.reduce((acc, q) => acc + q.netAmount, 0))}</h4>
            </div>
         </Card>
      </div>
    </div>
  );
}
