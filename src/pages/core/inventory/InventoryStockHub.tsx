import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "@/core/security/session";
import { apiRequest } from "@/core/api/apiClient";
import { inventoryService } from "@/core/services/inventory/inventoryService";
import { retailService } from "@/core/services/retail/retailService";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input as UIInput } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Package,
  Search,
  Plus,
  Filter,
  ArrowUpDown,
  MoreHorizontal,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  History,
  Layout,
  Layers,
  ArrowRightLeft,
  Truck,
  ShoppingCart,
  Settings,
  Activity,
  Box,
  Tags,
  Download,
  Upload,
  BarChart3,
  Globe,
  Database,
  Archive,
  BarChart2,
  ListFilter,
  Image as ImageIcon
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ImportDialog } from "@/components/shared/ImportDialog";
import { ExportSettingsDialog as ExportDialog } from "@/components/shared/ExportSettingsDialog";
import { CategoryManager as CategoryDialog } from "@/components/shared/CategoryManager";
import { InventoryFilterHub } from "@/components/shared/InventoryFilterHub";
import { ItemDetailsModal } from "./components/ItemDetailsModal";
import { InventoryAnalyticsDialog } from "./components/InventoryAnalyticsDialog";
import { CreateItemDialog } from "./components/CreateItemDialog";
import { JobMonitorDialog } from "./components/JobMonitorDialog";

const SECTIONS = [
  {
    title: "INVENTORY OPS",
    items: [
      { id: 'stock', icon: Box, label: "Stock Hub", to: "/core/inventory/stock" },
      { id: 'transfer', icon: ArrowRightLeft, label: "Transfer Desk", to: "/core/inventory/transfer" },
      { id: 'opname', icon: Archive, label: "Stock Opname", to: "/core/inventory/opname" },
      { id: 'audit', icon: History, label: "Stock Audit", to: "/core/inventory/audit" },
    ]
  },
  {
    title: "PROCUREMENT",
    items: [
      { id: 'orders', icon: ShoppingCart, label: "Purchase Orders", to: "/core/inventory/orders" },
      { id: 'vendors', icon: Truck, label: "Vendor Management", to: "/core/inventory/vendors" },
    ]
  },
  {
    title: "CONFIGURATION",
    items: [
      { id: 'categories', icon: Tags, label: "Categories", to: "/core/inventory/categories" },
      { id: 'settings', icon: Settings, label: "Inventory Settings", to: "/core/inventory/settings" },
    ]
  }
];

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  status: "ACTIVE" | "INACTIVE" | "DRAFT" | "DISCONTINUED";
  currentStock: number;
  minStock: number;
  unit?: string;
  costPrice?: number;
  sellingPrice?: number;
}

export default function InventoryStockHub() {
  const session = useSession();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);
  const [activeLocation, setActiveLocation] = useState<string>("all");
  const [sortConfig, setSortConfig] = useState("created_at-desc");
  const [activeStatus, setActiveStatus] = useState("all");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [globalStats, setGlobalStats] = useState<any>(null);
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImageImportOpen, setIsImageImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isJobMonitorOpen, setIsJobMonitorOpen] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await apiRequest<any[]>("/inventory/categories", "GET", session);
      setCategories(data || []);
    } catch (error) {
      console.error("Failed to fetch categories", error);
    }
  }, [session]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sortBy, sortOrder] = sortConfig.split("-");
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: "30",
        search: debouncedSearch,
        category_id: activeCategory !== 'all' ? activeCategory : '',
        location_id: activeLocation !== 'all' ? activeLocation : '',
        sortBy,
        sortOrder,
        status: activeStatus !== 'all' ? activeStatus : '',
      });

      const response = await apiRequest<any>(
        `/inventory/items?${queryParams.toString()}`,
        "GET",
        session
      );
      
      setItems(response.data || response || []);
      
      // 2. Fetch Global Dashboard Stats (for KPI cards)
      const statsResponse = await apiRequest<any>("/inventory/dashboard", "GET", session);
      setGlobalStats(statsResponse);
      
      // 3. Set Total Count for pagination
      if (response && response.meta) {
        setTotalCount(response.meta.total || 0);
      } else if (statsResponse) {
        const statsData = statsResponse.data || statsResponse;
        setTotalCount(statsData.total_items || statsData.totalItems || 0);
      }
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message || "Could not retrieve catalog data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [session, page, debouncedSearch, activeCategory, activeLocation, sortConfig, activeStatus]);

  const fetchLocations = useCallback(async () => {
    try {
      const [coreLocations, retailStores, channels] = await Promise.all([
        inventoryService.listLocations(session.tenant_id, session),
        retailService.listStores(session.tenant_id, session).catch(() => []),
        retailService.listChannels(session.tenant_id, session).catch(() => []),
      ]);

      const locationMap = new Map<string, { id: string; name: string }>();

      (Array.isArray(coreLocations) ? coreLocations : []).forEach((loc: any) => {
        if (!loc?.id) return;
        locationMap.set(loc.id, {
          id: loc.id,
          name: loc.name || loc.code || loc.id,
        });
      });

      (Array.isArray(retailStores) ? retailStores : []).forEach((store: any) => {
        const locationId = store.location_id || store.locationId;
        if (!locationId) return;
        
        // Overwrite location name with store name if available
        locationMap.set(locationId, {
          id: locationId,
          name: store.name || store.code || locationId,
        });
      });

      (Array.isArray(channels) ? channels : []).forEach((channel: any) => {
        const locationId = channel.branchId || channel.branch_id || channel.id;
        if (!locationId) return;

        // Add ecommerce channels to the list
        if (!locationMap.has(locationId)) {
          locationMap.set(locationId, {
            id: locationId,
            name: `${channel.name} (Ecommerce)`,
          });
        }
      });

      const locs = Array.from(locationMap.values())
        .filter((loc, index, self) => 
          index === self.findIndex((t) => (
            t.name.trim().toLowerCase() === loc.name.trim().toLowerCase() || t.id === loc.id
          ))
        )
        .sort((a, b) => a.name.localeCompare(b.name));
      
      setLocations(locs);
    } catch (error) {
      console.error("Failed to fetch locations", error);
    }
  }, [session]);

  useEffect(() => {
    fetchData();
    fetchCategories();
    fetchLocations();
  }, [fetchData, fetchCategories, fetchLocations]);

  const filteredItems = items;

  const stats = useMemo(() => {
    const statsData = globalStats?.data || globalStats;
    return {
      totalItems: statsData?.total_items ?? statsData?.totalItems ?? totalCount ?? 0,
      itemsType: statsData?.items_type_count ?? statsData?.itemsTypeCount ?? statsData?.total_items ?? 0,
      totalOnHand: statsData?.total_on_hand_qty ?? statsData?.totalOnHandQty ?? 0,
      lowStock: statsData?.low_stock_count ?? statsData?.lowStockCount ?? 0,
      outOfStock: statsData?.out_of_stock_count ?? statsData?.outOfStockCount ?? items.filter(i => (i.currentStock || 0) === 0).length,
      totalValue: statsData?.total_valuation ?? statsData?.totalValuation ?? 0,
      capitalValue: statsData?.capital_value ?? statsData?.capitalValue ?? 0,
      currency: statsData?.currency || "IDR"
    };
  }, [globalStats, totalCount, items]);

  const headerActions = (
    <div className="flex gap-2">
      <Button
        onClick={() => setIsImportOpen(true)}
        variant="outline"
        className="rounded-xl border-border bg-background/50 backdrop-blur-sm shadow-sm hover:bg-secondary text-foreground font-black text-[10px] uppercase tracking-widest h-9 px-4"
      >
        <Upload className="h-3 w-3 mr-2" /> Data Import
      </Button>
      <Button
        onClick={() => setIsImageImportOpen(true)}
        variant="outline"
        className="rounded-xl border-border bg-background/50 backdrop-blur-sm shadow-sm hover:bg-secondary text-foreground font-black text-[10px] uppercase tracking-widest h-9 px-4"
      >
        <ImageIcon className="h-3 w-3 mr-2" /> Image Import
      </Button>
      <Button
        onClick={() => setIsExportOpen(true)}
        variant="outline"
        className="rounded-xl border-border bg-background/50 backdrop-blur-sm shadow-sm hover:bg-secondary text-foreground font-black text-[10px] uppercase tracking-widest h-9 px-4"
      >
        <Download className="h-3 w-3 mr-2" /> Export
      </Button>
      <Button
        onClick={() => setIsJobMonitorOpen(true)}
        variant="outline"
        className="rounded-xl border-border bg-background/50 backdrop-blur-sm shadow-sm hover:bg-secondary text-foreground font-black text-[10px] uppercase tracking-widest h-9 px-4"
      >
        <Activity className="h-3 w-3 mr-2 text-primary" /> Monitor
      </Button>
      <div className="w-px h-6 bg-border mx-2" />
      <Button
        onClick={() => setIsCreateOpen(true)}
        className="rounded-xl bg-foreground text-background hover:bg-foreground/90 shadow-lg font-black text-[10px] uppercase tracking-widest h-9 px-6"
      >
        <Plus className="h-3 w-3 mr-2" /> New Item
      </Button>
      <Button
        onClick={() => setIsCategoryOpen(true)}
        variant="outline"
        className="rounded-xl border-border bg-background/50 backdrop-blur-sm shadow-sm hover:bg-secondary text-foreground font-black text-[10px] uppercase tracking-widest h-9 px-4"
      >
        <Plus className="h-3 w-3 mr-2" /> New Category
      </Button>
    </div>
  );

  const mainContent = (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="border-none shadow-xl shadow-muted/50 dark:shadow-none bg-white dark:bg-muted rounded-[2.5rem] overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Items Type</CardTitle>
            <Layers className="h-4 w-4 text-primary opacity-50" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter">{stats.itemsType}</div>
            <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-widest">Active Models</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl shadow-muted/50 dark:shadow-none bg-white dark:bg-muted rounded-[2.5rem] overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Items On-Hand</CardTitle>
            <Package className="h-4 w-4 text-primary opacity-50" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter">{stats.totalOnHand}</div>
            <p className="text-[10px] font-bold text-success mt-1 uppercase tracking-widest">Available units</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl shadow-muted/50 dark:shadow-none bg-white dark:bg-muted rounded-[2.5rem] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning opacity-50" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-warning">{stats.lowStock}</div>
            <p className="text-[10px] font-bold text-warning mt-1 uppercase tracking-widest">Refinement Required</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl shadow-muted/50 dark:shadow-none bg-white dark:bg-muted rounded-[2.5rem] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Out of Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive opacity-50" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-destructive">{stats.outOfStock}</div>
            <p className="text-[10px] font-bold text-destructive mt-1 uppercase tracking-widest">Critical Shortage</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl shadow-muted/50 dark:shadow-none bg-white dark:bg-muted rounded-[2.5rem] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Item Capital Value</CardTitle>
            <Archive className="h-4 w-4 text-primary opacity-50" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-primary">
              {formatCurrency(stats.capitalValue, stats.currency, "id-ID")}
            </div>
            <p className="text-[10px] font-bold text-primary mt-1 uppercase tracking-widest">Initial Investment</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl shadow-muted/50 dark:shadow-none bg-white dark:bg-muted rounded-[2.5rem] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Inventory Value</CardTitle>
            <BarChart3 className="h-4 w-4 text-success opacity-50" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-success">
              {formatCurrency(stats.totalValue, stats.currency, "id-ID")}
            </div>
            <p className="text-[10px] font-bold text-success mt-1 uppercase tracking-widest">Financial Asset Value</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-2xl shadow-muted/50 dark:shadow-none bg-white dark:bg-muted rounded-[3rem] overflow-hidden">
        <div className="p-8 border-b">
          <InventoryFilterHub 
            search={search}
            onSearchChange={setSearch}
            category={activeCategory}
            onCategoryChange={setActiveCategory}
            categories={categories}
            location={activeLocation}
            onLocationChange={setActiveLocation}
            locations={locations}
            status={activeStatus}
            onStatusChange={setActiveStatus}
            sortBy={sortConfig}
            onSortChange={setSortConfig}
            advancedActions={
              <Button 
                onClick={() => setIsAnalyticsOpen(true)}
                variant="outline" 
                className="h-14 px-6 rounded-2xl border-border bg-muted backdrop-blur-md text-xs font-black uppercase tracking-widest hover:bg-muted text-muted-foreground"
              >
                <BarChart2 className="h-4 w-4 mr-2" /> Analytics
              </Button>
            }
          />
        </div>

        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader className="bg-muted dark:bg-muted">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="w-[80px] text-[10px] font-black uppercase tracking-widest pl-8 py-6">Image</TableHead>
                  <TableHead className="w-[120px] text-[10px] font-black uppercase tracking-widest py-6">SKU</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Item Identity</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest py-6 text-right">Price</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest py-6 text-right">Balance</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest py-6 text-center">Status</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest py-6 text-right pr-8">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-muted dark:border-muted">
                      <TableCell colSpan={6} className="py-6 px-8">
                        <Skeleton className="h-12 w-full rounded-xl" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center opacity-20">
                        <Archive className="h-16 w-16 mb-4 stroke-[1]" />
                        <h3 className="text-xl font-black uppercase tracking-widest">No Inventory Found</h3>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow 
                      key={item.id} 
                      className="border-muted dark:border-muted group hover:bg-primary/[0.02] cursor-pointer transition-all"
                      onClick={() => setSelectedItem(item)}
                    >
                      <TableCell className="pl-8 py-4">
                        <div className="h-10 w-10 rounded-xl overflow-hidden bg-muted dark:bg-muted border border-muted dark:border-muted flex items-center justify-center">
                          {(item as any).image_url ? (
                            <img 
                              src={(item as any).image_url} 
                              alt={item.name} 
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.target as any).src = "";
                                (e.target as any).className = "hidden";
                              }}
                            />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-6">
                        <span className="text-xs font-mono font-black text-muted-foreground group-hover:text-primary transition-colors">{item.sku}</span>
                      </TableCell>
                      <TableCell className="py-6">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-black tracking-tight">{item.name}</span>
                          <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{item.category || "General"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-6 text-right font-black italic text-primary">
                        {formatCurrency(item.selling_price || 0, stats.currency, "id-ID")}
                      </TableCell>
                      <TableCell className="py-6 text-right">
                        <div className="flex flex-col items-end">
                          <span className={`text-sm font-black ${item.currentStock <= item.minStock ? 'text-destructive' : 'text-foreground'}`}>
                            {formatNumber(item.currentStock ?? 0)} {item.unit || 'units'}
                          </span>
                          {item.currentStock <= item.minStock && (
                            <span className="text-[9px] font-black uppercase tracking-tighter text-destructive mt-0.5">Threshold Alert</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-6 text-center">
                        <Badge variant="outline" className={`text-[9px] font-black tracking-[0.2em] rounded-lg border-none uppercase ${
                          item.status === 'ACTIVE' ? 'bg-success text-success' : 
                          item.status === 'DRAFT' ? 'bg-warning text-warning' : 
                          'bg-muted text-muted-foreground'
                        }`}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-6 text-right pr-8">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" className="h-8 w-8 p-0 rounded-xl hover:bg-primary/10">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 rounded-2xl border-none shadow-2xl p-2 bg-white dark:bg-muted">
                            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest opacity-40 px-4 py-3">Operations</DropdownMenuLabel>
                            <DropdownMenuItem className="rounded-xl px-4 py-3 text-xs font-bold cursor-pointer"><TrendingUp className="h-4 w-4 mr-3" /> Quick Adjustment</DropdownMenuItem>
                            <DropdownMenuItem className="rounded-xl px-4 py-3 text-xs font-bold cursor-pointer"><ArrowRightLeft className="h-4 w-4 mr-3" /> Execute Transfer</DropdownMenuItem>
                            <DropdownMenuItem className="rounded-xl px-4 py-3 text-xs font-bold cursor-pointer"><History className="h-4 w-4 mr-3" /> Movement Logs</DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-muted dark:bg-muted my-2 mx-2" />
                            <DropdownMenuItem className="rounded-xl px-4 py-3 text-xs font-bold cursor-pointer text-destructive hover:bg-destructive dark:hover:bg-destructive transition-colors"><Settings className="h-4 w-4 mr-3" /> Discontinue Item</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          {/* Pagination Controls */}
          <div className="p-6 border-t flex items-center justify-between bg-muted dark:bg-muted">
            <div className="flex items-center gap-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Showing <span className="text-foreground">{items.length}</span> of <span className="text-foreground">{formatNumber(totalCount)}</span> Items
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="h-10 px-4 rounded-xl border-muted text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
              >
                Previous
              </Button>
              
              <div className="flex items-center gap-1 mx-2">
                <span className="text-[10px] font-black text-primary uppercase">Page</span>
                <span className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">{page}</span>
                <span className="text-[10px] font-black text-muted-foreground uppercase">of {Math.ceil(totalCount / 30) || 1}</span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={items.length < 30 || page >= Math.ceil(totalCount / 30) || loading}
                className="h-10 px-4 rounded-xl border-muted text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-full p-8 space-y-10 bg-muted dark:bg-muted">
      {/* Tactical Header */}
      <div className="flex items-end justify-between border-b border-muted dark:border-muted pb-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-[0.3em]">
            <Layers className="h-3 w-3" /> LOGISTICS_ENGINE
          </div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic text-foreground">
            Stock Hub
          </h1>
          <p className="text-sm text-muted-foreground font-medium italic">Strategic inventory visibility and logistics command.</p>
        </div>
        {headerActions}
      </div>

      {mainContent}

      <ItemDetailsModal
        item={selectedItem}
        open={!!selectedItem}
        onOpenChange={(open) => !open && setSelectedItem(null)}
        onUpdated={fetchData}
        categories={categories}
      />

      <CreateItemDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={fetchData}
      />

      <ImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onSuccess={fetchData}
        endpoint="inventory/items/import"
        title="Bulk Inventory Import"
      />

      <ImportDialog
        open={isImageImportOpen}
        onOpenChange={setIsImageImportOpen}
        onSuccess={fetchData}
        type="IMAGES"
        endpoint="inventory/bulk-images"
        title="Bulk Image Upload"
      />

      <ExportDialog
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
      />

      <CategoryDialog
        open={isCategoryOpen}
        onOpenChange={setIsCategoryOpen}
        onSuccess={fetchData}
      />

      <InventoryAnalyticsDialog
        isOpen={isAnalyticsOpen}
        onOpenChange={setIsAnalyticsOpen}
      />
      <JobMonitorDialog 
        open={isJobMonitorOpen} 
        onOpenChange={setIsJobMonitorOpen} 
      />
    </div>
  );
}
