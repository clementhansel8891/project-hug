import React from "react";
import { ArrowDownToLine, Truck, Lock, History } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MOVEMENT_META, type MovementType } from "./movementMeta";

export type AuditEntry = {
  id: string;
  actor: string;
  action: string;
  sku?: string;
  qty?: number;
  reason: string;
  ts: string;
  status: "approved" | "pending" | "rejected";
};

type Props = {
  canWrite: boolean;
  auditLog: AuditEntry[];
  onMovement: (type: MovementType) => void;
};

export const MovementsTab: React.FC<Props> = ({
  canWrite,
  auditLog,
  onMovement,
}) => {
  const colorMap: Record<string, { bg: string; icon: string; text: string; border: string }> = {
    blue: { bg: "bg-primary", icon: "text-primary", text: "text-primary", border: "border-primary" },
    indigo: { bg: "bg-primary", icon: "text-primary", text: "text-primary", border: "border-primary" },
    emerald: { bg: "bg-success", icon: "text-success", text: "text-success", border: "border-success/20" },
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 text-foreground">
      {/* Action cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
        {(
          Object.entries(MOVEMENT_META) as [
            MovementType,
            (typeof MOVEMENT_META)[MovementType],
          ][]
        ).map(([type, meta]) => {
          const colors = colorMap[meta.color] || colorMap.indigo;
          return (
            <Card
              key={type}
              onClick={() => onMovement(type)}
              className="rounded-[2rem] border border-border hover:border-primary shadow-xl bg-card p-7 cursor-pointer group transition-all hover:shadow-2xl backdrop-blur-3xl"
            >
              <div
                className={`w-14 h-14 rounded-2xl ${colors.bg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}
              >
                {meta.dir === "in" ? (
                  <ArrowDownToLine className={`w-7 h-7 ${colors.icon}`} />
                ) : (
                  <Truck className={`w-7 h-7 ${colors.icon}`} />
                )}
              </div>
              <div className="font-black italic text-base tracking-tight text-foreground uppercase">
                {meta.label}
              </div>
              <div
                className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${colors.text} italic`}
              >
                {meta.dir === "in" ? "Inbound" : "Outbound"}
              </div>
              {!canWrite && (
                <div className="mt-3 text-[9px] font-black italic text-warning flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Requires Approval
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Movement audit log */}
      <Card className="rounded-2xl border border-border shadow-xl overflow-hidden bg-card backdrop-blur-3xl">
        <CardHeader className="p-7 border-b border-border">
          <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground italic flex items-center gap-2">
            <History className="w-4 h-4" /> Movement Audit Log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {[
                  "Time",
                  "Actor",
                  "Action",
                  "SKU / Qty",
                  "Reason",
                  "Status",
                ].map((h, i) => (
                  <th
                    key={i}
                    className="px-7 py-4 text-left text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground italic"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(auditLog) ? auditLog : []).map((log, i) => (
                <tr
                  key={i}
                  className="border-b border-white/[0.02] last:border-none hover:bg-white/5 transition-colors"
                >
                  <td className="px-7 py-4 font-mono text-[10px] text-muted-foreground">
                    {log.ts}
                  </td>
                  <td className="px-7 py-4 font-black italic text-sm text-muted-foreground">
                    {log.actor}
                  </td>
                  <td className="px-7 py-4">
                    <Badge className="bg-secondary/20 text-muted-foreground border-none font-black italic text-[9px]">
                      {log.action}
                    </Badge>
                  </td>
                  <td className="px-7 py-4 font-bold italic text-sm">
                    {log.sku ? `${log.sku} × ${log.qty}` : "—"}
                  </td>
                  <td className="px-7 py-4 text-[11px] text-muted-foreground font-medium italic max-w-xs truncate">
                    {log.reason}
                  </td>
                  <td className="px-7 py-4">
                    <Badge
                      className={cn(
                        "border font-black italic text-[9px] uppercase",
                        log.status === "approved"
                          ? "bg-success text-success border-success/20"
                          : log.status === "pending"
                            ? "bg-warning text-warning border-warning/20"
                            : "bg-destructive text-destructive border-destructive/20",
                      )}
                    >
                      {log.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};
