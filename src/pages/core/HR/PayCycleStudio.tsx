import { useCallback, useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { DataTableShell } from "@/core/tools/DataTableShell";
import { ApprovalStatusBadge } from "@/core/tools/ApprovalStatusBadge";
import { FilterBar } from "@/core/tools/FilterBar";
import { useSession } from "@/core/security/session";
import { payrollService } from "@/core/services/hr/payrollService";
import { workflowService } from "@/core/services/hr/workflowService";
import { useBackgroundRefresh } from "@/core/runtime/events/useBackgroundRefresh";
import { Roles } from "@/core/security/roles";
import { EmptyState } from "@/components/shared/AsyncState";
import { formatDate } from "@/lib/format";
import { CreatePayrollRunModal2 } from "./modals";

export default function PayCycleStudio() {
  const session = useSession();
  const [version, setVersion] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState("2026-02-01");
  const [periodEnd, setPeriodEnd] = useState("2026-02-15");
  const [search, setSearch] = useState("");
  const [varianceNote, setVarianceNote] = useState("");
  const refresh = useCallback(() => setVersion((prev) => prev + 1), []);
  useBackgroundRefresh(refresh, 20000);
  const financeAllowed = ([Roles.SUPERADMIN, Roles.OWNER, Roles.COMPANY_ADMIN, Roles.FINANCE_ADMIN] as readonly string[]).includes(session.role);
  
  const [runs, setRuns] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        // checks if payrollService methods are async in next step, but for now assuming component refactor
        const runItems = await payrollService.listRuns(session.tenant_id, session);
        setRuns(runItems);
        
        const workflowItems = await workflowService.listRequests(session.tenant_id, session);
        setWorkflows(workflowItems);
      } catch (err) {
        console.error("Failed to load pay cycle data", err);
      }
    };
    loadData();
  }, [session.tenant_id, session, version]);

  const filteredRuns = (Array.isArray(runs) ? runs : []).filter((run) =>
    search ? run.id.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="PayCycle Studio"
        subtitle="Payroll preparation, variance checks, and FlowGate submission."
        primaryAction={
          <Button onClick={() => setDialogOpen(true)}>Create Payroll Run</Button>
        }
        secondaryActions={<Input placeholder="Search payroll runs" className="min-w-[200px]" />}
      />

      <WorkspacePanel title="WorkQueue" description="Payroll actions and escalation.">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => payrollService.lockAttendance(session.tenant_id, session, periodStart, periodEnd)}
          >
            Lock Attendance
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              const target = runs[0];
              if (target) {
                const result = await payrollService.runVarianceCheck(session.tenant_id, session, target.id);
                setVarianceNote(`Variance score for ${result.runId}: ${result.varianceScore}`);
              }
            }}
          >
            Run Variance Check
          </Button>
        </div>
        {varianceNote ? (
          <div className="mt-3 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            {varianceNote}
          </div>
        ) : null}
      </WorkspacePanel>

      <WorkspacePanel title="Active Records" description="Payroll runs and status.">
        <FilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search payroll runs"
          onReset={() => setSearch("")}
        />
        <DataTableShell total={filteredRuns.length} page={1} pageSize={10}>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Period</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRuns.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-0">
                    <EmptyState
                      title="No payroll runs"
                      description="No payroll runs match the current filters. Create a payroll run to get started."
                    />
                  </td>
                </tr>
              ) : (
                (Array.isArray(filteredRuns) ? filteredRuns : []).map((run) => {
                const canSubmit = run.status === "DRAFT" || run.status === "draft";
                const canApprove = (run.status === "DRAFT" || run.status === "draft" || run.status === "calculated") && financeAllowed;
                const canExport = run.status === "APPROVED";
                const canDisburse = run.status === "APPROVED" && financeAllowed;

                return (
                  <tr key={run.id} className="border-t">
                    <td className="p-3">
                      {formatDate(run.periodStart)} - {formatDate(run.periodEnd)}
                    </td>
                    <td className="p-3 text-muted-foreground">{run.status}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            await payrollService.submitForApproval(session.tenant_id, session, run.id);
                            refresh();
                          }}
                          disabled={!canSubmit}
                        >
                          Submit to FlowGate
                        </Button>
                        <Button
                          size="sm"
                          className="bg-success hover:bg-success text-white"
                          onClick={async () => {
                            await payrollService.approvePayroll(session, run.id);
                            refresh();
                          }}
                          disabled={!canApprove}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            const csv = await payrollService.exportBankFile(session, run.id);
                            const blob = new Blob([csv], { type: "text/csv" });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `bank_export_${run.id}.csv`;
                            a.click();
                          }}
                          disabled={!canExport}
                        >
                          Bank Export
                        </Button>
                        <Button
                          size="sm"
                          className="bg-primary hover:bg-primary text-white"
                          onClick={async () => {
                            if (confirm("Confirm disbursement and post to GL?")) {
                              await payrollService.confirmDisbursement(session, run.id);
                              refresh();
                            }
                          }}
                          disabled={!canDisburse}
                        >
                          Confirm Disbursement
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </DataTableShell>
      </WorkspacePanel>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <WorkspacePanel title="Pending Approvals" description="Finance approvals for payroll runs.">
          <div className="space-y-3">
            {(Array.isArray(workflows) ? workflows : []).map((flow) => (
              <div key={flow.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{flow.entityId}</p>
                  <p className="text-xs text-muted-foreground">Dept: {flow.destinationDept}</p>
                </div>
                <ApprovalStatusBadge status={flow.status} />
              </div>
            ))}
          </div>
        </WorkspacePanel>

        <WorkspacePanel title="Insights" description="Payroll readiness signals.">
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Total runs</span>
              <span className="font-semibold text-foreground">{runs.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Pending approval</span>
              <span className="font-semibold text-foreground">
                {(Array.isArray(workflows) ? workflows : []).filter((flow) => flow.status === "PENDING").length}
              </span>
            </div>
          </div>
        </WorkspacePanel>
      </div>
      <CreatePayrollRunModal2
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => setVersion((prev) => prev + 1)}
      />
    </div>
  );
}
