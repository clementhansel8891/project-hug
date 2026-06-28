import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ShieldCheck, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// ─── Zod Schema ────────────────────────────────────────────────────────────────

const exportSettingsSchema = z.object({
  watermarkText: z.string().min(1, "Watermark text is required"),
  opacity: z.number().min(0.05).max(1),
  size: z.number().min(12).max(144),
  positionX: z.number().min(1).max(100),
  positionY: z.number().min(1).max(100),
  includeForensic: z.boolean(),
});

export type ExportSettingsFormValues = z.infer<typeof exportSettingsSchema>;

export interface ExportSettings {
  watermarkText: string;
  opacity: number;
  size: number;
  position: { x: number; y: number };
  includeForensic: boolean;
}

interface ExportSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (settings: ExportSettings) => void;
}

export function ExportSettingsDialog({
  open,
  onOpenChange,
  onConfirm,
}: ExportSettingsDialogProps) {
  const form = useForm<ExportSettingsFormValues>({
    resolver: zodResolver(exportSettingsSchema),
    defaultValues: {
      watermarkText: "CONFIDENTIAL",
      opacity: 0.2,
      size: 72,
      positionX: 5,
      positionY: 10,
      includeForensic: true,
    },
  });

  const { formState: { errors } } = form;

  const handleSubmit = form.handleSubmit((data) => {
    onConfirm({
      watermarkText: data.watermarkText,
      opacity: data.opacity,
      size: data.size,
      position: { x: data.positionX, y: data.positionY },
      includeForensic: data.includeForensic,
    });
  });

  const handleOpenChange = (val: boolean) => {
    if (!val) {
      form.reset();
    }
    onOpenChange(val);
  };

  const opacity = form.watch("opacity");
  const size = form.watch("size");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Secure Export Settings
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 py-4">
            <Alert variant="default" className="bg-primary/5 border-primary/20">
              <Info className="h-4 w-4" />
              <AlertTitle>Forensic Traceability Active</AlertTitle>
              <AlertDescription className="text-xs">
                Every export is tagged with a unique forensic ID linked to your session, IP, and timestamp for legal compliance.
              </AlertDescription>
            </Alert>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="watermark">Watermark Text</Label>
                <Input
                  id="watermark"
                  {...form.register("watermarkText")}
                  placeholder="e.g. CONFIDENTIAL"
                  aria-describedby={errors.watermarkText ? "watermark-error" : undefined}
                />
                {errors.watermarkText && (
                  <p id="watermark-error" className="text-sm text-destructive">{errors.watermarkText.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Opacity ({Math.round(opacity * 100)}%)</Label>
                  <Slider
                    value={[opacity * 100]}
                    min={5}
                    max={100}
                    step={1}
                    onValueChange={([v]) => form.setValue("opacity", v / 100)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Size ({size}pt)</Label>
                  <Slider
                    value={[size]}
                    min={12}
                    max={144}
                    step={4}
                    onValueChange={([v]) => form.setValue("size", v)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="pos-x">Column Position</Label>
                  <Input
                    id="pos-x"
                    type="number"
                    {...form.register("positionX", { valueAsNumber: true })}
                    aria-describedby={errors.positionX ? "pos-x-error" : undefined}
                  />
                  {errors.positionX && (
                    <p id="pos-x-error" className="text-sm text-destructive">{errors.positionX.message}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pos-y">Row Position</Label>
                  <Input
                    id="pos-y"
                    type="number"
                    {...form.register("positionY", { valueAsNumber: true })}
                    aria-describedby={errors.positionY ? "pos-y-error" : undefined}
                  />
                  {errors.positionY && (
                    <p id="pos-y-error" className="text-sm text-destructive">{errors.positionY.message}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button type="submit">Export Document</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
