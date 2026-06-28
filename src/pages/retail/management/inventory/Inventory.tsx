import { useState, useCallback, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Search,
  Package,
  AlertTriangle,
  TrendingDown,
  RefreshCw,
  Plus,
  Minus,
  Truck,
  ClipboardList,
  ArrowUpDown,
  Edit,
  Trash2,
  CheckCircle,
  Barcode,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { useSession } from "@/core/security/session";
import { apiRequest } from "@/core/api/apiClient";
import { getMutationToastHandlers } from "@/lib/modal-helpers";
import { emitRetailPushEvent } from "@/modules/retail/api/retailGatewayPush";
import { retailService } from "@/core/services/retail/retailService";
import { RetailProduct } from "@/core/types/retail/retail";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { InventoryFilterHub } from "@/components/shared/InventoryFilterHub";
import { inventoryService } from "@/core/services/inventory/inventoryService";

// Types for inventory specific data
interface InventoryItem extends RetailProduct {
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  lastRestocked?: string;
  supplier?: string;
}

// ─── Zod Schemas for inventory dialogs ──────────────────────────────────────────

const addItemSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  category: z.string().min(1, "Category is required"),
  price: z.string().min(1, "Price is required"),
  barcode: z.string().optional().default(""),
  supplier: z.string().optional().default(""),
  stock: z.string().optional().default("0"),
  minStock: z.string().optional().default("10"),
  maxStock: z.string().optional().default("100"),
  reorderPoint: z.string().optional().default("20"),
});

type AddItemFormValues = z.infer<typeof addItemSchema>;

const adjustStockSchema = z.object({
  quantity: z.coerce.number().refine((v) => v !== 0, "Adjustment cannot be zero"),
  reason: z.string().min(1, "Reason is required"),
});

type AdjustStockFormValues = z.infer<typeof adjustStockSchema>;

const reorderSchema = z.object({
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
});

type ReorderFormValues = z.infer<typeof reorderSchema>;

const productCategories = ['Coffee', 'Merchandise', 'Gift Cards', 'Equipment'];

// Reorder request shape used by the local reorder workflow.
interface ReorderRequest {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  status: "pending" | "ordered" | "received";
  createdAt: string;
  supplier?: string;
}

// Reorder requests are created at runtime by the operator; no seeded sample data.
const initialReorderRequests: ReorderRequest[] = [];

const statusColors = {
  pending: "bg-warning text-warning border-warning/20",
  ordered: "bg-primary/10 text-primary border-primary",
  received: "bg-success text-success border-success/20",
};

const retailers = ["All", ...productCategories];
const suppliers = [
  "Bean Brothers",
  "Merch Supply Co",
  "Gift Direct",
  "Direct Import",
];

export default function RetailInventory() {
  const session = useSession();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [reorderRequests, setReorderRequests] = useState<ReorderRequest[]>(
    initialReorderRequests,
  );
  const [categories, setCategories] = useState<{id: string, name: string}[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [locations, setLocations] = useState<{id: string, name: string}[]>([]);
  const [selectedLocation, setSelectedLocation] = useState(session.location_id || "all");

  // Pagination state
  const PAGE_SIZE = 30;
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  // Debounce search input for server-side search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setCurrentPage(1); // Reset to first page on new search
    }, 400);
  }, []);

  // Map sort UI values to backend sort params
  const getSortParams = useCallback((sort: string) => {
    switch (sort) {
      case "stock-asc": return { sortBy: "quantity" as const, sortDir: "asc" as const };
      case "stock-desc": return { sortBy: "quantity" as const, sortDir: "desc" as const };
      case "value": return { sortBy: "price" as const, sortDir: "desc" as const };
      case "name":
      default: return { sortBy: "name" as const, sortDir: "asc" as const };
    }
  }, []);

  const fetchInventory = useCallback(async () => {
    setIsLoading(true);
    try {
      const sortParams = getSortParams(sortBy);
      const [invData, cats, locs] = await Promise.all([
        retailService.listInventory(session.tenant_id!, session, { 
          page: currentPage,
          pageSize: PAGE_SIZE,
          locationId: selectedLocation === "all" ? undefined : selectedLocation,
          categoryId: selectedCategory === "all" ? undefined : selectedCategory,
          q: debouncedSearch || undefined,
          sortBy: sortParams.sortBy,
          sortDir: sortParams.sortDir,
        }),
        inventoryService.listCategories(session.tenant_id!, session),
        inventoryService.listLocations(session.tenant_id!, session)
      ]);

      // Extract pagination meta from the response
      const meta = (invData as any)?.meta;
      if (meta) {
        setTotalItems(meta.total || 0);
      } else {
        setTotalItems((invData || []).length);
      }

      const mapped: InventoryItem[] = (invData || []).map(p => {
        const meta = (p.metadata ?? {}) as {
          min_stock?: number;
          max_stock?: number;
          reorder_point?: number;
          supplier?: string;
        };
        return {
          ...p,
          minStock: meta.min_stock || 5,
          maxStock: meta.max_stock || 100,
          reorderPoint: meta.reorder_point || 10,
          supplier: meta.supplier || "General",
          lastRestocked: p.updatedAt,
        };
      });
      setInventory(mapped);
      setCategories(cats || []);
      
      const locationMap = new Map<string, { id: string; name: string }>();
      (Array.isArray(locs) ? locs : []).forEach((loc: { id?: string; name?: string; code?: string }) => {
        if (!loc?.id) return;
        const name = loc.name || loc.code || loc.id;
        const nameKey = name.toLowerCase().trim();
        if (!locationMap.has(nameKey)) {
          locationMap.set(nameKey, { id: loc.id, name });
        }
      });
      setLocations(Array.from(locationMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      toast({
        title: "Sync Error",
        description: "Failed to pull live inventory logs.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [session.tenant_id, selectedLocation, selectedCategory, currentPage, debouncedSearch, sortBy, getSortParams]);

  useEffect(() => {
    if (session.tenant_id) {
      fetchInventory();
    }
  }, [session.tenant_id, fetchInventory]);

  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isReorderOpen, setIsReorderOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(
    null,
  );

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    price: "",
    stock: "",
    barcode: "",
    minStock: "5",
    maxStock: "100",
    reorderPoint: "10",
    supplier: "",
  });
  const [adjustQuantity, setAdjustQuantity] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [reorderQuantity, setReorderQuantity] = useState(20);

  // Calculate stats
  const lowStockItems = (Array.isArray(inventory) ? inventory : []).filter(
    (i) => i.stock !== undefined && i.stock <= i.reorderPoint,
  );
  const outOfStockItems = (Array.isArray(inventory) ? inventory : []).filter((i) => i.stock === 0);
  const totalValue = inventory.reduce(
    (sum, i) => sum + (i.stock || 0) * i.price,
    0,
  );
  const pendingOrders = (Array.isArray(reorderRequests) ? reorderRequests : []).filter(
    (r) => r.status !== "received",
  ).length;

  // Filter and sort inventory
  // Server handles: search (q), category, sorting, pagination
  // Client handles: stock status filter (low/critical/ok) as it's computed from metadata
  const filteredInventory = (Array.isArray(inventory) ? inventory : []).filter((item) => {
      if (filterStatus === "low")
        return (
          item.stock !== undefined &&
          item.stock <= item.reorderPoint
        );
      if (filterStatus === "critical") return item.stock === 0;
      if (filterStatus === "ok")
        return (
          item.stock !== undefined &&
          item.stock > item.reorderPoint
        );
      return true;
    });

  const getStockStatus = (item: InventoryItem) => {
    if (!item.stock || item.stock === 0)
      return {
        label: "Out of Stock",
        variant: "destructive" as const,
        color: "text-destructive",
      };
    if (item.stock <= item.reorderPoint)
      return {
        label: "Low Stock",
        variant: "secondary" as const,
        color: "text-warning",
      };
    return {
      label: "In Stock",
      variant: "default" as const,
      color: "text-success",
    };
  };

  const getStockPercent = (item: InventoryItem) => {
    if (!item.stock) return 0;
    return Math.min(100, (item.stock / item.maxStock) * 100);
  };

  // ─── useForm for Add/Edit ────────────────────────────────────────────────────
  const addEditForm = useForm<AddItemFormValues>({
    resolver: zodResolver(addItemSchema),
    defaultValues: {
      name: "",
      category: "",
      price: "",
      barcode: "",
      supplier: "",
      stock: "0",
      minStock: "10",
      maxStock: "100",
      reorderPoint: "20",
    },
  });

  // ─── useForm for Adjust Stock ──────────────────────────────────────────────
  const adjustForm = useForm<AdjustStockFormValues>({
    resolver: zodResolver(adjustStockSchema),
    defaultValues: { quantity: 0, reason: "" },
  });

  // ─── useForm for Reorder ───────────────────────────────────────────────────
  const reorderForm = useForm<ReorderFormValues>({
    resolver: zodResolver(reorderSchema),
    defaultValues: { quantity: 20 },
  });

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const addItemMutation = useMutation({
    mutationFn: async (data: AddItemFormValues) => {
      return retailService.createProduct(session.tenant_id!, session, {
        name: data.name,
        categoryId: data.category,
        price: parseFloat(data.price),
        barcode: data.barcode,
        metadata: {
          min_stock: parseInt(data.minStock),
          max_stock: parseInt(data.maxStock),
          reorder_point: parseInt(data.reorderPoint),
          supplier: data.supplier,
          stock_on_hand: parseInt(data.stock) || 0,
        },
      });
    },
    onSuccess: (newItem) => {
      const mapped: InventoryItem = {
        ...newItem,
        minStock: parseInt(addEditForm.getValues("minStock")),
        maxStock: parseInt(addEditForm.getValues("maxStock")),
        reorderPoint: parseInt(addEditForm.getValues("reorderPoint")),
        supplier: addEditForm.getValues("supplier"),
        lastRestocked: new Date().toISOString(),
      };
      setInventory((prev) => [...prev, mapped]);
      toast({ title: "Item added", description: `${mapped.name} has been added to inventory` });
      queryClient.invalidateQueries({ queryKey: ["retail", "inventory"] });
      setIsAddOpen(false);
      addEditForm.reset();
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create product on backend.", variant: "destructive" });
    },
  });

  const editItemMutation = useMutation({
    mutationFn: async (data: AddItemFormValues) => {
      if (!selectedProduct) throw new Error("No product selected");
      return retailService.updateProduct(session.tenant_id!, session, selectedProduct.id, {
        name: data.name,
        categoryId: data.category,
        price: parseFloat(data.price),
        barcode: data.barcode,
        metadata: {
          ...((selectedProduct.metadata as Record<string, unknown>) || {}),
          min_stock: parseInt(data.minStock),
          max_stock: parseInt(data.maxStock),
          reorder_point: parseInt(data.reorderPoint),
          supplier: data.supplier,
          stock_on_hand: parseInt(data.stock) || 0,
        },
      });
    },
    onSuccess: (updatedProduct) => {
      const mapped: InventoryItem = {
        ...updatedProduct,
        minStock: parseInt(addEditForm.getValues("minStock")),
        maxStock: parseInt(addEditForm.getValues("maxStock")),
        reorderPoint: parseInt(addEditForm.getValues("reorderPoint")),
        supplier: addEditForm.getValues("supplier"),
        lastRestocked: selectedProduct?.lastRestocked,
      };
      setInventory((prev) =>
        (Array.isArray(prev) ? prev : []).map((item) => (item.id === selectedProduct?.id ? mapped : item)),
      );
      toast({ title: "Item updated", description: `${addEditForm.getValues("name")} has been updated` });
      queryClient.invalidateQueries({ queryKey: ["retail", "inventory"] });
      setIsEditOpen(false);
      setSelectedProduct(null);
      addEditForm.reset();
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update product on backend.", variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProduct) throw new Error("No product selected");
      return retailService.deleteProduct(session.tenant_id!, session, selectedProduct.id);
    },
    onSuccess: () => {
      setInventory((prev) =>
        (Array.isArray(prev) ? prev : []).filter((item) => item.id !== selectedProduct?.id),
      );
      toast({ title: "Item deleted", description: `${selectedProduct?.name} has been removed from inventory` });
      queryClient.invalidateQueries({ queryKey: ["retail", "inventory"] });
      setIsDeleteOpen(false);
      setSelectedProduct(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove product from registry.", variant: "destructive" });
    },
  });

  const adjustStockMutation = useMutation({
    mutationFn: async (data: AdjustStockFormValues) => {
      if (!selectedProduct) throw new Error("No product selected");
      const previousStock = selectedProduct.stock || 0;
      const newStock = Math.max(0, previousStock + data.quantity);

      // Emit event for stock adjustment
      void emitRetailPushEvent({
        type: "inventory.stock.adjusted",
        tenantId: session.tenant_id,
        payload: {
          id: selectedProduct.id,
          name: selectedProduct.name,
          category: selectedProduct.category,
          previousStock,
          newStock,
          delta: data.quantity,
          reason: data.reason || "manual_adjustment",
        },
      });

      return { newStock, quantity: data.quantity };
    },
    onSuccess: (result) => {
      if (!selectedProduct) return;
      setInventory((prev) =>
        (Array.isArray(prev) ? prev : []).map((item) =>
          item.id === selectedProduct.id ? { ...item, stock: result.newStock } : item,
        ),
      );
      toast({
        title: "Stock adjusted",
        description: `${selectedProduct.name}: ${result.quantity > 0 ? "+" : ""}${result.quantity} units`,
      });
      queryClient.invalidateQueries({ queryKey: ["retail", "inventory"] });
      setIsAdjustOpen(false);
      setSelectedProduct(null);
      adjustForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to adjust stock.", variant: "destructive" });
    },
  });

  // Add new item (wired)
  const handleAddItem = () => {
    addEditForm.handleSubmit((data) => addItemMutation.mutate(data))();
  };

  // Edit item (wired)
  const handleEditItem = () => {
    addEditForm.handleSubmit((data) => editItemMutation.mutate(data))();
  };

  // Delete item (wired)
  const handleDeleteItem = () => {
    deleteItemMutation.mutate();
  };

  // Handle stock adjustment (wired)
  const handleAdjustStock = () => {
    adjustForm.handleSubmit((data) => adjustStockMutation.mutate(data))();
  };

  // Handle reorder request
  const handleCreateReorder = () => {
    if (!selectedProduct || reorderQuantity <= 0) return;

    const newRequest: ReorderRequest = {
      id: `RO-${String(reorderRequests.length + 1).padStart(3, "0")}`,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantity: reorderQuantity,
      status: "pending",
      createdAt: new Date().toISOString(),
      supplier: selectedProduct.supplier,
    };

    setReorderRequests((prev) => [newRequest, ...prev]);

    toast({
      title: "Reorder request created",
      description: `${reorderQuantity} units of ${selectedProduct.name} requested`,
    });

    setIsReorderOpen(false);
    setSelectedProduct(null);
    setReorderQuantity(20);
    reorderForm.reset();
  };

  // Update reorder status
  const updateReorderStatus = (
    id: string,
    status: ReorderRequest["status"],
  ) => {
    setReorderRequests((prev) =>
      (Array.isArray(prev) ? prev : []).map((r) => (r.id === id ? { ...r, status } : r)),
    );

    if (status === "received") {
      const request = reorderRequests.find((r) => r.id === id);
      if (request) {
        setInventory((prev) => {
          const next = (Array.isArray(prev) ? prev : []).map((item) =>
            item.id === request.productId
              ? {
                  ...item,
                  stock: (item.stock || 0) + request.quantity,
                  lastRestocked: new Date().toISOString(),
                }
              : item,
          );
          const updated = next.find((item) => item.id === request.productId);
          if (updated) {
            void emitRetailPushEvent({
              type: "inventory.stock.adjusted",
              tenantId: session.tenant_id,
              payload: {
                id: updated.id,
                name: updated.name,
                category: updated.category,
                previousStock: (updated.stock || 0) - request.quantity,
                newStock: updated.stock,
                delta: request.quantity,
                reason: "reorder.received",
                reorderId: request.id,
              },
            });
          }
          return next;
        });
        toast({
          title: "Stock received",
          description: `${request.quantity} units of ${request.productName} added to inventory`,
        });
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      category: "",
      price: "",
      stock: "",
      barcode: "",
      minStock: "5",
      maxStock: "100",
      reorderPoint: "10",
      supplier: "",
    });
  };

  const openEditDialog = (item: InventoryItem) => {
    setSelectedProduct(item);
    setFormData({
      name: item.name,
      category: item.category || "",
      price: item.price.toString(),
      stock: item.stock?.toString() || "0",
      barcode: item.barcode || "",
      minStock: item.minStock.toString(),
      maxStock: item.maxStock.toString(),
      reorderPoint: item.reorderPoint.toString(),
      supplier: item.supplier || "",
    });
    setIsEditOpen(true);
  };

  return (
    <div className="p-4 space-y-4 h-full flex flex-col">
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-xl font-bold">
                  {formatCurrency(totalValue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Low Stock</p>
                <p className="text-xl font-bold">{lowStockItems.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Out of Stock</p>
                <p className="text-xl font-bold">{outOfStockItems.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Truck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Orders</p>
                <p className="text-xl font-bold">{pendingOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Inventory List */}
        <Card className="flex-1 flex flex-col">
        <div className="p-4 bg-muted border-b border-white/5 rounded-t-[2rem]">
          <InventoryFilterHub 
            search={searchTerm}
            onSearchChange={handleSearchChange}
            category={selectedCategory}
            onCategoryChange={(val) => { setSelectedCategory(val); setCurrentPage(1); }}
            categories={categories}
            status={filterStatus}
            onStatusChange={setFilterStatus}
            location={selectedLocation}
            onLocationChange={(val) => { setSelectedLocation(val); setCurrentPage(1); }}
            locations={locations}
            sortBy={sortBy}
            onSortChange={(val) => { setSortBy(val); setCurrentPage(1); }}
            advancedActions={
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="h-14 px-6 rounded-2xl bg-muted border-white/10 text-white font-black italic uppercase text-[10px] tracking-widest gap-2"
                  onClick={() => {/* Category dialog */}}
                >
                  <Plus className="w-4 h-4" />
                  New Category
                </Button>
                <Button 
                  className="h-14 px-8 rounded-2xl bg-primary text-primary-foreground font-black italic uppercase text-xs tracking-widest gap-3 shadow-xl"
                  onClick={() => setIsAddOpen(true)}
                >
                  <Package className="w-5 h-5" />
                  Register Item
                </Button>
              </div>
            }
          />
        </div>
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-[calc(100vh-22rem)]">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mb-4" />
                  <p>Pulling inventory data...</p>
                </div>
              ) : (
                <div className="divide-y">
                {(Array.isArray(filteredInventory) ? filteredInventory : []).map((item) => {
                  const status = getStockStatus(item);
                  const stockPercent = getStockPercent(item);

                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 p-4 hover:bg-muted/50"
                    >
                      <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium truncate">{item.name}</h4>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-sm text-muted-foreground">
                            {item.barcode}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {item.supplier}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Progress
                            value={stockPercent}
                            className="h-2 flex-1"
                          />
                          <span
                            className={cn("text-sm font-medium", status.color)}
                          >
                            {item.stock} / {item.maxStock}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatCurrency(item.price)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Value:{" "}
                          {formatCurrency((item.stock || 0) * item.price)}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedProduct(item);
                            setIsAdjustOpen(true);
                          }}
                          title="Adjust Stock"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedProduct(item);
                            setReorderQuantity(
                              item.maxStock - (item.stock || 0),
                            );
                            setIsReorderOpen(true);
                          }}
                          title="Reorder"
                        >
                          <Truck className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(item)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          onClick={() => {
                            setSelectedProduct(item);
                            setIsDeleteOpen(true);
                          }}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
          {/* Pagination Controls */}
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-sm text-muted-foreground">
              Showing {filteredInventory.length > 0 ? ((currentPage - 1) * PAGE_SIZE) + 1 : 0}–{Math.min(currentPage * PAGE_SIZE, totalItems)} of {totalItems} items
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm font-medium px-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Reorder Requests Panel */}
        <Card className="w-80">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Reorder Requests
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-18rem)]">
              <div className="divide-y">
                {(Array.isArray(reorderRequests) ? reorderRequests : []).map((request) => (
                  <div key={request.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{request.id}</span>
                      <Badge
                        variant="outline"
                        className={statusColors[request.status]}
                      >
                        {request.status}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">{request.productName}</p>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Qty: {request.quantity}</span>
                      <span>{request.supplier}</span>
                    </div>
                    {request.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-2"
                        onClick={() =>
                          updateReorderStatus(request.id, "ordered")
                        }
                      >
                        Mark as Ordered
                      </Button>
                    )}
                    {request.status === "ordered" && (
                      <Button
                        size="sm"
                        className="w-full mt-2"
                        onClick={() =>
                          updateReorderStatus(request.id, "received")
                        }
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Receive Stock
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Add Item Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Item</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleAddItem(); }} noValidate>
            <fieldset disabled={addItemMutation.isPending} className="space-y-4">
            <div className="space-y-2">
              <Label>Product Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Enter product name"
                aria-invalid={addItemMutation.isError && !formData.name}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) =>
                    setFormData({ ...formData, category: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Array.isArray(productCategories) ? productCategories : []).map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Price *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Barcode/SKU</Label>
                <div className="relative">
                  <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={formData.barcode}
                    onChange={(e) =>
                      setFormData({ ...formData, barcode: e.target.value })
                    }
                    placeholder="Auto-generated if empty"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Select
                  value={formData.supplier}
                  onValueChange={(v) =>
                    setFormData({ ...formData, supplier: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Array.isArray(suppliers) ? suppliers : []).map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Initial Stock</Label>
                <Input
                  type="number"
                  value={formData.stock}
                  onChange={(e) =>
                    setFormData({ ...formData, stock: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Min Stock</Label>
                <Input
                  type="number"
                  value={formData.minStock}
                  onChange={(e) =>
                    setFormData({ ...formData, minStock: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Max Stock</Label>
                <Input
                  type="number"
                  value={formData.maxStock}
                  onChange={(e) =>
                    setFormData({ ...formData, maxStock: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Reorder At</Label>
                <Input
                  type="number"
                  value={formData.reorderPoint}
                  onChange={(e) =>
                    setFormData({ ...formData, reorderPoint: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={addItemMutation.isPending}
              onClick={() => {
                setIsAddOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={addItemMutation.isPending}>
              {addItemMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add Item
            </Button>
          </DialogFooter>
          </fieldset>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleEditItem(); }} noValidate>
            <fieldset disabled={editItemMutation.isPending} className="space-y-4">
            <div className="space-y-2">
              <Label>Product Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) =>
                    setFormData({ ...formData, category: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Array.isArray(productCategories) ? productCategories : []).map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Price *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Barcode/SKU</Label>
                <Input
                  value={formData.barcode}
                  onChange={(e) =>
                    setFormData({ ...formData, barcode: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Select
                  value={formData.supplier}
                  onValueChange={(v) =>
                    setFormData({ ...formData, supplier: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Array.isArray(suppliers) ? suppliers : []).map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Stock</Label>
                <Input
                  type="number"
                  value={formData.stock}
                  onChange={(e) =>
                    setFormData({ ...formData, stock: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Min</Label>
                <Input
                  type="number"
                  value={formData.minStock}
                  onChange={(e) =>
                    setFormData({ ...formData, minStock: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Max</Label>
                <Input
                  type="number"
                  value={formData.maxStock}
                  onChange={(e) =>
                    setFormData({ ...formData, maxStock: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Reorder</Label>
                <Input
                  type="number"
                  value={formData.reorderPoint}
                  onChange={(e) =>
                    setFormData({ ...formData, reorderPoint: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={editItemMutation.isPending}
              onClick={() => {
                setIsEditOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={editItemMutation.isPending}>
              {editItemMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Save Changes
            </Button>
          </DialogFooter>
          </fieldset>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to delete{" "}
            <strong>{selectedProduct?.name}</strong>? This action cannot be
            undone.
          </p>
          <DialogFooter>
            <Button variant="outline" disabled={deleteItemMutation.isPending} onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleteItemMutation.isPending} onClick={handleDeleteItem}>
              {deleteItemMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <form onSubmit={(e) => { e.preventDefault(); handleAdjustStock(); }} noValidate>
              <fieldset disabled={adjustStockMutation.isPending} className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Package className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">{selectedProduct.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Current stock: {selectedProduct.stock} units
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Adjustment Quantity</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setAdjustQuantity((q) => q - 1)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    value={adjustQuantity}
                    onChange={(e) =>
                      setAdjustQuantity(parseInt(e.target.value) || 0)
                    }
                    className="text-center"
                    aria-invalid={adjustQuantity === 0}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setAdjustQuantity((q) => q + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  New stock level:{" "}
                  {Math.max(0, (selectedProduct.stock || 0) + adjustQuantity)}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Reason</Label>
                <Select value={adjustReason} onValueChange={setAdjustReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="received">Stock Received</SelectItem>
                    <SelectItem value="damaged">Damaged/Expired</SelectItem>
                    <SelectItem value="count">Physical Count</SelectItem>
                    <SelectItem value="return">Customer Return</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" disabled={adjustStockMutation.isPending} onClick={() => setIsAdjustOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={adjustQuantity === 0 || !adjustReason || adjustStockMutation.isPending}
                >
                  {adjustStockMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Save Adjustment
                </Button>
              </DialogFooter>
              </fieldset>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Reorder Dialog */}
      <Dialog open={isReorderOpen} onOpenChange={setIsReorderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Reorder Request</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Package className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">{selectedProduct.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Supplier: {selectedProduct.supplier}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 border rounded-lg">
                  <p className="text-muted-foreground">Current Stock</p>
                  <p className="text-xl font-bold">{selectedProduct.stock}</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-muted-foreground">Max Stock</p>
                  <p className="text-xl font-bold">
                    {selectedProduct.maxStock}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Order Quantity</Label>
                <Input
                  type="number"
                  value={reorderQuantity}
                  onChange={(e) =>
                    setReorderQuantity(parseInt(e.target.value) || 0)
                  }
                />
                <p className="text-sm text-muted-foreground">
                  After receiving:{" "}
                  {(selectedProduct.stock || 0) + reorderQuantity} units
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReorderOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateReorder}
              disabled={reorderQuantity <= 0}
            >
              <Truck className="h-4 w-4 mr-2" />
              Create Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
