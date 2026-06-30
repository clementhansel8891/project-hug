import { useState, useEffect, useRef } from "react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar as CalendarIcon, 
  Users, 
  Clock, 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  MoreVertical,
  Save,
  Upload,
  Download,
  Loader2
} from "lucide-react";
import { useSession } from "@/core/security/session";
import { apiRequest } from "@/core/api/apiClient";
import { schedulingService } from "@/core/services/hr/schedulingService";
import { toast } from "@/hooks/use-toast";
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  jobRole?: string;
}

interface Shift {
  id: string;
  employeeId: string;
  type: string;
  startTime: string;
  endTime: string;
  date: string;
}

interface WorkforceSchedulerProps {
  departmentId: string;
  title?: string;
  isHR?: boolean;
  onDepartmentChange?: (deptId: string) => void;
}

export function WorkforceScheduler({ 
  departmentId, 
  title = "Team Schedule",
  isHR = false,
  onDepartmentChange
}: WorkforceSchedulerProps) {
  const session = useSession();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate week view
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Resolve real departments once. The `departmentId` prop is often a code
  // (e.g. "HR") that does not match the uuid `department_id` employees carry, so
  // resolve to a real department id: prefer the prop if it's a known id, else
  // the first real department.
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const resp = await apiRequest<{ data?: any[] } | any[]>("/v1/hr/departments", "GET", session);
        const list = Array.isArray(resp) ? resp : (resp?.data || []);
        const norm = list.map((d: any) => ({ id: d.id, name: d.name }));
        setDepartments(norm);
        setSelectedDept((prev) => {
          if (prev && norm.some((d) => d.id === prev)) return prev;
          if (departmentId && norm.some((d) => d.id === departmentId)) return departmentId;
          return norm[0]?.id ?? "";
        });
      } catch {
        // Fall back to the provided departmentId if the lookup fails.
        setSelectedDept(departmentId);
      }
    };
    loadDepartments();
  }, [session]);

  const loadData = async () => {
    if (!selectedDept) return;
    setLoading(true);
    try {
      const [empResponse, assignmentRows] = await Promise.all([
        apiRequest<{ data?: Employee[] } | Employee[]>(`/v1/hr/employees?departmentId=${selectedDept}`, "GET", session),
        apiRequest<any[]>(`/v1/hr/scheduling/assignments`, "GET", session).catch(() => []),
      ]);
      const emps = Array.isArray(empResponse) ? empResponse : (empResponse?.data || []);
      setEmployees(emps);
      setAssignments(Array.isArray(assignmentRows) ? assignmentRows : []);
    } catch (err: unknown) {
      console.error("Failed to load workforce data", err);
      const errMsg = err instanceof Error ? err.message : "Failed to load team data.";
      toast({
        title: "Synchronization Error",
        description: errMsg,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDept, session]);

  // Index assignments by employee + calendar date for O(1) cell lookup.
  // effective_date is stored UTC-midnight, so its ISO date slice is the intended
  // calendar day, matched against each grid day's yyyy-MM-dd.
  const assignmentByCell = new Map<string, any>();
  for (const a of assignments) {
    const empId = a.employee_id ?? a.employeeId;
    const raw = a.effective_date ?? a.effectiveDate;
    if (!empId || !raw) continue;
    const dateKey = typeof raw === "string" ? raw.slice(0, 10) : new Date(raw).toISOString().slice(0, 10);
    assignmentByCell.set(`${empId}|${dateKey}`, a);
  }

  const handlePrevWeek = () => setCurrentDate(addDays(currentDate, -7));
  const handleNextWeek = () => setCurrentDate(addDays(currentDate, 7));

  const handleDownloadTemplate = async () => {
    try {
      await schedulingService.downloadImportTemplate(session);
    } catch (err: any) {
      toast({ title: "Download failed", description: err?.message || "Could not download template", variant: "destructive" });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setIsImporting(true);
    try {
      const result = await schedulingService.importAssignments(session, file);
      const failedNote = result.failed > 0
        ? ` ${result.failed} row(s) skipped${result.errors?.[0] ? `: row ${result.errors[0].row} ${result.errors[0].message}` : ""}.`
        : "";
      toast({
        title: "Schedule imported",
        description: `${result.imported} assignment(s) created.${failedNote}`,
      });
      await loadData();
    } catch (err: any) {
      toast({ title: "Import failed", description: err?.message || "Could not import schedule", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-muted/30 p-4 rounded-xl border border-dashed">
        <div className="flex items-center gap-4">
            <div className="p-2 bg-primary/10 rounded-lg">
                <CalendarIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
                <h3 className="font-bold">{title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground whitespace-nowrap">Week of {format(weekStart, "MMMM dd, yyyy")}</p>
                  {isHR && (
                    <Select value={selectedDept} onValueChange={(val) => { setSelectedDept(val); onDepartmentChange?.(val); }}>
                      <SelectTrigger className="h-6 text-[9px] font-black uppercase tracking-widest bg-muted border-white/5 text-primary w-[180px] rounded-lg hover:bg-muted">
                        <SelectValue placeholder="Switch Department" />
                      </SelectTrigger>
                      <SelectContent className="bg-muted border-white/5">
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImportFile}
            />
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate} title="Download .xlsx schedule template">
                <Download className="h-4 w-4 mr-2" /> Template
            </Button>
            <Button variant="outline" size="sm" disabled={isImporting} onClick={() => fileInputRef.current?.click()} title="Import schedule from .xlsx/.csv">
                {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {isImporting ? "Importing..." : "Import"}
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrevWeek}>
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleNextWeek}>
                <ChevronRight className="h-4 w-4" />
            </Button>
            <Button size="sm" className="bg-primary shadow-lg shadow-primary/20">
                <Plus className="h-4 w-4 mr-2" /> Assign Shift
            </Button>
        </div>
      </div>

      <WorkspacePanel className="p-0 overflow-hidden border-none shadow-xl bg-background/50 backdrop-blur-md">
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="border-b bg-muted/20">
                        <th className="p-4 text-left w-64 border-r sticky left-0 bg-background/95 z-10">Employee</th>
                        {(Array.isArray(days) ? days : []).map(day => (
                            <th key={day.toString()} className="p-4 text-center min-w-[120px]">
                                <div className="text-xs uppercase font-bold text-muted-foreground">
                                    {format(day, "EEE")}
                                </div>
                                <div className={`text-lg font-black mt-1 ${format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") ? 'text-primary' : ''}`}>
                                    {format(day, "dd")}
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                        <tr>
                            <td colSpan={8} className="p-12 text-center text-muted-foreground animate-pulse italic">
                                Loading team schedule...
                            </td>
                        </tr>
                    ) : employees.length === 0 ? (
                        <tr>
                            <td colSpan={8} className="p-12 text-center text-muted-foreground italic">
                                No employees assigned to this department.
                            </td>
                        </tr>
                    ) : (
                        (Array.isArray(employees) ? employees : []).map((emp) => (
                            <tr key={emp.id} className="border-b hover:bg-muted/5 transition-colors">
                                <td className="p-4 border-r sticky left-0 bg-background/95 z-10">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold">
                                            {emp.firstName?.[0]}{emp.lastName?.[0]}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold leading-none">{emp.firstName} {emp.lastName}</p>
                                            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-tighter">{emp.jobRole || "Staff"}</p>
                                        </div>
                                    </div>
                                </td>
                                {(Array.isArray(days) ? days : []).map(day => {
                                    const dateStr = format(day, "yyyy-MM-dd");
                                    const assignment = assignmentByCell.get(`${emp.id}|${dateStr}`);
                                    const shift = assignment?.shifts ?? assignment?.shift;
                                    const locationName = assignment?.locations?.name ?? assignment?.location?.name;
                                    return (
                                      <td key={day.toString()} className="p-2 h-20 group relative">
                                        {shift ? (
                                          <div className="h-full w-full rounded-lg bg-success/15 border border-success/30 p-2 text-[10px] flex flex-col justify-between cursor-pointer transition-all hover:bg-success/25" title={locationName ? `Location: ${locationName}` : undefined}>
                                            <div className="flex justify-between items-start">
                                                <span className="font-bold text-success truncate">{shift.name}</span>
                                                <Clock className="h-3 w-3 text-success opacity-0 group-hover:opacity-100 shrink-0" />
                                            </div>
                                            <span className="text-success font-medium font-mono">{shift.start_time} - {shift.end_time}</span>
                                            {locationName && (
                                              <span className="text-[9px] text-muted-foreground truncate">{locationName}</span>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="h-full w-full rounded-lg border border-dashed border-muted-foreground/15 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                              <Plus className="h-4 w-4 text-muted-foreground" />
                                          </div>
                                        )}
                                      </td>
                                    );
                                })}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </WorkspacePanel>

      <div className="flex justify-end gap-3 mt-4">
          <Button variant="ghost" size="sm" className="text-muted-foreground">Discard Changes</Button>
          <Button size="sm" className="bg-success hover:bg-success">
              <Save className="h-4 w-4 mr-2" /> Publish Schedule
          </Button>
      </div>
    </div>
  );
}
