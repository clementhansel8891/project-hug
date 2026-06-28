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
import { Search, Info, Loader2, Shield, Activity, Terminal } from "lucide-react";
import { formatDateTime, safeText } from "@/lib/format";
import DepartmentWorkspaceLayout from "@/components/layouts/DepartmentWorkspaceLayout";
import { AuditExportModal } from "./AuditExportModal";

const SECTIONS = [
  {
    title: "DIAGNOSTICS",
    items: [
      { id: 'logs', icon: Terminal, label: "System Logs", to: "/core/logs" },
      { id: 'audit', icon: Shield, label: "Audit Vault", to: "/core/audit" },
    ]
  }
];

export default function AuditHub() {
  const session = useSession();
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  const [filters, setFilters] = useState({
    module: "",
    action: "",
    userId: "",
    severity: "ALL",
    startDate: "",
    endDate: "",
  });

  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filters.module && { module: filters.module }),
        ...(filters.action && { action: filters.action }),
        ...(filters.userId && { user_id: filters.userId }),
        ...(filters.severity !== "ALL" && { severity: filters.severity }),
        ...(filters.startDate && { start_date: filters.startDate }),
        ...(filters.endDate && { end_date: filters.endDate }),
      });

      const result = await apiRequest<any>(`/audit/logs?${params.toString()}`, "GET", session);
      
      if (Array.isArray(result)) {
        setLogs(result);
        setTotal(result.length);
      } else {
        setLogs(result.data || []);
        setTotal(result.total || result.data?.length || 0);
      }
    } catch (error: any) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setLoading(false);
    }
  }, [session, page, limit, filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return <Badge variant="destructive">CRITICAL</Badge>;
      case "WARN":
        return <Badge className="bg-warning hover:bg-warning">WARN</Badge>;
      default:
        return <Badge variant="secondary">INFO</Badge>;
    }
  };

  const mainContent = (
    <div className="space-y-6 p-6">
      <WorkspacePanel title="Activity Explorer">
        <form onSubmit={handleSearch} className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6 items-end">
          <div className="space-y-2">
            <label className="text-xs font-medium">Module</label>
            <Input 
              placeholder="e.g. hr" 
              value={filters.module} 
              onChange={(e) => setFilters({ ...filters, module: e.target.value })} 
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">Action</label>
            <Input 
              placeholder="e.g. CREATE" 
              value={filters.action} 
              onChange={(e) => setFilters({ ...filters, action: e.target.value })} 
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
            <label className="text-xs font-medium">Severity</label>
            <Select 
              value={filters.severity} 
              onValueChange={(v) => setFilters({ ...filters, severity: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ALL</SelectItem>
                <SelectItem value="INFO">INFO</SelectItem>
                <SelectItem value="WARN">WARN</SelectItem>
                <SelectItem value="CRITICAL">CRITICAL</SelectItem>
              </SelectContent>
            </Select>
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
                  <TableHead>Module</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      No audit logs found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  (Array.isArray(logs) ? logs : []).map((log) => (
                    <TableRow 
                      key={log.id} 
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => setSelectedLog(log)}
                    >
                      <TableCell className="font-mono text-xs">
                        {formatDateTime(log.createdAt || log.created_at || log.timestamp)}
                      </TableCell>
                      <TableCell className="capitalize font-medium">{safeText(log.module)}</TableCell>
                      <TableCell>
                        <code className="bg-muted px-1 rounded text-xs">{safeText(log.action)}</code>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <span className="font-semibold">{safeText(log.entityType || log.entity_type)}:</span>
                          <span className="text-muted-foreground ml-1">{safeText(log.entityId || log.entity_id)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{(log.userId || log.user_id)?.split("-")[0] || "anon"}...</TableCell>
                      <TableCell>{getSeverityBadge(log.severity)}</TableCell>
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

      <AuditExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
      />

      <Sheet open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Audit Log Detail</SheetTitle>
          </SheetHeader>
          {selectedLog && (
            <div className="space-y-6 mt-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-xs text-muted-foreground block">Module</label>
                  <span className="font-medium capitalize">{selectedLog.module}</span>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block">Action</label>
                  <code className="bg-muted px-1 rounded">{selectedLog.action}</code>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block">User ID</label>
                  <span className="font-mono text-xs">{selectedLog.userId || selectedLog.user_id}</span>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block">IP Address</label>
                  <span className="font-mono text-xs">{selectedLog.ipAddress || selectedLog.ip_address || "N/A"}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground block">Metadata</label>
                <div className="bg-muted text-muted-foreground p-3 rounded-md text-xs font-mono overflow-x-auto">
                  <pre>{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
                </div>
              </div>

              {selectedLog.changes && (
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground block">Changes</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase text-muted-foreground">Before</label>
                      <div className="bg-destructive/10 border border-destructive/20 text-destructive p-2 rounded text-[10px] font-mono whitespace-pre-wrap">
                        {JSON.stringify(selectedLog.changes.before || {}, null, 2)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase text-muted-foreground">After</label>
                      <div className="bg-success/10 border border-success/20 text-success p-2 rounded text-[10px] font-mono whitespace-pre-wrap">
                        {JSON.stringify(selectedLog.changes.after || {}, null, 2)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );

  return (
    <DepartmentWorkspaceLayout
      title="Audit Vault"
      subtitle="Immutable trail of all critical system actions and data changes."
      headerIcon={Shield}
      accentColor="slate"
      engineName="GOVERNANCE_ENGINE"
      pulseLabel="Audit Pulse"
      pulseIcon={Activity}
      sections={SECTIONS}
      routeLabels={{}}
      basePath="/core/audit"
    >
      {mainContent}
    </DepartmentWorkspaceLayout>
  );
}
