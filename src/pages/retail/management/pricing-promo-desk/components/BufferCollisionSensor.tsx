import React from "react";
import { AlertTriangle, ShieldCheck, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface BufferCollisionSensorProps {
  currentStock: number;
  promoImpactEstimate: number;
  ecommerceBufferConfig: number;
}

export const BufferCollisionSensor: React.FC<BufferCollisionSensorProps> = ({
  currentStock,
  promoImpactEstimate,
  ecommerceBufferConfig,
}) => {
  const projectedStock = currentStock - promoImpactEstimate;
  const isCollision = projectedStock <= ecommerceBufferConfig;
  const bufferUtilization = Math.min(
    100,
    (promoImpactEstimate / Math.max(1, currentStock - ecommerceBufferConfig)) *
      100,
  );

  return (
    <Card
      className={cn(
        "p-6 md:p-8 rounded-2xl shadow-xl overflow-hidden relative border-none",
        isCollision ? "bg-destructive" : "bg-card",
      )}
    >
      {isCollision && (
        <AlertTriangle className="absolute -right-8 -top-8 w-48 h-48 text-destructive opacity-[0.03] group-hover:scale-110 transition-transform" />
      )}
      {!isCollision && (
        <ShieldCheck className="absolute -right-8 -top-8 w-48 h-48 text-success opacity-[0.03] group-hover:scale-110 transition-transform" />
      )}

      <div className="relative z-10 flex flex-col h-full justify-between">
        <div>
          <div className="flex justify-between items-start mb-6">
            <div
              className={cn(
                "p-4 rounded-2xl flex items-center justify-center",
                isCollision
                  ? "bg-destructive text-destructive shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                  : "bg-primary/5 text-primary",
              )}
            >
              <TrendingDown className="w-5 h-5" />
            </div>
            <div
              className={cn(
                "text-[9px] font-black italic uppercase tracking-widest px-4 py-1.5 rounded-full shadow-sm",
                isCollision
                  ? "bg-destructive text-foreground"
                  : "bg-secondary text-foreground",
              )}
            >
              E-Com Buffer Sensor
            </div>
          </div>

          <div className="mb-8">
            <div
              className={cn(
                "text-2xl font-black italic tracking-tighter mb-2",
                isCollision ? "text-destructive" : "text-foreground",
              )}
            >
              {isCollision ? "COLLISION DETECTED" : "SAFE ZONE"}
            </div>
            <div
              className={cn(
                "text-[10px] font-black uppercase italic tracking-widest",
                isCollision ? "text-destructive" : "text-muted-foreground",
              )}
            >
              Projected Final Stock:{" "}
              <span className="text-lg">{projectedStock}</span> units
            </div>
          </div>
        </div>

        <div className="space-y-3 mt-auto">
          <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-muted-foreground">
            <span>Safety Buffer: {ecommerceBufferConfig}</span>
            <span>Est. Impact: {promoImpactEstimate} units</span>
          </div>
          <Progress
            value={Math.max(0, bufferUtilization)}
            className={cn(
              "h-2.5 rounded-full bg-secondary/10",
              isCollision ? "bg-destructive" : "bg-secondary/10",
            )}
            indicatorClassName={
              isCollision
                ? "bg-destructive shadow-[0_0_10px_rgba(239,68,68,0.8)]"
                : "bg-primary"
            }
          />
          {isCollision && (
            <p className="text-[10px] font-bold text-destructive italic mt-3 uppercase">
              Warning: E-Commerce operational buffer will be breached
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};
