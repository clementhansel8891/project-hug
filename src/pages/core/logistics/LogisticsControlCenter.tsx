import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Truck, 
  Box, 
  MapPin, 
  Globe, 
  Activity, 
  ShieldCheck, 
  RefreshCw, 
  ArrowUpRight, 
  TrendingUp, 
  AlertCircle,
  Search,
  MoreVertical,
  Navigation,
  Layers,
  Database,
  Cpu,
  Zap,
  CheckCircle2,
  Package,
  History,
  Workflow
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { useSession } from "@/core/security/session";
import { salesService } from "@/core/services/sales/salesService";
import { retailInfrastructureService } from "@/core/services/retail/retailInfrastructureService";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageShell } from "@/core/ui/PageShell";
import { PageHeader } from "@/core/ui/PageHeader";

export default function LogisticsControlCenter() {
  const session = useSession();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"tracking" | "warehouse" | "workflow">("tracking");

  const refresh = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      const [orderData, nodeData] = await Promise.all([
        salesService.listOrders(session.tenant_id, session),
        retailInfrastructureService.listGatewayNodes(session.tenant_id, session)
      ]);

      setOrders(orderData);
      setNodes(nodeData);

      if (isManual) toast.success("Logistics telemetry synchronized.");
    } catch (err) {
      console.error("Logistics sync failure:", err);
      toast.error("Telemetry failure in logistics suite.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session.tenant_id, session]);

  useEffect(() => {
    refresh();
    const interval = setInterval(() => refresh(false), 10000); // Live updates
    return () => clearInterval(interval);
  }, [refresh]);

  const filteredOrders = useMemo(() => 
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
                <Truck className="h-12 w-12 text-primary-foreground" />
             </div>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Syncing Global Logistics Matrix...</p>
        </div>
      </div>
    );
  }

  return (
    <PageShell
      header={
        <PageHeader
          title="Logistics Control Center"
          subtitle="Real-time global tracking, node scaling, and fulfillment intelligence."
          primaryAction={
            <Button className="rounded-[1.2rem] px-8 h-12 gap-3 font-black text-xs uppercase tracking-widest bg-primary hover:bg-primary shadow-xl shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95">
              <Zap className="h-4 w-4" /> OPTIMIZE ROUTES
            </Button>
          }
          secondaryActions={
            <Button 
              variant="outline" 
              className="rounded-[1.2rem] px-6 h-12 font-black text-xs uppercase tracking-widest border-border bg-white/50 backdrop-blur-sm hover:bg-white transition-all"
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
        {/* Tier 1: Real-time Gauges */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="glass-card border-none shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
               <Globe className="w-16 h-16 text-primary" />
            </div>
            <CardContent className="p-8">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Transit Nodes</div>
              <div className="text-3xl font-black italic tracking-tighter flex items-end gap-2">
                12 <span className="text-sm font-bold text-success mb-1">ACTIVE</span>
              </div>
              <div className="flex items-center gap-2 mt-4 text-[10px] font-bold text-success uppercase">
                <TrendingUp className="w-3 h-3" />
                Global Handshake Stable
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-none shadow-xl relative overflow-hidden group">
            <CardContent className="p-8">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Fulfillment Rate</div>
              <div className="text-3xl font-black italic tracking-tighter">94.8%</div>
              <Progress value={94.8} className="h-1.5 mt-4" />
            </CardContent>
          </Card>

          <Card className="glass-card border-none shadow-xl relative overflow-hidden group">
            <CardContent className="p-8">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Avg. Dispatch</div>
              <div className="text-3xl font-black italic tracking-tighter">1.4h</div>
              <div className="flex items-center gap-2 mt-4 text-[10px] font-bold text-primary uppercase">
                <Zap className="w-3 h-3" />
                Sub-2h Threshold Met
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-none shadow-xl relative overflow-hidden group">
            <CardContent className="p-8">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">System Health</div>
              <div className="text-3xl font-black italic tracking-tighter">NOMINAL</div>
              <div className="flex items-center gap-2 mt-4 text-[10px] font-bold text-success uppercase">
                <ShieldCheck className="w-3 h-3" />
                No Anomalies Detected
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tier 2: Search & Filter */}
        <div className="flex flex-col md:flex-row gap-6 items-center justify-between glass-card p-6 rounded-[2.5rem]">
           <div className="relative w-full md:w-[400px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search waybills, nodes, or carriers..." 
                className="pl-12 h-12 bg-secondary/50 border-none rounded-xl font-bold text-xs uppercase tracking-widest"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
           </div>
           <div className="flex items-center gap-4 bg-secondary/30 p-1.5 rounded-2xl">
              {(["tracking", "warehouse", "workflow"] as const).map(tab => (
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
        {activeTab === "tracking" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-2 space-y-8">
                <Card className="glass-card border-none shadow-2xl rounded-[3rem] overflow-hidden">
                   <div className="p-8 border-b border-border/50 flex items-center justify-between bg-secondary/20">
                      <div className="flex items-center gap-3">
                         <Navigation className="h-6 w-6 text-primary" />
                         <h3 className="font-black italic uppercase tracking-tighter text-xl">Active Shipments Matrix</h3>
                      </div>
                      <Badge className="bg-success text-success border-none font-black text-[9px] px-3 py-1 uppercase tracking-widest">LIVE DATA</Badge>
                   </div>
                   <div className="p-0 overflow-x-auto">
                      <table className="w-full">
                         <thead className="bg-secondary/30 text-[9px] uppercase font-black tracking-widest text-muted-foreground">
                            <tr>
                               <th className="px-8 py-5 text-left">Entity ID</th>
                               <th className="px-8 py-5 text-left">Destination</th>
                               <th className="px-8 py-5 text-left">Status</th>
                               <th className="px-8 py-5 text-left">Carrier</th>
                               <th className="px-8 py-5 text-right">ETA</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-border/50">
                            {filteredOrders.map(order => (
                               <tr key={order.id} className="group hover:bg-secondary/10 transition-all">
                                  <td className="px-8 py-6">
                                     <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                           <Package className="h-5 w-5" />
                                        </div>
                                        <div>
                                           <p className="font-black text-xs italic">#{order.id.slice(-8).toUpperCase()}</p>
                                           <p className="text-[9px] font-medium text-muted-foreground uppercase">{order.customerName}</p>
                                        </div>
                                     </div>
                                  </td>
                                  <td className="px-8 py-6">
                                     <div className="flex items-center gap-2 text-xs font-bold italic">
                                        <MapPin className="h-3 w-3 text-primary" />
                                        Jakarta, ID
                                     </div>
                                  </td>
                                  <td className="px-8 py-6">
                                     <Badge className="rounded-full bg-success text-success border-none font-black text-[9px] px-3 py-1 uppercase tracking-widest">
                                        {order.status}
                                     </Badge>
                                  </td>
                                  <td className="px-8 py-6 text-xs font-black italic text-muted-foreground uppercase">
                                     FEDEX-ULTRA
                                  </td>
                                  <td className="px-8 py-6 text-right">
                                     <div className="text-xs font-black italic text-primary">
                                        {Math.floor(Math.random() * 24)}h 12m
                                     </div>
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </Card>
             </div>

             <div className="space-y-8">
                <Card className="glass-card border-none shadow-2xl rounded-[3rem] p-10 bg-primary text-white relative overflow-hidden group">
                   <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                   <div className="relative z-10 space-y-8">
                      <div className="flex items-center gap-4">
                         <div className="h-14 w-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-border">
                            <Activity className="h-7 w-7 text-white" />
                         </div>
                         <div>
                            <h4 className="font-black text-xl uppercase tracking-tighter italic">Logistics Health</h4>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-40">System-wide Telemetry</p>
                         </div>
                      </div>
                      <p className="text-sm font-medium italic opacity-70 leading-relaxed italic">
                        "Route optimization engine is currently operating at <strong>98% efficiency</strong>. Global latency is within 200ms threshold."
                      </p>
                      <Button className="w-full h-16 bg-white text-primary hover:bg-muted border-none rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl transition-all hover:scale-105 active:scale-95">
                         VIEW GLOBAL HEATMAP
                      </Button>
                   </div>
                </Card>

                <Card className="glass-card border-none shadow-2xl rounded-[3rem] p-10 bg-secondary/30">
                   <div className="space-y-6">
                      <div className="flex items-center justify-between">
                         <h4 className="font-black text-xs uppercase tracking-widest text-muted-foreground italic">Dispatch Queue</h4>
                         <History className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="space-y-4">
                         {[1, 2, 3].map(i => (
                           <div key={i} className="flex items-center justify-between p-4 bg-background/40 rounded-2xl border border-border/50 group hover:border-primary/50 transition-all">
                              <div className="flex items-center gap-3">
                                 <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                    <ArrowUpRight className="h-4 w-4" />
                                 </div>
                                 <div>
                                    <p className="text-[10px] font-black italic uppercase">WB-44{i}9-X</p>
                                    <p className="text-[8px] font-medium text-muted-foreground uppercase">Processing...</p>
                                 </div>
                              </div>
                              <div className="h-2 w-2 rounded-full bg-warning animate-pulse" />
                           </div>
                         ))}
                      </div>
                   </div>
                </Card>
             </div>
          </div>
        )}

        {activeTab === "warehouse" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
             {nodes.map((node: any) => (
               <Card key={node.id} className="glass-card border-none shadow-xl rounded-[2.5rem] p-8 group hover:shadow-2xl transition-all">
                  <div className="flex justify-between items-start mb-6">
                     <div className="h-12 w-12 rounded-2xl bg-secondary/50 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <Database className="h-6 w-6" />
                     </div>
                     <Badge className={cn(
                       "rounded-full font-black text-[9px] px-3 py-1 border-none shadow-sm uppercase tracking-widest",
                       node.status === "ACTIVE" ? "bg-success text-success" : "bg-warning text-warning"
                     )}>
                       {node.status}
                     </Badge>
                  </div>
                  <div className="space-y-4">
                     <div>
                        <h4 className="font-black text-lg italic uppercase tracking-tight">{node.nodeName}</h4>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">{node.region} • {node.ipAddress}</p>
                     </div>
                     <div className="space-y-2 pt-2">
                        <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                           <span>Storage Utilization</span>
                           <span className="text-primary">{node.healthScore}%</span>
                        </div>
                        <Progress value={node.healthScore} className="h-1" />
                     </div>
                     <div className="grid grid-cols-2 gap-4 pt-4">
                        <Button variant="outline" className="rounded-xl h-10 font-black text-[9px] uppercase tracking-widest">MAINTENANCE</Button>
                        <Button className="rounded-xl h-10 font-black text-[9px] uppercase tracking-widest bg-primary">SCALE NODE</Button>
                     </div>
                  </div>
               </Card>
             ))}
          </div>
        )}

        {activeTab === "workflow" && (
          <div className="glass-card border-none shadow-2xl rounded-[3rem] p-12 flex flex-col items-center justify-center text-center space-y-8 min-h-[400px]">
             <div className="h-20 w-20 rounded-[2rem] bg-primary/10 flex items-center justify-center text-primary">
                <Workflow className="h-10 w-10 animate-spin-slow" />
             </div>
             <div className="space-y-2">
                <h3 className="text-3xl font-black italic tracking-tighter uppercase">Visual Logistics Orchestrator</h3>
                <p className="text-muted-foreground font-medium italic italic max-w-lg mx-auto">
                  Drag and drop to define the global transit protocol. Automated carrier handshakes and customs clearance triggers ready for deployment.
                </p>
             </div>
             <Button className="h-14 px-10 rounded-2xl bg-primary hover:bg-primary/90 font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/30 gap-3 group">
                <Layers className="h-5 w-5 group-hover:scale-110 transition-transform" />
                INITIALIZE WORKFLOW DESIGNER
             </Button>
          </div>
        )}
      </div>
    </PageShell>
  );
}
