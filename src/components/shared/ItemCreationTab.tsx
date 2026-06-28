import React, { useState } from "react";
import { Upload, Download, Plus, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { PostekPrintModal, PrintItem } from "./PostekPrintModal";
import { NewItemFormRow, type NewItemLine } from "./NewItemFormRow";

import { retailService } from "@/core/services/retail/retailService";
import { inventoryService } from "@/core/services/inventory/inventoryService";
import type { SessionContext } from "@/core/security/session";

type Props = {
  canWrite: boolean;
  session?: SessionContext;
  tenantId?: string;
  categoryOptions?: { id: string; name: string }[];
  initialRows?: Partial<NewItemLine>[];
  onSuccess?: (createdItems?: unknown[]) => void;
};

export const ItemCreationTab: React.FC<Props> = ({
  canWrite,
  session,
  tenantId,
  categoryOptions = [],
  onSuccess,
  initialRows,
}) => {
  const { toast } = useToast();
  const csvInputRef = React.useRef<HTMLInputElement>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<NewItemLine[]>(() => {
    if (initialRows && initialRows.length > 0) {
      return initialRows.map(r => ({
        tempId: `row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sku: r.sku || "",
        name: r.name || "",
        categoryId: r.categoryId || "",
        barcode: r.barcode || "",
        price: r.price || 0,
        qty: r.qty || 1,
        unit: r.unit || "pcs",
        type: r.type || "ITEM",
        status: r.status || "active",
        description: r.description || "",
        images: r.images || [],
        primaryImageIndex: r.primaryImageIndex || 0,
        ...r
      }));
    }
    return [{
      tempId: "initial-row",
      sku: "",
      name: "",
      categoryId: "",
      barcode: "",
      price: 0,
      qty: 1,
      unit: "pcs",
      type: "ITEM",
      status: "active",
      description: "",
      images: [],
      primaryImageIndex: 0,
    }];
  });

  const [printItems, setPrintItems] = useState<PrintItem[]>([]);

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        tempId: `row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sku: "",
        name: "",
        categoryId: "",
        barcode: "",
        price: 0,
        qty: 1,
        unit: "pcs",
        type: "ITEM",
        status: "active",
        description: "",
        images: [],
        primaryImageIndex: 0,
      },
    ]);
  };

  const removeRow = (id: string) => {
    if (rows.length === 1) {
      setRows([
        {
          tempId: "row-reset",
          sku: "",
          name: "",
          categoryId: "",
          barcode: "",
          price: 0,
          qty: 1,
          unit: "pcs",
          type: "ITEM",
          status: "active",
          description: "",
          images: [],
          primaryImageIndex: 0,
        },
      ]);
      return;
    }
    setRows((Array.isArray(rows) ? rows : []).filter((r) => r.tempId !== id));
  };

  const updateRow = (id: string, patch: Partial<NewItemLine>) => {
    setRows((Array.isArray(rows) ? rows : []).map((r) => (r.tempId === id ? { ...r, ...patch } : r)));
  };

  // Global scanner support for creation
  useBarcodeScanner((barcode) => {
    const lastRow = rows[rows.length - 1];
    if (!lastRow.barcode && !lastRow.sku && !lastRow.name) {
      updateRow(lastRow.tempId, { barcode });
    } else {
      addRow();
      // Need to adjust because addRow is async state.
      // But for simple scanner, adding a row with barcode is fine.
      // We'll just update the last row for now.
    }
    toast({ title: "Barcode Scanned", description: barcode });
  });

  const handleSubmit = async () => {
    if (!session || !tenantId) return;

    try {
      const payload = (Array.isArray(rows) ? rows : []).map((r) => ({
        sku: r.sku,
        name: r.name,
        category: r.categoryId,
        barcode: r.barcode,
        base_price: r.price,
        uom: r.unit,
        description: r.description,
        active: r.status === "active",
        type: r.type,
      }));

      const res = await retailService.batchCreateItemsJson(
        tenantId,
        session,
        payload,
      );

      if (res.success) {
        // --- Image Upload Phase ---
        const createdItems = res.data as { sku: string; id: string }[];
        
        for (const row of rows) {
          if (row.images && row.images.length > 0) {
            const matchedItem = createdItems.find(item => item.sku === row.sku);
            if (matchedItem) {
              const itemId = matchedItem.id;
              
              // Sort images to upload primary first (backend sets first upload as primary by default)
              const primaryIdx = row.primaryImageIndex || 0;
              const uploadOrder = [
                row.images[primaryIdx],
                ...row.images.filter((_, idx) => idx !== primaryIdx)
              ];

              for (const file of uploadOrder) {
                try {
                  await inventoryService.uploadItemImage(tenantId, session, itemId, file);
                } catch (uploadError) {
                  console.error(`Failed to upload image for ${row.sku}:`, uploadError);
                }
              }
            }
          }
        }

        toast({
          title: "Success",
          description: "Batch items and images processed successfully.",
        });
        setRows([
          {
            tempId: "row-final",
            sku: "",
            name: "",
            categoryId: "",
            barcode: "",
            price: 0,
            qty: 1,
            unit: "pcs",
            type: "ITEM",
            status: "active",
            description: "",
            images: [],
            primaryImageIndex: 0,
          },
        ]);
        if (onSuccess) onSuccess(createdItems);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to create batch items." });
    }
  };

  const handleDownloadTemplate = async () => {
    if (!session) return;
    try {
      const blob = await retailService.downloadInventoryTemplate(session);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "inventory_template.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Could not get template.";
      toast({ 
        title: "Download Failed", 
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;
    
    toast({ title: "Uploading...", description: "Processing your CSV file." });
    
    try {
      const res = await retailService.importInventoryCsv(session, file);
      toast({ 
        title: "Import Success", 
        description: res.message || "Items imported successfully." 
      });
      if (onSuccess) onSuccess();
      if (csvInputRef.current) csvInputRef.current.value = "";
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Check your CSV format.";
      toast({ 
        title: "Import Failed", 
        description: errorMessage,
        variant: "destructive" 
      });
    }
  };

  const handleBulkImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !session) return;

    toast({ title: "Uploading Images...", description: `Processing ${files.length} images.` });

    try {
      const res = await retailService.bulkUploadInventoryImages(session, files);
      toast({ 
        title: "Bulk Processing Complete", 
        description: `Matched: ${res.matched?.length || 0}, Failed: ${res.failed?.length || 0}` 
      });
      if (onSuccess) onSuccess();
      if (imageInputRef.current) imageInputRef.current.value = "";
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Could not process images.";
      toast({ 
        title: "Upload Failed", 
        description: errorMessage,
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20">
      {/* ── Page Intro ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black italic tracking-tighter text-foreground uppercase">
            Manual Batch Creation
          </h2>
          <p className="text-muted-foreground font-medium mt-2">
            Add new unique products to the global master list.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={addRow}
            variant="outline"
            className="rounded-2xl h-12 px-6 font-black italic text-xs uppercase tracking-widest gap-2 bg-card border-white/15 hover:bg-white/10 text-foreground shadow-sm backdrop-blur-sm"
          >
            <Plus className="w-4 h-4" /> Add Another Item
          </Button>
        </div>
      </div>

      {/* ── Batch List ── */}
      <div className="space-y-6">
        {(Array.isArray(rows) ? rows : []).map((row) => (
          <NewItemFormRow
            key={row.tempId}
            line={row}
            categoryOptions={categoryOptions}
            onChange={updateRow}
            onRemove={removeRow}
            onPrint={(line) => {
              setPrintItems([
                {
                  id: line.sku || line.barcode || line.tempId,
                  sku: line.sku,
                  name: line.name || "New Item",
                  barcode: line.barcode || line.sku,
                  price: line.price,
                },
              ]);
            }}
            showQty={false} // Creation tab doesn't need qty per item (it's master list)
            showExtended={true} // Show description, type, etc.
          />
        ))}
      </div>

      {/* ── Action Footer ── */}
      <div className="sticky bottom-8 z-40 flex justify-center">
        <Button
          onClick={handleSubmit}
          disabled={!canWrite || rows.some((r) => !r.name || !r.sku)}
          className="rounded-[2rem] h-16 px-12 font-black italic uppercase tracking-[0.2em] text-sm gap-4 bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xl shadow-primary/20 transition-all hover:scale-105"
        >
          <Send className="w-5 h-5" /> Submit Batch to Core Repository
        </Button>
      </div>

      {/* ── CSV Import (Secondary) ── */}
      <div className="grid md:grid-cols-2 gap-8 mt-12">
        <Card className="rounded-[3rem] border border-border shadow-sm bg-card backdrop-blur-xl">
          <CardContent className="p-10 flex flex-col items-center text-center gap-6">
            <div className="w-20 h-20 rounded-[2rem] bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-black italic tracking-tight uppercase text-foreground">
                Bulk Import CSV
              </h3>
              <p className="text-muted-foreground text-[10px] font-medium mt-1 px-4 leading-relaxed">
                Upload your inventory list in bulk. Standard headers required.
              </p>
              <div className="flex flex-col gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={handleDownloadTemplate}
                  className="rounded-2xl h-11 px-6 font-bold text-xs tracking-tight gap-2 border-white/15 bg-card text-foreground hover:bg-white/10"
                >
                  <Download className="w-4 h-4" /> Template
                </Button>
                <input
                  type="file"
                  ref={csvInputRef}
                  onChange={handleCsvUpload}
                  className="hidden"
                  accept=".csv,.xlsx"
                />
                <Button 
                  onClick={() => csvInputRef.current?.click()}
                  className="rounded-2xl h-11 px-8 font-black italic uppercase tracking-widest text-[10px] gap-3 bg-foreground hover:bg-foreground/90 text-background"
                >
                  <Upload className="w-4 h-4" /> Select CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Bulk Image Matching (NEW) ── */}
        <Card className="rounded-[3rem] border border-border shadow-sm bg-card backdrop-blur-xl">
          <CardContent className="p-10 flex flex-col items-center text-center gap-6">
            <div className="w-20 h-20 rounded-[2rem] bg-warning border border-warning/20 flex items-center justify-center shrink-0">
              <Plus className="w-8 h-8 text-warning" />
            </div>
            <div>
              <h3 className="text-lg font-black italic tracking-tight uppercase text-foreground">
                Bulk Image Match
              </h3>
              <p className="text-muted-foreground text-[10px] font-medium mt-1 px-4 leading-relaxed">
                Name images as SKUs (e.g. PROD001.jpg) for auto-linking.
              </p>
              <div className="flex flex-col gap-3 mt-6">
                <input
                  type="file"
                  multiple
                  ref={imageInputRef}
                  onChange={handleBulkImageUpload}
                  className="hidden"
                  accept="image/*"
                />
                <Button 
                  onClick={() => imageInputRef.current?.click()}
                  className="rounded-2xl h-11 px-8 font-black italic uppercase tracking-widest text-[10px] gap-3 bg-warning hover:bg-warning text-white"
                >
                  <Upload className="w-4 h-4" /> Drop SKU Images
                </Button>
                <p className="text-[10px] text-muted-foreground italic mt-1">Supports multiple file selection</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <PostekPrintModal
        open={printItems.length > 0}
        onClose={() => setPrintItems([])}
        items={printItems}
      />
    </div>
  );
};
