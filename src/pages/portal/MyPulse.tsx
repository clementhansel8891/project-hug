import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  User, 
  Clock, 
  Calendar, 
  Wallet, 
  ShieldCheck, 
  MapPin, 
  Play, 
  Square,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Info,
  History,
  FileText,
  Download,
  Briefcase,
  Coins,
  CreditCard,
  Target,
  DollarSign,
  Receipt,
  HandCoins,
  FileCheck,
  Activity,
  Loader2
} from 'lucide-react';
import { useSession } from '@/core/security/session';
import { useApp } from '@/contexts/AppContext';
import { attendanceService } from '@/core/services/hr/attendanceService';
import { leaveService } from '@/core/services/hr/leaveService';
import { peopleService } from '@/core/services/hr/peopleService';
import { loanService } from '@/core/services/finance/loanService';
import { payrollService } from '@/core/services/hr/payrollService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { formatCurrency, formatNumber, formatDateTime, safeText } from '@/lib/format';
import { QueryBoundary } from '@/components/shared/QueryBoundary';
import { ErrorState } from '@/components/shared/AsyncState';
import { GlassCard } from '@/components/shared/GlassCard';
import { cn } from '@/lib/utils';

export default function MyPulse({ noShell = false }: { noShell?: boolean }) {
  const session = useSession();
  const { state } = useApp();
  const [activeTab, setActiveTab] = useState('overview');
  const [record, setRecord] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  
  // Attendance State
  const [isClockingIn, setIsClockingIn] = useState(false);
  const [clockInReason, setClockInReason] = useState('');
  const [isLocationMismatch, setIsLocationMismatch] = useState(false);
  const [isSubmittingClockIn, setIsSubmittingClockIn] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{lat: number, lng: number} | null>(null);

  // Loan State
  const [isLoanOpen, setIsLoanOpen] = useState(false);
  const [loanAmount, setLoanAmount] = useState('');
  const [loanInstallments, setLoanInstallments] = useState('12');
  const [loanReason, setLoanReason] = useState('');
  const [myLoans, setMyLoans] = useState<any[]>([]);
  const [isSubmittingLoan, setIsSubmittingLoan] = useState(false);

  // Compliance State
  const [isComplianceOpen, setIsComplianceOpen] = useState(false);

  // Performance State
  const [perfSnapshot, setPerfSnapshot] = useState<any>(null);

  const [docs, setDocs] = useState<any[]>([
    { id: 'p1', title: 'Payslip - March 2026', type: 'PAYSLIP', date: '2026-03-28' },
    { id: 'p2', title: 'Payslip - February 2026', type: 'PAYSLIP', date: '2026-02-28' },
    { id: 'c1', title: 'Employment Contract - v2', type: 'CONTRACT', date: '2025-01-10' },
    { id: 'd1', title: 'Code of Conduct', type: 'POLICY', date: '2026-01-01' },
  ]);

  const currencyData = useMemo(() => {
    const currency = record?.employee?.currency || 'USD';
    const symbolMap: Record<string, string> = {
      'USD': '$',
      'IDR': 'Rp',
      'EUR': '€',
      'GBP': '£'
    };
    return {
      code: currency,
      symbol: symbolMap[currency] || currency,
      icon: currency === 'IDR' ? Coins : DollarSign
    };
  }, [record]);

  const formatWithCurrency = (amount: number | null | undefined) => {
    return formatCurrency(amount, currencyData.code);
  };

  const loadData = useCallback(() => {
    setIsLoading(true);
    setIsError(false);
    Promise.all([
      peopleService.getEmployee360(session.tenant_id, session.user_id, session),
      loanService.getMyLoans(session.tenant_id, session),
      payrollService.getPerformanceSnapshot(session.tenant_id, session, session.user_id)
    ]).then(([pRecord, loans, snapshot]) => {
      setRecord(pRecord);
      setMyLoans(loans || []);
      setPerfSnapshot(snapshot);
    }).catch((err) => {
      console.error('[MyPulse] Portal sync failure:', err);
      setIsError(true);
      toast({
        title: "Portal Sync Error",
        description: "Unable to refresh your profile telemetry.",
        variant: "destructive"
      });
    }).finally(() => {
      setIsLoading(false);
    });
  }, [session]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleClockIn = async () => {
    if (!navigator.geolocation) {
      toast({
        title: "Telemetry Required",
        description: "GPS access is mandatory for attendance verification.",
        variant: "destructive"
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCurrentCoords(coords);

      // Verify location against policy (Stubbed for now, but wired)
      const isValidLocation = await attendanceService.validateAccess(
        session.tenant_id,
        record?.employee?.locationId || 'HQ',
        'MY_PULSE_PORTAL',
        coords
      );

      if (!isValidLocation && !clockInReason) {
        setIsLocationMismatch(true);
        setIsClockingIn(true);
        return;
      }

      try {
        setIsSubmittingClockIn(true);
        await attendanceService.clockIn(session.tenant_id, session, {
          locationId: record?.employee?.locationId || 'HQ',
          deviceId: 'MY_PULSE_WEB',
          coordinates: coords,
          verificationMethod: 'gps',
          reason: clockInReason
        });

        toast({
          title: "Attendance Registered",
          description: "Your check-in has been synchronized with the roster.",
        });
        
        setIsClockingIn(false);
        setClockInReason('');
        setIsLocationMismatch(false);
        loadData();
      } catch (err) {
        toast({
          title: "Clock-In Failed",
          description: "The attendance service is currently unreachable.",
          variant: "destructive"
        });
      } finally {
        setIsSubmittingClockIn(false);
      }
    });
  };

  const handleRequestLoan = async () => {
    try {
      setIsSubmittingLoan(true);
      await loanService.requestLoan(session.tenant_id, session, {
        amount: Number(loanAmount),
        installments: Number(loanInstallments),
        reason: loanReason
      });
      toast({ title: "Loan Request Indexed", description: "Your request has been sent to HOD FlowGate." });
      setIsLoanOpen(false);
      setLoanAmount('');
      setLoanReason('');
      loadData();
    } catch (err) {
      toast({ title: "Request Failed", description: "Your loan request could not be submitted. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmittingLoan(false);
    }
  };

  const activeLoan = useMemo(() => myLoans.find(l => l.status === 'approved' || l.status === 'disbursed'), [myLoans]);

  const isRetailOrSales = useMemo(() => {
    const role = record?.employee?.roleTitle?.toLowerCase() || '';
    return role.includes('cashier') || role.includes('sales') || role.includes('store manager');
  }, [record]);

  const portalLoader = (
    <div className="min-h-[60vh] bg-muted flex flex-col items-center justify-center gap-6">
      <div className="w-24 h-24 rounded-[2rem] bg-primary border border-primary flex items-center justify-center animate-pulse shadow-[0_0_50px_-12px_hsl(var(--primary)/0.5)]">
        <Activity className="w-10 h-10 text-primary" />
      </div>
      <div className="text-center space-y-2">
        <p className="text-lg font-black italic uppercase tracking-[0.3em] text-white animate-pulse">Synchronizing Portal</p>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Establishing Secure Telemetry Node...</p>
      </div>
    </div>
  );

  const portalError = (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <ErrorState
        title="Portal telemetry unavailable"
        description="We couldn't load your portal data. Check your connection and try again."
        onRetry={loadData}
      />
    </div>
  );

  const content = (
    <div className={cn("space-y-12", !noShell && "max-w-[1600px] mx-auto pb-20")}>
      {!noShell && (
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 pt-8 pb-12 border-b border-border relative">
          <div className="space-y-6 relative z-10">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-primary rounded-[2rem] flex items-center justify-center shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)] border border-border">
                <User className="w-10 h-10 text-white" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" /> OPERATIONAL_GATEWAY
                </p>
                <h1 className="text-6xl font-black text-white tracking-tighter uppercase italic leading-none">{safeText(record?.employee?.fullName)}</h1>
                <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.3em] flex items-center gap-3 mt-4">
                   <Briefcase className="w-3.5 h-3.5 text-primary" /> {safeText(record?.employee?.roleTitle)} <span className="text-muted-foreground">/</span> {safeText(record?.employee?.departmentId)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 relative z-10">
             <div className="flex flex-col items-end gap-2 pr-4 border-r border-border mr-2">
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Roster Status</p>
                <Badge variant="outline" className="h-8 px-4 rounded-xl border-primary bg-primary font-black text-primary uppercase tracking-widest gap-2">
                   <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> ACTIVE_SESSION
                </Badge>
             </div>
             <Button 
                className="h-16 px-10 rounded-[1.8rem] font-black italic tracking-[0.15em] uppercase text-xs bg-primary hover:bg-primary shadow-[0_0_30px_-5px_rgba(79,70,229,0.4)] border border-border gap-3 group transition-all hover:scale-[1.02] active:scale-[0.98]"
                onClick={() => setIsClockingIn(true)}
             >
                <Play className="w-5 h-5 fill-current" /> Clock In
             </Button>
             <Button 
                variant="outline"
                className="h-16 px-8 rounded-[1.8rem] font-black italic tracking-[0.15em] uppercase text-[10px] border-border bg-muted hover:bg-white/10 text-white gap-3 shadow-xl transition-all"
                onClick={() => setIsLoanOpen(true)}
             >
                <currencyData.icon className="w-4 h-4 text-primary" /> Loan Request
             </Button>
          </div>
          
          {/* Subtle atmospheric background glow */}
          <div className="absolute -top-20 -left-20 w-96 h-96 bg-primary blur-[120px] pointer-events-none rounded-full" />
        </div>
      )}

      {/* Tabbed Experience */}
      <Tabs defaultValue="overview" className="space-y-12">
        <TabsList className="bg-transparent border-b border-border w-full justify-start h-auto p-0 gap-10 rounded-none overflow-x-auto no-scrollbar">
          {['overview', 'attendance', 'payroll', 'leave', 'performance'].map((tab) => (
            <TabsTrigger 
              key={tab}
              value={tab} 
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-4 data-[state=active]:border-primary data-[state=active]:text-white rounded-none h-14 px-2 font-black uppercase italic tracking-[0.25em] text-[11px] text-muted-foreground hover:text-muted-foreground transition-all border-b-4 border-transparent"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Duty Card */}
              <Card className="rounded-[2.5rem] border-white/5 bg-muted backdrop-blur-3xl shadow-2xl overflow-hidden border border-border group hover:border-border transition-all">
                 <CardHeader className="bg-muted border-b border-border p-8">
                    <div className="flex items-center justify-between">
                       <CardTitle className="text-xl font-black italic uppercase tracking-[0.2em] text-white">Today's Duty</CardTitle>
                       <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center border border-primary">
                        <Clock className="w-5 h-5 text-primary" />
                       </div>
                    </div>
                 </CardHeader>
                 <CardContent className="p-8 space-y-6">
                    <div className="space-y-2">
                       <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Shift Window</p>
                       <p className="text-4xl font-black text-white italic tracking-tighter">09:00 - 18:00</p>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground bg-muted p-4 rounded-2xl border border-border">
                       <MapPin className="w-4 h-4 text-primary" />
                       <span className="text-xs font-black uppercase tracking-widest">{record?.employee?.locationId || 'HQ_ZONE_A'}</span>
                    </div>
                    <div className="pt-6 border-t border-border flex items-center justify-between">
                       <Badge className="bg-primary text-primary border-primary font-black text-[9px] uppercase tracking-widest px-3 h-6">Normal Operation</Badge>
                       <span className="text-[10px] font-black text-primary uppercase tracking-widest cursor-pointer hover:text-primary transition-colors">View Schedule</span>
                    </div>
                 </CardContent>
              </Card>

              {/* Wallet Preview */}
              <Card className="rounded-[2.5rem] border-white/5 bg-muted backdrop-blur-3xl shadow-2xl overflow-hidden border border-border group hover:border-border transition-all">
                 <CardHeader className="p-8 bg-muted border-b border-border">
                    <div className="flex items-center justify-between">
                       <CardTitle className="text-xl font-black italic uppercase tracking-[0.2em] text-white">Payroll Track</CardTitle>
                       <div className="w-10 h-10 rounded-xl bg-success flex items-center justify-center border border-success/20">
                        <Wallet className="w-5 h-5 text-success" />
                       </div>
                    </div>
                 </CardHeader>
                 <CardContent className="p-8 space-y-8">
                    <div className="space-y-2">
                       <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Next Net Payout (Est.)</p>
                       <p className="text-5xl font-black text-white italic tracking-tighter">
                         {formatWithCurrency(
                           (record?.employee?.baseSalary ?? 0) + 
                           (perfSnapshot?.accruedBonus ?? 0) - 
                           (perfSnapshot?.estimatedTax ?? 0) - 
                           (activeLoan?.monthlyInstallment ?? 0)
                         )}
                       </p>
                    </div>
                    
                    <div className="space-y-4">
                       {isRetailOrSales && (
                         <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-muted rounded-2xl border border-border">
                               <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-2">Items Sold</p>
                               <p className="text-2xl font-black text-white">{formatNumber(perfSnapshot?.itemsSold, { maximumFractionDigits: 0 })}</p>
                            </div>
                            <div className="p-4 bg-success rounded-2xl border border-success/10">
                               <p className="text-[9px] font-black text-success uppercase tracking-widest mb-2">Bonus</p>
                               <p className="text-2xl font-black text-success">+{formatWithCurrency(perfSnapshot?.accruedBonus)}</p>
                            </div>
                         </div>
                       )}

                       <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between p-4 bg-muted rounded-2xl border border-border">
                             <div className="flex items-center gap-3 text-muted-foreground">
                                <AlertCircle className="w-4 h-4 text-muted-foreground" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Est. Tax & Social</span>
                             </div>
                             <span className="text-xs font-black text-muted-foreground">-{formatWithCurrency(perfSnapshot?.estimatedTax)}</span>
                          </div>

                          {activeLoan && (
                            <div className="flex items-center justify-between p-4 bg-warning rounded-2xl border border-warning/10">
                               <div className="flex items-center gap-3 text-warning">
                                  <Receipt className="w-4 h-4" />
                                  <span className="text-[10px] font-black uppercase tracking-widest">Loan Installment</span>
                               </div>
                               <span className="text-xs font-black text-warning">-{formatWithCurrency(activeLoan.monthlyInstallment)}</span>
                            </div>
                          )}
                       </div>

                       <div className="space-y-3 pt-4 border-t border-border">
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                             <span className="text-muted-foreground">Cycle Progress</span>
                             <span className="text-white">75%</span>
                          </div>
                          <Progress value={75} className="h-2 bg-muted" />
                       </div>
                    </div>
                 </CardContent>
              </Card>

              {/* Compliance Signal */}
              <Card className="rounded-[2.5rem] border-primary bg-primary backdrop-blur-3xl shadow-2xl overflow-hidden border group transition-all hover:bg-primary relative">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-primary blur-[80px] pointer-events-none rounded-full" />
                 <CardHeader className="p-8 bg-muted border-b border-border">
                    <div className="flex items-center justify-between">
                       <CardTitle className="text-xl font-black italic uppercase tracking-[0.2em] text-white">Compliance</CardTitle>
                       <ShieldCheck className="w-5 h-5 text-primary" />
                    </div>
                 </CardHeader>
                 <CardContent className="p-8 space-y-8 relative z-10">
                    <div className="flex items-center gap-5">
                       <div className="w-16 h-16 bg-white/10 rounded-[1.5rem] flex items-center justify-center border border-border shadow-xl">
                          <CheckCircle2 className="w-8 h-8 text-white" />
                       </div>
                       <div>
                          <p className="text-lg font-black uppercase tracking-widest text-white leading-tight">All Records Sync</p>
                          <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em] mt-1">Last audit: 2h ago</p>
                       </div>
                    </div>
                    <Button 
                        variant="outline" 
                        className="w-full bg-white text-muted-foreground border-white hover:bg-muted font-black italic uppercase tracking-widest text-[10px] rounded-2xl h-14 mt-4 shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] transition-all hover:scale-[1.02]"
                        onClick={() => setIsComplianceOpen(true)}
                     >
                        View Audit Passport
                     </Button>
                 </CardContent>
              </Card>
           </div>

           {/* Recent Activity Mini-Feed */}
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <Card className="rounded-[2.5rem] border-white/5 bg-muted backdrop-blur-3xl shadow-2xl overflow-hidden border border-border">
                 <CardHeader className="p-8 border-b border-border flex flex-row items-center justify-between bg-muted">
                    <div className="space-y-1">
                       <CardTitle className="text-lg font-black italic uppercase tracking-[0.2em] text-white">Attendance Ledger</CardTitle>
                       <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Last 5 verification nodes</p>
                    </div>
                    <History className="w-5 h-5 text-muted-foreground" />
                 </CardHeader>
                 <CardContent className="p-0">
                    {(record?.attendance || []).slice(0, 5).map((entry: any, i: number) => (
                      <div key={entry.id} className={cn("p-6 flex items-center justify-between group cursor-pointer hover:bg-muted transition-colors", i !== 4 && "border-b border-border")}>
                         <div className="flex items-center gap-4">
                            <div className={cn("w-2.5 h-2.5 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]", entry.status === 'on_time' ? 'bg-success shadow-success/40' : 'bg-warning shadow-warning/40')} />
                            <div>
                               <p className="text-sm font-black text-white uppercase tracking-tighter italic">{entry.date}</p>
                               <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.2em] mt-0.5">{entry.status}</p>
                            </div>
                         </div>
                         <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-white group-hover:translate-x-1 transition-all" />
                      </div>
                    ))}
                    <div className="p-6 bg-white/2 text-center border-t border-border group">
                       <span className="text-[10px] font-black text-primary uppercase tracking-widest cursor-pointer group-hover:text-primary transition-colors" onClick={() => setActiveTab('attendance')}>Access Full Attendance Telemetry</span>
                    </div>
                 </CardContent>
              </Card>

              <Card className="rounded-[2.5rem] border-white/5 bg-muted backdrop-blur-3xl shadow-2xl overflow-hidden border border-border">
                 <CardHeader className="p-8 border-b border-border flex flex-row items-center justify-between bg-muted">
                    <div className="space-y-1">
                       <CardTitle className="text-lg font-black italic uppercase tracking-[0.2em] text-white">Document Vault</CardTitle>
                       <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Secured Asset Discovery</p>
                    </div>
                    <FileText className="w-5 h-5 text-muted-foreground" />
                 </CardHeader>
                 <CardContent className="p-0">
                    {docs.slice(0, 4).map((doc: any, i: number) => (
                      <div key={doc.id} className={cn("p-6 flex items-center justify-between group hover:bg-muted transition-colors", i !== 3 && "border-b border-border")}>
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center text-muted-foreground border border-border group-hover:border-border group-hover:text-white transition-all">
                               {doc.type === 'PAYSLIP' ? <Receipt className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                            </div>
                            <div>
                               <p className="text-sm font-black text-white uppercase tracking-tighter italic">{doc.title}</p>
                               <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.2em] mt-0.5">{doc.date}</p>
                            </div>
                         </div>
                         <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-muted-foreground hover:text-white hover:bg-primary transition-all">
                            <Download className="w-5 h-5" />
                         </Button>
                      </div>
                    ))}
                    <div className="p-10 text-center border-t border-border">
                       <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em] italic">Telemetry Protocol Enabled • AES-256</p>
                    </div>
                 </CardContent>
              </Card>
           </div>
        </TabsContent>

        <TabsContent value="attendance">
           <GlassCard className="border-border shadow-sm">
              <CardHeader>
                 <CardTitle className="text-xl font-black italic uppercase tracking-wider">Attendance Archetype</CardTitle>
                 <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Comprehensive verification history and operational telemetry.</CardDescription>
              </CardHeader>
              <CardContent>
                 <div className="rounded-2xl border border-border overflow-hidden">
                    <table className="w-full text-left">
                       <thead className="bg-muted text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                          <tr>
                             <th className="p-6">Verification Node</th>
                             <th className="p-6">Timestamp</th>
                             <th className="p-6">Status Signal</th>
                             <th className="p-6">Telemetry</th>
                          </tr>
                       </thead>
                       <tbody className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {(record?.attendance || []).map((entry: any) => (
                            <tr key={entry.id} className="border-t border-border hover:bg-muted transition-colors">
                               <td className="p-6 flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full bg-primary" />
                                  {entry.date}
                               </td>
                               <td className="p-6">{formatDateTime(entry.checkIn?.timestamp || entry.timestamp)}</td>
                               <td className="p-6">
                                  <Badge className={cn(
                                     "font-black text-[9px] uppercase tracking-widest",
                                     entry.status === 'on_time' ? 'bg-success text-success' : 'bg-warning text-warning'
                                  )}>
                                     {entry.status}
                                  </Badge>
                               </td>
                               <td className="p-6 text-muted-foreground font-mono text-[10px]">{entry.checkIn?.deviceId || 'MOBILE_CORE'}</td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </CardContent>
           </GlassCard>
        </TabsContent>

        <TabsContent value="payroll">
           <GlassCard className="border-border shadow-sm">
              <CardHeader>
                 <CardTitle className="text-xl font-black italic uppercase tracking-wider">Payroll Consolidation</CardTitle>
                 <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Historical compensation runs and disbursement telemetry.</CardDescription>
              </CardHeader>
              <CardContent>
                 <div className="rounded-2xl border border-border overflow-hidden">
                    <table className="w-full text-left">
                       <thead className="bg-muted text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                          <tr>
                             <th className="p-6">Period Node</th>
                             <th className="p-6">Base Pay</th>
                             <th className="p-6">Bonus Signal</th>
                             <th className="p-6">Net Disbursement</th>
                             <th className="p-6">Action</th>
                          </tr>
                       </thead>
                       <tbody className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {(record?.payrollRuns || []).map((run: any) => (
                            <tr key={run.id} className="border-t border-border hover:bg-muted transition-colors">
                               <td className="p-6 italic font-black text-muted-foreground">{run.period}</td>
                               <td className="p-6">{formatWithCurrency(run.basePay)}</td>
                               <td className="p-6 text-success">+{formatWithCurrency(run.bonuses || 0)}</td>
                               <td className="p-6 font-black">{formatWithCurrency(run.netPay)}</td>
                               <td className="p-6">
                                  <Button variant="ghost" size="sm" className="h-8 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest gap-2">
                                     <Download className="w-3 h-3" /> PDF
                                  </Button>
                               </td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </CardContent>
           </GlassCard>
        </TabsContent>

        <TabsContent value="leave">
           <GlassCard className="border-border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                 <div>
                    <CardTitle className="text-xl font-black italic uppercase tracking-wider">Leave Roster</CardTitle>
                    <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Scheduled absences and balance synchronization.</CardDescription>
                 </div>
                 <Button className="h-10 px-6 rounded-xl font-black italic uppercase tracking-widest text-[9px] bg-muted">Request Time-Off</Button>
              </CardHeader>
              <CardContent>
                 <div className="rounded-2xl border border-border overflow-hidden">
                    <table className="w-full text-left">
                       <thead className="bg-muted text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                          <tr>
                             <th className="p-6">Interval</th>
                             <th className="p-6">Category</th>
                             <th className="p-6">Status</th>
                             <th className="p-6">Reasoning</th>
                          </tr>
                       </thead>
                       <tbody className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {(record?.leaves || []).map((req: any) => (
                            <tr key={req.id} className="border-t border-border hover:bg-muted transition-colors">
                               <td className="p-6">{req.startDate} — {req.endDate}</td>
                               <td className="p-6 italic text-muted-foreground">{req.type}</td>
                               <td className="p-6">
                                  <Badge className={cn(
                                     "font-black text-[9px] uppercase tracking-widest",
                                     req.status === 'approved' ? 'bg-success text-success' : 'bg-muted text-muted-foreground'
                                  )}>
                                     {req.status}
                                  </Badge>
                               </td>
                               <td className="p-6 text-muted-foreground truncate max-w-[200px]">{req.reason || 'N/A'}</td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </CardContent>
           </GlassCard>
        </TabsContent>

        <TabsContent value="performance">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <GlassCard className="border-border shadow-sm col-span-2">
                 <CardHeader>
                    <CardTitle className="text-xl font-black italic uppercase tracking-wider">Operational Efficiency</CardTitle>
                    <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Real-time performance metrics and contribution signal.</CardDescription>
                 </CardHeader>
                 <CardContent className="space-y-8">
                    <div className="grid grid-cols-3 gap-6">
                       <div className="space-y-1">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Sales Throughput</p>
                          <p className="text-2xl font-black text-muted-foreground">{formatNumber(perfSnapshot?.itemsSold, { maximumFractionDigits: 0 })} <span className="text-xs text-muted-foreground">SKUs</span></p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Quality Score</p>
                          <p className="text-2xl font-black text-muted-foreground">98.2%</p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Bonuses Accrued</p>
                          <p className="text-2xl font-black text-success">+{formatWithCurrency(perfSnapshot?.accruedBonus)}</p>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Competency Radar</h4>
                       <div className="grid grid-cols-2 gap-6">
                          {['Customer Focus', 'Inventory Integrity', 'Process Compliance', 'Team Synergy'].map(skill => {
                             const score = perfSnapshot?.competencies?.[skill];
                             const hasScore = typeof score === 'number' && Number.isFinite(score);
                             return (
                                <div key={skill} className="space-y-2">
                                   <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                                      <span className="text-muted-foreground">{skill}</span>
                                      <span className="text-muted-foreground">{hasScore ? `${formatNumber(score, { maximumFractionDigits: 0 })}%` : safeText(score)}</span>
                                   </div>
                                   <Progress value={hasScore ? score : 0} className="h-1.5 bg-muted" />
                                </div>
                             );
                          })}
                       </div>
                    </div>
                 </CardContent>
              </GlassCard>

              <GlassCard className="border-border shadow-sm bg-muted text-white">
                 <CardHeader>
                    <CardTitle className="text-lg font-black italic uppercase tracking-wider text-primary">Target Pulse</CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-6">
                    <div className="p-4 bg-muted rounded-2xl border border-border flex items-center gap-4">
                       <Target className="w-8 h-8 text-primary" />
                       <div>
                          <p className="text-xs font-black uppercase">Quarterly Goal</p>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase">Reach 500 SKU Volume</p>
                       </div>
                    </div>
                    
                    <div className="space-y-2">
                       <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="text-white">28%</span>
                       </div>
                       <Progress value={28} className="h-2 bg-white/10" />
                    </div>

                    <div className="pt-4 border-t border-border">
                       <p className="text-[9px] font-bold text-muted-foreground uppercase italic tracking-widest">Your performance contribution is directly linked to the quarterly dividend pool.</p>
                    </div>
                 </CardContent>
              </GlassCard>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  const portalView = (
    <QueryBoundary
      query={{ isLoading, isError, data: record, refetch: loadData }}
      isEmpty={() => false}
      loading={portalLoader}
      error={portalError}
    >
      {() => content}
    </QueryBoundary>
  );

  if (noShell) return portalView;

  return (
    <div className="min-h-screen bg-muted p-4 md:p-8 selection:bg-primary">
      {portalView}

      {/* Clock In Logic - Verification Sheet */}
      <Dialog open={isClockingIn} onOpenChange={setIsClockingIn}>
        <DialogContent className="max-w-md bg-white border-border p-0 overflow-hidden">
          <DialogHeader className="p-8 bg-muted text-white">
            <div className="flex items-center gap-3 mb-2">
               <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-white" />
               </div>
               <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Attendance Protocol</DialogTitle>
            </div>
            <DialogDescription className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">
               Securing telemetry for verification method: GPS_VERIFIED
            </DialogDescription>
          </DialogHeader>

          <div className="p-8 space-y-6">
            {isLocationMismatch && (
              <div className="p-4 bg-warning border border-warning/30 rounded-2xl flex gap-4">
                 <AlertCircle className="w-6 h-6 text-warning shrink-0" />
                 <div className="space-y-1">
                    <p className="text-xs font-black text-warning uppercase tracking-tight">Geofence Mismatch Detected</p>
                    <p className="text-[10px] text-warning font-bold uppercase tracking-widest leading-relaxed">
                       Your current coordinates do not match the assigned workplace: <strong>{record?.employee?.locationId || 'BRANCH_A'}</strong>. 
                       An audit reason is required for administrative synchronization.
                    </p>
                 </div>
              </div>
            )}

            <div className="space-y-4">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Assigned Duty Location</Label>
                  <div className="h-12 px-4 bg-muted border border-border rounded-xl flex items-center text-sm font-black text-muted-foreground uppercase tracking-tighter italic">
                     {record?.employee?.locationId || 'CENTRAL_HQ_ZONE_A'}
                  </div>
               </div>

               {isLocationMismatch && (
                 <div className="space-y-2 animate-in zoom-in-95 duration-300">
                    <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Reason for Deviation</Label>
                    <Textarea 
                       className="border-border rounded-xl font-bold text-xs" 
                       placeholder="e.g. Field assignment, Offsite maintenance, Hardware sync error..."
                       value={clockInReason}
                       onChange={(e) => setClockInReason(e.target.value)}
                    />
                 </div>
               )}
            </div>

            <div className="pt-4 flex flex-col gap-3">
               <Button 
                  className={cn(
                    "w-full h-14 rounded-2xl font-black italic uppercase tracking-widest transition-all",
                    isLocationMismatch ? "bg-warning hover:bg-warning shadow-warning/20" : "bg-primary hover:bg-primary shadow-primary/20"
                  )}
                  onClick={handleClockIn}
                  disabled={isSubmittingClockIn}
               >
                  {isSubmittingClockIn && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmittingClockIn ? 'Authorizing...' : 'Authorize Check-In'}
               </Button>
               <Button variant="ghost" className="text-[10px] font-black text-muted-foreground uppercase tracking-widest h-10" onClick={() => { setIsClockingIn(false); setIsLocationMismatch(false); }} disabled={isSubmittingClockIn}>
                  Cancel Session
               </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Loan Request Logic - Financial Sheet */}
      <Dialog open={isLoanOpen} onOpenChange={setIsLoanOpen}>
        <DialogContent className="max-w-md bg-white border-border p-0 overflow-hidden">
          <DialogHeader className="p-8 bg-muted text-white">
            <div className="flex items-center gap-3 mb-2">
               <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                  <HandCoins className="w-6 h-6 text-white" />
               </div>
               <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Finance Protocol</DialogTitle>
            </div>
            <DialogDescription className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">
               Initializing loan request via FlowGate verification.
            </DialogDescription>
          </DialogHeader>

          <div className="p-8 space-y-6">
            <div className="space-y-4">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Principal Amount</Label>
                  <div className="relative">
                     {React.createElement(currencyData.icon, { 
                        className: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" 
                     })}
                     <Input 
                        type="number" 
                        className="pl-9 h-12 border-border rounded-xl font-black italic text-lg" 
                        placeholder="0.00"
                        value={loanAmount}
                        onChange={(e) => setLoanAmount(e.target.value)}
                     />
                     <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground uppercase">
                        {currencyData.code}
                     </div>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Installments</Label>
                     <select 
                        className="w-full h-12 px-4 bg-muted border border-border rounded-xl text-xs font-black uppercase"
                        value={loanInstallments}
                        onChange={(e) => setLoanInstallments(e.target.value)}
                     >
                        <option value="6">6 Months</option>
                        <option value="12">12 Months</option>
                        <option value="24">24 Months</option>
                        <option value="36">36 Months</option>
                     </select>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Monthly Est.</Label>
                     <div className="h-12 flex items-center px-4 bg-muted rounded-xl font-black text-xs text-muted-foreground">
                        {formatWithCurrency(Math.round(Number(loanAmount || 0) / Number(loanInstallments)))}
                     </div>
                  </div>
               </div>

               <div className="space-y-2">
                  <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Loan Purpose</Label>
                  <Textarea 
                     className="border-border rounded-xl font-bold text-xs" 
                     placeholder="State the purpose for administrative review..."
                     value={loanReason}
                     onChange={(e) => setLoanReason(e.target.value)}
                  />
               </div>
            </div>

            <div className="p-4 bg-primary rounded-2xl flex gap-3">
               <Info className="w-5 h-5 text-primary shrink-0" />
               <p className="text-[9px] font-bold text-primary uppercase leading-relaxed">
                  Requests are routed to <strong>HOD, Finance, and HR</strong>. 
                  Approvals are irreversible once disbursed. 
                  <strong>Owner Bypass</strong> active for direct verification.
               </p>
            </div>

            <div className="pt-2 flex flex-col gap-3">
               <Button 
                  className="w-full h-14 rounded-2xl font-black italic uppercase tracking-widest bg-primary hover:bg-primary shadow-primary/20"
                  onClick={handleRequestLoan}
                  disabled={!loanAmount || !loanReason || isSubmittingLoan}
               >
                  {isSubmittingLoan && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmittingLoan ? 'Transmitting...' : 'Transmit Request'}
               </Button>
               <Button variant="ghost" className="text-[10px] font-black text-muted-foreground uppercase tracking-widest h-10" onClick={() => setIsLoanOpen(false)} disabled={isSubmittingLoan}>
                  Cancel Session
               </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Compliance Modal */}
      <Dialog open={isComplianceOpen} onOpenChange={setIsComplianceOpen}>
        <DialogContent className="max-w-2xl bg-muted border-border text-white p-0 overflow-hidden rounded-3xl">
          <DialogHeader className="p-8 pb-4">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center">
                  <ShieldCheck className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black italic uppercase tracking-wider text-white">Audit Passport</DialogTitle>
                  <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Operational Integrity & Compliance Telemetry</DialogDescription>
                </div>
            </div>
          </DialogHeader>
          
          <div className="p-8 pt-4 space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted rounded-2xl border border-border space-y-2">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Verification Status</p>
                  <div className="flex items-center gap-2 text-success">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-sm font-black italic uppercase tracking-wider">Validated</span>
                  </div>
                </div>
                <div className="p-4 bg-muted rounded-2xl border border-border space-y-2">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Last Sync</p>
                  <p className="text-sm font-black italic uppercase tracking-wider text-primary">2h 14m ago</p>
                </div>
            </div>

            <div className="space-y-3">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-2">Compliance Artifacts</p>
                {[
                  { title: 'Tax Residency Certificate', status: 'VERIFIED', date: 'Exp: 2027-01' },
                  { title: 'ID Verification (KYC)', status: 'VERIFIED', date: 'Last: 2025-12' },
                  { title: 'Data Privacy Consent', status: 'ACTIVE', date: 'Signed: 2026-02' },
                  { title: 'Health & Safety Induction', status: 'COMPLETED', date: '2026-04-12' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-muted rounded-2xl border border-border hover:border-primary transition-colors cursor-pointer group">
                      <div className="flex items-center gap-3">
                        <FileCheck className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                        <div>
                            <p className="text-xs font-black uppercase tracking-tight text-white">{item.title}</p>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{item.date}</p>
                        </div>
                      </div>
                      <Badge className="bg-success text-success border-success/20 text-[9px] font-black uppercase tracking-widest">
                        {item.status}
                      </Badge>
                  </div>
                ))}
            </div>
          </div>

          <DialogFooter className="p-8 pt-0">
            <Button 
                className="w-full bg-primary hover:bg-primary text-white font-black italic uppercase tracking-[0.2em] rounded-2xl h-14"
                onClick={() => setIsComplianceOpen(false)}
            >
                Close Passport
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
