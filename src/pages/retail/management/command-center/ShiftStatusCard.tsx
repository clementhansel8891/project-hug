import React from "react";
import { Zap, Power, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { RetailShift } from "@/core/types/retail/retail";

interface ShiftStatusCardProps {
  activeShift: RetailShift | undefined;
}

export const ShiftStatusCard: React.FC<ShiftStatusCardProps> = ({
  activeShift,
}) => {
  const navigate = useNavigate();

  return (
    <Card
      className={cn(
        "lg:col-span-2 rounded-2xl border-4 transition-all shadow-2xl relative overflow-hidden group min-h-[220px] flex items-center p-6",
        activeShift
          ? "bg-secondary border-primary text-foreground"
          : "bg-card border-destructive/20 text-foreground",
      )}
    >
      {activeShift && (
        <Activity className="absolute -right-12 -top-6 w-64 h-64 opacity-5 text-primary group-hover:rotate-12 transition-transform duration-1000" />
      )}
      <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 w-full">
        <div
          className={cn(
            "w-24 h-24 rounded-[2rem] flex items-center justify-center shrink-0 border-2",
            activeShift
              ? "bg-primary border-primary shadow-[0_0_30px_rgba(37,99,235,0.3)]"
              : "bg-destructive border-destructive text-destructive",
          )}
        >
          {activeShift ? (
            <Zap className="w-10 h-10 text-foreground animate-pulse" />
          ) : (
            <Power className="w-10 h-10" />
          )}
        </div>
        <div className="flex-1 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
            <h2 className="text-2xl font-black italic tracking-tighter uppercase">
              {activeShift ? "Node Session Live" : "Terminals Locked"}
            </h2>
            {activeShift && (
              <Badge className="bg-success font-black italic animate-pulse">
                ACTIVE
              </Badge>
            )}
          </div>
          <p
            className={cn(
              "text-xs font-bold uppercase tracking-widest italic ",
              activeShift ? "text-primary" : "text-muted-foreground",
            )}
          >
            {activeShift
              ? `SID: ${activeShift.id} • Operator: ${activeShift.employeeId}`
              : "Branch requires manual initialization ritual."}
          </p>
        </div>
        <Button
          onClick={() => navigate("/m/retail/management/shifts")}
          className={cn(
            "h-14 px-10 rounded-2xl font-black italic uppercase tracking-widest text-xs shadow-xl transition-all",
            activeShift
              ? "bg-card text-foreground hover:bg-secondary/10"
              : "bg-destructive text-foreground hover:bg-destructive",
          )}
        >
          {activeShift ? "Manage Session" : "Go to Shift Control"}
        </Button>
      </div>
    </Card>
  );
};
