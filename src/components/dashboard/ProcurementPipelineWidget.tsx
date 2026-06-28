import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, FileText, CheckCircle, Truck, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProcurementPipelineWidgetProps {
  data?: { draft: number; review: number; approved: number; delivered: number };
}

export const ProcurementPipelineWidget: React.FC<ProcurementPipelineWidgetProps> = ({ data: propData }) => {
  const navigate = useNavigate();

  const stages = [
    { label: 'Draft', value: propData?.draft ?? 5, icon: FileText, color: 'text-muted-foreground', glow: 'shadow-slate-500/10' },
    { label: 'Review', value: propData?.review ?? 12, icon: ShoppingCart, color: 'text-warning', glow: 'shadow-amber-500/30' },
    { label: 'Approved', value: propData?.approved ?? 8, icon: CheckCircle, color: 'text-primary', glow: 'shadow-indigo-500/30' },
    { label: 'Delivered', value: propData?.delivered ?? 24, icon: Truck, color: 'text-success', glow: 'shadow-emerald-500/30' },
  ];

  return (
    <div 
      className="flex flex-col h-full rounded-[3rem] border border-border bg-card p-10 shadow-2xl transition-all duration-500 hover:shadow-indigo-500/10 group cursor-pointer overflow-hidden relative"
      onClick={() => navigate('/core/procurement/prs')}
    >
      <div className="flex items-center justify-between mb-10 relative z-10">
        <div>
          <h4 className="text-xl font-black italic uppercase tracking-tighter text-foreground">Procurement Flow</h4>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active purchase requests and fulfillment</p>
        </div>
        <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center border border-primary">
          <Package className="h-6 w-6 text-primary" />
        </div>
      </div>

      <div className="relative mt-4 mb-8 z-10">
        <div className="absolute left-0 top-8 h-1 w-full bg-muted rounded-full" />
        <div className="relative flex justify-between">
          {stages.map((s, i) => (
            <div key={i} className="flex flex-col items-center gap-4 group/stage">
              <div className={cn(
                "z-10 flex h-16 w-16 items-center justify-center rounded-[1.5rem] border-4 border-border bg-muted shadow-2xl transition-all duration-500 group-hover/stage:scale-110",
                s.color
              )}>
                <s.icon className={cn("h-6 w-6 transition-all", s.glow)} />
              </div>
              <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover/stage:text-foreground transition-colors">{s.label}</p>
                <p className="text-xl font-black text-foreground mt-1">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto border-t border-border pt-8 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
           <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
           <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Open PO Value</span>
        </div>
        <span className="text-2xl font-black text-primary tracking-tighter">Rp 432.5jt</span>
      </div>
      
      {/* Subtle background glow */}
      <div className="absolute -bottom-24 -left-24 h-48 w-48 bg-success blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
    </div>
  );
};
