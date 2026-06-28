import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  FileText, 
  ShieldCheck, 
  Gavel, 
  Calendar, 
  Search, 
  Download, 
  Scale, 
  History, 
  AlertTriangle,
  ClipboardCheck,
  Building,
  Globe,
  HelpCircle,
  Sticker,
  CheckCircle2,
  Clock,
  ArrowRight
} from "lucide-react";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/core/security/session";
import { formatCurrency } from "@/lib/format";

export default function TaxCompliance() {
  const session = useSession();
  const [activeTab, setActiveTab] = useState("calendar");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tax & Compliance Center"
        subtitle="Manage mult-jurisdictional tax obligations, VAT returns, and audit readiness across all business units."
        primaryAction={
          <Button 
            onClick={() => alert("Generating Cryptographic Tax Compliance Certificate for active period.")}
            className="gap-2 bg-muted border-none hover:bg-muted text-white"
          >
            <Download className="w-4 h-4" /> Download Certificate
          </Button>
        }
        secondaryActions={
          <div className="flex bg-muted p-1 rounded-xl border border-border">
            <Button onClick={() => alert("Switching to Domestic Tax Ledger")} variant="ghost" size="sm" className="bg-card shadow-sm font-bold text-[10px] uppercase tracking-wider">Domestic</Button>
            <Button onClick={() => alert("Switching to International Cross-Border Ledger")} variant="ghost" size="sm" className="text-muted-foreground font-bold text-[10px] uppercase tracking-wider">International</Button>
          </div>
        }
      />

      <div className="grid gap-6 md:grid-cols-4">
        <ComplianceSummaryCard 
          label="VAT Liability (IDR)" 
          value={125400000} 
          status="PENDING" 
          dueDate="May 20, 2026" 
          icon={Sticker}
        />
        <ComplianceSummaryCard 
          label="Corporate Income Tax" 
          value={450000000} 
          status="ESTIMATED" 
          dueDate="Jul 15, 2026" 
          icon={Building}
        />
        <ComplianceSummaryCard 
          label="Withholding Tax" 
          value={12800000} 
          status="AUTO_SYNCED" 
          dueDate="Monthly" 
          icon={ClipboardCheck}
        />
        <ComplianceSummaryCard 
          label="Compliance Score" 
          value="98.4%" 
          status="EXCELLENT" 
          trend="+2.1%" 
          icon={ShieldCheck}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <WorkspacePanel 
            title="Tax Reporting Calendar" 
            description="Timeline of upcoming statutory filings and payments."
          >
            <div className="space-y-4 pt-2">
              <CalendarEventRow 
                date="May 20" 
                title="VAT (PPN) Return - Period April 2026" 
                detail="Finalization of input/output tax netting." 
                status="UPCOMING" 
              />
              <CalendarEventRow 
                date="Jun 10" 
                title="Withholding Tax (PPh 21/23/26)" 
                detail="Employee and vendor withholding report." 
                status="AUTOMATED" 
              />
              <CalendarEventRow 
                date="Jun 15" 
                title="PPh 25 Monthly Installment" 
                detail="Estimated corporate tax payment." 
                status="PENDING" 
              />
            </div>
          </WorkspacePanel>

          <WorkspacePanel title="Audit Readiness Evidence" description="Archive of documents verified for institutional review.">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="vault">Evidence Vault</TabsTrigger>
                <TabsTrigger value="certificates">Certificates</TabsTrigger>
                <TabsTrigger value="history">Filing History</TabsTrigger>
              </TabsList>
              
              <TabsContent value="vault" className="grid gap-4 sm:grid-cols-2 mt-4">
                <EvidenceCard title="Purchase Invoices (Verified)" count={1240} size="450MB" date="Updated 2h ago" />
                <EvidenceCard title="Sales Records (GDS Sync)" count={8500} size="1.2GB" date="Updated 4h ago" />
                <EvidenceCard title="Bank Statement Reconciles" count={12} size="15MB" date="Updated 1d ago" />
                <EvidenceCard title="Payroll Tax Journals" count={4} size="8MB" date="Updated 1w ago" />
              </TabsContent>
            </Tabs>
          </WorkspacePanel>
        </div>

        <div className="space-y-6">
          <WorkspacePanel title="Risk Monitoring" description="AI-driven compliance anomaly detection.">
            <div className="space-y-4">
              <div className="flex gap-4 p-4 rounded-2xl bg-warning border border-warning/30">
                <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-warning">VAT Discrepancy</p>
                  <p className="text-xs text-warning font-bold leading-relaxed mt-1">
                    Detected Rp 1.5Mn gap in vendor output tax verification for SUMMIT LTD.
                  </p>
                  <Button disabled title="Not available yet" variant="link" className="p-0 h-auto text-[10px] font-black uppercase text-warning mt-2">Check Invoice</Button>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-muted text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-4 h-4 text-primary" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Regulatory Update</p>
                </div>
                <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                  The <span className="text-white font-bold italic">Law No. 7/2021 Update</span> regarding carbon tax targets will affect Logistics OpEx starting July.
                </p>
                <Button 
                  onClick={() => alert("Analyzing financial exposure to Law No. 7/2021 Update...")}
                  className="w-full h-8 bg-primary hover:bg-primary text-white font-black uppercase tracking-[0.2em] text-[8px] mt-4"
                >
                  Analyze Exposure
                </Button>
              </div>
            </div>
          </WorkspacePanel>

          <WorkspacePanel title="Help Center" description="Direct line to compliance specialists.">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl border hover:bg-muted cursor-pointer transition-colors group">
                <div className="flex items-center gap-3">
                  <HelpCircle className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                  <p className="text-xs font-bold text-muted-foreground group-hover:text-muted-foreground">VAT Filing Guide</p>
                </div>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl border hover:bg-muted cursor-pointer transition-colors group">
                <div className="flex items-center gap-3">
                  <Gavel className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                  <p className="text-xs font-bold text-muted-foreground group-hover:text-muted-foreground">Regulation Database</p>
                </div>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl border hover:bg-muted cursor-pointer transition-colors group">
                <div className="flex items-center gap-3">
                  <Scale className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                  <p className="text-xs font-bold text-muted-foreground group-hover:text-muted-foreground">Legal Opinions</p>
                </div>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
              </div>
            </div>
          </WorkspacePanel>
        </div>
      </div>
    </div>
  );
}

function ComplianceSummaryCard({ label, value, status, dueDate, trend, icon: Icon }: any) {
  return (
    <div className="bg-card p-5 rounded-3xl border border-border shadow-sm hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2.5 rounded-2xl bg-muted border border-border h-fit">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
        <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-primary text-primary bg-primary">
          {status}
        </Badge>
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
      <p className="text-xl font-black text-muted-foreground tracking-tight">
        {typeof value === "number" ? formatCurrency(value, "IDR", "id-ID") : value}
      </p>
      {dueDate && (
        <div className="flex items-center gap-1.5 mt-3">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{dueDate}</p>
        </div>
      )}
      {trend && (
        <p className="text-[10px] font-black text-success uppercase tracking-widest mt-2">{trend} Improvement</p>
      )}
    </div>
  );
}

function CalendarEventRow({ date, title, detail, status }: any) {
  return (
    <div className="flex gap-4 p-4 rounded-2xl hover:bg-muted transition-colors group border-b last:border-0 border-border">
      <div className="flex flex-col items-center justify-center h-12 w-12 bg-card rounded-xl border border-border shadow-sm group-hover:border-primary transition-colors shrink-0">
        <p className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">{date.split(" ")[0]}</p>
        <p className="text-sm font-black text-muted-foreground">{date.split(" ")[1]}</p>
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-start">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-tight italic">{title}</p>
          <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest px-2 h-5">
            {status}
          </Badge>
        </div>
        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">{detail}</p>
      </div>
    </div>
  );
}

function EvidenceCard({ title, count, size, date }: any) {
  return (
    <div className="p-4 rounded-2xl border border-border bg-muted hover:bg-muted hover:shadow-lg hover:border-primary transition-all group">
      <div className="flex items-center justify-between mb-3">
        <FileText className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        <Button disabled title="Not available yet" variant="ghost" size="icon" className="h-6 w-6 rounded-lg">
          <Download className="w-3 h-3" />
        </Button>
      </div>
      <p className="text-xs font-black text-muted-foreground uppercase tracking-tight mb-1">{title}</p>
      <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
        <p>{count} Files</p>
        <p>{size}</p>
      </div>
      <p className="text-[9px] text-muted-foreground mt-2 italic">{date}</p>
    </div>
  );
}
