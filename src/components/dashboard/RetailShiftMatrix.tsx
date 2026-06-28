import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Store, User, Clock, CheckCircle2, AlertCircle, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Shift {
  id: string;
  store: string;
  status: string;
  cashier: string;
  openTime: string;
  closeTime?: string;
  reconciled: boolean;
}

interface RetailShiftMatrixProps {
  data: Shift[];
}

export const RetailShiftMatrix: React.FC<RetailShiftMatrixProps> = ({ data = [] }) => {
  const navigate = useNavigate();

  return (
    <div 
      className="flex flex-col h-full rounded-2xl border border-border bg-card p-8 shadow-2xl transition-all duration-500 hover:shadow-indigo-500/10 group cursor-pointer overflow-hidden relative"
      onClick={() => navigate('/m/retail/management')}
    >
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground border border-primary">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-xl font-black italic uppercase tracking-tighter text-foreground">Retail Shift Matrix</h4>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Live status of cashiers and reconciliation</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted border border-border">
           <span className="text-[10px] font-black text-foreground">{data.length}</span>
           <span className="text-[8px] font-bold text-muted-foreground ml-1 uppercase tracking-tighter">Active Shifts</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {data.map((shift, i) => (
          <div key={i} className="group/shift relative flex flex-col gap-6 rounded-3xl border border-border bg-white/2 p-6 transition-all hover:bg-muted hover:border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground group-hover/shift:text-primary transition-colors">
                <Store className="h-3.5 w-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">{shift.store}</span>
              </div>
              <div className={cn(
                "h-5 rounded-full px-2.5 flex items-center text-[8px] font-black uppercase tracking-widest border",
                shift.status === 'OPEN' ? 'bg-success text-success-foreground border-success/20' : 'bg-muted text-muted-foreground border-white/5'
              )}>
                {shift.status}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted border border-border text-foreground">
                <User className="h-6 w-6 opacity-40 group-hover/shift:opacity-100 transition-opacity" />
              </div>
              <div>
                <p className="text-sm font-black text-foreground tracking-tight">{shift.cashier}</p>
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground mt-1">
                  <Clock className="h-3 w-3" /> Opened {new Date(shift.openTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-border pt-4">
              <span className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] group-hover/shift:text-muted-foreground transition-colors">Reconciled</span>
              {shift.reconciled ? (
                <div className="flex items-center gap-1.5 text-success">
                   <span className="text-[8px] font-black uppercase">Cleared</span>
                   <CheckCircle2 className="h-4 w-4" />
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-destructive">
                   <span className="text-[8px] font-black uppercase animate-pulse">Pending</span>
                   <AlertCircle className="h-4 w-4 animate-pulse" />
                </div>
              )}
            </div>
            
            {/* Subtle highlight line */}
            <div className="absolute top-0 right-0 h-10 w-10 overflow-hidden pointer-events-none">
               <div className={cn(
                 "absolute -top-5 -right-5 h-10 w-10 rotate-45 transition-colors",
                 shift.reconciled ? "bg-success" : "bg-destructive"
               )} />
            </div>
          </div>
        ))}
      </div>
      
      {/* Decorative background glow */}
      <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-primary blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
    </div>
  );
};
