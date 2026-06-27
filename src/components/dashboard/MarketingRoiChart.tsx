import React from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { Megaphone, TrendingUp, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarketingRoiChartProps {
  data: { week: string; adSpend: number; sales: number; roi?: number }[];
}

export const MarketingRoiChart: React.FC<MarketingRoiChartProps> = ({ data = [] }) => {
  const navigate = useNavigate();

  const formattedData = data.map(d => ({
    ...d,
    roi: d.adSpend > 0 ? (d.sales / d.adSpend) : 0
  }));

  return (
    <div 
      className="flex flex-col h-full rounded-[3rem] border border-border bg-card p-10 shadow-2xl transition-all duration-500 hover:shadow-indigo-500/10 group cursor-pointer overflow-hidden relative"
      onClick={() => navigate('/core/marketing/analytics')}
    >
      <div className="flex items-center justify-between mb-10 relative z-10">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground border border-primary">
            <Megaphone className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-xl font-black italic uppercase tracking-tighter text-foreground">Marketing ROI</h4>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Spend vs Gross Sales Efficiency</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/5">
           <TrendingUp className="h-4 w-4 text-success" />
           <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Growth Phase</span>
        </div>
      </div>

      <div className="h-[320px] w-full relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={formattedData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#475569', textTransform: 'uppercase' }} />
            <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#475569' }} tickFormatter={(val) => `Rp ${val/1000}k`} />
            <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#475569' }} tickFormatter={(val) => `${val}x`} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#0f172a', 
                borderRadius: '1.5rem', 
                border: '1px solid rgba(255,255,255,0.1)', 
                boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.5)',
                padding: '1rem'
              }}
              itemStyle={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}
            />
            <Legend 
              verticalAlign="top" 
              align="right" 
              height={40} 
              iconType="circle" 
              wrapperStyle={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}
            />
            <Bar 
              yAxisId="left" 
              dataKey="sales" 
              fill="#6366f1" 
              radius={[10, 10, 0, 0]} 
              barSize={32} 
              animationDuration={1500}
            />
            <Line 
              yAxisId="left" 
              type="monotone" 
              dataKey="adSpend" 
              stroke="#f43f5e" 
              strokeWidth={4} 
              dot={{ r: 5, fill: '#f43f5e', strokeWidth: 3, stroke: '#0f172a' }} 
              animationDuration={2000}
            />
            <Line 
              yAxisId="right" 
              type="monotone" 
              dataKey="roi" 
              stroke="#10b981" 
              strokeWidth={4} 
              strokeDasharray="8 8" 
              dot={{ r: 5, fill: '#10b981', strokeWidth: 3, stroke: '#0f172a' }} 
              animationDuration={2500}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      {/* Subtle background glow */}
      <div className="absolute -bottom-24 -left-24 h-48 w-48 bg-destructive blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
    </div>
  );
};
