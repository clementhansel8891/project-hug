import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { inventoryService } from "@/core/services/inventory/inventoryService";
import { useSession } from "@/core/security/session";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, MapPin, Calendar, User, FileText, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TransferManifestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transferId: string | null;
}

export function TransferManifestDialog({
  open,
  onOpenChange,
  transferId,
}: TransferManifestDialogProps) {
  const session = useSession();
  const [transfer, setTransfer] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const formatDate = (date: any) => {
    try {
      if (!date) return "Pending";
      const d = new Date(date);
      if (isNaN(d.getTime())) return "Pending";
      return d.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (e) {
      console.error("Date formatting error:", e);
      return "Pending";
    }
  };

  useEffect(() => {
    if (open && transferId) {
      const fetchDetail = async () => {
        setLoading(true);
        try {
          const res = await inventoryService.getStockTransfer(session.tenant_id, session, transferId);
          setTransfer(res);
        } catch (err) {
          console.error("Failed to fetch transfer detail:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchDetail();
    } else {
      setTransfer(null);
    }
  }, [open, transferId, session]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-card dark:bg-muted max-h-[90vh] flex flex-col">
        <DialogHeader className="p-8 bg-muted dark:bg-muted border-b border-border dark:border-border">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-[0.3em]">
                <FileText className="h-3 w-3" /> LOGISTICS_MANIFEST
              </div>
              <DialogTitle className="text-2xl font-black tracking-tighter uppercase italic">
                {loading ? "Syncing..." : `Transfer #${transfer?.id?.split('-')[0].toUpperCase() || "..."}`}
              </DialogTitle>
            </div>
            {transfer && (
              <Badge variant="outline" className="rounded-xl px-4 py-1 text-[10px] font-black uppercase tracking-widest border-none bg-primary/10 text-primary">
                {transfer.status}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-[400px]">
          <div className="p-8 space-y-8">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
          ) : transfer ? (
            <>
              {/* Route Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-3xl bg-muted dark:bg-muted border border-border dark:border-border space-y-3">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <MapPin className="h-3 w-3" /> Origin Node
                  </div>
                  <div className="text-lg font-black tracking-tight">{transfer.from_location?.name || transfer.from_location_id}</div>
                  <div className="text-xs text-muted-foreground italic">Central Distribution Hub</div>
                </div>
                <div className="p-6 rounded-3xl bg-primary/5 border border-primary/10 space-y-3 relative overflow-hidden">
                  <ArrowRight className="absolute -right-4 -bottom-4 h-24 w-24 text-primary/5 -rotate-12" />
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary">
                    <MapPin className="h-3 w-3" /> Target Node
                  </div>
                  <div className="text-lg font-black tracking-tight">{transfer.to_location?.name || transfer.to_location_id}</div>
                  <div className="text-xs text-primary/60 italic">Retail Node Destination</div>
                </div>
              </div>

              {/* Item Details */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Asset Inventory Line</h3>
                  <div className="text-[10px] font-black text-muted-foreground">{transfer.quantity} Units Total</div>
                </div>
                <div className="p-6 rounded-3xl border border-border dark:border-border flex items-center gap-6 group hover:border-primary/30 transition-all">
                  <div className="h-20 w-20 rounded-2xl bg-muted dark:bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {transfer.item_masters?.image_url ? (
                      <img src={transfer.item_masters.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="text-[10px] font-black text-primary uppercase tracking-widest">{transfer.item_masters?.sku}</div>
                    <div className="text-xl font-black tracking-tighter uppercase">{transfer.item_masters?.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{transfer.item_masters?.description || "No technical description provided."}</div>
                  </div>
                </div>
              </div>

              {/* Protocol Logs */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Lifecycle Protocol</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl bg-muted dark:bg-muted border border-border dark:border-border">
                    <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Requested</div>
                    <div className="text-[11px] font-bold truncate">
                      {formatDate(transfer.requested_at || transfer.requestedAt || transfer.created_at || transfer.createdAt)}
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-muted dark:bg-muted border border-border dark:border-border">
                    <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Picked</div>
                    <div className="text-[11px] font-bold truncate">
                      {formatDate(transfer.picked_at || transfer.pickedAt)}
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-muted dark:bg-muted border border-border dark:border-border">
                    <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Shipped</div>
                    <div className="text-[11px] font-bold truncate">
                      {formatDate(transfer.shipped_at || transfer.shippedAt)}
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-muted dark:bg-muted border border-border dark:border-border">
                    <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Received</div>
                    <div className="text-[11px] font-bold truncate">
                      {formatDate(transfer.received_at || transfer.receivedAt)}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="py-20 text-center opacity-20">
              <Package className="h-12 w-12 mx-auto mb-4" />
              <div className="text-xl font-black uppercase tracking-widest">No Protocol Data</div>
            </div>
          )}
        </div>
      </div>

        <DialogFooter className="p-8 bg-muted border-t border-border flex flex-row items-center justify-between">
          <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
            Estela Gea Logistics Core v2.4
          </div>
          <Button 
            className="rounded-xl px-8 h-12 bg-card text-muted-foreground font-black uppercase tracking-widest text-[10px] hover:bg-muted"
            onClick={() => onOpenChange(false)}
          >
            Close Manifest
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
