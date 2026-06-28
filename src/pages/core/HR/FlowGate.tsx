import { useCallback, useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { DataTableShell } from "@/core/tools/DataTableShell";
import { ApprovalStatusBadge } from "@/core/tools/ApprovalStatusBadge";
import { FeedbackAlert } from "@/core/tools/FeedbackAlert";
import { useSession } from "@/core/security/session";
import { workflowService } from "@/core/services/hr/workflowService";
import { useBackgroundRefresh } from "@/core/runtime/events/useBackgroundRefresh";
import { ZenTooltip } from "@/core/ui/ZenTooltip";
import { PlusCircle, Search, FileText, CheckCircle2, XCircle, RefreshCcw } from "lucide-react";
import { formatDate } from "@/lib/format";
import { CreateFlowRouteModal, EditFlowRouteModal, AssignApproversModal } from "./modals";

export default function FlowGate() {
  const session = useSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [version, setVersion] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [entityType, setEntityType] = useState<"PAYROLL" | "LEAVE" | "CONTRACT" | "RECRUITMENT" | "TRAINING" | "PERFORMANCE" | "CASE">("PAYROLL");
  const [entityId, setEntityId] = useState("");
  const [destinationDept, setDestinationDept] = useState("HR");
  const [selectedAuditEntry, setSelectedAuditEntry] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearStatus = () => {
    setStatusMessage(null);
    setErrorMessage(null);
  };
  const refresh = useCallback(() => setVersion((prev) => prev + 1), []);
  useBackgroundRefresh(refresh, 15000);

  const [workflows, setWorkflows] = useState<any[]>([]);

  useEffect(() => {
    const loadWorkflows = async () => {
      try {
        const items = await workflowService.listInbox(session.tenant_id, session, session.department_id);
        setWorkflows(items);
      } catch (err) {
        setErrorMessage("Failed to load workqueue.");
      }
    };
    loadWorkflows();
  }, [session, version]);

  const selected = workflows.find((flow) => flow.id === selectedId) ?? workflows[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="FlowGate"
        subtitle="Approval routing OS for multi-step workforce operations."
        primaryAction={
          <ZenTooltip content="Initiate a new structured approval route.">
            <Button onClick={() => setDialogOpen(true)} className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              New Flow Route
            </Button>
          </ZenTooltip>
        }
        secondaryActions={
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search requests" className="min-w-[200px]" />
          </div>
        }
      />

      <FeedbackAlert message={statusMessage} error={errorMessage} onClear={clearStatus} />

      <WorkspacePanel title="WorkQueue" description="Operational requests awaiting your decision.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workflows.slice(0, 6).map((flow) => (
            <div
              key={flow.id}
              className={`rounded-lg border p-4 transition-all hover:shadow-md ${selected?.id === flow.id ? "border-primary ring-1 ring-primary/20 bg-primary/5" : ""}`}
            >
              <div className="flex items-start justify-between">
                 <div>
                    <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                       <FileText className="h-4 w-4 text-primary" />
                       {flow.entityType}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Route to: {flow.destinationDept}</p>
                 </div>
                 <ApprovalStatusBadge status={flow.status} />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-4 w-full justify-start font-normal"
                onClick={() => {
                  setSelectedId(flow.id);
                  setDetailOpen(true);
                }}
              >
                Inspect Case Details
              </Button>
            </div>
          ))}
        </div>
      </WorkspacePanel>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <WorkspacePanel title="Active Pipeline" description="Live status of each step in the flow.">
          {selected ? (
            <div className="space-y-3">
              {(selected as any).steps?.map((step: any, index: number) => (
                <div key={step.id} className="flex items-center gap-3 rounded-lg border p-3 bg-muted/20">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{step.label}</p>
                    <p className="text-xs text-muted-foreground">Oversight: {step.dept}</p>
                  </div>
                  <ApprovalStatusBadge status={step.status} />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
              Select an active request from the WorkQueue to inspect the pipeline.
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel title="Decision Center" description="Execute authoritative actions on this request.">
          {selected ? (
            <div className="space-y-4">
              <div className="space-y-2">
                 <label className="text-xs font-semibold uppercase text-muted-foreground">Decision Notes</label>
                 <Input
                   placeholder="Enter rationale for your decision..."
                   value={notes}
                   onChange={(event) => setNotes(event.target.value)}
                 />
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <ZenTooltip content="Finalize approval and advance to the next step.">
                  <Button
                    className="flex-1 sm:flex-none flex items-center gap-2"
                    onClick={async () => {
                      try {
                        await workflowService.approveRequest(session.tenant_id, selected.id, session, notes);
                        setStatusMessage("Request approved successfully.");
                        setNotes("");
                        refresh();
                      } catch (err) {
                        setErrorMessage("Approval execution failed.");
                      }
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Approve Request
                  </Button>
                </ZenTooltip>

                <ZenTooltip content="Reject the request and stop the workflow sequence.">
                  <Button
                    variant="destructive"
                    className="flex-1 sm:flex-none flex items-center gap-2"
                    onClick={async () => {
                      try {
                        await workflowService.rejectRequest(session.tenant_id, selected.id, session, notes);
                        setStatusMessage("Request formally rejected.");
                        setNotes("");
                        refresh();
                      } catch (err) {
                        setErrorMessage("Rejection failed.");
                      }
                    }}
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </Button>
                </ZenTooltip>

                <ZenTooltip content="Return to the initiator for modification.">
                   <Button
                     variant="outline"
                     className="flex-1 sm:flex-none flex items-center gap-2"
                     onClick={() => {
                        setStatusMessage("Modification requests now handled via comments in Activity Stream.");
                     }}
                   >
                     <RefreshCcw className="h-4 w-4" />
                     Return
                   </Button>
                </ZenTooltip>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
              Awaiting case selection.
            </div>
          )}
        </WorkspacePanel>
      </div>

      <WorkspacePanel title="Audit Trail" description="Immutable approval history.">
        <DataTableShell total={auditTrail.length} page={1} pageSize={10}>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Action</th>
                <th className="p-3 text-left">Actor</th>
                <th className="p-3 text-left">Cycle</th>
                <th className="p-3 text-left">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(auditTrail) ? auditTrail : []).map((entry) => (
                <tr
                  key={entry.id}
                  className="cursor-pointer border-t hover:bg-muted/50"
                  onClick={() => setSelectedAuditEntry(entry)}
                >
                  <td className="p-3">{entry.action}</td>
                  <td className="p-3 text-muted-foreground">{entry.actorRole}</td>
                  <td className="p-3 text-muted-foreground">{entry.cycle}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(entry.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableShell>
      </WorkspacePanel>

      <WorkspacePanel title="Insights" description="FlowGate activity overview.">
        <div className="grid gap-3 md:grid-cols-3 text-sm text-muted-foreground">
          <div className="rounded-lg border p-3">
            <p className="text-xs">Total requests</p>
            <p className="text-lg font-semibold text-foreground">{workflows.length}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs">Pending</p>
            <p className="text-lg font-semibold text-foreground">
              {(Array.isArray(workflows) ? workflows : []).filter((flow) => flow.status === "PENDING").length}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs">Returned</p>
            <p className="text-lg font-semibold text-foreground">
              {(Array.isArray(workflows) ? workflows : []).filter((flow) => flow.status === "RETURNED").length}
            </p>
          </div>
        </div>
      </WorkspacePanel>

      <CreateFlowRouteModal
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => {
          setVersion((prev) => prev + 1);
        }}
      />

      <EditFlowRouteModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        flowId={selected?.id ?? ""}
        defaultDestinationDept={selected?.destinationDept ?? "HR"}
        onSuccess={() => setVersion((prev) => prev + 1)}
      />

      <AssignApproversModal
        isOpen={assignOpen}
        onClose={() => setAssignOpen(false)}
        defaultFlowId={selected?.id ?? ""}
        onSuccess={() => setVersion((prev) => prev + 1)}
      />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Workflow Case Detail</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <span className="text-muted-foreground block text-xs uppercase tracking-wider">Type</span>
                <span className="font-bold text-primary">{selected?.entityType}</span>
              </div>
              <div className="space-y-1 text-right">
                <span className="text-muted-foreground block text-xs uppercase tracking-wider">Status</span>
                <ApprovalStatusBadge status={selected?.status || "UNKNOWN"} />
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground block text-xs uppercase tracking-wider">Maker Dept</span>
                <span>{selected?.makerDept}</span>
              </div>
              <div className="space-y-1 text-right">
                <span className="text-muted-foreground block text-xs uppercase tracking-wider">Created</span>
                <span className="font-mono text-xs">{formatDate(selected?.requestedAt)}</span>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3">Routing Pipeline</h4>
              <div className="space-y-2">
                {selected?.steps.map((step, idx) => (
                  <div key={step.id} className="flex items-center gap-3 rounded-md border p-2 bg-muted/30">
                    <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                    <div className="flex-1">
                      <p className="text-xs font-medium">{step.label}</p>
                      <p className="text-[10px] text-muted-foreground italic">{step.dept}</p>
                    </div>
                    <ApprovalStatusBadge status={step.status} />
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3">Action context</h4>
              <p className="text-sm text-foreground bg-muted p-3 rounded-md min-h-[60px]">
                {selected?.notes || "No additional notes provided by initiator."}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedAuditEntry} onOpenChange={() => setSelectedAuditEntry(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Audit Entry Detail</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 text-sm gap-y-2">
              <span className="text-muted-foreground">Action:</span>
              <span className="font-semibold">{selectedAuditEntry?.action}</span>
              <span className="text-muted-foreground">Actor:</span>
              <span>{selectedAuditEntry?.actorId} ({selectedAuditEntry?.actorRole})</span>
              <span className="text-muted-foreground">Cycle:</span>
              <span>Cycle {selectedAuditEntry?.cycle}</span>
              <span className="text-muted-foreground">Timestamp:</span>
              <span>{formatDate(selectedAuditEntry?.createdAt)}</span>
            </div>
            <div className="border-t pt-2 text-xs text-muted-foreground">
              <p>This is an immutable record of the workflow transition. Any modifications to the route itself are logged in the kernel system audit.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
