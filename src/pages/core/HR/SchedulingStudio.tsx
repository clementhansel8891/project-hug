import { useState, useEffect, useMemo, useRef } from "react";
import { useSession } from "@/core/security/session";
import { schedulingService } from "@/core/services/hr/schedulingService";
import { staffService } from "@/core/services/hr/staffService";
import { type Employee } from "@/core/types/hr/employee";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Clock,
  AlertTriangle,
  UserCheck,
  ArrowLeftRight,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  Filter,
  Upload,
  Download,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ZenTooltip } from "@/core/ui/ZenTooltip";
import { format, addDays, startOfWeek, eachDayOfInterval, isSameDay } from "date-fns";
import { ShiftOverrideModal } from "./modals";

export default function SchedulingStudio() {
  const session = useSession();
  const { toast } = useToast();
  const [viewDate, setViewDate] = useState(new Date());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isBypassMode, setIsBypassMode] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ employeeId: string; date: string } | null>(null);
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [rosterData, setRosterData] = useState<Record<string, any>>({});
  const [overrideForm, setOverrideForm] = useState({
    coveringEmployeeId: "",
    reason: "",
  });

  const weekDays = useMemo(() => {
    const start = startOfWeek(viewDate, { weekStartsOn: 1 });
    return eachDayOfInterval({
      start,
      end: addDays(start, 6),
    });
  }, [viewDate]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const staffResult = await staffService.listStaff(session.tenant_id, session, {}, { page: 1, pageSize: 50 });
      setEmployees(staffResult.items);

      // Fetch all roster components for the week
      const newRosterData: Record<string, any> = {};
      
      for (const emp of staffResult.items) {
        newRosterData[emp.id] = {};
        for (const day of weekDays) {
          const dateStr = format(day, "yyyy-MM-dd");
          const schedule = await schedulingService.getDailySchedule(
            session.tenant_id,
            emp.id,
            dateStr,
            session
          );
          newRosterData[emp.id][dateStr] = schedule;
        }
      }
      setRosterData(newRosterData);
    } catch (err) {
      console.error("Failed to load scheduling data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [session.tenant_id, viewDate]);

  const handlePrevWeek = () => setViewDate((prev) => addDays(prev, -7));
  const handleNextWeek = () => setViewDate((prev) => addDays(prev, 7));
  const handleToday = () => setViewDate(new Date());

  const handleDownloadTemplate = async () => {
    try {
      await schedulingService.downloadImportTemplate(session);
    } catch (err: any) {
      toast({ title: "Download failed", description: err?.message || "Could not download template", variant: "destructive" });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      e.target.value = ""; // allow re-selecting the same file later
      setIsImporting(true);
      try {
        const result = await schedulingService.importAssignments(session, file);
        const failedNote = result.failed > 0
          ? ` ${result.failed} row(s) skipped${result.errors?.[0] ? `: row ${result.errors[0].row} ${result.errors[0].message}` : ""}.`
          : "";
        toast({
          title: "Schedule imported",
          description: `${result.imported} assignment(s) created.${failedNote}`,
          variant: result.failed > 0 ? "default" : "default",
        });
        loadData();
      } catch (err: any) {
        toast({ title: "Import failed", description: err?.message || "Could not import schedule", variant: "destructive" });
      } finally {
        setIsImporting(false);
      }
    }
  };

  const handleCellClick = (employeeId: string, date: Date) => {
    setSelectedCell({ employeeId, date: format(date, "yyyy-MM-dd") });
    if (isBypassMode) {
      setIsOverrideOpen(true);
    }
  };

  const submitOverride = async () => {
    if (!selectedCell || !overrideForm.coveringEmployeeId || !overrideForm.reason) return;
    
    try {
      await schedulingService.submitOverride(
        session.tenant_id,
        session,
        selectedCell.employeeId,
        overrideForm.coveringEmployeeId,
        "shift-default", // Simplified for demo
        selectedCell.date,
        overrideForm.reason
      );
      setIsOverrideOpen(false);
      setSelectedCell(null);
      setOverrideForm({ coveringEmployeeId: "", reason: "" });
      loadData(); // Refresh roster
    } catch (err) {
      console.error("Override failed", err);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      <PageHeader
        title="Scheduling Studio"
        subtitle="Manage workforce rosters with high-density visualization and emergency override protocols."
        primaryAction={
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImportFile}
            />
            <ZenTooltip content="Download the .xlsx template (Employee Code/Email, Shift Name, Date, Location Name).">
              <Button variant="outline" onClick={handleDownloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Template
              </Button>
            </ZenTooltip>
            <ZenTooltip content="Bulk-assign employees to shifts from an .xlsx/.csv file.">
              <Button
                variant="outline"
                disabled={isImporting}
                onClick={() => fileInputRef.current?.click()}
              >
                {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {isImporting ? "Importing..." : "Import Schedule"}
              </Button>
            </ZenTooltip>
            <ZenTooltip content="Enable instant manager-authorized shift changes bypassing standard workflow.">
              <Button
                variant={isBypassMode ? "destructive" : "outline"}
                className={`transition-all duration-300 ${isBypassMode ? "ring-2 ring-destructive/20 shadow-lg shadow-destructive/10" : ""}`}
                onClick={() => setIsBypassMode(!isBypassMode)}
              >
                {isBypassMode ? <ShieldAlert className="w-4 h-4 mr-2 animate-pulse" /> : <Clock className="w-4 h-4 mr-2" />}
                {isBypassMode ? "HR Bypass Active" : "Operational Mode"}
              </Button>
            </ZenTooltip>
          </div>
        }
      />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Scheduler */}
        <div className="flex-1 space-y-6">
          <WorkspacePanel 
            title="Roster Grid" 
            headerActions={
              <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
                <Button variant="ghost" size="icon" onClick={handlePrevWeek}><ChevronLeft className="w-4 h-4" /></Button>
                <Button variant="ghost" className="text-xs font-bold px-4" onClick={handleToday}>
                  {format(weekDays[0], "MMM dd")} - {format(weekDays[6], "MMM dd, yyyy")}
                </Button>
                <Button variant="ghost" size="icon" onClick={handleNextWeek}><ChevronRight className="w-4 h-4" /></Button>
              </div>
            }
          >
            <div className="overflow-x-auto rounded-xl border bg-card/50 backdrop-blur-sm shadow-sm relative">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="p-4 text-left border-b sticky left-0 z-10 bg-muted/30 min-w-[200px] backdrop-blur-md">Professional</th>
                    {(Array.isArray(weekDays) ? weekDays : []).map((date) => (
                      <th key={date.toISOString()} className={`p-4 text-center border-b border-l min-w-[140px] ${isSameDay(date, new Date()) ? "bg-primary/5" : ""}`}>
                        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{format(date, "EEE")}</div>
                        <div className={`text-lg font-black ${isSameDay(date, new Date()) ? "text-primary" : ""}`}>{format(date, "dd")}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-muted-foreground italic">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 opacity-50" />
                        Synchronizing workforce data...
                      </td>
                    </tr>
                  ) : (Array.isArray(employees) ? employees : []).map((emp) => (
                    <tr key={emp.id} className="group hover:bg-primary/5 transition-colors duration-150">
                      <td className="p-4 border-b sticky left-0 z-10 bg-card/80 group-hover:bg-primary/5 backdrop-blur-md transition-colors duration-150">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10 shadow-inner">
                            <span className="text-[10px] font-bold text-primary">{emp.fullName?.split(" ").map(n => n[0]).join("") || "?"}</span>
                          </div>
                          <div>
                            <div className="font-semibold text-sm">{emp.fullName}</div>
                            <div className="text-[10px] text-muted-foreground uppercase font-medium">{emp.roleTitle}</div>
                          </div>
                        </div>
                      </td>
                      {(Array.isArray(weekDays) ? weekDays : []).map((date) => {
                        const dateStr = format(date, "yyyy-MM-dd");
                        const data = rosterData[emp.id]?.[dateStr];
                        
                        return (
                          <td 
                            key={date.toISOString()} 
                            className={`p-2 border-b border-l min-h-[80px] transition-all duration-200 cursor-pointer ${isBypassMode ? "hover:bg-destructive/5" : "hover:bg-primary/5"}`}
                            onClick={() => handleCellClick(emp.id, date)}
                          >
                            <div className="h-full flex flex-col justify-center gap-1.5 p-1 rounded-lg border border-transparent hover:border-muted-foreground/10 group-hover:shadow-sm">
                              {data ? (
                                <>
                                  <div className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 ${
                                    data.source === "OVERRIDE" ? "bg-destructive/10 text-destructive border border-destructive/20" :
                                    data.source === "SWAP" ? "bg-primary/10 text-primary border border-primary/20" :
                                    "bg-success text-success border border-success/20"
                                  }`}>
                                    <Clock className="w-3 h-3" /> {data.shift?.startTime} - {data.shift?.endTime}
                                  </div>
                                  <div className="text-[9px] text-muted-foreground flex items-center gap-1 ml-1 font-medium italic">
                                    <UserCheck className="w-2.5 h-2.5 opacity-50" /> {data.source === "OVERRIDE" ? "Override" : data.source === "SWAP" ? "Swapped" : "Assigned"}
                                  </div>
                                </>
                              ) : (
                                <div className="text-[9px] text-muted-foreground text-center py-2 opacity-50">
                                  No Shift
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </WorkspacePanel>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-4 bg-gradient-to-br from-card to-background shadow-none border-dashed flex items-center justify-between group hover:border-primary/50 transition-all duration-300">
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Weekly Coverage</p>
                <p className="text-2xl font-black text-foreground">98.4%</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-success flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Badge className="bg-success hover:bg-success">Optimal</Badge>
              </div>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-card to-background shadow-none border-dashed flex items-center justify-between group hover:border-primary/50 transition-all duration-300">
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Open Shifts</p>
                <p className="text-2xl font-black text-foreground">12</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-warning flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border border-warning/20">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-card to-background shadow-none border-dashed flex items-center justify-between group hover:border-primary/50 transition-all duration-300">
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Pending Swaps</p>
                <p className="text-2xl font-black text-foreground">4</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border border-primary/20">
                <ArrowLeftRight className="w-5 h-5 text-primary" />
              </div>
            </Card>
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="w-full lg:w-80 space-y-6">
          <WorkspacePanel title="Filters" description="Narrow down the perspective.">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5 block">Department</label>
                <Select defaultValue="all">
                  <SelectTrigger className="bg-muted/50 border-none">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    <SelectItem value="it">Information Tech</SelectItem>
                    <SelectItem value="ops">Operations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5 block">Shift Category</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="text-[10px] uppercase font-bold tracking-tight">Morning</Button>
                  <Button variant="outline" size="sm" className="text-[10px] uppercase font-bold tracking-tight">Afternoon</Button>
                  <Button variant="outline" size="sm" className="text-[10px] uppercase font-bold tracking-tight">Night</Button>
                  <Button variant="outline" size="sm" className="text-[10px] uppercase font-bold tracking-tight">On-Call</Button>
                </div>
              </div>
              <Button className="w-full mt-2 shadow-sm font-bold uppercase text-[11px] tracking-widest"><Filter className="w-3 h-3 mr-2" /> Apply Global Filter</Button>
            </div>
          </WorkspacePanel>

          <WorkspacePanel title="Protocol Alert" icon={<ShieldAlert className="w-4 h-4 text-destructive" />}>
            <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/20 space-y-2">
              <p className="text-xs font-semibold text-destructive uppercase tracking-tighter">Emergency Bypass Active</p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                You are currently in HR-Bypass mode. Every shift change made will be instantly active in the production roster. This requires a digital signature and reason for audit trails.
              </p>
            </div>
          </WorkspacePanel>
        </div>
      </div>

      {/* Emergency Override Modal */}
      <ShiftOverrideModal
        isOpen={isOverrideOpen}
        onClose={() => {
          setIsOverrideOpen(false);
          setSelectedCell(null);
        }}
        employees={employees.map((e) => ({ id: e.id, fullName: e.fullName || "" }))}
        defaultEmployeeId={selectedCell?.employeeId ?? ""}
        defaultDate={selectedCell?.date ?? ""}
        onSuccess={() => loadData()}
      />
    </div>
  );
}
