import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertTriangle,
  PackagePlus,
  CheckSquare,
  Square,
  Barcode,
  Zap,
  RefreshCw,
  Loader2
} from "lucide-react";
import { ItemCreationTab } from "./ItemCreationTab";
import { useSession } from "@/core/security/session";
import { retailService } from "@/core/services/retail/retailService";
import { useToast } from "@/hooks/use-toast";
import {
  ANOMALY_CATEGORY_NAME,
  buildQuickRegisterPayload,
  resolveQuickRegisterResponse,
} from "@/lib/quick-register";

interface UnresolvedBarcodesModalProps {
  isOpen: boolean;
  onClose: () => void;
  unresolvedBarcodes: string[];
  onFlagAnomalies: (barcodes: string[]) => void;
  onItemsRegistered: (newItems: any[]) => void;
  categoryOptions: { id: string; name: string }[];
}

export const UnresolvedBarcodesModal: React.FC<UnresolvedBarcodesModalProps> = ({
  isOpen,
  onClose,
  unresolvedBarcodes,
  onFlagAnomalies,
  onItemsRegistered,
  categoryOptions,
}) => {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [showItemCreation, setShowItemCreation] = useState(false);

  // Safety net: ensure page is always interactive when the modal fully closes
  const handleClose = React.useCallback(() => {
    document.body.style.pointerEvents = "auto";
    onClose();
  }, [onClose]);

  // Pre-select all barcodes when the modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSelected(unresolvedBarcodes);
    }
  }, [isOpen, unresolvedBarcodes]);

  const toggleSelectAll = () => {
    if (selected.length === unresolvedBarcodes.length) {
      setSelected([]);
    } else {
      setSelected(unresolvedBarcodes);
    }
  };

  const toggleSelect = (barcode: string) => {
    setSelected(prev =>
      prev.includes(barcode)
        ? prev.filter(b => b !== barcode)
        : [...prev, barcode]
    );
  };

  const handleFlagSelected = () => {
    if (selected.length === 0) return;
    onFlagAnomalies(selected);
    setSelected([]);
  };

  // ─── Quick Register Mutation ─────────────────────────────────────────────────

  const quickRegisterMutation = useMutation({
    mutationFn: async (barcodes: string[]) => {
      const payload = buildQuickRegisterPayload(barcodes);
      return retailService.batchCreateItemsJson(session!.tenant_id, session!, payload);
    },
    onSuccess: (res) => {
      if (res.success) {
        const created = (Array.isArray(res.data) ? res.data : []) as Record<string, unknown>[];
        const resolved = resolveQuickRegisterResponse(selected, created);

        toast({
          title: "Items Registered as Anomalies",
          description: `${selected.length} item(s) created in the "${ANOMALY_CATEGORY_NAME}" category. These items are flagged for later completion.`,
        });

        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        onItemsRegistered(resolved);

        if (selected.length === unresolvedBarcodes.length) {
          handleClose();
        } else {
          setSelected([]);
        }
      } else {
        toast({
          title: "Registration Failed",
          description: "Could not register items. Please try again.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Registration Failed",
        description: error.message || "An error occurred while registering items.",
        variant: "destructive",
      });
    },
  });

  const handleQuickRegisterIncomplete = () => {
    if (selected.length === 0 || !session?.tenant_id) return;
    quickRegisterMutation.mutate(selected);
  };

  if (showItemCreation) {
    const initialRows = selected.map(barcode => ({
      barcode: barcode,
      sku: barcode,
      name: `New Item - ${barcode}`,
    }));

    return (
      <Dialog open={true} onOpenChange={(open) => {
        if (!open) {
          document.body.style.pointerEvents = "auto";
          setShowItemCreation(false);
        }
      }}>
        <DialogContent className="max-w-[95vw] h-[90vh] rounded-[2rem] border-none shadow-2xl bg-muted dark:bg-muted p-0 overflow-y-auto">
          <div className="p-8">
            <ItemCreationTab
              canWrite={true}
              session={session}
              tenantId={session.tenant_id}
              categoryOptions={categoryOptions}
              onSuccess={(createdItems) => {
                queryClient.invalidateQueries({ queryKey: ["inventory"] });
                onItemsRegistered(createdItems);
                document.body.style.pointerEvents = "auto";
                setShowItemCreation(false);
                if (selected.length === unresolvedBarcodes.length) {
                  handleClose();
                } else {
                  setSelected([]);
                }
              }}
              initialRows={initialRows}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleClose();
    }}>
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden border-none rounded-[2rem] shadow-2xl">
        <div className="relative h-32 bg-muted flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-[-10%] left-[-10%] w-40 h-40 bg-primary rounded-full blur-3xl" />
            <div className="absolute bottom-[-20%] right-[-10%] w-60 h-60 bg-warning rounded-full blur-3xl" />
          </div>
          <div className="relative z-10 flex flex-col items-center text-white">
            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl mb-2">
              <Barcode className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-black italic uppercase tracking-widest">Unresolved Scans</h2>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div>
            <h3 className="font-black text-lg italic text-muted-foreground uppercase">Action Required</h3>
            <p className="text-sm text-muted-foreground font-medium">
              You scanned {unresolvedBarcodes.length} barcode(s) that are not in the master list.
              Please resolve them before finalizing the audit.
            </p>
          </div>

          <div className="border border-border rounded-2xl overflow-hidden">
            <div className="bg-muted border-b border-border p-4 flex items-center gap-4">
              <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-muted-foreground transition-colors">
                {selected.length === unresolvedBarcodes.length ? (
                  <CheckSquare className="w-5 h-5" />
                ) : (
                  <Square className="w-5 h-5" />
                )}
              </button>
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                {selected.length} Selected
              </span>
            </div>
            <div className="max-h-[300px] overflow-y-auto p-2">
              {unresolvedBarcodes.map(barcode => (
                <div
                  key={barcode}
                  className="flex items-center gap-4 p-3 hover:bg-muted rounded-xl cursor-pointer transition-colors"
                  onClick={() => toggleSelect(barcode)}
                >
                  <Checkbox
                    checked={selected.includes(barcode)}
                    onCheckedChange={() => toggleSelect(barcode)}
                  />
                  <div className="font-mono font-bold text-muted-foreground bg-white border border-border px-3 py-1 rounded-lg">
                    {barcode}
                  </div>
                </div>
              ))}
              {unresolvedBarcodes.length === 0 && (
                <div className="p-8 text-center text-muted-foreground font-bold italic">
                  No unresolved barcodes remaining.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 pt-4">
            <p className="text-[11px] text-muted-foreground font-medium italic">
              Tip: Use <span className="font-black text-primary not-italic">Quick Register</span> to create
              stub items instantly (no details required) so the audit isn't blocked. They land in the
              "{ANOMALY_CATEGORY_NAME}" category and can be completed later.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button
                variant="outline"
                className="flex-1 min-w-[180px] h-14 rounded-xl border-warning text-warning bg-warning hover:bg-warning hover:text-warning font-black italic uppercase tracking-widest text-xs"
                disabled={selected.length === 0 || quickRegisterMutation.isPending}
                onClick={handleFlagSelected}
              >
                <AlertTriangle className="w-4 h-4 mr-2" /> Flag as Anomalies
              </Button>
              <Button
                className="flex-1 min-w-[180px] h-14 rounded-xl bg-success hover:bg-success/90 text-white font-black italic uppercase tracking-widest text-xs shadow-xl relative"
                disabled={selected.length === 0 || quickRegisterMutation.isPending}
                onClick={handleQuickRegisterIncomplete}
              >
                <span className="absolute top-2 right-2">
                  <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-warning text-black">
                    Anomaly
                  </span>
                </span>
                {quickRegisterMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                Quick Register (Anomaly)
              </Button>
              <Button
                variant="outline"
                className="flex-1 min-w-[180px] h-14 rounded-xl border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 font-black italic uppercase tracking-widest text-xs"
                disabled={selected.length === 0 || quickRegisterMutation.isPending}
                onClick={() => setShowItemCreation(true)}
              >
                <PackagePlus className="w-4 h-4 mr-2" /> Register with Details
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
