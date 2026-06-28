import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input as UIInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select as UISelect,
  SelectContent as UISelectContent,
  SelectItem as UISelectItem,
  SelectTrigger as UISelectTrigger,
  SelectValue as UISelectValue,
} from "@/components/ui/select";
import { useSession } from "@/core/security/session";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Box, Tags, BarChart3, Tag } from "lucide-react";
import { createItemSchema, type CreateItemInput } from "../schemas";
import { useCreateItem } from "../hooks/useInventoryQueries";

interface CreateItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateItemDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateItemDialogProps) {
  const session = useSession();
  const createMutation = useCreateItem();
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    category: "",
    uom: "pcs",
    base_price: 0,
    description: "",
    minStock: 0,
    status: "active",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const result = createItemSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await createMutation.mutateAsync({
        ...formData,
        base_price: Number(formData.base_price),
      });
      onSuccess();
      onOpenChange(false);
      setFormData({
        sku: "",
        name: "",
        category: "",
        uom: "pcs",
        base_price: 0,
        description: "",
        minStock: 0,
        status: "active",
      });
      setErrors({});
    } catch (error: any) {
      // Error is handled by the mutation's onError callback
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] rounded-[3rem] border-none shadow-2xl bg-card dark:bg-muted p-0 overflow-hidden">
        <form onSubmit={handleSubmit}>
          <div className="bg-muted p-8 text-white">
            <div className="flex items-center gap-3 text-primary font-black text-[10px] uppercase tracking-[0.3em] mb-2">
              <Plus className="h-3 w-3" /> CATALOG_ADDITION
            </div>
            <DialogTitle className="text-3xl font-black tracking-tighter uppercase italic">
              New Inventory Item
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-bold italic">
              Define a new product identity within the logistics engine.
            </DialogDescription>
          </div>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Unique SKU</Label>
                <div className="relative">
                  <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <UIInput
                    required
                    maxLength={50}
                    className="pl-12 h-12 rounded-2xl bg-muted dark:bg-muted border-none font-bold"
                    placeholder="e.g. ELE-MAC-001"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  />
                </div>
                {errors.sku && <p className="text-[10px] text-destructive font-bold ml-1">{errors.sku}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Category</Label>
                <div className="relative">
                  <Tags className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <UIInput
                    required
                    className="pl-12 h-12 rounded-2xl bg-muted dark:bg-muted border-none font-bold"
                    placeholder="e.g. Electronics"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  />
                </div>
                {errors.category && <p className="text-[10px] text-destructive font-bold ml-1">{errors.category}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Item Identity (Name)</Label>
              <div className="relative">
                <Box className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <UIInput
                  required
                  maxLength={200}
                  className="pl-12 h-12 rounded-2xl bg-muted dark:bg-muted border-none font-bold"
                  placeholder="e.g. Macbook Pro M3 14-inch"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              {errors.name && <p className="text-[10px] text-destructive font-bold ml-1">{errors.name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Base Cost ($)</Label>
                <div className="relative">
                  <BarChart3 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <UIInput
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-12 h-12 rounded-2xl bg-muted dark:bg-muted border-none font-bold"
                    value={formData.base_price}
                    onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                {errors.base_price && <p className="text-[10px] text-destructive font-bold ml-1">{errors.base_price}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Unit of Measure</Label>
                <UISelect 
                  value={formData.uom} 
                  onValueChange={(val) => setFormData({ ...formData, uom: val })}
                >
                  <UISelectTrigger className="h-12 rounded-2xl bg-muted dark:bg-muted border-none font-bold">
                    <UISelectValue />
                  </UISelectTrigger>
                  <UISelectContent className="rounded-2xl border-none shadow-2xl">
                    <UISelectItem value="pcs" className="font-bold">Pieces (pcs)</UISelectItem>
                    <UISelectItem value="kg" className="font-bold">Kilograms (kg)</UISelectItem>
                    <UISelectItem value="units" className="font-bold">Units</UISelectItem>
                    <UISelectItem value="box" className="font-bold">Boxes</UISelectItem>
                  </UISelectContent>
                </UISelect>
                {errors.uom && <p className="text-[10px] text-destructive font-bold ml-1">{errors.uom}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Description</Label>
              <Textarea
                className="min-h-[100px] rounded-2xl bg-muted dark:bg-muted border-none font-medium italic"
                placeholder="Technical specifications and logistics notes..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-6 border-t gap-3">
              <Button 
                type="button" 
                variant="ghost" 
                className="rounded-xl h-12 px-6 font-black text-[10px] uppercase tracking-widest"
                onClick={() => onOpenChange(false)}
              >
                Discard
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="rounded-xl h-12 px-10 font-black text-[10px] uppercase tracking-widest bg-muted text-white hover:bg-muted shadow-xl"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Execute Creation
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
