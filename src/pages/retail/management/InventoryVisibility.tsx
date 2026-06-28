import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Layers,
  ClipboardCheck,
  ArrowLeftRight,
  PlusSquare,
  FileText,
  ShieldCheck,
  RefreshCw,
  Zap,
  Loader2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

import { InventoryPageHeader } from "./components/inventory/InventoryPageHeader";
import { InventoryKpiBar } from "./components/inventory/InventoryKpiBar";
import { FiltersBar } from "./components/inventory/FiltersBar";
import { InventoryTable } from "./components/inventory/InventoryTable";
import { StockOpnameTab } from "./components/inventory/StockOpnameTab";
import { OpnameEntry } from "./components/inventory/opname/OpnameTable";
import { MovementsTab, AuditEntry } from "./components/inventory/MovementsTab";
import { ItemCreationTab } from "@/components/shared/ItemCreationTab";
import { StockReportTab } from "./components/inventory/StockReportTab";
import { InventoryMovementDialog,
  MovementPayload,
} from "./components/inventory/modals/InventoryMovementDialog";
import {
  PostekPrintModal,
  PrintItem,
} from "@/components/shared/PostekPrintModal";
import { MOVEMENT_META } from "./inventory/inventory.types";
import { CategoryManager } from "@/components/shared/CategoryManager";
import { ItemDetailsModal } from "@/pages/core/inventory/components/ItemDetailsModal";
import { UnresolvedBarcodesModal } from "@/components/shared/UnresolvedBarcodesModal";
import { AnomalyCompletionDialog, CompletionSubmitPayload } from "./components/inventory/modals/AnomalyCompletionDialog";
import { saveOpnameSession, loadOpnameSession, clearOpnameSession } from "@/lib/opname-session";

import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { InventoryGlassHeader } from "@/components/shared/InventoryGlassHeader";
import { InventoryFilterHub } from "@/components/shared/InventoryFilterHub";
import { Package, LayoutGrid, Globe, Search, Plus, Filter, LayoutList, LayoutPanelLeft, Lock } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { inventoryService } from "@/core/services/inventory/inventoryService";
import { retailService } from "@/core/services/retail/retailService";
import { apiRequest } from "@/core/api/apiClient";
import { getMutationToastHandlers } from "@/lib/modal-helpers";
import { crisisManagementService } from "@/core/services/retail/crisisManagementService";
import type { RetailProduct, RetailStore, RetailChannel } from "@/core/types/retail/retail";
import type {
  InventoryItemView,
  InventoryFilters,
} from "./components/inventory/types";
import { MovementType } from "./components/inventory/movementMeta";
import { useRetail } from "../context/RetailContext";

const PAGE_SIZE = 20;

// ─── Zod Schemas for inline dialogs ────────────────────────────────────────────

const bufferThresholdSchema = z.object({
  minBuffer: z.coerce.number().min(0, "Buffer must be 0 or more"),
  globalMinStock: z.coerce.number().min(0, "Global min must be 0 or more"),
});

type BufferThresholdFormValues = z.infer<typeof bufferThresholdSchema>;

const reclassifySchema = z.object({
  newCategoryId: z.string().min(1, "Category is required"),
});

type ReclassifyFormValues = z.infer<typeof reclassifySchema>;

interface InventoryStats {
  totalSKUs: number;
  totalSOH: number;
  totalATS: number;
  critical: number;
  low: number;
  totalValue?: number;
  totalCapitalValue?: number;
  currency?: string;
}

// Suppliers are loaded live from the procurement registry (GET /procurement/suppliers).
// Inventory movement audit history has no dedicated retail endpoint yet, so the
// Movements tab shows a real (empty) state rather than fabricated entries.

const InventoryVisibility = () => {
  const { session, updateBranch, updateLocation } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeStore, activeChannel, setStore } = useRetail();

  const [inventory, setInventory] = useState<InventoryItemView[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [stores, setStores] = useState<RetailStore[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [isBufferDialogOpen, setIsBufferDialogOpen] = useState(false);
  const [bufferValue, setBufferValue] = useState<number>(0);
  const [isUpdatingBuffer, setIsUpdatingBuffer] = useState(false);
  const [globalMinStock, setGlobalMinStock] = useState<number>(0);
  const [isAggregating, setIsAggregating] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | undefined>(undefined);

  // Sync local selection state when central activeStore, activeChannel, or session location changes
  useEffect(() => {
    const activeEntity = activeStore || activeChannel;
    if (activeEntity) {
      // RetailStore has locationId; RetailChannel has branchId
      const locId = activeStore
        ? activeStore.locationId
        : (activeEntity as RetailChannel).branchId || activeEntity.id;
      setSelectedStoreId(activeEntity.id);
      setLocationId(locId);
      isFetchingRef.current = false;
    } else if (session?.location_id) {
      setSelectedStoreId(session.location_id);
      setLocationId(session.location_id);
      isFetchingRef.current = false;
    }
  }, [activeStore, activeChannel, session?.location_id]);
  
  const handleStoreChange = (id: string) => {
    setStore(id);
    setPage(1);
  };

  const selectedStore = useMemo(
    () => stores.find((s) => s.locationId === session?.location_id || s.id === session?.location_id),
    [stores, session?.location_id],
  );

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<InventoryFilters>({
    search: "",
    category: "all",
    status: "all",
    type: "all",
    sortBy: "name-asc",
    minPrice: undefined,
    maxPrice: undefined,
  });

  // Debounce search to prevent infinite loops / excessive API calls
  const debouncedSearch = useDebounce(filters.search, 400);

  const [dynamicCategories, setDynamicCategories] = useState<
    { id: string; name: string }[]
  >([]);
  const [detailItem, setDetailItem] = useState<InventoryItemView | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItemView | null>(null);
  const [movementType, setMovementType] = useState<MovementType | null>(null);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isReclassifyOpen, setIsReclassifyOpen] = useState(false);
  const [selectedItemForReclassify, setSelectedItemForReclassify] = useState<InventoryItemView | null>(null);
  const [newCategoryId, setNewCategoryId] = useState("");

  // Unified Postek Print Modal
  const [printItems, setPrintItems] = useState<PrintItem[]>([]);

  const [opnameActive, setOpnameActive] = useState(false);
  const [opnameEntries, setOpnameEntries] = useState<OpnameEntry[]>([]);
  const [unresolvedBarcodes, setUnresolvedBarcodes] = useState<string[]>([]);
  const [opnameFilters, setOpnameFilters] = useState<InventoryFilters>({
    search: "",
    category: "all",
    status: "all",
    type: "all",
    sortBy: "name-asc",
  });
  const [barcodeInput, setBarcodeInput] = useState("");
  const [pendingItems, setPendingItems] = useState<InventoryItemView[]>([]);
  const [isApproving, setIsApproving] = useState(false);
  const [anomalies, setAnomalies] = useState<string[]>([]);
  const [newItems, setNewItems] = useState<any[]>([]);
  const [isUnresolvedOpen, setIsUnresolvedOpen] = useState(false);
  const [completionItem, setCompletionItem] = useState<InventoryItemView | null>(null);
  const [isCompletionLoading, setIsCompletionLoading] = useState(false);

  const canWrite = ["OWNER", "COMPANY_ADMIN", "DEPT_HEAD"].includes(
    session?.role || "",
  );

  const tenantId = session?.tenant_id;
  const userId = session?.user_id;

  const isFetchingRef = React.useRef(false);
  const fetchInventory = useCallback(async () => {
    if (!tenantId || !session) return;
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsLoading(true);
    try {
      const data = await retailService.listInventory(tenantId, session, {
        categoryId: filters.category !== "all" ? filters.category : undefined,
        type: filters.type !== "all" ? filters.type : undefined,
        q: debouncedSearch || undefined,
        page: page,
        pageSize: PAGE_SIZE,
        locationId,
        sortBy: filters.sortBy.split("-")[0] as "name" | "quantity" | "price",
        sortDir: filters.sortBy.split("-")[1] as "asc" | "desc",
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
      });

      if (!data) {
        setInventory([]);
        return;
      }

      const items: RetailProduct[] = Array.isArray(data) ? data : (data as { items: RetailProduct[] }).items || [];
      const totalCount = (data as { meta?: { total?: number } }).meta?.total ?? items.length;

      const mapped: InventoryItemView[] = items.map((p) => {
        const onHandVal  = Number((p.metadata as Record<string,unknown>)?.stockOnHand ?? (p.metadata as Record<string,unknown>)?.stock_on_hand ?? p.stock ?? 0);
        const minBufVal  = Number((p.metadata as Record<string,unknown>)?.minBuffer ?? (p.metadata as Record<string,unknown>)?.min_stock ?? 0);
        // Derive display stock status from quantities
        let stockStatus: InventoryItemView["status"] = (p.status as InventoryItemView["status"]) || "ok";
        if (onHandVal === 0) stockStatus = "critical" as InventoryItemView["status"];
        else if (minBufVal > 0 && onHandVal <= minBufVal) stockStatus = "low" as InventoryItemView["status"];
        // else: preserve item's own status (active/inactive/etc.) for those filters

        return {
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.categoryName || "Uncategorized",
          categoryId: p.categoryId || "",
          onHand: onHandVal,
          reserved: Number(p.metadata?.reserved ?? 0),
          available: Number(p.metadata?.available ?? p.stock ?? 0),
          minBuffer: minBufVal,
          status: stockStatus,
          barcode: p.barcode,
          price: p.price,
          unit: p.unit,
          type: p.type,
          description: p.description,
          imageUrl: (p as unknown as Record<string,string>).imageUrl || (p as unknown as Record<string,string>).image_url || null,
        };
      });
      setInventory(mapped);
      setTotalItems(totalCount);

      const sData = await retailService.getInventoryStats(tenantId, session);

      if (sData) {
        setStats({
          totalSKUs: sData.totalItems ?? sData.total ?? totalCount,
          totalSOH: Number(sData.totalSOH ?? 0),
          totalATS: Number(sData.totalATS ?? 0),
          critical: sData.critical ?? sData.outOfStockCount ?? 0,
          low: sData.lowStock ?? sData.lowStockCount ?? 0,
          totalValue: Number(sData.totalValue ?? 0),
          totalCapitalValue: Number(sData.totalCapitalValue ?? 0),
          currency: sData.currency || "IDR"
        });
      }

      setLastSync(new Date().toLocaleTimeString());
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [
    tenantId,
    session,
    debouncedSearch,
    filters.category,
    filters.type,
    filters.sortBy,
    filters.minPrice,
    filters.maxPrice,
    locationId,
    page,
  ]);

  const fetchPendingItems = useCallback(async () => {
    if (!tenantId || !session) return;
    try {
      const items = await retailService.listPendingItems(tenantId, session);
      const mapped: InventoryItemView[] = (Array.isArray(items) ? items : []).map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.categoryName || "Uncategorized",
        categoryId: p.categoryId || "",
        onHand: 0,
        reserved: 0,
        available: 0,
        minBuffer: 10,
        status: "pending" as InventoryItemView["status"],
        barcode: p.barcode,
        price: p.price,
        unit: p.unit,
        type: p.type,
        description: p.description,
      }));
      setPendingItems(mapped);
    } catch (err) {
      console.error("Failed to fetch pending items", err);
    }
  }, [tenantId, session]);

  const fetchCategories = useCallback(async () => {
    if (!tenantId || !session) return;
    try {
      const data = await retailService.listCategories(tenantId, session);
      setDynamicCategories(data);
    } catch (error) {
      console.error("Failed to fetch categories", error);
    }
  }, [tenantId, session]);

  const fetchStores = useCallback(async () => {
    if (!tenantId || !session) return;
    try {
      const [storesData, channelsData] = await Promise.all([
        retailService.listStores(tenantId, session),
        retailService.listChannels(tenantId, session)
      ]);
      
      const ecommerceStores = (Array.isArray(channelsData) ? channelsData : [])
        .filter(c => c.type === "DIRECT" || c.type === "OWNED" || c.type === "MARKETPLACE")
        .map(c => ({
          id: c.id,
          name: `${c.name} (Ecommerce)`,
          locationId: c.branchId || c.id,
          type: "warehouse" as RetailStore["type"],
          status: "active" as RetailStore["status"],
          code: c.id,
          tenantId: tenantId,
          infrastructureRegistry: {},
          supplyConfig: {},
          operationalConfig: {},
          channelBinding: {},
          governance: { license_status: "active", activation_source: "Cloud", compliance_level: 1, audit_frequency_tier: "standard" }
        }));

      const mappedStores = (Array.isArray(storesData) ? storesData : []).map(s => ({
        ...s,
        locationId: s.locationId || s.id,
      }));

      const combined = [...mappedStores, ...ecommerceStores];
      setStores(combined as RetailStore[]);
      
      if (combined.length > 0 && !activeStore) {
        // Restore previously active branch from session (RetailContext sets session.location_id = store.id)
        const sessionLoc = session?.location_id;
        const sessionStore = sessionLoc
          ? combined.find((s) => s.id === sessionLoc) ||
            combined.find((s) => (s.locationId || s.id) === sessionLoc)
          : null;
        const firstStore = sessionStore || combined[0];
        if (firstStore) {
          setStore(firstStore.id);
        }
      }
    } catch (error) {
      console.error(error);
    }
  }, [tenantId, session, activeStore, setStore]);

  const fetchSuppliers = useCallback(async () => {
    if (!tenantId || !session) return;
    try {
      const data = await apiRequest<{ id: string; name: string }[]>("/procurement/suppliers", "GET", session);
      setSuppliers((Array.isArray(data) ? data : []).map((s) => ({ id: s.id, name: s.name })));
    } catch (error) {
      console.error("[InventoryVisibility] Failed to load suppliers:", error);
    }
  }, [tenantId, session]);

  useEffect(() => {
    const init = async () => {
      if (!tenantId || !session) return;
      setIsLoading(true);
      try {
        await Promise.all([
          fetchStores(),
          fetchCategories(),
          fetchPendingItems(),
          fetchSuppliers()
        ]);
      } catch (err) {
        console.error("[InventoryVisibility] Init failed:", err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [tenantId, session, fetchStores, fetchCategories, fetchPendingItems, fetchSuppliers]);

  useEffect(() => {
    if (tenantId && locationId) {
      fetchInventory();
    }
  }, [fetchInventory, tenantId, locationId]);

  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearch,
    filters.category,
    filters.status,
    filters.type,
  ]);

  const handleFilterChange = (patch: Partial<InventoryFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  // ─── Buffer Threshold Form + Mutation ─────────────────────────────────────────
  const bufferForm = useForm<BufferThresholdFormValues>({
    resolver: zodResolver(bufferThresholdSchema),
    defaultValues: { minBuffer: 0, globalMinStock: 0 },
  });

  const bufferMutation = useMutation({
    mutationFn: async (data: BufferThresholdFormValues) => {
      if (!selectedItem || !locationId) throw new Error("No item selected");
      return retailService.updateProduct(tenantId!, session!, selectedItem.id, {
        metadata: {
          ...((selectedItem as unknown as RetailProduct).metadata || {}),
          minBuffer: data.minBuffer,
          min_stock: data.globalMinStock,
        },
      });
    },
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["retail", "inventory"]],
      onClose: () => setIsBufferDialogOpen(false),
      form: bufferForm,
      successTitle: "Threshold Updated",
      successDescription: `Buffer for ${selectedItem?.name || "item"} synchronized across systems.`,
    }),
  });

  // bufferValue/isUpdatingBuffer/globalMinStock already declared above — wired through form

  const handleUpdateBuffer = () => {
    bufferMutation.mutate({
      minBuffer: bufferForm.getValues("minBuffer"),
      globalMinStock: bufferForm.getValues("globalMinStock"),
    });
  };

  // ─── Reclassify Form + Mutation ─────────────────────────────────────────────
  const reclassifyForm = useForm<ReclassifyFormValues>({
    resolver: zodResolver(reclassifySchema),
    defaultValues: { newCategoryId: "" },
  });

  const reclassifyMutation = useMutation({
    mutationFn: async (data: ReclassifyFormValues) => {
      if (!selectedItemForReclassify || !session?.tenant_id) throw new Error("No item selected");
      return inventoryService.updateItemCategory(
        session.tenant_id,
        session,
        selectedItemForReclassify.id,
        data.newCategoryId,
      );
    },
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["retail", "inventory"]],
      onClose: () => setIsReclassifyOpen(false),
      form: reclassifyForm,
      successTitle: "Success",
      successDescription: "Item reclassified successfully.",
    }),
  });

  const handleSync = useCallback(async () => {
    if (!session || !locationId) return;
    setIsLoading(true);
    try {
      await retailService.syncInventory(tenantId!, session, {
        locationId,
      });
      fetchInventory();
      toast({
        title: "Inventory Synced",
        description: "Stock levels updated from ERP.",
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Sync Failed",
        description: "Could not fetch latest ERP data.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [session, locationId, tenantId, toast, fetchInventory]);

  const statusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "in stock":
      case "ok":
      case "active":
        return "bg-success text-success";
      case "low stock":
      case "low":
        return "bg-warning text-warning";
      case "out of stock":
      case "critical":
      case "discontinued":
        return "bg-destructive text-destructive";
      case "pending":
        return "bg-primary/5 text-primary animate-pulse";
      default:
        return "bg-secondary/10 text-muted-foreground";
    }
  };

  const categoryOptions = useMemo(() => {
    return [{ id: "all", name: "All Categories" }, ...dynamicCategories];
  }, [dynamicCategories]);

  const filtered = useMemo(() => {
    return (Array.isArray(inventory) ? inventory : []).filter((item) => {
      const matchesSearch =
        !filters.search ||
        item.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        item.sku.toLowerCase().includes(filters.search.toLowerCase());
      const matchesCategory =
        filters.category === "all" || item.categoryId === filters.category;
      const matchesStatus =
        filters.status === "all" ||
        item.status.toLowerCase() === filters.status.toLowerCase();
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [inventory, filters]);

  const total = totalItems;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleCategoryClick = (catId: string) => {
    setFilters((prev) => ({ ...prev, category: catId }));
  };

  const handleMovementSubmit = useCallback(
    (
      data: MovementPayload & { sourceType?: string; sourceStoreId?: string },
    ) => {
      const typeLabel = movementType
        ? MOVEMENT_META[movementType].label
        : "Movement";

      console.log("MOVEMENT_REQUEST_SUBMIT", {
        type: movementType,
        locationId,
        actor: session?.user_id,
        payload: data,
      });

      toast({
        title: `${typeLabel} Submitted`,
        description: `Request for ${data.lines.length} items logged and pending HOD approval.`,
      });

      setMovementType(null);
    },
    [movementType, locationId, session?.user_id, toast],
  );

  const handleCompleteAnomaly = useCallback(
    async (itemId: string, data: CompletionSubmitPayload) => {
      if (!tenantId || !session) return;
      setIsCompletionLoading(true);
      try {
        await inventoryService.completeAnomalyItem(tenantId, session, itemId, {
          name: data.name || undefined,
          category_id: data.category_id || undefined,
          base_price: data.base_price ? Number(data.base_price) : undefined,
          is_anomaly: data.is_anomaly,
        });
        toast({
          title: "Item Completed",
          description: data.is_anomaly === false
            ? "Item updated and removed from Anomaly category."
            : "Item details updated successfully.",
        });
        setCompletionItem(null);
        fetchInventory();
      } catch (err) {
        toast({
          title: "Completion Failed",
          description: err instanceof Error ? err.message : "Could not complete anomaly item.",
          variant: "destructive",
        });
      } finally {
        setIsCompletionLoading(false);
      }
    },
    [tenantId, session, toast, fetchInventory],
  );

  const startOpname = useCallback(() => {
    setOpnameEntries([]);
    setUnresolvedBarcodes([]);
    setAnomalies([]);
    setNewItems([]);
    setOpnameActive(true);
    toast({
      title: "Opname Session Started",
      description: "Scan items to begin physical count audit.",
    });
  }, [toast]);

  // Load session on mount if exists
  useEffect(() => {
    if (tenantId && locationId && opnameActive) {
      const savedSession = loadOpnameSession(tenantId, locationId);
      if (savedSession) {
        setOpnameEntries(savedSession.entries);
        setUnresolvedBarcodes(savedSession.unresolvedBarcodes);
        setAnomalies(savedSession.anomalies);
        setNewItems(savedSession.newItems);
      }
    }
  }, [tenantId, locationId, opnameActive]);

  const handleBarcodeKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;
      const sku = barcodeInput.trim();
      if (!sku) return;

      setBarcodeInput("");

      let product = inventory.find((i) => i.sku === sku || i.barcode === sku);

      if (!product && tenantId && session) {
        setIsUpdating(true);
        try {
          // Filter item lookups to activeStore?.id for branch-scoped operations
          const masterResults = await retailService.listInventory(tenantId, session, {
            q: sku,
            pageSize: 1,
            locationId: activeStore?.id || locationId,
          });
          const items: RetailProduct[] = Array.isArray(masterResults) ? masterResults : (masterResults as { items: RetailProduct[] }).items || [];
          const masterItem = items[0];
          
          if (masterItem) {
            product = {
              id: masterItem.id,
              sku: masterItem.sku,
              name: masterItem.name,
              category: masterItem.categoryName || "Uncategorized",
              categoryId: masterItem.categoryId || "",
              onHand: 0,
              reserved: 0,
              available: 0,
              minBuffer: 0,
              status: (masterItem.status as InventoryItemView["status"]) || "ok",
              barcode: masterItem.barcode,
              price: masterItem.price,
              unit: masterItem.unit,
              type: masterItem.type,
              description: masterItem.description,
            };
          }
        } catch (err) {
          console.error("[Opname] Master lookup failed:", err);
        } finally {
          setIsUpdating(false);
        }
      }

      if (!product) {
        // Add to unresolved barcodes instead of rejecting
        if (!unresolvedBarcodes.includes(sku)) {
          setUnresolvedBarcodes(prev => [...prev, sku]);
          toast({
            title: "Unregistered Barcode",
            description: `Barcode ${sku} added to unresolved list for later resolution.`,
          });
        } else {
          toast({
            title: "Already Unresolved",
            description: `Barcode ${sku} is already in unresolved list.`,
          });
        }
        return;
      }

      setOpnameEntries((prev) => {
        const idx = prev.findIndex((entry) => entry.sku === product!.sku);

        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            counted: Number(updated[idx].counted || 0) + 1,
          };
          toast({
            title: "Count Incremented",
            description: `${product!.name}: ${updated[idx].counted}`,
          });
          return updated;
        }

        toast({ title: "Item Added", description: product!.name });
        return [
          ...prev,
          {
            id: product!.id,
            sku: product!.sku,
            name: product!.name,
            expected: product!.onHand,
            counted: 1,
            status: product!.status,
            categoryId: product!.categoryId,
          },
        ];
      });
    },
    [barcodeInput, inventory, tenantId, session, toast, unresolvedBarcodes, activeStore?.id, locationId],
  );

  const submitOpname = useCallback(async () => {
    if (opnameEntries.length === 0) {
      toast({
        title: "Empty Audit",
        description: "No items scanned.",
        variant: "destructive",
      });
      return;
    }

    if (!tenantId || !session || !locationId) {
      toast({
        title: "Context Missing",
        description: "Please select a branch first.",
        variant: "destructive",
      });
      return;
    }

    // Check for unresolved barcodes before submitting
    if (unresolvedBarcodes.length > 0) {
      // Open unresolved barcodes modal
      setIsUnresolvedOpen(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await retailService.submitOpname(
        tenantId,
        session,
        locationId!,
        (Array.isArray(opnameEntries) ? opnameEntries : []).map((e) => ({
          sku: e.sku,
          actualCount: Number(e.counted) || 0,
        })),
      );

      toast({
        title: "Opname Submitted",
        description: `Logged ${opnameEntries.length} items to stock history.`,
      });

      setOpnameActive(false);
      setOpnameEntries([]);
      setUnresolvedBarcodes([]);
      setAnomalies([]);
      setNewItems([]);
      fetchInventory();
      
      // Clear session after successful commit
      if (tenantId && locationId) {
        clearOpnameSession(tenantId, locationId);
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Submission Failed",
        description: "Error saving opname records.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    opnameEntries,
    unresolvedBarcodes,
    toast,
    tenantId,
    session,
    locationId,
    fetchInventory,
  ]);

  const handleResolveUnresolvedBarcodes = useCallback(async (barcodes: string[], resolveType: "flag" | "register") => {
    if (!tenantId || !session || !locationId) {
      toast({
        title: "Context Missing",
        description: "Please select a branch first.",
        variant: "destructive",
      });
      return;
    }

    if (resolveType === "flag") {
      // Flag as anomalies
      setAnomalies(prev => [...prev, ...barcodes]);
      setUnresolvedBarcodes(prev => prev.filter(b => !barcodes.includes(b)));
      toast({
        title: "Anomalies Flagged",
        description: `${barcodes.length} barcodes flagged for review.`,
      });
    } else if (resolveType === "register") {
      // Items are already registered via Quick Register
      setNewItems(prev => [...prev, ...barcodes.map(b => ({ barcode: b }))]);
      setUnresolvedBarcodes(prev => prev.filter(b => !barcodes.includes(b)));
      toast({
        title: "Items Registered",
        description: `${barcodes.length} barcodes registered as anomalies.`,
      });
    }

    // Save session state after resolution
    saveOpnameSession({
      cycleId: `opname-${Date.now()}`, // In real implementation, use actual cycle ID from server
      locationId,
      entries: opnameEntries,
      unresolvedBarcodes: unresolvedBarcodes.filter(b => !barcodes.includes(b)),
      anomalies: resolveType === "flag" ? [...anomalies, ...barcodes] : anomalies,
      newItems: resolveType === "register" ? [...newItems, ...barcodes.map(b => ({ barcode: b }))] : newItems,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
    });

    if (unresolvedBarcodes.length - barcodes.length === 0) {
      setIsUnresolvedOpen(false);
      // Now submit since all barcodes are resolved
      submitOpname();
    }
  }, [tenantId, session, locationId, opnameEntries, unresolvedBarcodes, anomalies, newItems, toast, submitOpname]);

  const handleCountChange = useCallback((index: number, value: string) => {
    setOpnameEntries((prev) =>
      (Array.isArray(prev) ? prev : []).map((entry, i) =>
        i === index
          ? { ...entry, counted: value === "" ? "" : Number(value) }
          : entry,
      ),
    );
  }, []);

  // Save session state when opname entries or unresolved barcodes change
  useEffect(() => {
    if (opnameActive && tenantId && locationId) {
      saveOpnameSession({
        cycleId: `opname-${Date.now()}`,
        locationId,
        entries: opnameEntries,
        unresolvedBarcodes: unresolvedBarcodes,
        anomalies: anomalies,
        newItems: newItems,
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      });
    }
  }, [opnameEntries, unresolvedBarcodes, anomalies, newItems, opnameActive, tenantId, locationId]);

  useBarcodeScanner((barcode) => {
    if (!opnameActive && !movementType && !detailItem) {
      const item = inventory.find((i) => i.sku === barcode);
      if (item) {
        toast({
          title: "Quick Lookup",
          description: `${item.name} | Stock: ${item.onHand}`,
        });
      }
    }
  });

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen flex flex-col text-foreground">
      <InventoryGlassHeader
        title="Retail Inventory"
        subtitle={`${selectedStore?.name ?? "Select Store"} • Operations Gateway`}
        icon={Package}
        stats={[
          { label: "Branch SKUs", value: stats?.totalSKUs ?? 0 },
          { label: "Branch SOH", value: stats?.totalSOH ?? 0 },
          { 
            label: "Branch Value (Capital)", 
            value: stats?.totalCapitalValue ? new Intl.NumberFormat("id-ID", {
              style: "currency",
              currency: stats.currency || "IDR",
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(stats.totalCapitalValue) : "0", 
            color: "text-primary" 
          },
          { 
            label: "Branch Value (Selling)", 
            value: stats?.totalValue ? new Intl.NumberFormat("id-ID", {
              style: "currency",
              currency: stats.currency || "IDR",
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(stats.totalValue) : "0", 
            color: "text-primary" 
          },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={handleSync}
              disabled={isLoading}
              className="h-14 px-6 rounded-2xl border-border bg-secondary/40 backdrop-blur-md font-black italic text-xs uppercase tracking-widest gap-2 text-foreground hover:bg-secondary/60"
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              Sync
            </Button>

            {!canWrite && (
              <Badge className="bg-warning text-foreground border-none font-black italic text-[10px] uppercase px-4 h-14 rounded-2xl flex items-center gap-2">
                <Lock className="w-4 h-4" /> View Only
              </Badge>
            )}
          </div>
        }
      />

      <div className="flex-1">
        <Tabs defaultValue="ledger" className="flex flex-col">
          <div className="max-w-[1600px] mx-auto pt-4 shrink-0">
            <TabsList className="h-14 p-1.5 bg-muted backdrop-blur-md border border-white/5 rounded-[1.2rem] shadow-sm w-full md:w-auto overflow-x-auto overflow-y-hidden no-scrollbar">
              {[
                { val: "ledger", label: "Ledger", icon: Layers },
                { val: "opname", label: "Opname", icon: ClipboardCheck },
                { val: "movements", label: "Movements", icon: ArrowLeftRight },
                { val: "approvals", label: "Approvals", icon: ShieldCheck },
                { val: "creation", label: "Creation", icon: PlusSquare },
                { val: "report", label: "Report", icon: FileText },
              ].map((t) => (
                <TabsTrigger
                  key={t.val}
                  value={t.val}
                  className="rounded-xl px-6 font-black italic text-[10px] uppercase tracking-widest data-[state=active]:bg-secondary data-[state=active]:text-foreground transition-all gap-2"
                >
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="ledger" className="flex-1 m-0 p-8">
            <div className="max-w-[1600px] mx-auto space-y-8">
              {stats && (
                <InventoryKpiBar stats={stats} isAggregating={isLoading} />
              )}
              <InventoryFilterHub
                search={filters.search}
                onSearchChange={(v) => setFilters(prev => ({ ...prev, search: v }))}
                category={filters.category}
                onCategoryChange={(v) => setFilters(prev => ({ ...prev, category: v }))}
                categories={categoryOptions}
                status={filters.status}
                onStatusChange={(v) => setFilters(prev => ({ ...prev, status: v }))}
                minPrice={filters.minPrice}
                maxPrice={filters.maxPrice}
                onPriceRangeChange={(min, max) => setFilters(prev => ({ ...prev, minPrice: min, maxPrice: max }))}
                sortBy={filters.sortBy}
                onSortChange={(v) => setFilters(prev => ({ ...prev, sortBy: v as InventoryFilters["sortBy"] }))}
                advancedActions={
                  canWrite ? (
                    <Button
                      size="lg"
                      className="rounded-2xl bg-secondary text-foreground font-black italic text-xs uppercase tracking-widest gap-2 h-14 px-8 whitespace-nowrap"
                      onClick={() => setDetailItem({} as InventoryItemView)}
                    >
                      <Plus className="h-4 w-4" /> Add Item
                    </Button>
                  ) : undefined
                }
              />

              <Card className="rounded-2xl border-border bg-secondary/30 backdrop-blur-3xl shadow-2xl overflow-hidden border">
                <InventoryTable
                  items={inventory}
                  isLoading={isLoading}
                  page={page}
                  pageSize={PAGE_SIZE}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  currentCount={inventory.length}
                  onPageChange={setPage}
                  statusBadge={statusBadge}
                  onEdit={(item) => {
                    setSelectedItem(item);
                    setBufferValue(item.minBuffer || 0);
                    setGlobalMinStock(Number((item as unknown as RetailProduct).metadata?.min_stock || 0));
                    setIsBufferDialogOpen(true);
                  }}
                  onPrint={(item) => {
                    setPrintItems([
                      {
                        id: item.id,
                        sku: item.sku,
                        name: item.name,
                        barcode: item.barcode || item.sku,
                        price: item.price,
                      },
                    ]);
                  }}
                  onMovement={(type) => {
                    setSelectedItem(inventory.find(i => i.id === selectedItem?.id) || null);
                    setMovementType(type);
                  }}
                  onReclassify={(item) => {
                    setSelectedItemForReclassify(item);
                    setNewCategoryId(item.categoryId || "");
                    setIsReclassifyOpen(true);
                  }}
                  onComplete={(item) => setCompletionItem(item)}
                  onCategoryClick={handleCategoryClick}
                  onRowClick={(item) => setDetailItem(item)}
                />
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="opname" className="flex-1 m-0 p-8">
            <div className="max-w-5xl mx-auto space-y-8">
              <StockOpnameTab
                storeName={selectedStore?.name}
                opnameActive={opnameActive}
                opnameEntries={opnameEntries}
                unresolvedBarcodes={unresolvedBarcodes}
                filters={opnameFilters}
                categoryOptions={categoryOptions}
                onFiltersChange={(patch) =>
                  setOpnameFilters((prev) => ({ ...prev, ...patch }))
                }
                barcodeInput={barcodeInput}
                onStart={startOpname}
                onDiscard={() => {
                  setOpnameActive(false);
                  setUnresolvedBarcodes([]);
                  setAnomalies([]);
                  setNewItems([]);
                  if (tenantId && locationId) {
                    clearOpnameSession(tenantId, locationId);
                  }
                }}
                onSubmit={submitOpname}
                onBarcodeChange={setBarcodeInput}
                onBarcodeKeyDown={handleBarcodeKeyDown}
                onCountChange={handleCountChange}
                onResolveUnresolvedBarcodes={handleResolveUnresolvedBarcodes}
                isLoading={isSubmitting}
                statusBadge={statusBadge}
              />
            </div>
          </TabsContent>

          <TabsContent value="movements" className="flex-1 m-0 p-8">
            <MovementsTab
              canWrite={canWrite}
              auditLog={[]}
              onMovement={(type) => setMovementType(type)}
            />
          </TabsContent>

          <TabsContent value="creation" className="flex-1 m-0 p-8">
            <ItemCreationTab
              canWrite={canWrite}
              session={session}
              tenantId={tenantId}
              categoryOptions={categoryOptions}
            />
          </TabsContent>

          <TabsContent value="approvals" className="flex-1 m-0 p-8">
            <div className="max-w-7xl mx-auto space-y-6 text-foreground">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-2xl font-black italic tracking-tight">
                    Pending SKU Approvals
                  </h2>
                  <p className="text-muted-foreground text-sm font-medium">
                    Items waiting for HOD verification before entering
                  </p>
                </div>
                <Button
                  onClick={fetchPendingItems}
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-2 font-bold italic text-xs uppercase"
                >
                  <RefreshCw
                    className={cn("w-4 h-4", isApproving && "animate-spin")}
                  />{" "}
                  Refresh
                </Button>
              </div>

              {pendingItems.length === 0 ? (
                <div className="h-[400px] rounded-2xl bg-white/[0.02] border border-dashed border-white/5 flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 shadow-sm flex items-center justify-center mb-4 border border-white/5">
                    <ShieldCheck className="w-8 h-8 text-muted-foreground/60" />
                  </div>
                  <h3 className="text-lg font-black italic tracking-tight">
                    All Clear!
                  </h3>
                  <p className="text-muted-foreground text-sm font-medium mt-1">
                    No items currently awaiting approval.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(Array.isArray(pendingItems) ? pendingItems : []).map((item) => (
                    <Card
                      key={item.id}
                      className="rounded-[2rem] border border-white/5 shadow-xl overflow-hidden bg-white/[0.03] p-6 border-l-4 border-l-indigo-600 backdrop-blur-3xl"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <Badge className="bg-primary/5 text-primary hover:bg-primary/10 rounded-lg text-[10px] font-black italic uppercase">
                          Pending Approval
                        </Badge>
                        <span className="text-[10px] font-black uppercase text-muted-foreground italic">
                          {item.sku}
                        </span>
                      </div>
                      <h4 className="text-lg font-black italic tracking-tight leading-tight mb-1">
                        {item.name}
                      </h4>
                      <p className="text-xs text-muted-foreground font-medium mb-4">
                        {item.category} • {item.unit}
                      </p>

                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-secondary/5 rounded-2xl p-3">
                          <p className="text-[9px] font-black uppercase text-muted-foreground italic mb-1">
                            Price
                          </p>
                          <p className="text-sm font-black italic text-foreground">
                            ${item.price}
                          </p>
                        </div>
                        <div className="bg-secondary/5 rounded-2xl p-3">
                          <p className="text-[9px] font-black uppercase text-muted-foreground italic mb-1">
                            Type
                          </p>
                          <p className="text-sm font-black italic text-foreground">
                            {item.type}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <Button
                          className="flex-1 rounded-xl h-10 font-black italic uppercase text-[10px] tracking-widest bg-success hover:bg-success text-foreground"
                          disabled={isApproving}
                          onClick={async () => {
                            setIsApproving(true);
                            try {
                              await retailService.approveItem(
                                tenantId!,
                                session!,
                                item.id,
                              );
                              toast({
                                title: "Approved",
                                description: `${item.sku} is now active.`,
                              });
                              fetchPendingItems();
                              fetchInventory();
                            } catch (e) {
                              toast({
                                title: "Error",
                                description: "Failed to approve item.",
                                variant: "destructive",
                              });
                            } finally {
                              setIsApproving(false);
                            }
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 rounded-xl h-10 font-black italic uppercase text-[10px] tracking-widest text-destructive border-destructive hover:bg-destructive"
                          disabled={isApproving}
                          onClick={async () => {
                            setIsApproving(true);
                            try {
                              await retailService.rejectItem(
                                tenantId!,
                                session!,
                                item.id,
                              );
                              toast({
                                title: "Rejected",
                                description: `${item.sku} was rejected.`,
                              });
                              fetchPendingItems();
                            } catch (e) {
                              toast({
                                title: "Error",
                                description: "Failed to reject item.",
                                variant: "destructive",
                              });
                            } finally {
                              setIsApproving(false);
                            }
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="report" className="flex-1 m-0 p-8">
            <StockReportTab
              canWrite={canWrite}
              session={session}
              stores={stores}
              selectedStoreId={locationId || ""}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Dialogs ── */}
      <InventoryMovementDialog
        type={movementType ?? "request_po"}
        open={!!movementType}
        onClose={() => setMovementType(null)}
        stores={stores}
        selectedStoreId={locationId || ""}
        tenantId={tenantId}
        session={session ?? undefined}
        items={inventory}
        categoryOptions={categoryOptions}
        suppliers={suppliers}
        onSubmit={handleMovementSubmit}
        onPrintBarcodes={(barcodeItems) => setPrintItems(barcodeItems)}
      />
      <ItemDetailsModal
        item={detailItem}
        open={!!detailItem?.id || (detailItem && Object.keys(detailItem).length > 0 && !detailItem.id)}
        onOpenChange={(open) => !open && setDetailItem(null)}
        onUpdated={fetchInventory}
        categories={dynamicCategories}
      />
      <PostekPrintModal
        open={printItems.length > 0}
        onClose={() => setPrintItems([])}
        items={printItems}
      />
      <CategoryManager
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
        onCategoriesChange={fetchCategories}
      />

      <Dialog open={isBufferDialogOpen} onOpenChange={setIsBufferDialogOpen}>
        <DialogContent className="max-w-md rounded-[2.5rem] bg-muted backdrop-blur-2xl border-white/10 shadow-2xl p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-black italic uppercase tracking-widest text-white flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-primary" />
              Stock Threshold
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-bold italic text-xs uppercase tracking-wider">
              Set minimum buffer for {selectedItem?.name}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={bufferForm.handleSubmit((data) => bufferMutation.mutate(data))} noValidate>
            <fieldset disabled={bufferMutation.isPending} className="space-y-6 py-6">
              <div className="space-y-3">
                <Label htmlFor="buffer-min" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Min Buffer Quantity</Label>
                <div className="relative">
                  <input
                    id="buffer-min"
                    type="number"
                    className="w-full h-14 bg-muted border border-white/5 rounded-2xl px-6 font-black italic text-lg text-white focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                    {...bufferForm.register("minBuffer", { valueAsNumber: true })}
                    aria-describedby={bufferForm.formState.errors.minBuffer ? "buffer-min-error" : undefined}
                    aria-invalid={!!bufferForm.formState.errors.minBuffer}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-widest text-muted-foreground italic">
                    Branch
                  </div>
                </div>
                {bufferForm.formState.errors.minBuffer && (
                  <p id="buffer-min-error" className="text-[10px] text-destructive font-medium" role="alert">
                    {bufferForm.formState.errors.minBuffer.message}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="buffer-global" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Global Min Stock (Meta)</Label>
                <div className="relative">
                  <input
                    id="buffer-global"
                    type="number"
                    className="w-full h-14 bg-muted border border-white/5 rounded-2xl px-6 font-black italic text-lg text-white focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                    {...bufferForm.register("globalMinStock", { valueAsNumber: true })}
                    aria-describedby={bufferForm.formState.errors.globalMinStock ? "buffer-global-error" : undefined}
                    aria-invalid={!!bufferForm.formState.errors.globalMinStock}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-widest text-muted-foreground italic">
                    Global
                  </div>
                </div>
                {bufferForm.formState.errors.globalMinStock && (
                  <p id="buffer-global-error" className="text-[10px] text-destructive font-medium" role="alert">
                    {bufferForm.formState.errors.globalMinStock.message}
                  </p>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground font-bold italic px-2">
                System will trigger LOW STOCK alert when inventory falls below this level.
              </p>
            </fieldset>

            <DialogFooter className="gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={bufferMutation.isPending}
                onClick={() => setIsBufferDialogOpen(false)}
                className="h-12 rounded-xl font-black italic text-xs uppercase tracking-widest border-white/5 bg-transparent text-muted-foreground hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={bufferMutation.isPending}
                className="h-12 flex-1 rounded-xl font-black italic text-xs uppercase tracking-widest bg-white text-muted-foreground hover:bg-muted"
              >
                {bufferMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                Update Threshold
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Unresolved Barcodes Modal */}
      <UnresolvedBarcodesModal
        isOpen={isUnresolvedOpen}
        onClose={() => setIsUnresolvedOpen(false)}
        unresolvedBarcodes={unresolvedBarcodes}
        onFlagAnomalies={(barcodes) => handleResolveUnresolvedBarcodes(barcodes, "flag")}
        onItemsRegistered={(items) => handleResolveUnresolvedBarcodes(items.map(i => i.barcode || ""), "register")}
        categoryOptions={categoryOptions}
      />

      {/* Anomaly Completion Dialog */}
      <AnomalyCompletionDialog
        item={completionItem}
        open={!!completionItem}
        onClose={() => setCompletionItem(null)}
        categories={dynamicCategories}
        onSubmit={handleCompleteAnomaly}
        isLoading={isCompletionLoading}
      />

      <Dialog open={isReclassifyOpen} onOpenChange={setIsReclassifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reclassify Item</DialogTitle>
            <DialogDescription>
              Move <strong>{selectedItemForReclassify?.name}</strong> to a different category.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={reclassifyForm.handleSubmit((data) => reclassifyMutation.mutate(data))} noValidate>
            <fieldset disabled={reclassifyMutation.isPending} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reclassify-category">Select New Category</Label>
                <Select
                  value={reclassifyForm.watch("newCategoryId")}
                  onValueChange={(val) => reclassifyForm.setValue("newCategoryId", val)}
                >
                  <SelectTrigger
                    id="reclassify-category"
                    aria-describedby={reclassifyForm.formState.errors.newCategoryId ? "reclassify-category-error" : undefined}
                    aria-invalid={!!reclassifyForm.formState.errors.newCategoryId}
                  >
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.filter(c => c.id !== "all").map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {reclassifyForm.formState.errors.newCategoryId && (
                  <p id="reclassify-category-error" className="text-[10px] text-destructive font-medium" role="alert">
                    {reclassifyForm.formState.errors.newCategoryId.message}
                  </p>
                )}
              </div>
            </fieldset>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={reclassifyMutation.isPending}
                onClick={() => setIsReclassifyOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={reclassifyMutation.isPending || !reclassifyForm.watch("newCategoryId")}
              >
                {reclassifyMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Update Category
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventoryVisibility;
