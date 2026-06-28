import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { DataTableShell } from "@/core/tools/DataTableShell";
import { FilterBar } from "@/core/tools/FilterBar";
import { useSession } from "@/core/security/session";
import { performanceService } from "@/core/services/hr/performanceService";
import { EmptyState } from "@/components/shared/AsyncState";
import { formatDate } from "@/lib/format";
import { CreateReviewCycleModal, LaunchCycleModal } from "./modals";

export default function GrowthCycle() {
  const session = useSession();
  const [version, setVersion] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [cycleName, setCycleName] = useState("");
  const [cycleStart, setCycleStart] = useState("2026-01-01");
  const [cycleEnd, setCycleEnd] = useState("2026-03-31");
  const [cycleDue, setCycleDue] = useState("2026-04-10");
  const [selectedCycle, setSelectedCycle] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [cycleType, setCycleType] = useState<"annual" | "probation">("annual");

  const [overview, setOverview] = useState<{
    cycles: any[];
    reviews: any[];
    activeCycles: number;
    pendingReviews: number;
  }>({ cycles: [], reviews: [], activeCycles: 0, pendingReviews: 0 });

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await performanceService.getCycleOverview(session.tenant_id, session);
        setOverview(data);
      } catch (err) {
        console.error("Failed to load growth cycle data", err);
      }
    };
    loadData();
  }, [session.tenant_id, session, version]);

  const filteredCycles = (Array.isArray(overview.cycles) ? overview.cycles : []).filter((cycle) =>
    search ? cycle.name.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="GrowthCycle"
        subtitle="Performance OS for reviews, calibration, and promotion readiness."
        primaryAction={
          <Button
            onClick={() => {
              setDialogOpen(true);
            }}
          >
            Create Review Cycle
          </Button>
        }
        secondaryActions={<Input placeholder="Search reviews" className="min-w-[200px]" value={search} onChange={(e) => setSearch(e.target.value)} />}
      />

      <WorkspacePanel title="WorkQueue" description="Review actions and calibration.">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setActionOpen(true);
              setSelectedCycle(overview.cycles[0]?.id ?? "");
            }}
          >
            Launch Cycle
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const target = overview.cycles[0];
              if (target) {
                performanceService.runCalibration(session.tenant_id, session, target.id);
                setVersion((prev) => prev + 1);
              }
            }}
          >
            Run Calibration
          </Button>
        </div>
      </WorkspacePanel>

      <WorkspacePanel title="Active Records" description="Review cycles in progress.">
        <FilterBar searchValue={search} onSearchChange={setSearch} />
        <DataTableShell total={filteredCycles.length} page={1} pageSize={10}>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Cycle</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Due</th>
              </tr>
            </thead>
            <tbody>
              {filteredCycles.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-0">
                    <EmptyState
                      title="No review cycles"
                      description="No review cycles match the current search. Create a review cycle to begin."
                    />
                  </td>
                </tr>
              ) : (
                (Array.isArray(filteredCycles) ? filteredCycles : []).map((cycle) => (
                <tr key={cycle.id} className="border-t">
                  <td className="p-3">{cycle.name}</td>
                  <td className="p-3 text-muted-foreground">{cycle.status}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(cycle.dueDate)}</td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </DataTableShell>
      </WorkspacePanel>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <WorkspacePanel title="Pending Approvals" description="Reviews awaiting approval.">
          <div className="space-y-3 text-sm text-muted-foreground">
            {overview.reviews.slice(0, 4).map((review) => (
              <div key={review.id} className="flex items-center justify-between rounded-lg border p-3">
                <span>{review.employeeId}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    performanceService.requestReviewApproval(session.tenant_id, session, review.id, review.employeeId);
                    setVersion((prev) => prev + 1);
                  }}
                >
                  Send to FlowGate
                </Button>
              </div>
            ))}
          </div>
        </WorkspacePanel>

        <WorkspacePanel title="Insights" description="Performance signals.">
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Active cycles</span>
              <span className="font-semibold text-foreground">{overview.activeCycles}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Pending reviews</span>
              <span className="font-semibold text-foreground">{overview.pendingReviews}</span>
            </div>
          </div>
        </WorkspacePanel>
      </div>

      <CreateReviewCycleModal
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => setVersion((prev) => prev + 1)}
      />

      <LaunchCycleModal
        isOpen={actionOpen}
        onClose={() => setActionOpen(false)}
        cycles={overview.cycles.map((c: any) => ({ id: c.id, name: c.name }))}
        defaultCycleId={selectedCycle}
        onSuccess={() => setVersion((prev) => prev + 1)}
      />
    </div>
  );
}
