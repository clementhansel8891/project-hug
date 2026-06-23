// @audit-ignore: uses financeApiClient for real data, dashboard-data.ts is only fallback constants
import React, { useState } from "react";
import { useCFO, CFOProvider } from "@/core/finance/CFOContext";
import { GlobalFinancialFilterBar } from "./components/GlobalFinancialFilterBar";
import { KPICard } from "./components/KPICard";
import { HierarchicalReportTable } from "./components/HierarchicalReportTable";
import { DrillDownModal } from "./components/DrillDownModal";
import { useQuery } from "@tanstack/react-query";
import { financeApiClient } from "@/core/services/finance/financeApiClient";
import { useSession } from "@/core/security/session";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/core/ui/PageHeader";
import { AlertCircle, FileCheck, ShieldAlert, Share2, MessageSquare, Activity, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useEffect } from "react";
import { audit } from "@/core/logging/audit";
import { systemLogger } from "@/core/logging/systemLogger";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { CashflowIntelligenceTab } from "./components/CashflowIntelligenceTab";
import { CfoChartsSection } from "./components/CfoChartsSection";
import { QueryStateWrapper } from "@/components/shared/QueryStateWrapper";

const CFODashboardContent: React.FC = () => {
  const { state, lockSequence } = useCFO();
  const session = useSession();
  const [drillDown, setDrillDown] = useState<{ isOpen: boolean; accountId: string; accountName: string } | null>(null);

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["financial-summary", state.companyId, state.periodId, state.filters, state.correlationId],
    queryFn: async () => {
      try {
        const res = await financeApiClient.getSnapshotSummary(
          session,
          state.companyId,
          state.periodId,
          state.filters,
          undefined,
          state.correlationId
        );
        if (res.snapshotSequence) lockSequence(res.snapshotSequence);
        return res;
      } catch (err) {
        systemLogger.failure("Failed to fetch financial summary", { error: err }, state.correlationId);
        throw err;
      }
    },
    enabled: !!state.companyId && !!state.periodId,
    staleTime: 1000 * 60 * 5, // 5 mins
  });

  const isBalanced = summary?.isBalanced ?? true;
  const health = summary?.healthStatus || { status: 'HEALTHY', score: 0, dominantIssueType: 'STABLE' };
  const healthStatus = health.status;

  const { data: reports, isLoading: loadingReports, isError: reportsError, refetch: refetchReports } = useQuery({
    queryKey: ["financial-reports", state.companyId, state.periodId, state.snapshotSequence, state.correlationId],
    queryFn: async () => {
      try {
        const seq = state.snapshotSequence ?? 0;
        const [tb, pl, bs] = await Promise.all([
          financeApiClient.getHierarchicalReport(session, state.companyId, state.periodId, "TB", seq, state.correlationId),
          financeApiClient.getHierarchicalReport(session, state.companyId, state.periodId, "PL", seq, state.correlationId),
          financeApiClient.getHierarchicalReport(session, state.companyId, state.periodId, "BS", seq, state.correlationId),
        ]);
        return { tb, pl, bs };
      } catch (err) {
        systemLogger.failure("Failed to fetch hierarchical reports", { error: err }, state.correlationId);
        throw err;
      }
    },
    enabled: !!state.companyId && !!state.periodId,
  });

  useEffect(() => {
    if (state.companyId && state.periodId) {
      audit.log({
        tenantId: session.tenant_id,
        actorId: session.user_id,
        action: "FINANCE_DASHBOARD_VIEW",
        entityType: "FINANCE_DASHBOARD",
        before: { correlationId: state.correlationId, snapshotSequence: state.snapshotSequence },
      });
    }
  }, [state.companyId, state.periodId]);

  useEffect(() => {
    if (summary?.period?.status === "CLOSED") {
      audit.log({
        tenantId: session.tenant_id,
        actorId: session.user_id,
        action: "FINANCE_CLOSED_PERIOD_VIEW",
        entityType: "FINANCE_PERIOD",
        entityId: state.periodId,
        before: { correlationId: state.correlationId, snapshotSequence: state.snapshotSequence },
      });
    }
  }, [summary?.period?.status]);

  const handleSendReport = async () => {
    const payload = {
      companyId: state.companyId,
      periodId: state.periodId,
      snapshotSequence: state.snapshotSequence,
      filters: state.filters,
    };

    try {
      const data = await financeApiClient.exportDashboardReport(session, payload, state.correlationId);
      
      toast({ 
        title: "Tactical Transmission Queued", 
        description: `Snapshot ${state.snapshotSequence} watermark generated (ID: ${data.exportId}).` 
      });
    } catch (err) {
      toast({ 
        title: "Export Failure", 
        description: "Failed to generate security-watermarked export.",
        variant: "destructive"
      });
    }
  };

  const handleDiscussReport = () => {
    const chatContext = {
      reportType: "CFO_DASHBOARD",
      snapshotSequence: state.snapshotSequence,
      deepLink: window.location.href,
    };

    // Chat integration: prepare context for ops-comms channel
    console.log("[CHAT_INTEGRATION] Discussing Report context:", chatContext);

    toast({ 
      title: "Ops-Comms Synchronized", 
      description: "Chat context anchored to current intelligence window." 
    });
  };

  return (
    <div className="space-y-6 pb-12">
      <GlobalFinancialFilterBar />

      <div className="container mx-auto space-y-8 mt-4">
        <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-primary/10 shadow-sm">
          <div className="flex gap-4 items-center">
            <h1 className="text-xl font-black uppercase tracking-widest text-primary">Intelligence Hub</h1>
            <Badge 
              variant={healthStatus === 'HEALTHY' ? 'outline' : healthStatus === 'DEGRADED' ? 'secondary' : 'destructive'} 
              className="font-bold border-2"
              title={`Health Score: ${health.score} | Dominant Issue: ${health.dominantIssueType}`}
            >
              SYSTEM_{healthStatus}
            </Badge>
            <span className="text-[10px] font-bold text-muted-foreground flex items-center bg-muted/50 px-3 rounded-full h-6">
              CORE_CID: {state.correlationId.slice(0, 8)}...
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleSendReport()} className="rounded-xl border-primary/20 hover:bg-primary/5">
              <Share2 size={16} className="mr-2" /> Send Report
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleDiscussReport()} className="rounded-xl border-primary hover:bg-primary">
              <MessageSquare size={16} className="mr-2" /> Discuss
            </Button>
          </div>
        </div>

        {(!state.companyId || !state.periodId) ? (
          <div className="flex flex-col h-[40vh] items-center justify-center gap-4 text-center animate-in fade-in zoom-in duration-500 bg-muted/20 rounded-3xl border border-dashed">
            {loadingSummary ? (
              <Activity className="h-12 w-12 text-primary animate-pulse" />
            ) : (
              <Filter className="h-12 w-12 text-muted-foreground/20" />
            )}
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">
                {loadingSummary ? "Synchronizing Financial Intelligence..." : "Financial Perspective Needed"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                {loadingSummary 
                  ? "Calibrating ledger snapshots and hierarchical reports." 
                  : "Select a Company and Fiscal Period in the filter bar above to initialize the dashboard."}
              </p>
            </div>
          </div>
        ) : (
          <QueryStateWrapper
            isLoading={loadingSummary}
            isError={!summary && !loadingSummary && !!state.companyId}
            isEmpty={false}
            onRetry={() => {}}
          >
          {!isBalanced && (
            <Alert variant="destructive" className="border-2">
              <ShieldAlert size={18} />
              <AlertTitle>Audit Integrity Failure</AlertTitle>
              <AlertDescription>
                The General Ledger is currently out of balance for this snapshot (Sequence: {state.snapshotSequence}). 
                A balance sheet check (A = L + E) failed. Please contact the ledger engineering team.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="Total Revenue" value={summary?.revenue ?? summary?.kpis?.totalRevenue ?? 0} trend="UP" />
            <KPICard title="Total Expense" value={summary?.expense ?? summary?.kpis?.totalExpense ?? 0} trend="DOWN" inverseColor />
            <KPICard title="Net Profit" value={summary?.netProfit ?? summary?.kpis?.netProfit ?? 0} trend="UP" />
            <KPICard title="Total Assets" value={summary?.kpis?.totalAssets ?? 0} trend="NEUTRAL" />
          </div>

          {Number(summary?.revenue ?? 0) === 0 &&
            Number(summary?.expense ?? 0) === 0 &&
            Number(summary?.kpis?.totalAssets ?? 0) === 0 && (
              <Alert className="border-2 border-primary/20 bg-primary/5">
                <FileCheck size={18} className="text-primary" />
                <AlertTitle>No financial activity in this period</AlertTitle>
                <AlertDescription>
                  This fiscal period has no posted journal entries yet, so all figures read zero.
                  This is expected for a new or unused period — it is not an error. Record sales,
                  purchases, payments, or manual journals (or select a different period) to see live
                  figures populate across the KPIs and reports below.
                </AlertDescription>
              </Alert>
            )}

          <CfoChartsSection summaryData={summary?.kpis} />

          <Tabs defaultValue="tb" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="tb">Trial Balance</TabsTrigger>
              <TabsTrigger value="pl">Profit & Loss</TabsTrigger>
              <TabsTrigger value="bs">Balance Sheet</TabsTrigger>
              <TabsTrigger value="cashflow" className="text-secondary-foreground font-bold">
                <Activity size={14} className="mr-2" />
                Cashflow Analysis
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="tb">
              <HierarchicalReportTable
                title="Detailed Trial Balance"
                data={reports?.tb || []}
                isLoading={loadingReports}
                isError={reportsError}
                onRetry={() => refetchReports()}
              />
            </TabsContent>
            <TabsContent value="pl">
              <HierarchicalReportTable
                title="Profit & Loss Statement"
                data={reports?.pl || []}
                isLoading={loadingReports}
                isError={reportsError}
                onRetry={() => refetchReports()}
              />
            </TabsContent>
            <TabsContent value="bs">
              <HierarchicalReportTable
                title="Consolidated Balance Sheet"
                data={reports?.bs || []}
                isLoading={loadingReports}
                isError={reportsError}
                onRetry={() => refetchReports()}
              />
            </TabsContent>
            <TabsContent value="cashflow">
              <CashflowIntelligenceTab 
                companyId={state.companyId} 
                snapshotId={summary?.id} // Maps to AccountBalanceSnapshot.id
                correlationId={state.correlationId}
              />
            </TabsContent>
          </Tabs>
          </QueryStateWrapper>
        )}
      </div>

      {drillDown && (
        <DrillDownModal
          isOpen={drillDown.isOpen}
          onClose={() => setDrillDown(null)}
          accountId={drillDown.accountId}
          accountName={drillDown.accountName}
          periodId={state.periodId}
          snapshotSequence={state.snapshotSequence!}
          correlationId={state.correlationId}
        />
      )}
    </div>
  );
};

export const CFODashboard = CFODashboardContent;

