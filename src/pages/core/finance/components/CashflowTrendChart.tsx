import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from 'recharts';

interface CashflowTrendChartProps {
  data: Array<{ date: string; cash: number }>;
  currentCash: number;
  minimumSafeCash?: number;
}

export const CashflowTrendChart: React.FC<CashflowTrendChartProps> = ({ data, currentCash, minimumSafeCash }) => {
  return (
    <div className="h-[400px] w-full bg-card p-4 rounded-xl border border-primary/10 shadow-sm mt-4">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-bold uppercase tracking-tighter text-muted-foreground">Deterministic Cash Projection (30 Days)</h3>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-[10px] font-bold">PROJECTED_CASH</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0F172A" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#0F172A" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis 
            dataKey="date" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fontWeight: 'bold' }}
            dy={10}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fontWeight: 'bold' }}
            tickFormatter={(value) => `Rp ${value}`}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
            labelClassName="font-bold text-xs"
          />
          {minimumSafeCash && minimumSafeCash > 0 && (
            <ReferenceLine 
              y={minimumSafeCash} 
              stroke="#F59E0B" 
              strokeDasharray="5 5" 
              label={{ position: 'top', value: 'SAFETY_BUFFER', fill: '#D97706', fontSize: 10, fontWeight: 'black' }} 
            />
          )}
          <ReferenceLine y={0} stroke="#EF4444" strokeDasharray="3 3" label={{ position: 'right', value: 'DEFICIT_LINE', fill: '#EF4444', fontSize: 10, fontWeight: 'bold' }} />
          <Area 
            type="monotone" 
            dataKey="cash" 
            stroke="#0F172A" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorCash)" 
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
