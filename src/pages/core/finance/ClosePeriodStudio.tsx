import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { DataTableShell } from "@/core/tools/DataTableShell";
import { ApprovalStatusBadge } from "@/core/tools/ApprovalStatusBadge";
import { FeedbackAlert } from "@/core/tools/FeedbackAlert";
import { useSession } from "@/core/security/session";
import { apiRequest } from "@/core/api/apiClient";
import { useToast } from "@/hooks/use-toast";
import { financeService, type AccountingPeriod } from "@/core/services/finance/financeService";
import { workflowService } from "@/core/services/hr/workflowService";
import { logService } from "@/core/services/finance/logService";
import { closePeriodSchema, type ClosePeriodFormData } from "@/core/finance/schemas";

type PeriodTab = "OPEN" | "CLOSING" | "CLOSED" | "FAILED";

const TABS: PeriodTab[] = ["OPEN", "CLOSING", "CLOSED", "FAILED"];

export default function ClosePeriodStudio() {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<PeriodTab>("OPEN");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<AccountingPeriod | null>(null);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const closePeriodMutation = useMutation({
    mutationFn: (periodId: string) =>
      apiRequest(`/v1/finance/periods/${periodId}/close`, "POST", session, {}),
    onSuccess: () => {
      toast({ title: "Period Close Started", description: "Period close process initiated and routed for approval." });
      queryClient.invalidateQueries({ queryKey: ["finance", "periods"] });
      setDialogOpen(false);
      refresh();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to start period close.", variant: "destructive" });
    },
  });

  const clearStatus = () => {
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const refresh = useCallback(() => {
    financeService.listPeriods(session.tenant_id, session).then(setPeriods).catch(console.error);
  }, [session.tenant_id, session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredPeriods = useMemo(
    () =>
      (Array.isArray(periods) ? periods : []).filter((period) => {
        const matchesSearch = search
          ? `${period.startDate} ${period.endDate}`.includes(search)
          : true;
        const matchesTab = period.status === tab;
        return matchesSearch && matchesTab;
      }),
    [periods, search, tab],
  );

  const startClose = (period: AccountingPeriod) => {
    closePeriodMutation.mutate(period.id);
  };

  const approveClose = (period: AccountingPeriod) => {
    try {
      financeService.approvePeriodClose(session.tenant_id, session, period.id);
      logService.log(session.tenant_id, session.user_id, "Approved period close", period.id);
      setStatusMessage("Period close approved and books finalized.");
      refresh();
    } catch (err) {
      setErrorMessage("Approval failed. Permission error.");
    }
  };

  const failClose = (period: AccountingPeriod) => {
    try {
      financeService.markPeriodFailed(session.tenant_id, session, period.id);
      logService.log(session.tenant_id, session.user_id, "Marked close as failed", period.id);
      setErrorMessage("Period close marked as failed for further investigation.");
      refresh();
    } catch (err) {
      // ignore
    }
  };

  const reopen = (period: AccountingPeriod) => {
    try {
      financeService.reopenPeriod(session.tenant_id, session, period.id);
      logService.log(session.tenant_id, session.user_id, "Reopened period", period.id);
      setStatusMessage("Period reopened for adjustment.");
      refresh();
    } catch (err) {
      setErrorMessage("Reopen failed.");
    }
  };

  const forceClose = (period: AccountingPeriod) => {
    try {
      financeService.forceClosePeriod(session.tenant_id, session, period.id);
      logService.log(session.tenant_id, session.user_id, "Force closed period", period.id);
      setStatusMessage("Period force-closed with admin override.");
      refresh();
    } catch (err) {
      setErrorMessage("Force close failed.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Close Period Studio"
        subtitle="Run period close with lock, review, failure handling, and reopen controls."
        primaryAction={
          <Button onClick={() => setDialogOpen(true)} disabled={!periods.some((period) => period.status === "OPEN")}>
            Start Period Close
          </Button>
        }
        secondaryActions={
          <Input
            placeholder="Search accounting periods"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-w-[220px]"
          />
        }
      />

      <FeedbackAlert message={statusMessage} error={errorMessage} onClear={clearStatus} />

      <WorkspacePanel title="Accounting Periods" description="Status-aware operations for close lifecycle.">
        <Tabs value={tab} onValueChange={(value) => setTab(value as PeriodTab)}>
          <TabsList>
            {(Array.isArray(TABS) ? TABS : []).map((status) => (
              <TabsTrigger key={status} value={status}>
                {status.charAt(0) + status.slice(1).toLowerCase()}
              </TabsTrigger>
            ))}
          </TabsList>

          {(Array.isArray(TABS) ? TABS : []).map((status) => (
            <TabsContent key={status} value={status} className="mt-4">
              <DataTableShell total={filteredPeriods.length} page={1} pageSize={10}>
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-3 text-left">Period</th>
                      <th className="p-3 text-left">Status</th>
                      <th className="p-3 text-left">Locked By</th>
                      <th className="p-3 text-left">Approval Level</th>
                      <th className="p-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(filteredPeriods) ? filteredPeriods : []).map((period) => (
                      <tr key={period.id} className="border-t">
                        <td className="p-3 font-medium">
                          {period.startDate} - {period.endDate}
                        </td>
                        <td className="p-3">
                          <ApprovalStatusBadge status={period.status} />
                        </td>
                        <td className="p-3 text-muted-foreground">{period.lockedBy || "-"}</td>
                        <td className="p-3 text-muted-foreground">{period.approvalLevel || 0}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            {period.status === "OPEN" ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedPeriod(period);
                                    setDialogOpen(true);
                                  }}
                                >
                                  Close
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => forceClose(period)}>
                                  Force Close
                                </Button>
                              </>
                            ) : null}
                            {period.status === "CLOSING" ? (
                              <>
                                <Button size="sm" onClick={() => approveClose(period)}>
                                  Approve Close
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => failClose(period)}>
                                  Mark Failed
                                </Button>
                              </>
                            ) : null}
                            {(period.status === "FAILED" || period.status === "CLOSED") ? (
                              <Button size="sm" variant="outline" onClick={() => reopen(period)}>
                                Reopen
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTableShell>
            </TabsContent>
          ))}
        </Tabs>
      </WorkspacePanel>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open && !closePeriodMutation.isPending) setDialogOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Start Period Close</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Confirm locking the selected period for closing review and approval routing.
            </p>
            <div className="space-y-2">
              {(Array.isArray(periods) ? periods : []).filter((period) => period.status === "OPEN")
                .map((period) => (
                  <div
                    key={period.id}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm"
                  >
                    <span>
                      {period.startDate} - {period.endDate}
                    </span>
                    <Button size="sm" onClick={() => startClose(period)} disabled={closePeriodMutation.isPending}>
                      {closePeriodMutation.isPending ? "Closing..." : "Start Close"}
                    </Button>
                  </div>
                ))}
            </div>
            {selectedPeriod ? (
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={closePeriodMutation.isPending}>
                  Cancel
                </Button>
                <Button onClick={() => startClose(selectedPeriod)} disabled={closePeriodMutation.isPending}>
                  {closePeriodMutation.isPending ? "Processing..." : "Confirm"}
                </Button>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
