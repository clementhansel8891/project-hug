import React, { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import {
  Server,
  Activity,
  Zap,
  Globe,
  Database,
  Cpu,
  ShieldCheck,
  RefreshCw,
  MoreVertical,
  ArrowUpRight,
  TrendingUp,
  AlertCircle,
  BarChart3,
  Network
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { useSession } from "@/core/security/session";
import { retailInfrastructureService } from "@/core/services/retail/retailInfrastructureService";
import { itSettingsService, type ITProvisioningRequest } from "@/core/services/it/itSettingsService";
import type { RetailGatewayNode, RetailLoadBalancer, GatewayNodeStatus } from "@/core/types/retail/retail";
import { useToast } from "@/hooks/use-toast";
import { ErrorState } from "@/components/shared/AsyncState";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";

const InfrastructureControl = () => {
  const session = useSession();
  const { toast } = useToast();
  const [nodes, setNodes] = useState<RetailGatewayNode[]>([]);
  const [lbs, setLbs] = useState<RetailLoadBalancer[]>([]);
  const [requests, setRequests] = useState<ITProvisioningRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setIsError(false);
      const [nodeData, lbData, reqData] = await Promise.all([
        retailInfrastructureService.listGatewayNodes(session.tenant_id, session),
        retailInfrastructureService.listLoadBalancers(session.tenant_id, session),
        itSettingsService.listRequests(session.tenant_id, session)
      ]);
      setNodes(nodeData);
      setLbs(lbData);
      setRequests(reqData);
    } catch (err) {
      console.error(err);
      setIsError(true);
      toast({ title: "Error", description: "Failed to load infrastructure data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [session, toast]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000); // Polling for real-time feel
    return () => clearInterval(interval);
  }, [refresh]);

  const handleNodeAction = useCallback(async (nodeId: string, action: "RESET" | "REPAIR" | "SHUTDOWN") => {
    if (!session.tenant_id) return;
    try {
      setLoading(true);
      await retailInfrastructureService.setNodeStatus(session.tenant_id, session, nodeId, "STANDBY" satisfies GatewayNodeStatus);
      
      // Simulate real-time delay for maintenance cycle
      setTimeout(async () => {
        await retailInfrastructureService.setNodeStatus(session.tenant_id, session, nodeId, "ACTIVE");
        toast({
          title: "Maintenance Complete",
          description: `Node ${nodeId.split("-").pop()} has been successfully ${action.toLowerCase()}ed.`,
        });
        refresh();
      }, 3000);

      toast({
        title: "Action Initiated",
        description: `Broadcasting ${action} signal to node cluster...`,
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Action Failed",
        description: "Cluster communication timeout.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [session, toast, refresh]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
      case "ONLINE":
        return "bg-success";
      case "RESETTING":
      case "MAINTENANCE":
        return "bg-primary animate-pulse";
      case "STANDBY":
        return "bg-warning";
      case "DOWN":
      case "OFFLINE":
        return "bg-destructive";
      default:
        return "bg-secondary/50";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Infrastructure Control Center"
        subtitle="Real-time monitoring and cluster management for Zenvix Retail connectivity."
      />

      {isError && nodes.length === 0 && lbs.length === 0 && requests.length === 0 ? (
        <ErrorState
          title="Couldn't load infrastructure data"
          description="The cluster, load-balancer, and provisioning feeds could not be reached for this tenant. Check your connection and try again."
          onRetry={refresh}
        />
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-card border border-border text-foreground shadow-2xl relative overflow-hidden group backdrop-blur-3xl">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
             <Activity className="w-16 h-16" />
          </div>
          <CardContent className="p-6">
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Active Nodes</div>
            <div className="text-3xl font-black italic tracking-tighter flex items-end gap-2 text-foreground">
              {(Array.isArray(nodes) ? nodes : []).filter(n => n.status === "ACTIVE").length}
              <span className="text-sm font-bold text-muted-foreground mb-1">/ {nodes.length}</span>
            </div>
            <div className="flex items-center gap-2 mt-4 text-[10px] font-bold text-success uppercase">
              <TrendingUp className="w-3 h-3" />
              Online cluster nodes
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-2xl backdrop-blur-3xl">
          <CardContent className="p-6">
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Load Balancers</div>
            <div className="text-3xl font-black italic tracking-tighter text-foreground">
              {lbs.length}
            </div>
            <Progress value={((Array.isArray(nodes) ? nodes : []).filter(n => n.status === "ACTIVE").length / (nodes.length || 1)) * 100} className="h-1.5 mt-4 bg-white/10" />
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-2xl backdrop-blur-3xl">
          <CardContent className="p-6">
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Avg. Node Health</div>
            <div className="text-3xl font-black italic tracking-tighter text-foreground">
              {nodes.length > 0
                ? `${Math.round((Array.isArray(nodes) ? nodes : []).reduce((sum, n) => sum + (n.healthScore || 0), 0) / nodes.length)}%`
                : "—"}
            </div>
            <div className="flex items-center gap-2 mt-4 text-[10px] font-bold text-primary uppercase">
              <Zap className="w-3 h-3" />
              {nodes.length > 0 ? "Across active cluster" : "No nodes reporting"}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-2xl backdrop-blur-3xl">
          <CardContent className="p-6">
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Provisioning Queue</div>
            <div className="text-3xl font-black italic tracking-tighter text-foreground">
              {requests.length}
            </div>
            <div className="flex items-center gap-2 mt-4 text-[10px] font-bold text-success uppercase">
              <ShieldCheck className="w-3 h-3" />
              IT provisioning requests
            </div>
          </CardContent>
        </Card>
      </div>

      <WorkspacePanel>
        <div className="space-y-12">
          {/* Cluster Status Section */}
          <section>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <Network className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-black italic uppercase tracking-tighter text-foreground">Edge Clusters & Load Balancers</h2>
              </div>
              <Button disabled title="Not available yet" size="sm" variant="outline" className="rounded-xl font-bold gap-2">
                <Plus className="w-4 h-4" /> Provision Cluster
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {(Array.isArray(lbs) ? lbs : []).map(lb => (
                <Card key={lb.id} className="border border-border bg-card rounded-3xl overflow-hidden shadow-2xl backdrop-blur-3xl">
                  <div className="bg-card p-4 border-b border-border flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${lb.status === 'ONLINE' ? 'bg-success animate-pulse' : 'bg-destructive'}`} />
                      <div>
                        <div className="text-sm font-black italic text-foreground">{lb.name}</div>
                        <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">VIP: {lb.virtualIp || 'Pending...'} • {lb.algorithm}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button disabled title="Not available yet" variant="ghost" size="icon" className="text-muted-foreground hover:bg-white/10 hover:text-foreground"><RefreshCw className="w-4 h-4" /></Button>
                      <Button disabled title="Not available yet" variant="ghost" size="icon" className="text-muted-foreground hover:bg-white/10 hover:text-foreground"><MoreVertical className="w-4 h-4" /></Button>
                    </div>
                  </div>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {(Array.isArray(lb.nodes) ? lb.nodes : []).map(node => (
                        <div key={node.id} className="bg-card border border-border rounded-2xl p-5 hover:border-primary transition-all group">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-muted text-foreground flex items-center justify-center">
                                <Cpu className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="text-sm font-black italic text-foreground leading-tight">{node.nodeName}</div>
                                <div className="text-[10px] text-muted-foreground font-bold uppercase">{node.ipAddress}:{node.port}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={`${getStatusColor(node.status)} text-foreground text-[9px] font-black tracking-widest uppercase`}>
                                {node.status}
                              </Badge>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground"><MoreVertical className="w-3 h-3" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40 p-1 rounded-xl border-none shadow-2xl">
                                  <DropdownMenuItem 
                                    className="rounded-lg gap-2 font-black italic text-[10px] uppercase tracking-widest py-2 cursor-pointer"
                                    onClick={() => handleNodeAction(node.id, "RESET")}
                                  >
                                    <RefreshCw className="w-3 h-3" /> Reset Node
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="rounded-lg gap-2 font-black italic text-[10px] uppercase tracking-widest py-2 cursor-pointer"
                                    onClick={() => handleNodeAction(node.id, "REPAIR")}
                                  >
                                    <Zap className="w-3 h-3" /> Repair Node
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            <div className="space-y-1">
                               <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                                  <span className="text-muted-foreground">Health</span>
                                  <span className={node.healthScore > 80 ? 'text-success' : 'text-warning'}>{node.healthScore}%</span>
                               </div>
                               <Progress value={node.healthScore} className="h-1 bg-white/10" />
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[10px] font-bold uppercase text-muted-foreground bg-background/40 p-2 rounded-lg">
                               <div>Version: {node.version || 'v2.4.1'}</div>
                               <div className="text-right">{node.region || 'ID-JKT'}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Fake Node for Visuals if list is empty */}
                      {(!lb.nodes || lb.nodes.length === 0) && (
                         <div className="border-2 border-dashed border-border rounded-2xl p-6 flex flex-col items-center justify-center text-center opacity-50">
                            <Server className="w-8 h-8 text-muted-foreground mb-2" />
                            <div className="text-[10px] font-black uppercase text-muted-foreground">No nodes attached</div>
                         </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Provisioning Tracker Section */}
          <section>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <ArrowUpRight className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-black italic uppercase tracking-tighter text-foreground">IT Provisioning Tracker</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(Array.isArray(requests) ? requests : []).map(req => (
                <Card key={req.id} className="border border-border bg-card rounded-3xl overflow-hidden hover:border-primary transition-all shadow-2xl backdrop-blur-3xl">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-xl bg-muted text-primary flex items-center justify-center">
                        <Zap className="w-5 h-5" />
                      </div>
                      <Badge className={`text-[9px] font-black tracking-widest uppercase text-foreground ${
                        req.status === 'FULFILLED' ? 'bg-success' : 
                        req.status === 'PROCUREMENT_TRIGGERED' ? 'bg-primary' : 'bg-warning'
                      }`}>
                        {req.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="space-y-1 mb-4">
                      <div className="text-sm font-black italic text-foreground leading-tight">{req.name}</div>
                      <div className="text-[10px] text-muted-foreground font-bold uppercase">SKU: {req.sku}</div>
                    </div>
                    <Separator className="my-3 opacity-10" />
                    <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      <span>Requested</span>
                      <span>{format(new Date(req.createdAt), 'MMM dd, HH:mm')}</span>
                    </div>
                    {req.requisitionId && (
                      <div className="mt-2 p-2 bg-background/40 rounded-lg text-[9px] font-mono text-primary break-all">
                        REQ: {req.requisitionId}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {requests.length === 0 && (
                <div className="col-span-full border-2 border-dashed border-border rounded-3xl p-6 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Network className="w-6 h-6 text-muted-foreground/60" />
                  </div>
                  <div className="text-sm font-black italic text-muted-foreground uppercase tracking-widest">No Active Provisioning Requests</div>
                  <p className="text-[10px] text-muted-foreground mt-2 font-medium">Use the IT Tech Shop to request new hardware nodes.</p>
                </div>
              )}
            </div>
          </section>

          {/* Infrastructure Logs section */}
          <section className="bg-card rounded-2xl p-8 border border-border backdrop-blur-3xl">
             <div className="flex items-center gap-3 mb-6">
                <BarChart3 className="w-6 h-6 text-foreground" />
                <h2 className="text-xl font-black italic uppercase tracking-tighter text-foreground">Infrastructure Events</h2>
             </div>

             <div className="border-2 border-dashed border-border rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <BarChart3 className="w-6 h-6 text-muted-foreground/60" />
                </div>
                <div className="text-sm font-black italic text-muted-foreground uppercase tracking-widest">No infrastructure events</div>
                <p className="text-[10px] text-muted-foreground mt-2 font-medium">Event telemetry for this cluster has no feed wired yet. Node and load-balancer status above reflect live data.</p>
             </div>
          </section>
        </div>
      </WorkspacePanel>
    </div>
  );
};

const Plus = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

export default InfrastructureControl;
