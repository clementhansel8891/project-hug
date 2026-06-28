import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MousePointer2, Settings2 } from "lucide-react";

// ─── Zod Schema ────────────────────────────────────────────────────────────────

const watermarkConfigSchema = z.object({
  text: z.string().min(1, "Watermark text is required"),
  x: z.number().min(1).max(8),
  y: z.number().min(1).max(10),
});

export type WatermarkConfigFormValues = z.infer<typeof watermarkConfigSchema>;

interface WatermarkConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (config: { text: string; x: number; y: number }) => void;
}

export function WatermarkConfigDialog({ open, onOpenChange, onConfirm }: WatermarkConfigDialogProps) {
  const form = useForm<WatermarkConfigFormValues>({
    resolver: zodResolver(watermarkConfigSchema),
    defaultValues: {
      text: "INTERNAL USE ONLY",
      x: 3,
      y: 5,
    },
  });

  const { formState: { errors } } = form;
  const posX = form.watch("x");
  const posY = form.watch("y");

  const gridRows = 10;
  const gridCols = 8;

  const handleSubmit = form.handleSubmit((data) => {
    onConfirm(data);
  });

  const handleOpenChange = (val: boolean) => {
    if (!val) {
      form.reset();
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" /> Watermark Configuration
          </DialogTitle>
          <DialogDescription>
            Customize and position the security watermark for this export.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="wm-text">Watermark Text</Label>
              <Input
                id="wm-text"
                {...form.register("text")}
                placeholder="e.g. CONFIDENTIAL"
                aria-describedby={errors.text ? "wm-text-error" : undefined}
              />
              {errors.text && (
                <p id="wm-text-error" className="text-sm text-destructive">{errors.text.message}</p>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Position (Click to Place)</Label>
                <span className="text-xs text-muted-foreground font-mono">X:{posX} Y:{posY}</span>
              </div>

              <div className="border rounded-lg p-2 bg-muted/30">
                <div className="grid grid-cols-8 gap-1 aspect-[4/3]">
                  {Array.from({ length: gridRows * gridCols }).map((_, i) => {
                    const x = (i % gridCols) + 1;
                    const y = Math.floor(i / gridCols) + 1;
                    const isSelected = x === posX && y === posY;

                    return (
                      <div
                        key={i}
                        onClick={() => {
                          form.setValue("x", x);
                          form.setValue("y", y);
                        }}
                        className={`border rounded-sm cursor-pointer transition-all flex items-center justify-center text-[8px]
                          ${isSelected ? "bg-primary border-primary text-primary-foreground shadow-md scale-110 z-10" : "bg-background hover:bg-primary/10 border-muted-foreground/20 text-muted-foreground/30"}
                        `}
                      >
                        {isSelected ? <MousePointer2 className="h-2 w-2" /> : `${String.fromCharCode(64 + x)}${y}`}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-center mt-2 text-muted-foreground italic">
                  Simulated spreadsheet grid. Selected: {String.fromCharCode(64 + posX)}{posY}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button type="submit">Config & Export</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
