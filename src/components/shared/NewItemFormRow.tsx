import React from "react";
import { Trash2, Printer, Barcode, RefreshCw, Image as ImageIcon, Upload, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { generateSkuFromCategory, generateBarcode } from "./NewItemFormHelpers";

// --- Types ---

export interface NewItemLine {
  tempId: string;
  name: string;
  sku: string;
  barcode: string;
  categoryId: string;
  price: number;
  qty: number;
  unit?: string;
  description?: string;
  type?: "ITEM" | "SERVICE" | "RAW_MATERIAL";
  status?: "active" | "draft";
  images?: File[];
  primaryImageIndex?: number;
}

// --- Helpers moved to NewItemFormHelpers.ts ---

// --- Props ---

interface NewItemFormRowProps {
  line: NewItemLine;
  categoryOptions: { id: string; name: string }[];
  onChange: (id: string, changes: Partial<NewItemLine>) => void;
  onRemove: (id: string) => void;
  onPrint?: (line: NewItemLine) => void;
  showQty?: boolean;
  showExtended?: boolean;
}

// --- Component ---

export const NewItemFormRow: React.FC<NewItemFormRowProps> = ({
  line,
  categoryOptions,
  onChange,
  onRemove,
  onPrint,
  showQty = true,
  showExtended = false,
}) => {
  return (
    <div className="rounded-[1.5rem] border border-border bg-card p-6 shadow-sm hover:shadow-md transition-all space-y-4">
      {/* Row header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black italic uppercase tracking-widest text-primary">
          New Item
        </span>
        <div className="flex items-center gap-2">
          {onPrint && (
            <Button
              size="sm"
              variant="ghost"
              title="Print Barcode"
              className="h-8 w-8 p-0 rounded-lg hover:bg-primary hover:text-primary"
              onClick={() => onPrint(line)}
              disabled={!line.name || !line.sku}
            >
              <Printer className="w-4 h-4" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            title="Remove Item"
            className="h-8 w-8 p-0 rounded-lg hover:bg-destructive hover:text-destructive"
            onClick={() => onRemove(line.tempId)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* 1. Product Name */}
        <div
          className={cn(
            "space-y-1.5",
            showExtended ? "md:col-span-8" : "md:col-span-12",
          )}
        >
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Product Name *
          </Label>
          <Input
            placeholder="e.g. Arabica Coffee 250g"
            value={line.name}
            onChange={(e) => onChange(line.tempId, { name: e.target.value })}
            className="h-11 rounded-xl font-bold bg-muted border-border text-sm focus:bg-card transition-all shadow-inner"
          />
        </div>

        {/* 2. Category, Price, Qty/Unit */}
        <div className="md:col-span-12 grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="space-y-1.5 sm:col-span-1">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Category *
            </Label>
            <Select
              value={line.categoryId}
              onValueChange={(v) => {
                const catName =
                  categoryOptions.find((c) => c.id === v)?.name ?? "";
                const sku = generateSkuFromCategory(catName);
                onChange(line.tempId, {
                  categoryId: v,
                  sku,
                  barcode: generateBarcode(sku),
                });
              }}
            >
              <SelectTrigger className="h-11 rounded-xl font-bold bg-muted border-border text-sm">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl font-bold italic">
                {(Array.isArray(categoryOptions) ? categoryOptions : []).filter((c) => c.id !== "all")
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-1">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Base Price
            </Label>
            <Input
              type="number"
              min="0"
              placeholder="0.00"
              value={line.price || ""}
              onChange={(e) =>
                onChange(line.tempId, {
                  price: parseFloat(e.target.value) || 0,
                })
              }
              className="h-11 rounded-xl font-bold bg-muted border-border text-sm focus:bg-card transition-all shadow-inner"
            />
          </div>

          {showQty && (
            <div className="space-y-1.5 sm:col-span-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Quantity *
              </Label>
              <Input
                type="number"
                min="1"
                value={line.qty}
                onChange={(e) =>
                  onChange(line.tempId, {
                    qty: Math.max(1, parseInt(e.target.value) || 1),
                  })
                }
                className="h-11 rounded-xl font-bold bg-muted border-border text-sm text-center text-primary focus:bg-card transition-all shadow-inner"
              />
            </div>
          )}

          {showExtended && (
            <div className="space-y-1.5 sm:col-span-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Unit (UoM)
              </Label>
              <Input
                placeholder="pcs"
                value={line.unit}
                onChange={(e) =>
                  onChange(line.tempId, { unit: e.target.value })
                }
                className="h-11 rounded-xl font-bold bg-muted border-border text-sm focus:bg-card transition-all shadow-inner"
              />
            </div>
          )}
        </div>

        {/* 3. SKU & Barcode */}
        <div className="md:col-span-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Barcode className="w-3.5 h-3.5" /> SKU
              </div>
              {line.categoryId && (
                <span className="text-[9px] text-success italic font-black">
                  AUTO-GENERATED
                </span>
              )}
            </Label>
            <div className="relative group/sku">
              <Input
                placeholder={
                  line.categoryId
                    ? line.sku || "Auto from category"
                    : "Select category first"
                }
                value={line.sku}
                readOnly={!line.categoryId}
                onChange={(e) =>
                  onChange(line.tempId, {
                    sku: e.target.value,
                    barcode: generateBarcode(e.target.value),
                  })
                }
                className={cn(
                  "h-11 rounded-xl font-mono font-bold border-border text-xs pr-10",
                  line.categoryId
                    ? "bg-muted focus:bg-card"
                    : "bg-muted text-muted-foreground cursor-not-allowed",
                )}
              />
              {line.categoryId && (
                <button
                  onClick={() => {
                    const catName =
                      categoryOptions.find((c) => c.id === line.categoryId)
                        ?.name ?? "";
                    const sku = generateSkuFromCategory(catName);
                    onChange(line.tempId, {
                      sku,
                      barcode: generateBarcode(sku),
                    });
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                  title="Regenerate SKU"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center justify-between">
              <div>Barcode</div>
              {line.sku && (
                <span className="text-[9px] text-success italic font-black">
                  SYNCED WITH SKU
                </span>
              )}
            </Label>
            <Input
              placeholder={line.sku ? "Auto from SKU" : "—"}
              value={line.barcode}
              onChange={(e) =>
                onChange(line.tempId, { barcode: e.target.value })
              }
              className="h-11 rounded-xl font-mono font-bold bg-muted border-border text-xs focus:bg-card transition-all shadow-inner"
            />
          </div>
        </div>

        {/* 4. Extended fields (Description, Type) */}
        {showExtended && (
          <div className="md:col-span-12 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Description
              </Label>
              <textarea
                value={line.description}
                onChange={(e) =>
                  onChange(line.tempId, { description: e.target.value })
                }
                placeholder="Item details, specifications, etc..."
                className="w-full min-h-[80px] rounded-xl font-bold bg-muted border border-border p-4 text-sm focus:bg-card focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Item Type
                </Label>
                <Select
                  value={line.type || "ITEM"}
                  onValueChange={(v: "ITEM" | "SERVICE" | "RAW_MATERIAL") =>
                    onChange(line.tempId, { type: v })
                  }
                >
                  <SelectTrigger className="h-11 rounded-xl font-bold bg-muted border-border text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl font-bold italic">
                    <SelectItem value="ITEM">ITEM</SelectItem>
                    <SelectItem value="SERVICE">SERVICE</SelectItem>
                    <SelectItem value="RAW_MATERIAL">RAW MATERIAL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Default Status
                </Label>
                <Select
                  value={line.status || "active"}
                  onValueChange={(v: "active" | "draft") =>
                    onChange(line.tempId, { status: v })
                  }
                >
                  <SelectTrigger className="h-11 rounded-xl font-bold bg-muted border-border text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl font-bold italic">
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">
                      Draft (Needs Approval)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* 5. Image Upload Section */}
        <div className="md:col-span-12 space-y-3 pt-2 border-t border-border">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <ImageIcon className="w-3.5 h-3.5" /> Product Images
          </Label>
          
          <div className="flex flex-wrap gap-4">
            {/* Existing Preview Thumbnails */}
            {(line.images || []).map((file, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "relative w-24 h-24 rounded-2xl overflow-hidden border-2 transition-all group",
                  line.primaryImageIndex === idx ? "border-primary shadow-lg shadow-indigo-100" : "border-border"
                )}
              >
                <img 
                  src={URL.createObjectURL(file)} 
                  alt={`Preview ${idx}`}
                  className="w-full h-full object-cover"
                />
                
                {/* Remove button */}
                <button
                  onClick={() => {
                    const newImages = [...(line.images || [])];
                    newImages.splice(idx, 1);
                    let newPrimary = line.primaryImageIndex || 0;
                    if (newPrimary >= newImages.length) newPrimary = Math.max(0, newImages.length - 1);
                    onChange(line.tempId, { images: newImages, primaryImageIndex: newPrimary });
                  }}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                >
                  <X className="w-3 h-3" />
                </button>

                {/* Primary/Star button */}
                <button
                  onClick={() => onChange(line.tempId, { primaryImageIndex: idx })}
                  className={cn(
                    "absolute bottom-1 right-1 w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-sm",
                    line.primaryImageIndex === idx 
                      ? "bg-warning text-white opacity-100" 
                      : "bg-white/80 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-warning"
                  )}
                  title={line.primaryImageIndex === idx ? "Main Image" : "Set as Main"}
                >
                  <Star className={cn("w-3.5 h-3.5", line.primaryImageIndex === idx && "fill-current")} />
                </button>

                {line.primaryImageIndex === idx && (
                  <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-primary text-[8px] font-black text-white rounded-md uppercase tracking-tighter">
                    Main
                  </div>
                )}
              </div>
            ))}

            {/* Upload Placeholder */}
            <label className="w-24 h-24 rounded-2xl border-2 border-dashed border-border bg-muted flex flex-col items-center justify-center cursor-pointer hover:bg-muted hover:border-primary transition-all text-muted-foreground hover:text-primary group">
              <Upload className="w-6 h-6 mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-[9px] font-black uppercase tracking-tighter">Add Photo</span>
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                className="hidden" 
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) {
                    const currentImages = line.images || [];
                    onChange(line.tempId, { 
                      images: [...currentImages, ...files],
                      primaryImageIndex: currentImages.length === 0 ? 0 : line.primaryImageIndex 
                    });
                  }
                }}
              />
            </label>
          </div>
          <p className="text-[9px] text-muted-foreground font-medium">
            First image is "Main" by default. Set main image to be used as product thumbnail.
          </p>
        </div>
      </div>
    </div>

  );
};
