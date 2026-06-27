import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { Wallet, Landmark, CreditCard, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CashPositionWidgetProps {
  data?: { bankAccounts: number; digitalWallets: number; creditLines: number; runway: number };
}

export const CashPositionWidget: React.FC<CashPositionWidgetProps> = ({ data: propData }) => {
  const navigate = useNavigate();

  const chartData = [
    { name: 'Bank Accounts', value: propData?.bankAccounts ?? 750000, color: '#6366f1', icon: Landmark },
    { name: 'Digital Wallets', value: propData?.digitalWallets ?? 120000, color: '#10b981', icon: Wallet },
    { name: 'Credit Lines', value: propData?.creditLines ?? 500000, color: '#f59e0b', icon: CreditCard },
  ];

  const runway = propData?.runway ?? 184;
  const total = chartData.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div 
      className="flex flex-col h-full rounded-[3rem] border border-border bg-card p-10 shadow-2xl transition-all duration-500 hover:shadow-indigo-500/10 group cursor-pointer overflow-hidden relative"
      onClick={() => navigate('/core/finance/treasury')}
    >
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div>
          <h4 className="text-xl font-black italic uppercase tracking-tighter text-foreground">Cash Position</h4>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Liquidity across all sources</p>
        </div>
        <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center border border-primary">
          <Landmark className="h-6 w-6 text-primary" />
        </div>
      </div>

      <div className="flex flex-col xl:flex-row items-center gap-10 relative z-10">
        <div className="relative h-[220px] w-[220px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={95}
                paddingAngle={8}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} className="group-hover:opacity-80 transition-opacity" />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Total Net</p>
            <p className="text-3xl font-black text-foreground tracking-tighter">Rp {(total / 1000000).toFixed(1)}M</p>
          </div>
        </div>

        <div className="flex-1 w-full space-y-6">
          {chartData.map((item, i) => (
            <div key={i} className="flex items-center justify-between group/item">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/5 text-muted-foreground group-hover/item:text-foreground group-hover/item:border-white/10 transition-all">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                   <p className="text-xs font-black text-muted-foreground group-hover/item:text-foreground transition-colors uppercase tracking-widest">{item.name}</p>
                   <div className="mt-1 h-1 w-24 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full transition-all duration-1000" style={{ width: `${(item.value / total) * 100}%`, backgroundColor: item.color }} />
                   </div>
                </div>
              </div>
              <p className="text-sm font-black text-foreground">Rp {(item.value / 1000).toFixed(0)}k</p>
            </div>
          ))}
          <div className="mt-6 border-t border-white/5 pt-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
               <TrendingUp className="h-4 w-4 text-success" />
               <span className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">Est. Runway</span>
            </div>
            <span className="text-sm font-black text-success">{runway} Days</span>
          </div>
        </div>
      </div>
      
      {/* Subtle background glow */}
      <div className="absolute -bottom-24 -right-24 h-48 w-48 bg-primary blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
    </div>
  );
};
