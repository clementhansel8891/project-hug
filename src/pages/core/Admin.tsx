import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { AlertTriangle, Database, KeyRound, ShieldCheck, Loader2, Plus, Shield, Activity, Terminal } from "lucide-react";
import { useSession } from "@/core/security/session";
import { adminService } from "@/core/services/adminService";
import { useToast } from "@/hooks/use-toast";
import { RequestModal } from "@/core/ui/RequestModal";
import { AdminInviteModal } from "./AdminInviteModal";
import { formatDateTime, safeText } from "@/lib/format";
import DepartmentWorkspaceLayout from "@/components/layouts/DepartmentWorkspaceLayout";

const SECTIONS = [
  {
    title: "GOVERNANCE",
    items: [
      { id: 'admin', icon: Shield, label: "Administration", to: "/core/admin" },
      { id: 'logs', icon: Terminal, label: "System Logs", to: "/core/logs" },
      { id: 'audit', icon: ShieldCheck, label: "Audit Vault", to: "/core/audit" },
    ]
  }
];

export default function CoreAdmin() {
  const session = useSession();
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const result = await adminService.getDashboardMetrics(
          session.tenant_id,
          session,
        );
        setData(result);
      } catch (err) {
        console.error("Failed to load admin dashboard", err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, [session.tenant_id, session]);

  if (loading || !data) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground italic">Accessing Governance Mainframe...</p>
        </div>
      </div>
    );
  }

  const { metrics, systemStatus, recentActivity, moduleContributions } = data;

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8,Action,Detail,Time\n" + 
      (recentActivity || []).map((log: any) => `"${log.action || log.title}","${log.detail}","${log.time || log.createdAt}"`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "audit_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Report Exported", description: "Audit trail downloaded successfully." });
  };

  const handleInvite = () => {
    setIsInviteModalOpen(true);
  };

  const handleEmergencyRequest = async (data: { title: string; reason: string }) => {
    try {
      await adminService.createRequest(session.tenant_id, session, {
        type: "EMERGENCY_ACTION",
        title: data.title,
        description: data.reason,
      });
      toast({
        title: "Emergency Request Logged",
        description: "Awaiting multi-key authorization for restricted actions.",
      });
    } catch (err) {
      toast({
        title: "Request Failed",
        description: "Unable to log emergency override.",
        variant: "destructive",
      });
    }
  };

  const mainContent = (
    <div className="space-y-6 p-6">
      {/* --- MODULE CONTRIBUTIONS --- */}
      {moduleContributions?.retail && (
        <WorkspacePanel
          title="Module Contributions: Retail Presence"
          description="High-level visibility into the active Retail branch network."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border p-5 border-success/20 bg-success">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                Active Physical Stores
              </p>
              <p className="text-3xl font-black italic text-success dark:text-success">
                  {moduleContributions?.retail?.activeStores || 0}
              </p>
            </div>
          </div>
        </WorkspacePanel>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <WorkspacePanel
          title="System-level controls"
          description="Platform-wide security and governance settings."
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl border p-5 bg-card dark:bg-muted shadow-sm">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-primary dark:bg-primary flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-black uppercase tracking-widest leading-none">
                  Global MFA enforcement
                </p>
              </div>
              <Badge variant="outline" className="rounded-full px-4 border-success text-success bg-success font-black text-[9px] tracking-widest uppercase">Enabled</Badge>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-dashed p-6 text-sm bg-muted dark:bg-muted">
              <div className="flex items-center gap-3">
                <KeyRound className="h-5 w-5 text-muted-foreground" />
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Configure advanced access policies</span>
              </div>
              <Button size="sm" variant="outline" className="rounded-xl h-9 px-6 font-black text-[10px] uppercase tracking-widest" onClick={() => { toast({ title: "Policy Configuration", description: "Opening advanced access policy editor..." }); window.location.hash = "#/core/security"; }}>
                Open
              </Button>
            </div>
          </div>
        </WorkspacePanel>

        <WorkspacePanel
          title="Platform audit & logs"
          description="Privileged actions and system activity."
        >
          <div className="space-y-4">
            {(Array.isArray(recentActivity) ? recentActivity : []).slice(0, 5).map((log: any) => (
              <div
                key={log.id || log.title}
                className="rounded-2xl border p-4 bg-card dark:bg-muted shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground dark:text-white italic">
                    {safeText(log.action || log.title)}
                  </p>
                  <span className="text-[9px] font-mono text-muted-foreground">
                    {log.time || (log.createdAt ? formatDateTime(log.createdAt) : "")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                  {safeText(log.detail)}
                </p>
              </div>
            ))}
            <Button variant="outline" className="w-full rounded-xl h-11 font-black text-[10px] uppercase tracking-widest border-border" onClick={() => { toast({ title: "Audit Trail", description: "Loading full system audit logs..." }); window.location.href = "/core/logs"; }}>
              View full audit trail
            </Button>
          </div>
        </WorkspacePanel>
      </div>

      <WorkspacePanel
        title="Dangerous actions"
        description="Restricted actions for emergency use only."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {[
            "Disable all tenant access",
            "Rotate global encryption keys",
            "Purge audit logs",
          ].map((action) => (
            <div
              key={action}
              className="flex items-center justify-between rounded-2xl border border-dashed p-5 bg-destructive dark:bg-destructive"
            >
              <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                {action}
              </div>
              <Button size="sm" variant="outline" disabled className="rounded-xl opacity-40">
                Disabled
              </Button>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-2xl border p-5 bg-card dark:bg-muted shadow-sm border-primary">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Emergency Authorization Required</span>
            </div>
            <Button size="sm" variant="outline" className="rounded-xl h-9 px-6 font-black text-[10px] uppercase tracking-widest border-primary text-primary" onClick={() => setIsModalOpen(true)}>
              Request access
            </Button>
          </div>
        </div>
      </WorkspacePanel>

      <RequestModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleEmergencyRequest}
        title="Emergency Access Request"
        description="Request temporary authorization to perform restricted platform-level actions. Your session will be heavily audited."
        defaultTitle="Restricted Action Authorization"
        placeholder="Identify the active incident and the specific restricted action required..."
      />

      <AdminInviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
    </div>
  );

  return (
    <DepartmentWorkspaceLayout
      title="Platform Administration"
      subtitle="Super-admin controls for tenants, security, and platform governance."
      headerIcon={Shield}
      accentColor="indigo"
      engineName="GOVERNANCE_ENGINE"
      pulseLabel="Governance Pulse"
      pulseIcon={Activity}
      sections={SECTIONS}
      routeLabels={{}}
      basePath="/core/admin"
      headerActions={
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="rounded-xl h-10 px-6 font-black text-[10px] uppercase tracking-widest"
            onClick={handleExport}
          >
            Generate audit report
          </Button>
          <Button 
            onClick={handleInvite}
            className="rounded-xl h-10 px-6 font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20"
          >
            <Plus className="h-3 w-3 mr-2" /> Invite admin
          </Button>
        </div>
      }
    >
      {mainContent}
    </DepartmentWorkspaceLayout>
  );
}
