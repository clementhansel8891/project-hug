import { useCallback, useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { DataTableShell } from "@/core/tools/DataTableShell";
import { FilterBar } from "@/core/tools/FilterBar";
import { FeedbackAlert } from "@/core/tools/FeedbackAlert";
import { useSession } from "@/core/security/session";
import { orgService } from "@/core/services/hr/orgService";
import { useBackgroundRefresh } from "@/core/runtime/events/useBackgroundRefresh";
import { EmptyState } from "@/components/shared/AsyncState";
import { CreateDepartmentModal, CreatePositionModal, AssignEmployeePositionModal } from "./modals";

type OrgMapDept = {
  id: string;
  name: string;
  headcount: number;
  openRequisitions: number;
  attendanceRisk: number;
  code?: string;
  status?: string;
};

export default function OrgMap() {
  const session = useSession();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [positionOpen, setPositionOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [deptName, setDeptName] = useState("New Department");
  const [deptCode, setDeptCode] = useState("NEW");
  const [search, setSearch] = useState("");
  const [actionOpen, setActionOpen] = useState(false);
  const [actionType, setActionType] = useState<"risk" | "requisition" | "route">("risk");
  const [actionDeptId, setActionDeptId] = useState("");
  const [actionNotes, setActionNotes] = useState("");
  const [requisitionTitle, setRequisitionTitle] = useState("Operations Analyst");
  const [requisitionOpenings, setRequisitionOpenings] = useState("1");
  const [version, setVersion] = useState(0);
  const [selectedDept, setSelectedDept] = useState<OrgMapDept | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [data, setData] = useState<OrgMapDept[]>([]);

  const clearStatus = () => {
    setStatusMessage(null);
    setErrorMessage(null);
  };
  const refresh = useCallback(() => setVersion((prev) => prev + 1), []);
  useBackgroundRefresh(refresh, 20000);

  useEffect(() => {
    const loadData = async () => {
      try {
        const items = await orgService.getOrgMap(session.tenant_id, session);
        setData((Array.isArray(items) ? items : []).map(dept => ({ ...dept, headcount: dept.headcount ?? 0 })) as OrgMapDept[]);
      } catch (err) {
        console.error("Failed to load org map", err);
      }
    };
    loadData();
  }, [session.tenant_id, session, version]);

  const filteredData = (Array.isArray(data) ? data : []).filter((dept) =>
    search ? dept.name.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="OrgMap"
        subtitle="Department intelligence, staffing levels, and readiness signals."
        primaryAction={<Button onClick={() => setDialogOpen(true)}>New Department</Button>}
        secondaryActions={<Input placeholder="Search departments" className="min-w-[200px]" value={search} onChange={(e) => setSearch(e.target.value)} />}
      />

      <FeedbackAlert message={statusMessage} error={errorMessage} onClear={clearStatus} />

      <WorkspacePanel title="WorkQueue" description="Department actions requiring attention.">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setActionType("risk");
              setActionDeptId(data[0]?.id ?? "");
              setActionOpen(true);
            }}
          >
            Escalate staffing risk
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setActionType("requisition");
              setActionDeptId(data[0]?.id ?? "");
              setActionOpen(true);
            }}
          >
            Open requisition
          </Button>
          <Button
            variant="outline"
            onClick={() => setPositionOpen(true)}
          >
            Create Position
          </Button>
          <Button
            variant="outline"
            onClick={() => setAssignOpen(true)}
          >
            Assign Employee
          </Button>
        </div>
      </WorkspacePanel>

      <WorkspacePanel title="Active Records" description="Department map and readiness.">
        <FilterBar searchValue={search} onSearchChange={setSearch} />
        <DataTableShell total={filteredData.length} page={1} pageSize={10}>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Department</th>
                <th className="p-3 text-left">Headcount</th>
                <th className="p-3 text-left">Open Reqs</th>
                <th className="p-3 text-left">Attendance Risk</th>
                <th className="p-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-0">
                    <EmptyState
                      title="No departments"
                      description="No departments match the current search. Create a department to populate the org map."
                    />
                  </td>
                </tr>
              ) : (
                (Array.isArray(filteredData) ? filteredData : []).map((dept) => (
                <tr
                  key={dept.id}
                  className="cursor-pointer border-t hover:bg-muted/50"
                  onClick={() => setSelectedDept(dept)}
                >
                  <td className="p-3 font-medium text-foreground">{dept.name}</td>
                  <td className="p-3 text-muted-foreground">{dept.headcount}</td>
                  <td className="p-3 text-muted-foreground">{dept.openRequisitions}</td>
                  <td className="p-3 text-muted-foreground">{dept.attendanceRisk}%</td>
                  <td className="p-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate("/core/hr/roster");
                      }}
                    >
                      Open RosterGrid
                    </Button>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </DataTableShell>
      </WorkspacePanel>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <WorkspacePanel title="Pending Approvals" description="Department routing actions.">
          <div className="space-y-3 text-sm text-muted-foreground">
            {data.slice(0, 3).map((dept) => (
              <div key={dept.id} className="flex items-center justify-between rounded-lg border p-3">
                <span>{dept.name}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await orgService.routeDepartment(session.tenant_id, session, dept.id, "OrgMap routing");
                      setStatusMessage(`Department ${dept.name} routed to FlowGate.`);
                      setVersion((prev) => prev + 1);
                    } catch (err) {
                      setErrorMessage("Routing failed.");
                    }
                  }}
                >
                  Send to FlowGate
                </Button>
              </div>
            ))}
          </div>
        </WorkspacePanel>

        <WorkspacePanel title="Insights" description="Org-level operational overview.">
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Total departments</span>
              <span className="font-semibold text-foreground">{data.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Open requisitions</span>
              <span className="font-semibold text-foreground">
                {data.reduce((sum, dept) => sum + dept.openRequisitions, 0)}
              </span>
            </div>
          </div>
        </WorkspacePanel>
      </div>
      <CreateDepartmentModal
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => setVersion((prev) => prev + 1)}
      />

      <CreatePositionModal
        isOpen={positionOpen}
        onClose={() => setPositionOpen(false)}
        departments={data.map((d) => ({ id: d.id, name: d.name }))}
        onSuccess={() => setVersion((prev) => prev + 1)}
      />

      <AssignEmployeePositionModal
        isOpen={assignOpen}
        onClose={() => setAssignOpen(false)}
        onSuccess={() => setVersion((prev) => prev + 1)}
      />

      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Department Action</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Department ID"
              value={actionDeptId}
              onChange={(e) => setActionDeptId(e.target.value)}
            />
            {actionType === "requisition" ? (
              <>
                <Input value={requisitionTitle} onChange={(e) => setRequisitionTitle(e.target.value)} />
                <Input value={requisitionOpenings} onChange={(e) => setRequisitionOpenings(e.target.value)} />
              </>
            ) : (
              <Textarea
                placeholder="Notes"
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
              />
            )}
            <Button
              onClick={async () => {
                try {
                  if (actionType === "risk") {
                    await orgService.escalateStaffingRisk(session.tenant_id, session, actionDeptId, actionNotes);
                    setStatusMessage("Staffing risk escalated.");
                  }
                  if (actionType === "requisition") {
                    await orgService.openRequisition(session.tenant_id, session, {
                      title: requisitionTitle,
                      departmentId: actionDeptId,
                      openings: Number(requisitionOpenings || "1"),
                    });
                    setStatusMessage("New job requisition opened.");
                  }
                  if (actionType === "route") {
                    await orgService.routeDepartment(session.tenant_id, session, actionDeptId, actionNotes);
                    setStatusMessage("Department route initiated.");
                  }
                  setActionNotes("");
                  setActionOpen(false);
                  setVersion((prev) => prev + 1);
                } catch (err) {
                  setErrorMessage("Action failed.");
                }
              }}
            >
              Submit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!selectedDept} onOpenChange={() => setSelectedDept(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Department Intel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 text-sm gap-y-2">
              <span className="text-muted-foreground">Name:</span>
              <span className="font-semibold">{selectedDept?.name}</span>
              <span className="text-muted-foreground">Code:</span>
              <span className="font-mono">{selectedDept?.code}</span>
              <span className="text-muted-foreground">Headcount:</span>
              <span>{selectedDept?.headcount}</span>
              <span className="text-muted-foreground">Openings:</span>
              <span>{selectedDept?.openRequisitions}</span>
              <span className="text-muted-foreground">Attendance Risk:</span>
              <span className={Number(selectedDept?.attendanceRisk) > 15 ? "text-destructive font-bold" : ""}>
                {selectedDept?.attendanceRisk}%
              </span>
              <span className="text-muted-foreground">Status:</span>
              <span className="capitalize">{selectedDept?.status}</span>
            </div>
            <div className="border-t pt-2 text-xs text-muted-foreground">
              <p>Department risk and headcount are calculated in real-time based on RosterGrid signals and recruitment pipeline flow.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
