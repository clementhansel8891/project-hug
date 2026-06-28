import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Server } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SystemHealthDonutProps {
  data: { name: string; value: number; color: string }[];
}

export const SystemHealthDonut: React.FC<SystemHealthDonutProps> = ({ data }) => {
  const navigate = useNavigate();
  const total = data.reduce((acc, curr) => acc + curr.value, 0);
  const optimal = data.find(d => d.name === 'Optimal')?.value || 0;
  const percentage = total > 0 ? Math.round((optimal / total) * 100) : 0;

  return (
    <div 
      className="flex flex-col h-full rounded-2xl border border-border bg-card p-8 shadow-2xl transition-all duration-500 group cursor-pointer overflow-hidden relative"
      onClick={() => navigate('/core/it/health')}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h4 className="text-lg font-black italic uppercase tracking-tighter text-foreground">Core Integrity</h4>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Service uptime & health</p>
        </div>
        <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center border border-border group-hover:bg-success group-hover:border-success/20 transition-all">
          <Server className="h-5 w-5 text-muted-foreground group-hover:text-success transition-colors" />
        </div>
      </div>

      <div className="relative h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              innerRadius={65}
              outerRadius={90}
              paddingAngle={6}
              dataKey="value"
              stroke="none"
              animationBegin={0}
              animationDuration={1500}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color} 
                  className="transition-all duration-500 group-hover:opacity-80"
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-4xl font-black text-foreground tracking-tighter">{percentage}%</p>
          <div className="flex items-center gap-1.5 mt-1">
             <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
             <p className="text-[10px] font-black uppercase text-success tracking-widest">Stable</p>
          </div>
        </div>
      </div>

      <div className="mt-4 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground group-hover:text-foreground transition-colors">
          {optimal} / {total} Infrastructure nodes active
        </p>
      </div>
      
      {/* Subtle background glow */}
      <div className="absolute -bottom-10 -right-10 h-32 w-32 bg-success blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
    </div>
  );
};
