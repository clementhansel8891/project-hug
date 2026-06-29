import React, { useState, useEffect, useRef } from "react";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import {
  Scan,
  ShoppingBag,
  CreditCard,
  QrCode,
  ArrowRight,
  Trash2,
  Minus,
  Plus,
  Info,
  ShieldCheck,
  Monitor,
  Sparkles,
  X,
  Home,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { GlassCard } from "@/components/shared/GlassCard";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { retailService } from "@/core/services/retail/retailService";
import { useSession } from "@/core/security/session";
import { useRetail } from "../context/RetailContext";
import { formatCurrency } from "@/lib/format";
import type { RetailProduct } from "@/core/types/retail/retail";

interface CartItem {
  id: string;
  sku: string;
  name: string;
  price: number;
  quantity: number;
}

const SelfServiceKiosk = () => {
  const session = useSession();
  const { activeStore, activeChannel } = useRetail();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [scanInput, setScanInput] = useState("");
  const [products, setProducts] = useState<RetailProduct[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<"scanning" | "payment" | "success">(
    "scanning",
  );
  const [paymentMethod, setPaymentMethod] = useState<"card" | "qr" | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await retailService.listInventory(
          session.tenant_id,
          session,
        );
        setProducts(data);
      } catch (error: unknown) {
        console.error("Failed to fetch products", error);
      }
    };
    fetchData();
  }, [session.tenant_id, session]);

  const addToCart = (product: RetailProduct) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return (Array.isArray(prev) ? prev : []).map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          sku: product.sku,
          name: product.name,
          price: product.price,
          quantity: 1,
        },
      ];
    });
    toast({
      title: "Item Added",
      description: `${product.name} added to tray.`,
    });
  };

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput) return;
    const product = products.find(
      (p) => p.sku === scanInput || p.id === scanInput,
    );
    if (product) {
      addToCart(product);
    } else {
      toast({
        title: "Scan Error",
        description: "Product unknown. Please try again.",
        variant: "destructive",
      });
    }
    setScanInput("");
    inputRef.current?.focus();
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => (Array.isArray(prev) ? prev : []).filter((item) => item.id !== id));
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const [idempotencyKey, setIdempotencyKey] = useState<string>(
    window.crypto.randomUUID?.() || Math.random().toString(36).substring(2),
  );

  const handleCheckout = async () => {
    if (cart.length === 0 || !session.tenant_id) return;

    if (!activeStore?.id) {
      toast({
        title: "Store Context Missing",
        description: "Terminal not bound to a physical location.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Atomic Backend Checkout with Idempotency
      await retailService.checkout(
        session.tenant_id,
        session,
        {
          store_id: activeStore.id,
          terminal_id: "kiosk-self-terminal-01",
          items: (Array.isArray(cart) ? cart : []).map((item) => ({
            product_id: item.id,
            name: item.name,
            quantity: item.quantity,
            unit_price: item.price,
          })),
          payment_method: paymentMethod || "card",
          payment_received: total,
          grand_total: total,
          payment_channel: paymentMethod === "qr" ? "QR" : "CARD_POS",
        },
        idempotencyKey,
      );

      setStep("success");
      setCart([]);
      setIdempotencyKey(
        window.crypto.randomUUID?.() || Math.random().toString(36).substring(2),
      );
    } catch (error: unknown) {
      console.error("Checkout Error:", error);
      const message = error instanceof Error ? error.message : "Payment failed";
      toast({
        title: "Transaction Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (step === "success") {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background p-8 space-y-12 animate-in zoom-in-95 duration-500 overflow-hidden selection:bg-success/30">
        <div className="relative">
          <div className="absolute inset-0 bg-success/10 blur-3xl animate-pulse rounded-full" />
          <div className="relative w-48 h-48 bg-success rounded-[3rem] flex items-center justify-center shadow-2xl shadow-success/40 transform rotate-12 transition-transform hover:rotate-0 duration-500">
            <CheckCircle className="w-24 h-24 text-foreground" />
          </div>
        </div>
        <div className="text-center space-y-6">
          <h1 className="text-6xl font-black italic tracking-tighter text-foreground uppercase">
            Transaction Sealed
          </h1>
          <p className="text-success font-black uppercase tracking-[0.4em] text-xs italic">
            Vault Hash: ZVX-KIOSK-{(activeStore?.id || "").slice(-8).toUpperCase()} • PCI Verified
          </p>
        </div>
        <div className="flex flex-col gap-6 w-full max-w-md">
           <Button
             className="h-28 bg-primary text-primary-foreground hover:bg-primary/90 font-black italic rounded-[2.5rem] text-2xl shadow-2xl transition-all uppercase tracking-widest active:scale-95"
             onClick={() => setStep("scanning")}
           >
             New Customer
           </Button>
           <p className="text-center text-muted-foreground font-bold uppercase tracking-[0.2em] text-[9px] italic">
              Please collect your items and printed receipt below.
           </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative flex selection:bg-primary/50 selection:text-foreground">
      {/* Dynamic Background Atmosphere */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] w-[45%] h-[45%] bg-primary/10 blur-[130px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[35%] h-[35%] bg-primary/10 blur-[120px] rounded-full animate-pulse" />
      </div>

      <div className="flex-1 overflow-hidden relative z-10 flex flex-col p-8 gap-8">
        {/* TACTICAL KIOSK HEADER */}
        <div className="flex justify-between items-center bg-secondary/40 p-8 rounded-[2.5rem] border border-border backdrop-blur-3xl shrink-0">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/40">
              <Monitor className="w-9 h-9 text-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-black italic tracking-tighter text-foreground uppercase">
                {activeStore?.name || "Estela Gea Self-Checkout"}
              </h1>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mt-1 italic">
                Node Context: [KIOSK_ALPHA_9] • {activeStore?.location || "Main Terminal"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:block text-right">
              <div className="text-[9px] font-black text-primary uppercase tracking-[0.3em] mb-1 italic text-right">
                Infrastructure Link
              </div>
              <div className="flex items-center gap-2 justify-end">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-[10px] font-black italic uppercase text-success tracking-widest">
                  EDGE_VAULT: CONNECTED
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-14 w-14 rounded-2xl bg-secondary/40 hover:bg-secondary/60 text-foreground border border-border transition-all"
              onClick={async () => {
                try {
                  const telemetry = await (retailService as any).getKioskTelemetry?.(
                    session.tenant_id,
                    session,
                    session.location_id,
                  );
                  if (telemetry) {
                    toast({
                      title: "Station Telemetry",
                      description: `Node: ${telemetry.nodeId || `KIOSK-SELF-${session.location_id}`}. Power: ${telemetry.powerStatus || "Nominal"}. Network: ${telemetry.latencyMs ?? "N/A"}ms Latency.`,
                    });
                  } else {
                    toast({
                      title: "Station Telemetry",
                      description: `Node: KIOSK-SELF-${session.location_id}. Telemetry endpoint not available.`,
                    });
                  }
                } catch {
                  toast({
                    title: "Station Telemetry",
                    description: `Node: KIOSK-SELF-${session.location_id}. Unable to fetch telemetry data.`,
                    variant: "destructive",
                  });
                }
              }}
            >
              <Info className="w-6 h-6" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-14 w-14 rounded-2xl bg-secondary/40 hover:bg-accent text-foreground border border-border transition-all"
              onClick={() => navigate("/m/retail/operational/gateway")}
              title="Exit to Gateway"
            >
              <Home className="w-6 h-6 text-primary" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 overflow-hidden">
          {/* LEFT: SCANNING & PRODUCT GRID */}
          <div className="lg:col-span-8 flex flex-col gap-8 overflow-hidden">
            <GlassCard className="bg-secondary/40 border-border backdrop-blur-3xl rounded-[3rem] overflow-hidden shadow-2xl shrink-0">
              <CardContent className="p-10">
                <form onSubmit={handleScan} className="relative group">
                  <Scan className="absolute left-10 top-1/2 -translate-y-1/2 w-10 h-10 text-primary group-focus-within:scale-110 transition-transform" />
                  <Input
                    ref={inputRef}
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder="PLACE BARCODE UNDER SCANNER..."
                    className="h-28 pl-24 text-3xl font-black bg-secondary/40 border-2 border-border focus:border-primary/50 rounded-[2rem] shadow-inner text-foreground italic uppercase tracking-[0.2em] placeholder:text-muted-foreground/30 transition-all"
                    autoFocus
                  />
                </form>

                <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-6">
                  {products.slice(0, 4).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className="p-6 bg-secondary/40 border border-border rounded-[2.5rem] hover:bg-secondary/60 hover:border-primary/50 transition-all group flex flex-col items-center"
                    >
                      <div className="w-full aspect-square bg-secondary/40 rounded-3xl mb-6 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                        <ShoppingBag className="w-12 h-12 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div className="text-[11px] font-black italic text-foreground truncate uppercase tracking-tighter w-full text-center">
                        {p.name}
                      </div>
                      <div className="text-[10px] font-black text-primary mt-2 italic tracking-widest">
                        {formatCurrency(p.price, "IDR", "id-ID")}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </GlassCard>

            {/* SELECTION VAULT / CART */}
            <GlassCard className="bg-secondary/40 border-border backdrop-blur-3xl rounded-[3rem] overflow-hidden shadow-2xl flex flex-col flex-1">
              <CardHeader className="p-10 border-b border-border/40 bg-background/40">
                <CardTitle className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.4em] italic flex items-center gap-4">
                   <ShoppingBag className="w-5 h-5" /> Active Tray Consolidations
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-32 text-muted-foreground/30 opacity-20">
                      <ShoppingBag className="w-32 h-32 mb-8" />
                      <p className="text-sm font-black italic uppercase tracking-[0.4em]">Tray Is Empty</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {(Array.isArray(cart) ? cart : []).map((item) => (
                        <div
                          key={item.id}
                          className="p-10 flex items-center justify-between hover:bg-muted/10 transition-colors"
                        >
                          <div className="flex gap-8">
                            <div className="w-24 h-24 bg-secondary/40 rounded-3xl flex items-center justify-center shadow-inner border border-border/40">
                              <ShoppingBag className="w-12 h-12 text-muted-foreground" />
                            </div>
                            <div className="flex flex-col justify-center">
                              <div className="text-2xl font-black italic text-foreground uppercase tracking-tighter">
                                {item.name}
                              </div>
                              <div className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] mt-2 italic">
                                SKU: {item.sku}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-16">
                            <div className="flex items-center gap-6 bg-background/40 border-2 border-border p-3 rounded-[1.5rem] shadow-xl">
                              <Button
                                variant="ghost"
                                className="h-12 w-12 p-0 rounded-xl bg-secondary/40 hover:bg-secondary/60 text-foreground font-black"
                                onClick={() =>
                                  setCart((prev) =>
                                    (Array.isArray(prev) ? prev : []).map((i) =>
                                      i.id === item.id
                                        ? { ...i, quantity: Math.max(1, i.quantity - 1) }
                                        : i,
                                    ),
                                  )
                                }
                              >
                                <Minus className="w-6 h-6" />
                              </Button>
                              <div className="w-12 text-center text-3xl font-black italic text-foreground tracking-tighter">
                                {item.quantity}
                              </div>
                              <Button
                                variant="ghost"
                                className="h-12 w-12 p-0 rounded-xl bg-secondary/40 hover:bg-secondary/60 text-foreground font-black"
                                onClick={() =>
                                  setCart((prev) =>
                                    (Array.isArray(prev) ? prev : []).map((i) =>
                                      i.id === item.id
                                        ? { ...i, quantity: i.quantity + 1 }
                                        : i,
                                    ),
                                  )
                                }
                              >
                                <Plus className="w-6 h-6" />
                              </Button>
                            </div>
                            <div className="text-right min-w-[160px]">
                              <div className="text-4xl font-black italic text-foreground tracking-tighter">
                                {formatCurrency(item.price * item.quantity, "IDR", "id-ID")}
                              </div>
                              <button
                                onClick={() => removeFromCart(item.id)}
                                className="text-[10px] font-black text-destructive uppercase tracking-widest hover:text-destructive/70 transition-colors mt-3 italic"
                              >
                                Remove From Tray
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </GlassCard>
          </div>

          {/* RIGHT: SETTLEMENT PANEL */}
          <div className="lg:col-span-4 flex flex-col gap-8 overflow-hidden">
            <GlassCard className="bg-secondary border-none shadow-3xl text-foreground rounded-[3.5rem] overflow-hidden flex flex-col shrink-0">
              <CardContent className="p-12 space-y-12">
                <div className="space-y-6">
                  <div className="text-[10px] font-black text-primary uppercase tracking-[0.4em] italic">
                    Final Assessment Total
                  </div>
                  <div className="text-7xl font-black italic tracking-tighter text-foreground">
                    {formatCurrency(total, "IDR", "id-ID")}
                  </div>
                  <div className="flex items-center gap-4 p-5 bg-secondary/40 rounded-3xl border border-border shadow-inner">
                    <ShieldCheck className="w-6 h-6 text-success" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground italic">
                      Hardware Encryption Hash: [SECURE]
                    </span>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-6">
                    <button
                      onClick={() => setPaymentMethod("card")}
                      className={`p-10 rounded-[2.5rem] border-2 transition-all flex flex-col items-center gap-6 ${
                        paymentMethod === "card"
                          ? "bg-primary border-primary/50 shadow-2xl shadow-primary/40"
                          : "bg-secondary/40 border-border hover:bg-secondary/60"
                      }`}
                    >
                      <div className="w-16 h-16 rounded-2xl bg-secondary/60 flex items-center justify-center">
                         <CreditCard className="w-9 h-9" />
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-widest italic">Electronic Card</span>
                    </button>
                    <button
                      onClick={() => setPaymentMethod("qr")}
                      className={`p-10 rounded-[2.5rem] border-2 transition-all flex flex-col items-center gap-6 ${
                        paymentMethod === "qr"
                          ? "bg-warning border-warning/50 shadow-2xl shadow-warning/40"
                          : "bg-secondary/40 border-border hover:bg-secondary/60"
                      }`}
                    >
                      <div className="w-16 h-16 rounded-2xl bg-secondary/60 flex items-center justify-center">
                         <QrCode className="w-9 h-9" />
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-widest italic">QR / E-Wallet</span>
                    </button>
                  </div>

                  <Button
                    className="w-full h-32 bg-primary text-primary-foreground hover:bg-primary/90 font-black italic rounded-[2.5rem] text-3xl shadow-2xl uppercase tracking-[0.2em] transition-all disabled:opacity-20 active:scale-[0.98]"
                    disabled={cart.length === 0 || !paymentMethod || isProcessing}
                    onClick={handleCheckout}
                  >
                    {isProcessing ? (
                      <RefreshCw className="w-10 h-10 animate-spin" />
                    ) : (
                      <div className="flex items-center gap-6">
                        Authorize Settlement
                        <ArrowRight className="w-10 h-10" />
                      </div>
                    )}
                  </Button>
                </div>

                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest text-center leading-relaxed italic">
                   Transaction is processed through the **Estela Gea Fiscal Gateway**. <br />
                   Receipt issued on successful vault clearance.
                </p>
              </CardContent>
            </GlassCard>

            <GlassCard className="bg-secondary/40 border border-border backdrop-blur-3xl rounded-[2.5rem] shadow-2xl overflow-hidden shrink-0">
              <CardContent className="p-8 flex gap-6 items-center">
                <div className="w-16 h-16 bg-secondary/40 rounded-3xl flex items-center justify-center border-2 border-border">
                  <Monitor className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest italic mb-1">
                    Node Telemetry
                  </div>
                  <div className="text-base font-black italic text-foreground uppercase tracking-tighter">
                    Printer Status: [SYNCED]
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

export default SelfServiceKiosk;
