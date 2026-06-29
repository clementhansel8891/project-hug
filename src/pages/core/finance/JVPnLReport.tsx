import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from "@/core/security/session";
import { financeService } from "@/core/services/finance/financeService";
import { formatNumber } from "@/lib/format";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Calendar,
  Users,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PnLParticipant {
  participant_id: string;
  participant_tenant_id: string;
  role: string;
  revenue_share_pct: number;
  profit_share_pct: number;
  revenue_allocated: number;
  cost_allocated: number;
  expense_burden: number;
  net_profit: number;
}

interface PnLData {
  period: { month: number; year: number };
  profile: { id: string; name: string; code: string };
  participants: PnLParticipant[];
  host: { tenant_id: string; expense_burden: number };
  totals: {
    total_allocated_revenue: number;
    total_allocated_costs: number;
    total_expenses: number;
  };
}

export default function JVPnLReport() {
  const session = useSession();
  const [pnlData, setPnlData] = useState<PnLData | null>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  // Load profiles
  useEffect(() => {
    if (!session) return;
    financeService.getJVProfiles(session).then((p) => {
      const list = Array.isArray(p) ? p : p ? [p] : [];
      setProfiles(list);
      if (list.length > 0 && !selectedProfile) {
        setSelectedProfile(list[0].id);
      }
    }).catch(() => {});
  }, [session]);

  // Load P&L when profile/period changes
  const loadPnL = useCallback(async () => {
    if (!session || !selectedProfile) return;
    setLoading(true);
    try {
      const data = await financeService.getJVPnL(session, selectedProfile, selectedMonth, selectedYear);
      setPnlData(data);
    } catch (e) {
      console.error("Failed to load P&L", e);
      setPnlData(null);
    } finally {
      setLoading(false);
    }
  }, [session, selectedProfile, selectedMonth, selectedYear]);

  useEffect(() => {
    loadPnL();
  }, [loadPnL]);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const totalRevenue = pnlData?.totals?.total_allocated_revenue || 0;
  const totalCosts = pnlData?.totals?.total_allocated_costs || 0;
  const totalExpenses = pnlData?.totals?.total_expenses || 0;
  const netProfit = totalRevenue - totalCosts - totalExpenses;

  return (
    <div className="space-y-6">
      <PageHeader
        title="JV Profit & Loss Report"
        subtitle="Detailed P&L breakdown per participant for the selected period."
      />

      {/* Period Selector */}
      <div className="flex flex-wrap gap-3 items-center">
        {profiles.length > 1 && (
          <Select value={selectedProfile} onValueChange={setSelectedProfile}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Select JV Profile" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026, 2027].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={loadPnL} className="gap-2">
          <Calendar className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-muted-foreground">Loading P&L data...</div>
      ) : !pnlData ? (
        <div className="p-12 text-center text-muted-foreground">
          <PieChart className="h-12 w-12 mx-auto opacity-30 mb-4" />
          <p>No data available for this period.</p>
        </div>
      ) : (
        <>
          {/* Summary KPI Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="p-5 rounded-2xl border bg-card shadow-sm">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Revenue</p>
              <p className="text-2xl font-black text-primary mt-1">
                Rp {formatNumber(totalRevenue)}
              </p>
              <div className="mt-3 flex items-center gap-1 text-xs text-success">
                <TrendingUp className="h-3 w-3" />
                <span>Allocated via shadow ledger</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl border bg-card shadow-sm">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Costs</p>
              <p className="text-2xl font-black text-orange-500 mt-1">
                Rp {formatNumber(totalCosts)}
              </p>
              <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                <TrendingDown className="h-3 w-3" />
                <span>COGS & operational</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl border bg-card shadow-sm">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Expenses</p>
              <p className="text-2xl font-black text-destructive mt-1">
                Rp {formatNumber(totalExpenses)}
              </p>
              <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                <Receipt className="h-3 w-3" />
                <span>JV expense claims</span>
              </div>
            </div>

            <div className={cn(
              "p-5 rounded-2xl border shadow-sm",
              netProfit >= 0 ? "bg-success/5 border-success/30" : "bg-destructive/5 border-destructive/30"
            )}>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Net Profit</p>
              <p className={cn(
                "text-2xl font-black mt-1",
                netProfit >= 0 ? "text-success" : "text-destructive"
              )}>
                {netProfit >= 0 ? "+" : ""}Rp {formatNumber(Math.abs(netProfit))}
              </p>
              <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                {netProfit >= 0 ? <ArrowUpRight className="h-3 w-3 text-success" /> : <ArrowDownRight className="h-3 w-3 text-destructive" />}
                <span>Revenue - Costs - Expenses</span>
              </div>
            </div>
          </div>

          {/* Per-Participant Breakdown */}
          <WorkspacePanel>
            <div className="p-4 border-b">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Participant P&L Breakdown — {months[selectedMonth - 1]} {selectedYear}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Profile: {pnlData.profile.name} ({pnlData.profile.code})
              </p>
            </div>

            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">Participant</th>
                  <th className="p-3 text-center">Role</th>
                  <th className="p-3 text-center">Revenue %</th>
                  <th className="p-3 text-right">Revenue Allocated</th>
                  <th className="p-3 text-right">Cost Burden</th>
                  <th className="p-3 text-right">Expense Burden</th>
                  <th className="p-3 text-right">Net Profit</th>
                </tr>
              </thead>
              <tbody>
                {pnlData.participants.map((p) => (
                  <tr key={p.participant_id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <div className="font-medium text-xs font-mono">{p.participant_tenant_id}</div>
                    </td>
                    <td className="p-3 text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          p.role === "OPERATOR" ? "border-primary/40 text-primary" : "border-warning/40 text-warning"
                        )}
                      >
                        {p.role}
                      </Badge>
                    </td>
                    <td className="p-3 text-center font-mono text-xs">
                      {p.revenue_share_pct}%
                    </td>
                    <td className="p-3 text-right font-mono text-success">
                      +Rp {formatNumber(p.revenue_allocated)}
                    </td>
                    <td className="p-3 text-right font-mono text-orange-500">
                      -Rp {formatNumber(p.cost_allocated)}
                    </td>
                    <td className="p-3 text-right font-mono text-destructive">
                      -Rp {formatNumber(p.expense_burden)}
                    </td>
                    <td className={cn(
                      "p-3 text-right font-mono font-bold",
                      p.net_profit >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {p.net_profit >= 0 ? "+" : ""}Rp {formatNumber(Math.abs(p.net_profit))}
                    </td>
                  </tr>
                ))}

                {/* Host row */}
                {pnlData.host && (
                  <tr className="border-t bg-muted/20">
                    <td className="p-3">
                      <div className="font-medium text-xs font-mono">{pnlData.host.tenant_id}</div>
                      <div className="text-[10px] text-muted-foreground">Host Tenant</div>
                    </td>
                    <td className="p-3 text-center">
                      <Badge className="bg-primary/20 text-primary text-[10px]">HOST</Badge>
                    </td>
                    <td className="p-3 text-center font-mono text-xs">—</td>
                    <td className="p-3 text-right font-mono text-muted-foreground">—</td>
                    <td className="p-3 text-right font-mono text-muted-foreground">—</td>
                    <td className="p-3 text-right font-mono text-destructive">
                      -Rp {formatNumber(pnlData.host.expense_burden)}
                    </td>
                    <td className="p-3 text-right font-mono text-muted-foreground">—</td>
                  </tr>
                )}
              </tbody>
              <tfoot className="border-t-2 border-primary/20 bg-primary/5">
                <tr>
                  <td className="p-3 font-bold" colSpan={3}>TOTAL</td>
                  <td className="p-3 text-right font-mono font-bold text-success">
                    +Rp {formatNumber(totalRevenue)}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-orange-500">
                    -Rp {formatNumber(totalCosts)}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-destructive">
                    -Rp {formatNumber(totalExpenses)}
                  </td>
                  <td className={cn(
                    "p-3 text-right font-mono font-bold",
                    netProfit >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {netProfit >= 0 ? "+" : ""}Rp {formatNumber(Math.abs(netProfit))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </WorkspacePanel>
        </>
      )}
    </div>
  );
}
