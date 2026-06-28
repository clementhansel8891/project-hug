import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  ShieldAlert,
  DollarSign,
  Server,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { auditService, type AuditLog, type VerificationResult } from "@/core/services/auditService";
import { useSession } from "@/core/security/session";
import { format } from "date-fns";

interface FeedItemProps {
  type: "FINANCE" | "INFRA" | "SECURITY" | "RETAIL";
  message: string;
  timestamp: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  isVerified?: boolean;
}

const FeedItem: React.FC<FeedItemProps> = ({
  type,
  message,
  timestamp,
  priority,
  isVerified = true,
}) => (
  <div className="flex items-start gap-5 p-6 rounded-[2rem] bg-card backdrop-blur-3xl border border-border hover:border-primary hover:bg-muted transition-all duration-500 group cursor-pointer shadow-lg relative overflow-hidden">
    <div className="absolute top-0 right-0 w-16 h-16 bg-secondary/40 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
    <div
      className={cn(
        "w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 transition-all duration-500 group-hover:scale-110 shadow-2xl",
        type === "FINANCE"
          ? "bg-success/10 border-success/20 text-success"
          : type === "INFRA"
            ? "bg-primary/10 border-primary text-primary"
            : type === "SECURITY"
              ? "bg-destructive/10 border-destructive/20 text-destructive"
              : "bg-warning border-warning/20 text-warning",
      )}
    >
      {type === "FINANCE" ? (
        <DollarSign className="w-6 h-6" />
      ) : type === "INFRA" ? (
        <Server className="w-6 h-6" />
      ) : type === "SECURITY" ? (
        <ShieldAlert className="w-6 h-6" />
      ) : (
        <ShoppingBag className="w-6 h-6" />
      )}
    </div>

    <div className="flex-1 min-w-0 relative z-10">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Badge
            className={cn(
              "text-[9px] font-black italic tracking-[0.2em] border-none px-2.5 h-5 rounded-lg uppercase",
              priority === "HIGH"
                ? "bg-destructive/20 text-destructive"
                : priority === "MEDIUM"
                  ? "bg-warning text-warning"
                  : "bg-secondary/50 text-muted-foreground",
            )}
          >
            {priority}
          </Badge>
          {isVerified && (
            <div className="flex items-center gap-1.5 px-2 h-5 rounded-lg bg-primary/10 border border-primary">
              <Lock className="w-2.5 h-2.5 text-primary" />
              <span className="text-[8px] font-black italic text-primary uppercase tracking-tighter">IMMU</span>
            </div>
          )}
        </div>
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest italic">
          {timestamp}
        </span>
      </div>
      <p className="text-[12px] font-medium text-muted-foreground leading-tight truncate group-hover:text-clip group-hover:whitespace-normal group-hover:text-foreground transition-colors">
        {message}
      </p>
    </div>

    <div className="w-10 h-10 rounded-xl bg-secondary/40 border border-border flex items-center justify-center group-hover:bg-primary transition-colors self-center">
      <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
    </div>
  </div>
);

export const GlobalActivityFeed = ({
  onExpansionRequest
}: {
  onExpansionRequest: (feature: string) => void;
}) => {
  const session = useSession();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerificationResult | null>(null);

  const fetchLogs = async () => {
    if (!session.tenantId) return;
    setLoading(true);
    try {
      const response = await auditService.getLogs(session, { limit: 12 });
      setLogs(response.data);
    } catch (error) {
      console.error("[GlobalActivityFeed] Failed to fetch logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const result = await auditService.verifyChain(session);
      setVerifyResult(result);
      setTimeout(() => setVerifyResult(null), 5000); // Clear after 5s
    } catch (error) {
      console.error("[GlobalActivityFeed] Verification failed:", error);
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [session.tenantId]);

  const mapSeverityToPriority = (severity: string): "HIGH" | "MEDIUM" | "LOW" => {
    switch (severity) {
      case "CRITICAL": return "HIGH";
      case "WARN": return "MEDIUM";
      default: return "LOW";
    }
  };

  const mapModuleToType = (module: string): "FINANCE" | "INFRA" | "SECURITY" | "RETAIL" => {
    switch (module) {
      case "FINANCE": return "FINANCE";
      case "INFRA": return "INFRA";
      case "SECURITY": return "SECURITY";
      default: return "RETAIL";
    }
  };

  return (
    <Card className="rounded-2xl border border-border bg-card backdrop-blur-3xl shadow-2xl overflow-hidden flex flex-col h-full group/feed">
      <CardHeader className="p-8 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="space-y-3">
            <CardTitle className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-6 text-foreground">
              <Activity className="w-8 h-8 text-primary shadow-2xl animate-pulse" />
              Telemetry Feed
            </CardTitle>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.3em] italic">
              Global Synchronization Log • {logs.length} Recent Events
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleVerify}
              disabled={verifying}
              className={cn(
                "flex items-center gap-3 px-6 h-14 border rounded-2xl shadow-xl transition-all",
                verifyResult 
                  ? verifyResult.valid ? "bg-success/10 border-success/20 text-success" : "bg-destructive/10 border-destructive/20 text-destructive"
                  : "bg-secondary/40 border-border text-muted-foreground hover:bg-muted/10 hover:text-foreground"
              )}
            >
              {verifying ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
              <span className="text-[10px] font-black italic uppercase tracking-widest">
                {verifyResult ? (verifyResult.valid ? "Chain Verified" : "Drift Detected") : "Verify Chain"}
              </span>
            </button>
            <div className="flex items-center gap-3 px-5 h-14 bg-success/10 border border-success/20 rounded-2xl shadow-xl">
              <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              <span className="text-[10px] font-black italic uppercase text-success tracking-[0.2em]">
                Live
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 flex-1 overflow-y-auto space-y-4 custom-scrollbar bg-transparent">
        {loading && logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 opacity-40">
            <RefreshCw className="w-12 h-12 text-primary animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Synchronizing Vault...</span>
          </div>
        ) : logs.length > 0 ? (
          (Array.isArray(logs) ? logs : []).map((log) => (
            <FeedItem 
              key={log.id} 
              type={mapModuleToType(log.module)}
              priority={mapSeverityToPriority(log.severity)}
              message={`${log.action}: ${log.entity_type} [${log.entity_id}]`}
              timestamp={format(new Date(log.created_at), "HH:mm:ss")}
              isVerified={!!log.hash_chain}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-6 opacity-40">
            <Lock className="w-12 h-12 text-muted-foreground" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Vault is Empty</span>
          </div>
        )}
      </CardContent>

      <div className="p-6 border-t border-border bg-card">
        <button 
          onClick={() => onExpansionRequest("Deep Audit Virtual Vault")}
          className="w-full h-16 rounded-xl bg-primary hover:bg-primary/90 text-foreground font-black italic text-[12px] uppercase tracking-[0.3em] transition-all shadow-[0_20px_40px_rgba(79,70,229,0.3)] hover:scale-105 active:scale-95 flex items-center justify-center gap-4 italic"
        >
          Access Deep Audit Vault <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </Card>
  );
};

