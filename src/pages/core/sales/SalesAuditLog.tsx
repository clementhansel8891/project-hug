import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  ShieldCheck, 
  RefreshCw, 
  Search, 
  History, 
  Activity, 
  User, 
  Layers, 
  ChevronRight, 
  ArrowUpRight,
  Zap,
  Info,
  Clock,
  Lock,
  FileSearch,
  MoreVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { GlassCard } from "@/components/shared/GlassCard";
import { EmptyState } from "@/components/shared/AsyncState";
import { useSession } from "@/core/security/session";
import { salesService } from "@/core/services/sales/salesService";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import type { SalesAuditEvent } from "@/core/types/sales/sales";

export default function SalesAuditLog() {
  const navigate = useNavigate();
  const session = useSession();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<SalesAuditEvent[]>([]);

  const refresh = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      const data = await salesService.listAuditEvents(session.tenant_id, session);
      setEvents(data);
      if (isManual) toast.success("Immutable audit stream synchronized.");
    } catch (err) {
      console.error("Failed to fetch audit log:", err);
      toast.error("Telemetry failure in audit log.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session.tenant_id, session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => 
    (Array.isArray(events) ? events : []).filter((item) =>
      search
        ? `${item.action} ${item.entityType} ${item.entityId} ${item.actorId} ${item.detail}`
            .toLowerCase()
            .includes(search.toLowerCase())
        : true,
    ),
    [events, search]
  );

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted dark:bg-muted">
        <div className="flex flex-col items-center gap-6">
          <div className="h-20 w-20 bg-muted dark:bg-card rounded-[2.5rem] animate-pulse flex items-center justify-center shadow-2xl">
            <ShieldCheck className="h-10 w-10 text-white dark:text-muted-foreground" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Verifying Immutable Ledger...</p>
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
            <Badge className="bg-muted dark:bg-card text-white dark:text-muted-foreground border-none font-black px-3 py-1 rounded-full uppercase tracking-widest text-[10px]">Compliance Black Box</Badge>
            <div className="flex items-center gap-1.5 text-primary font-bold text-xs uppercase tracking-widest">
               <Activity className="h-4 w-4 animate-pulse" />
               Real-time Audit Stream Active
            </div>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-foreground italic">Audit Log</h1>
          <p className="text-muted-foreground font-medium max-w-2xl text-lg leading-relaxed italic">"Integrity is the bedrock of every enterprise transaction."</p>
        </div>
        
        <div className="flex items-center bg-muted0 dark:bg-muted backdrop-blur-xl p-2 rounded-[2rem] border border-border dark:border-border/20 shadow-2xl">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-11 h-14 w-[300px] rounded-[1.5rem] bg-transparent border-none focus-visible:ring-0 text-base font-medium"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search audit trail..."
            />
          </div>
          <Button
            variant="secondary"
            className="h-14 w-14 rounded-[1.5rem] bg-muted dark:bg-card text-white dark:text-muted-foreground hover:bg-muted dark:hover:bg-muted transition-all shadow-xl"
            onClick={() => refresh(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-6 w-6", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Audit Intelligence Overlay */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <GlassCard className="rounded-[2.5rem] border-none shadow-xl p-8 flex items-center gap-6 group hover:shadow-indigo-500/10 transition-all">
            <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center group-hover:scale-110 transition-transform">
               <Lock className="h-7 w-7 text-primary" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">LEDGER STATUS</p>
               <h4 className="text-2xl font-black">IMMUTABLE</h4>
            </div>
         </GlassCard>
         <GlassCard className="rounded-[2.5rem] border-none shadow-xl p-8 flex items-center gap-6 group hover:shadow-emerald-500/10 transition-all">
            <div className="h-14 w-14 rounded-2xl bg-success flex items-center justify-center group-hover:scale-110 transition-transform">
               <FileSearch className="h-7 w-7 text-success" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">EVENTS RECORDED</p>
               <h4 className="text-2xl font-black text-success">{events.length}</h4>
            </div>
         </GlassCard>
         <Card className="rounded-[2.5rem] border-none shadow-xl bg-muted dark:bg-card p-8 flex items-center gap-6 group hover:shadow-slate-500/20 transition-all">
            <div className="h-14 w-14 rounded-2xl bg-white/10 dark:bg-muted backdrop-blur-md flex items-center justify-center group-hover:scale-110 transition-transform">
               <ShieldCheck className="h-7 w-7 text-white dark:text-muted-foreground" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground opacity-60">COMPLIANCE RATING</p>
               <h4 className="text-2xl font-black text-white dark:text-muted-foreground font-black">100% SECURE</h4>
            </div>
         </Card>
      </div>

      {/* Main Audit Registry */}
      <GlassCard className="rounded-[3rem] border-none shadow-2xl overflow-hidden">
        <CardHeader className="p-10 pb-6 border-b border-border dark:border-border/20">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                <History className="h-6 w-6 text-foreground" />
                Strategic Operation Trail
              </CardTitle>
              <CardDescription className="text-sm font-medium">Global auditable events for stage transitions, approval nodes, and high-stakes engagements.</CardDescription>
            </div>
            <div className="flex gap-4">
               <div className="flex bg-muted dark:bg-muted p-1.5 rounded-[1.5rem] shadow-inner">
                  <Button variant="ghost" size="sm" className="h-10 rounded-xl px-4 font-black text-[10px] tracking-widest bg-card dark:bg-muted shadow-md text-foreground">ALL OPERATIONS</Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/core/compliance")} className="h-10 rounded-xl px-4 font-black text-[10px] tracking-widest text-muted-foreground hover:text-muted-foreground transition-colors">FINANCIAL</Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/core/compliance")} className="h-10 rounded-xl px-4 font-black text-[10px] tracking-widest text-muted-foreground hover:text-muted-foreground transition-colors">SECURITY</Button>
               </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted dark:bg-muted">
                <tr>
                  <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Timestamp</th>
                  <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Operation</th>
                  <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Entity Matrix</th>
                  <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Actor Node</th>
                  <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Technical Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-slate-800/10">
                {(Array.isArray(filtered) ? filtered : []).map((item) => (
                  <tr key={item.id} className="group hover:bg-muted dark:hover:bg-muted transition-all cursor-default">
                    <td className="px-10 py-8">
                       <div className="space-y-1">
                          <p className="text-xs font-black uppercase tracking-tight text-foreground">{formatDate(item.createdAt)}</p>
                          <p className="text-[10px] font-bold text-muted-foreground">{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                       </div>
                    </td>
                    <td className="px-10 py-8">
                       <Badge variant="outline" className="rounded-full font-black text-[9px] px-3 py-1 border-border dark:border-border uppercase tracking-[0.1em] text-foreground bg-card dark:bg-muted shadow-sm">{item.action}</Badge>
                    </td>
                    <td className="px-10 py-8">
                       <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center">
                             <Layers className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                             <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{item.entityType}</p>
                             <p className="text-[10px] font-bold text-primary uppercase tracking-tighter italic">ID: {item.entityId.slice(-12)}</p>
                          </div>
                       </div>
                    </td>
                    <td className="px-10 py-8">
                       <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-xl bg-muted dark:bg-muted flex items-center justify-center font-black text-[10px]">
                             {item.actorId.charAt(0)}
                          </div>
                          <p className="text-xs font-black uppercase tracking-tight text-muted-foreground dark:text-muted-foreground">Custodian {item.actorId.slice(0, 8)}</p>
                       </div>
                    </td>
                    <td className="px-10 py-8">
                       <div className="flex items-center gap-3 group/detail">
                          <div className="h-1 w-1 rounded-full bg-muted group-hover/detail:bg-primary transition-colors" />
                          <p className="text-xs font-medium text-muted-foreground dark:text-muted-foreground leading-relaxed italic max-w-sm truncate group-hover/detail:text-muted-foreground dark:group-hover/detail:text-white transition-colors">"{item.detail}"</p>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
             <EmptyState
                title="The ledger is empty"
                description="No audit events have been recorded for this view yet."
                icon={History}
                className="m-10"
             />
          )}
        </CardContent>
      </GlassCard>

    </div>
  );
}
