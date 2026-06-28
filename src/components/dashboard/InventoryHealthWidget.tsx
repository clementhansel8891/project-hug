import React from 'react';
import { Package, AlertTriangle, ArrowRight, BarChart2, Boxes } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface InventoryHealthWidgetProps {
  data?: { totalSkus: number; lowStock: number; turnoverRate: number };
}

export const InventoryHealthWidget: React.FC<InventoryHealthWidgetProps> = ({ data: propData }) => {
  const navigate = useNavigate();

  const metrics = [
    { label: 'Low Stock SKUs', value: propData?.lowStock ?? 24, icon: AlertTriangle, color: 'text-destructive-foreground', bg: 'bg-destructive', border: 'border-destructive/20' },
    { label: 'Total SKUs', value: propData?.totalSkus ?? 1240, icon: Package, color: 'text-primary-foreground', bg: 'bg-primary', border: 'border-primary' },
    { label: 'Turnover Rate', value: `${propData?.turnoverRate ?? 4.2}x`, icon: BarChart2, color: 'text-success-foreground', bg: 'bg-success', border: 'border-success/20' },
  ];

  return (
    <div className="flex flex-col h-full rounded-2xl border border-border bg-card p-8 shadow-2xl transition-all duration-500 hover:shadow-indigo-500/10 group overflow-hidden relative">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-muted-foreground border border-border group-hover:text-foreground transition-colors">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-[0.15em] text-foreground">Inventory Health</h4>
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Stock levels & velocity</p>
          </div>
        </div>
        <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center border border-border">
           <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
      </div>

      <div className="space-y-4">
        {metrics.map((m, i) => (
          <div key={i} className={cn(
            "flex items-center justify-between rounded-2xl border p-4 transition-all hover:bg-white/5",
            m.bg, m.border
          )}>
            <div className="flex items-center gap-4">
              <div className={cn("rounded-xl p-2 bg-muted border border-border", m.color)}>
                <m.icon className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{m.label}</span>
            </div>
            <span className="text-xl font-black text-foreground">{m.value}</span>
          </div>
        ))}
      </div>
      
      <button 
        onClick={() => navigate('/core/inventory/stock')}
        className="mt-6 w-full py-4 rounded-2xl border border-border bg-white/5 text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground hover:bg-primary hover:text-foreground hover:border-primary transition-all active:scale-[0.98]"
      >
        ANALYSIS CONSOLE
      </button>
      
      {/* Subtle corner glow */}
      <div className="absolute -bottom-16 -right-16 h-32 w-32 bg-primary blur-[60px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
    </div>
  );
};
