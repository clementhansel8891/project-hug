import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  History, 
  RefreshCw, 
  Search, 
  Plus, 
  MessageSquare, 
  Mail, 
  Smartphone, 
  Phone, 
  Users, 
  Activity, 
  ChevronRight, 
  CheckCircle2, 
  Zap, 
  Clock, 
  Target, 
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  Send,
  MoreVertical,
  Calendar,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
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
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import type { SalesTimelineEvent, SalesOpportunity } from "@/core/types/sales/sales";

const CHANNELS: Record<string, { icon: any, color: string }> = {
  NOTE: { icon: MessageSquare, color: "slate" },
  EMAIL: { icon: Mail, color: "blue" },
  WHATSAPP: { icon: MessageSquare, color: "emerald" },
  SMS: { icon: Smartphone, color: "indigo" },
  CALL: { icon: Phone, color: "purple" },
  MEETING: { icon: Users, color: "amber" },
};

export default function TimelineDesk() {
  const session = useSession();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [opportunities, setOpportunities] = useState<SalesOpportunity[]>([]);
  const [timeline, setTimeline] = useState<SalesTimelineEvent[]>([]);
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [logData, setLogData] = useState({
    opportunityId: "",
    channel: "NOTE" as SalesTimelineEvent["channel"],
    summary: "",
    detail: "",
    direction: "OUTBOUND" as SalesTimelineEvent["direction"]
  });

  const refresh = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      const [o, t] = await Promise.all([
        salesService.listOpportunities(session.tenant_id, session),
        salesService.listTimelineEvents(session.tenant_id, session),
      ]);
      setOpportunities(o);
      setTimeline(t);
      
      if (o.length > 0 && !logData.opportunityId) {
        setLogData(prev => ({ ...prev, opportunityId: o[0].id }));
      }
      if (isManual) toast.success("Timeline telemetry synchronized.");
    } catch (err) {
      console.error("Failed to fetch timeline data:", err);
      toast.error("Telemetry failure in activity stream.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session.tenant_id, session, logData.opportunityId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    let result = timeline;
    if (channelFilter) {
      result = (Array.isArray(result) ? result : []).filter(item => item.channel === channelFilter);
    }
    return (Array.isArray(result) ? result : []).filter((item) =>
      search
        ? `${item.summary} ${item.channel} ${item.direction} ${item.createdBy}`
            .toLowerCase()
            .includes(search.toLowerCase())
        : true,
    );
  }, [search, timeline, channelFilter]);

  const handleLogEvent = async () => {
    if (!logData.opportunityId || !logData.summary) {
      toast.error("Opportunity and Summary designation required.");
      return;
    }
    try {
      await salesService.addTimelineEvent(session.tenant_id, session, {
        opportunityId: logData.opportunityId,
        channel: logData.channel,
        direction: logData.direction,
        summary: logData.summary,
        detail: logData.detail,
      });
      toast.success("Event logged to neural stream.");
      setIsLogOpen(false);
      setLogData({ ...logData, summary: "", detail: "" });
      refresh(true);
    } catch (err) {
      toast.error("Logging failure.");
    }
  };

  return (
    <div className="p-8 space-y-10 animate-in fade-in duration-1000 max-w-[1600px] mx-auto pb-24">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row justify-between items-end gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge className="bg-primary text-white border-none font-black px-3 py-1 rounded-full uppercase tracking-widest text-[10px]">Omnichannel Stream</Badge>
            <div className="flex items-center gap-1.5 text-primary font-bold text-xs uppercase tracking-widest">
               <Activity className="h-4 w-4 animate-pulse" />
               Activity Pulse Active
            </div>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-foreground italic">Neural Timeline</h1>

          <p className="text-muted-foreground font-medium max-w-2xl text-lg leading-relaxed italic">"Every interaction is a node in the strategic architecture of the deal."</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white/50 dark:bg-muted backdrop-blur-xl p-2 rounded-[2rem] border border-border dark:border-border/20 shadow-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-11 h-14 w-[300px] rounded-[1.5rem] bg-transparent border-none focus-visible:ring-0 text-base font-medium"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search activity stream..."
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

          <Dialog open={isLogOpen} onOpenChange={setIsLogOpen}>
            <DialogTrigger asChild>
              <Button className="h-[4.5rem] px-10 rounded-[2rem] bg-primary hover:bg-primary shadow-2xl shadow-indigo-500/30 font-black text-sm gap-3 group transition-all hover:scale-105 active:scale-95">
                <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform duration-500" /> 
                LOG INTERACTION
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white dark:bg-muted">
              <div className="h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />
              <div className="p-10 space-y-8">
                <DialogHeader>
                  <DialogTitle className="text-3xl font-black tracking-tight">Interaction Logging Node</DialogTitle>
                  <DialogDescription>Record a new communication event into the auditable deal chronology.</DialogDescription>
                </DialogHeader>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Target Opportunity</Label>
                    <Select 
                      value={logData.opportunityId} 
                      onValueChange={(val) => setLogData({...logData, opportunityId: val})}
                    >
                      <SelectTrigger className="h-14 rounded-2xl bg-muted dark:bg-muted border-none shadow-inner font-bold">
                        <SelectValue placeholder="Select deal context" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-2xl p-2">
                        {(Array.isArray(opportunities) ? opportunities : []).map(o => (
                          <SelectItem key={o.id} value={o.id} className="rounded-xl py-3 font-bold">{o.accountName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Channel</Label>
                      <Select 
                        value={logData.channel} 
                        onValueChange={(val: any) => setLogData({...logData, channel: val})}
                      >
                        <SelectTrigger className="h-14 rounded-2xl bg-muted dark:bg-muted border-none shadow-inner font-bold">
                          <SelectValue placeholder="Channel" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-2xl p-2">
                          {Object.keys(CHANNELS).map(c => (
                            <SelectItem key={c} value={c} className="rounded-xl py-3 font-bold">{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Direction</Label>
                      <div className="flex gap-2 h-14 items-center bg-muted dark:bg-muted rounded-2xl px-4 border-none shadow-inner">
                         {["INBOUND", "OUTBOUND"].map((d) => (
                           <button
                             key={d}
                             onClick={() => setLogData({...logData, direction: d as any})}
                             className={cn(
                               "flex-1 py-1.5 rounded-xl text-[8px] font-black tracking-widest transition-all",
                               logData.direction === d ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:text-muted-foreground"
                             )}
                           >
                             {d}
                           </button>
                         ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Summary</Label>
                    <Input 
                      className="h-14 rounded-2xl bg-muted dark:bg-muted border-none shadow-inner font-bold"
                      value={logData.summary}
                      onChange={(e) => setLogData({...logData, summary: e.target.value})}
                      placeholder="Pricing discussion and timeline review..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Detailed Context</Label>
                    <Textarea 
                      className="rounded-2xl bg-muted dark:bg-muted border-none shadow-inner min-h-[100px]"
                      value={logData.detail}
                      onChange={(e) => setLogData({...logData, detail: e.target.value})}
                      placeholder="Customer expressed interest in the Q3 roadmap and requested a follow-up on..."
                    />
                  </div>
                </div>
                <DialogFooter className="pt-4">
                  <Button onClick={handleLogEvent} className="w-full h-16 rounded-[1.5rem] bg-primary hover:bg-primary font-black text-sm">COMMIT TO STREAM</Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main Timeline View */}
      <div className="grid grid-cols-12 gap-10">
         <div className="col-span-12 lg:col-span-8 space-y-8 relative">
            <div className="absolute left-8 top-10 bottom-10 w-0.5 bg-gradient-to-b from-indigo-500 via-indigo-500/20 to-transparent hidden md:block" />
            
            {filtered.length === 0 ? (
               <EmptyState
                  title="No activity yet"
                  description="The neural stream is silent. Log an interaction to populate the timeline."
                  icon={History}
               />
            ) : (
               (Array.isArray(filtered) ? filtered : []).map((item, i) => {
                  const channel = CHANNELS[item.channel] || CHANNELS.NOTE;
                  const Icon = channel.icon;
                  return (
                    <div key={item.id} className="relative pl-0 md:pl-20 animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                       <div className="absolute left-6 top-6 h-4 w-4 rounded-full border-4 border-white dark:border-border bg-primary shadow-[0_0_15px_rgba(79,70,229,0.5)] z-10 hidden md:block" />
                       <Card className="rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-muted overflow-hidden group hover:shadow-2xl hover:-translate-y-1 transition-all duration-500">
                          <CardContent className="p-8">
                             <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                                <div className="flex items-start gap-6">
                                   <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner", `bg-${channel.color}-500/10`)}>
                                      <Icon className={cn("h-7 w-7", `text-${channel.color}-500`)} />
                                   </div>
                                   <div className="space-y-2">
                                      <div className="flex items-center gap-3">
                                         <p className="font-black text-lg tracking-tight leading-none">{item.summary}</p>
                                         <Badge variant="outline" className="rounded-full text-[8px] font-black px-2 py-0 h-4 border-border uppercase tracking-widest">{item.channel}</Badge>
                                      </div>
                                      <p className="text-xs font-medium text-muted-foreground dark:text-muted-foreground leading-relaxed max-w-xl italic">"{item.detail || "Strategic node update with no supplementary context."}"</p>
                                      <div className="flex items-center gap-4 pt-2">
                                         <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase tracking-widest">
                                            <Target className="h-3 w-3" /> {item.opportunityId.slice(-8)}
                                         </div>
                                         <div className="flex items-center gap-1.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                            <User className="h-3 w-3" /> {item.createdBy}
                                         </div>
                                      </div>
                                   </div>
                                </div>
                                
                                <div className="flex flex-col items-end gap-3 shrink-0">
                                   <div className="text-right">
                                      <p className="text-xs font-black tracking-tighter text-foreground uppercase">{formatDate(item.createdAt)}</p>
                                      <p className="text-[10px] font-bold text-muted-foreground">{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                   </div>
                                   <Badge className={cn(
                                      "rounded-full font-black text-[8px] px-2 py-0.5 border-none shadow-sm uppercase tracking-widest",
                                      item.direction === "INBOUND" ? "bg-success text-white" : "bg-primary text-white"
                                   )}>
                                      {item.direction === "INBOUND" ? <ArrowDownLeft className="h-2.5 w-2.5 mr-1 inline" /> : <ArrowUpRight className="h-2.5 w-2.5 mr-1 inline" />}
                                      {item.direction}
                                   </Badge>
                                </div>
                             </div>
                          </CardContent>
                       </Card>
                    </div>
                  );
               })
            )}
         </div>

         <div className="col-span-12 lg:col-span-4 space-y-8">
            <Card className="rounded-[3rem] border-none shadow-2xl bg-primary text-white p-10 space-y-8 overflow-hidden relative group">
               <div className="absolute top-0 right-0 h-40 w-40 -mr-10 -mt-10 bg-white/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
               <div className="space-y-2 relative z-10">
                  <h3 className="text-2xl font-black tracking-tight">Channel Pulse</h3>
                  <p className="text-white/60 font-medium text-sm italic">Aggregate engagement metrics across all neural touchpoints.</p>
               </div>
               
               <div className="space-y-6 relative z-10">
                  {[
                    { label: "Internal Notes", count: (Array.isArray(timeline) ? timeline : []).filter(t => t.channel === "NOTE").length, color: "bg-white/20" },
                    { label: "Digital Outreach", count: (Array.isArray(timeline) ? timeline : []).filter(t => ["EMAIL", "SMS", "WHATSAPP"].includes(t.channel)).length, color: "bg-success" },
                    { label: "Direct Comms", count: (Array.isArray(timeline) ? timeline : []).filter(t => ["CALL", "MEETING"].includes(t.channel)).length, color: "bg-warning" },
                  ].map((stat, i) => (
                    <div key={i} className="space-y-2">
                       <div className="flex justify-between items-end">
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{stat.label}</p>
                          <p className="text-lg font-black">{stat.count}</p>
                       </div>
                       <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", stat.color)} style={{ width: `${(stat.count / Math.max(timeline.length, 1)) * 100}%` }} />
                       </div>
                    </div>
                  ))}
               </div>
               
               <div className="pt-6 relative z-10 border-t border-border">
                  <div className="flex items-center gap-4">
                     <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-border">
                        <Zap className="h-6 w-6" />
                     </div>
                     <div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">ENGAGEMENT INDEX</p>
                        <h4 className="text-2xl font-black">HIGH</h4>
                     </div>
                  </div>
               </div>
            </Card>

            <GlassCard className="rounded-[3rem] border-none shadow-2xl p-10 space-y-8">
               <CardTitle className="text-xl font-black tracking-tight flex items-center gap-3">
                  <Filter className="h-5 w-5 text-primary" />
                  Stream Filter
               </CardTitle>
               <div className="space-y-3">
                  <button 
                    onClick={() => setChannelFilter(null)}
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-2xl transition-all group shadow-sm",
                      !channelFilter ? "bg-primary text-white" : "bg-white dark:bg-muted hover:bg-muted dark:hover:bg-muted"
                    )}
                  >
                     <div className="flex items-center gap-3">
                        <div className={cn("h-2 w-2 rounded-full", !channelFilter ? "bg-white" : "bg-muted")} />
                        <span className="text-[10px] font-black uppercase tracking-widest">ALL ACTIVITIES</span>
                     </div>
                     <Badge variant="secondary" className={cn("rounded-full text-[8px] font-black", !channelFilter ? "bg-white text-primary" : "")}>{timeline.length}</Badge>
                  </button>
                  {Object.keys(CHANNELS).map(c => (
                    <button 
                      key={c} 
                      onClick={() => setChannelFilter(c)}
                      className={cn(
                        "w-full flex items-center justify-between p-4 rounded-2xl transition-all group shadow-sm",
                        channelFilter === c ? "bg-primary text-white" : "bg-white dark:bg-muted hover:bg-muted dark:hover:bg-muted"
                      )}
                    >
                       <div className="flex items-center gap-3">
                          <div className={cn("h-2 w-2 rounded-full", channelFilter === c ? "bg-white" : "bg-muted")} />
                           <span className="text-[10px] font-black uppercase tracking-widest">{c}</span>
                       </div>
                       <Badge variant="secondary" className={cn("rounded-full text-[8px] font-black", channelFilter === c ? "bg-white text-primary" : "")}>{(Array.isArray(timeline) ? timeline : []).filter(t => t.channel === c).length}</Badge>
                    </button>
                  ))}
               </div>
            </GlassCard>
         </div>
      </div>
    </div>
  );
}
