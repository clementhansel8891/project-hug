import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPICardProps {
  title: string;
  value: number | string;
  trend?: "UP" | "DOWN" | "NEUTRAL";
  inverseColor?: boolean;
  icon?: React.ReactNode;
  format?: "currency" | "text";
}

export const KPICard: React.FC<KPICardProps> = ({ title, value, trend, inverseColor, icon, format }) => {
  const isPositive = inverseColor ? trend === "DOWN" : trend === "UP";
  const isNegative = inverseColor ? trend === "UP" : trend === "DOWN";

  const formattedValue =
    typeof value === "string" || format === "text"
      ? String(value)
      : new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(Number.isFinite(value) ? value : 0);

  return (
    <Card className="flex-1 min-w-[200px] border-l-4 border-l-primary/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-bold uppercase text-muted-foreground">
          {title}
        </CardTitle>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          {trend === "UP" && <TrendingUp size={16} className={cn(isPositive ? "text-success" : "text-destructive")} />}
          {trend === "DOWN" && <TrendingDown size={16} className={cn(isNegative ? "text-destructive" : "text-success")} />}
          {trend === "NEUTRAL" && <Minus size={16} className="text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formattedValue}</div>
        <p className="text-[10px] text-muted-foreground mt-1">Sequence-validated snapshot value</p>
      </CardContent>
    </Card>
  );
};
