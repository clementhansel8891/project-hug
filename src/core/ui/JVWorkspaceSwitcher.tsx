import React, { useEffect, useState } from "react";
import { ChevronDown, Globe, LogOut, CheckCircle2, Shield, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { financeService } from "@/core/services/finance/financeService";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export function JVWorkspaceSwitcher() {
  const { session } = useAuth();
  const [participations, setParticipations] = useState<any[]>([]);
  const [currentJV, setCurrentJV] = useState<any>(null);

  useEffect(() => {
    if (session) {
      financeService.getJVParticipations(session).then(setParticipations);

      const saved = localStorage.getItem("zenvix_jv_context");
      if (saved) {
        setCurrentJV(JSON.parse(saved));
      }
    }
  }, [session]);

  const switchWorkspace = (participation: any) => {
    const context = {
      hostTenantId: participation.jv_profiles.tenant_id,
      branchId: participation.jv_profiles.scopes[0]?.branch_id,
      hostName: participation.jv_profiles.name,
      role: participation.role,
      profileId: participation.jv_profile_id,
    };
    localStorage.setItem("zenvix_jv_context", JSON.stringify(context));
    window.location.reload();
  };

  const exitJVMode = () => {
    localStorage.removeItem("zenvix_jv_context");
    window.location.reload();
  };

  if (!(Array.isArray(participations) && participations.length) && !currentJV) return null;

  const isOperator = currentJV?.role === "OPERATOR";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-2 border-dashed transition-all duration-300",
            currentJV
              ? isOperator
                ? "bg-primary/10 border-primary/50 text-primary hover:bg-primary/20"
                : "bg-warning/10 border-warning/50 text-warning hover:bg-warning/20"
              : "hover:bg-accent"
          )}
        >
          <Globe className={cn("w-4 h-4", currentJV && "animate-pulse")} />
          <span className="hidden sm:inline font-medium">
            {currentJV
              ? `${isOperator ? "Operating" : "Viewing"}: ${currentJV.hostName}`
              : "Partner Workspaces"
            }
          </span>
          {currentJV && (
            <Badge
              variant="outline"
              className={cn(
                "text-[9px] h-4 px-1",
                isOperator ? "border-primary/40 text-primary" : "border-warning/40 text-warning"
              )}
            >
              {isOperator ? "WRITE" : "READ"}
            </Badge>
          )}
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 glass-morphism border-border shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <DropdownMenuLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-3 py-2">
          Joint Venture Workspaces
        </DropdownMenuLabel>

        {currentJV && (
          <>
            <DropdownMenuItem
              onClick={exitJVMode}
              className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer font-semibold"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Exit JV Mode — Return Home
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-muted" />
          </>
        )}

        {(Array.isArray(participations) ? participations : []).map((p) => {
          const isSelected = currentJV?.hostTenantId === p.jv_profiles.tenant_id;
          const isOp = p.role === "OPERATOR";
          return (
            <DropdownMenuItem
              key={p.id}
              onClick={() => switchWorkspace(p)}
              className="flex flex-col items-start gap-1 py-3 px-3 cursor-pointer group"
            >
              <div className="flex items-center justify-between w-full">
                <span className={cn(
                  "font-bold text-sm transition-colors",
                  isSelected ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                )}>
                  {p.jv_profiles.name}
                </span>
                <div className="flex items-center gap-1">
                  {isOp ? (
                    <Pencil className="w-3 h-3 text-primary" />
                  ) : (
                    <Shield className="w-3 h-3 text-warning" />
                  )}
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-primary animate-in zoom-in" />}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[9px] h-4",
                    isOp ? "border-primary/30 text-primary" : "border-warning/30 text-warning"
                  )}
                >
                  {p.role}
                </Badge>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  {p.jv_profiles.scopes[0]?.branch_id ? "Branch-Level" : "Company-Level"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Rev: {Number(p.revenue_share_pct)}%
                </span>
              </div>
            </DropdownMenuItem>
          );
        })}

        {participations.length === 0 && !currentJV && (
          <div className="px-3 py-4 text-center">
            <p className="text-xs text-muted-foreground italic">No partner invitations found</p>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
