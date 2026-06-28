/**
 * ProductDetailEditDialog — Wired modal for editing product master data.
 *
 * Full product detail edit: name, SKU, barcode, category, type, price, unit,
 * stock levels, and description.
 *
 * Requirements: 1 (Form Fields), 2 (Validation), 3 (API Submission),
 *               4 (Loading State), 5 (Error Handling), 6 (Success Handling),
 *               10 (Consistent Pattern)
 */

import React, { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
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
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/core/api/apiClient";
import { getMutationToastHandlers } from "@/lib/modal-helpers";
import { InventoryItemView } from "../types";
import { RetailProduct } from "@/core/types/retail/retail";

// ─── Zod Schema ─────────────────────────────────────────────────────────────────

const productDetailEditSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  sku: z.string().min(1, "SKU is required"),
  barcode: z.string().optional().default(""),
  category_id: z.string().min(1, "Category is required"),
  base_price: z.coerce.number().min(0, "Price must be 0 or more"),
  unit: z.string().optional().default(""),
  type: z.string().min(1, "Item type is required"),
  description: z.string().optional().default(""),
  stock_on_hand: z.coerce.number().min(0, "Stock cannot be negative"),
  reserved: z.coerce.number().min(0, "Reserved cannot be negative"),
});

export type ProductDetailEditFormValues = z.infer<typeof productDetailEditSchema>;

// ─── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  item: InventoryItemView | null;
  open: boolean;
  onClose: () => void;
  categories: { id: string; name: string }[];
  onSubmit?: (productId: string, data: Partial<RetailProduct>) => Promise<void>;
  isLoading?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export const ProductDetailEditDialog: React.FC<Props> = ({
  item,
  open,
  onClose,
  categories,
  onSubmit,
  isLoading: externalLoading = false,
}) => {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ProductDetailEditFormValues>({
    resolver: zodResolver(productDetailEditSchema),
    defaultValues: {
      name: "",
      sku: "",
      barcode: "",
      category_id: "",
      base_price: 0,
      unit: "",
      type: "ITEM",
      description: "",
      stock_on_hand: 0,
      reserved: 0,
    },
  });

  const { register, control, formState: { errors }, handleSubmit, reset, watch } = form;

  // Reset form when item changes
  useEffect(() => {
    if (item && open) {
      reset({
        name: item.name || "",
        sku: item.sku || "",
        barcode: item.barcode || "",
        category_id: item.categoryId || "",
        base_price: item.price || 0,
        unit: item.unit || "",
        type: item.type || "ITEM",
        description: item.description || "",
        stock_on_hand: item.onHand || 0,
        reserved: item.reserved || 0,
      });
    }
  }, [item, open, reset]);

  const mutation = useMutation({
    mutationFn: async (data: ProductDetailEditFormValues) => {
      if (!item) throw new Error("No item selected");

      const payload = {
        name: data.name,
        sku: data.sku,
        barcode: data.barcode,
        categoryId: data.category_id,
        price: data.base_price,
        unit: data.unit,
        type: data.type,
        description: data.description,
        stock: data.stock_on_hand,
        metadata: {
          stock_on_hand: data.stock_on_hand,
          reserved: data.reserved,
        },
      };

      // If external onSubmit is provided, use it (backward compat)
      if (onSubmit) {
        await onSubmit(item.id, payload as unknown as Partial<RetailProduct>);
        return;
      }

      return apiRequest(
        `/v1/retail/inventory/${item.id}`,
        "PATCH",
        session,
        payload,
      );
    },
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["retail", "inventory"]],
      onClose,
      form,
      successTitle: "Product Updated",
      successDescription: `${item?.name || "Product"} details have been saved.`,
    }),
  });

  const onFormSubmit = handleSubmit((data) => mutation.mutate(data));
  const isPending = mutation.isPending || externalLoading;

  const stockOnHand = watch("stock_on_hand");
  const reserved = watch("reserved");

  if (!item) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !isPending) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent
        className="max-w-2xl rounded-2xl p-8 border-none shadow-2xl bg-white/95 backdrop-blur-xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <DialogHeader className="px-8 pt-8 pb-4 border-b bg-white/90 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center">
              <span className="text-xl font-black italic text-primary">P</span>
            </div>
            <div>
              <DialogTitle className="text-2xl font-black italic tracking-tight text-foreground">
                Edit Product
              </DialogTitle>
              <DialogDescription className="font-bold italic text-xs uppercase tracking-widest text-muted-foreground">
                Master Data Configuration • {item.sku}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={onFormSubmit} noValidate>
          <fieldset disabled={isPending} className="flex-1 overflow-y-auto px-8 py-6">
            <div className="grid grid-cols-2 gap-6 py-2">
              {/* Row 1: Name & SKU */}
              <div className="space-y-2">
                <Label htmlFor="product-name" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
                  Product Name *
                </Label>
                <Input
                  id="product-name"
                  {...register("name")}
                  aria-describedby={errors.name ? "product-name-error" : undefined}
                  aria-invalid={!!errors.name}
                  className="h-12 rounded-2xl font-bold bg-secondary/5 border-none focus-visible:ring-2 focus-visible:ring-blue-500/20 transition-all px-5"
                  placeholder="e.g. Leather Jacket"
                />
                {errors.name && (
                  <p id="product-name-error" className="text-[10px] text-destructive font-medium" role="alert">
                    {errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-sku" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
                  SKU Code *
                </Label>
                <Input
                  id="product-sku"
                  {...register("sku")}
                  aria-describedby={errors.sku ? "product-sku-error" : undefined}
                  aria-invalid={!!errors.sku}
                  className="h-12 rounded-2xl font-bold bg-secondary/5 border-none focus-visible:ring-2 focus-visible:ring-blue-500/20 transition-all px-5 font-mono uppercase"
                />
                {errors.sku && (
                  <p id="product-sku-error" className="text-[10px] text-destructive font-medium" role="alert">
                    {errors.sku.message}
                  </p>
                )}
              </div>

              {/* Row 2: Category & Type */}
              <div className="space-y-2">
                <Label htmlFor="product-category" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
                  Category *
                </Label>
                <Controller
                  control={control}
                  name="category_id"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        id="product-category"
                        className="h-12 rounded-2xl font-bold bg-secondary/5 border-none px-5"
                        aria-describedby={errors.category_id ? "product-category-error" : undefined}
                        aria-invalid={!!errors.category_id}
                      >
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-2xl p-2">
                        {(Array.isArray(categories) ? categories : []).map((cat) => (
                          <SelectItem key={cat.id} value={cat.id} className="rounded-xl font-bold italic py-3">
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.category_id && (
                  <p id="product-category-error" className="text-[10px] text-destructive font-medium" role="alert">
                    {errors.category_id.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-type" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
                  Item Type *
                </Label>
                <Controller
                  control={control}
                  name="type"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        id="product-type"
                        className="h-12 rounded-2xl font-bold bg-secondary/5 border-none px-5"
                        aria-describedby={errors.type ? "product-type-error" : undefined}
                        aria-invalid={!!errors.type}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-2xl p-2">
                        <SelectItem value="ITEM" className="rounded-xl font-bold italic py-3">ITEM</SelectItem>
                        <SelectItem value="SERVICE" className="rounded-xl font-bold italic py-3">SERVICE</SelectItem>
                        <SelectItem value="RAW_MATERIAL" className="rounded-xl font-bold italic py-3">RAW MATERIAL</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.type && (
                  <p id="product-type-error" className="text-[10px] text-destructive font-medium" role="alert">
                    {errors.type.message}
                  </p>
                )}
              </div>

              {/* Row 3: Base Price & Unit */}
              <div className="space-y-2">
                <Label htmlFor="product-price" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
                  Base Price *
                </Label>
                <div className="relative">
                  <Input
                    id="product-price"
                    type="number"
                    {...register("base_price", { valueAsNumber: true })}
                    aria-describedby={errors.base_price ? "product-price-error" : undefined}
                    aria-invalid={!!errors.base_price}
                    className="h-12 rounded-2xl font-black italic bg-secondary/5 border-none pl-12 pr-5 focus-visible:ring-2 focus-visible:ring-blue-500/20 transition-all"
                  />
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[10px] font-black italic text-muted-foreground">
                    Rp
                  </span>
                </div>
                {errors.base_price && (
                  <p id="product-price-error" className="text-[10px] text-destructive font-medium" role="alert">
                    {errors.base_price.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-unit" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
                  Unit (UoM)
                </Label>
                <Input
                  id="product-unit"
                  {...register("unit")}
                  className="h-12 rounded-2xl font-bold bg-secondary/5 border-none px-5"
                  placeholder="e.g. Pcs, Kg, Box"
                />
              </div>

              {/* Row 4: Stock Levels */}
              <div className="space-y-2">
                <Label htmlFor="product-soh" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
                  Stock on Hand (SOH)
                </Label>
                <Input
                  id="product-soh"
                  type="number"
                  {...register("stock_on_hand", { valueAsNumber: true })}
                  aria-describedby={errors.stock_on_hand ? "product-soh-error" : undefined}
                  aria-invalid={!!errors.stock_on_hand}
                  className="h-12 rounded-2xl font-bold bg-secondary/5 border-none focus-visible:ring-2 focus-visible:ring-blue-500/20 transition-all px-5"
                />
                {errors.stock_on_hand && (
                  <p id="product-soh-error" className="text-[10px] text-destructive font-medium" role="alert">
                    {errors.stock_on_hand.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-reserved" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
                  Reserved / ATS
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="product-reserved"
                    type="number"
                    {...register("reserved", { valueAsNumber: true })}
                    aria-describedby={errors.reserved ? "product-reserved-error" : undefined}
                    aria-invalid={!!errors.reserved}
                    className="h-12 rounded-2xl font-bold bg-secondary/5 border-none focus-visible:ring-2 focus-visible:ring-amber-500/20 transition-all px-5 min-w-0"
                    placeholder="Reserved"
                  />
                  <div
                    className={cn(
                      "h-12 flex items-center justify-center shrink-0 px-4 rounded-2xl font-black text-sm",
                      (stockOnHand || 0) - (reserved || 0) > 0
                        ? "bg-success text-success"
                        : "bg-destructive text-destructive",
                    )}
                    title="Available to Sell"
                  >
                    ATS {(stockOnHand || 0) - (reserved || 0)}
                  </div>
                </div>
                {errors.reserved && (
                  <p id="product-reserved-error" className="text-[10px] text-destructive font-medium" role="alert">
                    {errors.reserved.message}
                  </p>
                )}
              </div>

              {/* Row 5: Description */}
              <div className="col-span-2 space-y-2">
                <Label htmlFor="product-desc" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
                  Description
                </Label>
                <Textarea
                  id="product-desc"
                  {...register("description")}
                  className="min-h-[100px] rounded-2xl font-bold bg-secondary/5 border-none focus-visible:ring-2 focus-visible:ring-blue-500/20 transition-all p-5 resize-none leading-relaxed"
                  placeholder="Detailed product description, variants mapping, or web sync notes..."
                />
              </div>
            </div>
          </fieldset>

          <DialogFooter className="px-8 py-6 border-t bg-white/90 backdrop-blur-xl shrink-0 gap-3 sm:justify-start">
            <Button
              type="submit"
              disabled={isPending}
              className="flex-1 h-14 rounded-2xl bg-secondary hover:bg-secondary/60 text-foreground font-black italic shadow-xl shadow-slate-900/10 transition-all hover:-translate-y-0.5"
            >
              {isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</>
              ) : (
                "Save Changes"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => { reset(); onClose(); }}
              className="h-14 px-8 rounded-2xl font-black italic bg-white border-2 border-border hover:bg-secondary/5 transition-all"
            >
              Cancel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
