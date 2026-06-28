import React from "react";
import { Smartphone, Plus, ArrowUpRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { BranchDevice } from "@/core/types/retail/retail";

interface TerminalNetworkHealthProps {
  devices: BranchDevice[];
}

export const TerminalNetworkHealth: React.FC<TerminalNetworkHealthProps> = ({
  devices,
}) => {
  const navigate = useNavigate();

  return (
    <Card className="rounded-2xl bg-secondary border-none shadow-2xl overflow-hidden group">
      <CardHeader className="p-8 pb-4">
        <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-primary italic">
          Terminal Network Health
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8 pt-0 space-y-6">
        <div className="grid grid-cols-4 gap-3">
          {devices.length > 0 ? (
            (Array.isArray(devices) ? devices : []).map((d, i) => (
              <div
                key={i}
                className={cn(
                  "aspect-square rounded-xl flex items-center justify-center transition-all",
                  d.isActive
                    ? "bg-primary/20 border border-primary text-primary"
                    : "bg-destructive border border-destructive/30 text-destructive",
                )}
              >
                <Smartphone className="w-4 h-4" />
              </div>
            ))
          ) : (
            <div className="col-span-4 text-[10px] font-bold text-muted-foreground italic uppercase py-4">
              No Terminals Registered
            </div>
          )}
          <button
            onClick={() => navigate("/m/retail/management/devices")}
            className="aspect-square rounded-xl bg-secondary/40 border border-border flex items-center justify-center text-foreground/40 cursor-pointer hover:bg-muted/10 hover:text-foreground transition-all"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <Separator className="bg-white/10" />
        <div className="flex justify-between items-center">
          <div className="text-[10px] font-black italic text-muted-foreground uppercase">
            Status: <span className="text-primary">Stable</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs font-black italic text-foreground/40 hover:text-foreground p-0 h-auto"
            onClick={() => navigate("/m/retail/management/devices")}
          >
            Remote Hub <ArrowUpRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
