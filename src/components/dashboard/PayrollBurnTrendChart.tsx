import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { CreditCard, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PayrollBurnTrendChartProps {
  data?: Array<{ month: string; gross: number }> | null;
}

export const PayrollBurnTrendChart: React.FC<PayrollBurnTrendChartProps> = ({ data: propData }) => {
  const navigate = useNavigate();

  const defaultData = [
    { month: 'Jan', gross: 175000 },
    { month: 'Feb', gross: 178000 },
    { month: 'Mar', gross: 182000 },
    { month: 'Apr', gross: 184000 },
    { month: 'May', gross: 184000 },
    { month: 'Jun', gross: 189000 },
  ];

  const data = propData && propData.length > 0 ? propData : defaultData;

  return (
    <div 
      className="flex flex-col h-full rounded-2xl border border-border bg-card p-8 shadow-2xl transition-all duration-500 hover:shadow-rose-500/10 group cursor-pointer overflow-hidden relative"
      onClick={() => navigate('/core/hr/paycycle')}
    >
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div>
          <h4 className="text-lg font-black italic uppercase tracking-tighter text-foreground">Payroll Burn Trend</h4>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Monthly expenditure trajectory</p>
        </div>
        <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center border border-border group-hover:bg-destructive transition-all">
          <CreditCard className="h-5 w-5 text-muted-foreground group-hover:text-destructive transition-colors" />
        </div>
      </div>

      <div className="h-[200px] w-full relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#475569', textTransform: 'uppercase' }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#475569' }} tickFormatter={(val) => `Rp ${val/1000}k`} />
            <Tooltip 
              cursor={{ fill: 'rgba(255,255,255,0.02)' }}
              contentStyle={{ 
                backgroundColor: '#0f172a', 
                borderRadius: '1.25rem', 
                border: '1px solid rgba(255,255,255,0.1)', 
                boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.5)',
                padding: '0.75rem'
              }}
              itemStyle={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}
            />
            <Bar dataKey="gross" radius={[8, 8, 0, 0]} barSize={28} animationDuration={1500}>
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={index === data.length - 1 ? '#f43f5e' : '#1e293b'} 
                  className="transition-all duration-500 group-hover:opacity-80"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-4 flex items-center justify-between opacity-50 relative z-10">
         <div className="flex items-center gap-2">
            <TrendingUp className="h-3 w-3 text-destructive" />
            <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Projected 3% increase next quarter</span>
         </div>
      </div>
      
      {/* Subtle background glow */}
      <div className="absolute -bottom-10 -right-10 h-32 w-32 bg-destructive blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
    </div>
  );
};
