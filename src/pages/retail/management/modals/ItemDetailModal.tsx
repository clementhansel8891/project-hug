import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, TrendingUp, MapPin, Clock, Edit3, Trash2, Loader2 } from "lucide-react";
import { useModuleList } from "@/hooks/useModuleQuery";
import { useSession } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/core/api/apiClient";
import { getMutationToastHandlers } from "@/lib/modal-helpers";

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  stock: number;
}

interface MovementRecord {
  date: string;
  type: string;
  qty: number;
  location: string;
  ref: string;
}

interface LocationRecord {
  name: string;
  stock: number;
  status: string;
}

interface ItemDetailModalProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (item: InventoryItem) => void;
  onDelete?: (sku: string) => void;
}

// ─── Zod Schema for Delete action ───────────────────────────────────────────

const deleteItemSchema = z.object({
  sku: z.string().min(1),
});

type DeleteItemFormValues = z.infer<typeof deleteItemSchema>;

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}) => {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  if (!item) return null;

  // ─── Delete Mutation ────────────────────────────────────────────────────────
  const deleteForm = useForm<DeleteItemFormValues>({
    resolver: zodResolver(deleteItemSchema),
    defaultValues: { sku: item?.sku ?? "" },
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/retail/inventory/items/${item.id}`, "DELETE", session),
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["retail", "inventory"]],
      onClose,
      form: deleteForm,
      successTitle: "Item Deleted",
      successDescription: `${item.name} has been removed from inventory.`,
    }),
  });

  const handleDelete = () => {
    deleteMutation.mutate();
    onDelete?.(item.sku);
  };

  const isPending = deleteMutation.isPending;

  // Fetch movements from backend, fallback to empty array
  const { data: movementsData } = useModuleList<MovementRecord>(
    `/retail/inventory/items/${item.id}/movements`,
    { page: 1, pageSize: 20 },
    { enabled: isOpen }
  );
  const movements = movementsData?.data ?? [];

  // Fetch location stock from backend, fallback to empty array
  const { data: locationsData } = useModuleList<LocationRecord>(
    `/retail/inventory/items/${item.id}/locations`,
    { page: 1, pageSize: 10 },
    { enabled: isOpen }
  );
  const locations = locationsData?.data ?? [];

  const getMovementColor = (type: string) => {
    switch (type) {
      case 'SALE': return 'text-destructive bg-destructive';
      case 'RECEIVE': return 'text-success bg-success';
      case 'TRANSFER': return 'text-primary bg-primary/5';
      case 'ADJUSTMENT': return 'text-warning bg-warning';
      default: return 'text-muted-foreground bg-secondary/5';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isPending) onClose(); }}>
      <DialogContent className="max-w-4xl rounded-[2rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-black italic tracking-tighter uppercase">
                {item.name}
              </DialogTitle>
              <DialogDescription className="font-bold italic mt-1">
                SKU: {item.sku} • Category: {item.category}
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              {onEdit && (
                <Button
                  onClick={() => onEdit(item)}
                  variant="outline"
                  size="sm"
                  className="h-10 px-4 rounded-xl font-black italic"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
              {onDelete && (
                <Button
                  onClick={handleDelete}
                  disabled={isPending}
                  variant="outline"
                  size="sm"
                  className="h-10 px-4 rounded-xl font-black italic text-destructive border-destructive hover:bg-destructive"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Delete
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-4">
          <TabsList className="grid w-full grid-cols-3 rounded-xl bg-secondary/10 p-1">
            <TabsTrigger value="overview" className="rounded-lg font-black italic text-xs">Overview</TabsTrigger>
            <TabsTrigger value="movements" className="rounded-lg font-black italic text-xs">Movements</TabsTrigger>
            <TabsTrigger value="locations" className="rounded-lg font-black italic text-xs">Locations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-primary/5 rounded-2xl p-6 border-2 border-primary">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-5 h-5 text-primary" />
                  <div className="text-xs font-black uppercase tracking-widest text-primary">Stock On Hand</div>
                </div>
                <div className="text-3xl font-black italic text-primary">{item.stock}</div>
                <div className="text-xs text-primary font-bold mt-1">Units Available</div>
              </div>

              <div className="bg-success rounded-2xl p-6 border-2 border-success">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-success" />
                  <div className="text-xs font-black uppercase tracking-widest text-success">Turnover</div>
                </div>
                <div className="text-3xl font-black italic text-success">8.2x</div>
                <div className="text-xs text-success font-bold mt-1">Per Month</div>
              </div>

              <div className="bg-warning rounded-2xl p-6 border-2 border-warning">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-warning" />
                  <div className="text-xs font-black uppercase tracking-widest text-warning">Reorder Point</div>
                </div>
                <div className="text-3xl font-black italic text-warning">15</div>
                <div className="text-xs text-warning font-bold mt-1">Safety Stock</div>
              </div>
            </div>

            <div className="bg-secondary/5 rounded-2xl p-6">
              <div className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">Item Details</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground font-bold">Item ID</div>
                  <div className="font-black italic">{item.id}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-bold">Category</div>
                  <div className="font-black italic">{item.category}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-bold">Status</div>
                  <Badge className="bg-success/10 text-success font-black italic">ACTIVE</Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-bold">Last Updated</div>
                  <div className="font-black italic text-sm">{new Date().toLocaleDateString()}</div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="movements" className="space-y-3 mt-4">
            <div className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">Recent Activity</div>
            {(Array.isArray(movements) ? movements : []).map((movement, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-white border border-border rounded-xl hover:border-primary transition-all">
                <div className="flex items-center gap-4">
                  <Badge className={`${getMovementColor(movement.type)} font-black italic text-xs px-3`}>
                    {movement.type}
                  </Badge>
                  <div>
                    <div className="font-black italic text-sm">{movement.ref}</div>
                    <div className="text-xs text-muted-foreground font-bold">{movement.location}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-black italic ${movement.qty > 0 ? 'text-success' : 'text-destructive'}`}>
                    {movement.qty > 0 ? '+' : ''}{movement.qty}
                  </div>
                  <div className="text-xs text-muted-foreground font-bold">{movement.date}</div>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="locations" className="space-y-3 mt-4">
            <div className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">Stock by Location</div>
            {(Array.isArray(locations) ? locations : []).map((location, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-white border border-border rounded-xl">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-primary" />
                  <div>
                    <div className="font-black italic">{location.name}</div>
                    <Badge className="bg-success/10 text-success font-black italic text-xs mt-1">
                      {location.status}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black italic text-foreground">{location.stock}</div>
                  <div className="text-xs text-muted-foreground font-bold">Units</div>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
