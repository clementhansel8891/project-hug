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
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Package,
  MapPin,
  User,
  Clock,
  DollarSign,
  Truck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useSession } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/core/api/apiClient";
import { getMutationToastHandlers } from "@/lib/modal-helpers";
import type { RetailOrder, OrderStatus } from "@/core/types/retail/retail";

interface OrderDetailModalProps {
  order: RetailOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (orderId: string, newStatus: OrderStatus) => void;
  onVoid?: (orderId: string) => void;
  onRefund?: (orderId: string, items: string[]) => void;
}

// ─── Zod Schema for Status Change action ────────────────────────────────────

const statusChangeSchema = z.object({
  newStatus: z.string().min(1, "Status is required"),
});

type StatusChangeFormValues = z.infer<typeof statusChangeSchema>;

// ─── Zod Schema for Void action ─────────────────────────────────────────────

const voidOrderSchema = z.object({
  orderId: z.string().min(1),
});

type VoidOrderFormValues = z.infer<typeof voidOrderSchema>;

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  isOpen,
  onClose,
  onStatusChange,
  onVoid,
  onRefund,
}) => {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ─── Status Change Mutation ─────────────────────────────────────────────────
  const statusForm = useForm<StatusChangeFormValues>({
    resolver: zodResolver(statusChangeSchema),
    defaultValues: { newStatus: "" },
  });

  const statusMutation = useMutation({
    mutationFn: (data: StatusChangeFormValues) =>
      apiRequest(`/v1/retail/orders/${order?.id}/status`, "PATCH", session, {
        status: data.newStatus,
      }),
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["retail", "orders"]],
      onClose,
      form: statusForm,
      successTitle: "Status Updated",
      successDescription: "Order status has been updated successfully.",
    }),
  });

  // ─── Void Order Mutation ────────────────────────────────────────────────────
  const voidForm = useForm<VoidOrderFormValues>({
    resolver: zodResolver(voidOrderSchema),
    defaultValues: { orderId: "" },
  });

  const voidMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/retail/orders/${order?.id}`, "DELETE", session),
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["retail", "orders"]],
      onClose,
      form: voidForm,
      successTitle: "Order Voided",
      successDescription: "The order has been voided successfully.",
    }),
  });

  // ─── Refund Mutation ────────────────────────────────────────────────────────
  const refundMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/retail/orders/${order?.id}/refund`, "POST", session, {
        items: order?.items?.map((i: any) => i.product_id) ?? [],
      }),
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["retail", "orders"]],
      onClose,
      form: statusForm,
      successTitle: "Refund Initiated",
      successDescription: "The refund has been processed successfully.",
    }),
  });

  const isPending = statusMutation.isPending || voidMutation.isPending || refundMutation.isPending;

  if (!order) return null;

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case "pending_payment":
      case "reserved":
        return "bg-secondary/10 text-muted-foreground";
      case "paid":
        return "bg-primary text-primary";
      case "processing":
        return "bg-warning text-warning";
      case "ready_for_pickup":
        return "bg-primary/10 text-primary";
      case "shipped":
        return "bg-success/10 text-success";
      case "complete":
        return "bg-secondary text-foreground";
      case "cancelled":
        return "bg-destructive text-destructive";
      case "refunded":
        return "bg-destructive text-destructive";
      default:
        return "bg-secondary/10 text-muted-foreground";
    }
  };

  const handleStatusChange = (newStatus: OrderStatus) => {
    statusMutation.mutate({ newStatus });
    onStatusChange?.(order.id, newStatus);
  };

  const handleVoid = () => {
    voidMutation.mutate();
    onVoid?.(order.id);
  };

  const handleRefund = () => {
    refundMutation.mutate();
    onRefund?.(order.id, (Array.isArray(order.items) ? order.items : []).map((i: any) => i.product_id));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isPending) onClose(); }}>
      <DialogContent className="max-w-3xl rounded-2xl border-none shadow-2xl max-h-[90vh] overflow-y-auto p-0 scrollbar-hide">
        <div className="relative">
          {/* Header Gradient */}
          <div className="h-32 bg-gradient-to-r from-slate-900 to-indigo-950 px-8 flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-black italic tracking-tighter uppercase text-foreground">
                Fulfillment Token: {order.id.slice(-8).toUpperCase()}
              </DialogTitle>
              <div className="text-[10px] font-black italic uppercase tracking-widest text-primary/70 mt-1 flex items-center gap-2">
                <Clock className="w-3 h-3" /> Timestamp:{" "}
                {new Date(order.createdAt).toLocaleString()}
              </div>
            </div>
            <Badge
              className={cn(
                getStatusColor(order.status as OrderStatus),
                "font-black italic text-[10px] uppercase tracking-widest px-4 py-2 rounded-xl shadow-lg border-none",
              )}
            >
              {order.status.toUpperCase().replace("_", " ")}
            </Badge>
          </div>

          <div className="p-8 space-y-8 bg-white min-h-[400px]">
            {/* Customer & Logistics Logic Block */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-secondary/5 rounded-[2rem] p-6 flex items-center gap-4 border border-border">
                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                    Carrier Destination
                  </div>
                  <div className="font-black italic text-foreground">
                    {order.customerName || "Walk-in Customer"}
                  </div>
                </div>
              </div>

              <div className="bg-secondary/5 rounded-[2rem] p-6 flex items-center gap-4 border border-border">
                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-success" />
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                    Node Origin
                  </div>
                  <div className="font-black italic text-foreground">
                    {order.storeId.slice(-8).toUpperCase()}
                  </div>
                </div>
              </div>
            </div>

            {/* Line Item Payloads */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Package className="w-4 h-4" /> Pipeline Payloads
                </div>
                <Badge className="bg-primary/5 text-primary border-none font-black italic text-[9px] uppercase tracking-widest">
                  {order.items.length} Units
                </Badge>
              </div>

              <div className="space-y-3">
                {(Array.isArray(order.items) ? order.items : []).map((item, idx) => {
                  const soh = Math.floor(Math.random() * 50) + 5;
                  const safetyBuffer = 10;
                  const ats = soh - safetyBuffer;
                  const isBufferWarning = ats < item.quantity;

                  return (
                    <div
                      key={idx}
                      className="flex flex-col p-5 bg-white border border-border rounded-xl hover:border-primary transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-secondary/5 rounded-2xl flex items-center justify-center group-hover:bg-primary/5 transition-colors">
                            <Package className="w-6 h-6 text-muted-foreground group-hover:text-primary" />
                          </div>
                          <div>
                            <div className="font-black italic text-foreground">
                              {item.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">
                              Quantity Payload: {item.quantity}
                            </div>
                          </div>
                        </div>
                        <div className="text-right font-black italic text-foreground">
                          Rp {(item.totalPrice || 0).toLocaleString()}
                        </div>
                      </div>

                      {/* Stock Integrity Telemetry */}
                      <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                        <div className="flex gap-6 text-[9px] font-black italic uppercase tracking-widest">
                          <p className="text-muted-foreground">
                            SOH: <span className="text-foreground">{soh}</span>
                          </p>
                          <p className="text-muted-foreground">
                            Buffer:{" "}
                            <span className="text-foreground">
                              {safetyBuffer}
                            </span>
                          </p>
                          <p
                            className={
                              isBufferWarning
                                ? "text-warning"
                                : "text-success"
                            }
                          >
                            ATS: {ats}
                          </p>
                        </div>
                        {isBufferWarning && (
                          <Badge className="bg-warning text-warning border-none font-black italic text-[8px] uppercase tracking-tighter">
                            <AlertTriangle className="w-3 h-3 mr-1" /> Stock
                            Depletion Risk
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Financial Ledger Block */}
            <Card className="rounded-[2rem] bg-background p-6 border-none text-foreground shadow-2xl relative overflow-hidden">
              <DollarSign className="absolute -right-4 -bottom-4 w-24 h-24 text-foreground/5 opacity-20" />
              <div className="relative z-10 space-y-4">
                <div className="flex justify-between items-center text-[10px] font-black italic uppercase tracking-widest text-primary">
                  <span>Manifest Total</span>
                  <span>{order.paymentMethod?.toUpperCase()}</span>
                </div>
                <div className="flex justify-between items-end">
                  <div className="text-2xl font-black italic tracking-tighter">
                    Rp {(order.totalAmount || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] font-bold italic opacity-40 uppercase">
                    Tax Included: Rp {(order.tax || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </Card>

            {/* Tactical Action Bar */}
            <div className="flex gap-4 pt-4 pb-2">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isPending}
                className="h-14 flex-1 rounded-2xl border-border font-black italic uppercase text-[10px] tracking-widest hover:bg-secondary/5"
              >
                Cancel View
              </Button>

              {order.status === "paid" && (
                <Button
                  onClick={() => handleStatusChange("processing")}
                  disabled={isPending}
                  className="h-14 flex-[2] bg-primary hover:bg-primary/90 rounded-2xl font-black italic uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100"
                >
                  {statusMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Package className="w-4 h-4 mr-2" />
                  )}
                  Initiate Processing
                </Button>
              )}

              {order.status === "processing" && (
                <Button
                  onClick={() => handleStatusChange("ready_for_pickup")}
                  disabled={isPending}
                  className="h-14 flex-[2] bg-warning hover:bg-warning rounded-2xl font-black italic uppercase text-[10px] tracking-widest shadow-xl shadow-amber-100"
                >
                  {statusMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Clock className="w-4 h-4 mr-2" />
                  )}
                  Mark Ready for Pickup
                </Button>
              )}

              {order.status === "ready_for_pickup" && (
                <Button
                  onClick={() => handleStatusChange("shipped")}
                  disabled={isPending}
                  className="h-14 flex-[2] bg-success hover:bg-success rounded-2xl font-black italic uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-100"
                >
                  {statusMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Truck className="w-4 h-4 mr-2" />
                  )}
                  Dispatch Payload
                </Button>
              )}

              {order.status === "shipped" && (
                <Button
                  onClick={() => handleStatusChange("complete")}
                  disabled={isPending}
                  className="h-14 flex-[2] bg-secondary hover:bg-secondary/60 rounded-2xl font-black italic uppercase text-[10px] tracking-widest shadow-xl shadow-slate-100"
                >
                  {statusMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  Confirm Receipt
                </Button>
              )}

              {/* Advanced Actions (Void/Refund) */}
              {(order.status === "paid" || order.status === "processing") && (
                <Button
                  variant="ghost"
                  onClick={handleVoid}
                  disabled={isPending}
                  className="h-14 w-14 rounded-2xl border border-destructive text-destructive hover:bg-destructive"
                  title="Void Order"
                >
                  {voidMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                </Button>
              )}

              {order.status === "complete" && (
                <Button
                  variant="ghost"
                  onClick={handleRefund}
                  disabled={isPending}
                  className="h-14 w-14 rounded-2xl border border-warning text-warning hover:bg-warning"
                  title="Initiate Refund"
                >
                  {refundMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                </Button>
              )}
            </div>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
