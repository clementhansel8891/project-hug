import { useEffect, useState, useCallback } from "react";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { useSession } from "@/core/security/session";
import { apiRequest } from "@/core/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Search, Info, Loader2, AlertCircle, CheckCircle2, Activity, Terminal, Shield } from "lucide-react";
import { adminService } from "@/core/services/adminService";
import { formatDateTime, safeText } from "@/lib/format";
import DepartmentWorkspaceLayout from "@/components/layouts/DepartmentWorkspaceLayout";
import { LogFilterExportModal } from "./LogFilterExportModal";

const SECTIONS = [
  {
    title: "DIAGNOSTICS",
    items: [
      { id: 'logs', icon: Terminal, label: "System Logs", to: "/core/logs" },
      { id: 'audit', icon: Shield, label: "Audit Vault", to: "/core/audit" },
    ]
  }
];

interface LogEntry {
  id?: string;
  createdAt?: string;
  created_at?: string;
  updated_at?: string;
  updatedAt?: string;
  timestamp?: string;
  level: string;
  module: string;
  event: string;
  durationMs?: number;
  duration_ms?: number;
  message: string;
  requestId?: string;
  request_id?: string;
  userId?: string;
  user_id?: string;
  payload?: unknown;
  errorStack?: string;
  error_stack?: string;
}

interface IntegrityStatus {
  status: string;
  details: string;
  verified_at: string | number | Date;
}

interface StuckEventsStatus {
  processing: number;
  failed: number;
}

const formatLogDate = (log: LogEntry) => {
  const dVal = log.createdAt || log.created_at || log.updated_at || log.updatedAt || log.timestamp;
  if (!dVal) return "—";
  const d = new Date(dVal);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
};

export default function LogHub({ noShell = false }: { noShell?: boolean }) {
  const session = useSession();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  const [filters, setFilters] = useState({
    module: "",
    level: "ALL",
    event: "",
    userId: "",
    startDate: "",
    endDate: "",
  });

  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [stuckEvents, setStuckEvents] = useState<StuckEventsStatus | null>(null);
  const [integrityStatus, setIntegrityStatus] = useState<IntegrityStatus | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const fetchObservability = useCallback(async () => {
    try {
      const [stuck, integrity] = await Promise.all([
        adminService.getStuckEvents(session),
        adminService.getAuditIntegrityStatus(session)
      ]);
      setStuckEvents(stuck.metrics);
      setIntegrityStatus(integrity);
    } catch (err) {
      console.error("Failed to fetch observability metrics:", err);
    }
  }, [session]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filters.module && { module: filters.module }),
        ...(filters.level !== "ALL" && { level: filters.level }),
        ...(filters.event && { event: filters.event }),
        ...(filters.userId && { user_id: filters.userId }),
        ...(filters.startDate && { start_date: filters.startDate }),
        ...(filters.endDate && { end_date: filters.endDate }),
      });

      const result = await apiRequest<LogEntry[] | { data?: LogEntry[]; total?: number }>(`/v1/logs?${params.toString()}`, "GET", session);
      
      if (Array.isArray(result)) {
        setLogs(result);
        setTotal(result.length);
      } else {
        setLogs(result.data || []);
        setTotal(result.total || result.data?.length || 0);
      }
    } catch (error: unknown) {
      console.error("Failed to fetch system logs:", error);
    } finally {
      setLoading(false);
    }
  }, [session, page, limit, filters]);

  useEffect(() => {
    fetchLogs();
    fetchObservability();
  }, [fetchLogs, fetchObservability]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case "ERROR":
      case "FATAL":
        return <Badge variant="destructive">{level}</Badge>;
      case "WARN":
        return <Badge className="bg-warning hover:bg-warning">WARN</Badge>;
      case "DEBUG":
        return <Badge variant="outline">DEBUG</Badge>;
      default:
        return <Badge variant="secondary">INFO</Badge>;
    }
  };

  const mainContent = (
    <div className="space-y-6 p-6">
      {/* --- OBSERVABILITY PANELS --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <WorkspacePanel 
          title="System Integrity" 
          description="Blockchain-sealed audit log verification."
        >
          {integrityStatus ? (
            <div className={`p-4 rounded-lg flex items-center gap-4 ${integrityStatus.status === 'HEALTHY' ? 'bg-success/10 border border-success/20' : 'bg-destructive/10 border border-destructive/20'}`}>
              {integrityStatus.status === 'HEALTHY' ? (
                <CheckCircle2 className="h-8 w-8 text-success" />
              ) : (
                <AlertCircle className="h-8 w-8 text-destructive" />
              )}
              <div>
                <p className="font-semibold text-sm">
                  Audit Chain Status: {safeText(integrityStatus.status)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {safeText(integrityStatus.details)}
                </p>
                <p className="text-[10px] mt-1 opacity-70">
                  Last Verified: {formatDateTime(integrityStatus.verified_at)}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel 
          title="Process Health" 
          description="Background event queue and worker status."
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Stuck (Processing)</span>
              </div>
              <p className="text-2xl font-bold">{stuckEvents?.processing ?? 0}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Deadlocked (Failed)</span>
              </div>
              <p className="text-2xl font-bold text-destructive">{stuckEvents?.failed ?? 0}</p>
            </div>
          </div>
        </WorkspacePanel>
      </div>

      <WorkspacePanel title="System Diagnostics">
        <form onSubmit={handleSearch} className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6 items-end">
          <div className="space-y-2">
            <label className="text-xs font-medium">Module</label>
            <Input 
              placeholder="Module" 
              value={filters.module} 
              onChange={(e) => setFilters({ ...filters, module: e.target.value })} 
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">Level</label>
            <Select 
              value={filters.level} 
              onValueChange={(v) => setFilters({ ...filters, level: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ALL</SelectItem>
                <SelectItem value="DEBUG">DEBUG</SelectItem>
                <SelectItem value="INFO">INFO</SelectItem>
                <SelectItem value="WARN">WARN</SelectItem>
                <SelectItem value="ERROR">ERROR</SelectItem>
                <SelectItem value="FATAL">FATAL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">Event</label>
            <Input 
              placeholder="Event name" 
              value={filters.event} 
              onChange={(e) => setFilters({ ...filters, event: e.target.value })} 
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">User ID</label>
            <Input 
              placeholder="UUID" 
              value={filters.userId} 
              onChange={(e) => setFilters({ ...filters, userId: e.target.value })} 
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">Start Date</label>
            <Input 
              type="date" 
              value={filters.startDate} 
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} 
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">End Date</label>
            <Input 
              type="date" 
              value={filters.endDate} 
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} 
            />
          </div>
          <Button type="submit">
            <Search className="h-4 w-4 mr-2" /> Search
          </Button>
          <Button type="button" variant="outline" onClick={() => setExportModalOpen(true)}>
            Export
          </Button>
        </form>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="text-right">Dur (ms)</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      No system logs found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  (Array.isArray(logs) ? logs : []).map((log) => (
                    <TableRow 
                      key={log.id} 
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => setSelectedLog(log)}
                    >
                      <TableCell className="font-mono text-[10px] whitespace-nowrap">
                        {formatLogDate(log)}
                      </TableCell>
                      <TableCell>{getLevelBadge(log.level)}</TableCell>
                      <TableCell className="capitalize text-xs font-medium">{safeText(log.module)}</TableCell>
                      <TableCell className="text-xs truncate max-w-[120px]">{safeText(log.event)}</TableCell>
                      <TableCell className="text-xs truncate max-w-[200px]">{safeText(log.message)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {log.durationMs || log.duration_ms || "-"}
                      </TableCell>
                      <TableCell>
                        <Button disabled title="Not available yet" variant="ghost" size="icon">
                          <Info className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            Total results: {total}
          </div>
          <div className="flex gap-2 items-center">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page === 1} 
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm font-medium">
              Page {page} of {Math.ceil(total / limit) || 1}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page >= Math.ceil(total / limit)} 
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </WorkspacePanel>

      <LogFilterExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
      />

      <Sheet open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>System Log Detail</SheetTitle>
          </SheetHeader>
          {selectedLog && (() => {
            const logDuration = selectedLog.durationMs || selectedLog.duration_ms;
            return (
            <div className="space-y-6 mt-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-xs text-muted-foreground block">Level</label>
                  {getLevelBadge(selectedLog.level)}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block">Module</label>
                  <span className="font-medium capitalize">{selectedLog.module}</span>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block">Event</label>
                  <code className="bg-muted px-1 rounded text-xs">{selectedLog.event}</code>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block">Duration</label>
                  <span className="text-xs">{logDuration ? `${logDuration}ms` : "N/A"}</span>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground block">Message</label>
                  <span className="text-sm">{selectedLog.message}</span>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block">Request ID</label>
                  <span className="font-mono text-xs">{selectedLog.requestId || selectedLog.request_id || "N/A"}</span>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block">User ID</label>
                  <span className="font-mono text-xs">{selectedLog.userId || selectedLog.user_id || "N/A"}</span>
                </div>
              </div>

              {selectedLog.payload && (
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground block">Payload</label>
                  <div className="bg-muted text-muted-foreground p-3 rounded-md text-xs font-mono overflow-x-auto">
                    <pre>{JSON.stringify(selectedLog.payload, null, 2)}</pre>
                  </div>
                </div>
              )}

              {(selectedLog.errorStack || selectedLog.error_stack) && (
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground block">Error Stack</label>
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-md text-[10px] font-mono whitespace-pre overflow-x-auto leading-tight">
                    {selectedLog.errorStack || selectedLog.error_stack}
                  </div>
                </div>
              )}
            </div>
          );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );

  if (noShell) return mainContent;

  return (
    <DepartmentWorkspaceLayout
      title="System Logs"
      subtitle="Centralized diagnostics for API requests, background jobs, and application errors."
      headerIcon={Terminal}
      accentColor="slate"
      engineName="OBSERVABILITY_ENGINE"
      pulseLabel="Log Pulse"
      pulseIcon={Activity}
      sections={SECTIONS}
      routeLabels={{}}
      basePath="/core/logs"
    >
      {mainContent}
    </DepartmentWorkspaceLayout>
  );
}
