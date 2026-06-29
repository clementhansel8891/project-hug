import { useNavigate, Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import * as React from "react";
import { 
  RefreshCw, 
  Rocket, 
  LayoutDashboard,
  Briefcase,
  Monitor,
  Activity,
  History,
  TrendingUp,
  Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/core/security/session";
import { adminService } from "@/core/services";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OperationsView } from "@/components/shared/OperationsView";
import { ExecutiveKpiRow } from "@/components/dashboard/ExecutiveKpiRow";
import { FinancialTrajectoryChart } from "@/components/dashboard/FinancialTrajectoryChart";
import { ArApWaterfallChart } from "@/components/dashboard/ArApWaterfallChart";
import { CashPositionWidget } from "@/components/dashboard/CashPositionWidget";
import { BranchLeaderboard } from "@/components/dashboard/BranchLeaderboard";
import { HrCapitalWidget } from "@/components/dashboard/HrCapitalWidget";
import { PayrollBurnTrendChart } from "@/components/dashboard/PayrollBurnTrendChart";
import { AttendanceGauge } from "@/components/dashboard/AttendanceGauge";
import { InventoryHealthWidget } from "@/components/dashboard/InventoryHealthWidget";
import { ProcurementPipelineWidget } from "@/components/dashboard/ProcurementPipelineWidget";
import { SalesPipelineFunnel } from "@/components/dashboard/SalesPipelineFunnel";
import { AlertsRiskMatrix } from "@/components/dashboard/AlertsRiskMatrix";
import { MarketingRoiChart } from "@/components/dashboard/MarketingRoiChart";
import { GlobalEventFeed } from "@/components/dashboard/GlobalEventFeed";
import { 
  EnterpriseHealthWidget, 
  ActionItemsWidget 
} from "@/components/dashboard/StrategicScorecard";
import { SystemHealthDonut } from "@/components/dashboard/SystemHealthDonut";
import { ComplianceHeatmap } from "@/components/dashboard/ComplianceHeatmap";
import { DashboardPayload } from "@/types/dashboard.types";
import DashboardLayout, { DASHBOARD_SECTIONS } from "./DashboardLayout";

const SECTIONS = DASHBOARD_SECTIONS;

export default function CoreDashboard() {
  const session = useSession();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardPayload['data'] | null>(null);
  const [period, setPeriod] = useState("6M");

  const refresh = useCallback(async (isManual = false, targetPeriod?: string) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      
      const activePeriod = targetPeriod || period;
      const res = await adminService.getDashboardMetrics(session.tenant_id, session, activePeriod);
      if (res) {
        setDashboardData(res);
      }
      
      if (isManual) toast.success("Executive telemetry synchronized.");
    } catch (err) {
      console.error("Dashboard sync failure:", err);
      toast.error("Telemetry failure in executive suite.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session.tenant_id, session, period]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading || !dashboardData) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-8">
          <div className="relative h-24 w-24">
             <div className="absolute inset-0 bg-primary/20 rounded-[2.5rem] blur-2xl animate-pulse" />
             <div className="relative h-full w-full bg-primary rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-primary/40 border border-border">
                <LayoutDashboard className="h-12 w-12 text-primary-foreground" />
             </div>
          </div>
          <div className="flex flex-col items-center gap-2">
             <p className="text-[11px] font-black uppercase tracking-[0.4em] text-foreground italic">ESTELA GEA INTELLIGENCE ENGINE</p>
             <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground">Synchronizing Executive Telemetry...</p>
          </div>
        </div>
      </div>
    );
  }

  const mainContent = (
    <div className="p-6 md:p-10 max-w-[1600px] mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <Tabs defaultValue="overview" className="space-y-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-card border border-border p-5 rounded-2xl shadow-lg">
          <TabsList className="bg-secondary/50 p-1.5 rounded-xl h-12 border border-border/50">
            <TabsTrigger value="overview" className="rounded-lg px-8 h-9 data-[state=active]:bg-primary data-[state=active]:shadow-lg data-[state=active]:text-primary-foreground font-black text-[10px] uppercase tracking-[0.25em] transition-all duration-300 text-muted-foreground">
              Strategic Overview
            </TabsTrigger>
            <TabsTrigger value="operations" className="rounded-lg px-8 h-9 data-[state=active]:bg-primary data-[state=active]:shadow-lg data-[state=active]:text-primary-foreground font-black text-[10px] uppercase tracking-[0.25em] transition-all duration-300 text-muted-foreground">
              Tactical Flow
            </TabsTrigger>
          </TabsList>

          <div className="hidden lg:flex items-center gap-6 pr-4">
             <div className="flex flex-col items-end">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Governance Tier</span>
                <div className="flex items-center gap-2 mt-0.5">
                   <div className="h-1.5 w-1.5 rounded-full bg-success shadow-success/50 shadow-lg" />
                   <span className="text-[11px] font-black text-foreground italic tracking-tighter">L4 COMMANDER</span>
                </div>
             </div>
             <div className="h-10 w-10 rounded-xl grad-primary p-[1px]">
                <div className="h-full w-full bg-card rounded-[0.6rem] flex items-center justify-center">
                  <LayoutDashboard className="h-4 w-4 text-primary" />
                </div>
             </div>
          </div>
        </div>

        <TabsContent value="overview" className="space-y-10 m-0">
          {/* Tier 0: Executive KPI Row — 4 columns on large screens */}
          <ExecutiveKpiRow kpis={dashboardData.kpis} />

          {/* Tier 1: Financial Trajectory (wide) + Action Items (narrow) */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <FinancialTrajectoryChart 
                data={dashboardData.timeseries.financialOverview} 
                period={period}
                onPeriodChange={(p) => {
                  setPeriod(p);
                  refresh(true, p);
                }}
              />
            </div>
            <ActionItemsWidget />
          </div>

          {/* Tier 2: Performance & Health — 2 columns */}
          <div className="grid gap-6 lg:grid-cols-2">
             <HrCapitalWidget distribution={dashboardData.timeseries.hrDistribution} />
             <BranchLeaderboard data={dashboardData.timeseries.topBranches} />
          </div>

          {/* Tier 3: Treasury & Growth — 3 columns */}
          <div className="grid gap-6 lg:grid-cols-3">
             <CashPositionWidget data={dashboardData.widgets?.cashPosition} />
             <ArApWaterfallChart />
             <SalesPipelineFunnel data={dashboardData.widgets?.salesPipeline} />
          </div>

          {/* Tier 4: Supply Chain — 2 columns */}
          <div className="grid gap-6 lg:grid-cols-2">
             <InventoryHealthWidget data={dashboardData.widgets?.inventory} />
             <ProcurementPipelineWidget data={dashboardData.widgets?.procurement} />
          </div>

          {/* Tier 5: Payroll + Attendance — 2 columns */}
          <div className="grid gap-6 lg:grid-cols-2">
             <PayrollBurnTrendChart data={dashboardData.widgets?.payroll} />
             <AttendanceGauge />
          </div>

          {/* Tier 6: Risk & Governance — 2 columns */}
          <div className="grid gap-6 lg:grid-cols-2">
             <AlertsRiskMatrix data={dashboardData.timeseries.alertsByModule as any} />
             <SystemHealthDonut data={dashboardData.timeseries.moduleHealth} />
          </div>

          {/* Tier 6b: Compliance Heatmap — full width */}
          <ComplianceHeatmap />

          {/* Tier 7: Event Feed (full width) */}
          <GlobalEventFeed activities={dashboardData.activities} />

          {/* Tier 8: Marketing + Support CTA — 2 columns */}
          <div className="grid gap-6 lg:grid-cols-2">
             <MarketingRoiChart data={dashboardData.timeseries.campaignCorrelation} />
             <div className="rounded-2xl bg-card p-8 text-card-foreground shadow-xl relative overflow-hidden group border border-border">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="relative z-10 space-y-6">
                   <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center backdrop-blur-xl border border-primary/20">
                      <Briefcase className="h-5 w-5 text-primary" />
                   </div>
                   <div className="space-y-1">
                      <h4 className="text-lg font-black italic uppercase tracking-tighter">Strategic Support</h4>
                      <p className="text-[10px] text-muted-foreground font-medium">Tactical assistance and complex modeling ready.</p>
                   </div>
                   <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black text-[9px] uppercase tracking-[0.2em] rounded-xl h-10 transition-all active:scale-95">
                      CONNECT NOW
                   </Button>
                </div>
             </div>
          </div>
        </TabsContent>

        <TabsContent value="operations" className="m-0">
          <OperationsView />
        </TabsContent>
      </Tabs>
    </div>
  );

  return (
    <DashboardLayout>
      {mainContent}
    </DashboardLayout>
  );
}
