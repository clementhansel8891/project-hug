import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, TrendingUp, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SalesPipelineFunnelProps {
  data?: { leads: number; qualified: number; proposal: number; negotiation: number; won: number };
}

export const SalesPipelineFunnel: React.FC<SalesPipelineFunnelProps> = ({ data: propData }) => {
  const navigate = useNavigate();

  const stages = [
    { label: 'Leads', value: propData?.leads ?? 450, width: '100%', color: 'bg-primary', glow: 'shadow-indigo-500/20' },
    { label: 'Qualified', value: propData?.qualified ?? 280, width: '85%', color: 'bg-primary', glow: 'shadow-indigo-500/10' },
    { label: 'Proposal', value: propData?.proposal ?? 120, width: '70%', color: 'bg-primary', glow: 'shadow-indigo-500/10' },
    { label: 'Negotiation', value: propData?.negotiation ?? 45, width: '55%', color: 'bg-primary', glow: 'shadow-indigo-500/10' },
    { label: 'Won', value: propData?.won ?? 32, width: '40%', color: 'bg-success', glow: 'shadow-emerald-500/30' },
  ];

  return (
    <div 
      className="flex flex-col h-full rounded-[3rem] border border-border bg-card p-10 shadow-2xl transition-all duration-500 hover:shadow-indigo-500/10 group cursor-pointer overflow-hidden relative"
      onClick={() => navigate('/core/sales/pipeline')}
    >
      <div className="flex items-center justify-between mb-10 relative z-10">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground border border-primary">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-xl font-black italic uppercase tracking-tighter text-foreground">Sales Pipeline</h4>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Conversion from lead to closed-won</p>
          </div>
        </div>
        <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center border border-border group-hover:bg-primary transition-all">
          <Target className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 py-2 relative z-10">
        {stages.map((s, i) => (
          <div key={i} className="group/stage relative flex w-full flex-col items-center">
            <div 
              style={{ width: s.width }} 
              className={cn(
                "h-10 rounded-2xl shadow-2xl transition-all duration-500 group-hover/stage:scale-[1.03] flex items-center justify-between px-6 border border-border",
                s.color, s.glow
              )}
            >
              <span className="text-[10px] font-black text-foreground uppercase tracking-widest">{s.label}</span>
              <span className="text-xs font-black text-foreground">{s.value}</span>
            </div>
            {i < stages.length - 1 && (
              <div className="h-2 w-0.5 bg-white/5 group-hover/stage:bg-white/20 transition-colors" />
            )}
          </div>
        ))}
      </div>
      
      <div className="mt-8 pt-6 border-t border-border flex items-center justify-between opacity-50">
         <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-success" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Win Rate</span>
         </div>
         <span className="text-lg font-black text-foreground">7.1%</span>
      </div>
      
      {/* Subtle background glow */}
      <div className="absolute -bottom-24 -left-24 h-48 w-48 bg-primary blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
    </div>
  );
};
