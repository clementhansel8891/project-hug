import { useCallback, useMemo, useState, useEffect } from "react";
import { type Employee } from "@/core/types/hr/employee";
import { type Department } from "@/core/services/hr/orgService";
import { type TrainingProgram } from "@/core/types/hr/training";
import { useNavigate } from "react-router-dom";
import { ZenTooltip } from "@/core/ui/ZenTooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserPlus, Building2, Info, Loader2 } from "lucide-react";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { DataTableShell } from "@/core/tools/DataTableShell";
import { FilterBar } from "@/core/tools/FilterBar";
import { useSession } from "@/core/security/session";
import { peopleService } from "@/core/services/hr/peopleService";
import { staffService } from "@/core/services/hr/staffService";
import { trainingService } from "@/core/services/hr/trainingService";
import { apiRequest } from "@/core/api/apiClient";
import { useBackgroundRefresh } from "@/core/runtime/events/useBackgroundRefresh";
import { EmptyState } from "@/components/shared/AsyncState";
import { safeText } from "@/lib/format";
import { CreateShiftTemplateModal, AssignShiftStaffModal, SwapShiftModal } from "./modals";

export default function RosterGrid() {
  const session = useSession();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [roleTitle, setRoleTitle] = useState<string>("all");
  const [version, setVersion] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [shiftTemplateOpen, setShiftTemplateOpen] = useState(false);
  const [assignShiftOpen, setAssignShiftOpen] = useState(false);
  const [swapShiftOpen, setSwapShiftOpen] = useState(false);
  const [actionType, setActionType] = useState<"training" | "review" | "payroll" | "import">("training");
  const [actionEmployeeId, setActionEmployeeId] = useState("");
  const [actionProgramId, setActionProgramId] = useState("");
  const [actionNotes, setActionNotes] = useState("");
  const [importSource, setImportSource] = useState("CSV upload");
  const [editEmployeeId, setEditEmployeeId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    departmentId: "",
    locationId: "",
    roleTitle: "",
    status: "active",
    employmentType: "full_time",
    baseSalary: "0",
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const refresh = useCallback(() => setVersion((prev) => prev + 1), []);
  useBackgroundRefresh(refresh, 20000);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [roleTitles, setRoleTitles] = useState<string[]>([]);
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [staff, setStaff] = useState<{ items: Employee[]; total: number; page: number; pageSize: number }>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 10
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [focusedRecord, setFocusedRecord] = useState<any>(null);
  const [focusedEmployee, setFocusedEmployee] = useState<any>(null);

  const statusOptions = useMemo(() => staffService.getStatusOptions(), []);

  // Load initial filters
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [depts, locs, progs] = await Promise.all([
          staffService.listDepartments(session.tenant_id, session),
          apiRequest<any[]>("/v1/hr/locations", "GET", session),
          trainingService.listPrograms(session.tenant_id, session),
        ]);
        setDepartments(depts);
        setLocations(locs || []);
        setPrograms(progs);
      } catch (err) {
        console.error("Failed to load filters", err);
      }
    };
    loadFilters();
  }, [session.tenant_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load staff list
  useEffect(() => {
    const loadStaff = async () => {
      setIsLoading(true);
      try {
        const result = await staffService.listStaff(
          session.tenant_id,
          session,
          { search, departmentId: department, status: status as "all", roleTitle },
          { page, pageSize: 10 },
        );
        setStaff(result);
        // Derive role titles from current employee list
        const roles = new Set((Array.isArray(result.items) ? result.items : []).map((e: Employee) => e.roleTitle).filter(Boolean));
        setRoleTitles(Array.from(roles) as string[]);
      } catch (err) {
        setErrorMessage("Failed to load staff list.");
      } finally {
        setIsLoading(false);
      }
    };
    loadStaff();
  }, [session.tenant_id, search, department, status, roleTitle, page, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenDetail = async (employee: Employee) => {
    navigate(`/core/hr/people/${employee.id}`);
  };

  const selectedEmployee = useMemo(
    () => staff.items.find((emp) => emp.id === editEmployeeId) ?? null,
    [staff.items, editEmployeeId],
  );

  const resetForm = () =>
    setForm({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      departmentId: departments[0]?.id || "",
      locationId: locations[0]?.id || "none",
      roleTitle: "",
      status: "active",
      employmentType: "full_time",
      baseSalary: "0",
    });

  const flash = (msg: string, isError = false) => {
    if (isError) {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 5000);
    } else {
      setStatusMessage(msg);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleCreateEmployee = async () => {
    if (!form.firstName || !form.lastName || !form.email) {
      flash("First name, last name and email are required.", true);
      return;
    }
    if (!form.departmentId) {
      flash("Please select a department.", true);
      return;
    }
    setIsSaving(true);
    try {
      await staffService.createEmployee(session.tenant_id, session, {
        employeeCode: `EMP-${Date.now()}`,
        firstName: form.firstName,
        lastName: form.lastName,
        fullName: `${form.firstName} ${form.lastName}`.trim(),
        email: form.email,
        phone: form.phone || undefined,
        departmentId: form.departmentId,
        locationId: form.locationId && form.locationId !== "none" ? form.locationId : "",
        roleTitle: form.roleTitle || "Staff",
        status: form.status as "active",
        employmentType: form.employmentType as "full_time",
        baseSalary: Number(form.baseSalary || "0"),
        hourlyRate: 0,
        hireDate: new Date().toISOString().slice(0, 10),
      } as Omit<Employee, "id" | "tenantId" | "createdAt" | "updatedAt" | "fullName" | "employeeCode"> & { fullName: string; employeeCode: string });
      setCreateOpen(false);
      resetForm();
      refresh();
      flash("New employee record created and provisioned.");
    } catch (err: any) {
      flash(err?.message || "Failed to create employee. Check all required fields.", true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateEmployee = async () => {
    if (!selectedEmployee) return;
    setIsSaving(true);
    const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        fullName: `${form.firstName} ${form.lastName}`.trim(),
        roleTitle: form.roleTitle,
        departmentId: form.departmentId || selectedEmployee.departmentId,
        locationId: form.locationId === "none" ? "" : (form.locationId || selectedEmployee.locationId),
        status: form.status,
        employmentType: form.employmentType,
        baseSalary: Number(form.baseSalary || "0"),
    };
    console.log("[DEBUG] Sending Update Payload:", payload);
    try {
      await staffService.updateEmployee(session.tenant_id, session, selectedEmployee.id, payload);
      setEditOpen(false);
      refresh();
      flash("Employee profile updated.");
    } catch (err: any) {
      flash(err?.message || "Failed to update employee.", true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunAction = async () => {
    setIsSaving(true);
    try {
      if (actionType === "training" && actionEmployeeId && actionProgramId) {
        await trainingService.assignTraining(session.tenant_id, session, {
          employeeId: actionEmployeeId,
          programId: actionProgramId,
        });
        flash("Training program assigned successfully.");
      } else if (actionType === "review" && actionEmployeeId) {
        await staffService.requestPerformanceReview(session.tenant_id, session, actionEmployeeId);
        flash("Performance review flow started.");
      } else if (actionType === "payroll" && actionEmployeeId) {
        await staffService.openPayrollCase(session.tenant_id, session, actionEmployeeId);
        flash("Payroll case opened.");
      } else {
        flash("Please select required fields.", true);
        return;
      }
      setActionNotes("");
      setActionOpen(false);
      refresh();
    } catch (err: any) {
      flash(err?.message || "Action failed.", true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {statusMessage && (
        <div className="rounded-lg bg-success/10 border border-success/30 p-3 text-success text-sm animate-in fade-in slide-in-from-top-1">
          {statusMessage}
        </div>
      )}
      {errorMessage && (
        <div className="rounded-lg bg-destructive border border-destructive/30 p-3 text-destructive text-sm">
          {errorMessage}
        </div>
      )}
      <PageHeader
        title="People Core"
        subtitle="Workforce directory and lifecycle management center."
        primaryAction={
          <ZenTooltip content="Register a new individual into the organizational roster.">
             <Button onClick={() => {
               resetForm();
               setCreateOpen(true);
             }}>Add Professional</Button>
          </ZenTooltip>
        }
        secondaryActions={
          <Input
            placeholder="Search people, role, department"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-w-[220px]"
          />
        }
      />

      <WorkspacePanel title="WorkQueue" description="Priority interventions for the current roster.">
        <div className="flex flex-wrap gap-2">
          <ZenTooltip content="Link a staff member to a structured training program.">
            <Button
              variant="outline"
              onClick={() => {
                setActionType("training");
                setActionEmployeeId(staff.items[0]?.id ?? "");
                setActionProgramId(programs[0]?.id ?? "");
                setActionOpen(true);
              }}
            >
              Initiate Upskilling
            </Button>
          </ZenTooltip>
          <ZenTooltip content="Start a performance review workflow via FlowGate.">
            <Button
              variant="outline"
              onClick={() => {
                setActionType("review");
                setActionEmployeeId(staff.items[0]?.id ?? "");
                setActionOpen(true);
              }}
            >
              Start Growth Cycle
            </Button>
          </ZenTooltip>
          <ZenTooltip content="Resolve specific payroll discrepancies or inquiries.">
            <Button
              variant="outline"
              onClick={() => {
                setActionType("payroll");
                setActionEmployeeId(staff.items[0]?.id ?? "");
                setActionOpen(true);
              }}
            >
              Resolve Payroll Case
            </Button>
          </ZenTooltip>
          <Button
            variant="outline"
            onClick={() => {
              setActionType("import");
              setActionOpen(true);
            }}
          >
            Import Staff CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              staffService.exportStaff(session.tenant_id, session);
              flash("Staff directory exported to CSV.");
            }}
          >
            Export Report
          </Button>
          <Button
            variant="outline"
            onClick={() => setShiftTemplateOpen(true)}
          >
            Create Shift Template
          </Button>
          <Button
            variant="outline"
            onClick={() => setAssignShiftOpen(true)}
          >
            Assign Shift
          </Button>
          <Button
            variant="outline"
            onClick={() => setSwapShiftOpen(true)}
          >
            Swap Shift
          </Button>
        </div>
      </WorkspacePanel>

      <WorkspacePanel title="Active Records" description="Live staff directory.">
        <FilterBar
          searchPlaceholder="Search staff"
          searchValue={search}
          onSearchChange={setSearch}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {(Array.isArray(departments) ? departments : []).map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  {(Array.isArray(statusOptions) ? statusOptions : []).map((option) => (
                    <SelectItem key={option} value={option}>
                      {option.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={roleTitle} onValueChange={setRoleTitle}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Role title" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {(Array.isArray(roleTitles) ? roleTitles : []).map((title) => (
                    <SelectItem key={title} value={title}>
                      {title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
          onReset={() => {
            setSearch("");
            setDepartment("all");
            setStatus("all");
            setRoleTitle("all");
          }}
        />

        <DataTableShell
          title="Staff directory"
          subtitle="Click a row to open PeopleCore."
          total={staff.total}
          page={staff.page}
          pageSize={staff.pageSize}
          onPageChange={setPage}
        >
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Employee</th>
                <th className="p-3 text-left">Role</th>
                <th className="p-3 text-left">Department</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading staff...
                  </td>
                </tr>
              ) : staff.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-0">
                    <EmptyState
                      title="No employees found"
                      description="No staff match the current filters. Adjust your search or add a new professional."
                    />
                  </td>
                </tr>
              ) : (
                (Array.isArray(staff.items) ? staff.items : []).map((employee) => (
                  <tr
                    key={employee.id}
                    className="border-t cursor-pointer hover:bg-muted/30"
                    onClick={() => handleOpenDetail(employee)}
                  >
                    <td className="p-3">
                      <div className="font-medium text-foreground">{safeText(employee.fullName)}</div>
                      <div className="text-xs text-muted-foreground">{safeText(employee.email)}</div>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">{safeText(employee.roleTitle)}</td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {departments.find(d => d.id === employee.departmentId)?.name ?? employee.departmentId}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        employee.status === "active" ? "bg-success/10 text-success" :
                        employee.status === "promoted" ? "bg-primary text-primary" :
                        employee.status === "suspended" ? "bg-warning text-warning" :
                        employee.status === "probation" ? "bg-primary text-primary" :
                        employee.status === "candidate" ? "bg-muted text-muted-foreground" :
                        employee.status === "terminated" ? "bg-destructive text-destructive" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {employee.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div onClick={(event) => event.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline">Actions</Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenDetail(employee)}>
                              View 360 Insight
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/core/portal`)}>
                              Open Personal Portal
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditEmployeeId(employee.id);
                                setForm({
                                  firstName: employee.firstName,
                                  lastName: employee.lastName,
                                  email: employee.email,
                                  phone: employee.phone ?? "",
                                  departmentId: employee.departmentId,
                                  locationId: employee.locationId || "none",
                                  roleTitle: employee.roleTitle,
                                  status: employee.status,
                                  employmentType: employee.employmentType,
                                  baseSalary: String(employee.baseSalary ?? 0),
                                });
                                setEditOpen(true);
                              }}
                            >
                              Edit Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={async () => {
                                try {
                                  await staffService.requestTermination(session.tenant_id, session, employee.id, "RosterGrid request");
                                  flash(`Termination initiated for ${employee.fullName}.`);
                                  refresh();
                                } catch (err: any) {
                                  flash(err?.message || "Failed to terminate.", true);
                                }
                              }}
                            >
                              Request Termination
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </DataTableShell>
      </WorkspacePanel>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.7fr]">
        <WorkspacePanel title="Pending Approvals" description="Open workflow items tied to workforce.">
          <div className="space-y-3 text-sm text-muted-foreground">
            {staff.items.slice(0, 4).map((employee) => (
              <div key={employee.id} className="flex items-center justify-between rounded-lg border p-3">
                <span>{employee.fullName}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await staffService.requestPerformanceReview(session.tenant_id, session, employee.id);
                      flash(`Performance review requested for ${employee.fullName}.`);
                      refresh();
                    } catch (err: any) {
                      flash(err?.message || "Failed to submit review request.", true);
                    }
                  }}
                >
                  Send to FlowGate
                </Button>
              </div>
            ))}
          </div>
        </WorkspacePanel>

        <WorkspacePanel title="Insights" description="Live workforce status snapshot.">
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Total staff</span>
              <span className="font-semibold text-foreground">{staff.total}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Active</span>
              <span className="font-semibold text-foreground">
                {(Array.isArray(staff.items) ? staff.items : []).filter((item) => item.status === "active").length}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Departments</span>
              <span className="font-semibold text-foreground">{departments.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Locations</span>
              <span className="font-semibold text-foreground">{locations.length}</span>
            </div>
          </div>
        </WorkspacePanel>
      </div>


      {/* Create Employee Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden" aria-describedby="employee-create-description">
          <DialogHeader className="sr-only">
            <DialogTitle>Create Employee</DialogTitle>
          </DialogHeader>
          <div id="employee-create-description" className="sr-only">Form to onboard a new employee.</div>
          <div className="grid md:grid-cols-[1fr_2fr]">
            {/* Left Info Panel */}
            <div className="bg-muted p-6 flex flex-col justify-between">
              <div>
                <UserPlus className="w-8 h-8 text-primary mb-4" />
                <DialogTitle className="text-xl mb-2">Create Employee</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Onboard a new employee to the directory. This establishes their core identity and access profile.
                </p>
                <div className="mt-8 space-y-4">
                  <div className="flex items-start gap-3 text-sm">
                    <div className="mt-0.5"><Building2 className="w-4 h-4 text-muted-foreground" /></div>
                    <div>
                      <p className="font-medium">Department Assignment</p>
                      <p className="text-muted-foreground text-xs">Assign to a structural department.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-primary/5 p-4 rounded-lg mt-8 border border-primary/10">
                <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                  <Info className="w-4 h-4" /> IAM Sync
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Automatically provisions base access rights.
                </p>
              </div>
            </div>

            {/* Right Form Panel */}
            <div className="p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">First Name *</label>
                  <Input placeholder="First name" value={form.firstName} onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Last Name *</label>
                  <Input placeholder="Last name" value={form.lastName} onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Email *</label>
                  <Input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Phone</label>
                  <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Department *</label>
                  <Select value={form.departmentId} onValueChange={(value) => setForm((prev) => ({ ...prev, departmentId: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Array.isArray(departments) ? departments : []).map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Location</label>
                  <Select value={form.locationId} onValueChange={(value) => setForm((prev) => ({ ...prev, locationId: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No location</SelectItem>
                      {(Array.isArray(locations) ? locations : []).map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Role Title</label>
                  <Input placeholder="Role title" value={form.roleTitle} onChange={(e) => setForm((prev) => ({ ...prev, roleTitle: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Status</label>
                  <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Array.isArray(statusOptions) ? statusOptions : []).map((option) => (
                        <SelectItem key={option} value={option}>
                          {option.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Employment Type</label>
                  <Select value={form.employmentType} onValueChange={(value) => setForm((prev) => ({ ...prev, employmentType: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Employment type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_time">Full time</SelectItem>
                      <SelectItem value="part_time">Part time</SelectItem>
                      <SelectItem value="contractor">Contractor</SelectItem>
                      <SelectItem value="intern">Intern</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Base Salary</label>
                  <Input placeholder="Base salary" type="number" value={form.baseSalary} onChange={(e) => setForm((prev) => ({ ...prev, baseSalary: e.target.value }))} />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={isSaving}>Cancel</Button>
                <Button onClick={handleCreateEmployee} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Employee
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Employee</SheetTitle>
          </SheetHeader>
          {selectedEmployee ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-1 block">First Name</label>
                  <Input placeholder="First name" value={form.firstName} onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-1 block">Last Name</label>
                  <Input placeholder="Last name" value={form.lastName} onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground mb-1 block">Role Title</label>
                <Input placeholder="Role title" value={form.roleTitle} onChange={(e) => setForm((prev) => ({ ...prev, roleTitle: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground mb-1 block">Department</label>
                <Select value={form.departmentId} onValueChange={(value) => setForm((prev) => ({ ...prev, departmentId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Array.isArray(departments) ? departments : []).map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground mb-1 block">Location</label>
                <Select value={form.locationId} onValueChange={(value) => setForm((prev) => ({ ...prev, locationId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No location</SelectItem>
                    {(Array.isArray(locations) ? locations : []).map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground mb-1 block">Status</label>
                <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Array.isArray(statusOptions) ? statusOptions : []).map((option) => (
                      <SelectItem key={option} value={option}>{option.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground mb-1 block">Employment Type</label>
                <Select value={form.employmentType} onValueChange={(value) => setForm((prev) => ({ ...prev, employmentType: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Employment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full time</SelectItem>
                    <SelectItem value="part_time">Part time</SelectItem>
                    <SelectItem value="contractor">Contractor</SelectItem>
                    <SelectItem value="intern">Intern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground mb-1 block">Base Salary</label>
                <Input placeholder="Base salary" type="number" value={form.baseSalary} onChange={(e) => setForm((prev) => ({ ...prev, baseSalary: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setEditOpen(false)} disabled={isSaving}>Cancel</Button>
                <Button onClick={handleUpdateEmployee} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Changes
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Select a record to edit.
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Quick Action Dialog */}
      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden" aria-describedby="quick-action-description">
          <DialogHeader className="sr-only">
            <DialogTitle>Quick Action</DialogTitle>
          </DialogHeader>
          <div id="quick-action-description" className="sr-only">Execute a quick personnel action.</div>
          <div className="grid md:grid-cols-[1fr_2fr]">
            {/* Left Info Panel */}
            <div className="bg-muted p-6 flex flex-col justify-between">
              <div>
                <Info className="w-8 h-8 text-primary mb-4" />
                <DialogTitle className="text-xl mb-2">Quick Action</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Execute bulk operational HR tasks and workflows.
                </p>
                <div className="mt-8 space-y-4">
                  <div className="flex items-start gap-3 text-sm">
                    <div className="mt-0.5"><Building2 className="w-4 h-4 text-muted-foreground" /></div>
                    <div>
                      <p className="font-medium">Action Routing</p>
                      <p className="text-muted-foreground text-xs">Directly routes to target modules.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-primary/5 p-4 rounded-lg mt-8 border border-primary/10">
                <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                  <Info className="w-4 h-4" /> Policy Enforcement
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Actions are logged for audit compliance.
                </p>
              </div>
            </div>

            {/* Right Form Panel */}
            <div className="p-6">
              <div className="space-y-4">
                {actionType === "import" ? (
                  <>
                    <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Import Source</label>
                    <Input value={importSource} onChange={(e) => setImportSource(e.target.value)} />
                    <div className="flex justify-end pt-4 mt-4 border-t">
                      <Button
                        onClick={() => {
                          staffService.importStaff(session.tenant_id, session, importSource);
                          flash("Staff data import triggered.");
                          setActionOpen(false);
                        }}
                      >
                        Run Import
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Employee</label>
                      <Select value={actionEmployeeId} onValueChange={setActionEmployeeId}>
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
                    </div>
                    {actionType === "training" ? (
                      <div>
                        <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Training Program</label>
                        <Select value={actionProgramId} onValueChange={setActionProgramId}>
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
                      </div>
                    ) : null}
                    <div>
                      <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Notes</label>
                      <Textarea
                        placeholder="Notes"
                        value={actionNotes}
                        onChange={(e) => setActionNotes(e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end pt-4 mt-4 border-t">
                      <Button onClick={handleRunAction} disabled={isSaving}>
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Run Action
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CreateShiftTemplateModal
        isOpen={shiftTemplateOpen}
        onClose={() => setShiftTemplateOpen(false)}
        departments={departments}
        onSuccess={() => refresh()}
      />

      <AssignShiftStaffModal
        isOpen={assignShiftOpen}
        onClose={() => setAssignShiftOpen(false)}
        employees={staff.items.map((e) => ({ id: e.id, fullName: e.fullName }))}
        onSuccess={() => refresh()}
      />

      <SwapShiftModal
        isOpen={swapShiftOpen}
        onClose={() => setSwapShiftOpen(false)}
        employees={staff.items.map((e) => ({ id: e.id, fullName: e.fullName }))}
        onSuccess={() => refresh()}
      />
    </div>
  );
}
