import React, { useState, useEffect, useRef } from "react";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import {
  ScanLine,
  Box,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  History,
  RefreshCw,
  Layers,
  ShieldCheck,
  Search,
} from "lucide-react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { retailService } from "@/core/services/retail/retailService";
import { useSession } from "@/core/security/session";
import { useRetail } from "../context/RetailContext";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RetailShift, RetailProduct } from "@/core/types/retail/retail";
import { useAuth } from "@/contexts/AuthContext";
import { StockOpnameSummaryModal } from "@/components/shared/StockOpnameSummaryModal";
import { UnresolvedBarcodesModal } from "@/components/shared/UnresolvedBarcodesModal";
import { saveOpnameSession, loadOpnameSession, clearOpnameSession } from "@/core/services/opname/sessionPersistence";

interface ScanEntry {
  id?: string;
  sku: string;
  name: string;
  systemCount: number;
  actualCount: number;
  timestamp: string;
  serials?: string[];
}

const StockOpnameScanner = ({ noShell = false }: { noShell?: boolean }) => {
  const session = useSession();
  const { user } = useAuth();
  const { activeStore, activeChannel, activeShift, isLoading: isContextLoading } = useRetail();
  const [scanInput, setScanInput] = useState("");
  const [products, setProducts] = useState<RetailProduct[]>([]);
  const [history, setHistory] = useState<ScanEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [unresolvedBarcodes, setUnresolvedBarcodes] = useState<string[]>([]);
  const [isUnresolvedOpen, setIsUnresolvedOpen] = useState(false);
  const [cycleId, setCycleId] = useState<string | null>(null);
  const navigate = React.useMemo(() => (path: string) => window.location.href = path, []);
  const inputRef = useRef<HTMLInputElement>(null);

  const [serializationMode, setSerializationMode] = useState(false);
  const [targetSku, setTargetSku] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const data = await retailService.listInventory(
          session.tenant_id,
          session,
          { locationId: activeStore?.id || session.location_id }
        );
        setProducts(data);
      } catch (error) {
        console.error("Failed to fetch inventory", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (!isContextLoading && !activeShift) {
       toast({
        title: "Fiscal Gate Active",
        description: "Please initialize a shift before accessing the audit terminal.",
        variant: "destructive",
      });
      window.location.href = "/m/retail/operational/gateway";
      return;
    }

    if (session.tenant_id && activeStore?.id) {
      // Load existing session if available
      const savedSession = loadOpnameSession(session.tenant_id);
      if (savedSession) {
        setHistory(savedSession.entries);
        setUnresolvedBarcodes(savedSession.unresolvedBarcodes);
        setCycleId(savedSession.cycleId);
      }
      fetchData();
    }
  }, [session.tenant_id, session, isContextLoading, activeShift, activeStore?.id]);

  // Save session state whenever history or unresolved barcodes change
  useEffect(() => {
    if (session.tenant_id && activeStore?.id && cycleId) {
      saveOpnameSession({
        cycleId,
        locationId: activeStore.id,
        entries: [...history],
        unresolvedBarcodes: [...unresolvedBarcodes],
        anomalies: [],
        newItems: [],
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      }, session.tenant_id);
    }
  }, [history, unresolvedBarcodes, session.tenant_id, activeStore?.id, cycleId]);

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput) return;

    if (serializationMode) {
      if (!targetSku) {
        toast({ title: "Target Missing", description: "Select a Product SKU first before serial scanning.", variant: "destructive" });
        return;
      }

      const product = products.find(p => p.sku === targetSku);
      if (!product) return;

      setHistory((prev) => {
        const existingIdx = prev.findIndex((h) => h.sku === product.sku);
        const currentSerial = scanInput.trim();

        if (existingIdx > -1) {
          const newHistory = [...prev];
          const entry = newHistory[existingIdx];
          
          // Check if serial already scanned in this session
          const alreadyScanned = entry.serials?.includes(currentSerial);
          if (alreadyScanned) {
            toast({ title: "Duplicate Serial", description: `Serial ${currentSerial} already scanned.`, variant: "warning" });
            return prev;
          }

          newHistory[existingIdx] = {
            ...entry,
            actualCount: entry.actualCount + 1,
            serials: [...(entry.serials || []), currentSerial],
            timestamp: new Date().toLocaleTimeString(),
          };
          return newHistory;
        }

        return [
          {
            id: product.id,
            sku: product.sku,
            name: product.name,
            systemCount: product.stock || 0,
            actualCount: 1,
            serials: [currentSerial],
            timestamp: new Date().toLocaleTimeString(),
          },
          ...prev,
        ];
      });

      toast({ title: "Unique Unit Added", description: `Serial: ${scanInput} registered to ${product.name}` });
    } else {
      const product = products.find(
        (p) => p.sku === scanInput || p.id === scanInput || p.barcode === scanInput,
      );
      if (product) {
        setHistory((prev) => {
          const existingIdx = prev.findIndex((h) => h.sku === product.sku);
          if (existingIdx > -1) {
            const newHistory = [...prev];
            newHistory[existingIdx] = {
              ...newHistory[existingIdx],
              actualCount: newHistory[existingIdx].actualCount + 1,
              timestamp: new Date().toLocaleTimeString(),
            };
            return newHistory;
          }
          return [
            {
              id: product.id,
              sku: product.sku,
              name: product.name,
              systemCount: product.stock || 0,
              actualCount: 1,
              timestamp: new Date().toLocaleTimeString(),
            },
            ...prev,
          ];
        });
        toast({ title: "Item Scanned", description: `Scanned: ${product.name}` });
      } else {
        // Add unregistered barcode to unresolved list instead of showing error toast
        if (!unresolvedBarcodes.includes(scanInput)) {
          setUnresolvedBarcodes(prev => [...prev, scanInput]);
          toast({
            title: "Unregistered Barcode Added",
            description: `Barcode: ${scanInput} added to unresolved list.`,
          });
        } else {
          toast({
            title: "Duplicate Unregistered",
            description: `Barcode: ${scanInput} already in unresolved list.`,
            variant: "warning",
          });
        }
      }
    }
    setScanInput("");
    inputRef.current?.focus();
  };

  const totalVarianceCount = (Array.isArray(history) ? history : []).filter(
    (item) => item.actualCount !== item.systemCount,
  ).length;

  const handleSubmit = async () => {
    if (history.length === 0) return;
    
    if (unresolvedBarcodes.length > 0) {
      setIsUnresolvedOpen(true);
    } else {
      setIsSummaryOpen(true);
    }
  };

  const handleFinalConfirm = async () => {
    if (history.length === 0) return;
    setIsSubmitting(true);
    try {
      const adjustments = (Array.isArray(history) ? history : []).flatMap((h) => {
        if (h.serials && h.serials.length > 0) {
          return h.serials.map(s => ({ 
            sku: h.sku, 
            actualCount: 1,
            serial_number: s,
            product_id: h.id
          } as const));
        }
        return [{ product_id: h.id, sku: h.sku, actualCount: h.actualCount } as const];
      });

      await retailService.submitOpname(
        session.tenant_id!,
        session,
        activeStore?.id || session.location_id || "unassigned",
        adjustments,
        activeShift?.id,
      );
      setHistory([]);
      setUnresolvedBarcodes([]);
      setSerializationMode(false);
      
      // Clear session after successful commit
      if (session.tenant_id && activeStore?.id) {
        clearOpnameSession(session.tenant_id);
      }
    } catch (error: unknown) {
      console.error(error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFlagAnomalies = (barcodes: string[]) => {
    setUnresolvedBarcodes(prev => prev.filter(b => !barcodes.includes(b)));
    toast({ title: "Anomalies Flagged", description: `${barcodes.length} barcodes flagged for review.` });
    
    // Save session state after flagging anomalies
    if (session.tenant_id && activeStore?.id && cycleId) {
      saveOpnameSession({
        cycleId,
        locationId: activeStore.id,
        entries: [...history],
        unresolvedBarcodes: unresolvedBarcodes.filter(b => !barcodes.includes(b)),
        anomalies: [...barcodes],
        newItems: [],
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      });
    }
    
    if (unresolvedBarcodes.length - barcodes.length === 0) {
      setIsUnresolvedOpen(false);
      setIsSummaryOpen(true);
    }
  };

  const handleItemsRegistered = (createdItems: any[]) => {
    const barcodes = createdItems.map(item => item.barcode);
    setUnresolvedBarcodes(prev => prev.filter(b => !barcodes.includes(b)));
    
    // Save session state after registering items
    if (session.tenant_id && activeStore?.id && cycleId) {
      saveOpnameSession({
        cycleId,
        locationId: activeStore.id,
        entries: [...history],
        unresolvedBarcodes: unresolvedBarcodes.filter(b => !barcodes.includes(b)),
        anomalies: [...barcodes],
        newItems: [...createdItems],
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      });
    }
    
    if (unresolvedBarcodes.length - barcodes.length === 0) {
      setIsUnresolvedOpen(false);
      setIsSummaryOpen(true);
    }
  };

  // Save session state when removing from history
  const handleRemoveEntry = (index: number) => {
    setHistory(prev => {
      const newHistory = prev.filter((_, i) => i !== index);
      
      // Save session state after removal
      if (session.tenant_id && activeStore?.id && cycleId) {
        saveOpnameSession({
          cycleId,
          locationId: activeStore.id,
          entries: newHistory,
          unresolvedBarcodes: [...unresolvedBarcodes],
          anomalies: [],
          newItems: [],
          createdAt: Date.now(),
          lastUpdated: Date.now(),
        });
      }
      
      return newHistory;
    });
  };

  const content = (
    <div className="flex-1 flex flex-col gap-8 overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 flex-1 overflow-hidden">
        <div className="lg:col-span-3 flex flex-col gap-8 overflow-hidden">
          <GlassCard className="bg-card/40 backdrop-blur-2xl border-border rounded-[3rem] overflow-hidden shadow-2xl relative">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
              <Layers className="w-64 h-64 text-primary" />
            </div>
            <CardContent className="p-16">
              <form
                onSubmit={handleScan}
                className="flex flex-col items-center justify-center space-y-12 max-w-2xl mx-auto"
              >
                <div className="w-40 h-40 bg-primary rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-primary/30 relative transform hover:scale-105 transition-transform group">
                  <ScanLine className="w-20 h-20 text-primary-foreground animate-pulse" />
                  <div className="absolute -bottom-4 -right-4 w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center text-primary shadow-xl border-2 border-border">
                    <RefreshCw className="w-6 h-6" />
                  </div>
                </div>
                
                <div className="text-center">
                  <h3 className="text-4xl font-black text-foreground tracking-tighter italic uppercase">
                    {activeStore?.name || "RETAIL AUDIT TERMINAL"}
                  </h3>
                  <p className="text-[10px] text-primary font-black tracking-[0.4em] uppercase mt-2 italic opacity-80">
                    Scanning Zone: [MAIN_FLOOR] • Hardware Sync Active
                  </p>
                </div>

                <div className="flex flex-col items-center gap-6 w-full">
                  <div className="flex items-center gap-3 px-6 py-3 bg-secondary/50 rounded-full border border-border backdrop-blur-xl">
                    <Switch 
                      id="serial-mode"
                      checked={serializationMode} 
                      onCheckedChange={setSerializationMode}
                      className="data-[state=checked]:bg-primary"
                    />
                    <Label htmlFor="serial-mode" className="text-[10px] font-black italic uppercase tracking-widest text-foreground cursor-pointer">
                      Serialization Mode (Deep Tracking)
                    </Label>
                  </div>

                  {serializationMode && (
                    <div className="w-full max-w-lg">
                      <Select value={targetSku} onValueChange={setTargetSku}>
                        <SelectTrigger className="h-14 bg-background/50 border-2 border-border rounded-2xl font-black italic text-[11px] uppercase tracking-widest shadow-xl">
                          <SelectValue placeholder="Target SKU for Unique Units..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-border bg-card/95 backdrop-blur-3xl shadow-2xl">
                          {(Array.isArray(products) ? products : []).map(p => (
                            <SelectItem key={p.id} value={p.sku} className="font-bold italic text-xs py-3">
                              {p.name} ({p.sku})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[9px] text-primary font-black uppercase text-center mt-3 italic animate-pulse">
                        Next scan will register a new unique instance for this SKU
                      </p>
                    </div>
                  )}
                </div>

                <div className="w-full relative group">
                  <Search className="absolute left-8 top-1/2 -translate-y-1/2 w-8 h-8 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    ref={inputRef}
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder="SCAN BARCODE OR INPUT SKU..."
                    className="h-24 pl-20 text-3xl font-black bg-secondary/50 border-2 border-border focus:border-primary/50 rounded-[2rem] shadow-2xl text-foreground italic uppercase tracking-widest placeholder:text-muted-foreground/30 transition-all"
                    autoFocus
                  />
                </div>

                <div className="flex items-center gap-6 px-8 py-4 bg-secondary/50 rounded-full border border-border backdrop-blur-xl">
                  <ShieldCheck className="w-5 h-5 text-success" />
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] italic">
                    Estela Gea Audit Pulse: <span className="text-success">NOMINAL</span>
                  </p>
                </div>
              </form>
            </CardContent>
          </GlassCard>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 overflow-hidden">
            <GlassCard className="bg-card/40 backdrop-blur-2xl border-border rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col">
              <CardHeader className="p-8 border-b border-border bg-background/20">
                <CardTitle className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.3em] flex items-center justify-between italic">
                  Live Session Stream
                  <Badge className="bg-primary text-primary-foreground font-black italic px-4 py-1">
                    {history.length} SKUs
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full p-8">
                  {isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-20 opacity-30">
                      <RefreshCw className="w-12 h-12 mb-4 animate-spin" />
                      <p className="text-[10px] font-black italic uppercase tracking-widest">Hydrating SKU Engine...</p>
                    </div>
                  ) : history.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-20 opacity-30">
                      <History className="w-16 h-16 mb-4" />
                      <p className="text-[10px] font-black italic uppercase tracking-widest">Awaiting First Scan</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(Array.isArray(history) ? history : []).map((scan, i) => {
                        const hasVariance = scan.actualCount !== scan.systemCount;
                        return (
                          <div
                            key={`${scan.sku}-${i}`}
                            className={`p-5 rounded-[2rem] border transition-all flex items-center justify-between group hover:shadow-lg ${
                              hasVariance
                                ? "bg-warning/10 border-warning/30"
                                : "bg-secondary/40 border-border"
                            }`}
                          >
                            <div className="flex gap-5">
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${hasVariance ? "bg-warning/20" : "bg-secondary/50"}`}>
                                <Box className={`w-7 h-7 ${hasVariance ? "text-warning" : "text-muted-foreground"}`} />
                              </div>
                              <div>
                                <div className="text-base font-black text-foreground italic tracking-tight">{scan.name}</div>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                    {scan.sku} • {scan.timestamp}
                                  </div>
                                  {scan.serials && scan.serials.length > 0 && (
                                    <Badge className="bg-primary/20 text-primary border-none text-[8px] px-2 py-0.5 font-black italic uppercase rounded-md leading-none">
                                      {scan.serials.length} Unique Units
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className="text-2xl font-black text-foreground italic tracking-tighter">x{scan.actualCount}</div>
                                <div className={`text-[9px] font-black uppercase tracking-widest mt-1 ${hasVariance ? "text-warning" : "text-success"}`}>
                                  {hasVariance ? "DISCREPANCY" : "IN-SYNC"}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-xl hover:bg-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                                onClick={() => handleRemoveEntry(i)}
                              >
                                <History className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </GlassCard>

            <GlassCard className="bg-card/40 backdrop-blur-2xl border-border rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col">
              <CardHeader className="p-8 border-b border-border bg-background/20">
                <CardTitle className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.3em] italic">
                  Operational Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="p-10 space-y-10 flex-1 flex flex-col justify-between">
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-background/40 p-8 rounded-[2rem] border border-border shadow-inner">
                    <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2 italic">Total Units</div>
                    <div className="text-4xl font-black italic tracking-tighter text-foreground">
                      {history.reduce((a, b) => a + b.actualCount, 0)}
                    </div>
                  </div>
                  <div className="bg-background/40 p-8 rounded-[2rem] border border-border shadow-inner">
                    <div className="text-[9px] font-black text-success uppercase tracking-widest mb-2 italic">Confirmations</div>
                    <div className="text-4xl font-black italic tracking-tighter text-success">
                      {(Array.isArray(history) ? history : []).filter((h) => h.actualCount === h.systemCount).length}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                   <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest italic">
                      <span className="text-muted-foreground">Variance Vector</span>
                      <span className="text-destructive">{totalVarianceCount} Anomalies</span>
                   </div>
                   <div className="h-3 bg-background/40 rounded-full overflow-hidden p-0.5 border border-border">
                      <div 
                         className="h-full bg-destructive rounded-full transition-all duration-1000 shadow-[0_0_15px_hsl(var(--destructive)/0.5)]" 
                         style={{ width: `${history.length > 0 ? (totalVarianceCount / history.length) * 100 : 0}%` }}
                      />
                   </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    className="flex-1 h-20 bg-secondary/50 border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-2xl font-black italic uppercase tracking-widest text-[10px]"
                    onClick={() => {
                      setHistory([]);
                      setUnresolvedBarcodes([]);
                      if (session.tenant_id && activeStore?.id) {
                        clearOpnameSession(session.tenant_id);
                      }
                    }}
                    disabled={history.length === 0 || isSubmitting}
                  >
                    Abort Audit
                  </Button>
                  <Button
                    className="flex-[2] h-20 bg-primary hover:bg-primary/90 text-primary-foreground font-black italic rounded-2xl shadow-2xl transition-all uppercase tracking-widest text-[11px]"
                    disabled={history.length === 0 || isSubmitting}
                    onClick={handleSubmit}
                  >
                    {isSubmitting ? <RefreshCw className="w-6 h-6 animate-spin" /> : "Commit Audit"}
                  </Button>
                </div>
              </CardContent>
            </GlassCard>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <GlassCard className="bg-card border-none shadow-3xl rounded-[3rem] overflow-hidden relative">
             <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none rotate-12">
                <Box className="w-48 h-48 text-primary" />
             </div>
             <CardHeader className="p-10 pb-4">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.4em] text-primary italic">Edge Pulse Monitor</CardTitle>
             </CardHeader>
             <CardContent className="p-10 pt-0 space-y-8">
                <div className="flex items-center gap-4">
                   <div className="w-4 h-4 rounded-full bg-success animate-ping" />
                   <span className="text-sm font-black italic uppercase text-foreground tracking-tighter">GATEWAY_ACTIVE: [REAL_TIME]</span>
                </div>
                <div className="p-6 bg-secondary/40 rounded-2xl border border-border">
                   <div className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-2">Hardware Context</div>
                   <div className="text-sm font-mono font-black text-primary">ZVX-SCAN-PRO-992</div>
                </div>
                <p className="text-[10px] text-muted-foreground font-bold leading-relaxed italic uppercase tracking-tight">
                   Audit stream is end-to-end encrypted and queued for **Estela Gea Global Reconciliation**.
                </p>
             </CardContent>
          </GlassCard>

          <GlassCard className="bg-warning/5 border-warning/20 border-2 rounded-[2.5rem]">
             <CardContent className="p-8 flex gap-6">
                <AlertCircle className="w-8 h-8 text-warning shrink-0" />
                <div>
                   <div className="text-[10px] font-black text-warning uppercase italic tracking-widest">Operational Limit</div>
                   <p className="text-[11px] text-warning/60 font-bold mt-2 leading-relaxed italic">
                      Variance exceeding <span className="text-warning underline">±15%</span> triggers mandatory supervisor biometric validation.
                   </p>
                </div>
             </CardContent>
          </GlassCard>
        </div>
      </div>

      <StockOpnameSummaryModal
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
        onConfirm={handleFinalConfirm}
        items={history.map(h => ({
          id: h.id,
          sku: h.sku,
          name: h.name,
          systemCount: h.systemCount,
          actualCount: h.actualCount
        }))}
        locationName={activeStore?.name || "Retail Store"}
        auditorName={user ? `${user.first_name} ${user.last_name}` : "Retail Auditor"}
      />

      <UnresolvedBarcodesModal
        isOpen={isUnresolvedOpen}
        onClose={() => setIsUnresolvedOpen(false)}
        unresolvedBarcodes={unresolvedBarcodes}
        onFlagAnomalies={handleFlagAnomalies}
        onItemsRegistered={handleItemsRegistered}
        categoryOptions={[]}
      />
    </div>
  );

  if (noShell) return content;

  return (
    <div className="flex-1 p-8 flex flex-col">
       {content}
    </div>
  );
};

export default StockOpnameScanner;
