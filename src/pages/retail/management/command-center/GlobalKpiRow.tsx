import React from "react";
import { GlobalKpis } from "@/core/types/retail/analytics";
import {
  TrendingUp,
  ShoppingCart,
  CreditCard,
  Users,
  Smartphone,
  AlertTriangle,
  Target,
  Percent,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { CHART_COLORS } from "@/lib/chart-colors";

interface GlobalKpiRowProps {
  kpis: GlobalKpis;
}

export const GlobalKpiRow: React.FC<GlobalKpiRowProps> = ({ kpis }) => {
  // Map semantic color keys to hardcoded hex values for Recharts SVG props.
  // CSS variables cannot be resolved inside Recharts SVG rendering.
  const colorKeyToHex = (colorKey: string): string => {
    const map: Record<string, string> = {
      success:     CHART_COLORS.success,
      primary:     CHART_COLORS.primary,
      secondary:   '#94a3b8',  // slate-400 neutral
      muted:       '#94a3b8',  // slate-400
      accent:      CHART_COLORS.primary,
      warning:     CHART_COLORS.warning,
      info:        CHART_COLORS.info,
      destructive: '#ef4444',  // red-500
    };
    return map[colorKey] ?? CHART_COLORS[1];
  };

  const sparklineWrapper = (data: number[] | undefined, colorClass: string) => {
    if (!data) return null;
    // Use hardcoded hex — Recharts renders to SVG and cannot resolve hsl(var(--*))
    const hexColor = colorKeyToHex(colorClass);
    return (
      <div className="h-10 w-full mt-2 opacity-50">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={(Array.isArray(data) ? data : []).map((v) => ({ v }))}>
            <defs>
              <linearGradient id={`color-${colorClass}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={hexColor} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={hexColor} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={hexColor}
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#color-${colorClass})`}
              isAnimationActive={true}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const items = [
    {
      label: "Live Revenue",
      value: `Rp ${(kpis.totalRevenueToday / 1000000).toFixed(1)}M`,
      icon: TrendingUp,
      iconClass: "text-success",
      colorKey: "success",
      accent: "bg-success/20",
      border: "hover:border-success/30",
      sparkline: kpis.sparklineData?.revenue,
    },
    {
      label: "Target Velocity",
      value: `${kpis.revenueVsTarget}%`,
      icon: Target,
      iconClass: "text-primary",
      colorKey: "primary",
      accent: "bg-primary/20",
      border: "hover:border-primary/30",
      sparkline: kpis.sparklineData?.conversion,
    },
    {
      label: "Order Traffic",
      value: kpis.orderCount,
      icon: ShoppingCart,
      iconClass: "text-secondary",
      colorKey: "secondary",
      accent: "bg-secondary/20",
      border: "hover:border-secondary/30",
      sparkline: kpis.sparklineData?.orders,
    },
    {
      label: "Avg Ticket",
      value: `Rp ${(kpis.avgTicketSize / 1000).toFixed(0)}k`,
      icon: CreditCard,
      iconClass: "text-muted-foreground",
      colorKey: "muted",
      accent: "bg-muted/40",
      border: "hover:border-muted/30",
      sparkline: kpis.sparklineData?.ticket,
    },
    {
      label: "Profit Margin",
      value: `${kpis.grossMarginPercentage}%`,
      icon: Percent,
      iconClass: "text-accent",
      colorKey: "accent",
      accent: "bg-accent/20",
      border: "hover:border-accent/30",
    },
    {
      label: "Node Health",
      value: kpis.activeDevices,
      icon: Smartphone,
      iconClass: "text-warning",
      colorKey: "warning",
      accent: "bg-warning/20",
      border: "hover:border-warning/30",
    },
    {
      label: "Active Shifts",
      value: kpis.openShifts,
      icon: Users,
      iconClass: "text-info",
      colorKey: "info",
      accent: "bg-info/20",
      border: "hover:border-info/30",
    },
    {
      label: "System Alerts",
      value: kpis.criticalAlertsCount,
      icon: AlertTriangle,
      iconClass: "text-destructive",
      colorKey: "destructive",
      accent: "bg-destructive/20",
      border: "hover:border-destructive/30",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {(Array.isArray(items) ? items : []).map((item, idx) => (
        <div
          key={idx}
          className={`relative bg-card backdrop-blur-3xl p-4 rounded-xl border border-border shadow-xl transition-all duration-500 ${item.border} hover:bg-card hover:-translate-y-0.5 cursor-default group flex flex-col justify-between min-h-[130px] overflow-hidden`}
        >
          {/* Subtle Background Glow */}
          <div
            className={`absolute -right-6 -top-6 w-20 h-20 rounded-full opacity-10 blur-[50px] transition-all duration-700 group-hover:scale-150 ${item.accent}`}
          />

          <div className="flex items-center justify-between relative z-10">
            <div
              className={`w-9 h-9 rounded-lg ${item.accent} flex items-center justify-center transition-all duration-500 group-hover:rotate-6 border border-border shadow-lg`}
            >
              <item.icon className={`w-4 h-4 ${item.iconClass}`} />
            </div>
            {idx < 2 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-success/10 border border-success/20 animate-pulse">
                <div className="w-1 h-1 rounded-full bg-success shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                <span className="text-[7px] font-black text-success uppercase tracking-widest italic">
                  LIVE
                </span>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col relative z-10">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-0.5 italic">
              {item.label}
            </p>
            <div className="flex items-end justify-between gap-3">
              <p className="text-lg font-black italic text-foreground tracking-tighter whitespace-nowrap">
                {item.value}
              </p>
              {item.sparkline && (
                <div className="flex-1 max-w-[60px]">
                  {sparklineWrapper(item.sparkline, item.colorKey)}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
