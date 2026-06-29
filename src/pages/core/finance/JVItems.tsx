import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/core/security/session";
import { apiRequest } from "@/core/api/apiClient";
import { formatNumber } from "@/lib/format";
import {
  Package,
  Search,
  Filter,
  Plus,
  MapPin,
  Tag,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface JVItem {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category_id: string;
  base_price: number;
  selling_price: number;
  status: string;
  stock_levels?: { on_hand: number; reserved: number; available: number }[];
}

interface SessionContext {
  tenant_id: string;
  user_id: string;
  role: string;
  branch_id?: string;
  company_id?: string;
}

export default function JVItems() {
  const session = useSession();
  const [items, setItems] = useState<JVItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [locationName, setLocationName] = useState<string>("");
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  const loadItems = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (search) params.set("search", search);
      if (selectedCategory) params.set("category_id", selectedCategory);

      const result = await apiRequest<any>(
        `/v1/inventory/items?${params}`,
        "GET",
        session as SessionContext
      );
      setItems(result?.data || []);
      setTotalCount(result?.meta?.total || 0);
    } catch (e) {
      console.error("Failed to load JV items", e);
    } finally {
      setLoading(false);
    }
  }, [session, search, selectedCategory]);

  // Load location name and categories
  useEffect(() => {
    if (!session) return;

    // Load categories
    apiRequest<any>("/v1/inventory/categories", "GET", session as SessionContext)
      .then((res) => setCategories(res?.data || []))
      .catch(() => {});

    // Try to get branch name from stores
    const jvCtx = localStorage.getItem("zenvix_jv_context");
    if (jvCtx) {
      try {
        const parsed = JSON.parse(jvCtx);
        setLocationName(parsed.hostName || "JV Branch");
      } catch {}
    }
  }, [session]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const getStockBadge = (item: JVItem) => {
    const stock = item.stock_levels?.[0];
    if (!stock) return <Badge variant="outline" className="text-[10px] text-muted-foreground">No Stock Data</Badge>;
    const available = Number(stock.available || 0);
    if (available <= 0) return <Badge className="bg-destructive/20 text-destructive text-[10px]">Out of Stock</Badge>;
    if (available < 5) return <Badge className="bg-warning/20 text-warning text-[10px]">Low ({available})</Badge>;
    return <Badge className="bg-success/20 text-success text-[10px]">{available} available</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="JV Item Catalog"
        subtitle={`Items stocked at ${locationName || "your JV branch"}. Both host and partner items shown.`}
        primaryAction={
          <Button className="gap-2" onClick={() => window.location.href = "/core/inventory"}>
            <Plus className="h-4 w-4" />
            Add Item via Inventory
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <div className="flex items-center gap-3">
            <Package className="h-8 w-8 text-primary opacity-60" />
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase">Total Items</p>
              <p className="text-2xl font-black text-primary">{totalCount}</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <div className="flex items-center gap-3">
            <MapPin className="h-8 w-8 text-success opacity-60" />
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase">Branch Location</p>
              <p className="text-lg font-bold text-foreground">{locationName || "Auto-scoped"}</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-warning opacity-60" />
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase">Low Stock</p>
              <p className="text-2xl font-black text-warning">
                {items.filter(i => {
                  const avail = Number(i.stock_levels?.[0]?.available || 0);
                  return avail > 0 && avail < 5;
                }).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items by name, SKU, barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={selectedCategory === "" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("")}
          >
            All Categories
          </Button>
          {categories.slice(0, 5).map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat.id)}
              className="gap-1"
            >
              <Tag className="h-3 w-3" />
              {cat.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Items Table */}
      <WorkspacePanel>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading items...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-lg font-semibold text-muted-foreground">No items found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add items through the Inventory module and stock them at this location.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Item</th>
                <th className="p-3 text-left">SKU</th>
                <th className="p-3 text-left">Category</th>
                <th className="p-3 text-right">Base Price</th>
                <th className="p-3 text-right">Selling Price</th>
                <th className="p-3 text-center">Stock</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="p-3">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{item.barcode}</div>
                  </td>
                  <td className="p-3 font-mono text-xs">{item.sku}</td>
                  <td className="p-3">
                    <Badge variant="outline" className="text-[10px]">
                      {categories.find(c => c.id === item.category_id)?.name || "—"}
                    </Badge>
                  </td>
                  <td className="p-3 text-right font-mono">
                    Rp {formatNumber(Number(item.base_price || 0))}
                  </td>
                  <td className="p-3 text-right font-mono font-semibold">
                    Rp {formatNumber(Number(item.selling_price || 0))}
                  </td>
                  <td className="p-3 text-center">{getStockBadge(item)}</td>
                  <td className="p-3 text-center">
                    <Badge
                      className={cn(
                        "text-[10px]",
                        item.status === "active"
                          ? "bg-success/20 text-success"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {item.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </WorkspacePanel>
    </div>
  );
}
