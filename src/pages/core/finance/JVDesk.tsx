import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { DataTableShell } from "@/core/tools/DataTableShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/core/security/session";
import { financeService } from "@/core/services/finance/financeService";
import { InvitePartnerDialog } from "./components/InvitePartnerDialog";
import { JVExpenseDialog } from "./components/JVExpenseDialog";
import { JVSettlementDialog } from "./components/JVSettlementDialog";
import { JVPermissionPanel } from "./components/JVPermissionPanel";
import { formatNumber } from "@/lib/format";
import {
  Users,
  UserPlus,
  HandCoins,
  Scale,
  History,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Receipt,
  FileText,
  Shield,
  Activity,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function JVDesk() {
  const session = useSession();
  const [tab, setTab] = useState<string>("expenses");
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [settlement, setSettlement] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string>("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, l, s] = await Promise.all([
        financeService.getJVProfiles(session),
        financeService.getJVLedger(session),
        financeService.getJVNetSettlement(session, "current"),
      ]);
      setProfiles(p || []);
      setLedger(l || []);
      setSettlement(s || []);

      // Auto-select first profile
      if (p && p.length > 0 && !selectedProfile) {
        setSelectedProfile(p[0].id);
      }
    } catch (e) {
      console.error("Failed to load JV data", e);
    } finally {
      setLoading(false);
    }
  }, [session, selectedProfile]);

  // Load expenses and settlements when profile is selected
  useEffect(() => {
    if (selectedProfile && session) {
      financeService.getJVExpenses(session, selectedProfile).then(setExpenses).catch(() => setExpenses([]));
      financeService.getJVSettlements(session, selectedProfile).then(setSettlements).catch(() => setSettlements([]));
      financeService.getJVActivityLog(session, selectedProfile, 20).then(setActivityLog).catch(() => setActivityLog([]));
    }
  }, [selectedProfile, session]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApproveExpense = async (expenseId: string) => {
    try {
      await financeService.approveJVExpense(session, expenseId);
      // Reload expenses
      const updated = await financeService.getJVExpenses(session, selectedProfile);
      setExpenses(updated || []);
    } catch (e) {
      console.error("Failed to approve expense", e);
    }
  };

  const handleRejectExpense = async (expenseId: string) => {
    const reason = prompt("Rejection reason:");
    if (!reason) return;
    try {
      await financeService.rejectJVExpense(session, expenseId, reason);
      const updated = await financeService.getJVExpenses(session, selectedProfile);
      setExpenses(updated || []);
    } catch (e) {
      console.error("Failed to reject expense", e);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: "bg-muted text-muted-foreground",
      SUBMITTED: "bg-warning/20 text-warning border-warning/30",
      APPROVED: "bg-success/20 text-success border-success/30",
      REJECTED: "bg-destructive/20 text-destructive border-destructive/30",
      ALLOCATED: "bg-primary/20 text-primary border-primary/30",
      CONFIRMED: "bg-success/20 text-success border-success/30",
      INVOICED: "bg-primary/20 text-primary border-primary/30",
      PAID: "bg-success/20 text-success border-success/30",
      DISPUTED: "bg-destructive/20 text-destructive border-destructive/30",
      PENDING: "bg-warning/20 text-warning border-warning/30",
    };
    return <Badge className={cn("text-[10px] font-bold", styles[status] || "bg-muted")}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <InvitePartnerDialog open={inviteOpen} onOpenChange={setInviteOpen} profiles={profiles} />
      <JVExpenseDialog
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        profileId={selectedProfile}
        onSuccess={() => {
          financeService.getJVExpenses(session, selectedProfile).then(setExpenses);
        }}
      />
      <JVSettlementDialog
        open={settlementOpen}
        onOpenChange={setSettlementOpen}
        profileId={selectedProfile}
        onSuccess={() => {
          financeService.getJVSettlements(session, selectedProfile).then(setSettlements);
        }}
      />

      <PageHeader
        title="Joint Venture Operations"
        subtitle="Full JV lifecycle: expenses, profit-sharing, settlements, and cross-party team access management."
        primaryAction={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Invite Partner
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setExpenseOpen(true)}>
              <Receipt className="h-4 w-4" />
              Log Expense
            </Button>
            <Button className="gap-2" onClick={() => setSettlementOpen(true)}>
              <Scale className="h-4 w-4" />
              Generate Settlement
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users className="h-12 w-12 text-primary" />
          </div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Active JV Profiles</p>
          <p className="text-3xl font-black text-primary mt-1">{profiles.length || 0}</p>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <ArrowUpRight className="h-3 w-3 text-success" />
            <span>{profiles.length > 0 ? `${profiles.length} active` : "No profiles yet"}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Receipt className="h-12 w-12 text-warning" />
          </div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Pending Expenses</p>
          <p className="text-3xl font-black text-warning mt-1">
            {expenses.filter(e => e.status === "SUBMITTED").length}
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <Clock className="h-3 w-3 text-warning" />
            <span>Awaiting approval</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <HandCoins className="h-12 w-12 text-primary" />
          </div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">MTD Revenue Split</p>
          <p className="text-3xl font-black text-primary mt-1">
            {settlement[0] ? `Rp ${(Math.abs(settlement[0].gross_revenue || 0) / 1e6).toFixed(0)}M` : "—"}
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <TrendingUp className="h-3 w-3 text-success" />
            <span>Allocated this month</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Scale className="h-12 w-12 text-destructive" />
          </div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Open Settlements</p>
          <p className="text-3xl font-black text-destructive mt-1">
            {settlements.filter(s => s.status === "DRAFT" || s.status === "CONFIRMED").length}
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <ArrowDownRight className="h-3 w-3 text-destructive" />
            <span>Pending payment</span>
          </div>
        </div>
      </div>

      {/* Profile selector */}
      {profiles.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {(Array.isArray(profiles) ? profiles : []).map(p => (
            <Button
              key={p.id}
              variant={selectedProfile === p.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedProfile(p.id)}
              className="gap-2"
            >
              {p.name}
              {p.is_active && <Badge className="bg-success/20 text-success text-[9px] h-4 px-1">ACTIVE</Badge>}
            </Button>
          ))}
        </div>
      )}

      <WorkspacePanel>
        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex items-center justify-between border-b pb-1">
            <TabsList className="bg-transparent border-none">
              <TabsTrigger value="expenses" className="data-[state=active]:bg-muted gap-2">
                <Receipt className="h-3.5 w-3.5" /> Expenses
              </TabsTrigger>
              <TabsTrigger value="settlements" className="data-[state=active]:bg-muted gap-2">
                <Scale className="h-3.5 w-3.5" /> Settlements
              </TabsTrigger>
              <TabsTrigger value="ledger" className="data-[state=active]:bg-muted gap-2">
                <FileText className="h-3.5 w-3.5" /> Shadow Ledger
              </TabsTrigger>
              <TabsTrigger value="permissions" className="data-[state=active]:bg-muted gap-2">
                <Shield className="h-3.5 w-3.5" /> Access Control
              </TabsTrigger>
              <TabsTrigger value="activity" className="data-[state=active]:bg-muted gap-2">
                <Activity className="h-3.5 w-3.5" /> Activity
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ─── EXPENSES TAB ─────────────────────────────────────────── */}
          <TabsContent value="expenses" className="pt-4">
            <DataTableShell total={expenses.length} page={1} pageSize={20}>
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Description</th>
                    <th className="p-3 text-left">Submitted By</th>
                    <th className="p-3 text-left">Amount</th>
                    <th className="p-3 text-left">Split</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length > 0 ? (
                    (Array.isArray(expenses) ? expenses : []).map((e) => (
                      <tr key={e.id} className="border-t hover:bg-muted/50 transition-colors">
                        <td className="p-3 text-xs text-muted-foreground">
                          {new Date(e.expense_date).toLocaleDateString()}
                        </td>
                        <td className="p-3 font-medium">{e.description}</td>
                        <td className="p-3 text-xs">
                          <Badge variant="outline" className="text-[10px]">
                            {e.submitter_tenant_id === session?.tenantId ? "You" : "Partner"}
                          </Badge>
                        </td>
                        <td className="p-3 font-semibold">Rp {formatNumber(Number(e.amount) || 0)}</td>
                        <td className="p-3 text-xs">
                          <Badge variant="outline">{e.split_method}</Badge>
                        </td>
                        <td className="p-3">{getStatusBadge(e.status)}</td>
                        <td className="p-3 text-right">
                          {e.status === "SUBMITTED" && e.submitter_tenant_id !== session?.tenantId && (
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-success hover:text-success"
                                onClick={() => handleApproveExpense(e.id)}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-destructive hover:text-destructive"
                                onClick={() => handleRejectExpense(e.id)}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                          {e.status === "SUBMITTED" && e.submitter_tenant_id === session?.tenantId && (
                            <span className="text-xs text-muted-foreground italic">Awaiting partner</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground italic">
                        No expenses logged yet. Click "Log Expense" to record a shared cost.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </DataTableShell>
          </TabsContent>

          {/* ─── SETTLEMENTS TAB ──────────────────────────────────────── */}
          <TabsContent value="settlements" className="pt-4">
            <DataTableShell total={settlements.length} page={1} pageSize={10}>
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Period</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Participants</th>
                    <th className="p-3 text-left">Net Payable</th>
                    <th className="p-3 text-left">Payment Ref</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.length > 0 ? (
                    (Array.isArray(settlements) ? settlements : []).map((s) => (
                      <tr key={s.id} className="border-t hover:bg-muted/50 transition-colors">
                        <td className="p-3 text-xs font-mono">
                          {new Date(s.period_start).toLocaleDateString()} – {new Date(s.period_end).toLocaleDateString()}
                        </td>
                        <td className="p-3">{getStatusBadge(s.status)}</td>
                        <td className="p-3 text-xs">{s.lines?.length || 0} parties</td>
                        <td className="p-3 font-semibold">
                          {s.lines && s.lines.length > 0
                            ? `Rp ${formatNumber(s.lines.reduce((sum: number, l: any) => sum + Number(l.net_payable || 0), 0))}`
                            : "—"
                          }
                        </td>
                        <td className="p-3 text-xs font-mono text-muted-foreground">{s.payment_ref || "—"}</td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="sm">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground italic">
                        No settlements generated. Click "Generate Settlement" to reconcile a period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </DataTableShell>
          </TabsContent>

          {/* ─── SHADOW LEDGER TAB ────────────────────────────────────── */}
          <TabsContent value="ledger" className="pt-4">
            <DataTableShell total={ledger.length} page={1} pageSize={20}>
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Type</th>
                    <th className="p-3 text-left">Side</th>
                    <th className="p-3 text-left">Amount</th>
                    <th className="p-3 text-left">Account</th>
                    <th className="p-3 text-left">Journal Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(ledger) ? ledger : []).map((l, idx) => (
                    <tr key={idx} className="border-t hover:bg-muted/50">
                      <td className="p-3 text-xs text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}</td>
                      <td className="p-3"><Badge variant="outline">{l.type}</Badge></td>
                      <td className="p-3 text-xs font-mono">{l.side}</td>
                      <td className="p-3 font-semibold">Rp {formatNumber(Number(l.allocated_amt) || 0)}</td>
                      <td className="p-3 text-xs font-mono">{l.account_code}</td>
                      <td className="p-3 text-xs font-mono text-muted-foreground">{l.journal_id?.substring(0, 8)}</td>
                    </tr>
                  ))}
                  {ledger.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground italic">Shadow ledger is empty.</td></tr>
                  )}
                </tbody>
              </table>
            </DataTableShell>
          </TabsContent>

          {/* ─── PERMISSIONS TAB ──────────────────────────────────────── */}
          <TabsContent value="permissions" className="pt-4">
            <JVPermissionPanel profileId={selectedProfile} profiles={profiles} />
          </TabsContent>

          {/* ─── ACTIVITY LOG TAB ─────────────────────────────────────── */}
          <TabsContent value="activity" className="pt-4">
            <div className="space-y-3">
              {activityLog.length > 0 ? (
                activityLog.map((a, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                    <Activity className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{a.action.replace(/_/g, " ")}</span>
                        <Badge variant="outline" className="text-[9px]">{a.entity_type}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {a.actor_tenant_id === session?.tenantId ? "You" : "Partner"} • {new Date(a.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-muted-foreground italic">
                  No activity recorded yet.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </WorkspacePanel>
    </div>
  );
}
