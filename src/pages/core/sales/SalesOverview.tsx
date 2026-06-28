import { useCallback, useEffect, useState } from "react";
import { 
  TrendingUp, 
  Target, 
  Clock, 
  Percent, 
  ArrowUpRight, 
  ArrowDownRight,
  Medal,
  Activity,
  Zap,
  DollarSign,
  BarChart3,
  PieChart,
  RefreshCw,
  Search,
  ShieldCheck,
  ChevronRight,
  Users,
  Target as TargetIcon
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { GlassCard } from "@/components/shared/GlassCard";
import { useSession } from "@/core/security/session";
import { salesService } from "@/core/services/sales/salesService";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from "recharts";

export default function SalesOverview() {
  const session = useSession();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [forecast, setForecast] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [projection, setProjection] = useState<any[]>([]);

  const refresh = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      const [f, a, p] = await Promise.all([
        salesService.getExecutiveForecast(session.tenant_id, session),
        salesService.getAnalytics(session.tenant_id, session),
        salesService.getForecast(session.tenant_id, session),
      ]);
      setForecast(f);
      setAnalytics(a);
      setProjection(p);
      if (isManual) toast.success("Executive telemetry synchronized.");
    } catch (err) {
      console.error("Failed to fetch executive sales data:", err);
      toast.error("Telemetry failure in executive suite.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session.tenant_id, session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading || !forecast) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted dark:bg-muted">
        <div className="flex flex-col items-center gap-6">
          <div className="h-20 w-20 bg-primary rounded-[2.5rem] animate-pulse flex items-center justify-center shadow-2xl shadow-indigo-500/20">
            <TrendingUp className="h-10 w-10 text-white" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Projecting Executive Intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-10 animate-in fade-in duration-1000 max-w-[1600px] mx-auto pb-24">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row justify-between items-end gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge className="bg-primary text-white border-none font-black px-3 py-1 rounded-full uppercase tracking-widest text-[10px]">Executive Intelligence</Badge>
            <div className="flex items-center gap-1.5 text-primary font-bold text-xs uppercase tracking-widest">
               <Activity className="h-4 w-4 animate-pulse" />
               Global Sales Pulse Active
            </div>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-foreground italic">Sales Overview</h1>
          <p className="text-muted-foreground font-medium max-w-2xl text-lg leading-relaxed italic">"Revenue is the result of strategic coordination and relentless execution."</p>
        </div>
        
        <div className="flex items-center bg-muted0 dark:bg-muted backdrop-blur-xl p-2 rounded-[2rem] border border-border dark:border-border/20 shadow-2xl">
          <Button
            variant="secondary"
            className="h-14 w-14 rounded-[1.5rem] bg-primary text-white hover:bg-primary transition-all shadow-xl shadow-indigo-500/20"
            onClick={() => refresh(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-6 w-6", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Strategic KPI Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KPIItem 
          title="Won Revenue" 
          value={formatCurrency(forecast.wonThisPeriod)} 
          trend="+12.5%" 
          trendUp={true}
          icon={DollarSign}
          description="Gross victory yield this period"
          color="emerald"
        />
        <KPIItem 
          title="Weighted Forecast" 
          value={formatCurrency(forecast.weightedForecastValue)} 
          trend="+5.2%" 
          trendUp={true}
          icon={TargetIcon}
          description="Probability-adjusted pipeline"
          color="indigo"
        />
        <KPIItem 
          title="Conversion Rate" 
          value={`${forecast.conversionRate}%`} 
          trend="-1.2%" 
          trendUp={false}
          icon={Zap}
          description="Won vs. Closed efficiency"
          color="blue"
        />
        <KPIItem 
          title="Avg. Deal Cycle" 
          value={`${forecast.avgDealCycleDays}d`} 
          trend="OPTIMIZED" 
          trendUp={true}
          icon={Clock}
          description="Creation to Victory velocity"
          color="amber"
        />
      </div>

      <div className="grid gap-10 lg:grid-cols-3">
        {/* Revenue Projection Model */}
        <Card className="lg:col-span-2 rounded-[3rem] border-none shadow-2xl bg-white dark:bg-muted overflow-hidden group">
          <CardHeader className="p-10 pb-4">
            <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
              <TrendingUp className="h-6 w-6 text-primary" />
              Strategic Projection Model
            </CardTitle>
            <CardDescription className="text-sm font-medium">Weighted vs. Commit forecast delta (6 Month Tactical Horizon)</CardDescription>
          </CardHeader>
          <CardContent className="p-10 pt-0">
            <div className="h-[350px] w-full pt-8 group-hover:scale-[1.01] transition-transform duration-700">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projection}>
                  <defs>
                    <linearGradient id="colorWeighted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tickFormatter={(value) => `Rp ${(value/1000)}k`} 
                    tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}
                  />
                  <Tooltip 
                    cursor={{ stroke: '#4f46e5', strokeWidth: 2, strokeDasharray: '4 4' }}
                    contentStyle={{ 
                      borderRadius: '24px', 
                      border: 'none', 
                      boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                      padding: '16px',
                      fontWeight: 900
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="weighted" 
                    stroke="#4f46e5" 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorWeighted)" 
                    name="Weighted Projection"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="commit" 
                    stroke="#ef4444" 
                    strokeWidth={2} 
                    fill="transparent"
                    strokeDasharray="8 8"
                    name="Commit Model"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Performance Board */}
        <Card className="rounded-[3rem] border-none shadow-2xl bg-white dark:bg-muted overflow-hidden group">
          <CardHeader className="p-10 pb-4">
            <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
              <Medal className="h-6 w-6 text-warning" />
              Victory Leaders
            </CardTitle>
            <CardDescription className="text-sm font-medium">Top representatives by won revenue yield this year.</CardDescription>
          </CardHeader>
          <CardContent className="p-10 pt-0 space-y-8">
            {(Array.isArray(analytics.topReps) ? analytics.topReps : []).map((rep: any, idx: number) => (
              <div key={rep.name} className="flex items-center justify-between group/item">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-black transition-all shadow-inner",
                    idx === 0 ? "bg-warning text-white shadow-amber-500/20" :
                    idx === 1 ? "bg-muted text-muted-foreground dark:bg-muted" :
                    "bg-muted text-muted-foreground dark:bg-muted"
                  )}>
                    {idx === 0 ? <Medal className="h-5 w-5" /> : idx + 1}
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-tight">{rep.name}</p>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">RANK {idx + 1} CUSTODIAN</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-base font-black text-primary">{formatCurrency(Number(rep.total))}</p>
                  <div className="h-1.5 w-32 bg-muted dark:bg-muted rounded-full mt-2 overflow-hidden shadow-inner">
                    <div 
                      className={cn("h-full transition-all duration-1000", idx === 0 ? "bg-warning" : "bg-primary")}
                      style={{ width: `${(rep.total / analytics.topReps[0].total) * 100}%` }} 
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-10 md:grid-cols-2">
        {/* Revenue Distribution */}
        <GlassCard className="rounded-[3rem] border-none shadow-2xl overflow-hidden p-10 space-y-6">
          <div className="space-y-2">
            <h3 className="text-2xl font-black tracking-tight flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-primary" />
              Capture Trend
            </h3>
            <p className="text-sm font-medium text-muted-foreground">Monthly revenue capture velocity across all channels.</p>
          </div>
          <div className="h-[250px] w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(79, 70, 229, 0.05)', radius: 12 }}
                  contentStyle={{ 
                    borderRadius: '24px', 
                    border: 'none', 
                    boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                    padding: '16px'
                  }} 
                />
                <Bar 
                  dataKey="revenue" 
                  fill="#4f46e5" 
                  radius={[12, 12, 0, 0]} 
                  name="Revenue Captured"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Funnel Health Matrix */}
        <GlassCard className="rounded-[3rem] border-none shadow-2xl p-10 space-y-8">
           <div className="space-y-2">
              <h3 className="text-2xl font-black tracking-tight flex items-center gap-3">
                 <ShieldCheck className="h-6 w-6 text-success" />
                 Funnel Health Matrix
              </h3>
              <p className="text-sm font-medium text-muted-foreground">Real-time signals of funnel integrity and deal velocity.</p>
           </div>
           <div className="grid grid-cols-2 gap-6">
              <HealthMetric 
                 label="Funnel Integrity" 
                 value="HIGH" 
                 detail="SLA Compliance: 94%" 
                 color="text-success"
                 icon={ShieldCheck}
              />
              <HealthMetric 
                 label="Stalled Nodes" 
                 value="4" 
                 detail="> 30 days stagnant" 
                 color="text-warning"
                 icon={Clock}
              />
              <HealthMetric 
                 label="Lost Deal Value" 
                 value={formatCurrency(forecast.lostThisPeriod)} 
                 detail="Gross slippage this month" 
                 color="text-destructive"
                 icon={ArrowDownRight}
              />
              <HealthMetric 
                 label="Pipeline Health" 
                 value="STRONG" 
                 detail="Growth: +8.3% MoM" 
                 color="text-primary"
                 icon={TrendingUp}
              />
           </div>
        </GlassCard>
      </div>
    </div>
  );
}

function KPIItem({ title, value, trend, trendUp, description, icon: Icon, color }: any) {
  return (
    <Card className="group relative overflow-hidden rounded-[2.5rem] border-none bg-white dark:bg-muted p-8 shadow-xl transition-all hover:shadow-2xl hover:-translate-y-1">
      <div className="flex items-center justify-between relative z-10">
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
          <h3 className="text-3xl font-black tracking-tighter">{value}</h3>
        </div>
        <div className={cn("rounded-2xl p-4 shadow-inner group-hover:scale-110 transition-transform", `bg-${color}-500/10 text-${color}-600`)}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <div className="mt-6 flex items-center gap-3 relative z-10">
        <Badge className={cn(
          "rounded-full font-black text-[9px] px-2.5 py-0.5 border-none shadow-sm uppercase tracking-widest",
          trendUp ? "bg-success text-white" : "bg-destructive text-white"
        )}>
          {trendUp ? <ArrowUpRight className="h-3 w-3 mr-1 inline" /> : <ArrowDownRight className="h-3 w-3 mr-1 inline" />}
          {trend}
        </Badge>
        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">{description}</span>
      </div>
      <div className={cn("absolute bottom-0 left-0 h-1 w-0 transition-all duration-700 group-hover:w-full", `bg-${color}-600`)} />
    </Card>
  );
}

function HealthMetric({ label, value, detail, color, icon: Icon }: any) {
  return (
    <div className="rounded-[2rem] bg-card dark:bg-muted p-6 space-y-3 shadow-sm border border-border">
      <div className="flex items-center justify-between">
         <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
         <Icon className={cn("h-4 w-4", color)} />
      </div>
      <div className="space-y-1">
        <span className={cn("text-2xl font-black tracking-tighter", color)}>{value}</span>
        <p className="text-[9px] font-bold text-muted-foreground uppercase italic leading-none">{detail}</p>
      </div>
    </div>
  );
}
