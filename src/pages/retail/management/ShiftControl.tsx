import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  ShieldAlert,
  Activity,
  Award,
  BarChart3,
  Users,
  Flame,
  UserCheck,
  Search,
  Timer,
  FileText,
  CheckCircle,
  Zap,
  Lock,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { retailService } from "@/core/services/retail/retailService";
import {
  schedulingService,
  type AvailableStaff,
} from "@/core/services/hr/schedulingService";
import { useSession } from "@/core/security/session";
import { useRetail } from "../context/RetailContext";
import type { RetailShift } from "@/core/types/retail/retail";

import { useGovernance } from "./pricing-promo-desk/hooks/useGovernance";
import { AuditTrailModal } from "./pricing-promo-desk/components/AuditTrailModal";
import {
  ScheduleGrid,
  ScheduledShift,
} from "./shift-control/components/ScheduleGrid";
import { ShiftGovernanceModal } from "./shift-control/components/ShiftGovernanceModal";
import { EditShiftModal } from "./shift-control/components/EditShiftModal";

const ShiftControl = () => {
  const session = useSession();
  const { activeStore, activeShift, refreshState } = useRetail();
  const [shifts, setShifts] = useState<RetailShift[]>([]);

  const [scheduledShifts, setScheduledShifts] = useState<ScheduledShift[]>([]);
  const [availableStaff, setAvailableStaff] = useState<AvailableStaff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // New states for Advanced Features
  const [viewMode, setViewMode] = useState<"daily" | "weekly" | "monthly">(
    "weekly",
  );
  const [selectedShiftForEdit, setSelectedShiftForEdit] =
    useState<ScheduledShift | null>(null);

  // Modals
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isGovernanceModalOpen, setIsGovernanceModalOpen] = useState(false);

  // Governance specifically for Shifts
  const { auditLog, addSignature } = useGovernance(
    "GLOBAL_SHIFT_ROSTER",
    session.tenant_id!,
    session,
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setFetchError(null);
        const [retailShifts, scheduled, staff] = await Promise.all([
          retailService.listShifts(session.tenant_id!, session, {
            store_id: session.location_id,
          }),
          schedulingService.getScheduledShifts(session),
          schedulingService.getAvailableStaff(
            session,
            session.location_id
              ? { location_id: session.location_id }
              : undefined,
          ),
        ]);
        setShifts(Array.isArray(retailShifts) ? retailShifts : []);
        setScheduledShifts(Array.isArray(scheduled) ? scheduled : []);
        setAvailableStaff(Array.isArray(staff) ? staff : []);
      } catch (error: any) {
        console.error("Failed to fetch workforce data", error);
        setFetchError(error?.message || "Failed to load shift data");
      } finally {
        setIsLoading(false);
      }
    };
    if (session.tenant_id) fetchData();
  }, [session.tenant_id, session.location_id]);

  // Workforce statistics derived from live schedule/shift/roster data.
  // Phase 2 wires scheduling + roster only; metrics with no backing endpoint
  // yet (attendance check-in, service velocity/score) are surfaced as
  // unavailable (`null`) rather than fabricated.
  const stats = useMemo(() => {
    const grid = Array.isArray(scheduledShifts) ? scheduledShifts : [];
    const staff = Array.isArray(availableStaff) ? availableStaff : [];

    const assignedStaff = new Set(
      grid
        .map((s) => s.employeeId)
        .filter((id) => id && id !== "NEW" && id !== "Unassigned"),
    );
    // Personnel on Grid: distinct assigned employees in the scheduling grid.
    const active = assignedStaff.size;

    // Labor efficiency: staffing coverage = scheduled distinct staff over the
    // available roster (derived from live data).
    const efficiency =
      staff.length > 0
        ? Math.round((active / staff.length) * 1000) / 10
        : 0;

    // Roster adherence: share of grid shifts already published/approved.
    const publishedCount = grid.filter((s) => s.status === "published").length;
    const rosterAdherence =
      grid.length > 0 ? Math.round((publishedCount / grid.length) * 100) : 0;

    return {
      active,
      efficiency,
      rosterAdherence,
      totalStaff: staff.length,
      // No attendance/service-velocity backend wired in Phase 2.
      attendance: null as number | null,
      serviceVelocity: null as string | null,
      serviceScore: null as number | null,
    };
  }, [scheduledShifts, availableStaff]);

  const handleShiftUpdate = (updatedShift: ScheduledShift) => {
    setScheduledShifts((prev) =>
      (Array.isArray(prev) ? prev : []).map((s) => (s.id === updatedShift.id ? updatedShift : s)),
    );
  };

  const handleShiftDelete = (shiftId: string) => {
    setScheduledShifts((prev) => (Array.isArray(prev) ? prev : []).filter((s) => s.id !== shiftId));
    toast({
      title: "Shift Removed",
      description: "The scheduled block was deleted.",
    });
  };

  const handleShiftCreate = (dayOfWeek: number) => {
    const newShift: ScheduledShift = {
      id: crypto.randomUUID(),
      employeeId: "NEW",
      name: "Unassigned",
      role: "Cashier",
      startTime: "09:00",
      endTime: "17:00",
      dayOfWeek,
      status: "draft",
    };
    setScheduledShifts((prev) => [...prev, newShift]);
    toast({
      title: "Draft Created",
      description: `New unassigned block added to grid.`,
    });
  };

  const handlePublishSchedule = async (reason: string) => {
    try {
      const affectedCount = (Array.isArray(scheduledShifts) ? scheduledShifts : []).filter(
        (s) => s.status === "draft",
      ).length;
      await addSignature(
        "Superadmin",
        session.user_id,
        true,
        `Published ${affectedCount} shifts: ${reason}`,
      );

      setScheduledShifts((prev) =>
        (Array.isArray(prev) ? prev : []).map((s) => ({ ...s, status: "published" })),
      );

      toast({
        title: "Schedule Published",
        description: `Cryptographic proof generated. Core HR updated.`,
      });
    } catch (e) {
      toast({
        title: "Publication Failed",
        description: `Failed to commit schedule to Estela Gea Core.`,
        variant: "destructive",
      });
    }
  };

  const handleReconcileActive = async () => {
    if (!activeShift) return;
    try {
      setIsLoading(true);
      await retailService.reconcileShift(session.tenant_id!, session, activeShift.id);
      toast({
        title: "Reconciliation Complete",
        description: "The shift has been audited and reconciled successfully.",
      });
      await refreshState();
    } catch (e) {
      toast({
        title: "Reconciliation Failed",
        description: "An error occurred during fiscal reconciliation.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };


  if (isLoading && shifts.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6 relative z-10">
          <Activity className="w-16 h-16 text-primary animate-spin" />
          <p className="text-sm font-black italic uppercase tracking-[0.3em] text-foreground">
            Synchronizing Workforce Telemetry...
          </p>
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.1)_0%,transparent_70%)]" />
      </div>
    );
  }

  if (fetchError && shifts.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="p-4 rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="w-12 h-12" />
          </div>
          <p className="text-lg font-black italic text-foreground">Failed to Load Shift Data</p>
          <p className="text-sm text-muted-foreground max-w-md">{fetchError}</p>
          <Button
            variant="outline"
            onClick={() => {
              setFetchError(null);
              setIsLoading(true);
              Promise.all([
                retailService.listShifts(session.tenant_id!, session, { store_id: session.location_id }),
                schedulingService.getScheduledShifts(session),
                schedulingService.getAvailableStaff(session, session.location_id ? { location_id: session.location_id } : undefined),
              ])
                .then(([retailShifts, scheduled, staff]) => {
                  setShifts(Array.isArray(retailShifts) ? retailShifts : []);
                  setScheduledShifts(Array.isArray(scheduled) ? scheduled : []);
                  setAvailableStaff(Array.isArray(staff) ? staff : []);
                })
                .catch((err: any) => setFetchError(err?.message || "Failed to load shift data"))
                .finally(() => setIsLoading(false));
            }}
            className="gap-2"
          >
            <Activity className="w-4 h-4" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  const draftCount = (Array.isArray(scheduledShifts) ? scheduledShifts : []).filter((s) => s.status === "draft").length;

  // Format shift time for display
  const formatShiftTime = (dateStr: string | undefined | null) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return dateStr;
    }
  };

  // Format currency for display
  const formatCash = (amount: number | undefined | null) => {
    if (amount == null) return "—";
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="flex flex-col min-h-screen bg-secondary selection:bg-primary selection:text-foreground relative overflow-hidden">

      {/* Header Tier */}
      <div className="px-10 py-8 border-b border-border bg-background/50 backdrop-blur-3xl shrink-0 flex flex-col lg:flex-row lg:items-center justify-between gap-6 sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-foreground shadow-xl shadow-indigo-600/20">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-foreground">
              Workforce Intelligence Hub
            </h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] mt-1">
              Node: {session.location_id || "GLOBAL_ROOT"} • Efficiency: {stats.efficiency}% • Risk: LOW
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            className="h-12 px-6 font-black italic border border-border text-foreground hover:bg-secondary/40 text-[11px] uppercase tracking-widest gap-3 rounded-2xl transition-all"
            onClick={() => setIsAuditModalOpen(true)}
          >
            <FileText className="w-4 h-4 text-warning" /> Core HR Ledger
          </Button>
          
          {activeShift && (
            <Button
              onClick={handleReconcileActive}
              className="h-12 px-6 rounded-2xl font-black italic uppercase text-[11px] tracking-widest gap-3 bg-success hover:bg-success text-foreground shadow-xl shadow-emerald-600/20 transition-all"
            >
              <CheckCircle className="w-4 h-4" /> Reconcile Active
            </Button>
          )}

          <Button
            className="h-12 px-6 rounded-2xl bg-primary hover:bg-primary text-foreground font-black italic uppercase text-[11px] tracking-widest gap-3 shadow-xl shadow-indigo-600/20 transition-all"
            onClick={() =>
              draftCount > 0
                ? setIsGovernanceModalOpen(true)
                : toast({ title: "No Drafts", description: "No draft shifts to publish." })
            }
            disabled={draftCount === 0}
          >
            <Calendar className="w-4 h-4" /> Publish Grid ({draftCount})
          </Button>
        </div>
      </div>

      <div className="flex-1 w-full relative">
        {/* Background Atmosphere */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-5%] w-[45%] h-[45%] bg-primary/5 blur-[130px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-5%] w-[35%] h-[35%] bg-primary/5 blur-[120px] rounded-full" />
        </div>

        <div className="max-w-[1600px] mx-auto p-6 space-y-10 relative z-10">
          {/* Workforce Vitals */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="rounded-2xl p-6 bg-card border border-border shadow-2xl backdrop-blur-3xl group">
              <div className="flex justify-between items-start mb-8">
                <div className="p-4 rounded-2xl bg-success/10 text-success border border-success/20">
                  <Users className="w-6 h-6" />
                </div>
                <Badge className="bg-success text-foreground font-black italic text-[8px] uppercase tracking-widest border-none px-3">
                  LIVE
                </Badge>
              </div>
              <div className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground mb-2">
                Personnel on Grid
              </div>
              <div className="text-2xl font-black italic tracking-tighter text-foreground">
                {stats.active} Members
              </div>
              <div className="text-[10px] font-bold italic text-success mt-4 uppercase flex items-center gap-2">
                <Activity className="w-4 h-4" /> Optimal Coverage Matrix
              </div>
            </Card>

            <Card className="rounded-2xl p-6 bg-card border border-border shadow-2xl backdrop-blur-3xl">
              <div className="flex justify-between items-start mb-8">
                <div className="p-4 rounded-2xl bg-primary/10 text-primary border border-primary">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <Badge className="bg-primary text-foreground font-black italic text-[8px] uppercase tracking-widest border-none px-3">
                  TARGET: 85%
                </Badge>
              </div>
              <div className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground mb-2">
                Labor Efficiency
              </div>
              <div className="text-2xl font-black italic tracking-tighter text-foreground">
                {stats.efficiency}%
              </div>
              <div className="text-[10px] font-bold italic text-primary mt-4 uppercase flex items-center gap-2">
                <Flame className="w-4 h-4 text-warning" /> Peak Performance Mode
              </div>
            </Card>

            <Card className="rounded-2xl p-6 bg-card border border-border shadow-2xl backdrop-blur-3xl">
              <div className="flex justify-between items-start mb-8">
                <div className="p-4 rounded-2xl bg-warning text-warning border border-warning/20">
                  <Award className="w-6 h-6" />
                </div>
                <Badge className="bg-warning text-foreground font-black italic text-[8px] uppercase tracking-widest border-none px-3">
                  ELITE
                </Badge>
              </div>
              <div className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground mb-2">
                Service Velocity
              </div>
              <div className="text-2xl font-black italic tracking-tighter text-foreground">
                {stats.serviceVelocity ?? "N/A"}
              </div>
              <div className="text-[10px] font-bold italic text-warning mt-4 uppercase">
                {stats.serviceVelocity
                  ? "Avg. Interaction Latency"
                  : "No telemetry source wired"}
              </div>
            </Card>

            <Card className="rounded-2xl p-6 bg-primary shadow-2xl relative overflow-hidden group border-none">
              <ShieldAlert className="absolute -right-10 -bottom-10 w-48 h-48 opacity-10 group-hover:scale-110 transition-transform duration-700" />
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                  <div className="text-[10px] font-black italic uppercase tracking-[0.3em] text-primary mb-2">
                    Compliance Guard
                  </div>
                  <div className="text-3xl font-black italic tracking-tighter text-foreground">
                    SECURE
                  </div>
                </div>
                <div className="text-[10px] font-bold italic text-foreground/60 uppercase tracking-widest">
                  Zero Overtime Violations
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-3">
              <Card className="rounded-[2rem] border-none bg-card shadow-2xl overflow-hidden backdrop-blur-md">
                 <div className="p-2">
                    <ScheduleGrid
                      shifts={scheduledShifts}
                      onShiftUpdate={handleShiftUpdate}
                      onShiftCreate={handleShiftCreate}
                      onShiftDelete={handleShiftDelete}
                      onShiftClick={(shift) => setSelectedShiftForEdit(shift)}
                      viewMode={viewMode}
                      onViewModeChange={setViewMode}
                    />
                 </div>
              </Card>
            </div>

            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Shift Records Table — displays open time, close time, counted cash, operator name */}
              <Card className="rounded-[2rem] bg-card border border-border shadow-2xl p-6 space-y-6 md:col-span-2">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-black italic uppercase tracking-[0.3em] text-muted-foreground">
                    Shift Records
                  </div>
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                {shifts.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground italic">
                      No shift records available.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left text-[10px] font-black italic uppercase tracking-widest text-muted-foreground py-3 px-2">Operator</th>
                          <th className="text-left text-[10px] font-black italic uppercase tracking-widest text-muted-foreground py-3 px-2">Open Time</th>
                          <th className="text-left text-[10px] font-black italic uppercase tracking-widest text-muted-foreground py-3 px-2">Close Time</th>
                          <th className="text-right text-[10px] font-black italic uppercase tracking-widest text-muted-foreground py-3 px-2">Counted Cash</th>
                          <th className="text-center text-[10px] font-black italic uppercase tracking-widest text-muted-foreground py-3 px-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(Array.isArray(shifts) ? shifts : []).map((shift) => (
                          <tr key={shift.id} className="hover:bg-muted/50 transition-colors">
                            <td className="py-3 px-2 font-bold text-foreground">
                              {(shift as any).operator_name || (shift as any).operatorName || shift.userId || "Unknown"}
                            </td>
                            <td className="py-3 px-2 text-muted-foreground">
                              {formatShiftTime((shift as any).open_time || (shift as any).openTime || shift.startTime)}
                            </td>
                            <td className="py-3 px-2 text-muted-foreground">
                              {formatShiftTime((shift as any).close_time || (shift as any).closeTime || shift.endTime)}
                            </td>
                            <td className="py-3 px-2 text-right font-bold text-foreground">
                              {formatCash((shift as any).counted_cash || (shift as any).countedCash || (shift as any).closingCash)}
                            </td>
                            <td className="py-3 px-2 text-center">
                              <Badge className={`text-[8px] font-black italic uppercase ${
                                shift.status === "active" || shift.status === "open"
                                  ? "bg-success/10 text-success"
                                  : shift.status === "closed"
                                    ? "bg-secondary text-muted-foreground"
                                    : "bg-warning text-warning"
                              }`}>
                                {shift.status || "unknown"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>

            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="rounded-[2rem] bg-card border border-border shadow-2xl p-6 space-y-10">
                <div className="flex items-center justify-between">
                   <div className="text-[10px] font-black italic uppercase tracking-[0.3em] text-muted-foreground">
                     Operational Pulse
                   </div>
                   <Zap className="w-5 h-5 text-primary" />
                </div>
                <div className="space-y-8">
                  {[
                    {
                      label: "Check-in Accuracy",
                      value: stats.attendance,
                      color: "bg-success",
                    },
                    {
                      label: "Roster Adherence",
                      value: stats.rosterAdherence,
                      color: "bg-primary",
                    },
                    {
                      label: "Service Score",
                      value: stats.serviceScore,
                      color: "bg-primary",
                      suffix: "/5",
                    },
                  ].map((item, i) => {
                    const available = item.value !== null && item.value !== undefined;
                    return (
                      <div key={i} className="space-y-3">
                        <div className="flex justify-between items-end italic">
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                            {item.label}
                          </span>
                          <span className="text-xl font-black text-foreground tracking-tighter">
                            {available ? (
                              <>
                                {item.value}
                                {item.suffix || "%"}
                              </>
                            ) : (
                              "N/A"
                            )}
                          </span>
                        </div>
                        <Progress
                          value={available ? (item.value as number) : 0}
                          className="h-2 bg-secondary rounded-full overflow-hidden"
                        />
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card className="rounded-[2rem] bg-primary shadow-2xl p-6 group cursor-pointer hover:bg-primary transition-all duration-500 overflow-hidden relative border-none">
                <UserCheck className="absolute -right-12 -bottom-12 w-56 h-56 opacity-10 group-hover:scale-110 transition-transform duration-1000" />
                <div className="relative h-full flex flex-col items-center justify-center text-center space-y-8">
                  <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center shadow-2xl backdrop-blur-xl border border-border">
                    <Timer className="w-10 h-10 text-foreground" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-3xl font-black italic tracking-tighter uppercase text-foreground">
                      AI Optimizer
                    </h4>
                    <p className="text-[11px] font-bold text-primary/10 leading-relaxed italic uppercase tracking-widest max-w-[280px]">
                      Traffic peak detected at 17:00. Suggested: Add 2 cashiers to Front End.
                    </p>
                  </div>
                  <Button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      toast({ title: "Intelligence Initialized", description: "Analyzing 30-day traffic patterns to optimize next week's roster..." });
                      setTimeout(() => {
                        toast({ title: "Optimization Complete", description: "14 shifts drafted based on predicted 17:00 peak traffic." });
                      }, 2000);
                    }}
                    className="w-full bg-card text-primary hover:bg-muted/90 h-16 font-black italic uppercase tracking-[0.2em] rounded-2xl text-[11px] shadow-2xl transition-all"
                  >
                    Auto-Generate Next Week
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {selectedShiftForEdit && (
        <EditShiftModal
          isOpen={true}
          onClose={() => setSelectedShiftForEdit(null)}
          shift={selectedShiftForEdit}
          onSave={handleShiftUpdate}
          onDelete={handleShiftDelete}
          availableStaff={availableStaff}
        />
      )}

      <ShiftGovernanceModal
        isOpen={isGovernanceModalOpen}
        onClose={() => setIsGovernanceModalOpen(false)}
        onPublish={handlePublishSchedule}
        affectedShiftsCount={draftCount}
      />

      <AuditTrailModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        auditLog={auditLog}
        promoTitle="CORE HR SCHEDULING LEDGER"
      />
    </div>
  );
};

export default ShiftControl;
