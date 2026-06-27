import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Layout } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { Trophy, TrendingUp, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BranchLeaderboardProps {
  data: { name: string; revenue: number; percentOfTotal?: number }[];
}

export const BranchLeaderboard: React.FC<BranchLeaderboardProps> = ({ data }) => {
  const navigate = useNavigate();

  const total = data.reduce((acc, curr) => acc + curr.revenue, 0);
  const formattedData = data.map(d => ({
    ...d,
    percentOfTotal: (d.revenue / total) * 100
  })).sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="flex flex-col h-full rounded-2xl border border-border bg-card p-8 shadow-2xl transition-all duration-500 hover:shadow-indigo-500/10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h4 className="text-xl font-black italic uppercase tracking-tighter text-foreground">Regional Performance</h4>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Top performing branches by revenue</p>
        </div>
        <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center border border-primary">
          <Trophy className="h-6 w-6 text-primary" />
        </div>
      </div>

      <div className="h-[280px] w-full">
        {formattedData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formattedData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fontWeight: 900, fill: '#64748b', textTransform: 'uppercase' }} 
                width={80}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-2xl border border-white/10 bg-card p-4 shadow-2xl backdrop-blur-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="h-3 w-3 text-primary" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{data.name}</p>
                        </div>
                        <p className="text-xl font-black text-foreground">Rp {(data.revenue / 1000).toFixed(1)}k</p>
                        <div className="mt-2 flex items-center gap-1.5">
                           <div className="h-1 w-12 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${data.percentOfTotal}%` }} />
                           </div>
                           <p className="text-[9px] font-bold text-muted-foreground">{data.percentOfTotal.toFixed(1)}% market share</p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar 
                dataKey="revenue" 
                radius={[0, 8, 8, 0]} 
                barSize={24}
                onClick={() => navigate('/m/retail/management')}
                className="cursor-pointer"
              >
                {formattedData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={index === 0 ? 'hsl(var(--primary))' : index === 1 ? 'hsl(var(--primary) / 0.75)' : index === 2 ? 'hsl(var(--primary) / 0.5)' : 'hsl(var(--primary) / 0.3)'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 opacity-40">
             <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center border border-border">
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
             </div>
             <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Awaiting Regional Telemetry</p>
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-4 gap-4 border-t border-border pt-6">
        {formattedData.slice(0, 4).map((d, i) => (
          <div key={i} className="group flex flex-col items-center text-center transition-all hover:-translate-y-1">
            <div className={cn(
              "mb-2 flex h-8 w-8 items-center justify-center rounded-xl font-black text-xs border transition-all",
              i === 0 ? "bg-primary border-primary/20 text-primary-foreground" :
              i === 1 ? "bg-primary/80 border-primary/20 text-primary-foreground" :
              i === 2 ? "bg-primary/60 border-primary/20 text-primary-foreground" :
              "bg-secondary border-border text-muted-foreground"
            )}>
              {i + 1}
            </div>
            <p className="text-[8px] font-black uppercase text-muted-foreground truncate w-full group-hover:text-foreground transition-colors">{d.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
