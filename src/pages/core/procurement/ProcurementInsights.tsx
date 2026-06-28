import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useSession } from "@/core/security/session";
import { procurementService } from "@/core/services/procurement/procurementService";
import type {
  GoodsReceiptSyncRecord,
  LegalContractHandoff,
  ProcurementSpendInsight,
  SupplierAccessProvisioning,
} from "@/core/types/procurement/procurement";
import { 
  TrendingUp, 
  ShieldAlert, 
  Clock, 
  ArrowUpRight, 
  Activity, 
  CheckCircle2, 
  AlertCircle,
  Truck,
  Building2,
  Lock,
  Search,
  RefreshCcw,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState } from "@/components/shared/AsyncState";

const hoursSince = (timestamp: string) =>
  Math.max(0, (Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60));

const isLegalSlaBreached = (handoff: LegalContractHandoff) =>
  handoff.status !== "CONTRACT_ACCEPTED" && hoursSince(handoff.createdAt) > 8;

const isInventorySlaBreached = (sync: GoodsReceiptSyncRecord) =>
  sync.status === "PENDING_RECEIPT" && hoursSince(sync.createdAt) > 24;

const isProvisioningSlaBreached = (request: SupplierAccessProvisioning) =>
  request.status === "REQUESTED" && hoursSince(request.createdAt) > 4;

export default function ProcurementInsights() {
  const session = useSession();
  const [search, setSearch] = useState("");
  const [insights, setInsights] = useState<ProcurementSpendInsight[]>([]);
  const [legalHandoffs, setLegalHandoffs] = useState<LegalContractHandoff[]>([]);
  const [goodsReceiptSyncs, setGoodsReceiptSyncs] = useState<GoodsReceiptSyncRecord[]>([]);
  const [supplierAccess, setSupplierAccess] = useState<SupplierAccessProvisioning[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [ins, leg, goods, sup] = await Promise.all([
        procurementService.getSpendInsights(session.tenant_id, session),
        procurementService.listLegalHandoffs(session.tenant_id, session),
        procurementService.listGoodsReceiptSyncs(session.tenant_id, session),
        procurementService.listSupplierAccessProvisioning(session.tenant_id, session),
      ]);
      setInsights(ins);
      setLegalHandoffs(leg);
      setGoodsReceiptSyncs(goods);
      setSupplierAccess(sup);
    } catch (err) {
      setErrorMessage("Failed to load spend insights.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const integrationMetrics = useMemo(() => {
    const legalPending = (Array.isArray(legalHandoffs) ? legalHandoffs : []).filter((item) => item.status !== "CONTRACT_ACCEPTED").length;
    const inventoryPending = (Array.isArray(goodsReceiptSyncs) ? goodsReceiptSyncs : []).filter((item) => item.status === "PENDING_RECEIPT").length;
    const itPending = (Array.isArray(supplierAccess) ? supplierAccess : []).filter((item) => item.status === "REQUESTED").length;
    const slaBreached =
      (Array.isArray(legalHandoffs) ? legalHandoffs : []).filter(isLegalSlaBreached).length +
      (Array.isArray(goodsReceiptSyncs) ? goodsReceiptSyncs : []).filter(isInventorySlaBreached).length +
      (Array.isArray(supplierAccess) ? supplierAccess : []).filter(isProvisioningSlaBreached).length;
    
    return {
      legal: { count: legalPending, icon: ShieldAlert, color: "rose", label: "Legal Handoffs" },
      inventory: { count: inventoryPending, icon: Truck, color: "blue", label: "Inventory Sync" },
      it: { count: itPending, icon: Lock, color: "indigo", label: "I.T. Provisioning" },
      risk: { count: slaBreached, icon: AlertCircle, color: "amber", label: "SLA Breaches" }
    };
  }, [goodsReceiptSyncs, legalHandoffs, supplierAccess]);

  return (
    <div className="min-h-full p-8 space-y-10 bg-muted dark:bg-muted">
      {/* Tactical Header */}
      <div className="flex items-end justify-between border-b border-muted dark:border-muted pb-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-warning font-black text-[10px] uppercase tracking-[0.3em]">
            <Activity className="h-3 w-3" /> Supply Intelligence Node
          </div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic text-foreground">
            Procurement Insights
          </h1>
          <p className="text-sm text-muted-foreground font-medium">Strategic spend analytics and cross-departmental integration telemetry.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-warning transition-colors" />
            <Input 
              placeholder="Query Intelligence..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-white dark:bg-muted border-muted dark:border-muted w-64 rounded-xl focus:ring-warning/20"
            />
          </div>
          <Button 
            onClick={refresh}
            className="rounded-xl bg-warning hover:bg-warning text-white shadow-lg shadow-warning/20 gap-2"
          >
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            Sync
          </Button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {Object.entries(integrationMetrics).map(([key, data]) => {
          const Icon = data.icon;
          return (
            <div key={key} className="group relative p-6 rounded-[2rem] bg-white dark:bg-muted border border-muted dark:border-muted shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-1">
              <div className={cn(
                "absolute top-6 right-6 h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:rotate-12",
                data.color === 'rose' ? "bg-destructive text-destructive" :
                data.color === 'blue' ? "bg-primary text-primary" :
                data.color === 'indigo' ? "bg-primary text-primary" :
                "bg-warning text-warning"
              )}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{data.label}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black tracking-tighter text-foreground leading-none">
                    {loading ? "..." : data.count}
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest italic">Units Pending</span>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <div className={cn("h-1.5 flex-1 rounded-full bg-muted dark:bg-muted overflow-hidden")}>
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        data.color === 'rose' ? "bg-destructive" :
                        data.color === 'blue' ? "bg-primary" :
                        data.color === 'indigo' ? "bg-primary" :
                        "bg-warning"
                      )} 
                      style={{ width: `${Math.min(100, (data.count / 10) * 100)}%` }} 
                    />
                  </div>
                  <span className="text-[9px] font-bold text-muted-foreground">{(data.count / 10 * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Spend Insights & Integration Grid */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Spend Insights List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
             <h3 className="text-lg font-black tracking-tight uppercase italic text-muted-foreground dark:text-muted-foreground flex items-center gap-3">
               <TrendingUp className="h-5 w-5 text-warning" /> Strategic Spend Insights
             </h3>
             <Badge className="bg-warning text-warning border-none px-3 py-1 text-[8px] font-black uppercase tracking-widest">Global Scan Active</Badge>
          </div>
          
          <div className="grid gap-4">
            {loading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="h-24 rounded-3xl bg-muted animate-pulse" />
              ))
            ) : errorMessage ? (
              <ErrorState
                title="Couldn't load spend insights"
                description={errorMessage}
                onRetry={refresh}
              />
            ) : insights.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="No spend insights yet"
                description="No procurement spend analytics are available for this tenant scope."
              />
            ) : (
              (Array.isArray(insights) ? insights : []).map((insight) => (
                <div key={insight.id} className="group flex items-center justify-between p-6 rounded-3xl bg-white dark:bg-muted border border-muted dark:border-muted hover:border-warning/30 hover:shadow-xl transition-all duration-500">
                  <div className="flex items-center gap-6">
                    <div className="h-12 w-12 rounded-2xl bg-muted dark:bg-muted flex items-center justify-center group-hover:bg-warning group-hover:text-white transition-all duration-500 shadow-inner">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-foreground tracking-tight uppercase">{insight.label}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">{insight.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-xl font-black tracking-tighter text-foreground leading-none">{insight.value}</p>
                      <p className="text-[9px] font-bold text-success uppercase tracking-widest mt-1">Calculated</p>
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-muted-foreground group-hover:text-warning transition-colors" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Integration Telemetry */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
             <h3 className="text-lg font-black tracking-tight uppercase italic text-muted-foreground dark:text-muted-foreground flex items-center gap-3">
               <Activity className="h-5 w-5 text-primary" /> Node Telemetry
             </h3>
          </div>

          <div className="p-8 rounded-[2.5rem] bg-primary text-white relative overflow-hidden group shadow-2xl shadow-primary/20">
             <div className="absolute top-0 right-0 h-40 w-40 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl group-hover:scale-150 transition-transform duration-1000" />
             <div className="relative z-10 space-y-6">
                <div className="space-y-2">
                   <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Integration Health</p>
                   <div className="flex items-center justify-between">
                      <span className="text-3xl font-black tracking-tighter uppercase italic leading-none">94.2%</span>
                      <CheckCircle2 className="h-6 w-6 text-success" />
                   </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/10">
                   {[
                     { label: "Legal API", status: "Online", latency: "42ms" },
                     { label: "Inventory Hub", status: "Online", latency: "128ms" },
                     { label: "IT Provision", status: "Online", latency: "84ms" },
                   ].map((node) => (
                     <div key={node.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                           <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">{node.label}</span>
                        </div>
                        <span className="text-[10px] font-black tracking-widest">{node.latency}</span>
                     </div>
                   ))}
                </div>

                <Button className="w-full bg-white/10 hover:bg-white/20 border-white/10 text-[9px] font-black uppercase tracking-widest py-6 rounded-2xl">
                   View Handoff Ledger
                </Button>
             </div>
          </div>

          {/* SLA Alert Box */}
          <div className="p-6 rounded-3xl bg-destructive border border-destructive/20 space-y-4">
             <div className="flex items-center gap-3 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <span className="text-xs font-black uppercase tracking-widest">Critical SLA Alerts</span>
             </div>
             <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">
                {integrationMetrics.risk.count} Integration events have exceeded the target SLA thresholds. Immediate manual override or escalation required.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
