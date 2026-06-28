import React from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Printer } from "lucide-react";
import { cn } from "@/lib/utils";

export const LogisticsRadar = () => {
  return (
    <Card className="rounded-2xl bg-card border-border shadow-xl p-8 space-y-8">
      <div className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground">
        Logistics Radar
      </div>
      <div className="space-y-6">
        {[
          { courier: "JNE Regular", load: 65, status: "Normal" },
          { courier: "GrabExpress", load: 88, status: "High Load" },
          { courier: "SiCepat", load: 42, status: "Normal" },
        ].map((c, i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-between items-center italic">
              <span className="text-xs font-black text-muted-foreground">
                {c.courier}
              </span>
              <span
                className={cn(
                  "text-[9px] font-black",
                  c.load > 80 ? "text-warning" : "text-success",
                )}
              >
                {c.status}
              </span>
            </div>
            <Progress value={c.load} className="h-1.5 bg-secondary/5" />
          </div>
        ))}
      </div>
      <div className="p-4 rounded-2xl bg-primary/5 border border-primary flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center text-primary shadow-sm">
          <Printer className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[10px] font-black text-primary uppercase italic">
            Label Station B-2
          </div>
          <div className="text-[10px] text-primary font-bold uppercase italic tracking-tighter">
            Ready • 14 queued
          </div>
        </div>
      </div>
    </Card>
  );
};
