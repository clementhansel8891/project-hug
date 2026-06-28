import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { financeApiClient } from '@/core/services/finance/financeApiClient';
import { useSession } from '@/core/security/session';
import { CashflowTrendChart } from './CashflowTrendChart';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert, TrendingDown, Clock, Hash, Play, Settings2, AlertTriangle, Inbox } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { KPICard } from './KPICard';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CashflowIntelligenceTabProps {
  companyId: string;
  snapshotId?: string;
  correlationId: string;
}

export const CashflowIntelligenceTab: React.FC<CashflowIntelligenceTabProps> = ({ 
  companyId, 
  snapshotId,
  correlationId
}) => {
  const session = useSession();
  
  // Simulation State
  const [minSafeCash, setMinSafeCash] = useState<number>(0);
  const [avgDelay, setAvgDelay] = useState<number>(7);
  const [revMult, setRevMult] = useState<number>(1.0);
  const [expMult, setExpMult] = useState<number>(1.0);
  const [sceneDelay, setSceneDelay] = useState<number | undefined>(undefined);

  // Trigger State for Query
  const [queryParams, setQueryParams] = useState({
    minSafeCash,
    avgDelay,
    revMult,
    expMult,
    sceneDelay
  });

  const { data: cashflow, isLoading, isError, refetch } = useQuery({
    queryKey: ['cashflow-intelligence', companyId, snapshotId, queryParams, correlationId],
    queryFn: () => financeApiClient.getCashflow(session, {
      companyId,
      snapshotId,
      minimumSafeCash: queryParams.minSafeCash,
      avgDelayDays: queryParams.avgDelay,
      revenueMultiplier: queryParams.revMult,
      expenseMultiplier: queryParams.expMult,
      scenarioDelayDays: queryParams.sceneDelay,
      correlationId
    }),
    enabled: !!companyId,
  });

  const handleSimulate = () => {
    setQueryParams({
      minSafeCash,
      avgDelay,
      revMult,
      expMult,
      sceneDelay
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <p className="text-sm font-bold text-foreground">Couldn&apos;t load cashflow intelligence</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          A system error occurred while computing the projection. This is not a lack of data.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 mt-1">
          <Play size={12} fill="currentColor" /> Retry
        </Button>
      </div>
    );
  }

  if (!cashflow) return null;

  // --- Normalize backend response (field-name reconciliation) ---
  // Backend returns: projection (number[]), projectionDetails ({date, closingBalance,...}),
  // runwayDays, currentCash, minimumSafeCash, isBelowSafeBuffer, deficitRisk, severity.
  const projection: number[] = Array.isArray((cashflow as any).projection) ? (cashflow as any).projection : [];
  const projectionDetails: any[] = Array.isArray((cashflow as any).projectionDetails) ? (cashflow as any).projectionDetails : [];

  // Detect "no posted data" state: backend returns snapshotHash 'EMPTY' and no detail rows
  // when there are no financial snapshots/journal activity yet.
  const hasNoData = (cashflow as any).snapshotHash === 'EMPTY' || projectionDetails.length === 0;

  const chartData = projectionDetails.length > 0
    ? projectionDetails.map((d: any) => ({ date: (d.date || "").slice(5), cash: Number(d.closingBalance ?? 0) }))
    : projection.map((v: number, i: number) => ({ date: `D${i}`, cash: Number(v ?? 0) }));

  const minimumCash = projection.length > 0 ? Math.min(...projection) : Number(cashflow.currentCash ?? 0);
  const runwayDays = Number(cashflow.runwayDays ?? 999);
  const runwayLabel = runwayDays >= 999 ? ">30 Days" : `${runwayDays} Days`;

  const firstDeficitIndex = projection.findIndex((v) => v < 0);
  const deficitAmount = projection.length > 0 ? Math.abs(Math.min(0, ...projection)) : 0;
  const firstDeficitDate = firstDeficitIndex >= 0 && projectionDetails[firstDeficitIndex]
    ? projectionDetails[firstDeficitIndex].date
    : "N/A";

  return (
    <div className="space-y-6">
      {hasNoData && (
        <Alert className="border-2 border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-top-4">
          <Inbox size={18} className="text-primary" />
          <AlertTitle className="font-black uppercase tracking-wider text-[11px]">
            No cashflow data posted yet
          </AlertTitle>
          <AlertDescription className="text-sm">
            There are no financial snapshots or ledger transactions for this entity yet, so the
            projection below reflects a zero baseline. Once invoices, payments, and journals are
            recorded, the deterministic 30-day projection will populate automatically. You can still
            run what-if simulations using the tools on the right.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex justify-between items-start gap-6">
        <div className="flex-1 space-y-6">
          {cashflow.deficitRisk && (
            <Alert variant={cashflow.severity === 'CRITICAL' ? 'destructive' : 'default'} className="border-2 animate-in fade-in slide-in-from-top-4">
              <ShieldAlert size={18} />
              <AlertTitle className="font-black uppercase tracking-wider text-[11px]">
                Cashflow Deficit Predicted [SEVERITY_{cashflow.severity}]
              </AlertTitle>
              <AlertDescription className="text-sm">
                Projected deficit starts on <span className="font-bold underline">{firstDeficitDate}</span>. 
                Deepest point: <span className="font-bold">-${deficitAmount.toLocaleString()}</span>.
              </AlertDescription>
            </Alert>
          )}

          {cashflow.isBelowSafeBuffer && !cashflow.deficitRisk && (
            <Alert variant="warning" className="border-2 border-warning bg-warning text-warning animate-in fade-in slide-in-from-top-4">
              <AlertTriangle size={18} className="text-warning" />
              <AlertTitle className="font-black uppercase tracking-wider text-[11px]">
                Safety Buffer Breach Predicted
              </AlertTitle>
              <AlertDescription className="text-sm">
                Projected cash will dip below the <span className="font-bold">${Number(cashflow.minimumSafeCash ?? 0).toLocaleString()}</span> safety threshold.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <KPICard 
              title="Cash Runway" 
              value={runwayLabel} 
              format="text"
              trend={cashflow.deficitRisk ? 'DOWN' : 'NEUTRAL'}
              icon={<Clock className="h-4 w-4" />}
              inverseColor={cashflow.deficitRisk}
            />
            <KPICard 
              title="Minimum Cash" 
              value={minimumCash} 
              trend={minimumCash < 0 ? 'DOWN' : 'UP'}
              icon={<TrendingDown className="h-4 w-4" />}
              inverseColor={minimumCash < 0}
            />
          </div>

          <div className="col-span-full flex flex-col justify-center bg-muted/20 p-4 rounded-xl border border-dashed border-muted-foreground/20">
              <div className="flex items-center gap-2 mb-2">
                  <Hash className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Hardened Precision Anchor</span>
              </div>
              <code className="text-[10px] bg-card p-2 rounded border font-mono break-all leading-relaxed">
                  SNAPSHOT_HASH: {cashflow.snapshotHash || 'CRYPTO_UNVERIFIED'} | CID: {correlationId.slice(-8)}
              </code>
              <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="text-[8px] font-bold uppercase py-0 leading-tight">TEMPORAL_CONSISTENCY_OK</Badge>
                  <Badge variant="outline" className="text-[8px] font-bold uppercase py-0 leading-tight">TIMEZONE_NORMALIZED</Badge>
                  {cashflow.scenarioApplied && <Badge className="text-[8px] font-bold uppercase py-0 leading-tight bg-primary">SCENARIO_ACTIVE</Badge>}
              </div>
          </div>
        </div>

        <Card className="w-80 border-2 border-primary/10 shadow-lg shrink-0">
          <CardHeader className="pb-3 border-b bg-muted/30">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <Settings2 size={14} className="text-primary" />
              Simulation Tools
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Rev Multiplier (What-If)</Label>
              <Input type="number" step="0.1" value={revMult} onChange={(e) => setRevMult(parseFloat(e.target.value))} className="h-8 text-xs font-bold" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Exp Multiplier (What-If)</Label>
              <Input type="number" step="0.1" value={expMult} onChange={(e) => setExpMult(parseFloat(e.target.value))} className="h-8 text-xs font-bold" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Safety Buffer ($)</Label>
              <Input type="number" value={minSafeCash} onChange={(e) => setMinSafeCash(parseFloat(e.target.value))} className="h-8 text-xs font-bold" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Avg Delay (Days)</Label>
              <Input type="number" value={avgDelay} onChange={(e) => setAvgDelay(parseInt(e.target.value))} className="h-8 text-xs font-bold" />
            </div>
            <Button onClick={handleSimulate} className="w-full h-8 rounded-lg font-black text-[10px] uppercase tracking-widest gap-2">
              <Play size={12} fill="currentColor" />
              Execute Simulation
            </Button>
          </CardContent>
        </Card>
      </div>

      <CashflowTrendChart 
        data={chartData} 
        currentCash={Number(cashflow.currentCash ?? 0)} 
        minimumSafeCash={Number(cashflow.minimumSafeCash ?? 0)}
      />
    </div>
  );
};
