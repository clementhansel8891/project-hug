import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, Clock, BadgeDollarSign, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HrCapitalWidgetProps {
  distribution: { department: string; count: number; color: string }[];
}

export const HrCapitalWidget: React.FC<HrCapitalWidgetProps> = ({ distribution }) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full rounded-2xl border border-border bg-card p-8 shadow-xl transition-all duration-300 group overflow-hidden relative">
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div>
          <h4 className="text-xl font-black italic uppercase tracking-tighter text-foreground">Workforce Capital</h4>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Distribution and performance metrics</p>
        </div>
        <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center border border-border group-hover:bg-primary group-hover:border-primary transition-all">
          <Users className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 relative z-10">
        <div className="h-[200px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={distribution}
                innerRadius={60}
                outerRadius={85}
                paddingAngle={6}
                dataKey="count"
                stroke="none"
              >
                {distribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} className="group-hover:opacity-80 transition-opacity" />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
             <Heart className="h-6 w-6 text-destructive animate-pulse opacity-20" />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {distribution.slice(0, 5).map((dept, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: dept.color }} />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex-1 truncate">{dept.department}</span>
              <span className="text-xs font-black text-foreground">{dept.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-6 border-t border-border pt-8 relative z-10">
        <div className="flex flex-col gap-1 cursor-pointer group/stat" onClick={() => navigate('/core/hr/paycycle')}>
          <div className="flex items-center gap-2 text-muted-foreground group-hover/stat:text-destructive transition-colors">
            <BadgeDollarSign className="h-3.5 w-3.5" />
            <span className="text-[9px] font-black uppercase tracking-widest">Payroll Burn</span>
          </div>
          <p className="text-2xl font-black text-foreground tracking-tighter">Rp 2.76M<span className="text-[10px] font-bold text-muted-foreground ml-1">/bln</span></p>
        </div>
        <div className="flex flex-col gap-1 cursor-pointer group/stat text-right" onClick={() => navigate('/core/hr/people')}>
          <div className="flex items-center justify-end gap-2 text-muted-foreground group-hover/stat:text-primary transition-colors">
            <span className="text-[9px] font-black uppercase tracking-widest">Total Staff</span>
            <Users className="h-3.5 w-3.5" />
          </div>
          <p className="text-2xl font-black text-foreground tracking-tighter">{distribution.reduce((acc, curr) => acc + curr.count, 0)}</p>
        </div>
      </div>
      
      {/* Subtle background glow */}
      <div className="absolute -top-24 -left-24 h-48 w-48 bg-primary blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
    </div>
  );
};
