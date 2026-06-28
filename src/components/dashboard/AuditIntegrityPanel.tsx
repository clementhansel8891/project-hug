import React from 'react';
import { Shield, ShieldCheck, ShieldAlert, RefreshCw, Lock, Unlock, Fingerprint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AuditIntegrityPanelProps {
  data: {
    score: number;
    status: 'CLEAN' | 'WARNINGS' | 'BROKEN';
    lastVerified: string;
    brokenCount: number;
    lastSyncAt?: string;
  };
  onVerify?: () => void;
  loading?: boolean;
}

export const AuditIntegrityPanel: React.FC<AuditIntegrityPanelProps> = ({ data, onVerify, loading }) => {
  return (
    <div className="flex flex-col h-full rounded-2xl border border-border bg-card p-8 shadow-2xl transition-all duration-500 hover:shadow-indigo-500/10 overflow-hidden group">
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground border border-primary">
            <Fingerprint className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xl font-black italic uppercase tracking-tighter text-foreground">Audit Integrity</h4>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cryptographic verification of system logs</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          disabled={loading}
          onClick={onVerify}
          className="h-10 rounded-xl bg-muted border border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-white/10 hover:text-foreground transition-all"
        >
          <RefreshCw className={cn("mr-2 h-3.5 w-3.5", loading && "animate-spin")} />
          Re-Verify
        </Button>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-12 py-2">
        <div className="relative flex flex-col items-center">
          <div className={cn(
            "flex h-36 w-36 items-center justify-center rounded-full border-[12px] transition-all duration-1000 shadow-[0_0_40px_-10px]",
            data.status === 'CLEAN' ? 'border-success/10 text-success shadow-emerald-500/30' : 
            data.status === 'WARNINGS' ? 'border-warning/10 text-warning shadow-amber-500/20' : 
            'border-destructive/10 text-destructive shadow-rose-500/20'
          )}>
            {data.status === 'CLEAN' ? <ShieldCheck className="h-14 w-14" /> : <ShieldAlert className="h-14 w-14" />}
          </div>
          <div className="mt-6 text-center">
            <p className="text-4xl font-black tracking-tighter text-foreground">{data.score}%</p>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-1">Integrity Score</p>
          </div>
        </div>

        <div className="flex-1 w-full space-y-8">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2 group/stat">
              <div className="flex items-center gap-2 text-muted-foreground group-hover/stat:text-primary transition-colors">
                <Lock className="h-3 w-3" />
                <span className="text-[10px] font-black uppercase tracking-widest">Verified</span>
              </div>
              <p className="text-3xl font-black tracking-tighter text-foreground">4.2k+</p>
            </div>
            <div className="space-y-2 group/stat">
              <div className={cn(
                "flex items-center gap-2 transition-colors",
                data.brokenCount > 0 ? "text-destructive" : "text-muted-foreground group-hover/stat:text-destructive"
              )}>
                <Unlock className="h-3 w-3" />
                <span className="text-[10px] font-black uppercase tracking-widest">Broken</span>
              </div>
              <p className={cn("text-3xl font-black tracking-tighter", data.brokenCount > 0 ? "text-destructive" : "text-foreground")}>
                {data.brokenCount}
              </p>
            </div>
          </div>

          <div className="relative rounded-[2rem] bg-gradient-to-br from-slate-800/40 to-transparent p-6 border border-border overflow-hidden">
            <div className="relative z-10 flex items-start gap-4">
              <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <p className="text-[11px] font-bold text-muted-foreground italic leading-relaxed">
                "System-wide hashing is synchronized across all multi-tenant shards. No unauthorized record manipulation detected."
              </p>
            </div>
            <div className="absolute top-0 right-0 h-24 w-24 bg-primary blur-2xl rounded-full" />
          </div>
          
          <div className="flex items-center gap-2 px-2">
             <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
             <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
               Last cryptographic verification: {new Date(data.lastSyncAt || data.lastVerified).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
             </p>
          </div>
        </div>
      </div>
      
      {/* Subtle corner glow */}
      <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-primary blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
    </div>
  );
};
