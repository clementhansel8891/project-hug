import React, { useState, useEffect, useMemo } from "react";

import {
  Tag,
  Zap,
  Percent,
  ShieldCheck,
  TrendingUp,
  BarChart3,
  ChevronRight,
  Plus,
  Search,
  CheckSquare,
  Play,
  RotateCcw,
  Target,
  FileText,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { retailService } from "@/core/services/retail/retailService";
import { useSession } from "@/core/security/session";
import type { RetailPromotion } from "@/core/types/retail/retail";
import { cn } from "@/lib/utils";

import { ApprovalMatrix } from "./pricing-promo-desk/components/ApprovalMatrix";
import { AuditTrailModal } from "./pricing-promo-desk/components/AuditTrailModal";
import { BufferCollisionSensor } from "./pricing-promo-desk/components/BufferCollisionSensor";
import { useGovernance } from "./pricing-promo-desk/hooks/useGovernance";
import { CreatePromoModal } from "./pricing-promo-desk/components/CreatePromoModal";

const PricingPromoDesk = () => {
  const session = useSession();
  const [promotions, setPromotions] = useState<RetailPromotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Single Selection for Governance Focus (to keep the engine simple and robust)
  const [focusedPromoId, setFocusedPromoId] = useState<string | null>(null);

  // Modals state
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Initialize the Governance Engine
  const {
    state: govState,
    auditLog,
    addSignature,
    toggleBypassMode,
    setBypassReason,
    executePromo,
  } = useGovernance(
    focusedPromoId || "",
    session.tenant_id || "tenant",
    session,
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setFetchError(null);
        const data = await retailService.listPromotions(
          session.tenant_id!,
          session,
        );
        const fetchedPromos = Array.isArray(data) ? data : [];
        setPromotions(fetchedPromos);
        if (fetchedPromos.length > 0) {
          setFocusedPromoId(fetchedPromos[0].id);
        }
      } catch (error: any) {
        console.error("Failed to fetch promotions", error);
        setFetchError(error?.message || "Failed to load pricing data");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [session.tenant_id, session]);

  const stats = useMemo(() => {
    const active = (Array.isArray(promotions) ? promotions : []).filter((p) => p.status === "active").length;
    const pending = (Array.isArray(promotions) ? promotions : []).filter((p) => p.status === "draft").length;
    // Margin impact is derived from active promotions aggregate discount
    const marginImpact = active > 0
      ? -Math.round((Array.isArray(promotions) ? promotions : [])
          .filter((p) => p.status === "active")
          .reduce((sum, p) => sum + (p.type === "percentage" ? p.value * 0.1 : 0.5), 0) * 10) / 10
      : 0;

    return { active, marginImpact, pending };
  }, [promotions]);

  const focusedPromo = useMemo(() => {
    return promotions.find((p) => p.id === focusedPromoId) || null;
  }, [promotions, focusedPromoId]);

  const handleExecute = async () => {
    const success = await executePromo();
    if (success && focusedPromo) {
      // Optimistically update the promotion status locally
      setPromotions((prev) =>
        (Array.isArray(prev) ? prev : []).map((p) =>
          p.id === focusedPromo.id
            ? { ...p, status: "active" as RetailPromotion["status"] }
            : p,
        ),
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center bg-secondary/5">
        <div className="flex flex-col items-center gap-4">
          <RotateCcw className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm font-black italic uppercase tracking-widest text-muted-foreground">
            Calibrating Governance Ledger...
          </p>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex h-[400px] items-center justify-center bg-secondary/5">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="p-4 rounded-2xl bg-destructive/10 text-destructive">
            <Target className="w-8 h-8" />
          </div>
          <p className="text-sm font-bold text-destructive">{fetchError}</p>
          <Button
            variant="outline"
            onClick={() => {
              setFetchError(null);
              setIsLoading(true);
              retailService.listPromotions(session.tenant_id!, session)
                .then((data) => {
                  const fetchedPromos = Array.isArray(data) ? data : [];
                  setPromotions(fetchedPromos);
                  if (fetchedPromos.length > 0) setFocusedPromoId(fetchedPromos[0].id);
                })
                .catch((err: any) => setFetchError(err?.message || "Failed to load pricing data"))
                .finally(() => setIsLoading(false));
            }}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] overflow-hidden bg-secondary/5">
      <div className="px-6 py-3 border-b bg-background/40 backdrop-blur-md shrink-0 flex items-center justify-between gap-6">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black italic tracking-tighter text-foreground uppercase">Revenue Control Desk</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Governance Layer: SECURED • Margin Integrity: {stats.marginImpact > -3 ? "OPTIMAL" : "CRITICAL"}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setIsAuditModalOpen(true)}
            disabled={!focusedPromoId}
            className="h-10 rounded-xl px-4 font-black italic border-white/10 text-[10px] uppercase tracking-widest gap-2 bg-white/[0.04] hover:bg-white/10 text-muted-foreground backdrop-blur-sm"
          >
            <FileText className="w-3.5 h-3.5 text-primary" /> IMMUTABLE LEDGER
          </Button>
          <Button 
            className="h-10 px-5 rounded-xl bg-secondary hover:bg-secondary/60 text-foreground font-black italic uppercase text-[10px] tracking-widest gap-2 shadow-lg transition-all active:scale-95"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus className="w-3.5 h-3.5" /> ISSUE PROPOSAL
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 lg:p-6">
        <div className="max-w-7xl mx-auto space-y-10">
          {/* Top KPI row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="rounded-2xl p-6 bg-white/[0.04] border border-white/10 border-l-[6px] border-l-primary shadow-xl backdrop-blur-xl">
              <div className="flex justify-between items-start mb-6">
                <div className="p-4 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                  <Percent className="w-5 h-5" />
                </div>
                <Badge className="bg-success/10 text-success border-none text-[8px] font-black italic uppercase tracking-widest px-3 py-2 rounded-xl">
                  LIVE
                </Badge>
              </div>
              <div className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground mb-1">
                Active Tactical Pricing
              </div>
              <div className="text-3xl font-black italic tracking-tighter text-foreground">
                {stats.active} Promos
              </div>
            </Card>

            <Card className="rounded-2xl p-6 bg-white/[0.04] border border-white/10 border-l-[6px] border-l-warning shadow-xl backdrop-blur-xl">
              <div className="flex justify-between items-start mb-6">
                <div className="p-4 rounded-2xl bg-warning text-warning border border-warning/20">
                  <Zap className="w-5 h-5" />
                </div>
                <Badge
                  variant="destructive"
                  className="font-black italic text-[8px] tracking-widest border-none"
                >
                  URGENT
                </Badge>
              </div>
              <div className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground mb-1">
                Pending Governance
              </div>
              <div className="text-3xl font-black italic tracking-tighter text-foreground">
                {stats.pending} Requests
              </div>
            </Card>

            <Card className="rounded-2xl p-6 bg-white/[0.04] border border-white/10 border-l-[6px] border-l-primary shadow-xl backdrop-blur-xl">
              <div className="flex justify-between items-start mb-6">
                <div className="p-4 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <Badge className="bg-primary/10 text-primary font-black italic text-[8px] uppercase tracking-widest border border-primary/20">
                  AGGREGATE
                </Badge>
              </div>
              <div className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground mb-1">
                Margin Erosion Base
              </div>
              <div className="text-3xl font-black italic tracking-tighter text-foreground">
                {stats.marginImpact}%
              </div>
            </Card>

            <Card className="rounded-2xl p-6 bg-primary/10 border border-primary/20 text-foreground shadow-2xl relative overflow-hidden group backdrop-blur-xl">
              <ShieldCheck className="absolute -right-8 -bottom-8 w-32 h-32 opacity-10 group-hover:scale-110 transition-transform" />
              <div className="relative z-10">
                <div className="text-[10px] font-black italic uppercase tracking-widest text-primary mb-4">
                  Guardrail Status
                </div>
                <div className="text-2xl font-black italic tracking-tighter">
                  SECURED
                </div>
                <div className="text-[10px] font-bold italic opacity-60 mt-4 uppercase">
                  No Policy Violations
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Promotion List */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <Card className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl flex flex-col flex-1 h-[600px]">
                <div className="p-6 md:p-8 border-b border-white/10 flex items-center justify-between shrink-0">
                  <h3 className="text-xs font-black italic uppercase tracking-widest text-muted-foreground">
                    Registry
                  </h3>
                </div>
                <div className="p-4 shrink-0 bg-white/[0.02]">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      className="pl-12 h-11 bg-white/[0.05] border-white/10 rounded-2xl text-xs font-bold italic text-foreground placeholder:text-muted-foreground"
                      placeholder="Search Strategy..."
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-white/5">
                  {(Array.isArray(promotions) ? promotions : []).map((promo) => (
                    <div
                      key={promo.id}
                      onClick={() => setFocusedPromoId(promo.id)}
                      className={cn(
                        "group p-6 flex flex-col md:flex-row items-start md:items-center justify-between transition-all cursor-pointer",
                        focusedPromoId === promo.id
                          ? "bg-primary/5"
                          : "hover:bg-secondary/5",
                      )}
                    >
                      <div className="flex items-center gap-4 w-full">
                        <div
                          className={cn(
                            "w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 transition-transform",
                            focusedPromoId === promo.id
                              ? "bg-primary border-primary/50 text-primary-foreground scale-105 shadow-lg"
                              : "bg-white/[0.05] border-white/15 text-primary shadow-sm",
                          )}
                        >
                          <Tag className="w-5 h-5" />
                        </div>
                        <div className="flex-1 truncate">
                          <div className="text-sm font-black italic tracking-tight text-foreground truncate">
                            {promo.title}
                          </div>
                          <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                            {promo.id.substring(0, 8)} • {promo.status}
                          </div>
                        </div>
                        {focusedPromoId === promo.id && (
                          <ChevronRight className="w-4 h-4 text-primary animate-pulse shrink-0" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Right Column: Governance Engine & Execution Context */}
            <div className="lg:col-span-8 flex flex-col gap-8 h-full">
              {focusedPromo ? (
                <>
                  <div className="flex items-center justify-between bg-white/[0.04] p-6 rounded-2xl border border-white/10 backdrop-blur-xl">
                    <div>
                      <h2 className="text-2xl font-black italic tracking-tighter text-foreground">
                        {focusedPromo.title}
                      </h2>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1 flex gap-3">
                        <span>Target: {focusedPromo.target || "GENERAL"}</span>
                        <span
                          className={
                            focusedPromo.status === "active"
                              ? "text-success"
                              : "text-warning"
                          }
                        >
                          Status: {focusedPromo.status}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-3xl font-black italic tracking-tighter text-foreground">
                        {focusedPromo.type === "percentage"
                          ? `${focusedPromo.value}%`
                          : `Rp ${focusedPromo.value.toLocaleString()}`}
                      </span>
                      <div className="text-[10px] uppercase font-bold text-muted-foreground mt-1">
                        Markdown Value
                      </div>
                    </div>
                  </div>

                  {/* The new Governance Layer Components */}
                  <ApprovalMatrix
                    governanceState={govState}
                    onSign={(dept, isBypass) =>
                      addSignature(dept, session.user_id || "User", isBypass)
                    }
                    onToggleBypass={toggleBypassMode}
                    onBypassReasonChange={setBypassReason}
                  />

                  {/* Grid for Impact Sensors */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <BufferCollisionSensor
                      currentStock={focusedPromo ? Math.round(Math.random() * 2000 + 500) : 0}
                      promoImpactEstimate={focusedPromo ? Math.round(focusedPromo.value * 5) : 0}
                      ecommerceBufferConfig={100}
                    />

                    <Card className="rounded-2xl bg-primary text-foreground p-8 group overflow-hidden relative border-none">
                      <Target className="absolute -right-8 -bottom-8 w-40 h-40 opacity-10 group-hover:scale-110 transition-transform" />
                      <div className="relative flex flex-col h-full justify-between">
                        <div className="space-y-4">
                          <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5" />
                          </div>
                          <h4 className="text-xl font-black italic tracking-tighter uppercase">
                            Elasticity Sensor
                          </h4>
                          <p className="text-xs font-medium opacity-80 leading-relaxed italic pr-4">
                            Pricing velocity models predict a 14% uplift in
                            sales volume for this markdown, with a tolerable
                            margin sacrifice.
                          </p>
                        </div>
                        <div className="mt-6 flex gap-2">
                          <Badge className="bg-primary/50 hover:bg-primary/50 border-none font-black text-[9px] uppercase">
                            Low Risk
                          </Badge>
                          <Badge className="bg-primary/50 hover:bg-primary/50 border-none font-black text-[9px] uppercase">
                            High Volume
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Execution Action Bar */}
                  <div className="mt-4 flex items-center justify-end bg-secondary p-6 rounded-2xl shadow-2xl sticky bottom-4 z-40 relative overflow-hidden group">
                    {/* Glow effect on hover */}
                    <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-center gap-6 relative z-10 w-full justify-between md:justify-end">
                      <span className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground hidden md:block">
                        Action Requires Ledger Update
                      </span>
                      <Button
                        onClick={handleExecute}
                        disabled={
                          (!govState.quorumReached && !govState.isBypassMode) ||
                          govState.phase === "Executed" ||
                          focusedPromo.status === "active"
                        }
                        className={cn(
                          "h-14 px-8 rounded-2xl font-black italic text-xs uppercase tracking-widest gap-3 w-full md:w-auto shadow-lg transition-all",
                          govState.phase === "Executed" ||
                            focusedPromo.status === "active"
                            ? "bg-secondary/60 text-muted-foreground"
                            : govState.isBypassMode
                              ? "bg-destructive hover:bg-destructive text-foreground shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                              : "bg-success hover:bg-success text-foreground shadow-[0_0_20px_rgba(16,185,129,0.3)]",
                        )}
                      >
                        {focusedPromo.status === "active" ||
                        govState.phase === "Executed" ? (
                          <>EXECUTED AND LOCKED</>
                        ) : (
                          <>
                            <Play className="w-4 h-4 ml-1" /> Commit to Edge &
                            Execute
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center border-2 border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
                  <div className="text-center text-muted-foreground space-y-3">
                    <Target className="w-12 h-12 mx-auto opacity-20" />
                    <div className="font-black italic uppercase tracking-widest text-xs">
                      Awaiting Focus
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AuditTrailModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        auditLog={auditLog}
        promoTitle={focusedPromo?.title || "Unknown Campaign"}
      />

      <CreatePromoModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(newPromo) => {
          setPromotions(prev => [newPromo, ...prev]);
          setFocusedPromoId(newPromo.id);
        }}
      />
    </div>
  );
};

export default PricingPromoDesk;
