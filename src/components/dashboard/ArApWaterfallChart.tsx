import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { useTheme } from 'next-themes';
import { useNavigate } from 'react-router-dom';
import { Wallet, TrendingUp, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CHART_COLORS, CHART_COLORS_DARK, CHART_NEUTRAL, CHART_NEUTRAL_DARK } from '@/lib/chart-colors';

export const ArApWaterfallChart: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const colors = theme === 'dark' ? CHART_COLORS_DARK : CHART_COLORS;
  const neutral = theme === 'dark' ? CHART_NEUTRAL_DARK : CHART_NEUTRAL;
  const mutedFg = theme === 'dark' ? '#94a3b8' : '#64748b';
  const tooltipBg = theme === 'dark' ? '#1e293b' : '#ffffff';
  const tooltipBorder = theme === 'dark' ? CHART_NEUTRAL_DARK : CHART_NEUTRAL;
  const destructive = theme === 'dark' ? '#f87171' : '#dc2626';
  
  const data = [
    { bucket: 'Current', ar: 45000, ap: 32000 },
    { bucket: '1-30d', ar: 28000, ap: 15000 },
    { bucket: '31-60d', ar: 12000, ap: 8000 },
    { bucket: '61-90d', ar: 5000, ap: 12000 },
    { bucket: '90d+', ar: 8000, ap: 4000 },
  ];

  return (
    <div className="flex flex-col h-full rounded-2xl bg-card border border-border p-8 shadow-xl overflow-hidden group">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h4 className="text-xl font-black italic uppercase tracking-tighter text-foreground">AR/AP Aging Waterfall</h4>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Accounts Receivable vs Payable Aging Buckets</p>
        </div>
        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
          <Wallet className="h-6 w-6 text-primary" />
        </div>
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={neutral} opacity={0.5} />
            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: mutedFg }} />
            <YAxis 
              dataKey="bucket" 
              type="category" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 9, fontWeight: 900, fill: mutedFg, textTransform: 'uppercase' }} 
              width={60}
            />
            <Tooltip 
              cursor={{ fill: colors[1], opacity: 0.05 }}
              contentStyle={{ 
                backgroundColor: tooltipBg, 
                borderRadius: '1.5rem', 
                border: `1px solid ${tooltipBorder}`, 
                boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.2)',
                padding: '1rem'
              }}
              itemStyle={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}
            />
            <Bar 
              dataKey="ar" 
              fill={colors[2]} 
              radius={[0, 6, 6, 0]} 
              barSize={16}
              onClick={() => navigate('/core/finance/receivables')} 
              className="cursor-pointer"
              animationDuration={1500}
            />
            <Bar 
              dataKey="ap" 
              fill={destructive} 
              radius={[0, 6, 6, 0]} 
              barSize={16}
              onClick={() => navigate('/core/finance/payables')} 
              className="cursor-pointer"
              animationDuration={2000}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6 border-t border-border/50 pt-6">
        <div className="group/metric flex flex-col items-center text-center p-4 rounded-2xl bg-secondary/30 transition-all hover:bg-secondary/50">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover/metric:text-success transition-colors">Net Working Cap</p>
          <div className="flex items-center gap-2 mt-2">
            <ArrowUpRight className="h-4 w-4 text-success" />
            <p className="text-2xl font-black text-foreground">Rp 405jt</p>
          </div>
        </div>
        <div className="group/metric flex flex-col items-center text-center p-4 rounded-2xl bg-secondary/30 transition-all hover:bg-secondary/50">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover/metric:text-primary transition-colors">Collection Ratio</p>
          <div className="flex items-center gap-2 mt-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <p className="text-2xl font-black text-foreground">92.4%</p>
          </div>
        </div>
      </div>
      
      {/* Subtle decorative glow */}
      <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-primary/5 blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
    </div>
  );
};
