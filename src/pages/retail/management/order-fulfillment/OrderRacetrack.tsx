import React, { useState, useMemo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Globe,
  Smartphone,
  Store,
  Printer,
  ChevronRight,
  Package,
  CheckCircle,
  RefreshCw,
} from "lucide-react";
import type { RetailOrder, OrderStatus } from "@/core/types/retail/retail";
import { getActiveCarriers } from "@/core/config/logistics-carriers.config";
import { cn } from "@/lib/utils";
import { useSession } from "@/core/security/session";
import { retailService } from "@/core/services/retail/retailService";
import { useToast } from "@/hooks/use-toast";

// ─────────────────────────────────────────────────────────────────────────────
// Tab configuration ─ must mirror the OrderStatus lifecycle
// ─────────────────────────────────────────────────────────────────────────────

const TABS: { key: string; label: string; statuses: OrderStatus[] }[] = [
  { key: "ALL", label: "All", statuses: [] },
  { key: "PAID", label: "Paid", statuses: ["paid"] },
  { key: "PROCESSING", label: "Processing", statuses: ["processing"] },
  {
    key: "READY_FOR_PICKUP",
    label: "Ready for Pickup",
    statuses: ["ready_for_pickup"],
  },
  { key: "SHIPPED", label: "Shipped", statuses: ["shipped"] },
  { key: "COMPLETE", label: "Complete", statuses: ["complete"] },
  {
    key: "EXCEPTIONS",
    label: "Exceptions",
    statuses: ["cancelled", "refunded"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Status Badge helper
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_META: Record<OrderStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-secondary/10 text-muted-foreground" },
  pending_payment: {
    label: "Pending Payment",
    className: "bg-warning text-warning",
  },
  reserved: { label: "Reserved", className: "bg-primary/5 text-primary" },
  paid: { label: "Paid", className: "bg-primary/5 text-primary" },
  processing: {
    label: "Processing",
    className: "bg-primary text-primary",
  },
  ready_for_pickup: { label: "Ready", className: "bg-warning text-warning" },
  shipped: { label: "Shipped", className: "bg-cyan-50 text-cyan-700" },
  complete: { label: "Complete", className: "bg-success text-success" },
  cancelled: { label: "Cancelled", className: "bg-destructive text-destructive" },
  refunded: { label: "Refunded", className: "bg-destructive text-destructive" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface OrderRacetrackProps {
  orders: RetailOrder[];
  onOrderClick: (order: RetailOrder) => void;
  activeQueue: string;
  setActiveQueue: (val: string) => void;
  onRefresh?: () => void;
}

export const OrderRacetrack: React.FC<OrderRacetrackProps> = ({
  orders,
  onOrderClick,
  activeQueue,
  setActiveQueue,
  onRefresh,
}) => {
  const session = useSession();
  const { toast } = useToast();
  const carriers = getActiveCarriers();
  const [loading, setLoading] = useState(false);
  const [awbInputs, setAwbInputs] = useState<Record<string, string>>({});
  const [tempAwbInputs, setTempAwbInputs] = useState<
    Record<string, { carrier: string; awb: string }>
  >({});
  const [search, setSearch] = useState("");

  /** Returns orders filtered by the active tab */
  const filteredOrders = useMemo(() => {
    const tab = TABS.find((t) => t.key === activeQueue);
    const statusFiltered =
      !tab || tab.statuses.length === 0
        ? orders
        : (Array.isArray(orders) ? orders : []).filter((o) => tab.statuses.includes(o.status as OrderStatus));

    if (!search.trim()) return statusFiltered;
    const q = search.toLowerCase();
    return (Array.isArray(statusFiltered) ? statusFiltered : []).filter(
      (o) =>
        o.id.toLowerCase().includes(q) ||
        (o.customerName || "").toLowerCase().includes(q) ||
        (awbInputs[o.id] || "").toLowerCase().includes(q),
    );
  }, [orders, activeQueue, search, awbInputs]);

  /** Returns tab count badge values */
  const tabCount = useMemo(() => {
    const counts: Record<string, number> = { ALL: orders.length };
    for (const tab of TABS.slice(1)) {
      counts[tab.key] = (Array.isArray(orders) ? orders : []).filter((o) =>
        tab.statuses.includes(o.status as OrderStatus),
      ).length;
    }
    return counts;
  }, [orders]);

  const handleManualShip = useCallback(async (orderId: string, carrier: string, awb: string) => {
    if (!session.tenantId) return;
    setLoading(true);
    try {
      await retailService.updateOrder(session.tenantId, session, orderId, {
        status: "shipped",
        metadata: {
          carrier,
          awb,
          shipped_at: new Date().toISOString()
        }
      });

      toast({
        title: "Order Shipped",
        description: `AWB ${awb} synced for Order ${(orderId || "").split("-")[0]}`
      });

      onRefresh?.();
      
      // Reset temp state after save
      setTempAwbInputs((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    } catch (error) {
      console.error("[OrderRacetrack] Sync failed:", error);
      toast({
        title: "Sync Failed",
        description: "Logistics engine could not process shipment.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [session, onRefresh, toast]);

  const getChannelInfo = (paymentMethod?: string) => {
    switch (paymentMethod) {
      case "cash":
      case "store_credit":
        return { source: "POS", icon: Store };
      case "qr":
        return { source: "MOBILE", icon: Smartphone };
      case "card":
      default:
        return { source: "WEB", icon: Globe };
    }
  };

  return (
    <div className="space-y-8">
      <Tabs
        value={activeQueue}
        onValueChange={setActiveQueue}
        className="space-y-6"
      >
        {/* Header row: tabs + search */}
        <div className="flex items-center justify-between border-b pb-4 overflow-x-auto scrollbar-hide">
          <TabsList className="bg-transparent h-auto p-0 gap-4 flex-shrink-0">
            {(Array.isArray(TABS) ? TABS : []).map((tab) => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="group relative bg-transparent h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-border data-[state=active]:bg-transparent px-0 font-black italic uppercase tracking-widest text-[10px] flex items-center gap-1.5"
              >
                {tab.label}
                {tabCount[tab.key] > 0 && (
                  <span
                    className={cn(
                      "ml-1 rounded-full px-1.5 py-0.5 text-[8px] font-black",
                      activeQueue === tab.key
                        ? "bg-secondary text-foreground"
                        : "bg-secondary/10 text-muted-foreground",
                    )}
                  >
                    {tabCount[tab.key]}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="relative w-64 flex-shrink-0 ml-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-12 h-11 bg-white border-border rounded-xl text-xs font-bold italic placeholder:text-muted-foreground/60"
              placeholder="Search Order, Customer, or AWB..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <TabsContent value={activeQueue} className="m-0">
          {filteredOrders.length === 0 ? (
            <Card className="rounded-2xl shadow-2xl border-none bg-white overflow-hidden">
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Package className="w-12 h-12 text-muted-foreground" />
                <p className="text-xs font-black italic uppercase tracking-widest text-muted-foreground/60">
                  No orders in this queue
                </p>
              </div>
            </Card>
          ) : (
            <Card className="rounded-2xl shadow-2xl border-none bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-secondary/5 text-[10px] uppercase font-black tracking-widest text-muted-foreground italic">
                      <th className="px-6 py-5 text-left">Order Token</th>
                      <th className="px-6 py-5 text-left">Channel</th>
                      <th className="px-6 py-5 text-center">Payload Cost</th>
                      <th className="px-6 py-5 text-center">Status</th>
                      <th className="px-6 py-5 text-left">Logistics</th>
                      <th className="px-6 py-5 text-right">Gate Entry</th>
                      <th className="px-6 py-5 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 italic">
                    {(Array.isArray(filteredOrders) ? filteredOrders : []).map((order) => {
                      const channel = getChannelInfo(order.paymentMethod);
                      const ChannelIcon = channel.icon;
                      const existingAwb = awbInputs[order.id];
                      const tempInput = tempAwbInputs[order.id] || {
                        carrier: carriers[0]?.code ?? "JNE",
                        awb: "",
                      };
                      const statusMeta =
                        STATUS_META[order.status as OrderStatus] ??
                        STATUS_META["draft"];
                      const isCompleted =
                        order.status === "complete" ||
                        order.status === "cancelled" ||
                        order.status === "refunded";

                      return (
                        <tr
                          key={order.id}
                          className={cn(
                            "group hover:bg-secondary/5 transition-all cursor-pointer",
                            isCompleted && "opacity-60",
                          )}
                          onClick={() => onOrderClick(order)}
                        >
                          {/* Order Token */}
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-4">
                              <div
                                className={cn(
                                  "w-10 h-10 rounded-2xl flex items-center justify-center font-black italic text-[10px] shadow-inner",
                                  (order.totalAmount || 0) > 1000000
                                    ? "bg-warning text-warning"
                                    : "bg-secondary/5 text-muted-foreground",
                                )}
                              >
                                #{order.id.split("-").pop()?.substring(0, 4)}
                              </div>
                              <div>
                                <div className="text-xs font-black tracking-tight text-foreground">
                                  {(order.id || "").split("-")[0].toUpperCase()}
                                </div>
                                <div className="text-[10px] text-muted-foreground font-bold uppercase mt-0.5">
                                  {order.customerName || "Walk-in"}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Channel */}
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-xl bg-secondary/10 text-muted-foreground group-hover:bg-secondary group-hover:text-foreground transition-all">
                                <ChannelIcon className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="text-xs font-black text-muted-foreground italic leading-tight uppercase">
                                  {channel.source}
                                </div>
                                <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                                  Loc:{" "}
                                  {(order.storeId ?? "").substring?.(0, 8) ||
                                    "N/A"}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Payload Cost */}
                          <td className="px-6 py-5 text-center">
                            <div className="text-sm font-black italic tracking-tighter text-foreground">
                              Rp{" "}
                              {(order.totalAmount || 0).toLocaleString("id-ID")}
                            </div>
                            <div className="text-[10px] font-bold text-muted-foreground uppercase">
                              {order.items?.length ?? 0} item
                              {(order.items?.length ?? 0) !== 1 ? "s" : ""}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-6 py-5 text-center">
                            <Badge
                              className={cn(
                                "text-[9px] font-black italic border-none h-5 px-2",
                                statusMeta.className,
                              )}
                            >
                              {statusMeta.label}
                            </Badge>
                          </td>

                          {/* Logistics */}
                          <td
                            className="px-6 py-5 text-left"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {order.status === "complete" ? (
                              <div className="flex items-center gap-2 text-success">
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-black italic uppercase">
                                  Delivered
                                </span>
                              </div>
                            ) : channel.source === "POS" ||
                              order.status === "ready_for_pickup" ? (
                              <div className="flex items-center gap-2">
                                <Badge className="bg-success text-success border-none text-[9px] font-black italic uppercase">
                                  Ready for Pickup
                                </Badge>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-muted-foreground hover:text-foreground rounded bg-secondary/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    console.log(
                                      "[PRINT] Printing receipt for",
                                      order.id,
                                    );
                                  }}
                                >
                                  <Printer className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : existingAwb ? (
                              <div className="text-[10px] font-black text-muted-foreground uppercase">
                                AWB: {existingAwb}
                              </div>
                            ) : order.status === "cancelled" ||
                              order.status === "refunded" ? (
                              <span className="text-[10px] font-bold italic text-muted-foreground uppercase">
                                N/A
                              </span>
                            ) : (
                              <div
                                className="flex items-center gap-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {/* Carrier selector from config */}
                                <select
                                  className="h-8 text-xs border border-border rounded-md bg-white font-bold italic px-2 cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-900"
                                  value={tempInput.carrier}
                                  onChange={(e) =>
                                    setTempAwbInputs((prev) => ({
                                      ...prev,
                                      [order.id]: {
                                        ...tempInput,
                                        carrier: e.target.value,
                                      },
                                    }))
                                  }
                                >
                                  {(Array.isArray(carriers) ? carriers : []).map((c) => (
                                    <option key={c.code} value={c.code}>
                                      {c.label}
                                    </option>
                                  ))}
                                </select>

                                <Input
                                  className="h-8 w-32 text-xs font-bold italic px-3 py-0 border-border focus-visible:ring-slate-900"
                                  placeholder="AWB / Manifest #"
                                  value={tempInput.awb}
                                  onChange={(e) =>
                                    setTempAwbInputs((prev) => ({
                                      ...prev,
                                      [order.id]: {
                                        ...tempInput,
                                        awb: e.target.value,
                                      },
                                    }))
                                  }
                                />

                                <Button
                                  size="sm"
                                  className="h-8 bg-secondary text-foreground font-black italic text-xs px-3 rounded-md uppercase hover:bg-secondary/60 disabled:opacity-40"
                                  disabled={!tempInput.awb.trim()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (tempInput.awb.trim()) {
                                      handleManualShip(
                                        order.id,
                                        tempInput.carrier,
                                        tempInput.awb.trim(),
                                      );
                                    }
                                  }}
                                >
                                  Save
                                </Button>
                              </div>
                            )}
                          </td>

                          {/* Gate Entry */}
                          <td className="px-6 py-5 text-right">
                            <div className="text-[10px] font-black italic text-muted-foreground uppercase mb-0.5">
                              Ingested
                            </div>
                            <div className="text-[9px] font-bold text-muted-foreground uppercase">
                              {order.createdAt
                                ? new Date(order.createdAt).toLocaleTimeString(
                                    "id-ID",
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )
                                : "N/A"}
                            </div>
                          </td>

                          {/* Chevron */}
                          <td className="px-6 py-5 text-right cursor-pointer">
                            <ChevronRight className="w-4 h-4 text-muted-foreground inline-block group-hover:text-foreground transition-colors" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
