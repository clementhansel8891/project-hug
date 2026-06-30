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
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate week view
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await apiRequest<{ data?: Employee[] } | Employee[]>(`/v1/hr/employees?departmentId=${departmentId}`, "GET", session);
        const data = Array.isArray(response) ? response : (response?.data || []);
        setEmployees(data);

        // Fetch shifts for the selected week
        // Note: Real implementation would query WorkShifts
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
    fetchData();
  }, [departmentId, session]);

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
                    <Select value={departmentId} onValueChange={onDepartmentChange}>
                      <SelectTrigger className="h-6 text-[9px] font-black uppercase tracking-widest bg-muted border-white/5 text-primary w-[140px] rounded-lg hover:bg-muted">
                        <SelectValue placeholder="Switch Department" />
                      </SelectTrigger>
                      <SelectContent className="bg-muted border-white/5">
                        <SelectItem value="HR">HR & Legal</SelectItem>
                        <SelectItem value="FINANCE">Finance</SelectItem>
                        <SelectItem value="IT">IT & Tech</SelectItem>
                        <SelectItem value="MARKETING">Marketing</SelectItem>
                        <SelectItem value="SALES">Sales</SelectItem>
                        <SelectItem value="PROCUREMENT">Procurement</SelectItem>
                        <SelectItem value="INVENTORY">Inventory</SelectItem>
                        <SelectItem value="RETAIL">Retail Ops</SelectItem>
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
                                {(Array.isArray(days) ? days : []).map(day => (
                                    <td key={day.toString()} className="p-2 h-20 group relative">
                                        {/* Mock Shift Card */}
                                        <div className="h-full w-full rounded-lg bg-success border border-success/20 p-2 text-[10px] flex flex-col justify-between group-hover:bg-success cursor-pointer transition-all">
                                            <div className="flex justify-between items-start">
                                                <span className="font-bold text-success">Morning</span>
                                                <Clock className="h-3 w-3 text-success opacity-0 group-hover:opacity-100" />
                                            </div>
                                            <span className="text-success font-medium font-mono">08:00 - 16:00</span>
                                        </div>
                                        
                                        {/* Action Overlay */}
                                        <div className="absolute inset-0 flex items-center justify-center bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </td>
                                ))}
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
