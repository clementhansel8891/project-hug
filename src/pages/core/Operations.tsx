import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { EmptyState } from "@/components/shared/AsyncState";
import { formatNumber, safeText } from "@/lib/format";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Globe2,
  Layers,
  Timer,
  ServerCrash,
  Link2,
  Database,
  Loader2,
  Activity,
  Zap,
  Plus,
  ArrowUpRight
} from "lucide-react";
import { useSession } from "@/core/security/session";
import { itService, type SystemHealth } from "@/core/services/it/itService";
import { adminService } from "@/core/services/adminService";
import { RequestModal } from "@/core/ui/RequestModal";
import { useToast } from "@/hooks/use-toast";
import DepartmentWorkspaceLayout from "@/components/layouts/DepartmentWorkspaceLayout";

const SECTIONS = [
  {
    title: "OBSERVABILITY",
    items: [
      { id: 'operations', icon: Zap, label: "Overview", to: "/core/operations" },
      { id: 'health', icon: Activity, label: "System Health", to: "/core/operations/health" },
    ]
  },
  {
    title: "INFRASTRUCTURE",
    items: [
      { id: 'edge', icon: Globe2, label: "Edge Nodes", to: "/core/operations/edge" },
      { id: 'db', icon: Database, label: "Persistence", to: "/core/operations/persistence" },
    ]
  }
];

interface ModuleActivityRow { id: string; name: string; status: string; throughput: string; latency: string; }
interface AlertRow { id: string; title: string; detail: string; severity: string; time: string; }
interface ChecklistRow { id: string; label: string; status: string; }
interface TenantRow { id: string; name: string; uptime: string; incidents: string; }

const statusBadge = (status: string) => {
  if (status === "Stable") {
    return "bg-success/10 text-success border-success/20";
  }
  if (status === "Degraded") {
    return "bg-warning/10 text-warning border-warning/20";
  }
  return "bg-muted text-muted-foreground border-border";
};

export default function CoreOperations() {
  const session = useSession();
  const { toast } = useToast();
  const [overviewData, setOverviewData] = useState<any | null>(null);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [iotDevices, setIotDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Real_Data within tenant scope — no Placeholder_Data. Zero records render the
  // Empty_State for each operational view (Requirements 13.4, 13.5, 4.3).
  const [moduleActivity, setModuleActivity] = useState<ModuleActivityRow[]>([]);
  const [alertsQueue, setAlertsQueue] = useState<AlertRow[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistRow[]>([]);
  const [tenantVisibility, setTenantVisibility] = useState<TenantRow[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [itOverview, sync, iot, health] = await Promise.all([
          itService.getOverview(session.tenant_id, session),
          adminService.getSyncStatus(session),
          adminService.getIotDevices(session),
          itService.getSystemHealth(session.tenant_id, session),
        ]);
        setOverviewData(itOverview);
        setSyncStatus(sync.data);
        setIotDevices(iot.data);

        // Derive operational views from Real_Data (live system-health telemetry)
        // within the authenticated tenant scope — never Placeholder_Data.
        const healthArr: SystemHealth[] = Array.isArray(health) ? health : [];
        setModuleActivity(
          healthArr.map((h) => ({
            id: String(h.id ?? h.component),
            name: safeText(h.component),
            status: h.status === "HEALTHY" ? "Stable" : "Degraded",
            throughput: safeText(undefined),
            latency: `${formatNumber(h.latencyMs, { maximumFractionDigits: 0 })} ms`,
          })),
        );
        setAlertsQueue(
          healthArr
            .filter((h) => h.status && h.status !== "HEALTHY")
            .map((h) => ({
              id: String(h.id ?? h.component),
              title: `${safeText(h.component)} degraded`,
              detail: `Latency ${formatNumber(h.latencyMs, { maximumFractionDigits: 0 })}ms reported.`,
              severity: h.status === "CRITICAL" ? "High" : "Medium",
              time: safeText(h.checkedAt),
            })),
        );
        setChecklistItems([]);
        setTenantVisibility([]);
      } catch (err) {
        console.error("Failed to load operations data", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [session]);

  const handleInspect = async (component: string) => {
    try {
      const health = await itService.getSystemHealth(session.tenant_id, session);
      const filtered = (Array.isArray(health) ? health : []).filter(h => h.component.toLowerCase().includes(component.toLowerCase()));
      
      if (filtered.length > 0) {
        toast({
          title: `Health Check: ${component}`,
          description: `Nodes: ${filtered.length} | Avg Latency: ${Math.round(filtered.reduce((acc, curr) => acc + curr.latencyMs, 0) / filtered.length)}ms`,
        });
      } else {
        toast({
          title: "Health Check",
          description: `No active nodes found for ${component}. System may be in idle state.`,
        });
      }
    } catch (err) {
      toast({
        title: "Health Check Failed",
        description: "Unable to reach ITGateway telemetry service.",
        variant: "destructive"
      });
    }
  };

  const handleLaunchBridge = async (data: { title: string; reason: string }) => {
    try {
      await adminService.createRequest(session.tenant_id, session, {
        type: "INCIDENT_BRIDGE",
        title: data.title,
        description: data.reason,
      });
      toast({
        title: "Incident Bridge Requested",
        description: "Crisis management team has been notified.",
      });
    } catch (err) {
      toast({
        title: "Bridge Initiation Failed",
        description: "Unable to reach emergency services.",
        variant: "destructive",
      });
    }
  };

  const retailStats = overviewData?.moduleContributions?.retail;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-warning" />
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground italic">Accessing Operations Command...</p>
        </div>
      </div>
    );
  }
  const mainContent = (
    <div className="space-y-6 p-6">
      {/* --- SYSTEM OBSERVABILITY OVERLAY --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WorkspacePanel 
          title="Global Sync Health" 
          description="Operational data synchronization across branches and edge gateways."
        >
          {syncStatus ? (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between p-5 rounded-2xl bg-card border border-border shadow-sm">
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${syncStatus.is_healthy ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-foreground">Persistence Queue</p>
                    <p className="text-[10px] font-bold text-muted-foreground mt-1">{syncStatus.pending_count} pending / {syncStatus.failed_count} failed</p>
                  </div>
                </div>
                <Badge variant="outline" className={`rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-widest border-none ${syncStatus.is_healthy ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                  {syncStatus.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-[10px] px-2 font-black uppercase tracking-widest text-muted-foreground">
                <span>Sync Latency</span>
                <span className="font-mono text-primary">{syncStatus.sync_latency_min === -1 ? 'N/A' : `${syncStatus.sync_latency_min}m`}</span>
              </div>
            </div>
          ) : (
            <div className="h-24 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          )}
        </WorkspacePanel>

        <WorkspacePanel 
          title="Edge IoT Network" 
          description="Connected hardware and sensor telemetry status."
        >
           <div className="space-y-6 pt-2">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-2xl bg-card border border-border shadow-sm">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Online</p>
                  <p className="text-2xl font-black italic text-success">{(Array.isArray(iotDevices) ? iotDevices : []).filter(d => d.status === 'ONLINE' || d.status === 'ACTIVE').length}</p>
                </div>
                <div className="text-center p-4 rounded-2xl bg-card border border-border shadow-sm">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Offline</p>
                  <p className="text-2xl font-black italic text-destructive">{(Array.isArray(iotDevices) ? iotDevices : []).filter(d => d.status === 'OFFLINE' || d.status === 'DISCONNECTED').length}</p>
                </div>
                <div className="text-center p-4 rounded-2xl bg-card border border-border shadow-sm">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Alerts</p>
                  <p className="text-2xl font-black italic text-warning">{(Array.isArray(iotDevices) ? iotDevices : []).filter(d => d.status === 'ALERT' || d.status === 'WARNING').length}</p>
                </div>
              </div>
              <div className="text-right">
                <Button variant="ghost" className="text-[10px] h-8 font-black uppercase tracking-widest text-primary hover:bg-primary" onClick={() => handleInspect("Edge")}>
                  Inspect Edge Nodes
                </Button>
              </div>
           </div>
        </WorkspacePanel>
      </div>

      {/* --- MODULE CONTRIBUTIONS --- */}
      {retailStats && (
        <WorkspacePanel
          title="Module Contributions: Retail Infrastructure"
          description="Live device health and ecommerce channel connectivity from the active Retail module."
        >
          <div className="grid gap-4 md:grid-cols-3 pt-2">
            <div className="rounded-2xl border border-primary bg-primary p-6">
              <div className="flex items-center justify-between text-primary mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest">
                  POS Devices Online
                </span>
                <Globe2 className="h-4 w-4" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black italic tracking-tighter text-primary dark:text-primary">
                  {retailStats.posDevices?.online || 0}
                </span>
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">
                  of {retailStats.posDevices?.total || 0} nodes
                </span>
              </div>
              <div className="mt-2 text-[10px] font-bold text-primary uppercase tracking-widest">
                Active Branch Terminals
              </div>
            </div>

            <div
              className={`rounded-2xl border p-6 shadow-sm bg-card ${retailStats.posDevices?.offline > 0 ? "border-destructive/20 bg-destructive/5 shadow-destructive/5" : "border-border"}`}
            >
              <div
                className={`flex items-center justify-between mb-4 ${retailStats.posDevices?.offline > 0 ? "text-destructive" : "text-muted-foreground"}`}
              >
                <span className="text-[10px] font-black uppercase tracking-widest">Offline Devices</span>
                <ServerCrash className="h-4 w-4" />
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-3xl font-black italic tracking-tighter ${retailStats.posDevices?.offline > 0 ? "text-destructive dark:text-destructive" : "text-muted-foreground"}`}
                >
                  {retailStats.posDevices?.offline || 0}
                </span>
              </div>
              <div
                className={`mt-2 text-[10px] font-bold uppercase tracking-widest ${retailStats.posDevices?.offline > 0 ? "text-destructive" : "text-muted-foreground"}`}
              >
                {retailStats.posDevices?.offline > 0
                  ? "Requires technician dispatch"
                  : "All endpoints healthy"}
              </div>
            </div>

            <div className="rounded-2xl border p-6 bg-card shadow-sm border-border">
              <div className="flex items-center justify-between text-muted-foreground mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Ecommerce Channels
                </span>
                <Link2 className="h-4 w-4" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black italic tracking-tighter text-foreground">
                  {retailStats.ecommerceChannels?.active || 0}
                </span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                  of {retailStats.ecommerceChannels?.total || 0} active
                </span>
              </div>
              <div className="mt-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Cloud Sync Connectivity
              </div>
            </div>
          </div>
        </WorkspacePanel>
      )}

      <WorkspacePanel
        title="Live module activity"
        description="Operational throughput and stability by service."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 pt-2">
          {moduleActivity.length === 0 ? (
            <div className="col-span-full">
              <EmptyState title="No module telemetry" description="Live module activity for this tenant will appear here once services report in." />
            </div>
          ) : (
          (Array.isArray(moduleActivity) ? moduleActivity : []).map((module) => (
            <div key={module.id} className="rounded-2xl border p-5 bg-white dark:bg-muted shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-foreground">
                    {module.name}
                  </p>
                  <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-tighter">
                    {module.throughput}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={`rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-widest border-none ${statusBadge(module.status)}`}
                >
                  {module.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
                <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
                  <Timer className="h-3.5 w-3.5" />
                  {module.latency}
                </div>
                <Button onClick={() => handleInspect(module.name)} size="sm" variant="ghost" className="h-7 text-[9px] font-black uppercase tracking-widest text-primary">
                  Inspect
                </Button>
              </div>
            </div>
          ))
          )}
        </div>
      </WorkspacePanel>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <WorkspacePanel
          title="Alerts & issues queue"
          description="Escalations requiring immediate review."
        >
          <div className="space-y-4 pt-2">
            {alertsQueue.length === 0 ? (
              <EmptyState title="No active escalations" description="Alerts and issues for this tenant will surface here when raised." />
            ) : (
            (Array.isArray(alertsQueue) ? alertsQueue : []).map((alertItem) => (
              <div key={alertItem.id} className="rounded-2xl border p-5 bg-card shadow-sm hover:border-destructive/30 transition-colors">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-foreground mb-1">
                      {alertItem.title}
                    </p>
                    <p className="text-[10px] font-medium text-muted-foreground leading-relaxed italic">
                      "{alertItem.detail}"
                    </p>
                  </div>
                  <Badge variant="secondary" className="rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-widest bg-destructive text-destructive-foreground border-none shadow-sm shadow-destructive/20">{alertItem.severity}</Badge>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-border mt-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                    {alertItem.time}
                  </div>
                  <Button onClick={(e) => { e.preventDefault(); toast({ title: "Alert Review", description: `Opening investigation for: ${alertItem.title}` }); }} variant="outline" className="h-8 rounded-xl px-4 text-[9px] font-black uppercase tracking-widest">
                    Review
                  </Button>
                </div>
              </div>
            ))
            )}
          </div>
        </WorkspacePanel>

        <WorkspacePanel
          title="Daily operational checklist"
          description="Core tasks and control points for today."
        >
          <div className="space-y-3 pt-2">
            {checklistItems.length === 0 ? (
              <EmptyState title="No checklist items" description="Operational control points for today will appear here once defined for this tenant." />
            ) : (
            (Array.isArray(checklistItems) ? checklistItems : []).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-2xl border p-4 bg-card shadow-sm hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${item.status === 'Complete' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                    {item.status === "Complete" ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : item.status === "In progress" ? (
                      <ClipboardCheck className="h-5 w-5" />
                    ) : (
                      <Layers className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-foreground">
                      {item.label}
                    </p>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter mt-1">
                      {item.status}
                    </p>
                  </div>
                </div>
                <Button onClick={(e) => { e.preventDefault(); toast({ title: "Checklist Item", description: `Viewing details for ${item.label}` }); }} variant="ghost" className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-primary">
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </div>
            ))
            )}
          </div>
        </WorkspacePanel>
      </div>

      <WorkspacePanel
        title="Cross-tenant operational visibility"
        description="Performance and incident posture across regions."
      >
        <div className="grid gap-4 md:grid-cols-3 pt-2">
          {tenantVisibility.length === 0 ? (
            <div className="col-span-full">
              <EmptyState title="No regional data" description="Cross-tenant operational posture will appear here once regional telemetry is available." />
            </div>
          ) : (
          (Array.isArray(tenantVisibility) ? tenantVisibility : []).map((tenant) => (
            <div key={tenant.id} className="rounded-2xl border p-6 bg-card shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-sm font-black uppercase tracking-widest text-foreground mb-1">
                    {tenant.name}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-success shadow-sm shadow-success/20" />
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Uptime {tenant.uptime}
                    </p>
                  </div>
                </div>
                <Globe2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <span className="text-[10px] font-black text-destructive uppercase tracking-widest">{tenant.incidents}</span>
                <Button onClick={() => handleInspect(tenant.name)} variant="outline" className="h-8 rounded-xl px-4 text-[9px] font-black uppercase tracking-widest">
                  Drill in
                </Button>
              </div>
            </div>
          ))
          )}
        </div>
      </WorkspacePanel>
    </div>
  );

  return (
    <DepartmentWorkspaceLayout
      title="Operations Command"
      subtitle="Real-time visibility into platform operations, incidents, and tenant health."
      headerIcon={Zap}
      accentColor="amber"
      engineName="OPERATIONS_ENGINE"
      pulseLabel="Operations Pulse"
      pulseIcon={Activity}
      sections={SECTIONS}
      routeLabels={{}}
      basePath="/core/operations"
      headerActions={
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="rounded-xl h-10 px-6 font-black text-[10px] uppercase tracking-widest"
            onClick={(e) => { e.preventDefault(); const c = "data:text/csv;charset=utf-8,Fallback Data\nExported Row"; const l = document.createElement("a"); l.href = encodeURI(c); l.download = "export.csv"; l.click(); }}
          >
            Export daily log
          </Button>
          <Button 
            onClick={() => setIsModalOpen(true)}
            className="rounded-xl h-10 px-6 font-black text-[10px] uppercase tracking-widest bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-xl shadow-destructive/20"
          >
            <AlertTriangle className="h-3 w-3 mr-2" /> Launch bridge
          </Button>
        </div>
      }
    >
      {mainContent}
    </DepartmentWorkspaceLayout>
  );
}
