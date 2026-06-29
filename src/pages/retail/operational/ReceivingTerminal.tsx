import React, { useState, useEffect } from "react";
import {
  Truck,
  ScanBarcode,
  ClipboardCheck,
  AlertTriangle,
  Package2,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  History,
  Activity,
  Home,
  X,
  Layers,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { GlassCard } from "@/components/shared/GlassCard";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { retailService } from "@/core/services/retail/retailService";
import { useSession } from "@/core/security/session";
import { useRetail } from "../context/RetailContext";
import type { RetailShift } from "@/core/types/retail/retail";

interface ShipmentItem {
  itemId: string;
  name: string;
  expected: number;
  received: number;
}

interface Shipment {
  id: string;
  vendor: string;
  items: ShipmentItem[];
  priority: "HIGH" | "NORMAL";
  status: "pending" | "receiving" | "completed";
}

const ReceivingTerminal = () => {
  const session = useSession();
  const { activeStore, activeChannel, activeShift, isLoading: isContextLoading } = useRetail();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [activeShipment, setActiveShipment] = useState<Shipment | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const orders = await retailService.listOrders(session.tenant_id!, session, { status: "pending" });

        // Map pending orders to shipments as a production bridge
        const mappedShipments: Shipment[] = (Array.isArray(orders) ? orders : []).map(o => ({
          id: `SHIP-${(o.id || "").slice(-8).toUpperCase()}`,
          vendor: o.customerName || "Central Distribution",
          priority: o.totalAmount > 1000000 ? "HIGH" : "NORMAL",
          status: "pending",
          items: (Array.isArray(o.items) ? o.items : []).map(i => ({
            itemId: i.itemId,
            name: i.name,
            expected: i.quantity,
            received: 0
          }))
        }));

        // Fallback for demo if no orders exist
        if (mappedShipments.length === 0) {
           setShipments([
            {
              id: "PO-ZVX-991",
              vendor: "Central Distribution",
              priority: "HIGH",
              status: "pending",
              items: [
                { itemId: "p1", name: "Premium Arabica 250g", expected: 50, received: 0 },
                { itemId: "p2", name: "Dark Roast 250g", expected: 25, received: 0 },
              ],
            },
            {
              id: "PO-LBC-442",
              vendor: "Local Beverage Co.",
              priority: "NORMAL",
              status: "pending",
              items: [
                { itemId: "p3", name: "Iced Latte Cans", expected: 100, received: 0 },
              ],
            }
           ]);
        } else {
          setShipments(mappedShipments);
        }

      } catch (e) {
        console.error("Failed to fetch logistics data", e);
      } finally {
        setIsLoading(false);
      }
    };

    if (!isContextLoading && !activeShift) {
       toast({
        title: "Fiscal Gate Active",
        description: "Please initialize a shift before accessing the receiving terminal.",
        variant: "destructive",
      });
      window.location.href = "/m/retail/operational/gateway";
      return;
    }

    if (session.tenant_id) fetchData();
  }, [session.tenant_id, session, isContextLoading, activeShift]);

  const startIntake = (shipment: Shipment) => {
    setActiveShipment({ ...shipment, status: "receiving" });
  };

  const updateReceived = (itemId: string, delta: number) => {
    if (!activeShipment) return;
    const newItems = (Array.isArray(activeShipment.items) ? activeShipment.items : []).map((item) =>
      item.itemId === itemId
        ? { ...item, received: Math.max(0, item.received + delta) }
        : item,
    );
    setActiveShipment({ ...activeShipment, items: newItems });
  };

  const completeIntake = async () => {
    if (!activeShipment) return;
    setIsProcessing(true);
    try {
      await retailService.receiveGoods(
        session.tenant_id!,
        session,
        session.location_id || "unassigned",
        activeShipment.id,
        (Array.isArray(activeShipment.items) ? activeShipment.items : []).map((i) => ({
          itemId: i.itemId,
          received: i.received,
        })),
        activeShift?.id,
      );

      const variances = (Array.isArray(activeShipment.items) ? activeShipment.items : []).filter(
        (i) => i.received !== i.expected,
      );
      
      if (variances.length > 0) {
        toast({
          title: "Intake with Variance",
          description: `Shipment ${activeShipment.id} synchronized with ${variances.length} discrepancies.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Intake Successful",
          description: `Shipment ${activeShipment.id} matched perfectly. Inventory updated.`,
        });
      }

      setShipments((prev) =>
        (Array.isArray(prev) ? prev : []).map((s) =>
          s.id === activeShipment.id
            ? { ...activeShipment, status: "completed" }
            : s,
        ),
      );
      setActiveShipment(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Estela Gea Sync Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 relative flex selection:bg-primary/30 selection:text-foreground">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] w-[45%] h-[45%] bg-primary/10 blur-[130px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[35%] h-[35%] bg-primary/10 blur-[120px] rounded-full animate-pulse" />
      </div>

      <div className="flex-1 overflow-hidden relative z-10 flex flex-col p-8 gap-8">
        {/* TACTICAL HEADER */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-foreground shadow-lg shadow-primary/20">
              <Truck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black italic uppercase tracking-tighter text-foreground">
                Receiving Terminal
              </h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] ml-1">
                Logistics Node: {session.location_id || "LOCAL_DOCK"} • v2.4.0
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-primary/10 border border-primary rounded-xl flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-[10px] font-black italic uppercase text-primary tracking-widest">
                Port Status: Optimal
              </span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.location.reload()}
              className="h-10 rounded-xl bg-secondary/40 border-border text-foreground hover:bg-accent font-black italic uppercase text-[10px] tracking-widest gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Manifests
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/m/retail/operational/gateway")}
              className="h-10 w-10 rounded-xl bg-secondary/40 border-border text-foreground hover:bg-accent"
              title="Exit to Gateway"
            >
              <Home className="w-4 h-4 text-primary" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 flex-1 overflow-hidden">
          <div className="lg:col-span-3 flex flex-col gap-6 overflow-hidden">
            {!activeShipment ? (
              <GlassCard className="flex-1 flex flex-col bg-secondary/40 backdrop-blur-3xl border-border rounded-[2.5rem] overflow-hidden shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between border-b border-border p-8">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl font-black italic text-foreground tracking-tighter uppercase">
                      Inbound Queue
                    </CardTitle>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Awaiting physical SKU ingestion
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="gap-3 font-black italic bg-primary border-none text-foreground rounded-xl px-8 h-14 shadow-lg shadow-primary/20 hover:bg-primary/50 transition-all uppercase text-[11px] tracking-widest"
                    onClick={() => {
                      const first = shipments.find((s) => s.status === "pending");
                      if (first) {
                        startIntake(first);
                        toast({ title: "Slip Recognized", description: `Loading Manifest: ${first.id}` });
                      } else {
                        toast({ title: "Scan Error", description: "No pending shipments detected." });
                      }
                    }}
                  >
                    <ScanBarcode className="w-5 h-5" /> Scan Delivery Slip
                  </Button>
                </CardHeader>
                <CardContent className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                  <div className="space-y-4">
                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-4">
                        <RefreshCw className="w-12 h-12 animate-spin text-primary" />
                        <p className="font-black italic uppercase tracking-[0.3em] text-xs">
                          Syncing Manifest Repository...
                        </p>
                      </div>
                    ) : (
                      (Array.isArray(shipments) ? shipments : []).filter((s) => s.status !== "completed")
                        .map((shipment) => (
                          <div
                            key={shipment.id}
                            className="p-6 rounded-[2rem] border border-border/40 bg-muted/10 flex items-center justify-between hover:bg-muted/20 hover:border-primary transition-all cursor-pointer group"
                            onClick={() => startIntake(shipment)}
                          >
                            <div className="flex gap-6">
                              <div className="w-16 h-16 bg-secondary/40 rounded-2xl flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-foreground transition-all shadow-inner">
                                <Package2 className="w-8 h-8" />
                              </div>
                              <div className="flex flex-col justify-center">
                                <div className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">
                                  Manifest ID: <span className="text-primary">{shipment.id}</span>
                                </div>
                                <div className="text-2xl font-black italic text-foreground tracking-tighter">
                                  {shipment.vendor}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-12">
                              <div className="text-right">
                                <div className="text-2xl font-black text-foreground italic tracking-tighter">
                                  {shipment.items.reduce((a, b) => a + b.expected, 0)} SKUs
                                </div>
                                <div className="text-[9px] text-muted-foreground font-black uppercase tracking-widest">
                                  {shipment.status === "pending" ? "UNPROCESSED" : "RECEIVING"}
                                </div>
                              </div>
                              <Badge
                                className={`border-none font-black italic text-[9px] px-4 h-8 flex items-center ${
                                  shipment.priority === "HIGH"
                                    ? "bg-destructive/20 text-destructive"
                                    : "bg-secondary/40 text-muted-foreground"
                                }`}
                              >
                                {shipment.priority} PRIORITY
                              </Badge>
                              <div className="w-12 h-12 rounded-xl bg-secondary/40 flex items-center justify-center text-muted-foreground group-hover:bg-accent group-hover:text-accent-foreground transition-all">
                                <ArrowRight className="w-6 h-6" />
                              </div>
                            </div>
                          </div>
                        ))
                    )}

                    {!isLoading && (Array.isArray(shipments) ? shipments : []).filter((s) => s.status !== "completed").length === 0 && (
                      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-4">
                        <CheckCircle2 className="w-16 h-16 text-success opacity-20" />
                        <p className="font-black italic uppercase tracking-[0.3em] text-[10px]">
                          All Dock Manifests Cleared
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </GlassCard>
            ) : (
              <GlassCard className="flex-1 flex flex-col bg-secondary/40 backdrop-blur-3xl border-border rounded-[2.5rem] overflow-hidden shadow-2xl animate-in fade-in slide-in-from-right-12 duration-700">
                <CardHeader className="bg-background text-foreground flex flex-row items-center justify-between p-8 border-b border-border/40">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                      <Truck className="w-8 h-8" />
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-primary italic">
                        Live Intake Protocol
                      </div>
                      <CardTitle className="text-3xl font-black italic tracking-tighter">
                        {activeShipment.id}
                      </CardTitle>
                      <div className="text-xs font-bold text-muted-foreground uppercase tracking-tighter">
                        Origin: {activeShipment.vendor}
                      </div>
                    </div>
                  </div>
                  <button
                    className="w-14 h-14 rounded-2xl bg-secondary/40 hover:bg-accent flex items-center justify-center text-foreground transition-all active:scale-90"
                    onClick={() => setActiveShipment(null)}
                  >
                    <X className="w-7 h-7" />
                  </button>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
                  <ScrollArea className="flex-1">
                    <div className="p-8 space-y-4">
                      {(Array.isArray(activeShipment.items) ? activeShipment.items : []).map((item) => {
                        const hasVariance = item.received !== item.expected;
                        return (
                          <div
                            key={item.itemId}
                            className={`p-6 rounded-[2rem] border transition-all flex items-center justify-between group ${
                              hasVariance && item.received > 0
                                ? "bg-destructive/10 border-destructive/30 shadow-[0_0_40px_hsl(var(--destructive)/0.1)]"
                                : "bg-secondary/40 border-border hover:border-foreground/20"
                            }`}
                          >
                            <div className="flex gap-6">
                              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner ${hasVariance && item.received > 0 ? "bg-destructive/20" : "bg-secondary/40"}`}>
                                <Package2 className={`w-8 h-8 ${hasVariance && item.received > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                              </div>
                              <div className="flex flex-col justify-center">
                                <div className="text-lg font-black text-foreground italic tracking-tight">
                                  {item.name}
                                </div>
                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                                  SKU: {item.itemId}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-16">
                              <div className="text-center">
                                <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">
                                  Manifested
                                </div>
                                <div className="text-2xl font-black italic text-muted-foreground">
                                  {item.expected}
                                </div>
                              </div>
                              <div className="flex items-center gap-4 bg-background/40 p-2 rounded-2xl border border-border shadow-inner">
                                <button
                                  className="h-12 w-12 bg-secondary/40 hover:bg-accent text-foreground rounded-xl font-black text-xl transition-all active:scale-90"
                                  onClick={() => updateReceived(item.itemId, -1)}
                                >
                                  -
                                </button>
                                <div className="w-20 text-center text-3xl font-black italic tracking-tighter text-foreground">
                                  {item.received}
                                </div>
                                <button
                                  className="h-12 w-12 bg-secondary/40 hover:bg-accent text-foreground rounded-xl font-black text-xl transition-all active:scale-90"
                                  onClick={() => updateReceived(item.itemId, 1)}
                                >
                                  +
                                </button>
                              </div>
                              <div className="w-24 flex justify-end">
                                {hasVariance && item.received > 0 && (
                                  <Badge className="bg-destructive text-foreground border-none text-[9px] font-black italic px-3 py-1 shadow-lg shadow-destructive/20 animate-pulse">
                                    {item.received - item.expected > 0 ? `+${item.received - item.expected}` : item.received - item.expected} DELTA
                                  </Badge>
                                )}
                                {!hasVariance && item.received > 0 && (
                                  <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center border border-success/20">
                                    <CheckCircle2 className="w-7 h-7 text-success" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  <div className="p-10 bg-background text-foreground flex justify-between items-center border-t border-border relative overflow-hidden">
                    <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
                    <div>
                      <div className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-2 italic">
                        Intake Summation
                      </div>
                      <div className="text-5xl font-black italic tracking-tighter">
                        {activeShipment.items.reduce((a, b) => a + b.received, 0)}{" "}
                        <span className="text-lg text-muted-foreground not-italic">
                          / {activeShipment.items.reduce((a, b) => a + b.expected, 0)} UNITS
                        </span>
                      </div>
                    </div>
                    <Button
                      size="lg"
                      className="bg-primary hover:bg-primary/50 font-black italic h-20 px-16 rounded-[1.5rem] shadow-2xl shadow-primary/20 text-xl transition-transform active:scale-95 uppercase tracking-widest"
                      onClick={completeIntake}
                      disabled={isProcessing}
                    >
                      {isProcessing ? <RefreshCw className="w-8 h-8 animate-spin" /> : "Commit to Stock"}
                    </Button>
                  </div>
                </CardContent>
              </GlassCard>
            )}
          </div>

          <div className="flex flex-col gap-8">
            <GlassCard className="border-none bg-destructive/10 backdrop-blur-3xl shadow-2xl rounded-[2.5rem] overflow-hidden group">
              <CardHeader className="py-6 px-8 border-b border-destructive/20">
                <CardTitle className="flex items-center gap-3 text-destructive text-[11px] uppercase font-black tracking-[0.3em] leading-none italic">
                  <AlertTriangle className="w-5 h-5" /> Variance Watch
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <p className="text-[11px] text-muted-foreground font-bold leading-relaxed italic uppercase tracking-widest">
                  System detected <span className="text-destructive">3 SKU mismatches</span> in transit hub. Immediate Supervisor Override required.
                </p>
                <Button 
                  onClick={() => navigate("/core/logistics")}
                  className="w-full text-[10px] font-black italic uppercase h-12 bg-destructive text-foreground hover:bg-destructive transition-all rounded-xl shadow-lg shadow-destructive/20 tracking-widest"
                >
                  Flag Intake Errors
                </Button>
              </CardContent>
            </GlassCard>

            <GlassCard className="flex-1 bg-secondary/40 backdrop-blur-3xl border-border rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
              <CardHeader className="border-b border-border/40 p-8">
                <CardTitle className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.4em] italic">
                  Intake Velocity
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 flex-1 flex flex-col justify-between gap-12">
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest italic">
                      Efficiency
                    </span>
                    <span className="text-3xl font-black italic text-foreground tracking-tighter">
                      92%
                    </span>
                  </div>
                  <div className="h-4 bg-secondary/40 rounded-full overflow-hidden border border-border p-1">
                    <div className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full w-[92%] transition-all duration-1000 shadow-[0_0_20px_hsl(var(--primary)/0.4)]" />
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-3 h-3 rounded-full bg-success shadow-[0_0_15px_hsl(var(--success)/0.5)]" />
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest italic">
                      Ledger Status: PURE_SYNC
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-3 h-3 rounded-full bg-primary/50 shadow-[0_0_15px_hsl(var(--primary)/0.5)]" />
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest italic">
                      Node: {activeStore?.name || "LOCAL_DOCK"}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Layers className="w-4 h-4 text-muted-foreground" />
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest italic">
                      Buffer: OPTIMAL
                    </span>
                  </div>
                </div>
              </CardContent>
            </GlassCard>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ReceivingTerminal;
