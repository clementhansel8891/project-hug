/**
 * InventoryMovementDialog — Wired modal for stock movements/transfers.
 *
 * Supports receive_purchase, transfer_out, receive_transfer, request_po,
 * and other movement types with item picker, barcode scanning, and
 * new product creation.
 *
 * Requirements: 1 (Form Fields), 2 (Validation), 3 (API Submission),
 *               4 (Loading State), 5 (Error Handling), 6 (Success Handling),
 *               10 (Consistent Pattern)
 */

import React, { useMemo, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDownToLine,
  Lock,
  Truck,
  Send,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Building2,
  PackageCheck,
  PackagePlus,
  Layers,
  Barcode,
  Printer,
  Loader2,
} from "lucide-react";
import type { RetailStore, RetailProduct } from "@/core/types/retail/retail";
import type { SessionContext } from "@/core/security/session";
import { retailService } from "@/core/services/retail/retailService";
import { apiRequest } from "@/core/api/apiClient";
import { getMutationToastHandlers } from "@/lib/modal-helpers";
import { MOVEMENT_META, type MovementType } from "../movementMeta";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { PrintItem } from "@/components/shared/PostekPrintModal";
import { NewItemFormRow, type NewItemLine } from "@/components/shared/NewItemFormRow";
import {
  generateSkuFromCategory,
  generateBarcode,
} from "@/components/shared/NewItemFormHelpers";

// ─── Zod Schema (movement metadata validation) ──────────────────────────────

const movementMetaSchema = z.object({
  reason: z.string().min(5, "Reason must be at least 5 characters"),
  uom: z.string().min(1, "Unit of measure is required"),
  expectedDate: z.string().optional(),
  ref: z.string().optional(),
});

export type MovementMetaFormValues = z.infer<typeof movementMetaSchema>;

// ─── Types ──────────────────────────────────────────────────────────────────

export type MovementLine = {
  id: string;
  sku: string;
  name: string;
  available?: number;
  qty: number;
  note?: string;
};

export type NewProductLine = NewItemLine;

export type PurchaseMode = "restock" | "new_product" | "mixed";

export type MovementPayload = {
  lines: MovementLine[];
  newProductLines?: NewProductLine[];
  purchaseMode?: PurchaseMode;
  ref: string;
  reason: string;
  uom: string;
  expectedDate?: string;
  destinationStoreId?: string;
  sourceStoreId?: string;
  supplierId?: string;
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  type: MovementType;
  open: boolean;
  onClose: () => void;
  stores: RetailStore[];
  selectedStoreId: string;
  tenantId?: string;
  session?: SessionContext;
  items: Array<{
    id: string;
    sku: string;
    name: string;
    available?: number;
    categoryId?: string;
  }>;
  categoryOptions?: { id: string; name: string }[];
  suppliers?: { id: string; name: string }[];
  onSubmit: (data: MovementPayload & { sourceType?: string }) => void;
  onPrintBarcodes?: (items: PrintItem[]) => void;
}

// Local helpers removed, using shared version from NewItemFormRow

// ─── Empty-state helper ───────────────────────────────────────────────────────

const EmptyDropdownNote: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex items-center gap-2 h-10 px-3 rounded-xl bg-secondary/5 border border-dashed border-border">
    <span className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground">
      {message}
    </span>
  </div>
);

// NewProductRow removed, using NewItemFormRow
// ─── Main Component ───────────────────────────────────────────────────────────

export const InventoryMovementDialog: React.FC<Props> = ({
  type,
  open,
  onClose,
  stores,
  selectedStoreId,
  tenantId,
  session,
  items,
  categoryOptions = [],
  suppliers = [],
  onSubmit,
  onPrintBarcodes,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ─── React Hook Form for movement metadata validation ─────────────────────
  const metaForm = useForm<MovementMetaFormValues>({
    resolver: zodResolver(movementMetaSchema),
    defaultValues: { reason: "", uom: "units", expectedDate: "", ref: "" },
  });

  // ── Common state ──────────────────────────────────────────────────────────
  const [ref, setRef] = useState("");
  const [reason, setReason] = useState("");
  const [uom, setUom] = useState("units");
  const [expectedDate, setExpectedDate] = useState("");
  const [destinationStoreId, setDestinationStoreId] = useState("");
  const [sourceStoreId, setSourceStoreId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedLines, setSelectedLines] = useState<MovementLine[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [allItems, setAllItems] = useState(items);
  const [isFetchingItems, setIsFetchingItems] = useState(false);
  const ITEMS_PER_PAGE = 20;

  // ── Receive from Purchase state ───────────────────────────────────────────
  const [purchaseMode, setPurchaseMode] = useState<PurchaseMode>("restock");
  const [newProductLines, setNewProductLines] = useState<NewProductLine[]>([]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const currentStore = useMemo(
    () => stores.find((s) => s.id === selectedStoreId),
    [stores, selectedStoreId],
  );
  const meta = MOVEMENT_META[type];
  const otherStores = useMemo(
    () => (Array.isArray(stores) ? stores : []).filter((s) => s.id !== selectedStoreId),
    [stores, selectedStoreId],
  );

  const isPO = type === "request_po";
  const isTransferOut = type === "transfer_out";
  const isReceiveTransfer = type === "receive_transfer";
  const isReceivePurchase = type === "receive_purchase";

  // ── Fetch all items when dialog opens ─────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (!tenantId || !session) {
      setAllItems(items);
      return;
    }
    setIsFetchingItems(true);
    retailService
      .listInventory(tenantId, session, { pageSize: 9999 })
      .then((data) => {
        setAllItems(
          (Array.isArray(data) ? data : []).map((p: RetailProduct) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            available: p.metadata?.available ?? p.stock ?? 0,
            categoryId: p.categoryId || "",
          })),
        );
      })
      .catch(() => setAllItems(items))
      .finally(() => setIsFetchingItems(false));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Validation ────────────────────────────────────────────────────────────
  const validReason = reason.trim().length >= 5;
  const validDate = !!expectedDate || meta.dir === "out";

  const validLines = (() => {
    if (isReceivePurchase) {
      if (purchaseMode === "restock") return selectedLines.length > 0;
      if (purchaseMode === "new_product")
        return (
          newProductLines.length > 0 &&
          newProductLines.every((l) => l.name.trim() && l.sku.trim())
        );
      // mixed
      return (
        selectedLines.length > 0 ||
        (newProductLines.length > 0 &&
          newProductLines.every((l) => l.name.trim() && l.sku.trim()))
      );
    }
    return selectedLines.length > 0;
  })();

  const validDestination = !isTransferOut || !!destinationStoreId;
  const validSource = !isReceiveTransfer || !!sourceStoreId;

  const valid =
    validReason && validLines && validDestination && validSource && validDate;

  // ── Item picker helpers ───────────────────────────────────────────────────
  const addLine = (item: {
    id: string;
    sku: string;
    name: string;
    available?: number;
  }) => {
    setSelectedLines((prev) => {
      const existing = prev.find((l) => l.id === item.id);
      if (existing) {
        return (Array.isArray(prev) ? prev : []).map((l) =>
          l.id === item.id ? { ...l, qty: l.qty + 1 } : l,
        );
      }
      return [...prev, { ...item, qty: 1, note: "" }];
    });
  };

  const updateLine = (id: string, changes: Partial<MovementLine>) => {
    setSelectedLines((prev) =>
      (Array.isArray(prev) ? prev : []).map((l) => (l.id === id ? { ...l, ...changes } : l)),
    );
  };

  const removeLine = (id: string) => {
    setSelectedLines((prev) => (Array.isArray(prev) ? prev : []).filter((l) => l.id !== id));
  };

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase();
    return (Array.isArray(allItems) ? allItems : []).filter(
      (i) =>
        (!q ||
          i.name.toLowerCase().includes(q) ||
          i.sku.toLowerCase().includes(q)) &&
        (categoryFilter === "all" || i.categoryId === categoryFilter),
    );
  }, [allItems, search, categoryFilter]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  // ── New product helpers ───────────────────────────────────────────────────
  const addNewProductLine = () => {
    setNewProductLines((prev) => [
      ...prev,
      {
        tempId: `np-${Date.now()}`,
        name: "",
        sku: "",
        barcode: "",
        categoryId: "",
        price: 0,
        qty: 1,
      },
    ]);
  };

  const updateNewProductLine = (
    id: string,
    changes: Partial<NewProductLine>,
  ) => {
    setNewProductLines((prev) =>
      (Array.isArray(prev) ? prev : []).map((l) => (l.tempId === id ? { ...l, ...changes } : l)),
    );
  };

  const removeNewProductLine = (id: string) => {
    setNewProductLines((prev) => (Array.isArray(prev) ? prev : []).filter((l) => l.tempId !== id));
  };

  const handlePrintNewProduct = (line: NewProductLine) => {
    if (!onPrintBarcodes) return;
    onPrintBarcodes([
      {
        id: line.tempId,
        sku: line.sku,
        name: line.name,
        barcode: line.barcode || line.sku,
        price: line.price,
      },
    ]);
  };

  // ── Barcode scanner ───────────────────────────────────────────────────────
  useBarcodeScanner((barcode) => {
    if (open) {
      setSearch(barcode);
      const item = items.find((i) => i.sku === barcode);
      if (item) {
        addLine(item);
        toast({
          title: "Item Scanned",
          description: `${item.name} added to list.`,
        });
      } else {
        toast({
          title: "SKU Not Found",
          description: `Barcode: ${barcode}`,
          variant: "destructive",
        });
      }
    }
  });

  // ── Submit via useMutation ──────────────────────────────────────────────────
  const movementMutation = useMutation({
    mutationFn: async (payload: MovementPayload & { sourceType?: string }) => {
      // Use external onSubmit callback (parent handles API call)
      onSubmit(payload);
    },
    onSuccess: () => {
      toast({
        title: "Movement Submitted",
        description: "Stock movement request has been sent for processing.",
      });
      queryClient.invalidateQueries({ queryKey: ["retail", "inventory"] });
      queryClient.invalidateQueries({ queryKey: ["retail", "inventory", "movements"] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "An unexpected error occurred.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!valid) return;
    const payload: MovementPayload & { sourceType?: string } = {
      lines: selectedLines,
      newProductLines: isReceivePurchase ? newProductLines : undefined,
      purchaseMode: isReceivePurchase ? purchaseMode : undefined,
      ref,
      reason,
      uom,
      expectedDate: expectedDate || undefined,
      destinationStoreId: isTransferOut ? destinationStoreId : undefined,
      sourceStoreId: isReceiveTransfer ? sourceStoreId : undefined,
      supplierId: type === "receive_po" ? supplierId : undefined,
    };
    movementMutation.mutate(payload);
    // Reset
    setSelectedLines([]);
    setNewProductLines([]);
    setRef("");
    setReason("");
    setExpectedDate("");
    setDestinationStoreId("");
    setSourceStoreId("");
    setSupplierId("");
    setCategoryFilter("all");
    setUom("units");
    setCurrentPage(1);
    setPurchaseMode("restock");
    metaForm.reset();
    onClose();
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderItemPicker = () => (
    <div className="space-y-4">
      <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground italic">
        1. Item Discovery
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <Input
          placeholder="Search SKU or Name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
          className="h-10 rounded-xl font-bold bg-secondary/5 border-none shadow-inner text-xs"
        />
        <Select
          value={categoryFilter}
          onValueChange={(val) => {
            setCategoryFilter(val);
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="h-10 rounded-xl font-bold bg-secondary/5 border-none shadow-inner text-xs">
            <SelectValue placeholder="All Category" />
          </SelectTrigger>
          <SelectContent className="rounded-xl font-bold italic">
            <SelectItem value="all">All Category</SelectItem>
            {(Array.isArray(categoryOptions) ? categoryOptions : []).filter((c) => c.id !== "all")
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border-2 border-border overflow-hidden shadow-sm bg-card flex flex-col min-h-[320px]">
        <div className="grid grid-cols-12 bg-secondary/5 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground px-4 py-3">
          <div className="col-span-8 italic">Item SKU &amp; Name</div>
          <div className="col-span-2 italic">Stock</div>
          <div className="col-span-2 text-right italic">Add</div>
        </div>
        <div className="flex-1 divide-y divide-slate-50 overflow-y-auto max-h-[280px]">
          {isFetchingItems && (
            <div className="h-full flex items-center justify-center py-16 text-muted-foreground/60">
              <div className="text-xs font-black italic uppercase tracking-widest animate-pulse">
                Loading…
              </div>
            </div>
          )}
          {!isFetchingItems &&
            (Array.isArray(paginatedItems) ? paginatedItems : []).map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-12 items-center px-4 py-3 text-sm gap-2 hover:bg-secondary/5 transition-colors group"
              >
                <div className="col-span-8">
                  <div className="font-black italic text-muted-foreground truncate text-[12px]">
                    {item.name}
                  </div>
                  <div className="text-[9px] font-mono font-bold text-muted-foreground uppercase tracking-tighter">
                    {item.sku}
                  </div>
                </div>
                <div className="col-span-2 text-[11px] font-black text-primary italic">
                  {item.available ?? 0}
                </div>
                <div className="col-span-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 rounded-lg hover:bg-primary hover:text-foreground transition-all group-hover:scale-110"
                    onClick={() => addLine(item)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          {!isFetchingItems && filteredItems.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center py-16 text-muted-foreground/60">
              <div className="text-xs font-black italic uppercase tracking-widest opacity-50">
                No items match your search
              </div>
            </div>
          )}
        </div>
        {/* Pagination */}
        <div className="px-4 py-3 border-t border-border bg-secondary/5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between shrink-0">
          <span className="text-[9px] font-black italic uppercase tracking-widest text-muted-foreground">
            Page {currentPage} of {Math.max(1, totalPages)} •{" "}
            {filteredItems.length} items
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p >= Math.max(1, currentPage - 2) &&
                  p <= Math.min(totalPages, currentPage + 2),
              )
              .map((pNum) => (
                <Button
                  key={pNum}
                  size="sm"
                  variant={pNum === currentPage ? "default" : "outline"}
                  className="h-7 w-7 p-0 text-[10px] font-black"
                  onClick={() => setCurrentPage(pNum)}
                >
                  {pNum}
                </Button>
              ))}
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderNewProductPanel = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-widest text-success italic flex items-center gap-2">
          <PackagePlus className="w-4 h-4" /> New Products
        </h3>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border-success text-success hover:bg-success"
          onClick={addNewProductLine}
        >
          <Plus className="w-3 h-3" /> Add Item
        </Button>
      </div>
      {newProductLines.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-success bg-success flex flex-col items-center justify-center py-10 text-center gap-2">
          <PackagePlus className="w-8 h-8 text-success" />
          <p className="text-[10px] font-black italic uppercase tracking-widest text-success">
            No new products added yet.
            <br />
            Click "Add Item" to begin.
          </p>
        </div>
      ) : (
        <div className="space-y-6 max-h-[520px] overflow-y-auto pr-2 pb-4">
          {(Array.isArray(newProductLines) ? newProductLines : []).map((line) => (
            <NewItemFormRow
              key={line.tempId}
              line={line}
              categoryOptions={categoryOptions}
              onChange={updateNewProductLine}
              onRemove={removeNewProductLine}
              onPrint={handlePrintNewProduct}
            />
          ))}
        </div>
      )}
    </div>
  );

  // ── Left column content depends on movement type ──────────────────────────
  const renderLeftColumn = () => {
    if (isReceivePurchase) {
      // Mode selector
      const modes: {
        key: PurchaseMode;
        label: string;
        icon: React.ReactNode;
        desc: string;
      }[] = [
        {
          key: "restock",
          label: "Restock",
          icon: <PackageCheck className="w-4 h-4" />,
          desc: "Existing items from master list",
        },
        {
          key: "new_product",
          label: "New Product",
          icon: <PackagePlus className="w-4 h-4" />,
          desc: "Create new item & barcode",
        },
        {
          key: "mixed",
          label: "Mixed",
          icon: <Layers className="w-4 h-4" />,
          desc: "Both restock and new items",
        },
      ];
      return (
        <div className="space-y-6">
          {/* Mode selector */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground italic">
              1. Purchase Type
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {(Array.isArray(modes) ? modes : []).map((m) => (
                <button
                  key={m.key}
                  onClick={() => setPurchaseMode(m.key)}
                  className={cn(
                    "rounded-[1rem] border-2 p-4 text-left transition-all",
                    purchaseMode === m.key
                      ? "border-success bg-success shadow-sm"
                      : "border-border bg-card hover:border-success hover:bg-success",
                  )}
                >
                  <div
                    className={cn(
                      "mb-2",
                      purchaseMode === m.key
                        ? "text-success"
                        : "text-muted-foreground",
                    )}
                  >
                    {m.icon}
                  </div>
                  <div
                    className={cn(
                      "font-black italic text-[11px] uppercase tracking-widest",
                      purchaseMode === m.key
                        ? "text-success"
                        : "text-muted-foreground",
                    )}
                  >
                    {m.label}
                  </div>
                  <div className="text-[9px] font-bold text-muted-foreground mt-0.5 leading-tight">
                    {m.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Restock picker */}
          {(purchaseMode === "restock" || purchaseMode === "mixed") && (
            <div>
              {purchaseMode === "mixed" && (
                <h4 className="text-[10px] font-black uppercase tracking-widest text-primary italic mb-3 flex items-center gap-1.5">
                  <PackageCheck className="w-3.5 h-3.5" /> Existing Items
                  (Restock)
                </h4>
              )}
              {renderItemPicker()}
            </div>
          )}

          {/* New product form */}
          {(purchaseMode === "new_product" || purchaseMode === "mixed") && (
            <div>
              {purchaseMode === "mixed" && (
                <div className="border-t-2 border-dashed border-border pt-6" />
              )}
              {renderNewProductPanel()}
            </div>
          )}
        </div>
      );
    }

    // Default: item picker for all other types
    return renderItemPicker();
  };

  // ── Right column: config sections ─────────────────────────────────────────
  const renderContextSection = () => {
    // Stock Transfer → Destination location
    if (isTransferOut) {
      return (
        <div className="bg-primary/5 rounded-xl p-5 border border-primary space-y-3">
          <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5" /> Transfer Destination *
          </Label>
          {otherStores.length === 0 ? (
            <>
              <EmptyDropdownNote message="No other locations registered" />
              <p className="text-[9px] italic text-muted-foreground font-bold">
                Register additional store locations to enable inter-store
                transfers.
              </p>
            </>
          ) : (
            <Select
              value={destinationStoreId}
              onValueChange={setDestinationStoreId}
            >
              <SelectTrigger className="h-10 rounded-xl font-bold bg-card border-primary text-xs">
                <SelectValue placeholder="Select destination location..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl font-bold italic">
                {(Array.isArray(otherStores) ? otherStores : []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="font-black">{s.name}</span>
                    {s.address && (
                      <span className="text-muted-foreground ml-2 text-[10px]">
                        {s.address}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      );
    }

    // Receive from PO → Supplier
    if (type === "receive_po") {
      return (
        <div className="bg-success rounded-xl p-5 border border-success space-y-3">
          <Label className="text-[10px] font-black uppercase tracking-widest text-success flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5" /> Supplier *
          </Label>
          {suppliers.length === 0 ? (
            <>
              <EmptyDropdownNote message="No suppliers registered" />
              <p className="text-[9px] italic text-muted-foreground font-bold">
                Register suppliers in Procurement → Supplier Desk to populate
                this list.
              </p>
            </>
          ) : (
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger className="h-10 rounded-xl font-bold bg-card border-success text-xs">
                <SelectValue placeholder="Select supplier..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl font-bold italic">
                {(Array.isArray(suppliers) ? suppliers : []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      );
    }

    // Receive Transfer → Source location
    if (isReceiveTransfer) {
      return (
        <div className="bg-success rounded-xl p-5 border border-success space-y-3">
          <Label className="text-[10px] font-black uppercase tracking-widest text-success flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5" /> Transferring From *
          </Label>
          {otherStores.length === 0 ? (
            <>
              <EmptyDropdownNote message="No other locations registered" />
              <p className="text-[9px] italic text-muted-foreground font-bold">
                Register additional store locations to enable inter-store
                transfers.
              </p>
            </>
          ) : (
            <Select value={sourceStoreId} onValueChange={setSourceStoreId}>
              <SelectTrigger className="h-10 rounded-xl font-bold bg-card border-success text-xs">
                <SelectValue placeholder="Select source location..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl font-bold italic">
                {(Array.isArray(otherStores) ? otherStores : []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="font-black">{s.name}</span>
                    {s.address && (
                      <span className="text-muted-foreground ml-2 text-[10px]">
                        {s.address}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      );
    }

    return null;
  };

  // ── Selected lines panel (right column) ───────────────────────────────────
  const renderSelectedLines = () => {
    const showRestockLines =
      !isReceivePurchase ||
      purchaseMode === "restock" ||
      purchaseMode === "mixed";
    const showNewProductSummary =
      isReceivePurchase &&
      (purchaseMode === "new_product" || purchaseMode === "mixed");

    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            {showNewProductSummary && showRestockLines
              ? `Selected (${selectedLines.length + newProductLines.length})`
              : `Selected Items (${showNewProductSummary ? newProductLines.length : selectedLines.length})`}
          </Label>
          {(selectedLines.length > 0 || newProductLines.length > 0) && (
            <button
              onClick={() => {
                setSelectedLines([]);
                setNewProductLines([]);
              }}
              className="text-[9px] font-black uppercase tracking-widest text-destructive hover:underline"
            >
              Clear All
            </button>
          )}
        </div>
        <div className="rounded-xl border-2 border-border overflow-hidden shadow-sm flex flex-col bg-secondary/5 min-h-[160px] max-h-[260px]">
          <div className="grid grid-cols-12 bg-secondary/5 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground px-4 py-3">
            <div className="col-span-8 italic">Item Info</div>
            <div className="col-span-4 text-right italic pr-4">Qty</div>
          </div>
          <div className="flex-1 divide-y divide-slate-50 overflow-y-auto bg-card">
            {/* Restock lines */}
            {showRestockLines &&
              (Array.isArray(selectedLines) ? selectedLines : []).map((line) => (
                <div
                  key={line.id}
                  className="grid grid-cols-12 items-center px-4 py-3 text-sm gap-2 hover:bg-secondary/5 transition-colors"
                >
                  <div className="col-span-8 flex items-center gap-3">
                    <button
                      className="text-destructive hover:text-destructive transition-colors"
                      onClick={() => removeLine(line.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div>
                      <div className="font-black italic text-muted-foreground truncate text-[11px]">
                        {line.name}
                      </div>
                      <div className="text-[9px] font-mono font-bold text-muted-foreground uppercase tracking-tighter">
                        {line.sku}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-4">
                    <Input
                      type="number"
                      min="1"
                      value={line.qty}
                      onChange={(e) =>
                        updateLine(line.id, {
                          qty: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className="h-8 rounded-lg font-black italic border-border text-center text-primary text-[11px] px-1"
                    />
                  </div>
                </div>
              ))}
            {/* New product summary lines */}
            {showNewProductSummary &&
              (Array.isArray(newProductLines) ? newProductLines : []).map((line) => (
                <div
                  key={line.tempId}
                  className="grid grid-cols-12 items-center px-4 py-3 text-sm gap-2 hover:bg-success transition-colors"
                >
                  <div className="col-span-8 flex items-center gap-3">
                    <button
                      className="text-destructive hover:text-destructive transition-colors"
                      onClick={() => removeNewProductLine(line.tempId)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div>
                      <div className="flex items-center gap-1">
                        <PackagePlus className="w-3 h-3 text-success" />
                        <div className="font-black italic text-muted-foreground truncate text-[11px]">
                          {line.name || "(unnamed)"}
                        </div>
                      </div>
                      <div className="text-[9px] font-mono font-bold text-success uppercase tracking-tighter">
                        {line.sku || "—"}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-4">
                    <Input
                      type="number"
                      min="1"
                      value={line.qty}
                      onChange={(e) =>
                        updateNewProductLine(line.tempId, {
                          qty: Math.max(1, parseInt(e.target.value) || 1),
                        })
                      }
                      className="h-8 rounded-lg font-black italic border-border text-center text-success text-[11px] px-1"
                    />
                  </div>
                </div>
              ))}
            {/* Empty state */}
            {selectedLines.length === 0 && newProductLines.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center py-10 text-muted-foreground/60 px-6 text-center">
                <div className="text-[9px] font-black italic uppercase tracking-widest opacity-50 leading-relaxed">
                  Initial list is empty.
                  <br />
                  Search and add items to begin.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── Main render ──────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[1200px] rounded-[2rem] max-h-[95vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 border-b bg-card shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-left">
              <div
                className={`w-14 h-14 rounded-2xl bg-${meta.color}-50 flex items-center justify-center`}
              >
                {meta.dir === "in" ? (
                  <ArrowDownToLine
                    className={`w-7 h-7 text-${meta.color}-600`}
                  />
                ) : (
                  <Truck className={`w-7 h-7 text-${meta.color}-600`} />
                )}
              </div>
              <div>
                <DialogTitle className="text-2xl font-black italic tracking-tighter">
                  {meta.label}
                </DialogTitle>
                <DialogDescription className="font-bold italic text-[10px] uppercase tracking-[0.2em] text-primary">
                  {currentStore?.name} •{" "}
                  <span className="text-muted-foreground">
                    {currentStore?.address || "No Address Set"}
                  </span>
                </DialogDescription>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="grid grid-cols-12 gap-8">
            {/* Left Column */}
            <div className="col-span-12 lg:col-span-7 space-y-6">
              {renderLeftColumn()}
            </div>

            {/* Right Column */}
            <div className="col-span-12 lg:col-span-5 space-y-6 border-l pl-8">
              <h3 className="text-xs font-black uppercase tracking-widest text-primary italic">
                2. Request Configuration
              </h3>

              {/* Selected lines */}
              {renderSelectedLines()}

              {/* Context-specific section (destination / supplier / source) */}
              {renderContextSection()}

              {/* Dates & UOM */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {meta.dir === "in" && (
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground font-bold italic">
                        Expected Date *
                      </Label>
                      <Input
                        type="date"
                        value={expectedDate}
                        onChange={(e) => setExpectedDate(e.target.value)}
                        className="h-10 rounded-xl font-bold bg-secondary/5 border-none text-[11px]"
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground font-bold italic">
                      Unit Measure
                    </Label>
                    <Select value={uom} onValueChange={setUom}>
                      <SelectTrigger className="h-10 rounded-xl font-bold bg-secondary/5 border-none text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl font-bold italic">
                        {["units", "boxes", "cases"].map((u) => (
                          <SelectItem key={u} value={u} className="text-[11px]">
                            {u.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground font-bold italic">
                    Note / Justification *
                  </Label>
                  <Textarea
                    placeholder="Why is this movement required?"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="rounded-xl font-bold resize-none bg-secondary/5 border-none text-xs min-h-[60px]"
                    rows={2}
                  />
                </div>
              </div>

              <div className="bg-warning border border-warning rounded-xl p-3 text-[10px] font-bold italic text-warning flex items-start gap-3">
                <Lock className="w-3.5 h-3.5 text-warning mt-0.5 shrink-0" />
                <p className="leading-relaxed">
                  Total{" "}
                  {selectedLines.length +
                    (isReceivePurchase ? newProductLines.length : 0)}{" "}
                  items. Request will be routed to HOD for secure verification
                  before fulfillment.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t bg-secondary/5 shrink-0">
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={movementMutation.isPending}
              className="rounded-xl font-black italic uppercase tracking-widest text-xs h-12 px-6"
            >
              Discard
            </Button>
            <Button
              disabled={!valid || movementMutation.isPending}
              onClick={handleSubmit}
              className={cn(
                "rounded-xl font-black italic uppercase tracking-widest text-xs h-12 px-8 gap-2 shadow-lg transition-all",
                valid && !movementMutation.isPending
                  ? "bg-secondary text-foreground hover:bg-secondary/60 hover:scale-105 active:scale-95 shadow-slate-200"
                  : "bg-secondary/10 text-muted-foreground",
              )}
            >
              {movementMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <><Send className="w-4 h-4" /> Send Request</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
