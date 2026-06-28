import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  TrendingUp, 
  RefreshCw, 
  MoreVertical, 
  Layout, 
  DollarSign, 
  Activity, 
  Zap, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Filter,
  ArrowRight,
  Target,
  BarChart3,
  Search,
  LayoutDashboard,
  ActivitySquare,
  ShieldCheck,
  ChevronDown,
  Box,
  Layers,
  Rocket
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
  SelectValue,
} from "@/components/ui/select";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSession } from "@/core/security/session";
import { salesService } from "@/core/services/sales/salesService";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import type { OpportunityStage, SalesOpportunity } from "@/core/types/sales/sales";

const STAGES: OpportunityStage[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "CLOSED_WON",
  "CLOSED_LOST",
];

const STAGE_COLORS: Record<string, string> = {
  NEW: "bg-muted",
  CONTACTED: "bg-primary",
  QUALIFIED: "bg-primary",
  PROPOSAL: "bg-primary",
  NEGOTIATION: "bg-destructive",
  CLOSED_WON: "bg-success",
  CLOSED_LOST: "bg-destructive",
};

export default function PipelineBoard() {
  const navigate = useNavigate();
  const session = useSession();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [pipeline, setPipeline] = useState<Record<OpportunityStage, SalesOpportunity[]>>({
      NEW: [],
      CONTACTED: [],
      QUALIFIED: [],
      PROPOSAL: [],
      NEGOTIATION: [],
      CLOSED_WON: [],
      CLOSED_LOST: [],
  });

  const refresh = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      const data = await salesService.getPipelineByStage(session.tenant_id, session);
      setPipeline(data);
      if (isManual) toast.success("Pipeline state synchronized.");
    } catch (err) {
      console.error("Failed to fetch pipeline data:", err);
      toast.error("Telemetry failure in pipeline board.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session.tenant_id, session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const moveStage = async (opportunityId: string, stage: OpportunityStage) => {
    try {
      await salesService.moveOpportunityStage(session.tenant_id, session, opportunityId, stage);
      toast.success(`Deal topology updated to ${stage}`);
      refresh(true);
    } catch (err) {
      toast.error("Node transition failure.");
    }
  };

  const aggregateValue = useMemo(() => {
    let total = 0;
    Object.values(pipeline).forEach(stageOpportunities => {
      stageOpportunities.forEach(opp => {
        total += opp.amount;
      });
    });
    return total;
  }, [pipeline]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted dark:bg-muted">
        <div className="flex flex-col items-center gap-6">
          <div className="h-20 w-20 bg-primary rounded-[2.5rem] animate-pulse flex items-center justify-center shadow-2xl shadow-indigo-500/20">
            <Layers className="h-10 w-10 text-white" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Syncing Pipeline Matrix...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-10 animate-in fade-in duration-1000 max-w-full overflow-hidden pb-32">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row justify-between items-end gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge className="bg-primary text-white border-none font-black px-3 py-1 rounded-full uppercase tracking-widest text-[10px]">Strategic Flow</Badge>
            <div className="flex items-center gap-1.5 text-primary font-bold text-xs uppercase tracking-widest">
               <ActivitySquare className="h-4 w-4 animate-pulse" />
               Live Board Matrix
            </div>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-foreground italic">Pipeline Matrix</h1>
          <p className="text-muted-foreground font-medium max-w-2xl text-lg leading-relaxed italic">"Execution is everything. The board is your battlefield for high-value conversions."</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Filter opportunities..." 
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
            className="h-[4.5rem] px-10 rounded-[2rem] bg-primary hover:bg-primary shadow-2xl shadow-indigo-500/30 font-black text-sm gap-3 group transition-all hover:scale-105 active:scale-95 text-white"
            onClick={() => navigate("/core/sales/intelligence")}
          >
            <Filter className="h-6 w-6 group-hover:rotate-180 transition-transform duration-500" /> 
            REFINE BOARD
          </Button>
        </div>
      </div>

      {/* Board Layout */}
      <div className="relative">
        <ScrollArea className="w-full pb-8">
          <div className="flex gap-6 min-h-[750px] pb-8">
            {(Array.isArray(STAGES) ? STAGES : []).map((stage) => {
              const filteredOpps = (Array.isArray(pipeline[stage]) ? pipeline[stage] : []).filter(o => 
                o.accountName.toLowerCase().includes(search.toLowerCase())
              ) || [];
              
              return (
                <div key={stage} className="flex flex-col w-[350px] shrink-0 group">
                  <div className="flex items-center justify-between p-5 mb-6 rounded-[2rem] bg-white/40 dark:bg-muted backdrop-blur-xl border border-border dark:border-border/20 shadow-xl group-hover:shadow-2xl transition-all duration-500">
                     <div className="flex items-center gap-4">
                        <div className={cn("h-4 w-4 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.1)]", STAGE_COLORS[stage])} />
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">{stage.replace('_', ' ')}</p>
                     </div>
                     <Badge className="bg-primary text-primary font-black border-none rounded-full px-3 py-1 text-[10px]">
                        {filteredOpps.length}
                     </Badge>
                  </div>

                  <div className="flex-1 space-y-6 p-4 rounded-[2.5rem] bg-muted dark:bg-muted border-2 border-dashed border-border/50 dark:border-border/50 transition-colors group-hover:border-primary">
                    {filteredOpps.length === 0 ? (
                      <div className="h-48 flex flex-col items-center justify-center text-center p-8 space-y-4 opacity-30 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700">
                         <div className="h-16 w-16 rounded-full border-2 border-dashed border-border flex items-center justify-center">
                            <Box className="h-6 w-6 text-muted-foreground" />
                         </div>
                         <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Empty Strategic Node</p>
                      </div>
                    ) : (
                      (Array.isArray(filteredOpps) ? filteredOpps : []).map((item) => (
                        <Card 
                          key={item.id} 
                          className="group/card relative overflow-hidden rounded-[2rem] border-none shadow-xl bg-white dark:bg-muted hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 cursor-default"
                        >
                           <div className={cn("absolute top-0 left-0 h-full w-2 shadow-[2px_0_10px_rgba(0,0,0,0.05)]", STAGE_COLORS[stage])} />
                           <CardContent className="p-7 space-y-6">
                              <div className="flex justify-between items-start">
                                 <div className="space-y-1">
                                    <h3 className="font-black text-lg tracking-tight leading-tight line-clamp-1 uppercase italic">{item.accountName}</h3>
                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest italic opacity-60">Deal Protocol: {item.id.substring(0, 8)}</p>
                                 </div>
                                 <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                       <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-muted dark:hover:bg-muted transition-all">
                                          <MoreVertical className="h-5 w-5 text-muted-foreground" />
                                       </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="rounded-2xl border-none shadow-2xl p-2 w-64" align="end">
                                       <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest opacity-50 px-3 py-2">Tactical Actions</DropdownMenuLabel>
                                       <DropdownMenuSeparator />
                                       <DropdownMenuItem className="gap-3 py-3 rounded-xl text-xs font-bold" onClick={() => window.open(`/sales/opportunities?id=${item.id}`, '_blank')}><ChevronRight className="h-4 w-4" /> View Strategic Context</DropdownMenuItem>
                                       <DropdownMenuItem className="gap-3 py-3 rounded-xl text-xs font-bold" 
                                          onClick={() => navigate("/core/sales/intelligence")}
                                       >
                                          <Zap className="h-4 w-4 text-primary" /> AI Strategic Guidance
                                       </DropdownMenuItem>
                                       <DropdownMenuSeparator />
                                       <DropdownMenuItem className="gap-3 py-3 rounded-xl text-xs font-bold text-destructive"><AlertCircle className="h-4 w-4" /> Escalate Deal</DropdownMenuItem>
                                    </DropdownMenuContent>
                                 </DropdownMenu>
                              </div>

                              <div className="flex items-center gap-4">
                                 <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center shadow-inner group-hover/card:scale-110 group-hover/card:bg-primary group-hover/card:text-white transition-all duration-500">
                                    <DollarSign className="h-7 w-7 text-primary group-hover/card:text-white" />
                                 </div>
                                 <div className="space-y-0.5">
                                    <div className="flex items-baseline gap-1.5">
                                       <span className="text-3xl font-black tracking-tighter text-primary italic">{formatCurrency(item.amount, item.currency)}</span>
                                       <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{item.currency}</span>
                                    </div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground italic">Projected Valuation</p>
                                 </div>
                              </div>

                              <div className="space-y-4 pt-2">
                                 <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-muted-foreground italic">
                                    <span className="flex items-center gap-2"><Target className="h-3.5 w-3.5 text-primary" /> CONVERSION PROBABILITY</span>
                                    <span className="text-primary">{item.probability}%</span>
                                 </div>
                                 <div className="h-2 w-full bg-muted dark:bg-muted rounded-full overflow-hidden shadow-inner">
                                    <div 
                                      className={cn("h-full transition-all duration-1000 shadow-[0_0_10px_rgba(0,0,0,0.1)]", STAGE_COLORS[stage])} 
                                      style={{ width: `${item.probability}%` }} 
                                    />
                                 </div>
                              </div>

                              <div className="flex items-center justify-between pt-4 border-t border-border dark:border-border">
                                 <Badge variant="secondary" className="bg-muted dark:bg-muted text-muted-foreground border-none rounded-full px-4 py-1.5 text-[9px] font-black uppercase tracking-widest italic shadow-sm">
                                    {item.health.replace('_', ' ')} PULSE
                                 </Badge>
                                 
                                 <div className="flex -space-x-3">
                                    {[1, 2].map(i => (
                                      <div key={i} className="h-9 w-9 rounded-full border-2 border-white dark:border-border bg-muted dark:bg-muted flex items-center justify-center text-[10px] font-black text-primary shadow-md uppercase">
                                         {item.owner_name?.charAt(0) || "U"}
                                      </div>
                                    ))}
                                 </div>
                              </div>

                              <div className="pt-2">
                                 <Select
                                   value={item.stage}
                                   onValueChange={(value: OpportunityStage) => moveStage(item.id, value)}
                                 >
                                   <SelectTrigger className="h-12 rounded-2xl border-none bg-muted dark:bg-muted hover:bg-muted transition-all text-[10px] font-black uppercase tracking-widest shadow-inner group-hover/card:bg-white dark:group-hover/card:bg-muted">
                                     <SelectValue placeholder="Transition Stage" />
                                   </SelectTrigger>
                                   <SelectContent className="rounded-2xl border-none shadow-2xl p-2 w-64">
                                     <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest opacity-50 px-3 py-2">Transition Matrix</DropdownMenuLabel>
                                     <DropdownMenuSeparator />
                                     {(Array.isArray(STAGES) ? STAGES : []).map((candidate) => (
                                       <SelectItem key={candidate} value={candidate} className="rounded-xl text-xs font-bold py-3">
                                         {candidate.replace('_', ' ')}
                                       </SelectItem>
                                     ))}
                                   </SelectContent>
                                 </Select>
                              </div>
                           </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Footer Tactical Intelligence Overlay */}
      <div className="fixed bottom-12 right-12 flex gap-6 pointer-events-none">
         <Card className="rounded-[2.5rem] border-none shadow-2xl bg-primary text-white p-8 flex items-center gap-8 pointer-events-auto hover:scale-105 transition-transform duration-500 cursor-default">
            <div className="h-16 w-16 rounded-[1.5rem] bg-white/20 backdrop-blur-md flex items-center justify-center border border-border shadow-2xl">
               <TrendingUp className="h-8 w-8 text-white" />
            </div>
            <div>
               <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-60 italic">Aggregate Nominal Yield</p>
               <h4 className="text-4xl font-black tracking-tighter italic">{formatCurrency(aggregateValue)}</h4>
            </div>
         </Card>
         <Card className="rounded-[2.5rem] border-none shadow-2xl bg-white dark:bg-muted p-8 flex items-center gap-8 pointer-events-auto hover:scale-105 transition-transform duration-500 cursor-default">
            <div className="h-16 w-16 rounded-[1.5rem] bg-success flex items-center justify-center shadow-inner">
               <Rocket className="h-8 w-8 text-success" />
            </div>
            <div>
               <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground italic">Strategic Velocity</p>
               <h4 className="text-4xl font-black tracking-tighter text-success italic">+12.4%</h4>
            </div>
         </Card>
      </div>

    </div>
  );
}
