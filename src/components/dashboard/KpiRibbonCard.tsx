import React from 'react';
import { cn } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight, Minus, LucideIcon } from 'lucide-react';
import * as Icons from 'lucide-react';
import { ResponsiveContainer, LineChart, Line } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/lib/format';

interface KpiRibbonCardProps {
  label: string;
  value: string | number;
  delta?: string;
  trend?: 'up' | 'down' | 'flat';
  sparklineData?: number[];
  icon: string;
  navigateTo?: string;
  currency?: boolean;
}

export const KpiRibbonCard: React.FC<KpiRibbonCardProps> = ({
  label,
  value,
  delta,
  trend = 'flat',
  sparklineData = [30, 40, 35, 50, 49, 60, 70, 91],
  icon,
  navigateTo,
  currency
}) => {
  const navigate = useNavigate();
  const IconComponent = (Icons as any)[icon] || Icons.HelpCircle;

  const trendStyles = {
    up: "text-success-foreground bg-success border-success/20",
    down: "text-destructive-foreground bg-destructive border-destructive/20",
    flat: "text-warning-foreground bg-warning border-warning/20"
  };

  const trendIcons = {
    up: ArrowUpRight,
    down: ArrowDownRight,
    flat: Minus
  };

  const TrendIcon = trendIcons[trend];
  const chartData = sparklineData.map((val, i) => ({ value: val, index: i }));

  return (
    <div 
      onClick={() => navigateTo && navigate(navigateTo)}
      className={cn(
        "group relative flex flex-col gap-6 rounded-2xl bg-card border border-border p-7 shadow-xl overflow-hidden transition-all duration-300 hover:shadow-2xl",
        navigateTo && "cursor-pointer"
      )}
    >
      <div className="flex items-start justify-between relative z-10">
        <div className={cn("rounded-2xl p-4 transition-all duration-500", trendStyles[trend], "group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-lg group-hover:shadow-primary/30")}>
          <IconComponent className="h-6 w-6" />
        </div>
        <div className="h-10 w-20 opacity-30 group-hover:opacity-100 transition-opacity duration-700">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={trend === 'up' ? 'hsl(var(--success))' : trend === 'down' ? 'hsl(var(--destructive))' : 'hsl(var(--warning))'} 
                strokeWidth={3} 
                dot={false} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-2 relative z-10">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
        <h3 className="text-4xl font-black tracking-tighter text-foreground">
          {currency ? (typeof value === 'number' ? formatCurrency(value) : value) : value}
        </h3>
      </div>

      <div className="flex items-center gap-3 relative z-10">
        <div className={cn("flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black border", trendStyles[trend])}>
          <TrendIcon className="h-3 w-3" />
          {delta || (trend === 'up' ? '+12%' : trend === 'down' ? '-5%' : '0%')}
        </div>
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">vs last period</span>
      </div>

      {/* Premium background glow */}
      <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-primary/5 blur-[50px] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
    </div>
  );
};
