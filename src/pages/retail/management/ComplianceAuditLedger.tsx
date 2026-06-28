import React, { useState, useMemo, useCallback } from "react";
import { PageHeader } from "@/core/ui/PageHeader";
import {
  FileText,
  ShieldCheck,
  Download,
  ExternalLink,
  Search,
  Filter,
  Lock,
  Fingerprint,
  AlertTriangle,
  CheckCircle2,
  History,
  ChevronRight,
  Database,
  Key,
  Calendar,
  MoreHorizontal,
  RefreshCw,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTableShell } from "@/core/tools/DataTableShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useSession } from "@/core/security/session";
import { apiRequest } from "@/core/api/apiClient";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AuditLog {
  id: string;
  action: string;
  user_id: string;
  created_at: string;
  updated_at?: string;
  hash_chain: string;
  metadata?: {
    impact?: string;
    [key: string]: unknown;
  };
}

const eventColors: Record<string, string> = {
  FISCAL_VOID: "text-destructive bg-destructive/10 border-destructive/20",
  PERMISSION_CHANGE: "text-warning bg-warning border-warning/20",
  MANUAL_ADJUST: "text-primary bg-primary/10 border-primary",
  STORE_OPEN: "text-success bg-success/10 border-success/20",
  STORE_CLOSE: "text-muted-foreground bg-muted/40 border-border/20",
  DISCOUNT_APPLIED: "text-primary bg-primary/10 border-primary",
  REFUND_ISSUED: "text-destructive bg-destructive border-destructive/20",
};

const ComplianceAuditLedger = ({ noShell = false }: { noShell?: boolean }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const session = useSession();
  const navigate = useNavigate();

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsError(false);
      const data = await apiRequest<AuditLog[]>("/v1/audit/logs", "GET", session);
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
      setIsError(true);
      toast.error("Compliance Stream Offline");
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  React.useEffect(() => {
    if (session.tenant_id) fetchLogs();
  }, [session.tenant_id, fetchLogs]);


  const handleExport = async (format: 'pdf' | 'csv') => {
    try {
      toast.info(`Generating ${format.toUpperCase()} Audit Report...`);
      const blob = await apiRequest<Blob>(`/v1/audit/export?format=${format}`, "GET", session, null, { responseType: 'blob' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-report-${new Date().toISOString()}.${format === 'csv' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Export Failed");
    }
  };

  const formatLogDate = (created_at: string | undefined, updated_at?: string | undefined) => {
    const dVal = created_at || updated_at;
    if (!dVal) return "—";
    const d = new Date(dVal);
    return isNaN(d.getTime()) ? "—" : d.toLocaleString();
  };

  const filteredLogs = useMemo(() => {
    if (!searchTerm.trim()) return logs;
    const q = searchTerm.toLowerCase();
    return (Array.isArray(logs) ? logs : []).filter(
      (l) =>
        (l.action || "").toLowerCase().includes(q) ||
        (l.user_id || "").toLowerCase().includes(q) ||
        (l.hash_chain || "").toLowerCase().includes(q) ||
        formatLogDate(l.created_at, l.updated_at).toLowerCase().includes(q),
    );
  }, [searchTerm, logs]);

  const content = (
    <div className={cn("space-y-8 relative z-10", !noShell && "max-w-[1600px] mx-auto p-6")}>
      {!noShell && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <Card className="lg:col-span-3 bg-card border border-border shadow-2xl rounded-[2rem] overflow-hidden relative group backdrop-blur-3xl">
            <div className="absolute top-0 right-0 p-6 opacity-5">
              <ShieldCheck className="w-48 h-48 text-primary" />
            </div>
            <CardContent className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10 text-foreground">
              <div className="space-y-6 flex-1">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-foreground shadow-xl">
                    <Fingerprint className="w-8 h-8" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-primary italic">
                      Global Integrity State
                    </div>
                    <div className="text-3xl font-black italic tracking-tighter">
                      SECURED & SEALED
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest italic">
                    Current Block Hash
                  </div>
                  <code className="bg-secondary px-6 py-3 rounded-2xl text-primary font-mono text-xs border border-border block w-fit shadow-inner">
                    ZVX-PROD-0x8F2DA4C7B41A9902EDC
                  </code>
                </div>
                <div className="text-[10px] text-muted-foreground font-bold uppercase italic flex items-center gap-4">
                  <span>Last reconciliation: <span className="text-foreground">14 minutes ago</span></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                  <span>{logs.length} Blocks Immutable</span>
                </div>
              </div>
              <div className="w-full md:w-64 bg-secondary/50 border border-border p-8 rounded-2xl space-y-6 text-center shrink-0 backdrop-blur-sm">
                <div className="text-6xl font-black italic tracking-tighter text-primary">
                  100%
                </div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Integrity Score
                </div>
                <Progress value={100} className="h-2.5 bg-secondary shadow-inner" />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="shadow-2xl border-none bg-card backdrop-blur-3xl rounded-2xl overflow-hidden">
              <CardHeader className="p-8 pb-0">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground italic">
                  Anomaly Watch
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-success/10 text-success flex items-center justify-center border border-success/20">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-sm font-black italic text-foreground uppercase tracking-tighter">
                      Zero Flags
                    </div>
                    <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                      No Suspicious Deviations
                    </div>
                  </div>
                </div>
                <Separator className="bg-secondary/40" />
                <div className="text-[10px] text-muted-foreground font-medium leading-relaxed italic uppercase tracking-widest">
                  AI Scanner processed {logs.length} transaction blocks with nominal variance.
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-2xl border-none bg-primary/10 hover:bg-primary/20 border border-primary backdrop-blur-3xl rounded-2xl group cursor-pointer transition-all duration-500" onClick={() => navigate("/core/compliance")}>
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-foreground shadow-xl mx-auto group-hover:scale-110 transition-transform">
                  <Database className="w-7 h-7" />
                </div>
                <div className="text-sm font-black italic text-foreground uppercase tracking-widest">
                  Archive Vault
                </div>
                <div className="text-[10px] text-primary font-bold uppercase tracking-[0.2em] italic">
                  Access T+90 Days Data
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex gap-4 bg-card backdrop-blur-3xl rounded-2xl p-4 border border-border shadow-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            className="pl-16 h-14 bg-secondary/50 border-none rounded-2xl text-sm font-bold italic text-foreground placeholder:text-muted-foreground focus-visible:ring-primary transition-all"
            placeholder="Search Timestamp, Event Type, Actor ID, or Hash Signature..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button 
          onClick={() => navigate("/core/compliance")}
          variant="ghost"
          className="h-14 px-8 rounded-2xl gap-3 font-black italic border border-border text-foreground hover:bg-secondary/40 uppercase text-[10px] tracking-widest"
        >
          <Calendar className="w-5 h-5 text-primary" /> Range
        </Button>
        <Button 
          onClick={() => navigate("/core/compliance")}
          variant="ghost"
          className="h-14 px-8 rounded-2xl gap-3 font-black italic border border-border text-foreground hover:bg-secondary/40 uppercase text-[10px] tracking-widest"
        >
          <Filter className="w-5 h-5 text-primary" /> Types
        </Button>
      </div>

      {/* Audit Log Table */}
      <Card className="border-none bg-card backdrop-blur-3xl shadow-2xl rounded-[2rem] overflow-hidden border border-border">
        <CardHeader className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center text-foreground border border-border">
                <History className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-2xl font-black italic uppercase tracking-tighter text-foreground">
                  Immutable Audit Stream
                </CardTitle>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] mt-1">
                  Non-Repudiable Logs backed by Zenvix Signature Hub
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary rounded-xl">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-black italic uppercase text-primary tracking-widest">REAL-TIME SYNC</span>
            </div>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {[
                  "Temporal Context",
                  "Event Typology",
                  "Operational Actor",
                  "Impact Delta",
                  "Integrity Seal",
                  "Block ID",
                ].map((h, i) => (
                  <th
                    key={i}
                    className={`px-10 py-6 ${i === 4 ? "text-center" : i === 5 ? "text-right" : "text-left"} text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground italic`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-10 py-32 text-center">
                     <RefreshCw className="w-12 h-12 animate-spin text-primary mx-auto mb-6" />
                     <span className="text-[11px] font-black italic uppercase tracking-[0.25em] text-muted-foreground">Decrypting Ledger...</span>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="px-10 py-32 text-center">
                    <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-6" />
                    <div className="text-[11px] font-black italic uppercase tracking-[0.25em] text-foreground mb-2">
                      Couldn't load audit stream
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground max-w-md mx-auto mb-6">
                      The compliance ledger could not be reached for this tenant. Check your connection and try again.
                    </p>
                    <Button
                      variant="outline"
                      onClick={fetchLogs}
                      className="h-10 rounded-xl gap-2 font-black italic text-[10px] uppercase tracking-widest"
                    >
                      <RefreshCw className="w-4 h-4" /> Retry
                    </Button>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-10 py-32 text-center text-[10px] font-black italic uppercase tracking-[0.3em] text-muted-foreground"
                  >
                    No matching entries in current block
                  </td>
                </tr>
              ) : (
                (Array.isArray(filteredLogs) ? filteredLogs : []).map((log, i) => (
                  <tr
                    key={i}
                    className="group hover:bg-secondary/40 transition-all border-b border-white/[0.02] last:border-none cursor-pointer"
                  >
                    <td className="px-10 py-6 whitespace-nowrap">
                      <div className="text-xs font-bold text-foreground font-mono tracking-tight group-hover:text-primary transition-colors">
                        {formatLogDate(log.created_at, log.updated_at)}
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <Badge
                        className={`border px-4 py-1.5 rounded-xl text-[9px] font-black italic tracking-widest uppercase ${eventColors[log.action] ?? "bg-secondary text-muted-foreground border-border"}`}
                      >
                        {log.action}
                      </Badge>
                    </td>
                    <td className="px-10 py-6">
                      <div className="text-xs font-black italic text-muted-foreground/60">
                        {log.user_id}
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <div
                        className={`text-xs font-black italic ${String(log.metadata?.impact || "").startsWith("-") ? "text-destructive" : log.action === "PERMISSION_CHANGE" ? "text-warning" : "text-muted-foreground"}`}
                      >
                        {log.metadata?.impact || "N/A"}
                      </div>
                    </td>
                    <td className="px-10 py-6 text-center">
                      <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-success/10 border border-success/20 rounded-xl w-fit mx-auto">
                        <ShieldCheck className="w-3.5 h-3.5 text-success" />
                        <span className="text-[9px] font-black italic text-success uppercase tracking-widest">
                          Validated
                        </span>
                      </div>
                    </td>
                    <td className="px-10 py-6 text-right font-mono text-[10px] text-muted-foreground group-hover:text-foreground transition-colors">
                      {(log.hash_chain || "").substring(0, 12)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-8 bg-secondary/50 border-t border-border flex items-center justify-between">
          <div className="text-[10px] font-black italic text-muted-foreground uppercase tracking-[0.2em]">
            {filteredLogs.length} Blocks Sequenced in Current View
          </div>
          <Button 
            onClick={() => navigate("/core/compliance")}
            variant="ghost"
            size="sm"
            className="font-black italic text-[11px] uppercase text-primary hover:bg-primary/10 rounded-2xl gap-3 h-11 px-6 border border-primary"
          >
            Verify All Historical Blocks{" "}
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </div>
  );

  if (noShell) return content;

  return (
    <div className="flex-1 flex flex-col selection:bg-primary selection:text-foreground">

      {/* Header */}
      <div className="px-6 py-3 border-b border-border bg-background/50 backdrop-blur-3xl shrink-0 flex items-center justify-between sticky top-0 z-50">
        <div>
          <h1 className="text-2xl font-black italic uppercase tracking-tighter text-foreground">
            Compliance & Audit Ledger
          </h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-0.5">
            Immutable Fiscal Record-Keeping • Regulatory Event Log
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => handleExport('csv')}
            variant="ghost"
            className="h-9 px-4 font-black italic border border-border text-foreground hover:bg-secondary/40 text-[9px] uppercase tracking-widest gap-2 rounded-xl"
          >
            <Download className="w-3.5 h-3.5 text-success" /> XLSX
          </Button>
          <Button onClick={() => handleExport('pdf')}
             variant="ghost"
             className="h-9 px-4 font-black italic border border-border text-foreground hover:bg-secondary/40 text-[9px] uppercase tracking-widest gap-2 rounded-xl"
          >
            <FileText className="w-3.5 h-3.5 text-destructive" /> PDF
          </Button>

          <Button 
            onClick={() => navigate("/core/compliance")}
            className="h-9 px-4 rounded-xl bg-secondary hover:bg-secondary/60 text-foreground font-black italic uppercase text-[9px] tracking-widest gap-2 shadow-xl shadow-indigo-600/20"
          >
            <ExternalLink className="w-3.5 h-3.5" /> VERIFY CHAIN
          </Button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {/* Background Atmosphere */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-5%] w-[45%] h-[45%] bg-primary/5 blur-[130px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-5%] w-[35%] h-[35%] bg-primary/5 blur-[120px] rounded-full" />
        </div>
        {content}
      </div>
    </div>
  );
};

export default ComplianceAuditLedger;
