import { useMemo, useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserCog, Network, Info, Zap, Store, PlusCircle, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { DataTableShell } from "@/core/tools/DataTableShell";
import { FilterBar } from "@/core/tools/FilterBar";
import { ApprovalStatusBadge } from "@/core/tools/ApprovalStatusBadge";
import { ActivityThread } from "@/core/tools/activity/ActivityThread";
import { FeedbackAlert } from "@/core/tools/FeedbackAlert";
import { useSession } from "@/core/security/session";
import { hrService } from "@/core/services/hr/hrService";
import { peopleService } from "@/core/services/hr/peopleService";
import { staffService } from "@/core/services/hr/staffService";
import { retailService } from "@/core/services/retail/retailService";
import { workflowService } from "@/core/services/hr/workflowService";
import { ZenTooltip } from "@/core/ui/ZenTooltip";
import { Check, ChevronRight, MapPin, Briefcase, CreditCard } from "lucide-react";
import { EmptyState } from "@/components/shared/AsyncState";
import { formatCurrency, formatDate, formatDateTime, safeText } from "@/lib/format";
import { CreateWorkflowRequestModal, UpdateEmployeeModal, TransferEmployeeModal, TerminateEmployeeModal } from "./modals";

export default function PeopleCore() {
  const session = useSession();
  const params = useParams();
  const navigate = useNavigate();
  const employeeId = params.id ?? "";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [workflowType, setWorkflowType] = useState<
    "PERFORMANCE" | "PAYROLL" | "CONTRACT" | "TRAINING"
  >("PERFORMANCE");
  const [destinationDept, setDestinationDept] = useState("HR");
  const [notes, setNotes] = useState("");
  const [listSearch, setListSearch] = useState("");
  const [editForm, setEditForm] = useState({
    roleTitle: "",
    departmentId: "",
    locationId: "",
    status: "active",
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<{
    type: string;
    data: any;
  } | null>(null);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionType, setActionType] = useState<"MOVE" | "REMOVE" | "TERMINATE" | "PROMOTE" | "SUSPEND">(
    "MOVE",
  );
  const [actionReason, setActionReason] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newSalary, setNewSalary] = useState<number | undefined>(undefined);
  const [targetDept, setTargetDept] = useState("HR");
  const [targetLocation, setTargetLocation] = useState("");
  const [wizardStep, setWizardStep] = useState(1);
  const [availableDepts, setAvailableDepts] = useState<any[]>([]);
  const [availableLocations, setAvailableLocations] = useState<any[]>([]);
  const [retailShifts, setRetailShifts] = useState<any[]>([]);
  const [activeShift, setActiveShift] = useState<any | null>(null);

  const [record, setRecord] = useState<any | null>(null);
  const employee = record?.employee;
  const trainings = record?.trainings || [];
  const contracts = record?.contracts || [];
  const workflows = record?.workflows || [];
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const clearStatus = () => {
    setStatusMessage(null);
    setErrorMessage(null);
  };

  useEffect(() => {
    const loadRecord = async () => {
      setIsLoading(true);
      try {
        const data = await peopleService.getEmployee360(
          session.tenant_id,
          employeeId,
          session,
        );
        setRecord(data);
      } catch (err) {
        setErrorMessage("Failed to load employee record.");
      } finally {
        setIsLoading(false);
      }
    };
    if (employeeId) {
      loadRecord();
    }
  }, [session.tenant_id, session, employeeId]);

  useEffect(() => {
    const loadOrg = async () => {
      try {
        const [depts, locs] = await Promise.all([
          staffService.listDepartments(session.tenant_id, session),
          hrService.listLocations(session.tenant_id, session),
        ]);
        setAvailableDepts(depts);
        setAvailableLocations(locs);
      } catch (err) {
        console.warn("Failed to load organizational hierarchy.");
      }
    };
    if (actionOpen) {
      loadOrg();
    }
  }, [actionOpen, session]);

  useEffect(() => {
    const loadRetail = async () => {
      if (!record?.employee?.locationId) return;
      try {
        const shifts = await retailService.listShifts(session.tenant_id, session, {
          employee_id: employeeId,
          limit: 10,
        });
        setRetailShifts(shifts);
        const active = shifts.find((s) => s.status === "open");
        if (active) setActiveShift(active);
      } catch (e) {
        console.error("Failed to load retail history", e);
      }
    };
    if (record) {
      loadRetail();
    }
  }, [record, session, employeeId]);

  const isRetailStaff = useMemo(() => {
    return record?.employee?.locationId?.toLowerCase().includes("store") ||
           record?.employee?.roleTitle?.toLowerCase().includes("cashier") ||
           record?.employee?.roleTitle?.toLowerCase().includes("store manager");
  }, [record]);

  const filteredAttendance = useMemo(() => {
    const data = Array.isArray(record?.attendance) ? record.attendance : [];
    return data.filter((r: any) =>
      r.status?.toLowerCase().includes(listSearch.toLowerCase()) ||
      r.date?.toLowerCase().includes(listSearch.toLowerCase())
    );
  }, [record, listSearch]);

  const filteredPayroll = useMemo(() => {
    const data = Array.isArray(record?.payrollRuns) ? record.payrollRuns : [];
    return data.filter((r: any) =>
      r.periodStart?.toLowerCase().includes(listSearch.toLowerCase()) ||
      r.status?.toLowerCase().includes(listSearch.toLowerCase())
    );
  }, [record, listSearch]);

  const filteredContracts = useMemo(() => {
    const data = Array.isArray(record?.contracts) ? record.contracts : [];
    return data.filter((r: any) =>
      r.title?.toLowerCase().includes(listSearch.toLowerCase()) ||
      r.status?.toLowerCase().includes(listSearch.toLowerCase())
    );
  }, [record, listSearch]);

  const filteredReviews = useMemo(() => {
    const data = Array.isArray(record?.reviews) ? record.reviews : [];
    return data.filter((r: any) =>
      r.title?.toLowerCase().includes(listSearch.toLowerCase()) ||
      r.status?.toLowerCase().includes(listSearch.toLowerCase())
    );
  }, [record, listSearch]);

  if (isLoading || !employee) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FeedbackAlert
        message={statusMessage}
        error={errorMessage}
        onClear={clearStatus}
      />
      <PageHeader
        title={`PeopleCore - ${employee.fullName}`}
        subtitle={`${employee.roleTitle} - ${employee.departmentId}`}
        primaryAction={
          <ZenTooltip content="Start a professional workflow sequence.">
            <Button onClick={() => setDialogOpen(true)} className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              Initialize FlowGate
            </Button>
          </ZenTooltip>
        }
        secondaryActions={
          <div className="flex gap-2">
             {isRetailStaff && (
               <Badge className="bg-warning text-warning border-warning flex items-center gap-1">
                 <Store className="h-3 w-3" /> Retail Workforce
               </Badge>
             )}
             <Input placeholder="Search within record" className="min-w-[200px]" />
          </div>
        }
      />

      <WorkspacePanel
        title="WorkQueue"
        description="Priority operational actions for this lifecycle."
      >
        <div className="flex flex-wrap gap-2">
          <ZenTooltip content="Create a custom multi-step approval request.">
             <Button variant="outline" onClick={() => setDialogOpen(true)}>
                New Request
             </Button>
          </ZenTooltip>

          <ZenTooltip content="Escalate this record to Administrative Oversight.">
            <Button
              variant="outline"
              disabled={isProcessing}
              onClick={async () => {
                setIsProcessing(true);
                try {
                  await workflowService.createRequest(employee.tenantId, session, {
                    entityType: "PERSONNEL_ESCALATION",
                    entityId: employee.id,
                    makerDept: session.department_id || "MGMT",
                    destinationDept: "ADMIN",
                    notes: "Automated administrative escalation from PeopleCore.",
                  });
                  setStatusMessage("Administrative escalation indexed.");
                } catch (err) {
                  setErrorMessage("Failed to initiate escalation.");
                } finally {
                  setIsProcessing(false);
                }
              }}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Escalate to Admin"}
            </Button>
          </ZenTooltip>

          <ZenTooltip content="Route this profile to the HR FlowGate for review.">
            <Button
              variant="outline"
              disabled={isProcessing}
              onClick={async () => {
                setIsProcessing(true);
                try {
                  await workflowService.createRequest(employee.tenantId, session, {
                    entityType: "PERFORMANCE",
                    entityId: employee.id,
                    makerDept: session.department_id,
                    destinationDept: "HR",
                    notes: "PeopleCore routing",
                  });
                  setStatusMessage("Routed to HR FlowGate.");
                } catch (err) {
                  setErrorMessage("Routing failed.");
                } finally {
                  setIsProcessing(false);
                }
              }}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Route to HR"}
            </Button>
          </ZenTooltip>
          <Button
            variant="outline"
            onClick={() => {
              setEditForm({
                roleTitle: employee.roleTitle,
                departmentId: employee.departmentId,
                locationId: employee.locationId,
                status: employee.status,
              });
              setEditOpen(true);
            }}
          >
            Edit Profile
          </Button>
          <ZenTooltip content="Transfer this professional to a different organizational department.">
            <Button
              variant="outline"
              className="border-primary text-primary hover:bg-primary"
              onClick={() => {
                setTargetDept(employee.departmentId);
                setActionType("MOVE");
                setActionOpen(true);
              }}
            >
              Transfer Department
            </Button>
          </ZenTooltip>

          <ZenTooltip content="Promote this professional to a new rank or roleTitle.">
            <Button
              variant="outline"
              className="border-success text-success hover:bg-success"
              onClick={() => {
                setNewRole(employee.roleTitle);
                setNewSalary(employee.baseSalary);
                setActionType("PROMOTE");
                setActionOpen(true);
              }}
            >
              Update Role/Rank
            </Button>
          </ZenTooltip>

          <ZenTooltip content="Place this record under temporary suspension for administrative reasons.">
            <Button
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive"
              onClick={() => {
                setActionType("SUSPEND");
                setActionOpen(true);
              }}
            >
              Suspend Record
            </Button>
          </ZenTooltip>

          <ZenTooltip content="Remove active status from this professional's record.">
            <Button
              variant="outline"
              className="border-warning text-warning hover:bg-warning"
              onClick={() => {
                setActionType("REMOVE");
                setActionOpen(true);
              }}
            >
              Deactivate Record
            </Button>
          </ZenTooltip>

          <ZenTooltip content="Finalize the permanent cessation of employment for this record.">
            <Button
              variant="destructive"
              onClick={() => {
                setActionType("TERMINATE");
                setActionOpen(true);
              }}
            >
              Finalize Termination
            </Button>
          </ZenTooltip>
        </div>
      </WorkspacePanel>

      <WorkspacePanel
        title="Active Records"
        description="Employee 360 timeline."
      >
        <FilterBar
          searchPlaceholder="Search records"
          searchValue={listSearch}
          onSearchChange={setListSearch}
          onReset={() => setListSearch("")}
        />
        <Tabs defaultValue="identity">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="identity">Identity</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="payroll">Payroll</TabsTrigger>
            <TabsTrigger value="contracts">Contracts</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            {isRetailStaff && <TabsTrigger value="retail">Retail Ops</TabsTrigger>}
          </TabsList>

          <TabsContent value="retail">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                 <div className="rounded-lg border p-4">
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Shift Status</p>
                    {activeShift ? (
                      <div className="flex items-center gap-2 text-success">
                         <Zap className="h-4 w-4" />
                         <span className="text-sm font-medium">Active Shift at Store {activeShift.storeId}</span>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No active retail shift.</p>
                    )}
                 </div>
                 <div className="rounded-lg border p-4">
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Historical Shifts</p>
                    <p className="text-2xl font-bold">{retailShifts.length}</p>
                    <p className="text-xs text-muted-foreground">Recorded shifts in this tenant.</p>
                 </div>
              </div>
              
              <DataTableShell
                title="Shift History"
                total={retailShifts.length}
                page={1}
                pageSize={10}
              >
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-3 text-left">Store</th>
                      <th className="p-3 text-left">Opened</th>
                      <th className="p-3 text-left">Closed</th>
                      <th className="p-3 text-right">Cash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(retailShifts) ? retailShifts : []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-0">
                          <EmptyState
                            title="No retail shifts"
                            description="No recorded retail shifts for this employee in the current tenant."
                          />
                        </td>
                      </tr>
                    ) : (
                      (Array.isArray(retailShifts) ? retailShifts : []).map((shift) => (
                      <tr key={shift.id} className="border-t">
                        <td className="p-3 font-medium">{safeText(shift.storeId)}</td>
                        <td className="p-3 text-xs">{formatDateTime(shift.openingTime)}</td>
                        <td className="p-3 text-xs">{shift.closingTime ? formatDateTime(shift.closingTime) : "ACTIVE"}</td>
                        <td className="p-3 text-right text-xs">
                           {formatCurrency(shift.openingCash)} {"->"} {shift.closingCash != null ? formatCurrency(shift.closingCash) : "--"}
                        </td>
                      </tr>
                    ))
                    )}
                  </tbody>
                </table>
              </DataTableShell>
            </div>
          </TabsContent>

          <TabsContent value="identity">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-4 text-sm">
                <p className="font-semibold text-foreground">Employment</p>
                <p className="text-muted-foreground">
                  Employee code: {safeText(employee.employeeCode)}
                </p>
                <p className="text-muted-foreground">
                  Location: {safeText(employee.locationId)}
                </p>
                <p className="text-muted-foreground">
                  Hire date: {formatDate(employee.hireDate)}
                </p>
              </div>
              <div className="rounded-lg border p-4 text-sm">
                <p className="font-semibold text-foreground">Compensation</p>
                <p className="text-muted-foreground">
                  Base salary: {formatCurrency(employee.baseSalary)}
                </p>
                <p className="text-muted-foreground">
                  Hourly rate: {formatCurrency(employee.hourlyRate)}
                </p>
                <p className="text-muted-foreground">
                  Status: {safeText(employee.status)}
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="attendance">
            <DataTableShell
              total={filteredAttendance.length}
              page={1}
              pageSize={10}
            >
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendance.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-0">
                        <EmptyState
                          title="No attendance records"
                          description="No attendance entries match the current search for this employee."
                        />
                      </td>
                    </tr>
                  ) : (
                    (Array.isArray(filteredAttendance) ? filteredAttendance : []).map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-t cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        setSelectedDetail({ type: "Attendance", data: entry })
                      }
                    >
                      <td className="p-3">{formatDate(entry.date)}</td>
                      <td className="p-3">{safeText(entry.status)}</td>
                      <td className="p-3 text-muted-foreground">
                        {(entry as any).notes ?? "--"}
                      </td>
                    </tr>
                  ))
                  )}
                </tbody>
              </table>
            </DataTableShell>
          </TabsContent>

          <TabsContent value="payroll">
            <DataTableShell
              total={filteredPayroll.length}
              page={1}
              pageSize={10}
            >
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Period</th>
                    <th className="p-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayroll.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="p-0">
                        <EmptyState
                          title="No payroll periods"
                          description="No payroll periods match the current search for this employee."
                        />
                      </td>
                    </tr>
                  ) : (
                    (Array.isArray(filteredPayroll) ? filteredPayroll : []).map((run) => (
                    <tr
                      key={run.id}
                      className="border-t cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        setSelectedDetail({ type: "Payroll Period", data: run })
                      }
                    >
                      <td className="p-3">
                        {formatDate(run.periodStart)} - {formatDate(run.periodEnd)}
                      </td>
                      <td className="p-3">{safeText(run.status)}</td>
                    </tr>
                  ))
                  )}
                </tbody>
              </table>
            </DataTableShell>
          </TabsContent>

          <TabsContent value="contracts">
            <DataTableShell
              total={filteredContracts.length}
              page={1}
              pageSize={10}
            >
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Contract</th>
                    <th className="p-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContracts.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="p-0">
                        <EmptyState
                          title="No contracts"
                          description="No contracts match the current search for this employee."
                        />
                      </td>
                    </tr>
                  ) : (
                    (Array.isArray(filteredContracts) ? filteredContracts : []).map((contract) => (
                    <tr
                      key={contract.id}
                      className="border-t cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        setSelectedDetail({ type: "Contract", data: contract })
                      }
                    >
                      <td className="p-3">{safeText(contract.title)}</td>
                      <td className="p-3">{safeText(contract.status)}</td>
                    </tr>
                  ))
                  )}
                </tbody>
              </table>
            </DataTableShell>
          </TabsContent>

          <TabsContent value="performance">
            <DataTableShell
              total={filteredReviews.length}
              page={1}
              pageSize={10}
            >
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Cycle</th>
                    <th className="p-3 text-left">Score</th>
                    <th className="p-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReviews.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-0">
                        <EmptyState
                          title="No performance reviews"
                          description="No performance reviews match the current search for this employee."
                        />
                      </td>
                    </tr>
                  ) : (
                    (Array.isArray(filteredReviews) ? filteredReviews : []).map((review) => (
                    <tr
                      key={review.id}
                      className="border-t cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        setSelectedDetail({
                          type: "Performance Review",
                          data: review,
                        })
                      }
                    >
                      <td className="p-3">{review.cycleId}</td>
                      <td className="p-3">{review.score ?? "-"}</td>
                      <td className="p-3">{review.status}</td>
                    </tr>
                  ))
                  )}
                </tbody>
              </table>
            </DataTableShell>
          </TabsContent>
        </Tabs>
      </WorkspacePanel>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <WorkspacePanel
          title="Pending Approvals"
          description="Workflow requests tied to this employee."
        >
          <div className="space-y-3">
            {(Array.isArray(workflows) ? workflows : []).map((flow) => (
              <div
                key={flow.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {flow.entityType}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cycle {flow.cycle}
                  </p>
                </div>
                <ApprovalStatusBadge status={flow.status} />
              </div>
            ))}
          </div>
        </WorkspacePanel>

        <WorkspacePanel
          title="Insights"
          description="Performance and compliance signals."
        >
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Training assignments</span>
              <span className="font-semibold text-foreground">
                {trainings.length}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Open contracts</span>
              <span className="font-semibold text-foreground">
                {contracts.length}
              </span>
            </div>
          </div>
        </WorkspacePanel>
      </div>

      <WorkspacePanel
        title="Activity Stream"
        description="Comments, mentions, and audit context."
      >
        <ActivityThread
          tenantId={session.tenant_id}
          entityType="employee"
          entityId={employee.id}
          actorId={session.user_id}
        />
      </WorkspacePanel>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden" aria-describedby="workflow-request-description">
          <DialogHeader className="sr-only">
            <DialogTitle>Create Workflow Request</DialogTitle>
          </DialogHeader>
          <div id="workflow-request-description" className="sr-only">Form to initiate a new HR workflow case.</div>
          <div className="grid md:grid-cols-[1fr_2fr]">
            <div className="bg-muted p-6 flex flex-col justify-between">
              <div>
                <Network className="w-8 h-8 text-primary mb-4" />
                <DialogTitle className="text-xl mb-2">Create Workflow Request</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Initiate a structured workflow involving this employee, such as a performance review or contract renewal.
                </p>
              </div>
              <div className="bg-primary/5 p-4 rounded-lg mt-8 border border-primary/10">
                <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                  <Info className="w-4 h-4" /> Cross-Department Routing
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Requests are seamlessly routed to destination FlowGates.
                </p>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <Select
                  value={workflowType}
                  onValueChange={(value) =>
                    setWorkflowType(value as typeof workflowType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Request type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERFORMANCE">Performance</SelectItem>
                    <SelectItem value="PAYROLL">Payroll</SelectItem>
                    <SelectItem value="CONTRACT">Contract</SelectItem>
                    <SelectItem value="TRAINING">Training</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={destinationDept} onValueChange={setDestinationDept}>
                  <SelectTrigger>
                    <SelectValue placeholder="Destination dept" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HR">HR</SelectItem>
                    <SelectItem value="FINANCE">Finance</SelectItem>
                    <SelectItem value="LEGAL">Legal</SelectItem>
                    <SelectItem value="OPERATIONS">Operations</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder="Notes for approvers"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
                <div className="flex justify-end pt-4 mt-6 border-t">
                  <Button variant="outline" onClick={() => setDialogOpen(false)} className="mr-3">Cancel</Button>
                  <Button
                    disabled={isProcessing}
                    onClick={async () => {
                      setIsProcessing(true);
                      try {
                        await workflowService.createRequest(session.tenant_id, session, {
                          entityType: workflowType,
                          entityId: employee.id,
                          makerDept: session.department_id,
                          destinationDept,
                          notes,
                        });
                        setStatusMessage(
                          `Workflow request for ${workflowType} initialized.`,
                        );
                        setNotes("");
                        setDialogOpen(false);
                      } catch (err) {
                        setErrorMessage("Failed to create workflow request.");
                      }
                    }}
                  >
                    Send to FlowGate
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Edit Employee Profile</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <Input
              placeholder="Role title"
              value={editForm.roleTitle}
              onChange={(event) =>
                setEditForm((prev) => ({
                  ...prev,
                  roleTitle: event.target.value,
                }))
              }
            />
            <Input
              placeholder="Department ID"
              value={editForm.departmentId}
              onChange={(event) =>
                setEditForm((prev) => ({
                  ...prev,
                  departmentId: event.target.value,
                }))
              }
            />
            <Input
              placeholder="Location"
              value={editForm.locationId}
              onChange={(event) =>
                setEditForm((prev) => ({
                  ...prev,
                  locationId: event.target.value,
                }))
              }
            />
            <Select
              value={editForm.status}
              onValueChange={(value) =>
                setEditForm((prev) => ({ ...prev, status: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on_leave">On leave</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
            <Button
              disabled={isProcessing}
              onClick={async () => {
                setIsProcessing(true);
                try {
                  await staffService.updateEmployee(
                    session.tenant_id,
                    session,
                    employee.id,
                    {
                      roleTitle: editForm.roleTitle || employee.roleTitle,
                      departmentId:
                        editForm.departmentId || employee.departmentId,
                      locationId: editForm.locationId || employee.locationId,
                      status: editForm.status as typeof employee.status,
                    },
                  );
                  setEditOpen(false);
                  setStatusMessage("Employee profile updated successfully.");
                } catch (err) {
                  setErrorMessage("Failed to update employee profile.");
                } finally {
                  setIsProcessing(false);
                }
              }}
            >
              {isProcessing ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={!!selectedDetail}
        onOpenChange={() => setSelectedDetail(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedDetail?.type} Detail</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 text-sm gap-y-2">
              <span className="text-muted-foreground">Record ID:</span>
              <span className="font-mono">{selectedDetail?.data.id}</span>
              <span className="text-muted-foreground">Status:</span>
              <span>
                <ApprovalStatusBadge
                  status={selectedDetail?.data.status || "UNKNOWN"}
                />
              </span>
              {selectedDetail?.type === "Performance Review" && (
                <>
                  <span className="text-muted-foreground">Cycle:</span>
                  <span>{selectedDetail?.data.cycleId}</span>
                  <span className="text-muted-foreground">Score:</span>
                  <span className="font-bold">
                    {selectedDetail?.data.score ?? "Not yet scored"}
                  </span>
                </>
              )}
              {selectedDetail?.type === "Attendance" && (
                <>
                  <span className="text-muted-foreground">Date:</span>
                  <span>{formatDate(selectedDetail?.data.date)}</span>
                </>
              )}
            </div>
            <div className="border-t pt-2 text-xs text-muted-foreground">
              <p>
                This is a historical record from the PeopleCore data layer. For
                detailed audit logs, check the Activity Stream.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden" aria-describedby="personnel-action-description">
          <DialogHeader className="sr-only">
            <DialogTitle>Personnel Action</DialogTitle>
          </DialogHeader>
          <div id="personnel-action-description" className="sr-only">Execute a structural personnel action.</div>
          <div className="grid md:grid-cols-[1fr_2fr] min-h-[400px]">
            <div className="bg-muted p-6 flex flex-col justify-between">
              <div>
                <UserCog className="w-8 h-8 text-primary mb-4" />
                <DialogTitle className="text-xl mb-2">
                  {actionType === "MOVE" && "Department Transfer"}
                  {actionType === "PROMOTE" && "Rank Promotion"}
                  {actionType === "SUSPEND" && "Administrative Suspension"}
                  {actionType === "REMOVE" && "Record Deactivation"}
                  {actionType === "TERMINATE" && "Final Termination"}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {actionType === "MOVE" && "Step-by-step organizational relocation wizard."}
                  {actionType === "PROMOTE" && "Guided career advancement and compensation flow."}
                  {!(actionType === "MOVE" || actionType === "PROMOTE") && "Apply a structural lifecycle action to this record."}
                </p>
                
                {(actionType === "MOVE" || actionType === "PROMOTE") && (
                  <div className="mt-8 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${wizardStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-background border'}`}>1</div>
                      <span className={`text-xs ${wizardStep === 1 ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                        {actionType === "MOVE" ? "Structure" : "New Role"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${wizardStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-background border'}`}>2</div>
                      <span className={`text-xs ${wizardStep === 2 ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                        {actionType === "MOVE" ? "Site" : "Compensation"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${wizardStep >= 3 ? 'bg-primary text-primary-foreground' : 'bg-background border'}`}>3</div>
                      <span className={`text-xs ${wizardStep === 3 ? 'font-bold text-primary' : 'text-muted-foreground'}`}>Review</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-primary/5 p-4 rounded-lg mt-8 border border-primary/10">
                <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                  <Info className="w-4 h-4" /> Audit Bound
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Structural changes create immutable audit trails in the Event Store.
                </p>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {actionType === "MOVE" && wizardStep === 1 && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Network className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold">Select Target Department</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {(Array.isArray(availableDepts) ? availableDepts : []).map(dept => (
                        <div 
                          key={dept.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted ${targetDept === dept.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''}`}
                          onClick={() => setTargetDept(dept.id)}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{dept.name}</span>
                            {targetDept === dept.id && <Check className="w-4 h-4 text-primary" />}
                          </div>
                          <p className="text-[10px] text-muted-foreground uppercase">{dept.code}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {actionType === "MOVE" && wizardStep === 2 && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-5 h-5 text-warning" />
                      <h3 className="font-semibold">Select Work Location</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {(Array.isArray(availableLocations) ? availableLocations : []).map(loc => (
                        <div 
                          key={loc.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted ${targetLocation === loc.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''}`}
                          onClick={() => setTargetLocation(loc.id)}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{loc.name}</span>
                            {targetLocation === loc.id && <Check className="w-4 h-4 text-primary" />}
                          </div>
                          <p className="text-[10px] text-muted-foreground uppercase">{loc.type} - {loc.code}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {actionType === "PROMOTE" && wizardStep === 1 && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Briefcase className="w-5 h-5 text-success" />
                      <h3 className="font-semibold">New Professional Grade</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">Functional Title</label>
                        <Input 
                          placeholder="e.g. Senior Regional Lead"
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value)}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground bg-muted p-3 rounded italic">
                        Promotion events automatically trigger IT rank reassignment and Finance budget updates.
                      </p>
                    </div>
                  </div>
                )}

                {actionType === "PROMOTE" && wizardStep === 2 && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="w-5 h-5 text-warning" />
                      <h3 className="font-semibold">Compensation Adjustment</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">New Base Salary ({employee.currency || 'USD'})</label>
                        <Input 
                          type="number"
                          placeholder="0.00"
                          value={newSalary}
                          onChange={(e) => setNewSalary(Number(e.target.value))}
                        />
                      </div>
                      <div className="rounded-lg border bg-warning p-4 border-warning">
                         <div className="flex justify-between text-xs mb-1">
                            <span>Current Salary</span>
                            <span className="font-mono">{formatCurrency(employee.baseSalary)}</span>
                         </div>
                         <div className="flex justify-between text-xs font-bold text-warning">
                            <span>Projected Increase</span>
                            <span>{newSalary !== undefined ? formatCurrency(newSalary - (employee.baseSalary || 0)) : '--'}</span>
                         </div>
                      </div>
                    </div>
                  </div>
                )}

                {((actionType === "MOVE" || actionType === "PROMOTE") && wizardStep === 3) || !(actionType === "MOVE" || actionType === "PROMOTE") ? (
                  <div className="space-y-4 animate-in fade-in zoom-in-95">
                    <div className="flex justify-between items-start">
                       <h3 className="font-semibold">Final Review & Audit</h3>
                       <Badge variant="outline" className="text-[10px]">VERIFICATION_PENDING</Badge>
                    </div>
                    
                    {actionType === "MOVE" && (
                       <div className="bg-muted/50 p-3 rounded-lg text-xs space-y-1">
                          <p><strong>Department:</strong> {availableDepts.find(d => d.id === targetDept)?.name}</p>
                          <p><strong>Location:</strong> {availableLocations.find(l => l.id === targetLocation)?.name}</p>
                       </div>
                    )}

                    {actionType === "PROMOTE" && (
                       <div className="bg-muted/50 p-3 rounded-lg text-xs space-y-1">
                          <p><strong>Role:</strong> {newRole}</p>
                          <p><strong>Salary:</strong> {formatCurrency(newSalary)}</p>
                       </div>
                    )}
                  </div>
                ) : null}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reason for Action</label>
                  <Textarea
                    placeholder="Required notes for audit and approval chain..."
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                  />
                </div>
                <div className="flex justify-end pt-4 mt-6 border-t gap-3">
                  <Button variant="outline" onClick={() => setActionOpen(false)}>Cancel</Button>
                  <Button
                    variant={actionType === "TERMINATE" ? "destructive" : "default"}
                    disabled={isProcessing}
                    onClick={async () => {
                      if (!actionReason && wizardStep === 3) {
                        setErrorMessage("Reason is required for personnel actions.");
                        return;
                      }

                      if ((actionType === "MOVE" || actionType === "PROMOTE") && wizardStep < 3) {
                        setWizardStep(wizardStep + 1);
                        return;
                      }

                      setIsProcessing(true);
                      try {
                        if (actionType === "MOVE") {
                          await staffService.requestTransfer(
                            employee.tenantId,
                            session,
                            employee.id,
                            targetDept,
                            actionReason,
                          );
                          setStatusMessage(`Transfer request for ${employee.fullName} initiated.`);
                        } else if (actionType === "PROMOTE") {
                          await staffService.promoteEmployee(
                            employee.tenantId,
                            session,
                            employee.id,
                            {
                              newRoleTitle: newRole,
                              newBaseSalary: newSalary,
                              notes: actionReason,
                            },
                          );
                          setStatusMessage(`Promotion for ${employee.fullName} to ${newRole} triggered.`);
                        } else if (actionType === "SUSPEND") {
                          await staffService.suspendEmployee(
                            employee.tenantId,
                            session,
                            employee.id,
                            actionReason,
                          );
                          setStatusMessage(`${employee.fullName} record suspended for administrative review.`);
                        } else if (actionType === "REMOVE") {
                          await staffService.updateEmployee(
                            employee.tenantId,
                            session,
                            employee.id,
                            { status: "inactive" },
                          );
                          setStatusMessage(`${employee.fullName} record deactivated.`);
                        } else if (actionType === "TERMINATE") {
                          await staffService.requestTermination(
                            employee.tenantId,
                            session,
                            employee.id,
                            actionReason,
                          );
                          setStatusMessage(`Termination workflow triggered for ${employee.fullName}.`);
                        }
                        setActionOpen(false);
                        setActionReason("");
                        setWizardStep(1);
                      } catch (err: any) {
                        setErrorMessage(err.message || "Personnel action failed.");
                      } finally {
                        setIsProcessing(false);
                      }
                    }}
                  >
                    {isProcessing ? "Processing..." : wizardStep < 3 && (actionType === "MOVE" || actionType === "PROMOTE") ? "Next Step" : "Submit for Approval"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
