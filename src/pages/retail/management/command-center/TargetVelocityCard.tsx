import React from "react";
import { TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface TargetVelocityCardProps {
  velocity: number;
  projection: string;
}

export const TargetVelocityCard: React.FC<TargetVelocityCardProps> = ({
  velocity,
  projection,
}) => {
  return (
    <Card className="rounded-2xl bg-primary text-foreground p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between group">
      <TrendingUp className="absolute -left-12 -bottom-12 w-48 h-48 opacity-10 group-hover:scale-110 transition-transform" />
      <div className="relative z-10">
        <div className="text-[10px] font-black uppercase tracking-[0.3em]  mb-2">
          Target Velocity
        </div>
        <div className="text-3xl font-black italic tracking-tighter">
          {velocity}%
        </div>
        <Progress value={velocity} className="h-1.5 bg-white/10 mt-4" />
      </div>
      <div className="relative z-10 space-y-2">
        <div className="text-[10px] font-bold italic uppercase ">
          Revenue Projection
        </div>
        <div className="flex justify-between items-center text-sm font-black italic">
          <span>Next Hour</span>
          <span className="text-success">+{projection}</span>
        </div>
      </div>
    </Card>
  );
};
