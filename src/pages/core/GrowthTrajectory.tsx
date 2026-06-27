import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Bar } from "recharts";
import { useSession } from "@/core/security/session";
import { adminService } from "@/core/services";
import { TrendingUp, Users, DollarSign, ShoppingCart, Target, ArrowUpRight, Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import { CHART_COLORS, CHART_COLORS_DARK } from "@/lib/chart-colors";
import DashboardLayout from "./DashboardLayout";

export default function GrowthTrajectory() {
  const session = useSession();
  const { theme } = useTheme();
  const colors = theme === "dark" ? CHART_COLORS_DARK : CHART_COLORS;
  const tickFill = theme === "dark" ? "#94a3b8" : "#64748b";
  const gridStroke = theme === "dark" ? "#1e293b" : "#f1f5f9";
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService.getDashboardMetrics(session.tenant_id, session, "12M").then(res => {
      if (res) setData(res);
    }).finally(() => setLoading(false));
  }, [session]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const revenueData = data?.timeseries?.financialOverview || [
    { month: "Jan", revenue: 3200000, expenses: 2400000 },
    { month: "Feb", revenue: 3500000, expenses: 2500000 },
    { month: "Mar", revenue: 3800000, expenses: 2600000 },
    { month: "Apr", revenue: 4100000, expenses: 2700000 },
    { month: "May", revenue: 4500000, expenses: 2800000 },
    { month: "Jun", revenue: 4900000, expenses: 2900000 },
  ];

  const kpis = data?.kpis || [];
  const totalRevenue = kpis.find((k: any) => k.label === "Revenue")?.value || "Rp 73.5M";

  const growthMetrics = [
    { label: "Revenue Growth", value: "+23%", icon: DollarSign },
    { label: "Customer Acquisition", value: "+18%", icon: Users },
    { label: "Order Volume", value: "+31%", icon: ShoppingCart },
    { label: "Market Expansion", value: "+12%", icon: Target },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 md:p-10 max-w-[1600px] mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">Growth Trajectory</h1>
          <p className="text-sm text-muted-foreground mt-1">12-month revenue acceleration and market expansion analysis</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {growthMetrics.map((metric, i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{metric.label}</p>
                    <p className="text-3xl font-black text-foreground mt-2">{metric.value}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                    <metric.icon className="h-6 w-6 text-success" />
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-3 text-xs text-success font-bold">
                  <ArrowUpRight className="h-3 w-3" />
                  <span>vs last quarter</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg font-black uppercase tracking-tight text-foreground flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              Revenue & Profit Trajectory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={revenueData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: tickFill }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: tickFill }} tickFormatter={(v) => `Rp ${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip contentStyle={{ backgroundColor: theme === "dark" ? "#1e293b" : "#fff", borderRadius: "0.75rem", border: "none", boxShadow: "0 10px 25px -5px rgb(0 0 0 / 0.15)" }} />
                  <Area type="monotone" dataKey="revenue" fill={colors[1] + "30"} stroke={colors[1]} strokeWidth={3} name="Revenue" />
                  <Bar dataKey="expenses" fill={tickFill} opacity={0.3} radius={[4, 4, 0, 0]} name="Expenses" />
                  <Line type="monotone" dataKey="revenue" stroke={colors[2]} strokeWidth={3} dot={{ r: 4, fill: colors[2] }} name="Trend" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase tracking-wide text-foreground">Quarterly Targets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { quarter: "Q1 2026", target: "Rp 187.5M", actual: "Rp 177M", pct: 94 },
                { quarter: "Q2 2026", target: "Rp 210M", actual: "Rp 223.5M", pct: 106 },
                { quarter: "Q3 2026", target: "Rp 240M", actual: "In Progress", pct: 62 },
                { quarter: "Q4 2026", target: "Rp 277.5M", actual: "Projected", pct: 0 },
              ].map((q, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-border">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground">{q.quarter}</p>
                    <p className="text-lg font-black text-foreground">{q.actual}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Target: {q.target}</p>
                    {q.pct > 0 && (
                      <div className={`text-xs font-bold mt-1 ${q.pct >= 100 ? "text-success" : "text-warning"}`}>
                        {q.pct}% achieved
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase tracking-wide text-foreground">Growth Drivers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { driver: "Retail POS Expansion", impact: "High", contribution: "+Rp 31.5M" },
                { driver: "New Customer Onboarding", impact: "High", contribution: "+Rp 27M" },
                { driver: "Upsell to Enterprise", impact: "Medium", contribution: "+Rp 14.25M" },
                { driver: "Geographic Expansion", impact: "Medium", contribution: "+Rp 10.8M" },
                { driver: "Product Innovation", impact: "Low", contribution: "+Rp 5.1M" },
              ].map((d, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-border">
                  <div>
                    <p className="text-sm font-bold text-foreground">{d.driver}</p>
                    <p className="text-xs text-muted-foreground">Impact: {d.impact}</p>
                  </div>
                  <span className="text-sm font-black text-success">{d.contribution}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
