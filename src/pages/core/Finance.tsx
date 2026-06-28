import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import {
  FileText,
  Receipt,
  ShieldCheck,
  Wallet,
  TrendingUp,
  ShoppingBag,
  ArrowUpRight,
  Activity,
  DollarSign,
  Plus,
  BarChart3,
  Download
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSession } from "@/core/security/session";
import { financeService } from "@/core/services";
import { reportingService } from "@/core/services/reportingService";
import { useToast } from "@/hooks/use-toast";
import DepartmentWorkspaceLayout from "@/components/layouts/DepartmentWorkspaceLayout";

const SECTIONS = [
  {
    title: "TREASURY",
    items: [
      { id: 'finance', icon: DollarSign, label: "Overview", to: "/core/finance" },
      { id: 'billing', icon: Receipt, label: "Billing", to: "/core/finance/billing" },
    ]
  },
  {
    title: "COMPLIANCE",
    items: [
      { id: 'taxes', icon: ShieldCheck, label: "Tax Reports", to: "/core/finance/taxes" },
      { id: 'audit', icon: BarChart3, label: "Audit Readiness", to: "/core/finance/audit" },
    ]
  }
];

const statusTone = (status: string) => {
  if (status === "Complete" || status === "Ready") {
    return "bg-success text-success border-success/20";
  }
  if (status === "Attention" || status === "Overdue") {
    return "bg-destructive text-destructive border-destructive/20";
  }
  return "bg-muted text-muted-foreground border-border/20";
};

interface FinanceMetric {
  id: string;
  label: string;
  value: string | number;
  delta?: string;
}

interface BillingItem {
  id: string;
  title: string;
  due: string;
  amount: string | number;
  status: string;
}

interface TaxReport {
  id: string;
  title: string;
  due: string;
  status: string;
}

interface AuditItem {
  id: string;
  label: string;
  note: string;
  status: string;
}

interface RetailContribution {
  weeklyRevenue: string | number;
  ordersToday: number;
  avgBasketValue: string | number;
  topCategory: string;
}

export default function CoreFinance() {
  const session = useSession();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    financialSummary: FinanceMetric[];
    billingQueue: BillingItem[];
    taxReports: TaxReport[];
    auditReadiness: AuditItem[];
    moduleContributions?: {
      retail?: RetailContribution;
    };
  } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await financeService.getFinanceOverview(
          session.tenant_id,
          session,
        );
        setData(res);
      } catch (e) {
        console.error("Failed to load finance overview", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [session]);

  if (loading || !data) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-success border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground italic">Accessing Treasury Mainframe...</p>
        </div>
      </div>
    );
  }

  const {
    financialSummary,
    billingQueue,
    taxReports,
    auditReadiness,
    moduleContributions,
  } = data;
  const retailStats = moduleContributions?.retail;

  const handleDownloadTaxPackage = async () => {
    try {
      toast({ title: "Tax Package", description: "Generating full compliance documentation..." });
      await reportingService.generateReport(session, { report_type: 'TAX_COMPLIANCE', format: 'PDF' });
      toast({ title: "Generation Queued", description: "Check the Reports page for status." });
    } catch (err) {
      toast({ title: "Error", description: "Reporting engine unavailable.", variant: "destructive" });
    }
  };

  const mainContent = (
    <div className="space-y-6 p-6">
      <WorkspacePanel
        title="Consolidated statement"
        description="High-level metrics across all business units."
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {(Array.isArray(financialSummary) ? financialSummary : []).map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border bg-card dark:bg-muted p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between text-muted-foreground mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{item.label}</span>
                <Wallet className="h-4 w-4 text-primary" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black italic tracking-tighter uppercase text-muted-foreground dark:text-white">
                  {item.value}
                </span>
              </div>
              {item.delta && (
                <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-success">
                  <ArrowUpRight className="h-3 w-3" /> {item.delta}
                </div>
              )}
            </div>
          ))}
        </div>
      </WorkspacePanel>

      {/* --- MODULE CONTRIBUTIONS --- */}
      {retailStats && (
        <WorkspacePanel
          title="Module Contributions: Retail Operations"
          description="Live revenue and performance metrics pulled dynamically from the active Retail module."
        >
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-primary bg-primary p-6">
              <div className="flex items-center justify-between text-primary mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Weekly Retail Revenue
                </span>
                <TrendingUp className="h-4 w-4" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black italic tracking-tighter uppercase text-primary dark:text-primary">
                  {retailStats.weeklyRevenue}
                </span>
              </div>
              <div className="mt-2 text-[10px] font-bold text-primary flex items-center gap-1 uppercase tracking-widest">
                Retail orders this week
              </div>
            </div>

            <div className="rounded-2xl border p-6 bg-card dark:bg-muted shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Orders Today</span>
                <ShoppingBag className="h-4 w-4" />
              </div>
              <p className="text-2xl font-black italic text-muted-foreground dark:text-white uppercase">
                {retailStats.ordersToday}
              </p>
              <p className="mt-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Across all branches
              </p>
            </div>

            <div className="rounded-2xl border p-6 bg-card dark:bg-muted shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Avg Basket</span>
                <Receipt className="h-4 w-4" />
              </div>
              <p className="text-2xl font-black italic text-muted-foreground dark:text-white uppercase">
                {retailStats.avgBasketValue}
              </p>
              <p className="mt-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Rolling Average
              </p>
            </div>

            <div className="rounded-2xl border p-6 bg-card dark:bg-muted shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Top Category</span>
                <TrendingUp className="h-4 w-4" />
              </div>
              <p className="text-xl font-black italic text-muted-foreground dark:text-white uppercase truncate">
                {retailStats.topCategory}
              </p>
              <p className="mt-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Highest Grossing
              </p>
            </div>
          </div>
        </WorkspacePanel>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <WorkspacePanel
          title="Billing queue"
          description="Pending receivables and payables requiring action."
        >
          <div className="space-y-4 pt-2">
            {(Array.isArray(billingQueue) ? billingQueue : []).map((item) => (
              <div key={item.id} className="rounded-2xl border p-5 bg-card dark:bg-muted shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground dark:text-white mb-1">
                      {item.title}
                    </p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">
                      DUE: {item.due}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black italic text-muted-foreground dark:text-white uppercase">{item.amount}</p>
                    <Badge
                      variant="outline"
                      className={`mt-2 rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-widest border-none ${statusTone(item.status)}`}
                    >
                      {item.status}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
            <Button onClick={() => toast({ title: "Full Queue", description: "Redirecting to detailed billing ledger..." })} variant="outline" className="w-full rounded-xl h-11 font-black text-[10px] uppercase tracking-widest border-border">
              View full ledger
            </Button>
          </div>
        </WorkspacePanel>

        <WorkspacePanel
          title="Tax reporting"
          description="Compliance submissions and filing deadlines."
        >
          <div className="space-y-4 pt-2">
            {(Array.isArray(taxReports) ? taxReports : []).map((report) => (
              <div key={report.id} className="rounded-2xl border p-5 bg-card dark:bg-muted shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground dark:text-white mb-1">
                      {report.title}
                    </p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">
                      DEADLINE: {report.due}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-widest border-none ${statusTone(report.status)}`}
                  >
                    {report.status}
                  </Badge>
                </div>
                <div className="mt-4 flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest cursor-pointer hover:opacity-70 transition-opacity">
                  <FileText className="h-3.5 w-3.5" />
                  View Filing Summary
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-2xl border border-dashed p-6 bg-success border-success/20">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-success" />
                <span className="text-[11px] font-bold text-success uppercase tracking-widest">Tax documentation package ready</span>
              </div>
              <Button onClick={handleDownloadTaxPackage} size="sm" variant="outline" className="rounded-xl h-9 px-6 font-black text-[10px] uppercase tracking-widest border-success text-success">
                Download
              </Button>
            </div>
          </div>
        </WorkspacePanel>
      </div>

      <WorkspacePanel
        title="Audit readiness"
        description="Evidence and controls for upcoming audits."
      >
        <div className="grid gap-4 md:grid-cols-3 pt-2">
          {(Array.isArray(auditReadiness) ? auditReadiness : []).map((item) => (
            <div key={item.id} className="rounded-2xl border p-5 bg-card dark:bg-muted shadow-sm border-border">
              <div className="flex items-start justify-between gap-3 mb-3">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground dark:text-white">
                  {item.label}
                </p>
                <Badge variant="outline" className={`rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-widest border-none ${statusTone(item.status)}`}>
                  {item.status}
                </Badge>
              </div>
              <p className="text-[10px] font-medium text-muted-foreground leading-relaxed italic">"{item.note}"</p>
            </div>
          ))}
        </div>
      </WorkspacePanel>
    </div>
  );

  return (
    <DepartmentWorkspaceLayout
      title="Finance & Treasury"
      subtitle="Consolidated view of tenant financial health and compliance."
      headerIcon={DollarSign}
      accentColor="emerald"
      engineName="FINANCIAL_ENGINE"
      pulseLabel="Finance Pulse"
      pulseIcon={Activity}
      sections={SECTIONS}
      routeLabels={{}}
      basePath="/core/finance"
      headerActions={
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="rounded-xl h-10 px-6 font-black text-[10px] uppercase tracking-widest border-border text-white hover:bg-muted"
            onClick={() => toast({ title: "Export", description: "Preparing consolidated financial export..." })}
          >
            Export report
          </Button>
          <Button 
            onClick={() => toast({ title: "New Invoice", description: "Opening invoice creation studio..." })}
            className="rounded-xl h-10 px-6 font-black text-[10px] uppercase tracking-widest bg-success hover:bg-success shadow-xl shadow-emerald-500/20"
          >
            <Plus className="h-3 w-3 mr-2" /> New invoice
          </Button>
        </div>
      }
    >
      {mainContent}
    </DepartmentWorkspaceLayout>
  );
}
