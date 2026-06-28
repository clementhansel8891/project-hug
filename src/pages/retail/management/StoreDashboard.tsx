import React, {
  useState,
  useEffect,
  useCallback,
  Suspense,
  useMemo,
} from "react";
import { PageHeader } from "@/core/ui/PageHeader";
import { RefreshCw, LayoutDashboard, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";
import { analyticsService } from "@/core/services/retail/analyticsService";
import { Roles } from "@/core/security/roles";
import {
  CommandCenterAnalytics,
  AnalyticsTimeRange,
} from "@/core/types/retail/analytics";

// Modular Components
import { GlobalKpiRow } from "./command-center/GlobalKpiRow";
import { TimeRangeFilter } from "./command-center/TimeRangeFilter";
import { LocationSwitcher } from "./command-center/LocationSwitcher";
import { useRealTimeAwareness } from "@/hooks/retail/useRealTimeAwareness";
import { useRetail } from "../context/RetailContext";

// Lazy Loaded Analytics Widgets
const RevenueAnalytics = React.lazy(() =>
  import("./command-center/RevenueAnalytics").then((m) => ({
    default: m.RevenueAnalytics,
  })),
);
const OperationalEfficiency = React.lazy(() =>
  import("./command-center/OperationalEfficiency").then((m) => ({
    default: m.OperationalEfficiency,
  })),
);
const InventoryIntelligence = React.lazy(() =>
  import("./command-center/InventoryIntelligence").then((m) => ({
    default: m.InventoryIntelligence,
  })),
);
const WorkforceAnalytics = React.lazy(() =>
  import("./command-center/WorkforceAnalytics").then((m) => ({
    default: m.WorkforceAnalytics,
  })),
);
const InfrastructureHealth = React.lazy(() =>
  import("./command-center/InfrastructureHealth").then((m) => ({
    default: m.InfrastructureHealth,
  })),
);
const RiskCompliancePanel = React.lazy(() =>
  import("./command-center/RiskCompliancePanel").then((m) => ({
    default: m.RiskCompliancePanel,
  })),
);

const StoreDashboard = () => {
  const session = useSession();
  const { toast } = useToast();

  // Dashboard State
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>("TODAY");
  const { activeStore, setStore } = useRetail();
  const [data, setData] = useState<CommandCenterAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Sync scopedLocationId with RetailContext
  const scopedLocationId = useMemo(() => activeStore?.id, [activeStore]);

  // RBAC Helpers
  const permissions = session?.permissions || [];
  const rawRole = (session?.role || "").toString().toUpperCase();

  const isPrivileged =
    rawRole.includes("SUPERADMIN") ||
    rawRole.includes("OWNER") ||
    rawRole.includes("ADMIN") ||
    rawRole === Roles.SUPERADMIN ||
    rawRole === Roles.OWNER ||
    rawRole === Roles.COMPANY_ADMIN;

  const hasPermission = (perm: string) =>
    isPrivileged || permissions.includes(perm);

  const canViewFinancials =
    hasPermission("VIEW_FINANCIALS") || hasPermission("MANAGE_STORE");
  const canViewHR = hasPermission("VIEW_HR") || hasPermission("MANAGE_STORE");
  const canViewInventory =
    hasPermission("VIEW_INVENTORY") || hasPermission("MANAGE_STORE");
  const canViewDevices =
    hasPermission("VIEW_DEVICES") || hasPermission("MANAGE_STORE");
  const canViewRisk =
    hasPermission("VIEW_AUDIT") || hasPermission("MANAGE_STORE");

  const [hasUplinkError, setHasUplinkError] = useState(false);

  // Data Fetching
  const fetchAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      const analytics = await analyticsService.getCommandCenterData(
        session.tenant_id!,
        session,
        {
          timeRange,
          locationId: scopedLocationId,
        },
      );
      setData(analytics);
      setHasUplinkError(false);
    } catch (error) {
      if (!hasUplinkError) {
        toast({
          title: "Sync Error",
          description: "Failed to establish uplink with analytics engine.",
          variant: "destructive",
        });
        setHasUplinkError(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, [session, timeRange, scopedLocationId, toast, hasUplinkError]);

  useEffect(() => {
    if (session.tenant_id) {
      setHasUplinkError(false); // Reset error state on tenant change
      fetchAnalytics();
    }
  }, [scopedLocationId, timeRange, session.tenant_id]);

  // Real-Time Awareness
  useRealTimeAwareness((event) => {
    // Incrementally update UI or trigger partial re-fetch
    if (event.type === "ORDER_CREATED" || event.type === "INVENTORY_CRITICAL") {
      fetchAnalytics();
    }
  });


  if (isLoading && !data) {
    return (
      <div className="flex h-screen items-center justify-center surface-tactical">
        <div className="flex flex-col items-center gap-8 relative z-10">
          <RefreshCw className="w-16 h-16 text-primary animate-spin" />
          <p className="text-[11px] font-black italic uppercase tracking-[0.4em] text-foreground">
            Calibrating Command Protocols...
          </p>
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.15)_0%,transparent_70%)]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background selection:bg-primary/30 selection:text-primary-foreground relative overflow-hidden">

      {/* Atmospheric Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-destructive/5 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute top-[20%] right-[5%] w-[30%] h-[30%] bg-info/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Glassmorphic Command Header */}
      <div className="px-6 py-3 glass-header flex items-center justify-between sticky top-0 z-50 shadow-xl">
        <div className="flex items-center gap-6">
          <div className="w-10 h-10 bg-card border border-border rounded-xl flex items-center justify-center text-foreground shadow-lg group hover:rotate-3 transition-all duration-500">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black italic uppercase tracking-tighter text-foreground">
              Operational Command Center
            </h1>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-0.5">
               Node: {scopedLocationId || "GLOBAL_ROOT"} • Security: {permissions.length} Grants
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 relative z-10">
          <div className="p-1.5 bg-muted/20 rounded-2xl flex items-center gap-3 border border-border backdrop-blur-3xl">
            <LocationSwitcher
              currentLocationId={scopedLocationId}
              onLocationChange={(id) => setStore(id || null)}
            />
            <div className="h-6 w-px bg-border/40" />
            <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
          </div>

          <Button
            variant="ghost"
            className="w-10 h-10 rounded-xl p-0 border border-border bg-card text-foreground hover:bg-muted transition-all"
            onClick={fetchAnalytics}
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin text-primary" : "text-muted-foreground"}`}
            />
          </Button>
        </div>
      </div>

      {/* Main Command Surface */}
      <div className="flex-1 p-6">
        <div className="max-w-[1920px] mx-auto space-y-12">
          {/* TIER 1: KPI Overview */}
          {data && <GlobalKpiRow kpis={data.kpis} />}

          {/* TIER 2: Financial + Operational Analytics */}
          <div className="space-y-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-2 h-8 bg-primary rounded-full shadow-lg shadow-primary/50" />
                <h2 className="text-lg font-black italic uppercase tracking-tighter text-foreground">
                  Core Performance Matrix
                </h2>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-xl">
                 <Zap className="w-4 h-4 text-primary" />
                 <span className="text-[10px] font-black italic uppercase text-primary tracking-widest">Live Telemetry Synchronized</span>
              </div>
            </div>

            <Suspense
              fallback={
                <div className="h-[450px] bg-secondary/40 border border-border rounded-[2rem] animate-pulse" />
              }
            >
              {canViewFinancials ? (
                data && <RevenueAnalytics data={data.revenue} />
              ) : (
                <div className="h-[250px] bg-secondary/40 rounded-[2rem] flex flex-col items-center justify-center border-2 border-dashed border-border gap-4">
                  <ShieldCheck className="w-10 h-10 text-muted-foreground" />
                  <p className="text-[11px] font-black italic uppercase tracking-[0.2em] text-muted-foreground">
                    Financial Access Restricted
                  </p>
                </div>
              )}
            </Suspense>

            <Suspense
              fallback={
                <div className="h-[450px] bg-secondary/40 border border-border rounded-[2rem] animate-pulse" />
              }
            >
              {data && <OperationalEfficiency data={data.efficiency} />}
            </Suspense>
          </div>

          {/* TIER 3: Specialized Intelligence Nodes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Suspense
              fallback={
                <div className="h-[350px] bg-secondary/40 border border-border rounded-[2rem] animate-pulse" />
              }
            >
              {canViewInventory ? (
                data && <InventoryIntelligence data={data.inventory} />
              ) : (
                <div className="h-[350px] bg-secondary/40 rounded-[2rem] flex items-center justify-center border border-border">
                  <p className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground">
                    Inventory Stream Restricted
                  </p>
                </div>
              )}
            </Suspense>

            <Suspense
              fallback={
                <div className="h-[350px] bg-secondary/40 border border-border rounded-[2rem] animate-pulse" />
              }
            >
              {canViewHR ? (
                data && <WorkforceAnalytics data={data.workforce} />
              ) : (
                <div className="h-[350px] bg-secondary/40 rounded-[2rem] flex items-center justify-center border border-border">
                  <p className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground">
                    Workforce Analytics Restricted
                  </p>
                </div>
              )}
            </Suspense>

            <Suspense
              fallback={
                <div className="h-[350px] bg-secondary/40 border border-border rounded-[2rem] animate-pulse" />
              }
            >
              {canViewDevices ? (
                data && <InfrastructureHealth data={data.infrastructure} />
              ) : (
                <div className="h-[350px] bg-secondary/40 rounded-[2rem] flex items-center justify-center border border-border">
                  <p className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground">
                    Infrastructure Telemetry Restricted
                  </p>
                </div>
              )}
            </Suspense>

            <Suspense
              fallback={
                <div className="h-[350px] bg-secondary/40 border border-border rounded-[2rem] animate-pulse" />
              }
            >
              {canViewRisk ? (
                data && <RiskCompliancePanel data={data.risk} />
              ) : (
                <div className="h-[350px] bg-secondary/40 rounded-[2rem] flex items-center justify-center border border-border">
                  <p className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground">
                    Risk Assessment Restricted
                  </p>
                </div>
              )}
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreDashboard;
