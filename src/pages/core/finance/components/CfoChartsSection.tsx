import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip,
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ComposedChart,
} from "recharts";
import { DollarSign } from "lucide-react";
import {
  CFO_LIQUIDITY_DATA, CFO_AR_AGING_DATA, CFO_AP_PIPELINE_DATA,
  CFO_ASSET_ALLOCATION, COMPLIANCE_RADAR_DATA, CHART_TOOLTIP_STYLE,
} from "./dashboard-data";
import { SimpleKpi, SectionLabel } from "./DashboardPrimitives";
import { cn } from "@/lib/utils";
import { CHART_COLORS, CHART_COLORS_DARK, CHART_NEUTRAL, CHART_NEUTRAL_DARK } from "@/lib/chart-colors";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/core/api/apiClient";
import { useSession } from "@/core/security/session";
import { QueryStateWrapper } from "@/components/shared/QueryStateWrapper";

const fmt = (v: number | string) => [`Rp ${v}M`];

export function CfoChartsSection({ summaryData }: { summaryData?: any }) {
  const { theme } = useTheme();
  const session = useSession();
  const colors = theme === 'dark' ? CHART_COLORS_DARK : CHART_COLORS;
  const neutral = theme === 'dark' ? CHART_NEUTRAL_DARK : CHART_NEUTRAL;
  const gridStroke = theme === 'dark' ? '#1e293b' : '#f1f5f9';
  const tickFill = theme === 'dark' ? '#94a3b8' : '#64748b';

  // Fetch CFO analytics data from backend, falling back to static data
  const { data: analyticsData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["finance-cfo-analytics"],
    queryFn: () => apiRequest<{
      liquidity?: typeof CFO_LIQUIDITY_DATA;
      arAging?: typeof CFO_AR_AGING_DATA;
      apPipeline?: typeof CFO_AP_PIPELINE_DATA;
      assetAllocation?: typeof CFO_ASSET_ALLOCATION;
      compliance?: typeof COMPLIANCE_RADAR_DATA;
    }>("/finance/dashboard/cfo-analytics", "GET", session),
    staleTime: 30_000,
  });

  const liquidityData = analyticsData?.liquidity ?? CFO_LIQUIDITY_DATA;
  const arAgingData = analyticsData?.arAging ?? CFO_AR_AGING_DATA;
  const apPipelineData = analyticsData?.apPipeline ?? CFO_AP_PIPELINE_DATA;
  const assetAllocationData = analyticsData?.assetAllocation ?? CFO_ASSET_ALLOCATION;
  const complianceData = analyticsData?.compliance ?? COMPLIANCE_RADAR_DATA;

  return (
    <section>
      <SectionLabel
        label="CFO Macro Analytics"
        sub="Liquidity, receivables, accounts payable & capital structure"
      />

      <QueryStateWrapper
        isLoading={isLoading}
        isError={isError}
        error={error ?? undefined}
        isEmpty={false}
        onRetry={() => refetch()}
      >

      {/* ── Row 1: Liquidity + AR Aging ─────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr] mb-5">
        <WorkspacePanel
          title="Treasury Liquidity & 6-Month Runway"
          description="Net cash reserve vs aggregate inflows and outflows (Rp M)"
          className="rounded-3xl border-border bg-card shadow-sm"
        >
          <div className="grid grid-cols-3 gap-4 my-5 p-4 bg-muted rounded-2xl border border-border">
            <SimpleKpi label="Inflows (Period)"  value={summaryData?.revenue != null ? `Rp ${Number(summaryData.revenue).toLocaleString()}` : "Rp 0"}  color="text-success" />
            <SimpleKpi label="Outflows (Period)" value={summaryData?.expense != null ? `Rp ${Number(summaryData.expense).toLocaleString()}` : "Rp 0"}  color="text-destructive"    />
            <SimpleKpi label="Net Reserve"    value={summaryData?.netProfit != null ? `Rp ${Number(summaryData.netProfit).toLocaleString()}` : "Rp 0"} color="text-primary"  />
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={liquidityData}>
                <defs>
                  <linearGradient id="gReserve" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={colors[1]} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={colors[1]} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: tickFill }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: tickFill }} dx={-8} />
                <ChartTooltip {...CHART_TOOLTIP_STYLE} formatter={fmt} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", fontWeight: 700, paddingTop: "10px" }} />
                <Area type="monotone" dataKey="reserve" name="Cash Reserve" stroke={colors[1]} strokeWidth={3} fill="url(#gReserve)" />
                <Bar dataKey="inflows"  name="Inflows"  fill={colors[2]} opacity={0.55} radius={[4,4,0,0]} barSize={14} />
                <Bar dataKey="outflows" name="Outflows" fill={theme === 'dark' ? '#f87171' : '#f43f5e'} opacity={0.55} radius={[4,4,0,0]} barSize={14} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </WorkspacePanel>

        <WorkspacePanel
          title="A/R Aging Report"
          description="Outstanding receivables by age — flags collection risk"
          className="rounded-3xl border-border bg-card shadow-sm"
        >
          <div className="flex items-center justify-between my-5">
            <div>
              <p className="text-2xl font-black tracking-tighter text-muted-foreground">Rp 785M</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">Total Outstanding</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-destructive">Rp 90M</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-destructive mt-0.5">High Risk (&gt;60d)</p>
            </div>
          </div>
          <div className="h-[248px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={arAgingData} layout="vertical" margin={{ left: 10, right: 30 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false}
                  tick={{ fontSize: 11, fontWeight: 700, fill: tickFill }} />
                <ChartTooltip {...CHART_TOOLTIP_STYLE} formatter={fmt} />
                <Bar dataKey="amount" name="Amount" radius={[0, 6, 6, 0]} barSize={22}>
                  {(Array.isArray(arAgingData) ? arAgingData : []).map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </WorkspacePanel>
      </div>

      {/* ── Row 2: AP Pipeline + Asset Allocation + Compliance Radar ── */}
      <div className="grid gap-5 lg:grid-cols-3">
        <WorkspacePanel
          title="Accounts Payable Pipeline"
          description="Outstanding liabilities by category — due vs overdue (Rp M)"
          className="rounded-3xl border-border bg-card shadow-sm"
        >
          <div className="h-[280px] w-full mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={apPipelineData} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false}
                  tick={{ fontSize: 11, fontWeight: 700, fill: tickFill }} width={76} />
                <ChartTooltip {...CHART_TOOLTIP_STYLE} formatter={fmt} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", fontWeight: 700, paddingTop: "8px" }} />
                <Bar dataKey="due"     name="Due"     stackId="a" fill={colors[1]} barSize={18} />
                <Bar dataKey="overdue" name="Overdue" stackId="a" fill={theme === 'dark' ? '#f87171' : '#f43f5e'} barSize={18} radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </WorkspacePanel>

        <WorkspacePanel
          title="Enterprise Asset Allocation"
          description="Capital deployment breakdown across liquidity classes"
          className="rounded-3xl border-border bg-card shadow-sm"
        >
          <div className="h-[280px] w-full relative mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={assetAllocationData} cx="50%" cy="44%" innerRadius={70}
                  outerRadius={100} paddingAngle={4} dataKey="value" stroke="none">
                  {(Array.isArray(assetAllocationData) ? assetAllocationData : []).map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <ChartTooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => [`${v}%`]} />
                <Legend verticalAlign="bottom" iconType="circle"
                  wrapperStyle={{ fontSize: "11px", fontWeight: 700 }} />
              </PieChart>
            </ResponsiveContainer>
            {/* Centre label */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
              style={{ marginTop: "-46px" }}
            >
              <DollarSign className="h-6 w-6 text-muted-foreground mb-0.5" />
              <span className="text-lg font-black text-muted-foreground">
                {summaryData ? `Rp ${Number(summaryData.kpis?.totalAssets || 0).toLocaleString()}` : "Rp 11.2B"}
              </span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Assets</span>
            </div>
          </div>
        </WorkspacePanel>

        <WorkspacePanel
          title="Compliance Health Radar"
          description="Cross-departmental governance adherence scoring"
          className="rounded-3xl border-border bg-card shadow-sm"
        >
          {/* Score pills */}
          <div className="flex flex-wrap gap-1.5 mt-3 mb-3">
            {(Array.isArray(complianceData) ? complianceData : []).map((d) => (
              <span
                key={d.subject}
                className={cn(
                  "text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide",
                  d.A >= 85 ? "bg-success text-success" :
                  d.A >= 75 ? "bg-warning text-warning"   :
                              "bg-destructive text-destructive",
                )}
              >
                {d.subject} {d.A}%
              </span>
            ))}
          </div>
          <div className="h-[232px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={complianceData}>
                <PolarGrid stroke={neutral} />
                <PolarAngleAxis dataKey="subject"
                  tick={{ fontSize: 11, fontWeight: 700, fill: tickFill }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Score" dataKey="A"
                  stroke={colors[1]} fill={colors[1]}
                  fillOpacity={0.2} strokeWidth={2} />
                <ChartTooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => [`${v}%`]} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </WorkspacePanel>
      </div>
      </QueryStateWrapper>
    </section>
  );
}
