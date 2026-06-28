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
import { trainingService } from "@/core/services/hr/trainingService";
import { staffService } from "@/core/services/hr/staffService";
import { EmptyState } from "@/components/shared/AsyncState";
import { AssignTrainingModal, BulkAssignTrainingModal } from "./modals";

export default function SkillTrack() {
  const session = useSession();
  const [version, setVersion] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [actionType, setActionType] = useState<"assign" | "bulk" | "export" | "escalate">("assign");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("");
  const [bulkIds, setBulkIds] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  
  const [compliance, setCompliance] = useState({ assigned: 0, completed: 0, overdue: 0, completionRate: 0 });
  const [assignments, setAssignments] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [staff, setStaff] = useState<{ items: any[]; total: number }>({ items: [], total: 0 });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [comp, assgns, progs, stff] = await Promise.all([
          trainingService.getComplianceStatus(session.tenant_id, session),
          trainingService.listAssignments(session.tenant_id, session),
          trainingService.listPrograms(session.tenant_id, session),
          staffService.listStaff(session.tenant_id, session, {}, { page: 1, pageSize: 50 }),
        ]);
        setCompliance(comp);
        setAssignments(assgns);
        setPrograms(progs);
        setStaff(stff);
      } catch (err) {
        console.error("Failed to load skill track data", err);
      }
    };
    loadData();
  }, [session.tenant_id, session, version]);

  const filteredAssignments = (Array.isArray(assignments) ? assignments : []).filter((assignment) =>
    search ? assignment.employeeId.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="SkillTrack"
        subtitle="Training, compliance, and certification readiness."
        primaryAction={
          <Button
            onClick={() => setAssignOpen(true)}
          >
            Assign Training
          </Button>
        }
        secondaryActions={<Input placeholder="Search training" className="min-w-[200px]" value={search} onChange={(e) => setSearch(e.target.value)} />}
      />

      <WorkspacePanel title="WorkQueue" description="Compliance actions.">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setBulkOpen(true)}
          >
            Bulk Assign
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              await trainingService.exportCompliance(session.tenant_id, session);
            }}
          >
            Export Compliance
          </Button>
        </div>
      </WorkspacePanel>

      <WorkspacePanel title="Active Records" description="Training assignments and status.">
        <FilterBar searchValue={search} onSearchChange={setSearch} />
        <DataTableShell total={filteredAssignments.length} page={1} pageSize={10}>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Employee</th>
                <th className="p-3 text-left">Program</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-0">
                    <EmptyState
                      title="No training assignments"
                      description="No training assignments match the current search. Assign training to populate this list."
                    />
                  </td>
                </tr>
              ) : (
                (Array.isArray(filteredAssignments) ? filteredAssignments : []).map((assignment) => (
                <tr key={assignment.id} className="border-t">
                  <td className="p-3">{assignment.employeeId}</td>
                  <td className="p-3 text-muted-foreground">{assignment.programId}</td>
                  <td className="p-3 text-muted-foreground">{assignment.status}</td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </DataTableShell>
      </WorkspacePanel>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <WorkspacePanel title="Pending Approvals" description="Training escalations.">
          <div className="space-y-3 text-sm text-muted-foreground">
            {assignments.slice(0, 3).map((assignment) => (
              <div key={assignment.id} className="flex items-center justify-between rounded-lg border p-3">
                <span>{assignment.employeeId}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await trainingService.requestComplianceReview(session.tenant_id, session, assignment.employeeId);
                    setVersion((prev) => prev + 1);
                  }}
                >
                  Escalate
                </Button>
              </div>
            ))}
          </div>
        </WorkspacePanel>

        <WorkspacePanel title="Insights" description="Compliance performance.">
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Assigned</span>
              <span className="font-semibold text-foreground">{compliance.assigned}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Completed</span>
              <span className="font-semibold text-foreground">{compliance.completed}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Completion rate</span>
              <span className="font-semibold text-foreground">{compliance.completionRate}%</span>
            </div>
          </div>
        </WorkspacePanel>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Training Action</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {actionType === "bulk" ? (
              <>
                <Input
                  placeholder="Employee IDs (comma-separated)"
                  value={bulkIds}
                  onChange={(e) => setBulkIds(e.target.value)}
                />
                <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                  <SelectTrigger>
                    <SelectValue placeholder="Training program" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Array.isArray(programs) ? programs : []).map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : (
              <>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Array.isArray(staff.items) ? staff.items : []).map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                  <SelectTrigger>
                    <SelectValue placeholder="Training program" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Array.isArray(programs) ? programs : []).map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
              </>
            )}
            <Button
              onClick={async () => {
                try {
                  if (actionType === "bulk") {
                    const ids = bulkIds.split(",").map((id) => id.trim()).filter(Boolean);
                    await trainingService.bulkAssign(session.tenant_id, session, {
                      employeeIds: ids.length ? ids : (Array.isArray(staff.items) ? staff.items : []).map((emp) => emp.id),
                      programId: selectedProgram,
                    });
                  } else if (selectedEmployee) {
                    await trainingService.assignTraining(session.tenant_id, session, {
                      employeeId: selectedEmployee,
                      programId: selectedProgram,
                    });
                  }
                  setNotes("");
                  setDialogOpen(false);
                  setVersion((prev) => prev + 1);
                } catch (err) {
                  console.error("Failed to assign training", err);
                }
              }}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AssignTrainingModal
        isOpen={assignOpen}
        onClose={() => setAssignOpen(false)}
        employees={staff.items.map((e: any) => ({ id: e.id, fullName: e.fullName }))}
        programs={programs.map((p: any) => ({ id: p.id, name: p.name }))}
        onSuccess={() => setVersion((prev) => prev + 1)}
      />

      <BulkAssignTrainingModal
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        programs={programs.map((p: any) => ({ id: p.id, name: p.name }))}
        onSuccess={() => setVersion((prev) => prev + 1)}
      />
    </div>
  );
}
