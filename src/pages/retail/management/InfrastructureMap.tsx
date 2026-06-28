import { useState, useEffect } from "react";
import { 
  Globe, 
  MapPin, 
  Activity, 
  ShieldAlert, 
  Server, 
  Wifi, 
  WifiOff, 
  ChevronRight,
  Maximize2,
  Navigation
} from "lucide-react";
import { PageShell } from "@/core/ui/PageShell";
import { PageHeader } from "@/core/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RetailNode {
  id: string;
  name: string;
  location: string;
  status: "ONLINE" | "OFFLINE" | "MAINTENANCE";
  health: number;
  latency: string;
  coords: { x: number; y: number };
}

export default function InfrastructureMap() {
  const [nodes, setNodes] = useState<RetailNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<RetailNode | null>(null);

  useEffect(() => {
    setNodes([
      { id: "NODE-JKT-01", name: "Jakarta Central", location: "Menteng, JKT", status: "ONLINE", health: 98, latency: "14ms", coords: { x: 30, y: 40 } },
      { id: "NODE-JKT-02", name: "Sudirman Hub", location: "SCBD, JKT", status: "ONLINE", health: 92, latency: "22ms", coords: { x: 35, y: 45 } },
      { id: "NODE-BDG-01", name: "Bandung Node", location: "Dago, BDG", status: "MAINTENANCE", health: 75, latency: "45ms", coords: { x: 45, y: 55 } },
      { id: "NODE-SBY-01", name: "Surabaya East", location: "Gubeng, SBY", status: "ONLINE", health: 96, latency: "32ms", coords: { x: 70, y: 50 } },
      { id: "NODE-BALI-01", name: "Bali Resort Node", location: "Seminyak, BALI", status: "OFFLINE", health: 0, latency: "N/A", coords: { x: 80, y: 70 } },
    ]);
  }, []);

  return (
    <PageShell
      header={
        <PageHeader
          title="Infrastructure Matrix"
          subtitle="Global geospatial visualization of all retail nodes."
          primaryAction={
            <Button className="rounded-xl h-10 px-5 bg-secondary text-foreground font-black text-[10px] uppercase tracking-widest gap-2">
              <Activity className="h-3.5 w-3.5" /> PULSE: OPTIMAL
            </Button>
          }
        />
      }
    >
      <div className="grid grid-cols-12 gap-6 pb-24">
        {/* Map Visualization */}
        <Card className="col-span-12 xl:col-span-8 rounded-2xl border-none shadow-2xl bg-secondary/30 dark:bg-secondary/40 backdrop-blur-xl overflow-hidden relative min-h-[600px] group">
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          
          {/* Simulated Map Grid */}
          <div className="absolute inset-20 border border-primary/10 rounded-[2rem] relative">
            {nodes.map((node) => (
              <div 
                key={node.id}
                onClick={() => setSelectedNode(node)}
                className="absolute transition-all duration-500 cursor-pointer group/node"
                style={{ left: `${node.coords.x}%`, top: `${node.coords.y}%` }}
              >
                <div className="relative">
                  <div className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center animate-pulse",
                    node.status === "ONLINE" ? "bg-success shadow-[0_0_20px_rgba(16,185,129,0.5)]" : 
                    node.status === "OFFLINE" ? "bg-destructive shadow-[0_0_20px_rgba(244,63,94,0.5)]" : "bg-warning"
                  )}>
                    <MapPin className="h-3 w-3 text-foreground" />
                  </div>
                  <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 group-hover/node:opacity-100 transition-opacity bg-black/80 backdrop-blur-md text-foreground text-[9px] font-black uppercase px-3 py-1.5 rounded-lg border border-border z-50">
                    {node.name}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Map Controls */}
          <div className="absolute bottom-10 right-10 flex flex-col gap-3">
            <Button size="icon" className="h-12 w-12 rounded-xl bg-white/10 backdrop-blur-md border border-border hover:bg-muted/20">
              <Maximize2 className="h-5 w-5 text-foreground" />
            </Button>
            <Button size="icon" className="h-12 w-12 rounded-xl bg-white/10 backdrop-blur-md border border-border hover:bg-muted/20">
              <Navigation className="h-5 w-5 text-foreground" />
            </Button>
          </div>

          <div className="absolute top-6 left-10">
             <Badge className="bg-primary text-foreground border-none font-black px-4 py-2 rounded-xl text-[10px] uppercase tracking-widest">
                GEOSPATIAL LAYER: ACTIVE
             </Badge>
          </div>
        </Card>

        {/* Node Sidebar */}
        <div className="col-span-12 xl:col-span-4 space-y-10">
          {selectedNode ? (
            <Card className="rounded-[2rem] border-none shadow-2xl bg-card dark:bg-secondary p-6 space-y-8 animate-in slide-in-from-right-4 duration-500">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-3xl font-black italic tracking-tighter uppercase leading-none">{selectedNode.name}</h3>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{selectedNode.location}</p>
                </div>
                <div className={cn(
                  "h-12 w-12 rounded-2xl flex items-center justify-center",
                  selectedNode.status === "ONLINE" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                )}>
                  {selectedNode.status === "ONLINE" ? <Wifi className="h-6 w-6" /> : <WifiOff className="h-6 w-6" />}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="p-6 rounded-2xl bg-secondary/50 border border-border">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Health Index</p>
                    <p className="text-2xl font-black italic">{selectedNode.health}%</p>
                 </div>
                 <div className="p-6 rounded-2xl bg-secondary/50 border border-border">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Latency</p>
                    <p className="text-2xl font-black italic">{selectedNode.latency}</p>
                 </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-border">
                 <Button className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-black uppercase tracking-widest text-xs gap-3">
                    NODE REMOTE ACCESS
                 </Button>
                 <Button variant="outline" className="w-full h-14 rounded-2xl border-border font-black uppercase tracking-widest text-xs">
                    DIAGNOSTIC SWEEP
                 </Button>
              </div>
            </Card>
          ) : (
            <Card className="rounded-[2rem] border-none shadow-2xl bg-card dark:bg-secondary p-6 flex flex-col items-center justify-center text-center space-y-6 min-h-[300px]">
               <div className="h-20 w-20 rounded-2xl bg-secondary flex items-center justify-center">
                  <Globe className="h-10 w-10 text-muted-foreground" />
               </div>
               <div className="space-y-2">
                  <h4 className="text-xl font-black italic uppercase tracking-tighter">No Node Selected</h4>
                  <p className="text-xs font-medium text-muted-foreground italic">Select a tactical node on the geospatial map to view real-time telemetry.</p>
               </div>
            </Card>
          )}

          <Card className="rounded-[2rem] border-none shadow-2xl bg-card dark:bg-secondary p-8">
             <h4 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground mb-6 flex items-center gap-3 italic">
                <Activity className="h-4 w-4 text-primary" /> System Alerts
             </h4>
             <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-destructive/5 border border-destructive/10 flex items-start gap-4">
                   <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />
                   <div>
                      <p className="text-[10px] font-black uppercase text-destructive">Critical Failure</p>
                      <p className="text-xs font-medium italic italic">Node Bali_01 disconnected from grid.</p>
                   </div>
                </div>
                <div className="p-4 rounded-2xl bg-warning border border-warning/10 flex items-start gap-4">
                   <Server className="h-5 w-5 text-warning shrink-0" />
                   <div>
                      <p className="text-[10px] font-black uppercase text-warning">Maintenance</p>
                      <p className="text-xs font-medium italic italic">Bandung Node: Scheduled patch L4.2</p>
                   </div>
                </div>
             </div>
             <Button variant="ghost" className="w-full mt-6 text-[10px] font-black uppercase tracking-widest gap-2">
                VIEW FULL INCIDENT LOG <ChevronRight className="h-4 w-4" />
             </Button>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
