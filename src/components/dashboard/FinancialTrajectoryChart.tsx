import React from 'react';
import { 
  ComposedChart, 
  Area, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { useTheme } from 'next-themes';
import { WorkspacePanel } from '@/core/ui/WorkspacePanel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CHART_COLORS, CHART_COLORS_DARK, CHART_NEUTRAL, CHART_NEUTRAL_DARK } from '@/lib/chart-colors';

interface FinancialTrajectoryChartProps {
  data: { month: string; revenue: number; expenses: number; profit?: number }[];
  period: string;
  onPeriodChange: (period: string) => void;
}

export const FinancialTrajectoryChart: React.FC<FinancialTrajectoryChartProps> = ({ 
  data, 
  period,
  onPeriodChange 
}) => {
  const { theme } = useTheme();
  const colors = theme === 'dark' ? CHART_COLORS_DARK : CHART_COLORS;
  const neutral = theme === 'dark' ? CHART_NEUTRAL_DARK : CHART_NEUTRAL;
  const mutedFg = theme === 'dark' ? '#94a3b8' : '#64748b';
  const tooltipBg = theme === 'dark' ? '#1e293b' : '#ffffff';
  const tooltipBorder = theme === 'dark' ? CHART_NEUTRAL_DARK : CHART_NEUTRAL;
  const foreground = theme === 'dark' ? '#f8fafc' : '#0f172a';
  const dotStroke = theme === 'dark' ? '#1e293b' : '#ffffff';

  const formattedData = data.map(d => ({
    ...d,
    profit: d.revenue - d.expenses
  }));

  return (
    <div className="flex flex-col h-full rounded-2xl bg-card border border-border p-8 shadow-2xl card-premium">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h4 className="text-xl font-black italic uppercase tracking-tighter text-foreground">Financial Trajectory</h4>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Revenue vs OpEx vs Gross Profit</p>
        </div>
        <div className="flex gap-2 bg-secondary/50 p-1.5 rounded-2xl border border-border/50 backdrop-blur-xl">
          {['3M', '6M', '12M'].map((p) => (
            <Button 
              key={p}
              variant="ghost" 
              size="sm" 
              className={cn(
                "h-8 px-5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300",
                period === p 
                  ? "bg-primary text-primary-foreground-foreground shadow-lg shadow-primary/20" 
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
              onClick={() => onPeriodChange(p)}
            >
              {p}
            </Button>
          ))}
        </div>
      </div>

      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenuePremium" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors[1]} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={colors[1]} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={neutral} opacity={0.5} />
            <XAxis 
              dataKey="month" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fontWeight: 800, fill: mutedFg, textTransform: 'uppercase' }} 
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fontWeight: 800, fill: mutedFg }}
              tickFormatter={(value) => `Rp ${value / 1000}k`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: tooltipBg, 
                borderRadius: '1.5rem', 
                border: `1px solid ${tooltipBorder}`, 
                boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.2)',
                padding: '1rem'
              }}
              itemStyle={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}
              cursor={{ stroke: colors[1], strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Legend 
              verticalAlign="top" 
              align="right" 
              height={40} 
              iconType="circle" 
              wrapperStyle={{ paddingTop: '0px', paddingBottom: '20px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: foreground }}
            />
            <Area 
              type="monotone" 
              dataKey="revenue" 
              fill="url(#colorRevenuePremium)" 
              stroke={colors[1]} 
              strokeWidth={4} 
              animationDuration={1500}
            />
            <Bar 
              dataKey="expenses" 
              barSize={16} 
              fill={mutedFg} 
              radius={[4, 4, 0, 0]} 
              opacity={0.3} 
              animationDuration={2000}
            />
            <Line 
              type="monotone" 
              dataKey="profit" 
              stroke={colors[2]} 
              strokeWidth={4} 
              dot={{ r: 5, fill: colors[2], strokeWidth: 3, stroke: dotStroke }} 
              activeDot={{ r: 8, strokeWidth: 0 }}
              animationDuration={2500}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
