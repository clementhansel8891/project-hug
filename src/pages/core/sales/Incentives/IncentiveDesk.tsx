import { useCallback, useEffect, useState } from "react";
import { 
  Plus, 
  Settings2, 
  History, 
  CheckCircle2, 
  TrendingUp,
  Split,
  Calendar,
  User,
  Activity,
  ArrowRight,
  RefreshCw,
  Search,
  DollarSign,
  Zap,
  Target,
  BarChart3,
  Layers,
  ShieldCheck,
  ChevronRight,
  ArrowUpRight,
  PieChart,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { GlassCard } from "@/components/shared/GlassCard";
import { EmptyState } from "@/components/shared/AsyncState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSession } from "@/core/security/session";
import { incentivesService } from "@/core/services/sales/incentivesService";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import type { IncentivePlan, SalesAttribution, IncentiveAuditLog } from "@/core/types/sales/incentives";
import { IncentiveConfigModal } from "../modals/IncentiveConfigModal";

export default function IncentiveDesk() {
  const session = useSession();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [plans, setPlans] = useState<IncentivePlan[]>([]);
  const [attributions, setAttributions] = useState<SalesAttribution[]>([]);
  const [auditLogs, setAuditLogs] = useState<IncentiveAuditLog[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isRecalcOpen, setIsRecalcOpen] = useState(false);
  const [isCreatePlanOpen, setIsCreatePlanOpen] = useState(false);
  const [recalcDates, setRecalcDates] = useState({ start: "", end: "" });

  const refresh = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      const [p, a, stats] = await Promise.all([
        incentivesService.listPlans(session),
        incentivesService.listAttributions(session),
        incentivesService.getAnalytics(session),
      ]);
      setPlans(p);
      setAttributions(a);
      setAnalytics(stats);
      if (isManual) toast.success("Incentive telemetry synchronized.");
    } catch (err) {
      console.error("Failed to fetch incentive data:", err);
      toast.error("Telemetry failure in incentive engine.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const togglePlanStatus = async (plan: IncentivePlan) => {
    try {
      await incentivesService.updateStatus(plan.id, !plan.is_active, session, session.user_id);
      toast.success(`Plan ${!plan.is_active ? 'ACTIVATED' : 'DEACTIVATED'} successfully.`);
      refresh(true);
    } catch (err) {
      toast.error("Status update failure.");
    }
  };

  const showHistory = async (planId: string) => {
    try {
      const logs = await incentivesService.getAuditLogs(planId, session);
      setAuditLogs(logs);
      setSelectedPlanId(planId);
      setIsHistoryOpen(true);
    } catch (err) {
      toast.error("Audit log retrieval failure.");
    }
  };

  const handleProcessPayouts = async () => {
    try {
      setProcessing(true);
      await incentivesService.processPayouts(session);
      toast.success("Strategic Accrual Completed", {
        description: "Pending incentives have been posted to the general ledger."
      });
      refresh(true);
    } catch (err) {
      toast.error("Payout processing failure.");
    } finally {
      setProcessing(false);
    }
  };

  const handleRecalculate = async () => {
    if (!recalcDates.start || !recalcDates.end) {
      toast.error("Date horizon required.");
      return;
    }
    try {
      setProcessing(true);
      const res = await incentivesService.recalculate(
        { start_date: recalcDates.start, end_date: recalcDates.end },
        session
      );
      toast.success(`Recalculation Success: ${res.processed} nodes updated.`);
      setIsRecalcOpen(false);
      refresh(true);
    } catch (err) {
      toast.error("Recalculation failure.");
    } finally {
      setProcessing(false);
    }
  };

  const activePlans = (Array.isArray(plans) ? plans : []).filter(p => p.is_active);
  const pendingAmount = (Array.isArray(attributions) ? attributions : []).filter(a => a.status === "PENDING")
    .reduce((sum, a) => sum + Number(a.incentive_amount), 0);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted dark:bg-muted">
        <div className="flex flex-col items-center gap-6">
          <div className="h-20 w-20 bg-primary rounded-[2.5rem] animate-pulse flex items-center justify-center shadow-2xl shadow-indigo-500/20">
            <DollarSign className="h-10 w-10 text-white" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Initializing Yield Engine...</p>
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
            <Badge className="bg-primary text-white border-none font-black px-3 py-1 rounded-full uppercase tracking-widest text-[10px]">Revenue Acceleration</Badge>
            <div className="flex items-center gap-1.5 text-primary font-bold text-xs uppercase tracking-widest">
               <Activity className="h-4 w-4 animate-pulse" />
               Yield Stream Live
            </div>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-foreground">Incentive Desk</h1>
          <p className="text-muted-foreground font-medium max-w-2xl text-lg leading-relaxed italic">"Reward excellence, and excellence becomes the standard."</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-muted0 dark:bg-muted backdrop-blur-xl p-2 rounded-[2rem] border border-border dark:border-border/20 shadow-2xl">
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
            onClick={() => setIsCreatePlanOpen(true)}
          >
            <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform duration-500" /> 
            NEW INCENTIVE PLAN
          </Button>
        </div>
      </div>

      {/* Yield Metrics Grid */}
      <div className="grid gap-8 md:grid-cols-3">
         <Card className="rounded-[3rem] border-none shadow-2xl bg-card dark:bg-muted p-8 space-y-4 group hover:shadow-indigo-500/10 transition-all">
            <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center group-hover:scale-110 transition-transform">
               <Settings2 className="h-7 w-7 text-primary" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">ACTIVE PROTOCOLS</p>
               <h4 className="text-3xl font-black">{activePlans.length}</h4>
               <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1 italic">Strategically Mapped</p>
            </div>
         </Card>
         <Card className="rounded-[3rem] border-none shadow-2xl bg-card dark:bg-muted p-8 space-y-4 group hover:shadow-emerald-500/10 transition-all">
            <div className="h-14 w-14 rounded-2xl bg-success flex items-center justify-center group-hover:scale-110 transition-transform">
               <TrendingUp className="h-7 w-7 text-success" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">ACCRUED INCENTIVES</p>
               <h4 className="text-3xl font-black text-success">{formatCurrency(pendingAmount)}</h4>
               <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1 italic">Pending Handoff</p>
            </div>
         </Card>
         <Card className="rounded-[3rem] border-none shadow-2xl bg-primary text-white p-8 space-y-4 group hover:shadow-indigo-500/30 transition-all">
            <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center group-hover:scale-110 transition-transform border border-border">
               <Zap className="h-7 w-7 text-white" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest opacity-60">REVENUE ACCELERATION</p>
               <h4 className="text-3xl font-black">{analytics?.roi?.toFixed(1) || "0.0"}x ROI</h4>
               <p className="text-[10px] font-bold text-white/60 uppercase mt-1 italic">Yield Multiplier Active</p>
            </div>
         </Card>
      </div>

      {/* Analytics Section */}
      {analytics && (
        <div className="grid gap-10 md:grid-cols-2">
            <GlassCard className="rounded-[3rem] border-none shadow-2xl overflow-hidden">
               <CardHeader className="p-10 pb-4">
                  <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-3 text-foreground">
                     <Target className="h-6 w-6 text-primary" />
                     Performance Leaders
                  </CardTitle>
                  <CardDescription className="text-sm font-medium">Highest strategic incentive contributions for the active period.</CardDescription>
               </CardHeader>
               <CardContent className="p-10 pt-0 space-y-6">
                  {(Array.isArray(analytics.topEarners) ? analytics.topEarners : []).map((earner: any, i: number) => (
                    <div key={earner.employee_id} className="flex items-center justify-between p-4 rounded-3xl bg-white/80 dark:bg-muted hover:scale-[1.02] transition-transform shadow-sm border border-border">
                       <div className="flex items-center gap-5">
                          <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center font-black text-xs shadow-inner", i === 0 ? "bg-warning text-warning" : "bg-muted text-muted-foreground")}>
                             #{i+1}
                          </div>
                          <div>
                             <p className="font-black text-sm uppercase">Custodian {earner.employee_id.slice(0, 8)}</p>
                             <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">ID: {earner.employee_id}</p>
                          </div>
                       </div>
                       <p className="text-lg font-black text-success">{formatCurrency(earner.amount)}</p>
                    </div>
                  ))}
               </CardContent>
            </GlassCard>

            <GlassCard className="rounded-[3rem] border-none shadow-2xl overflow-hidden p-10 space-y-8">
               <div className="space-y-2">
                  <h3 className="text-2xl font-black tracking-tight flex items-center gap-3">
                     <PieChart className="h-6 w-6 text-primary" />
                     Efficiency Matrix
                  </h3>
                  <p className="text-sm font-medium text-muted-foreground">Platform-wide incentive utilization vs. revenue yield.</p>
               </div>
               
               <div className="space-y-10 pt-4">
                  <div className="space-y-4">
                     <div className="flex justify-between items-end">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Incentive to Revenue Ratio</p>
                        <p className="text-xl font-black">{((analytics.totalIncentive / analytics.totalRevenue) * 100 || 0).toFixed(1)}%</p>
                     </div>
                     <div className="h-3 w-full bg-muted dark:bg-muted rounded-full overflow-hidden shadow-inner">
                        <div 
                           className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full shadow-lg" 
                           style={{ width: `${Math.min((analytics.totalIncentive / analytics.totalRevenue) * 100 || 0, 100)}%` }}
                        />
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                     <div className="p-6 rounded-[2rem] bg-primary border border-primary space-y-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-primary opacity-60">Total Accruals</p>
                        <h4 className="text-2xl font-black">{formatCurrency(analytics.totalIncentive)}</h4>
                     </div>
                     <div className="p-6 rounded-[2rem] bg-success border border-success/10 space-y-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-success opacity-60">Revenue Impact</p>
                        <h4 className="text-2xl font-black">{formatCurrency(analytics.totalRevenue)}</h4>
                     </div>
                  </div>
               </div>
            </GlassCard>
        </div>
      )}

      {/* Main Configuration Desk */}
      <GlassCard className="rounded-[3rem] border-none shadow-2xl overflow-hidden">
        <Tabs defaultValue="plans" className="w-full">
          <CardHeader className="p-10 pb-0">
             <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
                <TabsList className="bg-muted dark:bg-muted p-1.5 rounded-2xl shadow-inner border-none">
                  <TabsTrigger value="plans" className="rounded-xl px-6 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-lg h-10 border-none transition-all">
                    <Settings2 className="h-4 w-4 mr-2" />
                    Incentive Plans
                  </TabsTrigger>
                  <TabsTrigger value="attributions" className="rounded-xl px-6 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-lg h-10 border-none transition-all">
                    <Activity className="h-4 w-4 mr-2" />
                    Live Attributions
                  </TabsTrigger>
                </TabsList>

                <div className="flex items-center gap-3">
                   <Button 
                      variant="ghost" 
                      className="rounded-2xl h-12 font-black text-[10px] uppercase tracking-widest text-primary hover:bg-primary gap-2"
                      onClick={() => setIsRecalcOpen(true)}
                   >
                      <History className="h-4 w-4" /> CORRECTION ENGINE
                   </Button>
                   <Button 
                      className="rounded-2xl h-12 px-8 bg-success hover:bg-success font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-500/20 gap-2"
                      onClick={handleProcessPayouts}
                      disabled={processing || pendingAmount === 0}
                   >
                      <CheckCircle2 className="h-4 w-4" /> {processing ? "EXECUTING ACCRUAL..." : "PROCESS ACCRUALS"}
                   </Button>
                </div>
             </div>
          </CardHeader>

          <TabsContent value="plans" className="mt-0 outline-none">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted dark:bg-muted">
                  <tr>
                    <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Plan Designation</th>
                    <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Node Status</th>
                    <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Tactical Horizon</th>
                    <th className="px-10 py-6 text-right text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Action Matrix</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border dark:divide-slate-800/10">
                  {(Array.isArray(plans) ? plans : []).map((plan) => (
                    <tr key={plan.id} className="group hover:bg-muted dark:hover:bg-muted transition-all cursor-default">
                      <td className="px-10 py-8">
                        <div className="flex items-center gap-5">
                           <div className="h-12 w-12 rounded-2xl bg-card dark:bg-muted flex items-center justify-center font-black text-sm shadow-xl group-hover:bg-primary group-hover:text-white transition-colors border border-border dark:border-border">
                              <Layers className="h-6 w-6" />
                           </div>
                           <div>
                              <p className="font-black text-base">{plan.name}</p>
                              <p className="text-[10px] font-medium text-muted-foreground italic max-w-md truncate">{plan.description || "Incentive protocol with no supplementary metadata."}</p>
                           </div>
                        </div>
                      </td>
                      <td className="px-10 py-8">
                        <div className="flex items-center gap-4">
                          <Switch 
                            checked={plan.is_active} 
                            onCheckedChange={() => togglePlanStatus(plan)}
                            className="data-[state=checked]:bg-primary"
                          />
                          <Badge variant={plan.is_active ? "default" : "secondary"} className={cn("rounded-full font-black text-[8px] uppercase tracking-widest", plan.is_active ? "bg-primary" : "bg-muted dark:bg-muted text-muted-foreground")}>
                            {plan.is_active ? "ACTIVE" : "INACTIVE"}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-10 py-8">
                        <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-tighter">
                           <Calendar className="h-3 w-3 text-primary" />
                           {formatDate(plan.start_date)} — {plan.end_date ? formatDate(plan.end_date) : "ONGOING"}
                        </div>
                      </td>
                      <td className="px-10 py-8 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" className="rounded-xl h-10 font-black text-[9px] uppercase tracking-widest gap-2" onClick={() => showHistory(plan.id)}>
                            <History className="h-3.5 w-3.5" /> LOGS
                          </Button>
                          <Button variant="ghost" className="rounded-xl h-10 font-black text-[9px] uppercase tracking-widest">EDIT</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && plans.length === 0 && (
              <EmptyState
                title="No incentive plans"
                description="No incentive plans are configured yet. Create a plan to start rewarding performance."
                icon={Settings2}
                className="m-10"
              />
            )}
          </TabsContent>

          <TabsContent value="attributions" className="mt-0 outline-none">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted dark:bg-muted">
                  <tr>
                    <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Staff Node</th>
                    <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Entity Link</th>
                    <th className="px-10 py-6 text-right text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Yield Amount</th>
                    <th className="px-10 py-6 text-right text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border dark:divide-slate-800/10">
                  {(Array.isArray(attributions) ? attributions : []).map((attr) => (
                    <tr key={attr.id} className="group hover:bg-muted dark:hover:bg-muted transition-all cursor-default">
                      <td className="px-10 py-8">
                        <div className="flex items-center gap-4">
                           <div className="h-10 w-10 rounded-xl bg-muted dark:bg-muted flex items-center justify-center font-black text-xs group-hover:bg-primary group-hover:text-white transition-colors">
                              {attr.employee_id.charAt(0)}
                           </div>
                           <div>
                              <p className="font-black text-sm uppercase">Custodian {attr.employee_id.slice(0, 8)}</p>
                              {attr.share_percent < 100 && (
                                <div className="flex items-center gap-1.5 text-[9px] text-primary font-black uppercase mt-0.5">
                                  <Split className="h-3 w-3" /> {attr.share_percent}% Split
                                </div>
                              )}
                           </div>
                        </div>
                      </td>
                      <td className="px-10 py-8">
                        <p className="text-xs font-black text-muted-foreground uppercase tracking-tighter italic">TXID: {attr.entity_id.slice(-12)}</p>
                      </td>
                      <td className="px-10 py-8 text-right font-black text-base text-success">
                        {formatCurrency(Number(attr.incentive_amount))}
                      </td>
                      <td className="px-10 py-8 text-right">
                        <Badge variant="outline" className={cn(
                          "rounded-full font-black text-[8px] px-3 py-1 border-none shadow-sm uppercase tracking-widest",
                          attr.status === "PENDING" ? "bg-warning text-warning" : "bg-success text-success"
                        )}>
                          {attr.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && attributions.length === 0 && (
              <EmptyState
                title="No attributions yet"
                description="No incentive attributions have been recorded. Process deals to populate this view."
                icon={Activity}
                className="m-10"
              />
            )}
          </TabsContent>
        </Tabs>
      </GlassCard>

      {/* Slide-out Sheets */}
      <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <SheetContent side="right" className="sm:max-w-md border-none bg-card dark:bg-muted p-0 shadow-2xl">
          <div className="h-2 bg-primary" />
          <div className="p-10 space-y-8">
             <SheetHeader>
               <SheetTitle className="text-3xl font-black tracking-tight flex items-center gap-3">
                 <History className="h-7 w-7 text-primary" />
                 Audit History
               </SheetTitle>
               <SheetDescription className="font-medium">Technical change logs and lifecycle events for the active protocol.</SheetDescription>
             </SheetHeader>

             <ScrollArea className="h-[calc(100vh-250px)] pr-4">
                <div className="space-y-6">
                   {auditLogs.length === 0 ? (
                     <div className="text-center py-20 grayscale opacity-30 space-y-4">
                        <ShieldCheck className="h-12 w-12 mx-auto" />
                        <p className="text-[10px] font-black uppercase tracking-widest">No Protocol Mutations</p>
                     </div>
                   ) : (
                     (Array.isArray(auditLogs) ? auditLogs : []).map((log) => (
                       <div key={log.id} className="relative pl-8 pb-8 border-l-2 border-border dark:border-border last:pb-0">
                         <div className="absolute -left-[9px] top-0 h-4 w-4 bg-card dark:bg-muted border-4 border-primary rounded-full shadow-lg shadow-indigo-500/30" />
                         <Card className="rounded-[1.5rem] border-none bg-muted dark:bg-muted p-5 space-y-3">
                            <div className="flex items-center justify-between">
                               <Badge className="rounded-full bg-primary text-white font-black text-[8px] uppercase tracking-widest">{log.action}</Badge>
                               <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                 <Calendar className="h-3 w-3" /> {formatDateTime(log.timestamp)}
                               </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-tighter">
                               <User className="h-3.5 w-3.5" /> Custodian: {log.actor_id.slice(0, 8)}
                            </div>
                            {log.changes?.before?.is_active !== log.changes?.after?.is_active && (
                              <div className="flex items-center gap-3 mt-1">
                                <Badge variant={log.changes.before?.is_active ? "default" : "secondary"} className="text-[7px] font-black uppercase tracking-widest">{log.changes.before?.is_active ? "ACTIVE" : "INACTIVE"}</Badge>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <Badge variant={log.changes.after?.is_active ? "default" : "secondary"} className="text-[7px] font-black uppercase tracking-widest">{log.changes.after?.is_active ? "ACTIVE" : "INACTIVE"}</Badge>
                              </div>
                            )}
                         </Card>
                       </div>
                     ))
                   )}
                </div>
             </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={isRecalcOpen} onOpenChange={setIsRecalcOpen}>
        <SheetContent side="right" className="sm:max-w-md border-none bg-card dark:bg-muted p-0 shadow-2xl">
          <div className="h-2 bg-warning" />
          <div className="p-10 space-y-10">
             <SheetHeader>
               <SheetTitle className="text-3xl font-black tracking-tight flex items-center gap-3 text-warning">
                 <History className="h-7 w-7" />
                 Correction Engine
               </SheetTitle>
               <SheetDescription className="font-medium leading-relaxed italic">"Precision is the bedrock of strategic trust." Retrospectively re-evaluate deal attributions.</SheetDescription>
             </SheetHeader>

             <div className="space-y-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tactical Start Date</label>
                    <Input 
                        type="date" 
                        className="h-14 rounded-2xl bg-muted dark:bg-muted border-none shadow-inner font-bold"
                        value={recalcDates.start}
                        onChange={(e) => setRecalcDates(prev => ({ ...prev, start: e.target.value }))}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tactical End Date</label>
                    <Input 
                        type="date" 
                        className="h-14 rounded-2xl bg-muted dark:bg-muted border-none shadow-inner font-bold"
                        value={recalcDates.end}
                        onChange={(e) => setRecalcDates(prev => ({ ...prev, end: e.target.value }))}
                    />
                </div>
                <div className="p-6 bg-warning border border-warning rounded-3xl space-y-3">
                   <p className="text-[10px] font-black uppercase text-warning flex items-center gap-2">
                      <Zap className="h-3 w-3" /> Idempotent Guard Active
                   </p>
                   <p className="text-xs font-medium text-warning leading-relaxed italic">
                      This operation will re-evaluate all orders but will NOT affect attributions already processed into payouts or ledger entries.
                   </p>
                </div>
             </div>

             <Button 
                className="w-full h-16 rounded-[1.5rem] bg-warning hover:bg-warning font-black text-sm shadow-2xl shadow-orange-500/20"
                onClick={handleRecalculate}
                disabled={processing || !recalcDates.start || !recalcDates.end}
             >
                {processing ? "SYNCHRONIZING..." : "EXECUTE RECALCULATION"}
             </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Create Incentive Plan Modal */}
      <IncentiveConfigModal
        isOpen={isCreatePlanOpen}
        onClose={() => setIsCreatePlanOpen(false)}
        onSuccess={() => refresh(true)}
      />
    </div>
  );
}
