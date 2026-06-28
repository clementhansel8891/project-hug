import { useState, useEffect, useCallback, useMemo } from "react";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { Button } from "@/components/ui/button";
import { Input as UIInput } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/core/security/session";
import { inventoryService } from "@/core/services/inventory/inventoryService";
import {
  WarehouseBin,
  BinAssignment,
} from "@/core/types/inventory/inventory";
import { Boxes, Plus, Search, Warehouse, LayoutGrid, List, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { ErrorState } from "@/components/shared/AsyncState";

export default function WarehouseManagement() {
  const session = useSession();
  const [bins, setBins] = useState<WarehouseBin[]>([]);
  const [selectedBin, setSelectedBin] = useState<WarehouseBin | null>(null);
  const [binStock, setBinStock] = useState<BinAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [locationId, setLocationId] = useState(session.location_id || "MAIN");
  const [viewMode, setViewMode] = useState<"list" | "map">("map");
  const [search, setSearch] = useState("");
  const [createBinOpen, setCreateBinOpen] = useState(false);

  const loadBins = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const data = await inventoryService.getWarehouseBins(session.tenant_id, session, locationId);
      setBins(Array.isArray(data) ? data : []);
      if (data.length > 0 && !selectedBin) {
        setSelectedBin(data[0]);
      }
    } catch (error) {
      console.error("Failed to load bins:", error);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [session, locationId]);

  useEffect(() => {
    loadBins();
  }, [loadBins]);

  useEffect(() => {
    if (selectedBin) {
      const fetchStock = async () => {
        try {
          const stock = await inventoryService.getBinStock(session.tenant_id, session, selectedBin.id);
          setBinStock(stock);
        } catch (error) {
          console.error("Failed to load bin stock:", error);
        }
      };
      fetchStock();
    }
  }, [selectedBin, session.tenant_id]);

  const viewBinStock = async (bin: WarehouseBin) => {
    setSelectedBin(bin);
  };

  const filteredBins = useMemo(() => {
    return (Array.isArray(bins) ? bins : []).filter(b => 
      b.code.toLowerCase().includes(search.toLowerCase()) ||
      b.zone?.toLowerCase().includes(search.toLowerCase()) ||
      b.aisle?.toLowerCase().includes(search.toLowerCase())
    );
  }, [bins, search]);

  const binsByZone = useMemo(() => {
    const zones: Record<string, WarehouseBin[]> = {};
    filteredBins.forEach(bin => {
      const z = bin.zone || "Default";
      if (!zones[z]) zones[z] = [];
      zones[z].push(bin);
    });
    return zones;
  }, [filteredBins]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouse Map"
        subtitle="Tactical spatial visualization of storage hierarchy and bin occupancy."
        primaryAction={
          <div className="flex items-center gap-3">
             <div className="flex bg-muted dark:bg-muted p-1 rounded-xl border border-muted dark:border-muted">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setViewMode("map")}
                  className={cn(
                    "rounded-lg h-8 px-3 gap-2 text-[10px] font-black uppercase tracking-widest transition-all",
                    viewMode === "map" ? "bg-card dark:bg-muted shadow-sm text-primary" : "text-muted-foreground"
                  )}
                >
                  <LayoutGrid className="h-3 w-3" /> Map
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "rounded-lg h-8 px-3 gap-2 text-[10px] font-black uppercase tracking-widest transition-all",
                    viewMode === "list" ? "bg-card dark:bg-muted shadow-sm text-primary" : "text-muted-foreground"
                  )}
                >
                  <List className="h-3 w-3" /> List
                </Button>
             </div>
             <Button onClick={() => { setCreateBinOpen?.(true); }} className="rounded-xl bg-primary hover:bg-primary text-white gap-2 text-[10px] font-black uppercase tracking-widest px-6 h-10 shadow-lg shadow-primary/20">
                <Plus className="h-3 w-3" /> Create Bin
             </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
           {/* Search & Stats */}
           <div className="flex items-center justify-between p-6 bg-card dark:bg-muted border border-muted dark:border-muted rounded-[2rem] shadow-sm">
              <div className="relative flex-1 max-w-md">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                 <UIInput 
                   placeholder="Locate bin, zone, or aisle..." 
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                   className="pl-10 h-11 bg-muted dark:bg-muted border-none rounded-xl text-sm"
                 />
              </div>
              <div className="flex items-center gap-6">
                 <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Bins</p>
                    <p className="text-xl font-black italic">{bins.length}</p>
                 </div>
                 <div className="h-10 w-[1px] bg-muted dark:bg-muted" />
                 <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Avg Utilization</p>
                    <p className="text-xl font-black italic text-success">68%</p>
                 </div>
              </div>
           </div>

           {error ? (
             <ErrorState
               title="Couldn't load warehouse bins"
               description="The storage bin layout failed to load for this location. Check your connection and try again."
               onRetry={loadBins}
             />
           ) : viewMode === "list" ? (
             <WorkspacePanel title="Bin List" description={`Storage nodes in ${locationId}`}>
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {loading ? (
                    <div className="space-y-3 p-4">
                       {[1,2,3,4].map(i => <div key={i} className="h-16 rounded-xl bg-muted dark:bg-muted animate-pulse" />)}
                    </div>
                  ) : filteredBins.length === 0 ? (
                    <div className="p-12 text-center border-2 border-dashed rounded-[2rem] border-muted dark:border-muted">
                       <Warehouse className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                       <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">No storage bins found.</p>
                    </div>
                  ) : (
                    filteredBins.map((bin) => (
                      <div
                        key={bin.id}
                        onClick={() => viewBinStock(bin)}
                        className={cn(
                          "group flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 cursor-pointer",
                          selectedBin?.id === bin.id 
                            ? "border-primary bg-primary shadow-lg shadow-primary/5 ring-1 ring-primary" 
                            : "border-muted dark:border-muted hover:border-primary bg-card dark:bg-muted"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
                            selectedBin?.id === bin.id ? "bg-primary text-white" : "bg-muted dark:bg-muted text-muted-foreground"
                          )}>
                            <Warehouse className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-black text-sm tracking-tight">{bin.code}</p>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.1em]">
                              Zone {bin.zone} · Aisle {bin.aisle} · Rack {bin.rack}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                           <div className="text-right">
                              <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Cap</p>
                              <p className="text-xs font-black italic">{bin.capacity}</p>
                           </div>
                           <Badge className="bg-success text-success border-none text-[8px] font-black px-2">ACTIVE</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
             </WorkspacePanel>
           ) : (
             <div className="space-y-10 pb-10">
                {Object.entries(binsByZone).map(([zone, zoneBins]) => (
                  <div key={zone} className="space-y-4">
                     <div className="flex items-center gap-4">
                        <Badge className="bg-primary text-white border-none px-4 py-1.5 rounded-full text-[10px] font-black tracking-[0.2em] uppercase">
                          Zone {zone}
                        </Badge>
                        <div className="h-[1px] flex-1 bg-muted dark:bg-muted" />
                     </div>
                     
                     <div className="grid gap-8 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                        {/* Group by Aisle within Zone */}
                        {Array.from(new Set(zoneBins.map(b => b.aisle || "A1"))).sort().map(aisle => {
                          const aisleBins = zoneBins.filter(b => (b.aisle || "A1") === aisle);
                          return (
                            <div key={aisle} className="space-y-3">
                               <div className="flex items-center justify-between px-2">
                                  <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground">Aisle {aisle}</span>
                                  <span className="text-[8px] font-bold text-muted-foreground uppercase">{aisleBins.length} Nodes</span>
                               </div>
                               <div className="p-4 rounded-[2rem] bg-muted dark:bg-muted border border-muted dark:border-muted grid grid-cols-2 gap-2">
                                  {aisleBins.map(bin => (
                                    <button
                                      key={bin.id}
                                      onClick={() => setSelectedBin(bin)}
                                      className={cn(
                                        "aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 transition-all duration-300 relative overflow-hidden group",
                                        selectedBin?.id === bin.id 
                                          ? "bg-primary border-primary text-white shadow-xl shadow-primary/20 scale-105 z-10" 
                                          : "bg-card dark:bg-muted border-muted dark:border-muted hover:border-primary"
                                      )}
                                    >
                                       {/* Occupancy Indicator */}
                                       <div className={cn(
                                         "absolute top-2 right-2 h-1.5 w-1.5 rounded-full",
                                         selectedBin?.id === bin.id ? "bg-card animate-pulse" : "bg-success"
                                       )} />
                                       
                                       <span className={cn(
                                         "text-[10px] font-black tracking-tight transition-transform group-hover:scale-110",
                                         selectedBin?.id === bin.id ? "text-white" : "text-muted-foreground dark:text-white"
                                       )}>{bin.code.split('-').pop()}</span>
                                       <span className={cn(
                                         "text-[7px] font-bold uppercase opacity-50 tracking-widest",
                                         selectedBin?.id === bin.id ? "text-primary" : "text-muted-foreground"
                                       )}>R{bin.rack}L{bin.level}</span>
                                    </button>
                                  ))}
                               </div>
                            </div>
                          );
                        })}
                     </div>
                  </div>
                ))}
             </div>
           )}
        </div>

        {/* --- Side Panel: Bin Content --- */}
        <div className="space-y-6 lg:sticky lg:top-8 h-fit">
           <WorkspacePanel
             title={selectedBin ? `Node: ${selectedBin.code}` : "Tactical Data"}
             description={selectedBin ? `Real-time occupancy for bin sequence ${selectedBin.id.slice(0,8)}` : "Select a tactical node to view telemetry."}
           >
             {!selectedBin ? (
               <div className="p-12 text-center border-2 border-dashed rounded-[2.5rem] border-muted dark:border-muted">
                  <MapPin className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Satellite lock pending. Select bin.</p>
               </div>
             ) : (
               <div className="space-y-8">
                 {/* Bin Telemetry Grid */}
                 <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl bg-muted dark:bg-muted border border-muted dark:border-muted">
                       <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">Zone / Aisle</p>
                       <p className="text-xs font-black italic">{selectedBin.zone || "N/A"} / {selectedBin.aisle || "N/A"}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-muted dark:bg-muted border border-muted dark:border-muted">
                       <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">Rack / Level</p>
                       <p className="text-xs font-black italic">{selectedBin.rack || "N/A"} / {selectedBin.level || "N/A"}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-muted dark:bg-muted border border-muted dark:border-muted">
                       <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">Max Capacity</p>
                       <p className="text-xs font-black italic">{selectedBin.capacity} Units</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-muted dark:bg-muted border border-muted dark:border-muted">
                       <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">Current Stock</p>
                       <p className="text-xs font-black italic text-primary">{binStock.length} SKUs</p>
                    </div>
                 </div>

                 {/* Content Table */}
                 <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Active Stock Assignments</p>
                    <div className="rounded-[1.5rem] border border-muted dark:border-muted overflow-hidden bg-card dark:bg-muted">
                       {binStock.length === 0 ? (
                         <div className="p-10 text-center italic text-[10px] text-muted-foreground uppercase tracking-widest">
                           Bin is clinically empty.
                         </div>
                       ) : (
                         <div className="divide-y divide-muted dark:divide-muted">
                           {binStock.map((stock) => (
                             <div key={stock.id} className="p-4 flex items-center justify-between hover:bg-muted dark:hover:bg-muted transition-colors group">
                                <div>
                                   <p className="text-[11px] font-black tracking-tight group-hover:text-primary transition-colors uppercase italic">{stock.item_masters?.name || "Unknown Asset"}</p>
                                   <p className="text-[9px] font-bold text-muted-foreground font-mono">{stock.item_masters?.sku || stock.product_id}</p>
                                </div>
                                <div className="text-right">
                                   <p className="text-[10px] font-black italic">{stock.qty}</p>
                                   <p className="text-[8px] font-bold text-muted-foreground uppercase">PCS</p>
                                </div>
                             </div>
                           ))}
                         </div>
                       )}
                    </div>
                 </div>

                 {/* Quick Actions */}
                 <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="rounded-xl border-muted dark:border-muted text-[9px] font-black uppercase tracking-widest py-6 h-auto">
                       Print Bin Label
                    </Button>
                    <Button className="rounded-xl bg-muted dark:bg-card text-white dark:text-muted-foreground text-[9px] font-black uppercase tracking-widest py-6 h-auto">
                       Stock Move
                    </Button>
                 </div>
               </div>
             )}
           </WorkspacePanel>
        </div>
      </div>
    </div>
  );
}
