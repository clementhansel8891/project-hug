import React from "react";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { Button } from "@/components/ui/button";
import { 
  Cpu, 
  ShieldCheck, 
  Activity, 
  Terminal, 
  Zap,
  Globe,
  Plus,
  AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/core/security/session";
import { itService, type SystemHealth } from "@/core/services/it/itService";
import { useCallback, useEffect, useState } from "react";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { EmptyState } from "@/components/shared/AsyncState";
import { safeText } from "@/lib/format";
import { CreateTicketModal } from "./modals/CreateTicketModal";
import { IncidentReportModal } from "./modals/IncidentReportModal";

export default function ITDashboard() {
  const session = useSession();
  const [overview, setOverview] = useState<any>(null);
  const [health, setHealth] = useState<SystemHealth[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);

  const loadData = useCallback(() => {
    setIsLoading(true);
    setIsError(false);
    Promise.all([
      itService.getOverview(session.tenant_id, session),
      itService.getSystemHealth(session.tenant_id, session)
    ]).then(([overviewData, healthData]) => {
      setOverview(overviewData);
      setHealth(Array.isArray(healthData) ? healthData : []);
    }).catch(err => {
      console.error("[ITDashboard] Fetch failure:", err);
      setIsError(true);
    })
      .finally(() => setIsLoading(false));
  }, [session]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <PageHeader
        title="IT Intelligence Command"
        subtitle="Real-time infrastructure telemetry, identity security, and device lifecycle management."
        primaryAction={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setTicketModalOpen(true)}
              className="bg-primary hover:bg-primary/90 text-white rounded-xl font-black italic tracking-widest uppercase gap-3 shadow-lg shadow-primary/20 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" /> New Ticket
            </Button>
            <Button
              onClick={() => setIncidentModalOpen(true)}
              variant="outline"
              className="rounded-xl font-black italic tracking-widest uppercase gap-3 active:scale-95 transition-all border-destructive text-destructive hover:bg-destructive/10"
            >
              <AlertTriangle className="w-4 h-4" /> Report Incident
            </Button>
            <Button variant="outline" className="rounded-xl font-black italic tracking-widest uppercase gap-3 active:scale-95 transition-all">
              <Terminal className="w-4 h-4" /> System Console
            </Button>
          </div>
        }
      />

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Infrastructure Health" value={safeText(overview?.healthScore)} status="OPTIMAL" icon={Activity} />
        <KPICard title="Active Nodes" value={safeText(overview?.activeNodes)} status="SYNCED" icon={Zap} />
        <KPICard title="Identity Guards" value={safeText(overview?.identityGuards, "Active")} status="SECURE" icon={ShieldCheck} />
        <KPICard title="Pending Updates" value={safeText(overview?.pendingUpdates)} status="ATTENTION" icon={Cpu} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Core Infrastructure Status */}
        <WorkspacePanel 
          title="Core Infrastructure" 
          description="Global status of mission-critical services and databases."
          className="xl:col-span-2"
        >
          <QueryBoundary
            query={{ isLoading, isError, data: health, refetch: loadData }}
            loading={<div className="grid gap-4 md:grid-cols-2"><div className="h-20 rounded-xl bg-muted/40 animate-pulse" /><div className="h-20 rounded-xl bg-muted/40 animate-pulse" /></div>}
            empty={<EmptyState title="No service telemetry" description="No infrastructure components are reporting health for this tenant yet." />}
          >
            {(items: SystemHealth[]) => (
              <div className="grid gap-4 md:grid-cols-2">
                {items.map((h) => (
                  <ServiceStatus
                    key={h.id}
                    name={h.component}
                    status={h.status}
                    icon={Globe}
                    latency={`${h.latencyMs}ms`}
                  />
                ))}
              </div>
            )}
          </QueryBoundary>
        </WorkspacePanel>

        {/* Security & Access Feed */}
        <WorkspacePanel 
          title="Security Feed" 
          description="Recent identity and access events across the workspace."
        >
          <div className="space-y-4">
            <SecurityEvent 
              title="Admin Access Granted" 
              time="2m ago" 
              user="IT_MANAGER" 
              type="SUCCESS"
            />
            <SecurityEvent 
              title="Token Rotation Triggered" 
              time="15m ago" 
              user="SYSTEM" 
              type="INFO"
            />
            <SecurityEvent 
              title="New Device Enrolled" 
              time="1h ago" 
              user="STAFF_042" 
              type="SUCCESS"
            />
          </div>
        </WorkspacePanel>
      </div>

      <CreateTicketModal
        isOpen={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        onSuccess={() => loadData()}
      />

      <IncidentReportModal
        isOpen={incidentModalOpen}
        onClose={() => setIncidentModalOpen(false)}
        onSuccess={() => loadData()}
      />
    </div>
  );
}

function KPICard({ title, value, status, icon: Icon }: any) {
  return (
    <Card className="bg-white border-muted shadow-sm rounded-2xl overflow-hidden group hover:shadow-md transition-all">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-black italic tracking-tighter">{value}</div>
        <Badge className={`mt-2 border-none text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
          status === 'OPTIMAL' || status === 'SYNCED' || status === 'SECURE' 
            ? 'bg-success/10 text-success' 
            : 'bg-warning/10 text-warning'
        }`}>
          {status}
        </Badge>
      </CardContent>
    </Card>
  );
}

function ServiceStatus({ name, status, icon: Icon, latency }: any) {
  return (
    <div className="p-4 rounded-xl border border-border bg-muted/30 flex items-center justify-between group hover:border-primary/30 transition-all">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 bg-background rounded-lg flex items-center justify-center shadow-sm border border-border group-hover:text-primary transition-colors">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-bold">{name}</p>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">{status}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[10px] font-black text-muted-foreground italic uppercase">Latency</p>
        <p className="text-xs font-black text-primary">{latency}</p>
      </div>
    </div>
  );
}

function SecurityEvent({ title, time, user, type }: any) {
  return (
    <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
        type === 'SUCCESS' ? 'bg-success shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]'
      }`} />
      <div className="space-y-0.5">
        <p className="text-xs font-bold leading-tight">{title}</p>
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
          {user} • <span className="italic">{time}</span>
        </p>
      </div>
    </div>
  );
}
