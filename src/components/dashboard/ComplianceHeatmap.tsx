import React from 'react';
import { cn } from '@/lib/utils';
import { ShieldCheck, Gavel, FileCheck } from 'lucide-react';

interface ComplianceItem {
  region: string;
  tax: number;
  labor: number;
  data: number;
  audit: number;
}

const data: ComplianceItem[] = [
  { region: 'Jakarta', tax: 98, labor: 95, data: 92, audit: 100 },
  { region: 'Surabaya', tax: 94, labor: 88, data: 96, audit: 91 },
  { region: 'Bandung', tax: 82, labor: 91, data: 85, audit: 88 },
  { region: 'Medan', tax: 99, labor: 96, data: 89, audit: 94 },
];

export const ComplianceHeatmap: React.FC = () => {
  const getCellColor = (value: number) => {
    if (value >= 95) return 'bg-success text-success-foreground border-success/20 shadow-[0_0_15px_-5px_rgba(16,185,129,0.3)]';
    if (value >= 90) return 'bg-success text-success-foreground border-success/10';
    if (value >= 85) return 'bg-warning text-warning-foreground border-warning/10';
    return 'bg-destructive text-destructive-foreground border-destructive/20 shadow-[0_0_15px_-5px_rgba(244,63,94,0.3)]';
  };

  return (
    <div className="flex flex-col h-full rounded-2xl border border-border bg-card p-10 shadow-2xl transition-all duration-500 group overflow-hidden relative">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground border border-primary">
            <Gavel className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-xl font-black italic uppercase tracking-tighter text-foreground">Compliance Heatmap</h4>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Governance adherence by region</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted border border-border">
           <FileCheck className="h-4 w-4 text-success" />
           <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Audited Q2 2026</span>
        </div>
      </div>

      <div className="overflow-x-auto pt-2">
        <table className="w-full text-left border-separate border-spacing-3">
          <thead>
            <tr>
              <th className="p-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Location</th>
              <th className="p-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Tax</th>
              <th className="p-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Labor</th>
              <th className="p-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Data</th>
              <th className="p-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Audit</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="group/row">
                <td className="p-2">
                  <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground group-hover/row:text-foreground transition-colors">{row.region}</span>
                </td>
                {[row.tax, row.labor, row.data, row.audit].map((val, j) => (
                  <td key={j} className="p-0">
                    <div className={cn(
                      "flex h-14 w-full items-center justify-center rounded-[1.25rem] border text-sm font-black transition-all duration-300 group-hover/row:scale-[1.02]",
                      getCellColor(val)
                    )}>
                      {val}%
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Subtle corner glow */}
      <div className="absolute -bottom-16 -right-16 h-40 w-40 bg-primary blur-[60px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
    </div>
  );
};
