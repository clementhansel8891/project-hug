import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Barcode,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  PackagePlus,
} from "lucide-react";

// ─── Zod Schema ────────────────────────────────────────────────────────────────

const createItemSchema = z.object({
  name: z.string().min(1, "Item name is required").max(200, "Name too long"),
  categoryId: z.string().min(1, "Category is required"),
});

type CreateItemFormValues = z.infer<typeof createItemSchema>;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface UnknownBarcodeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  barcode: string;
  onReportAnomaly: (barcode: string) => void;
  onCreateNew: (itemData: any) => void;
  categoryOptions: { id: string; name: string }[];
}

export const UnknownBarcodeDialog: React.FC<UnknownBarcodeDialogProps> = ({
  isOpen,
  onClose,
  barcode,
  onReportAnomaly,
  onCreateNew,
  categoryOptions,
}) => {
  const [step, setStep] = React.useState<"choice" | "create">("choice");

  const form = useForm<CreateItemFormValues>({
    resolver: zodResolver(createItemSchema),
    defaultValues: {
      name: "",
      categoryId: "",
    },
  });

  const { formState: { errors } } = form;

  const reset = () => {
    setStep("choice");
    form.reset();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = form.handleSubmit((data) => {
    onCreateNew({
      name: data.name,
      category_id: data.categoryId,
      barcode,
      sku: barcode,
      unit: "pcs",
      module_tags: ["inventory"],
    });
    handleClose();
  });

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none rounded-[2rem] shadow-2xl">
        {/* Animated Background Header */}
        <div className="relative h-32 bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-[-10%] left-[-10%] w-40 h-40 bg-white rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-[-20%] right-[-10%] w-60 h-60 bg-warning rounded-full blur-3xl" />
          </div>
          <div className="relative z-10 flex flex-col items-center text-white">
            <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl mb-2">
              <Barcode className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black italic uppercase tracking-widest">Unknown Barcode</h2>
          </div>
        </div>

        <div className="p-8">
          {step === "choice" ? (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <p className="text-muted-foreground font-medium text-sm">
                  The barcode <span className="font-mono font-black text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{barcode}</span> was not found in the master list.
                </p>
                <p className="text-[10px] uppercase font-black tracking-tighter text-warning">Action Required to Proceed</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <button
                  onClick={() => setStep("create")}
                  className="group relative flex items-center gap-4 p-5 rounded-[1.5rem] border-2 border-border bg-white hover:border-primary hover:shadow-xl hover:shadow-indigo-50 transition-all text-left"
                >
                  <div className="bg-primary p-3 rounded-xl group-hover:bg-primary group-hover:text-white transition-colors">
                    <PackagePlus className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-black text-muted-foreground text-sm italic uppercase">Add as New Item</h3>
                    <p className="text-xs text-muted-foreground font-medium leading-tight">Register this item immediately for future tracking.</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </button>

                <button
                  onClick={() => {
                    onReportAnomaly(barcode);
                    handleClose();
                  }}
                  className="group relative flex items-center gap-4 p-5 rounded-[1.5rem] border-2 border-border bg-white hover:border-warning hover:shadow-xl hover:shadow-amber-50 transition-all text-left"
                >
                  <div className="bg-warning p-3 rounded-xl group-hover:bg-warning group-hover:text-white transition-colors">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-black text-muted-foreground text-sm italic uppercase">Report Anomaly</h3>
                    <p className="text-xs text-muted-foreground font-medium leading-tight">Flag this barcode as unrecognized for manual review.</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-warning group-hover:translate-x-1 transition-all" />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="item-name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Item Name</Label>
                  <Input
                    id="item-name"
                    autoFocus
                    placeholder="e.g. Red Bull 250ml"
                    {...form.register("name")}
                    className="h-12 rounded-xl border-border font-bold focus:ring-2 focus:ring-indigo-500/20"
                    aria-describedby={errors.name ? "item-name-error" : undefined}
                  />
                  {errors.name && (
                    <p id="item-name-error" className="text-sm text-destructive">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="item-category" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category</Label>
                  <select
                    id="item-category"
                    {...form.register("categoryId")}
                    className="w-full h-12 rounded-xl border border-border bg-white px-3 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    aria-describedby={errors.categoryId ? "item-category-error" : undefined}
                  >
                    <option value="">Select Category...</option>
                    {categoryOptions.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  {errors.categoryId && (
                    <p id="item-category-error" className="text-sm text-destructive">{errors.categoryId.message}</p>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-primary border border-primary flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  <p className="text-[10px] font-bold text-primary leading-tight">
                    This item will be saved with barcode <span className="font-mono">{barcode}</span> and submitted for approval after audit.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1 rounded-xl font-bold"
                  onClick={() => {
                    setStep("choice");
                    form.reset();
                  }}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-[2] rounded-xl font-black italic uppercase tracking-widest bg-primary hover:bg-primary shadow-lg shadow-indigo-100"
                >
                  Save & Add
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
