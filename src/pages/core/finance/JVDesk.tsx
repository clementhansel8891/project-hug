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
  Filter
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function JVDesk() {
  const session = useSession();
  const [tab, setTab] = useState<"settlement" | "ledger" | "profiles">("settlement");
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [settlement, setSettlement] = useState<any[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, l, s] = await Promise.all([
        financeService.getJVProfiles(session),
        financeService.getJVLedger(session),
        financeService.getJVNetSettlement(session, "current")
      ]);
      setProfiles(p || []);
      setLedger(l || []);
      setSettlement(s || []);
    } catch (e) {
      console.error("Failed to load JV data", e);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      <InvitePartnerDialog 
        open={inviteOpen} 
        onOpenChange={setInviteOpen} 
        profiles={profiles} 
      />
      <PageHeader
        title="JV Settlement Desk"
        subtitle="Manage Joint Venture participant allocations, cost-sharing mapping, and net settlements."
        primaryAction={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Invite Partner
            </Button>
            <Button className="gap-2">
              <Users className="h-4 w-4" />
              New JV Profile
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users className="h-12 w-12 text-primary" />
          </div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Active Participants</p>
          <p className="text-3xl font-black text-primary mt-1">{profiles.length || 0}</p>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <ArrowUpRight className="h-3 w-3 text-success" />
            <span>{profiles.length > 0 ? `${profiles.length} active` : 'No profiles yet'}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <HandCoins className="h-12 w-12 text-primary" />
          </div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">MTD Allocated Revenue</p>
          <p className="text-3xl font-black text-primary mt-1">{settlement[0] ? `Rp ${(Math.abs(settlement[0].totalDebit || 0) / 1e9).toFixed(1)}B` : '—'}</p>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <History className="h-3 w-3" />
            <span>Last sync: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Scale className="h-12 w-12 text-destructive" />
          </div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Pending Cost Burden</p>
          <p className="text-3xl font-black text-destructive mt-1">{settlement[0] ? `Rp ${(Math.abs(settlement[0].totalCredit || 0) / 1e6).toFixed(0)}M` : '—'}</p>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <ArrowDownRight className="h-3 w-3 text-destructive" />
            <span>From active settlements</span>
          </div>
        </div>
      </div>

      <WorkspacePanel>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <div className="flex items-center justify-between border-b pb-1">
            <TabsList className="bg-transparent border-none">
              <TabsTrigger value="settlement" className="data-[state=active]:bg-muted">Settlements</TabsTrigger>
              <TabsTrigger value="ledger" className="data-[state=active]:bg-muted">Shadow Ledger</TabsTrigger>
              <TabsTrigger value="profiles" className="data-[state=active]:bg-muted">JV Profiles</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-3 w-3" />
                Filters
              </Button>
            </div>
          </div>

          <TabsContent value="settlement" className="pt-4">
            <DataTableShell total={settlement.length} page={1} pageSize={10}>
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Participant</th>
                    <th className="p-3 text-left">Gross Revenue</th>
                    <th className="p-3 text-left">Cost Burden</th>
                    <th className="p-3 text-left">Net Payable</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {settlement.length > 0 ? (
                    (Array.isArray(settlement) ? settlement : []).map((s, idx) => (
                      <tr key={idx} className="border-t hover:bg-muted/50 transition-colors">
                        <td className="p-3 font-medium text-primary">{s.participant_name}</td>
                        <td className="p-3 text-success font-medium">Rp {formatNumber(s.gross_revenue ?? 0)}</td>
                        <td className="p-3 text-destructive font-medium">Rp {formatNumber(s.cost_burden ?? 0)}</td>
                        <td className="p-3">
                          <Badge className={cn(
                            s.net_payable > 0 ? "bg-success text-success border-success/30" : "bg-destructive text-destructive border-destructive/30"
                          )}>
                            Rp {formatNumber(s.net_payable ?? 0)}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="sm">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground italic">
                        No settlements calculated for the selected period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </DataTableShell>
          </TabsContent>

          <TabsContent value="ledger" className="pt-4">
            <DataTableShell total={ledger.length} page={1} pageSize={20}>
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Participant</th>
                    <th className="p-3 text-left">Type</th>
                    <th className="p-3 text-left">Amount</th>
                    <th className="p-3 text-left">Journal Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(ledger) ? ledger : []).map((l, idx) => (
                    <tr key={idx} className="border-t hover:bg-muted/50">
                      <td className="p-3 text-xs text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}</td>
                      <td className="p-3 font-medium">{l.participant_name}</td>
                      <td className="p-3">
                        <Badge variant="outline">{l.type}</Badge>
                      </td>
                      <td className="p-3 font-semibold">Rp {formatNumber(l.allocated_amt ?? 0)}</td>
                      <td className="p-3 text-xs font-mono text-muted-foreground">{l.journal_id?.substring(0, 8)}</td>
                    </tr>
                  ))}
                  {ledger.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground italic">Shadow ledger is empty.</td></tr>
                  )}
                </tbody>
              </table>
            </DataTableShell>
          </TabsContent>

          <TabsContent value="profiles" className="pt-4">
            <div className="grid gap-4 md:grid-cols-2">
              {(Array.isArray(profiles) ? profiles : []).map((p) => (
                <div key={p.id} className="border rounded-xl p-4 flex items-start justify-between hover:border-primary/30 transition-all cursor-pointer bg-card shadow-sm">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-primary">{p.name}</h4>
                      {p.is_active && <Badge className="bg-success hover:bg-success text-[10px] h-4 px-1">ACTIVE</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{p.description || "No description provided."}</p>
                    <div className="mt-3 flex items-center gap-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      <span>REV: {p.revenue_share_pct}%</span>
                      <span>PROFIT: {p.profit_share_pct}%</span>
                    </div>
                  </div>
                  <Button variant="outline" size="icon" className="rounded-full h-8 w-8">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </WorkspacePanel>
    </div>
  );
}
