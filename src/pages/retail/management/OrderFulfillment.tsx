import React, { useState, useEffect, useMemo, useCallback } from "react";
import { PageHeader } from "@/core/ui/PageHeader";
import { RetailOrder, OrderStatus } from "@/core/types/retail/retail";
import { retailService } from "@/core/services/retail/retailService";
import { apiRequest } from "@/core/api/apiClient";
import { useSession } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";
import { OrderDetailModal } from "./modals/OrderDetailModal";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { EmptyState, ErrorState } from "@/components/shared/AsyncState";
import { formatNumber } from "@/lib/format";

import {
  PackageCheck,
  Truck,
  RotateCcw,
  Zap,
  History,
  ShieldAlert,
  Clock,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// New sub-components
import { OrderRacetrack } from "./order-fulfillment/OrderRacetrack";
import { LogisticsRadar } from "./order-fulfillment/LogisticsRadar";
import { BufferHealthCard } from "./order-fulfillment/BufferHealthCard";

const OrderFulfillment = () => {
  const session = useSession();
  const { toast } = useToast();
  const [orders, setOrders] = useState<RetailOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<RetailOrder | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [activeQueue, setActiveQueue] = useState("ALL");

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsError(false);
      const data = await retailService.listOrders(session.tenant_id!, session);
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    const pending = (Array.isArray(orders) ? orders : []).filter((o) => o.status === "paid").length;
    const priority = (Array.isArray(orders) ? orders : []).filter((o) => o.totalAmount > 1000000).length;
    return { pending, priority };
  }, [orders]);

  const handleOrderClick = (order: RetailOrder) => {
    setSelectedOrder(order);
    setIsOrderModalOpen(true);
  };

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await retailService.updateOrderStatus(
        session.tenant_id!,
        session,
        orderId,
        newStatus,
      );
      setOrders((prev) =>
        (Array.isArray(prev) ? prev : []).map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)),
      );
      toast({
        title: "Signal Synchronized",
        description: `Order ${orderId} successfully transitioned to ${newStatus}.`,
      });
    } catch (e) {
      console.error(e);
      toast({
        title: "Sync Failure",
        description: "Failed to propagate order status change to the ledger.",
        variant: "destructive",
      });
    }
  };


  return (
    <div className="flex flex-col min-h-screen">
      <div className="px-6 py-3 border-b bg-background/40 backdrop-blur-md shrink-0 flex items-center justify-between gap-6">
        <PageHeader
          title="Fulfillment Engine"
          subtitle={`Node: ${session.location_id || "CENTRAL_HUB"}`}
        />
        <div className="flex items-center gap-3">
          <Button 
            onClick={async () => {
              try {
                const orderIds = orders.map((o) => o.id);
                await apiRequest("/retail/orders/archive", "POST", session, { orderIds });
                toast({ title: "Archive Generated", description: "Fulfillment manifest has been archived." });
                fetchData();
              } catch (e) {
                toast({ title: "Archive Failed", description: "Could not generate fulfillment archive.", variant: "destructive" });
              }
            }}
            variant="outline"
            className="h-10 rounded-xl px-4 font-black italic border-border text-[10px] uppercase tracking-widest gap-2"
          >
            <History className="w-3 h-3" /> MANIFEST
          </Button>
          <Button 
            onClick={async () => {
              try {
                const orderIds = orders.map((o) => o.id);
                const result = await apiRequest<{ message?: string }>("/retail/orders/batch-pick", "POST", session, { orderIds });
                toast({ title: "Batch Pick Initialized", description: result?.message || "Picking manifest broadcasted." });
                fetchData();
              } catch (e) {
                toast({ title: "Batch Pick Failed", description: "Could not initialize batch pick process.", variant: "destructive" });
              }
            }}
            className="h-10 px-5 rounded-xl bg-secondary font-black italic uppercase text-[10px] tracking-widest gap-2 shadow-lg hover:bg-secondary/60"
          >
            <Zap className="w-3 h-3 text-warning" /> START BATCH
          </Button>
        </div>
      </div>

      <div className="flex-1 p-8 lg:p-6 bg-secondary/5">
        <div className="max-w-7xl mx-auto space-y-12">
          <QueryBoundary
            query={{ isLoading, isError, data: orders, refetch: fetchData }}
            loading={
              <div className="flex h-[400px] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <RotateCcw className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-sm font-black italic uppercase tracking-widest text-muted-foreground">
                    Syncing Pipeline Data...
                  </p>
                </div>
              </div>
            }
            error={
              <ErrorState
                title="Couldn't load fulfillment pipeline"
                description="The order pipeline could not be loaded for this tenant. Check your connection and try again."
                onRetry={fetchData}
              />
            }
            empty={
              <EmptyState
                icon={PackageCheck}
                title="No orders in the pipeline"
                description="There are no fulfillment orders for this location yet. New orders will appear here as they are placed."
              />
            }
          >
            {(loadedOrders: RetailOrder[]) => (
              <div className="space-y-12">
                {/* Logistics Pulse Vitals */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card className="rounded-[2rem] p-6 bg-card border-border shadow-xl border-b-4 border-b-border hover:border-b-primary transition-all">
                    <div className="flex justify-between items-start mb-6">
                      <div className="p-4 rounded-2xl bg-primary/5 text-primary">
                        <PackageCheck className="w-5 h-5" />
                      </div>
                      <Badge className="bg-primary/5 text-primary font-black italic text-[8px] uppercase tracking-widest border-none">
                        Active
                      </Badge>
                    </div>
                    <div className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground mb-1">
                      Queue Depth
                    </div>
                    <div className="text-3xl font-black italic tracking-tighter text-foreground">
                      {stats.pending} Orders
                    </div>
                    <div className="text-[10px] font-bold italic text-muted-foreground mt-2 uppercase flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Awaiting fulfillment
                    </div>
                  </Card>

                  <Card className="rounded-[2rem] p-6 bg-card border-border shadow-xl border-b-4 border-b-border hover:border-b-warning transition-all">
                    <div className="flex justify-between items-start mb-6">
                      <div className="p-4 rounded-2xl bg-warning/10 text-warning">
                        <Truck className="w-5 h-5" />
                      </div>
                      <Badge className="bg-warning/10 text-warning font-black italic text-[8px] uppercase tracking-widest border-none">
                        Total
                      </Badge>
                    </div>
                    <div className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground mb-1">
                      Orders in View
                    </div>
                    <div className="text-3xl font-black italic tracking-tighter text-foreground">
                      {formatNumber(loadedOrders.length, { maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-[10px] font-bold italic text-muted-foreground mt-2 uppercase">
                      Across all queues
                    </div>
                  </Card>

                  <Card className="rounded-[2rem] p-6 bg-card border-border shadow-xl border-b-4 border-b-border hover:border-b-primary transition-all">
                    <div className="flex justify-between items-start mb-6">
                      <div className="p-4 rounded-2xl bg-primary/5 text-primary">
                        <Zap className="w-5 h-5" />
                      </div>
                      <Badge
                        variant="destructive"
                        className="font-black italic text-[8px] uppercase tracking-widest"
                      >
                        Priority
                      </Badge>
                    </div>
                    <div className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground mb-1">
                      High-Value Stream
                    </div>
                    <div className="text-3xl font-black italic tracking-tighter text-foreground">
                      {stats.priority} Orders
                    </div>
                    <div className="text-[10px] font-bold italic text-muted-foreground mt-2 uppercase">
                      High-value allocation
                    </div>
                  </Card>

                  <Card className="rounded-[2rem] p-6 bg-secondary text-foreground shadow-2xl relative overflow-hidden group">
                    <ShieldAlert className="absolute -right-8 -bottom-8 w-32 h-32 opacity-10 group-hover:rotate-12 transition-transform" />
                    <div className="relative z-10">
                      <div className="text-[10px] font-black italic uppercase tracking-widest text-primary mb-4">
                        Priority Ratio
                      </div>
                      <div className="text-2xl font-black italic tracking-tighter text-success">
                        {loadedOrders.length > 0
                          ? `${formatNumber((stats.priority / loadedOrders.length) * 100, { maximumFractionDigits: 1 })}%`
                          : "—"}
                      </div>
                      <div className="text-[10px] font-bold italic  mt-4 uppercase">
                        High-value share of orders
                      </div>
                    </div>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left Column (9 cols) - The Order Racetrack */}
                  <div className="lg:col-span-9 space-y-8">
                    <OrderRacetrack
                      orders={loadedOrders}
                      onOrderClick={handleOrderClick}
                      activeQueue={activeQueue}
                      setActiveQueue={setActiveQueue}
                      onRefresh={fetchData}
                    />
                  </div>

                  {/* Right Column (3 cols) - Buffer Health & Logistics Radar */}
                  <div className="lg:col-span-3 space-y-8 flex flex-col">
                    <LogisticsRadar />
                    <BufferHealthCard />
                  </div>
                </div>
              </div>
            )}
          </QueryBoundary>
        </div>
      </div>

      <OrderDetailModal
        order={selectedOrder}
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
};

export default OrderFulfillment;
