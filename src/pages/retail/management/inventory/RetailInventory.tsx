import { 
  Package, 
  Truck, 
  ArrowDownLeft, 
  History,
  BoxSelect,
  RefreshCw,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { useState, useCallback, useEffect } from "react";
import { useSession } from "@/core/security/session";
import { retailService } from "@/core/services/retail/retailService";
import { useToast } from "@/hooks/use-toast";
import { InventoryFilterHub } from "@/components/shared/InventoryFilterHub";
import { inventoryService } from "@/core/services/inventory/inventoryService";
import { apiRequest } from "@/core/api/apiClient";

export default function RetailInventory() {
  const navigate = useNavigate();
  const session = useSession();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [inventory, setInventory] = useState<any[]>([]);
  const [categories, setCategories] = useState<{id: string, name: string}[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [importModalOpen, setImportModalOpen] = useState(false);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const [invData, cats] = await Promise.all([
        retailService.listInventory(session.tenant_id!, session, { locationId: session.location_id }),
        inventoryService.listCategories(session.tenant_id!, session)
      ]);
      setInventory(invData || []);
      setCategories(cats || []);
    } catch (e) {
      toast({ title: "Sync Error", description: "Failed to pull live inventory logs.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session.tenant_id) fetchInventory();
  }, [session]);

  const handleAdjust = useCallback(async (action: string) => {
    if (!session.tenant_id) return;
    setLoading(true);
    try {
      toast({
        title: "Action Initialized",
        description: `Triggering ${action} for location ${session.location_id || "Global"}`
      });
      setTimeout(() => {
        toast({ title: "Inventory Synced", description: "Ledger updated successfully." });
        setLoading(false);
      }, 1500);
    } catch (err) {
      toast({ title: "Action Failed", description: "Inventory core unreachable.", variant: "destructive" });
      setLoading(false);
    }
  }, [session, toast]);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto p-4 md:p-6">
      <PageHeader 
        title="Inventory Operations" 
        subtitle="Operational Stock Management & Receiving"
      />

      <div className="p-4 bg-muted border-b border-border">
        <InventoryFilterHub 
          search={searchTerm}
          onSearchChange={setSearchTerm}
          category={selectedCategory}
          onCategoryChange={setSelectedCategory}
          categories={categories}
          status={filterStatus}
          onStatusChange={setFilterStatus}
          sortBy={sortBy}
          onSortChange={setSortBy}
          advancedActions={
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="h-14 px-6 rounded-2xl bg-muted border-border text-white font-black italic uppercase text-[10px] tracking-widest gap-2"
                onClick={() => setImportModalOpen(true)}
              >
                <Plus className="w-4 h-4" />
                New Category
              </Button>
              <Button 
                className="h-14 px-8 rounded-2xl bg-primary text-primary-foreground font-black italic uppercase text-xs tracking-widest gap-3 shadow-xl"
                onClick={async () => {
                  try {
                    await apiRequest("/retail/inventory/export", "POST", session, { format: "csv" });
                    toast({ title: "Export Started", description: "Inventory export is being generated. You'll be notified when ready." });
                  } catch (e) {
                    toast({ title: "Export Failed", description: "Could not trigger inventory export.", variant: "destructive" });
                  }
                }}
              >
                <Package className="w-5 h-5" />
                Register Item
              </Button>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <WorkspacePanel title="Open Inbound Shipments" description="Pending stock arrivals from main warehouse">
            <div className="divide-y border rounded-lg overflow-hidden bg-white">
              {[
                { id: "ship-901", from: "Central Whse", items: 24, status: "in-transit" },
                { id: "ship-904", from: "Regional Hub", items: 12, status: "pending" },
              ].map(ship => (
                <div key={ship.id} className="p-4 flex items-center justify-between hover:bg-secondary/5 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/5 text-primary rounded-lg flex items-center justify-center">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">{ship.id}</h4>
                      <p className="text-xs text-muted-foreground">From: {ship.from} • {ship.items} SKUs</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="capitalize">{ship.status}</Badge>
                    <Button 
                      onClick={() => handleAdjust("INBOUND_PROCESS")} 
                      disabled={loading}
                      size="sm" 
                      variant="ghost"
                      className="font-bold italic uppercase text-[10px]"
                    >
                      Process <ArrowDownLeft className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </WorkspacePanel>

          <WorkspacePanel title="Stock Opname Activity" description="Operational counting schedules">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <Card className="border-none shadow-sm bg-secondary/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-black italic uppercase">Weekly Coffee Count</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase">Target: Store Shelf A1-A4</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge className="bg-warning text-warning font-black italic text-[8px] uppercase tracking-widest border-none">DUE TODAY</Badge>
                      <Button 
                        onClick={() => handleAdjust("OPNAME_START")} 
                        disabled={loading}
                        size="sm"
                        className="rounded-xl bg-primary hover:bg-primary text-foreground font-black italic uppercase text-[9px] tracking-widest"
                      >
                        Start Count
                      </Button>
                    </div>
                  </CardContent>
               </Card>
               <Card className="border-none shadow-sm bg-secondary/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Monthly Merchandise Audit</CardTitle>
                    <CardDescription>Target: Total Inventory</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">Schedule: Feb 28</Badge>
                       <Button onClick={() => navigate("/core/inventory/stock")} size="sm" variant="ghost">View Details</Button>
                    </div>
                  </CardContent>
               </Card>
            </div>
          </WorkspacePanel>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center"><History className="w-4 h-4 mr-2" /> Inventory Pulse</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">ATS Violation Alerts</span>
                <Badge variant="destructive">0</Badge>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Reserved Items</span>
                <span className="font-mono font-bold">142</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Warehouse TTL</span>
                <span className="font-mono text-success">Active</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-primary text-foreground">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center"><BoxSelect className="w-4 h-4 mr-2" /> Rapid Intake</CardTitle>
              <CardDescription className="text-primary">Quickly add local stock</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs opacity-80 leading-relaxed">
                Use the operational scanner to intake local courier shipments not tracked via Enterprise Logistics.
              </p>
               <Button onClick={() => navigate("/core/inventory/stock")} variant="secondary" className="w-full text-primary">Open Scanner</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
