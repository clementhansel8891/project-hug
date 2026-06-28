import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  ShoppingBag, 
  RefreshCw, 
  Search, 
  Plus, 
  ChevronRight, 
  DollarSign, 
  ShieldCheck, 
  CheckCircle2, 
  Activity, 
  ArrowUpRight, 
  User, 
  Zap, 
  Info, 
  Package, 
  FileCheck,
  Truck,
  AlertCircle,
  Layers,
  MoreVertical
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
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSession } from "@/core/security/session";
import { salesService } from "@/core/services/sales/salesService";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import type { SalesOrder, SalesOpportunity } from "@/core/types/sales/sales";

export default function SalesOrderDesk() {
  const navigate = useNavigate();
  const session = useSession();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  
  // Create Order from Opp State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [opps, setOpps] = useState<SalesOpportunity[]>([]);
  const [loadingOpps, setLoadingOpps] = useState(false);

  const refresh = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      const data = await salesService.listOrders(session.tenant_id, session);
      setOrders(data);
      if (isManual) toast.success("Order queue synchronized.");
    } catch (err) {
      console.error("Failed to fetch sales orders:", err);
      toast.error("Telemetry failure in order queue.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session.tenant_id, session]);

  const loadOpportunities = async () => {
    try {
      setLoadingOpps(true);
      const data = await salesService.listOpportunities(session.tenant_id, session);
      setOpps((Array.isArray(data) ? data : []).filter(o => o.stage !== "CLOSED_WON" && o.stage !== "CLOSED_LOST"));
    } catch (err) {
      console.error("Failed to fetch opportunities:", err);
    } finally {
      setLoadingOpps(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreateFromOpp = async (oppId: string) => {
    try {
      await salesService.closeWonOpportunity(session.tenant_id, session, oppId);
      toast.success("Strategic Conversion Successful!", {
        description: "Opportunity closed as WON and Sales Order initialized."
      });
      setIsModalOpen(false);
      refresh(true);
    } catch (err) {
      toast.error("Conversion failure.");
    }
  };

  const filtered = useMemo(() => 
    (Array.isArray(orders) ? orders : []).filter((order) =>
      search
        ? `${order.id} ${order.customerName} ${order.status} ${order.inventoryCheck}`
            .toLowerCase()
            .includes(search.toLowerCase())
        : true,
    ),
    [orders, search]
  );

  return (
    <div className="p-8 space-y-10 animate-in fade-in duration-1000 max-w-[1600px] mx-auto">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row justify-between items-end gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge className="bg-success text-success border-none font-black px-3 py-1 rounded-full uppercase tracking-widest text-[10px]">Victory Registry</Badge>
            <div className="flex items-center gap-1.5 text-primary font-bold text-xs uppercase tracking-widest">
               <Activity className="h-4 w-4 animate-pulse" />
               Fulfillment Pipeline Live
            </div>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-foreground italic">Order Fulfillment</h1>

          <p className="text-muted-foreground font-medium max-w-2xl text-lg leading-relaxed italic">"A sale is not finished until the customer is delighted."</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white/50 dark:bg-muted backdrop-blur-xl p-2 rounded-[2rem] border border-border shadow-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-11 h-14 w-[300px] rounded-[1.5rem] bg-transparent border-none focus-visible:ring-0 text-base font-medium"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search orders..."
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

          <Dialog open={isModalOpen} onOpenChange={(open) => {
            setIsModalOpen(open);
            if (open) loadOpportunities();
          }}>
            <DialogTrigger asChild>
              <Button className="h-[4.5rem] px-10 rounded-[2rem] bg-success hover:bg-success shadow-2xl shadow-emerald-500/30 font-black text-sm gap-3 group transition-all hover:scale-105 active:scale-95">
                <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform duration-500" /> 
                CONVERT OPPORTUNITY
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[650px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white dark:bg-muted">
              <div className="h-2 bg-gradient-to-r from-emerald-500 via-indigo-500 to-emerald-500" />
              <div className="p-10 space-y-8">
                <DialogHeader>
                  <DialogTitle className="text-3xl font-black tracking-tight">Convert Victory to Order</DialogTitle>
                  <DialogDescription>Select an open strategic opportunity to close as WON and initialize the fulfillment protocol.</DialogDescription>
                </DialogHeader>
                
                <div className="py-2">
                  {loadingOpps ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <RefreshCw className="h-10 w-10 animate-spin text-primary" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Syncing strategic nodes...</p>
                    </div>
                  ) : opps.length === 0 ? (
                    <div className="text-center py-12 p-8 rounded-3xl bg-muted dark:bg-muted border-2 border-dashed border-border dark:border-border">
                      <p className="text-sm font-medium text-muted-foreground italic">No available conversion targets detected in the active pipeline.</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-4">
                        {(Array.isArray(opps) ? opps : []).map((opp) => (
                          <div 
                            key={opp.id} 
                            className="group flex items-center justify-between p-6 rounded-3xl bg-muted dark:bg-muted border border-border dark:border-border hover:border-success/50 hover:bg-white dark:hover:bg-muted transition-all cursor-pointer shadow-sm hover:shadow-xl"
                            onClick={() => handleCreateFromOpp(opp.id)}
                          >
                            <div className="flex items-center gap-5">
                               <div className="h-12 w-12 rounded-2xl bg-white dark:bg-muted flex items-center justify-center border border-border dark:border-border font-black text-sm group-hover:bg-success group-hover:text-white transition-colors">
                                  {opp.accountName.charAt(0)}
                               </div>
                               <div>
                                  <p className="font-black text-base">{opp.accountName}</p>
                                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter italic">Value: {formatCurrency(opp.amount)} {opp.currency}</p>
                               </div>
                            </div>
                            <Button size="sm" variant="secondary" className="rounded-xl font-black text-[10px] uppercase tracking-widest h-9 px-4 bg-success text-success hover:bg-success hover:text-white border-none shadow-none">SELECT NODE</Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
                
                <DialogFooter>
                  <Button variant="ghost" className="rounded-xl font-black text-xs uppercase tracking-widest h-12" onClick={() => setIsModalOpen(false)}>ABORT PROTOCOL</Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main Order Registry */}
      <GlassCard className="rounded-[3rem] border-none shadow-2xl overflow-hidden">
        <CardHeader className="p-10 pb-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                <ShoppingBag className="h-6 w-6 text-success" />
                Active Order Fulfillment Pool
              </CardTitle>
              <CardDescription className="text-sm font-medium">Orders awaiting inventory validation and final invoicing handoff.</CardDescription>
            </div>
            <div className="flex gap-4">
               <div className="flex bg-muted dark:bg-muted p-1.5 rounded-[1.5rem] shadow-inner">
                  <Button variant="ghost" size="sm" className="h-10 rounded-xl px-4 font-black text-[10px] tracking-widest bg-white dark:bg-muted shadow-md text-success">ACTIVE QUEUE</Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/core/logistics")} className="h-10 rounded-xl px-4 font-black text-[10px] tracking-widest text-muted-foreground hover:text-muted-foreground transition-colors">SHIPPED</Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/core/finance/operations")} className="h-10 rounded-xl px-4 font-black text-[10px] tracking-widest text-muted-foreground hover:text-muted-foreground transition-colors">DELINQUENT</Button>
               </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted dark:bg-muted">
                <tr>
                  <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Order Designation</th>
                  <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Customer Node</th>
                  <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Revenue Yield</th>
                  <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Logistics Check</th>
                  <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Invoice Protocol</th>
                  <th className="px-10 py-6 text-right text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Action Matrix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(Array.isArray(filtered) ? filtered : []).map((order) => (
                  <tr key={order.id} className="group hover:bg-success dark:hover:bg-success transition-all cursor-default">
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-5">
                        <div className="h-12 w-12 rounded-2xl bg-white dark:bg-muted flex items-center justify-center font-black text-sm shadow-xl transition-all group-hover:scale-110 group-hover:bg-success group-hover:text-white border border-border dark:border-border">
                          <Package className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="font-black text-base italic">{order.id.slice(-8)}</p>
                          <Badge variant="outline" className="text-[9px] font-black px-2 py-0 h-4 border-border uppercase tracking-widest mt-1">LIFECYCLE ACTIVE</Badge>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                       <p className="text-sm font-black text-muted-foreground dark:text-muted-foreground">{order.customerName}</p>
                       <p className="text-[10px] font-bold text-muted-foreground uppercase">Strategic Account</p>
                    </td>
                    <td className="px-10 py-8 text-success font-black text-base">
                       {formatCurrency(order.amount)}
                    </td>
                    <td className="px-10 py-8">
                       <Badge 
                        variant={order.inventoryCheck === "UNAVAILABLE" ? "destructive" : "outline"}
                        className={cn(
                          "rounded-full font-black text-[9px] px-3 py-1 border-none shadow-sm uppercase tracking-widest",
                          order.inventoryCheck === "AVAILABLE" ? "bg-primary text-primary" : "bg-destructive text-destructive"
                        )}
                       >
                        {order.inventoryCheck}
                       </Badge>
                    </td>
                    <td className="px-10 py-8">
                       <div className="flex items-center gap-3">
                          <div className={cn("h-2 w-2 rounded-full", order.financeInvoiceId ? "bg-success" : "bg-warning animate-pulse")} />
                          <p className={cn("text-xs font-black uppercase tracking-tight", order.financeInvoiceId ? "text-muted-foreground dark:text-muted-foreground" : "text-warning")}>
                             {order.financeInvoiceId ? order.financeInvoiceId.slice(-8) : "PENDING INVOICE"}
                          </p>
                       </div>
                    </td>
                    <td className="px-10 py-8 text-right">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                             <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-white transition-all shadow-sm">
                                <MoreVertical className="h-5 w-5 text-muted-foreground" />
                             </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-2xl border-none">
                             <DropdownMenuItem className="gap-3 py-3 rounded-xl font-bold" onClick={() => navigate("/core/finance/operations")}><FileCheck className="h-4 w-4 text-primary" /> Generate Invoice</DropdownMenuItem>
                             <DropdownMenuItem className="gap-3 py-3 rounded-xl font-bold" onClick={() => navigate("/core/logistics")}><Truck className="h-4 w-4 text-success" /> Track Shipment</DropdownMenuItem>
                             <DropdownMenuItem className="gap-3 py-3 rounded-xl font-bold text-destructive" onClick={() => navigate("/core/logistics")}><AlertCircle className="h-4 w-4" /> Escalate Delay</DropdownMenuItem>
                          </DropdownMenuContent>
                       </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && filtered.length === 0 && (
            <EmptyState
              title="No orders yet"
              description="No fulfillment orders match the current scope. Convert a won opportunity to create one."
              icon={ShoppingBag}
              className="m-10"
            />
          )}
        </CardContent>
      </GlassCard>

      {/* Fulfillment Metrics Overlay — computed from live order data */}
      <FulfillmentMetrics orders={orders} />

    </div>
  );
}

/**
 * Functional fulfillment metrics component — replaces hardcoded stub values
 * with computed metrics from live order data.
 */
function FulfillmentMetrics({ orders }: { orders: SalesOrder[] }) {
  const safeOrders = Array.isArray(orders) ? orders : [];
  const total = safeOrders.length || 1;

  const invoiced = safeOrders.filter((o) => !!o.financeInvoiceId).length;
  const invoicingRate = total > 0 ? ((invoiced / total) * 100).toFixed(1) : "0";

  const available = safeOrders.filter((o) => o.inventoryCheck === "AVAILABLE").length;
  const logisticsReady = total > 0 ? ((available / total) * 100).toFixed(1) : "0";

  const stockOuts = safeOrders.filter((o) => o.inventoryCheck === "UNAVAILABLE").length;

  const totalValue = safeOrders.reduce((acc, o) => acc + o.amount, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
      <GlassCard className="rounded-[2.5rem] border-none shadow-xl p-8 space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center">
          <FileCheck className="h-7 w-7 text-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">INVOICING RATE</p>
          <h4 className="text-3xl font-black">{invoicingRate}%</h4>
        </div>
      </GlassCard>
      <GlassCard className="rounded-[2.5rem] border-none shadow-xl p-8 space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-success flex items-center justify-center">
          <Truck className="h-7 w-7 text-success" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">LOGISTICS READY</p>
          <h4 className="text-3xl font-black text-success">{logisticsReady}%</h4>
        </div>
      </GlassCard>
      <GlassCard className="rounded-[2.5rem] border-none shadow-xl p-8 space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-destructive flex items-center justify-center">
          <AlertCircle className="h-7 w-7 text-destructive" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">STOCK OUTS</p>
          <h4 className="text-3xl font-black text-destructive">{stockOuts}</h4>
        </div>
      </GlassCard>
      <Card className="rounded-[2.5rem] border-none shadow-xl bg-primary text-white p-8 space-y-4 shadow-indigo-600/20">
        <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-border">
          <DollarSign className="h-7 w-7" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-primary-foreground/80">FULFILLMENT VALUE</p>
          <h4 className="text-3xl font-black">{formatCurrency(totalValue)}</h4>
        </div>
      </Card>
    </div>
  );
}
