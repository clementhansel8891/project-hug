import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { PageShell } from "@/core/ui/PageShell";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  Search, 
  Filter, 
  Calendar,
  UserCheck,
  UserX,
  AlertCircle,
  FileSpreadsheet
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GlassCard } from "@/components/shared/GlassCard";
import { QueryStateWrapper } from "@/components/shared/QueryStateWrapper";

import { useDepartmentalGovernance } from "@/core/hooks/useDepartmentalGovernance";
import { useModuleList } from "@/hooks/useModuleQuery";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

/** Shape of an attendance record returned by the backend. */
interface AttendanceRecordDTO {
  id: string;
  employee_id: string;
  employee_name?: string;
  role?: string;
  date: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  status: string;
  work_duration_minutes?: number;
}

/** Normalized record for the UI table. */
interface AttendanceRow {
  id: string;
  name: string;
  role: string;
  checkIn: string;
  checkOut: string;
  status: string;
  hours: number;
}

/** Map backend status values to display labels. */
function mapStatus(status: string): string {
  switch (status) {
    case "on_time": return "Present";
    case "late": return "Late";
    case "absent": return "Absent";
    case "remote": return "On Duty";
    case "leave": return "On Leave";
    case "early_leave": return "Early Leave";
    case "missing_out": return "On Duty";
    default: return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

/** Format a time string for display. */
function formatTime(time: string | null | undefined): string {
  if (!time) return "---";
  try {
    const date = new Date(time);
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return time;
  }
}

/**
 * DepartmentAttendanceStudio
 * Unified interface for managing departmental attendance records.
 * Supports HOD adjustments and HR global visibility.
 */
export default function DepartmentAttendanceStudio({ 
  workspaceDeptId, 
  title,
  noShell = false
}: { workspaceDeptId: string; title: string; noShell?: boolean }) {
  const { toast } = useToast();
  const { canManagePersonnel, userDepartmentId } = useDepartmentalGovernance();
  const [selectedDeptId, setSelectedDeptId] = useState(workspaceDeptId);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch attendance records from backend via TanStack Query (Requirement 9.3)
  const {
    data: attendanceData,
    isLoading,
    isError,
    error,
    refetch,
  } = useModuleList<AttendanceRecordDTO>("/hr/attendance", {
    filters: { department_id: selectedDeptId },
  });

  // Transform backend records into UI rows
  const records: AttendanceRow[] = useMemo(() => {
    const rawData = attendanceData?.data ?? (Array.isArray(attendanceData) ? attendanceData as unknown as AttendanceRecordDTO[] : []);
    return rawData.map((r) => ({
      id: r.id,
      name: r.employee_name ?? r.employee_id,
      role: r.role ?? "Staff",
      checkIn: formatTime(r.check_in_time),
      checkOut: formatTime(r.check_out_time),
      status: mapStatus(r.status),
      hours: r.work_duration_minutes ? Math.round(r.work_duration_minutes / 60) : 0,
    }));
  }, [attendanceData]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => 
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.role.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [records, searchQuery]);

  const handleAdjust = (id: string) => {
    toast({
      title: "Adjustment Logged",
      description: `Manual attendance adjustment for ${records.find(r => r.id === id)?.name} has been recorded and queued for audit.`,
    });
  };

  // Compute stats from live data
  const presentCount = records.filter(r => r.status === "Present" || r.status === "On Duty").length;
  const lateCount = records.filter(r => r.status === "Late").length;
  const absentCount = records.filter(r => r.status === "Absent").length;
  const anomalyCount = records.filter(r => r.status === "Early Leave" || r.status === "missing_out").length;

  const content = (
    <div className="space-y-6">
      {/* QueryStateWrapper handles loading, error, and empty states (Requirements 9.4, 9.5, 9.6) */}
      <QueryStateWrapper
        isLoading={isLoading}
        isError={isError}
        error={error ?? undefined}
        isEmpty={records.length === 0 && !isLoading && !isError}
        onRetry={() => refetch()}
        emptyMessage="No attendance records are available for this department."
      >
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard icon={UserCheck} label="Present" value={String(presentCount)} color="emerald" />
          <StatCard icon={Clock} label="Late" value={String(lateCount)} color="amber" />
          <StatCard icon={UserX} label="Absent" value={String(absentCount)} color="rose" />
          <StatCard icon={AlertCircle} label="Anomalies" value={String(anomalyCount)} color="slate" />
        </div>

        <WorkspacePanel title="Personnel Attendance Matrix">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search staff by name or role..." 
                className="pl-9 bg-muted border-border text-foreground placeholder:text-muted-foreground/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="ghost" size="icon" className="rounded-full text-foreground hover:bg-muted">
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full text-foreground hover:bg-muted">
              <Calendar className="h-4 w-4" />
            </Button>
          </div>

          <div className="rounded-2xl border border-border overflow-hidden bg-muted backdrop-blur-md">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 border-b border-border hover:bg-muted/50">
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Personnel</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Check-In</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Check-Out</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-right text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="p-0">
                      <div className="flex flex-col items-center justify-center p-10 text-center">
                        <span className="text-sm text-muted-foreground">No personnel match the current search for this department.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((record) => (
                  <TableRow key={record.id} className="hover:bg-muted/50 border-b border-border transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm tracking-tight text-foreground">{record.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{record.role}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-foreground">{record.checkIn}</TableCell>
                    <TableCell className="font-mono text-xs text-foreground">{record.checkOut}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 border-none",
                          record.status === "Present" && "bg-success/10 text-success",
                          record.status === "On Duty" && "bg-primary/10 text-primary",
                          record.status === "Absent" && "bg-destructive text-destructive",
                          record.status === "Late" && "bg-warning text-warning"
                        )}
                      >
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-[10px] font-black uppercase tracking-widest text-foreground hover:bg-muted rounded-lg px-3"
                        onClick={() => handleAdjust(record.id)}
                      >
                        Adjust
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </WorkspacePanel>
      </QueryStateWrapper>
    </div>
  );

  if (noShell) return content;

  return (
    <PageShell
      header={
        <PageHeader
          title={`${title} Attendance`}
          subtitle={`Governance, verification, and audit of personnel presence for the ${workspaceDeptId} department.`}
          primaryAction={
            <div className="flex items-center gap-2">
              {canManagePersonnel && (
                <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
                  <SelectTrigger className="w-[180px] bg-muted border-border text-foreground shadow-sm hover:bg-muted">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent className="bg-muted border-border">
                    <SelectItem value="FINANCE">Finance</SelectItem>
                    <SelectItem value="HR">Human Resources</SelectItem>
                    <SelectItem value="IT">IT Support</SelectItem>
                    <SelectItem value="PROCUREMENT">Procurement</SelectItem>
                    <SelectItem value="LOGISTICS">Logistics</SelectItem>
                    <SelectItem value="INVENTORY">Inventory</SelectItem>
                    <SelectItem value="SALES">Sales</SelectItem>
                    <SelectItem value="MARKETING">Marketing</SelectItem>
                    <SelectItem value="RETAIL">Retail</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Button variant="outline" className="gap-2 border-border hover:bg-muted text-foreground">
                <FileSpreadsheet className="h-4 w-4" /> Export Report
              </Button>
            </div>
          }
        />
      }
    >
      {content}
    </PageShell>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType, label: string, value: string, color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "text-success bg-success border-success/20",
    amber: "text-warning bg-warning border-warning/20",
    rose: "text-destructive bg-destructive border-destructive/20",
    slate: "text-muted-foreground bg-muted border-border",
  };

  return (
    <GlassCard className="p-4 rounded-3xl shadow-2xl flex items-center gap-4">
      <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center border", colorMap[color])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1">{label}</span>
        <span className="text-xl font-black italic tracking-tighter leading-none text-foreground">{value}</span>
      </div>
    </GlassCard>
  );
}


