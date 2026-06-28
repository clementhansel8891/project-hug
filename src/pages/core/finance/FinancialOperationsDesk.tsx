import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
  DollarSign, 
  FileCheck, 
  CreditCard, 
  TrendingDown, 
  Activity, 
  ShieldCheck, 
  RefreshCw, 
  ArrowUpRight, 
  TrendingUp, 
  AlertCircle,
  Search,
  MoreVertical,
  Layers,
  Zap,
  CheckCircle2,
  FileText,
  History,
  Workflow,
  Scale,
  GanttChartSquare,
  BarChart3,
  ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { useSession } from "@/core/security/session";
import { salesService } from "@/core/services/sales/salesService";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageShell } from "@/core/ui/PageShell";
import { PageHeader } from "@/core/ui/PageHeader";

export default function FinancialOperationsDesk() {
  const session = useSession();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"invoices" | "delinquency" | "routing">("invoices");

  const refresh = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      const orderData = await salesService.listOrders(session.tenant_id, session);
      setOrders(orderData);

      if (isManual) toast.success("Financial matrix synchronized.");
    } catch (err) {
      console.error("Financial sync failure:", err);
      toast.error("Telemetry failure in financial suite.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session.tenant_id, session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredInvoices = useMemo(() => 
    (Array.isArray(orders) ? orders : []).filter(o => 
      search ? `${o.id} ${o.customerName}`.toLowerCase().includes(search.toLowerCase()) : true
    ),
  [orders, search]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-8">
          <div className="relative h-24 w-24">
             <div className="absolute inset-0 bg-primary/20 rounded-[2.5rem] blur-2xl animate-pulse" />
             <div className="relative h-full w-full bg-primary rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-primary/40 border border-border">
                <DollarSign className="h-12 w-12 text-primary-foreground" />
             </div>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Synchronizing Revenue Matrix...</p>
        </div>
      </div>
    );
  }

  return (
    <PageShell
      header={
        <PageHeader
          title="Financial Operations Desk"
          subtitle="Revenue lifecycle management, delinquency tracking, and automated invoicing."
          primaryAction={
            <Button className="rounded-[1.2rem] px-8 h-12 gap-3 font-black text-xs uppercase tracking-widest bg-success hover:bg-success shadow-xl shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95">
              <FileCheck className="h-4 w-4" /> BATCH INVOICE
            </Button>
          }
          secondaryActions={
            <Button 
              variant="outline" 
              className="rounded-[1.2rem] px-6 h-12 font-black text-xs uppercase tracking-widest border-border bg-muted0 backdrop-blur-sm hover:bg-white transition-all"
              onClick={() => refresh(true)}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </Button>
          }
        />
      }
    >
      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
        {/* Tier 1: Financial Health Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="glass-card border-none shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
               <TrendingUp className="w-16 h-16 text-success" />
            </div>
            <CardContent className="p-8">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Total Revenue Pool</div>
              <div className="text-3xl font-black italic tracking-tighter flex items-end gap-2">
                Rp 18.6M <span className="text-sm font-bold text-success mb-1">+4.2%</span>
              </div>
              <div className="flex items-center gap-2 mt-4 text-[10px] font-bold text-success uppercase">
                <ShieldCheck className="w-3 h-3" />
                Capital Velocity Optimal
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-none shadow-xl relative overflow-hidden group">
            <CardContent className="p-8">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">DSO (Days Sales Outstanding)</div>
              <div className="text-3xl font-black italic tracking-tighter text-primary">14.2 Days</div>
              <div className="flex items-center gap-2 mt-4 text-[10px] font-bold text-primary uppercase">
                <Scale className="w-3 h-3" />
                Industry Alpha Tier
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-none shadow-xl relative overflow-hidden group">
            <CardContent className="p-8">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Delinquency Risk</div>
              <div className="text-3xl font-black italic tracking-tighter text-warning">2.1%</div>
              <Progress value={2.1} className="h-1.5 mt-4 bg-warning" />
            </CardContent>
          </Card>

          <Card className="glass-card border-none shadow-xl relative overflow-hidden group">
            <CardContent className="p-8">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Audit Status</div>
              <div className="text-3xl font-black italic tracking-tighter">CLEAN</div>
              <div className="flex items-center gap-2 mt-4 text-[10px] font-bold text-success uppercase">
                <CheckCircle2 className="w-3 h-3" />
                Global Parity Verified
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tier 2: Search & Tab Navigation */}
        <div className="flex flex-col md:flex-row gap-6 items-center justify-between glass-card p-6 rounded-[2.5rem]">
           <div className="relative w-full md:w-[400px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search invoices, accounts, or routing codes..." 
                className="pl-12 h-12 bg-secondary/50 border-none rounded-xl font-bold text-xs uppercase tracking-widest"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
           </div>
           <div className="flex items-center gap-4 bg-secondary/30 p-1.5 rounded-2xl">
              {(["invoices", "delinquency", "routing"] as const).map(tab => (
                <Button 
                  key={tab}
                  variant={activeTab === tab ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "rounded-xl px-6 h-9 font-black text-[10px] uppercase tracking-widest transition-all",
                    activeTab === tab && "shadow-lg shadow-primary/20"
                  )}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </Button>
              ))}
           </div>
        </div>

        {/* Tier 3: Main Display */}
        {activeTab === "invoices" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-2 space-y-8">
                <Card className="glass-card border-none shadow-2xl rounded-[3rem] overflow-hidden">
                   <div className="p-8 border-b border-border/50 flex items-center justify-between bg-secondary/20">
                      <div className="flex items-center gap-3">
                         <FileText className="h-6 w-6 text-primary" />
                         <h3 className="font-black italic uppercase tracking-tighter text-xl">Revenue Ledger Registry</h3>
                      </div>
                      <Badge className="bg-primary/10 text-primary border-none font-black text-[9px] px-3 py-1 uppercase tracking-widest">REAL-TIME SYNC</Badge>
                   </div>
                   <div className="p-0 overflow-x-auto">
                      <table className="w-full text-sm">
                         <thead className="bg-secondary/30 text-[9px] uppercase font-black tracking-widest text-muted-foreground">
                            <tr>
                               <th className="px-8 py-5 text-left">Invoice Node</th>
                               <th className="px-8 py-5 text-left">Account</th>
                               <th className="px-8 py-5 text-left">Yield</th>
                               <th className="px-8 py-5 text-left">Maturity</th>
                               <th className="px-8 py-5 text-right">Status</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-border/50">
                            {filteredInvoices.map(invoice => (
                               <tr key={invoice.id} className="group hover:bg-secondary/10 transition-all cursor-default">
                                  <td className="px-8 py-6">
                                     <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                           <CreditCard className="h-5 w-5" />
                                        </div>
                                        <div>
                                           <p className="font-black text-xs italic">INV-{invoice.id.slice(-6).toUpperCase()}</p>
                                           <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">E-LINK READY</p>
                                        </div>
                                     </div>
                                  </td>
                                  <td className="px-8 py-6">
                                     <p className="text-xs font-black italic">{invoice.customerName}</p>
                                     <p className="text-[8px] font-medium text-muted-foreground uppercase">ID: ACC-442</p>
                                  </td>
                                  <td className="px-8 py-6 font-black text-xs italic text-success">
                                     ${invoice.amount.toLocaleString()}
                                  </td>
                                  <td className="px-8 py-6">
                                     <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                                        <History className="h-3 w-3" />
                                        12 Days Remaining
                                     </div>
                                  </td>
                                  <td className="px-8 py-6 text-right">
                                     <Badge className="rounded-full bg-success text-success border-none font-black text-[9px] px-3 py-1 uppercase tracking-widest">
                                        SETTLED
                                     </Badge>
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </Card>
             </div>

             <div className="space-y-8">
                <Card className="glass-card border-none shadow-2xl rounded-[3rem] p-10 bg-success text-white relative overflow-hidden group">
                   <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                   <div className="relative z-10 space-y-8">
                      <div className="flex items-center gap-4">
                         <div className="h-14 w-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-border">
                            <Zap className="h-7 w-7 text-success" />
                         </div>
                         <div>
                            <h4 className="font-black text-xl uppercase tracking-tighter italic text-success">Yield Engine</h4>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Revenue Optimization</p>
                         </div>
                      </div>
                      <p className="text-sm font-medium italic opacity-70 leading-relaxed italic">
                        "Automated invoicing cycle is currently capturing <strong>99.4% of eligible revenue</strong>. Average settlement time decreased by 18%."
                      </p>
                      <Button className="w-full h-16 bg-success text-white hover:bg-success border-none rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl transition-all hover:scale-105 active:scale-95">
                         AUTHORIZE REVENUE BUMP
                      </Button>
                   </div>
                </Card>

                <Card className="glass-card border-none shadow-2xl rounded-[3rem] p-10">
                   <div className="space-y-6">
                      <h4 className="font-black text-xs uppercase tracking-widest text-muted-foreground italic flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        Critical Watchlist
                      </h4>
                      <div className="space-y-4">
                         {[1, 2].map(i => (
                           <div key={i} className="p-5 bg-secondary/20 rounded-3xl border border-border/50 space-y-3 group hover:border-warning/50 transition-all">
                              <div className="flex justify-between items-start">
                                 <div className="space-y-0.5">
                                    <p className="text-[10px] font-black italic uppercase">ACME CORP PROTOCOL</p>
                                    <p className="text-[12px] font-black text-warning italic">Rp 637.500.000 OVERDUE</p>
                                 </div>
                                 <Badge className="bg-warning text-white border-none text-[8px] px-2 py-0">Tier 1</Badge>
                              </div>
                              <Progress value={85} className="h-1 bg-warning" />
                              <div className="flex justify-between items-center text-[8px] font-black uppercase text-muted-foreground tracking-widest">
                                 <span>Last Contact: 2h ago</span>
                                 <Button variant="link" className="h-auto p-0 text-[8px] font-black text-primary">ESCALATE</Button>
                              </div>
                           </div>
                         ))}
                      </div>
                   </div>
                </Card>
             </div>
          </div>
        )}

        {activeTab === "delinquency" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             <Card className="glass-card border-none shadow-2xl rounded-[3rem] p-10">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="font-black italic uppercase tracking-tighter text-xl">Delinquency Heatmap</h3>
                   <div className="flex gap-2">
                      <Badge className="bg-destructive text-destructive border-none">High Risk</Badge>
                      <Badge className="bg-warning text-warning border-none">Medium Risk</Badge>
                   </div>
                </div>
                <div className="h-[300px] flex items-center justify-center bg-secondary/30 rounded-[2rem] border-2 border-dashed border-border/50">
                   <div className="text-center space-y-4">
                      <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto" />
                      <p className="text-xs font-black uppercase text-muted-foreground tracking-widest italic">Geospatial Risk Visualization Ready</p>
                   </div>
                </div>
             </Card>
             
             <div className="space-y-8">
                <Card className="glass-card border-none shadow-2xl rounded-[3rem] p-10 flex flex-col justify-between">
                   <div className="space-y-6">
                      <div className="h-12 w-12 rounded-2xl bg-warning text-warning flex items-center justify-center">
                         <AlertCircle className="h-6 w-6" />
                      </div>
                      <div className="space-y-2">
                         <h4 className="text-2xl font-black italic tracking-tighter uppercase">Automated Collections Protocol</h4>
                         <p className="text-muted-foreground font-medium italic italic">
                           Zenvix AI currently manages 85% of early-stage collections via smart contract triggers and automated multi-channel nurturing.
                         </p>
                      </div>
                   </div>
                   <Button className="w-full h-14 mt-8 rounded-2xl bg-warning hover:bg-warning font-black text-[10px] uppercase tracking-widest shadow-xl shadow-orange-500/20">
                      INITIATE HARD RECOVERY SUITE
                   </Button>
                </Card>

                <div className="grid grid-cols-2 gap-6">
                   <Card className="glass-card border-none shadow-xl rounded-[2.5rem] p-6 text-center">
                      <p className="text-[10px] font-black uppercase text-muted-foreground mb-1 tracking-widest">Recovery Rate</p>
                      <p className="text-3xl font-black italic text-success">92%</p>
                   </Card>
                   <Card className="glass-card border-none shadow-xl rounded-[2.5rem] p-6 text-center">
                      <p className="text-[10px] font-black uppercase text-muted-foreground mb-1 tracking-widest">Write-Offs</p>
                      <p className="text-3xl font-black italic text-destructive">0.4%</p>
                   </Card>
                </div>
             </div>
          </div>
        )}

        {activeTab === "routing" && (
          <div className="glass-card border-none shadow-2xl rounded-[3rem] p-12 flex flex-col items-center justify-center text-center space-y-8 min-h-[400px]">
             <div className="h-24 w-24 rounded-[2.5rem] grad-primary p-[1px]">
                <div className="h-full w-full bg-card rounded-[2.4rem] flex items-center justify-center">
                   <Workflow className="h-10 w-10 text-primary animate-pulse" />
                </div>
             </div>
             <div className="space-y-2">
                <h3 className="text-3xl font-black italic tracking-tighter uppercase">Intelligent Revenue Router</h3>
                <p className="text-muted-foreground font-medium italic italic max-w-xl mx-auto">
                  Optimize capital flow across subsidiary nodes. Automate inter-company settlements and currency hedging with a visual protocol designer.
                </p>
             </div>
             <div className="flex gap-4">
                <Button className="h-14 px-10 rounded-2xl bg-primary hover:bg-primary/90 font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/30 gap-3 group">
                   <GanttChartSquare className="h-5 w-5" />
                   DESIGN ROUTING MAP
                </Button>
                <Button variant="outline" className="h-14 px-10 rounded-2xl font-black text-xs uppercase tracking-widest gap-3">
                   <History className="h-5 w-5" />
                   TRACE SETTLEMENTS
                </Button>
             </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
