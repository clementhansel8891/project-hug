import { useMemo, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DataTableShell } from "@/core/tools/DataTableShell";
import { ApprovalStatusBadge } from "@/core/tools/ApprovalStatusBadge";
import type { SessionContext } from "@/core/security/session";
import { workflowService } from "@/core/services/hr/workflowService";
import { EmptyState } from "@/components/shared/EmptyState";
import { Loader2, Search, History } from "lucide-react";
import type { WorkflowRequest, WorkflowStatus } from "@/core/tools/workflows/workflowTypes";
import { cn } from "@/lib/utils";

type ApprovalInboxProps = {
  tenantId: string;
  session: SessionContext;
};

export function ApprovalInbox({ tenantId, session }: ApprovalInboxProps) {
  const [search, setSearch] = useState("");
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<"ALL" | WorkflowStatus>("PENDING");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const [workflows, setWorkflows] = useState<WorkflowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await workflowService.listInbox(tenantId, session, session.department_id || "GLOBAL");
      setWorkflows(res || []);
    } catch (err) {
      console.error("Workflow sync failure:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [tenantId, session]);

  useEffect(() => {
    load();
  }, [load, version]);

  const statusCounts = useMemo(() => {
    return workflows.reduce(
      (acc, flow) => {
        acc.ALL += 1;
        acc[flow.status] = (acc[flow.status] ?? 0) + 1;
        return acc;
      },
      {
        ALL: 0,
        PENDING: 0,
        APPROVED: 0,
        REJECTED: 0,
        RETURNED: 0,
        MODIFIED: 0,
      } as Record<"ALL" | WorkflowStatus, number>,
    );
  }, [workflows]);

  const filtered = useMemo(() => {
    return (Array.isArray(workflows) ? workflows : []).filter((flow) => {
      if (tab !== "ALL" && flow.status !== tab) return false;
      if (!search) return true;
      const query = search.toLowerCase();
      return (
        flow.entityId.toLowerCase().includes(query) ||
        flow.entityType.toLowerCase().includes(query) ||
        flow.destinationDept.toLowerCase().includes(query) ||
        flow.makerDept.toLowerCase().includes(query) ||
        (flow.notes ?? "").toLowerCase().includes(query)
      );
    });
  }, [workflows, tab, search]);

  const selected = useMemo(() => {
    return workflows.find((flow) => flow.id === selectedId) ?? null;
  }, [workflows, selectedId]);

  const [auditTrail, setAuditTrail] = useState<any[]>([]);
  useEffect(() => {
    if (selected) {
      const fetchAudit = async () => {
        try {
          const res = await (workflowService as any).listAudit(tenantId, selected.id);
          setAuditTrail(res || []);
        } catch (e) {
          setAuditTrail([]);
        }
      };
      fetchAudit();
    } else {
      setAuditTrail([]);
    }
  }, [tenantId, selected]);

  const handleAction = async (
    action: "approve" | "reject" | "modify",
    flow: WorkflowRequest,
  ) => {
    try {
      if (action === "approve") {
        await workflowService.approveRequest(tenantId, flow.id, session, notes || undefined);
      }
      if (action === "reject") {
        await workflowService.rejectRequest(tenantId, flow.id, session, notes || undefined);
      }
      if (action === "modify") {
        await (workflowService as any).modifyRequest(tenantId, flow.id, session, notes || undefined);
      }
      setNotes("");
      setVersion((prev) => prev + 1);
    } catch (err) {
      console.error("Action failed:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card dark:bg-muted p-6 rounded-[2rem] shadow-xl shadow-slate-200/20">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search approvals matrix..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-11 h-12 rounded-xl border-border bg-muted focus:bg-card transition-all font-medium"
          />
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-primary text-white border-none font-black px-4 py-2 rounded-full uppercase tracking-widest text-[10px]">
            Dept: {session.department_id || "Global Operations"}
          </Badge>
          <Button 
            onClick={() => setVersion(v => v + 1)} 
            variant="ghost" 
            size="icon" 
            className="rounded-full hover:bg-muted"
            disabled={loading}
          >
            <Loader2 className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as "ALL" | WorkflowStatus)} className="space-y-6">
        <TabsList className="bg-muted dark:bg-muted p-1.5 rounded-2xl h-14 w-full justify-start overflow-x-auto no-scrollbar">
          {[
            { id: "ALL", label: "All" },
            { id: "PENDING", label: "Pending" },
            { id: "APPROVED", label: "Approved" },
            { id: "REJECTED", label: "Rejected" },
            { id: "RETURNED", label: "Returned" },
          ].map((t) => (
            <TabsTrigger 
              key={t.id} 
              value={t.id}
              className="rounded-xl px-6 font-black text-xs uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-lg dark:data-[state=active]:bg-muted"
            >
              {t.label} ({statusCounts[t.id as any] || 0})
            </TabsTrigger>
          ))}
        </TabsList>

        {loading && workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-80 rounded-[3rem] border border-dashed border-border bg-muted">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground">Syncing Approval Matrix</p>
          </div>
        ) : error ? (
          <EmptyState 
            variant="error"
            title="Telemetric Failure"
            description="The approval nexus is currently unreachable. Encryption keys may be stale."
            onRetry={load}
          />
        ) : filtered.length === 0 ? (
          <EmptyState 
            variant="no-data"
            title="Clear Skies"
            description="No pending workflow authorizations in your current sector."
            onRetry={load}
            actionLabel="Sync Telemetry"
          />
        ) : (
          <TabsContent value={tab} className="m-0">
            <DataTableShell>
              <table className="w-full text-sm border-separate border-spacing-y-4">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                    <th className="px-6 py-4 text-left">Request Identity</th>
                    <th className="px-6 py-4 text-left">Departmental Route</th>
                    <th className="px-6 py-4 text-left">Status</th>
                    <th className="px-6 py-4 text-right">Protocol</th>
                  </tr>
                </thead>
                <tbody className="space-y-4">
                  {(Array.isArray(filtered) ? filtered : []).map((flow) => (
                    <tr 
                      key={flow.id} 
                      className="bg-card dark:bg-muted shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
                    >
                      <td className="px-6 py-6 first:rounded-l-[2rem]">
                        <p className="font-black text-muted-foreground dark:text-white uppercase tracking-tight">{flow.entityType}</p>
                        <p className="text-[10px] font-bold text-primary font-mono opacity-60">#{flow.entityId.substring(0, 12)}</p>
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          <span>{flow.makerDept}</span>
                          <Separator className="w-4 bg-muted" />
                          <span>{flow.destinationDept}</span>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <ApprovalStatusBadge status={flow.status} />
                      </td>
                      <td className="px-6 py-6 last:rounded-r-[2rem] text-right">
                        <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl font-black text-[10px] h-9 border-border"
                            onClick={() => setSelectedId(flow.id)}
                          >
                            OPEN TRACE
                          </Button>
                          {flow.status === "PENDING" && (
                            <Button
                              size="sm"
                              className="rounded-xl font-black text-[10px] h-9 bg-success hover:bg-success text-white"
                              onClick={() => handleAction("approve", flow)}
                            >
                              AUTHORIZE
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>
          </TabsContent>
        )}
      </Tabs>

      <Sheet open={!!selectedId} onOpenChange={() => setSelectedId(null)}>
        <SheetContent className="sm:max-w-xl rounded-l-[3rem] border-none shadow-2xl p-12">
          {selected && (
            <div className="space-y-10">
              <SheetHeader className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge className="bg-primary text-primary border-none font-black text-[10px] px-3 py-1 rounded-full uppercase">
                    {selected.entityType}
                  </Badge>
                  <ApprovalStatusBadge status={selected.status} />
                </div>
                <SheetTitle className="text-4xl font-black tracking-tighter italic uppercase">Authorization Trace</SheetTitle>
                <SheetDescription className="font-medium text-muted-foreground">
                  Detailed inspection of request #{selected.entityId}
                </SheetDescription>
              </SheetHeader>

              <Separator className="bg-muted" />

              <div className="space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Requester</p>
                    <p className="font-bold text-muted-foreground">{selected.requestedBy}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Timestamp</p>
                    <p className="font-bold text-muted-foreground font-mono text-xs">{new Date(selected.requestedAt).toLocaleString()}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Contextual Notes</p>
                  <div className="p-6 rounded-3xl bg-muted border border-border italic text-muted-foreground text-sm">
                    {selected.notes || "No additional context provided by the maker."}
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Authorization Protocol</p>
                  <Textarea
                    placeholder="Enter disposition notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-[120px] rounded-3xl border-border focus:ring-indigo-600/20"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      variant="destructive"
                      className="h-14 rounded-2xl font-black uppercase tracking-widest text-xs"
                      onClick={() => handleAction("reject", selected)}
                      disabled={selected.status !== "PENDING"}
                    >
                      DENY REQUEST
                    </Button>
                    <Button
                      className="h-14 rounded-2xl font-black uppercase tracking-widest text-xs bg-success hover:bg-success text-white"
                      onClick={() => handleAction("approve", selected)}
                      disabled={selected.status !== "PENDING"}
                    >
                      AUTHORIZE
                    </Button>
                  </div>
                </div>

                {auditTrail.length > 0 && (
                  <div className="space-y-6 pt-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                       <History className="h-3 w-3" />
                       Audit History
                    </p>
                    <div className="space-y-4 border-l-2 border-border ml-2 pl-6">
                      {(Array.isArray(auditTrail) ? auditTrail : []).map((log: any, i: number) => (
                        <div key={i} className="relative">
                          <div className="absolute -left-[1.85rem] top-1 h-3 w-3 rounded-full bg-muted border-2 border-white" />
                          <p className="text-xs font-bold text-muted-foreground">{log.action}</p>
                          <p className="text-[10px] text-muted-foreground font-medium">
                            {log.user_id} • {new Date(log.created_at).toLocaleString()}
                          </p>
                          {log.notes && <p className="mt-1 text-[10px] italic text-muted-foreground">"{log.notes}"</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
