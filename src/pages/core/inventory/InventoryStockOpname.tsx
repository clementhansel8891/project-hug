import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  ScanLine, Box, ArrowUpRight, CheckCircle2, AlertCircle, 
  History, RefreshCw, Layers, ShieldCheck, Search,
  ClipboardList, ArrowLeft, Save, Trash2, Layout, BarChart,
  Package, AlertTriangle, CheckCircle, XCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { inventoryService } from "@/core/services/inventory/inventoryService";
import { retailService } from "@/core/services/retail/retailService";
import { useSession } from "@/core/security/session";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { InventoryGlassHeader } from "@/components/shared/InventoryGlassHeader";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { UnresolvedBarcodesModal } from "@/components/shared/UnresolvedBarcodesModal";
import { useAuth } from "@/contexts/AuthContext";
import { StockOpnameSummaryModal } from "@/components/shared/StockOpnameSummaryModal";
import { 
  saveOpnameSession, 
  loadOpnameSession, 
  clearOpnameSession,
  OpnameSession 
} from "@/lib/opname-session";


interface OpnameEntry {
  id: string;
  sku: string;
  name: string;
  systemCount: number;
  actualCount: number;
  timestamp: string;
}

export default function InventoryStockOpname() {
  const session = useSession();
  const navigate = useNavigate();
  const [scanInput, setScanInput] = useState("");
  const [history, setHistory] = useState<OpnameEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>(session.location_id || "");
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<string[]>([]);
  const [newItems, setNewItems] = useState<any[]>([]);
  const [unresolvedBarcodes, setUnresolvedBarcodes] = useState<string[]>([]);
  const [isUnresolvedOpen, setIsUnresolvedOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  // Load session on mount if exists
  useEffect(() => {
    if (session.tenant_id && selectedLocation) {
      const savedSession = loadOpnameSession(session.tenant_id, selectedLocation);
      if (savedSession) {
        setActiveCycleId(savedSession.cycleId);
        setHistory(savedSession.entries);
        setUnresolvedBarcodes(savedSession.unresolvedBarcodes);
        setAnomalies(savedSession.anomalies);
        setNewItems(savedSession.newItems);
      }
    }
  }, [session.tenant_id, selectedLocation]);


  // Fetch locations on mount
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const [coreLocations, retailStores, channels] = await Promise.all([
          inventoryService.listLocations(session.tenant_id, session),
          retailService.listStores(session.tenant_id, session).catch(() => []),
          retailService.listChannels(session.tenant_id, session).catch(() => []),
        ]);

        const locationMap = new Map<string, { id: string; name: string }>();

        (Array.isArray(coreLocations) ? coreLocations : []).forEach((loc: any) => {
          if (!loc?.id) return;
          const name = loc.name || loc.code || loc.id;
          const nameKey = name.toLowerCase().trim();
          
          if (!locationMap.has(nameKey)) {
            locationMap.set(nameKey, {
              id: loc.id,
              name: name,
            });
          }
        });

        (Array.isArray(retailStores) ? retailStores : []).forEach((store: any) => {
          const locationId = store.location_id || store.locationId;
          if (!locationId) return;
          
          const name = store.name || store.code || locationId;
          const nameKey = name.toLowerCase().trim();

          if (!locationMap.has(nameKey)) {
            locationMap.set(nameKey, {
              id: locationId,
              name: name,
            });
          }
        });

        (Array.isArray(channels) ? channels : []).forEach((channel: any) => {
          const locationId = channel.branchId || channel.branch_id || channel.id;
          if (!locationId) return;

          const name = channel.name ? `${channel.name} (Ecommerce)` : locationId;
          const nameKey = name.toLowerCase().trim();

          if (!locationMap.has(nameKey)) {
            locationMap.set(nameKey, {
              id: locationId,
              name: name,
            });
          }
        });

        const locs = Array.from(locationMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        setLocations(locs);
        if (!selectedLocation && locs.length > 0) {
          setSelectedLocation(locs[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch locations", err);
      }
    };
    fetchLocations();

    const fetchCategories = async () => {
      try {
        const cats = await inventoryService.listCategories(session.tenant_id, session);
        setCategories(cats);
      } catch (err) {
        console.error("Failed to fetch categories", err);
      }
    };
    fetchCategories();
  }, [session, session.tenant_id]);


  // Global Barcode Scanner Integration
  useBarcodeScanner((barcode) => {
    if (activeCycleId) {
      processScan(barcode);
    }
  });

  const lastScanRef = useRef({ barcode: "", time: 0 });

  const processScan = useCallback(async (barcode: string) => {
    if (!barcode) return;
    
    const now = Date.now();
    if (lastScanRef.current.barcode === barcode && now - lastScanRef.current.time < 500) {
      console.log("Ignoring duplicate scan");
      return;
    }
    lastScanRef.current = { barcode, time: now };
    
    try {
      // Lookup item
      const item = await inventoryService.lookupItemByBarcode(session.tenant_id, session, barcode);
      
      if (!item) {
        if (!unresolvedBarcodes.includes(barcode) && !anomalies.includes(barcode)) {
          setUnresolvedBarcodes(prev => [...prev, barcode]);
        }

        setHistory((prev) => {
          const existingIdx = prev.findIndex((h) => h.sku === barcode);
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
              id: "unregistered",
              sku: barcode,
              name: `[Unregistered] Barcode: ${barcode}`,
              systemCount: 0,
              actualCount: 1,
              timestamp: new Date().toLocaleTimeString(),
            },
            ...prev,
          ];
        });

        toast({
          title: "Unregistered Barcode Added",
          description: `Barcode: ${barcode} added to count list.`,
        });
        
        // Save session state after scan
        if (session.tenant_id && selectedLocation && activeCycleId) {
          saveOpnameSession({
            cycleId: activeCycleId,
            locationId: selectedLocation,
            entries: [...history, {
              id: "unregistered",
              sku: barcode,
              name: `[Unregistered] Barcode: ${barcode}`,
              systemCount: 0,
              actualCount: 1,
              timestamp: new Date().toLocaleTimeString(),
            }],
            unresolvedBarcodes: [...unresolvedBarcodes, barcode],
            anomalies: [...anomalies],
            newItems: [...newItems],
            createdAt: Date.now(),
            lastUpdated: Date.now(),
            tenantId: session.tenant_id
          });
        }
        return;
      }

      setHistory((prev) => {
        const existingIdx = prev.findIndex((h) => h.sku === item.sku);
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
            id: item.id,
            sku: item.sku,
            name: item.name,
            systemCount: 0, // In a real audit, we'd fetch current balance for this location
            actualCount: 1,
            timestamp: new Date().toLocaleTimeString(),
          },
          ...prev,
        ];
      });

      toast({ title: "Count Updated", description: `${item.name} recorded.` });
      
      // Save session state after scan
      if (session.tenant_id && selectedLocation && activeCycleId) {
        saveOpnameSession({
          cycleId: activeCycleId,
          locationId: selectedLocation,
          entries: [...history, {
            id: item.id,
            sku: item.sku,
            name: item.name,
            systemCount: 0,
            actualCount: 1,
            timestamp: new Date().toLocaleTimeString(),
          }],
          unresolvedBarcodes: [...unresolvedBarcodes],
          anomalies: [...anomalies],
          newItems: [...newItems],
          createdAt: Date.now(),
          lastUpdated: Date.now(),
          tenantId: session.tenant_id
        });
      }
    } catch (err) {
      console.error("Scan processing failed", err);
    }
  }, [session, unresolvedBarcodes, anomalies, history, selectedLocation, activeCycleId, newItems]);

  const handleManualScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput) return;
    processScan(scanInput);
    setScanInput("");
    inputRef.current?.focus();
  };

  // Save session state when removing from history
  const handleRemoveEntry = (index: number) => {
    setHistory(prev => {
      const newHistory = prev.filter((_, i) => i !== index);
      
      // Save session state after removal
      if (session.tenant_id && selectedLocation && activeCycleId) {
        saveOpnameSession({
          cycleId: activeCycleId,
          locationId: selectedLocation,
          entries: newHistory,
          unresolvedBarcodes: [...unresolvedBarcodes],
          anomalies: [...anomalies],
          newItems: [...newItems],
          createdAt: Date.now(),
          lastUpdated: Date.now(),
          tenantId: session.tenant_id
        });
      }
      
      return newHistory;
    });
  };

  const startAudit = async () => {
    if (!selectedLocation) {
      toast({ title: "Location Required", description: "Select a target location first.", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);
    try {
      const cycle = await inventoryService.initiateAudit(session.tenant_id, session, {
        location_id: selectedLocation,
        scope: "LOCATION"
      });
      setActiveCycleId(cycle.id || "temp-cycle");
      toast({ title: "Audit Session Active", description: "Terminal initialized and ready for scanning." });
    } catch (err) {
      toast({ title: "Initialization Failed", description: "Could not start audit cycle.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const commitAudit = async () => {
    if (!activeCycleId) return;
    if (unresolvedBarcodes.length > 0) {
      setIsUnresolvedOpen(true);
    } else {
      setIsSummaryOpen(true);
    }
  };

  const handleFinalConfirm = async () => {
    if (!activeCycleId) return;
    setIsSubmitting(true);
    try {
      const totalCounted = history.reduce((a, b) => a + b.actualCount, 0);
      
      await inventoryService.closeAuditCycle(session.tenant_id, session, activeCycleId, {
        counted_value: totalCounted,
        variance_value: 0,
        anomalies,
        newItems: newItems.map(item => ({ id: item.id })),
        items: history.map(h => ({ id: h.id, sku: h.sku, actualCount: h.actualCount }))
      });

      setHistory([]);
      setAnomalies([]);
      setNewItems([]);
      setUnresolvedBarcodes([]);
      setActiveCycleId(null);
      
      // Clear session after successful commit
      if (session.tenant_id && selectedLocation) {
        clearOpnameSession(session.tenant_id, selectedLocation);
      }
    } catch (err) {
      console.error("Final commit failed", err);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFlagAnomalies = (barcodes: string[]) => {
    setAnomalies(prev => [...prev, ...barcodes]);
    setUnresolvedBarcodes(prev => prev.filter(b => !barcodes.includes(b)));
    toast({ title: "Anomalies Flagged", description: `${barcodes.length} barcodes flagged for review.` });
    
    // Save session state after flagging anomalies
    if (session.tenant_id && selectedLocation && activeCycleId) {
      saveOpnameSession({
        cycleId: activeCycleId,
        locationId: selectedLocation,
        entries: [...history],
        unresolvedBarcodes: unresolvedBarcodes.filter(b => !barcodes.includes(b)),
        anomalies: [...anomalies, ...barcodes],
        newItems: [...newItems],
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        tenantId: session.tenant_id
      });
    }
    
    if (unresolvedBarcodes.length - barcodes.length === 0) {
      setIsUnresolvedOpen(false);
      setIsSummaryOpen(true);
    }
  };

  const handleItemsRegistered = (createdItems: any[]) => {
    const barcodes = createdItems.map(item => item.barcode);
    setNewItems(prev => [...prev, ...createdItems]);
    setUnresolvedBarcodes(prev => prev.filter(b => !barcodes.includes(b)));
    
    // Save session state after registering items
    if (session.tenant_id && selectedLocation && activeCycleId) {
      saveOpnameSession({
        cycleId: activeCycleId,
        locationId: selectedLocation,
        entries: [...history],
        unresolvedBarcodes: unresolvedBarcodes.filter(b => !barcodes.includes(b)),
        anomalies: [...anomalies],
        newItems: [...newItems, ...createdItems],
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        tenantId: session.tenant_id
      });
    }
    
    if (unresolvedBarcodes.length - barcodes.length === 0) {
      setIsUnresolvedOpen(false);
      setIsSummaryOpen(true);
    }
  };


  const totalVariances = history.filter(h => h.actualCount !== h.systemCount).length;

  return (
    <div className="flex-1 p-8 flex flex-col gap-8 bg-muted dark:bg-muted min-h-full">
      <InventoryGlassHeader
        title="Stock Opname Terminal"
        subtitle="Physical verification and variance reconciliation engine."
        icon={ClipboardList}
        actions={
          <Button 
            variant="ghost" 
            onClick={() => navigate("/core/inventory/hub")}
            className="rounded-2xl font-black italic text-[10px] uppercase tracking-widest gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Hub
          </Button>
        }
      />

      {!activeCycleId ? (
        <div className="flex-1 flex items-center justify-center">
          <Card className="w-full max-w-2xl bg-white/70 dark:bg-muted backdrop-blur-2xl border-none shadow-2xl rounded-[3rem] overflow-hidden">
            <CardContent className="p-16 text-center space-y-8">
              <div className="w-24 h-24 bg-primary/10 rounded-[2rem] flex items-center justify-center mx-auto">
                <ShieldCheck className="w-12 h-12 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black italic tracking-tighter uppercase">Initialize Audit Cycle</h2>
                <p className="text-sm text-muted-foreground font-medium italic">Select a target location to begin the physical count verification.</p>
              </div>

              <div className="space-y-4 max-w-sm mx-auto">
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="h-16 rounded-2xl bg-background border-2 border-muted font-black italic text-sm">
                    <SelectValue placeholder="Select Target Location..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl">
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id} className="font-bold italic">{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button 
                  onClick={startAudit} 
                  disabled={isLoading}
                  className="w-full h-16 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black italic uppercase tracking-widest text-xs gap-3 shadow-xl shadow-primary/20"
                >
                  {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Layers className="w-5 h-5" />}
                  Begin Physical Audit
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 overflow-hidden">
          <div className="lg:col-span-2 flex flex-col gap-8 overflow-hidden">
            <Card className="bg-white/70 dark:bg-muted backdrop-blur-2xl border-none shadow-2xl rounded-[2.5rem] overflow-hidden">
              <CardContent className="p-12">
                <form onSubmit={handleManualScan} className="flex flex-col items-center gap-10 max-w-xl mx-auto">
                  <div className="w-24 h-24 bg-primary rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-primary/30 animate-pulse">
                    <ScanLine className="w-12 h-12 text-primary-foreground" />
                  </div>
                  
                  <div className="w-full relative group">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      ref={inputRef}
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)}
                      placeholder="SCAN BARCODE OR SKU..."
                      className="h-20 pl-16 text-2xl font-black bg-muted dark:bg-muted border-none rounded-3xl shadow-inner italic uppercase tracking-widest"
                      autoFocus
                    />
                  </div>

                  <div className="flex items-center gap-4 px-6 py-3 bg-success rounded-full border border-success/20">
                    <div className="w-2 h-2 rounded-full bg-success animate-ping" />
                    <span className="text-[10px] font-black italic uppercase tracking-widest text-success">Scanner Engine: Active & Calibrated</span>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="flex-1 bg-white/70 dark:bg-muted backdrop-blur-2xl border-none shadow-2xl rounded-[2.5rem] overflow-hidden flex flex-col">
              <CardHeader className="p-8 border-b border-muted dark:border-muted">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center justify-between italic">
                  Live Audit Stream
                  <Badge variant="outline" className="rounded-lg border-primary/20 text-primary font-black italic">{history.length} Unique SKUs</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden">
                <ScrollArea className="h-[400px] p-8">
                  {history.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
                      <Package className="w-20 h-20 mb-4 stroke-[1]" />
                      <p className="text-xs font-black italic uppercase tracking-widest">Awaiting First Scan...</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {history.map((entry, idx) => (
                        <div key={idx} className="p-6 bg-muted dark:bg-muted rounded-3xl border border-muted/50 dark:border-muted/50 flex items-center justify-between group hover:bg-primary/[0.02] transition-all">
                          <div className="flex gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-muted shadow-sm flex items-center justify-center">
                              <Box className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <div>
                              <div className="text-sm font-black italic text-muted-foreground dark:text-white">{entry.name}</div>
                              <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{entry.sku} • {entry.timestamp}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-8">
                             <div className="text-right">
                                <div className="text-2xl font-black italic text-primary">x{entry.actualCount}</div>
                                <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Physical Count</div>
                             </div>
                             <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-10 w-10 rounded-xl hover:bg-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                              onClick={() => handleRemoveEntry(idx)}
                             >
                               <Trash2 className="w-4 h-4" />
                             </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-8">
            <Card className="bg-muted border-none shadow-2xl rounded-[3rem] overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <BarChart className="w-32 h-32 text-primary" />
              </div>
              <CardHeader className="p-10 pb-4">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.4em] text-primary italic">Session Intelligence</CardTitle>
              </CardHeader>
              <CardContent className="p-10 pt-0 space-y-10">
                <div className="space-y-6">
                  <div className="bg-muted p-6 rounded-2xl border border-border">
                    <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1 italic">Audit Target</div>
                    <div className="text-lg font-black text-white italic">{locations.find(l => l.id === selectedLocation)?.name}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted p-6 rounded-2xl border border-border">
                      <div className="text-[9px] font-black text-success uppercase tracking-widest mb-1 italic">Total Units</div>
                      <div className="text-3xl font-black text-white italic tracking-tighter">
                        {history.reduce((a, b) => a + b.actualCount, 0)}
                      </div>
                    </div>
                    <div className="bg-muted p-6 rounded-2xl border border-border">
                      <div className="text-[9px] font-black text-destructive uppercase tracking-widest mb-1 italic">SKUs Scanned</div>
                      <div className="text-3xl font-black text-white italic tracking-tighter">{history.length}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                   <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest italic">
                      <span className="text-muted-foreground">Anomaly Vector</span>
                      <span className="text-warning">{totalVariances} Mismatches</span>
                   </div>
                   <div className="h-2 bg-muted rounded-full overflow-hidden p-0.5">
                      <div 
                         className="h-full bg-warning rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(245,158,11,0.5)]" 
                         style={{ width: `${history.length > 0 ? (totalVariances / history.length) * 100 : 0}%` }}
                      />
                   </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1 h-16 bg-transparent border-border text-muted-foreground hover:text-destructive hover:bg-destructive rounded-2xl font-black italic uppercase tracking-widest text-[10px]"
                    onClick={() => {
                      if (confirm("Abort current audit session? Data will not be saved.")) {
                        setActiveCycleId(null);
                        setHistory([]);
                        setAnomalies([]);
                        setNewItems([]);
                        setUnresolvedBarcodes([]);
                        
                        // Clear session on abort
                        if (session.tenant_id && selectedLocation) {
                          clearOpnameSession(session.tenant_id, selectedLocation);
                        }
                      }
                    }}
                    disabled={isSubmitting}
                  >
                    Abort
                  </Button>
                  <Button
                    className="flex-[2] h-16 bg-primary hover:bg-primary/90 text-primary-foreground font-black italic rounded-2xl shadow-xl transition-all uppercase tracking-widest text-xs"
                    disabled={history.length === 0 || isSubmitting}
                    onClick={commitAudit}
                  >
                    {isSubmitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : "Commit Audit"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-primary border-primary border-2 rounded-[2.5rem]">
              <CardContent className="p-8 flex gap-5">
                <AlertCircle className="w-6 h-6 text-primary shrink-0" />
                <div>
                  <div className="text-[10px] font-black text-primary uppercase italic tracking-widest">Protocol Intelligence</div>
                  <p className="text-[11px] text-primary font-bold mt-2 leading-relaxed italic">
                    Audit data is buffered locally and reconciled upon commit. Mismatches will trigger automated variance logs.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <UnresolvedBarcodesModal
        isOpen={isUnresolvedOpen}
        onClose={() => setIsUnresolvedOpen(false)}
        unresolvedBarcodes={unresolvedBarcodes}
        onFlagAnomalies={handleFlagAnomalies}
        onItemsRegistered={handleItemsRegistered}
        categoryOptions={categories}
      />

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
        locationName={locations.find(l => l.id === selectedLocation)?.name || "Main Hub"}
        auditorName={user ? `${user.first_name} ${user.last_name}` : "System Auditor"}
      />
    </div>
  );
}
