import React, { useState, useEffect } from "react";
import {
  Lock,
  Banknote,
  Calculator,
  AlertCircle,
  FileCheck,
  Landmark,
  ShieldCheck,
  RefreshCw,
  FileText,
  ChevronRight,
  ShieldAlert,
  Fingerprint,
  X,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { retailService } from "@/core/services/retail/retailService";
import { useSession } from "@/core/security/session";
import { useRetail } from "../context/RetailContext";
import { formatCurrency } from "@/lib/format";
import type { RetailShift } from "@/core/types/retail/retail";

const ShiftCloseTerminal = () => {
  const session = useSession();
  const { activeStore, activeChannel, activeShift, refreshState, isLoading: isContextLoading } = useRetail();
  const [expectedCash, setExpectedCash] = useState<number>(0);
  const [expectedCard, setExpectedCard] = useState<number>(0);
  const [actualCash, setActualCash] = useState<string>("");
  const [explanation, setExplanation] = useState("");
  const [closingNote, setClosingNote] = useState("");
  const [complianceNote, setComplianceNote] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const parseDecimal = (val: unknown): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    // Handle Prisma/Decimal.js objects that might be serialized
    if (typeof val === 'object' && val.toString) {
      const parsed = parseFloat(val.toString());
      return isNaN(parsed) ? 0 : parsed;
    }
    const parsed = parseFloat(String(val));
    return isNaN(parsed) ? 0 : parsed;
  };

  useEffect(() => {
    if (!isContextLoading && activeShift) {
      setExpectedCash(parseDecimal(activeShift.expectedCash));
      setExpectedCard(0);
      setIsLoading(false);
    } else if (!isContextLoading && !activeShift && !isClosed) {
      setIsLoading(false);
    }
  }, [activeShift, isContextLoading, isClosed]);

  const parseAmountInput = (val: string | number) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    // For IDR input, strip everything that isn't a digit to avoid locale parsing bugs
    const clean = val.toString().replace(/[^0-9]/g, '');
    return parseInt(clean, 10) || 0;
  };

  const variance = actualCash ? parseAmountInput(actualCash) - expectedCash : 0;
  const needsExplanation = Math.abs(variance) > 10000;

  interface CashMovement {
    amount: number | string;
    type: "CASH_IN" | "CASH_OUT";
  }

  const totalCashOut = (activeShift?.cash_movements as CashMovement[] || [])
    .filter((m) => m.type === "CASH_OUT")
    .reduce((sum, m) => sum + Number(m.amount), 0);

  const totalCashIn = (activeShift?.cash_movements as CashMovement[] || [])
    .filter((m) => m.type === "CASH_IN")
    .reduce((sum, m) => sum + Number(m.amount), 0);

  const netAdjustments = totalCashIn - totalCashOut;

  const handleCloseShift = async () => {
    if (!activeShift) {
      toast({ title: "Session Missing", description: "No active shift detected on this node.", variant: "destructive" });
      return;
    }
    if (!actualCash) {
      toast({ title: "Input Required", description: "Please enter the physical tender count.", variant: "destructive" });
      return;
    }
    if (!closingNote.trim() || !complianceNote.trim()) {
      toast({ title: "Incomplete Protocol", description: "Closing and Compliance notes are mandatory.", variant: "destructive" });
      return;
    }
    if (needsExplanation && !explanation) {
      toast({ title: "Policy Violation", description: "Variance explanation is mandatory for discrepancies > Rp 10,000", variant: "destructive" });
      return;
    }

    setIsClosing(true);
    try {
      await retailService.closeShift(
        session.tenant_id!,
        session,
        activeShift.id,
        parseAmountInput(actualCash),
        explanation,
        closingNote,
        complianceNote,
      );

      toast({ title: "Shift Reconciled", description: `Node session ${(activeShift?.id || "").slice(-6).toUpperCase()} locked in Estela Gea Vault.` });
      setIsClosed(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Sync failed";
      toast({ title: "Commit Failed", description: message, variant: "destructive" });
    } finally {
      setIsClosing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background text-muted-foreground font-black italic uppercase tracking-[0.25em]">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-[50%] h-[50%] bg-primary/20 blur-[150px] rounded-full animate-pulse" />
        </div>
        <RefreshCw className="w-16 h-16 mb-8 animate-spin text-primary relative z-10" />
        <span className="relative z-10 text-foreground">Hydrating Fiscal Telemetry...</span>
      </div>
    );
  }

  if (!activeShift && !isClosed) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background text-muted-foreground">
        <div className="w-24 h-24 bg-secondary/40 rounded-3xl flex items-center justify-center mb-8 border border-border shadow-2xl">
          <Lock className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-3xl font-black italic text-foreground tracking-tighter uppercase mb-2">
          Node Locked
        </h2>
        <p className="font-bold uppercase tracking-widest text-[10px] text-muted-foreground">
          No active shift detected on this terminal
        </p>
      </div>
    );
  }

  if (isClosed) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-background p-8">
        <GlassCard className="max-w-2xl w-full border-none bg-success/5 backdrop-blur-3xl shadow-2xl rounded-[3rem] overflow-hidden">
          <CardContent className="p-16 text-center space-y-10">
            <div className="w-32 h-32 bg-success rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-success/30 transform rotate-12 transition-transform hover:rotate-0 duration-500">
              <ShieldCheck className="w-16 h-16 text-foreground" />
            </div>
            <div>
              <h2 className="text-4xl font-black italic text-foreground tracking-tighter uppercase">
                Reconciled & Sealed
              </h2>
              <p className="text-success font-black mt-3 tracking-[0.3em] text-[10px] uppercase italic">
                Compliance ID: <span className="text-foreground">ZVX-RECON-{(activeShift?.id || "").slice(-8).toUpperCase()}</span>
              </p>
            </div>
            <Separator className="bg-success/20" />
            <div className="grid grid-cols-2 gap-8 text-left">
              <div className="p-8 bg-secondary/40 rounded-[2rem] border border-success/20 shadow-inner">
                <div className="text-[9px] font-black text-success/60 uppercase tracking-widest mb-2 italic">
                  Physical Tender
                </div>
                <div className="text-3xl font-black italic tracking-tighter text-foreground">
                  {formatCurrency(parseAmountInput(actualCash), "IDR", "id-ID")}
                </div>
              </div>
              <div className="p-8 bg-secondary/40 rounded-[2rem] border border-success/20 shadow-inner">
                <div className="text-[9px] font-black text-success/60 uppercase tracking-widest mb-2 italic">
                  Ledger Variance
                </div>
                <div className={`text-3xl font-black italic tracking-tighter ${variance < 0 ? "text-destructive" : variance > 0 ? "text-warning" : "text-success"}`}>
                  {formatCurrency(variance, "IDR", "id-ID")}
                </div>
              </div>
            </div>
            <Button
              className="w-full h-20 bg-success hover:bg-success text-foreground font-black italic gap-4 rounded-2xl shadow-2xl shadow-success/20 transition-all uppercase tracking-[0.2em] text-sm"
              onClick={async () => {
                await refreshState();
                window.location.href = "/m/retail/operational/gateway";
              }}
            >
              <FileText className="w-7 h-7" /> Archive & Restart Node
            </Button>
          </CardContent>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="flex-1 relative flex selection:bg-primary selection:text-foreground">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] w-[45%] h-[45%] bg-primary/10 blur-[130px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[35%] h-[35%] bg-primary/10 blur-[120px] rounded-full animate-pulse" />
      </div>

      <div className="flex-1 overflow-y-auto p-8 relative z-10 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-foreground shadow-lg shadow-primary/20">
                <Landmark className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-3xl font-black italic uppercase tracking-tighter text-foreground">
                  Shift Reconciliation
                </h1>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] ml-1">
                  Terminal ID: {session.location_id || "LOCAL_VAULT"} • v2.4.0
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-success/10 border border-success/20 rounded-xl flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-success" />
                <span className="text-[10px] font-black italic uppercase text-success tracking-widest">
                  Compliance: ACTIVE
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <GlassCard className="border-none bg-primary/10 backdrop-blur-3xl shadow-2xl rounded-[2.5rem] relative overflow-hidden group">
              <div className="absolute -right-8 -bottom-8 opacity-10 group-hover:scale-125 transition-transform">
                <Banknote className="w-32 h-32 text-primary" />
              </div>
              <CardHeader className="pb-4 p-10">
                <CardTitle className="text-[10px] font-black text-primary uppercase tracking-[0.3em] leading-none flex items-center gap-3 italic">
                  <Calculator className="w-4 h-4" /> Expected Cash Tender
                </CardTitle>
              </CardHeader>
              <CardContent className="px-10 pb-10">
                <div className="text-6xl font-black text-foreground tracking-tighter italic">
                  {formatCurrency(expectedCash, "IDR", "id-ID")}
                </div>
                {netAdjustments !== 0 && (
                  <div className={`mt-3 text-[10px] font-black uppercase tracking-widest italic flex items-center gap-2 ${netAdjustments < 0 ? "text-destructive" : "text-success"}`}>
                    {netAdjustments < 0 ? <ArrowDownCircle className="w-3 h-3" /> : <ArrowUpCircle className="w-3 h-3" />}
                    Petty Cash: {netAdjustments < 0 ? "-" : "+"}{formatCurrency(Math.abs(netAdjustments), "IDR", "id-ID")}
                  </div>
                )}
                <p className="text-[10px] text-primary mt-4 uppercase font-black italic tracking-widest">
                  Aggregated from Live Transaction Stream
                </p>
              </CardContent>
            </GlassCard>

            <GlassCard className="border-none bg-secondary/40 backdrop-blur-3xl shadow-2xl rounded-[2.5rem] group overflow-hidden">
              <CardHeader className="pb-4 p-10">
                <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] leading-none flex items-center gap-3 italic">
                  <ChevronRight className="w-4 h-4 text-primary" /> Electronic Settlements
                </CardTitle>
              </CardHeader>
              <CardContent className="px-10 pb-10">
                <div className="text-6xl font-black text-foreground tracking-tighter italic">
                  {formatCurrency(expectedCard, "IDR", "id-ID")}
                </div>
                <p className="text-[10px] text-muted-foreground mt-4 uppercase font-black italic tracking-widest text-right">
                  Verified PCI Gateway Consolidations
                </p>
              </CardContent>
            </GlassCard>
          </div>

          <GlassCard className="shadow-2xl border-none bg-secondary/40 backdrop-blur-3xl overflow-hidden rounded-[3rem]">
            <CardHeader className="bg-background text-foreground p-12 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-3xl font-black italic tracking-tighter uppercase">
                    Physical Tender Audit
                  </CardTitle>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] mt-1">
                    Node: {activeStore?.name || "Global Hub"}
                  </p>
                </div>
                <Fingerprint className="w-12 h-12 text-primary opacity-50" />
              </div>
            </CardHeader>
            <CardContent className="p-12 space-y-12">
              <div className="flex flex-col items-center justify-center p-16 bg-primary/[0.02] rounded-[3.5rem] border-4 border-dashed border-border relative group transition-all hover:bg-primary/[0.04] hover:border-primary/30">
                <div className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.4em] mb-10 italic">
                  Input Final Physical Count (IDR)
                </div>
                <div className="relative w-full max-w-xl">
                  <span className="absolute left-8 top-1/2 -translate-y-1/2 text-6xl font-black text-foreground/10 italic tracking-tighter transition-colors group-focus-within:text-primary/30">
                    Rp
                  </span>
                  <Input
                    className="h-32 pl-32 text-8xl font-black text-center border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-foreground/5 text-foreground tracking-tighter italic"
                    placeholder="0"
                    type="tel"
                    value={actualCash}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      if (raw) {
                        setActualCash(parseInt(raw, 10).toLocaleString('id-ID'));
                      } else {
                        setActualCash("");
                      }
                    }}
                  />
                  <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-primary via-secondary to-primary rounded-full shadow-[0_0_20px_hsl(var(--primary)/0.4)]" />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-3 italic px-2">
                    <FileCheck className="w-5 h-5 text-primary" /> Operational Summary
                  </label>
                  <Textarea
                    placeholder="Handover notes, operational remarks, or shift highlights..."
                    className="min-h-[120px] border-none bg-secondary/40 focus:bg-primary/10 p-8 rounded-[2rem] text-sm font-bold italic text-foreground transition-all custom-scrollbar"
                    value={closingNote}
                    onChange={(e) => setClosingNote(e.target.value)}
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-destructive flex items-center gap-3 italic px-2">
                    <ShieldAlert className="w-5 h-5" /> Fiscal Compliance Declaration
                  </label>
                  <Textarea
                    placeholder="Declare overrides, confirm tax integrity, and sign-off on totals..."
                    className="min-h-[120px] border-none bg-secondary/40 focus:bg-primary/10 p-8 rounded-[2rem] text-sm font-bold italic text-foreground transition-all custom-scrollbar"
                    value={complianceNote}
                    onChange={(e) => setComplianceNote(e.target.value)}
                  />
                </div>
              </div>

              {actualCash && (
                <div className={`p-10 rounded-[2.5rem] border-2 flex flex-col justify-center transition-all animate-in slide-in-from-bottom-8 duration-700 ${needsExplanation ? "bg-destructive/10 border-destructive/30 shadow-[0_0_50px_hsl(var(--destructive)/0.1)]" : "bg-success/10 border-success/30 shadow-[0_0_50px_hsl(var(--success)/0.1)]"}`}>
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground mb-2 italic">
                        Calculated Reconciliation Delta
                      </div>
                      <div className={`text-6xl font-black italic tracking-tighter ${variance < 0 ? "text-destructive" : variance > 0 ? "text-warning" : "text-success"}`}>
                        {formatCurrency(variance, "IDR", "id-ID")}
                      </div>
                    </div>
                    {needsExplanation && (
                      <div className="flex-1 max-w-md space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-destructive flex items-center gap-3 italic">
                          <AlertCircle className="w-5 h-5 animate-pulse" /> Discrepancy Justification Mandatory
                        </label>
                        <Textarea
                          placeholder="Provide root cause for Audit Vault..."
                          className="min-h-[100px] border-none bg-secondary/50 focus:bg-secondary p-6 rounded-2xl text-sm font-bold italic text-foreground"
                          value={explanation}
                          onChange={(e) => setExplanation(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </GlassCard>

          <div className="flex flex-col items-center gap-8 pb-12">
            <Button
              className="w-full h-28 text-3xl font-black italic uppercase tracking-[0.3em] bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xl rounded-[2.5rem] group relative overflow-hidden transition-all active:scale-[0.98]"
              onClick={handleCloseShift}
              disabled={isClosing}
            >
              {isClosing ? (
                <RefreshCw className="w-12 h-12 animate-spin text-primary" />
              ) : (
                <div className="flex items-center gap-8">
                  <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-foreground shadow-xl group-hover:scale-110 transition-transform">
                    <Lock className="w-9 h-9" />
                  </div>
                  <span>Seal & Commit Shift</span>
                </div>
              )}
            </Button>
            <div className="flex items-center gap-6 px-12 py-5 bg-secondary/40 rounded-full border border-border backdrop-blur-xl">
              <ShieldCheck className="w-6 h-6 text-success" />
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] italic">
                Secure Hash will be appended to the <span className="text-foreground">Estela Gea Fiscal Ledger</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShiftCloseTerminal;
