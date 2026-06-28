import React from "react";
import { CheckCircle2, Lock, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { GovernanceState, DepartmentRole } from "../types/governance";

interface ApprovalMatrixProps {
  governanceState: GovernanceState;
  onSign: (
    dept: DepartmentRole,
    isBypass: boolean,
    bypassReason?: string,
  ) => void;
  onToggleBypass: () => void;
  onBypassReasonChange: (reason: string) => void;
}

const DEPARTMENTS: DepartmentRole[] = [
  "Sales",
  "Marketing",
  "Retail HOD",
  "Finance",
  "Office HOD",
];

export const ApprovalMatrix: React.FC<ApprovalMatrixProps> = ({
  governanceState,
  onSign,
  onToggleBypass,
  onBypassReasonChange,
}) => {
  const signatures = governanceState.signatures;
  const uniqueSigners = new Set(
    (Array.isArray(signatures) ? signatures : []).filter((s) => !s.isBypass).map((s) => s.department),
  ).size;
  const progress = Math.min(
    (uniqueSigners / governanceState.requiredSignatures) * 100,
    100,
  );
  const isQuorum = governanceState.quorumReached;

  return (
    <Card className="p-8 bg-secondary border-border text-foreground rounded-2xl shadow-2xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h3 className="text-xs font-black italic uppercase tracking-widest text-primary">
            Signatory Gatekeeping
          </h3>
          <div className="text-[10px] font-bold text-muted-foreground mt-1 uppercase">
            {isQuorum
              ? "Quorum Reachable / Executable"
              : `Pending consensus: ${uniqueSigners}/${governanceState.requiredSignatures}`}
          </div>
        </div>
        <Badge
          className={cn(
            "font-black italic text-[10px] tracking-widest border-none px-3 py-1",
            isQuorum
              ? "bg-success/20 text-success"
              : "bg-warning text-warning",
          )}
        >
          {isQuorum ? "UNLOCKED" : "LOCKED"}
        </Badge>
      </div>

      {!governanceState.isBypassMode ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {(Array.isArray(DEPARTMENTS) ? DEPARTMENTS : []).map((dept) => {
            const signature = signatures.find((s) => s.department === dept);
            return (
              <div
                key={dept}
                className="flex flex-col items-center p-5 rounded-3xl bg-secondary/60 border border-border space-y-4 hover:bg-secondary/60 transition-colors"
              >
                {signature ? (
                  <CheckCircle2 className="w-8 h-8 text-success drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]" />
                ) : (
                  <Lock className="w-8 h-8 text-muted-foreground" />
                )}
                <span className="text-[10px] font-black italic uppercase tracking-widest text-center h-8 flex items-center">
                  {dept}
                </span>
                {!signature && !isQuorum ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-full text-[9px] uppercase font-black italic tracking-widest text-primary hover:text-primary hover:bg-primary rounded-xl"
                    onClick={() => onSign(dept, false)}
                  >
                    Authenticate
                  </Button>
                ) : signature ? (
                  <div className="h-8 flex flex-col items-center justify-center">
                    <span className="text-[9px] font-black text-success/70 uppercase italic">
                      Verified
                    </span>
                  </div>
                ) : (
                  <div className="h-8" />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 bg-destructive rounded-3xl border border-destructive/20 space-y-6 mb-8 mt-2 shadow-[inset_0_0_50px_rgba(239,68,68,0.05)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-destructive">
              <ShieldAlert className="w-8 h-8 animate-pulse" />
              <div>
                <span className="block text-sm font-black italic uppercase tracking-widest text-destructive">
                  Superadmin Override Activated
                </span>
                <span className="text-[10px] font-bold text-destructive uppercase">
                  Warning: Changes will be irrevocably logged
                </span>
              </div>
            </div>
            <Badge className="bg-destructive text-foreground font-black italic text-[9px] uppercase border-none animate-pulse">
              HIGH PRIVILEGE
            </Badge>
          </div>
          <Input
            placeholder="MANDATORY: Enter Reason for Bypass Ledger..."
            className="bg-secondary border-destructive/50 focus:border-destructive focus-visible:ring-red-500/50 text-foreground placeholder:text-muted-foreground rounded-2xl font-bold italic h-14 pl-6"
            value={governanceState.bypassReason}
            onChange={(e) => onBypassReasonChange(e.target.value)}
          />
        </div>
      )}

      <div className="space-y-3 mb-8">
        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          <span>Consensus Progress</span>
          <span className={isQuorum ? "text-success" : "text-primary"}>
            {Math.round(progress)}%
          </span>
        </div>
        <Progress
          value={isQuorum ? 100 : progress}
          className="h-2.5 bg-secondary/60 rounded-full overflow-hidden"
          indicatorClassName={isQuorum ? "bg-success" : "bg-primary"}
        />
      </div>

      <div className="flex justify-end pt-6 border-t border-border/80">
        <Button
          variant="ghost"
          onClick={onToggleBypass}
          className={cn(
            "text-[10px] uppercase font-black italic tracking-widest h-10 px-6 rounded-xl transition-all",
            governanceState.isBypassMode
              ? "text-muted-foreground hover:text-foreground bg-secondary/60 hover:bg-secondary/60"
              : "text-destructive hover:text-destructive hover:bg-destructive",
          )}
        >
          {governanceState.isBypassMode
            ? "Cancel Override"
            : "Enable Superadmin Bypass"}
        </Button>
      </div>
    </Card>
  );
};
