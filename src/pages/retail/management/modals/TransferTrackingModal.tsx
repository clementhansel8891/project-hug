import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Truck, MapPin, Clock, CheckCircle2, Package } from "lucide-react";
import { useSession } from "@/core/security/session";
import { apiRequest } from "@/core/api/apiClient";
import { LoadingSpinner, QueryErrorState, QueryEmptyState } from "@/components/shared/QueryStateWrapper";

interface TransferTrackingModalProps {
  transferId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface TransferData {
  id: string;
  from: string;
  to: string;
  status: string;
  eta: string;
  items: number;
}

interface TimelineEvent {
  time: string;
  status: string;
  desc: string;
  completed: boolean;
}

export const TransferTrackingModal: React.FC<TransferTrackingModalProps> = ({
  transferId,
  isOpen,
  onClose,
}) => {
  const session = useSession();

  // ─── useQuery for transfer tracking data ──────────────────────────────────
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["retail", "transfers", transferId, "tracking"],
    queryFn: () =>
      apiRequest<{
        transfer: TransferData;
        timeline: TimelineEvent[];
      }>(`/inventory/transfers/${transferId}/tracking`, "GET", session),
    enabled: isOpen && !!transferId && !!session?.tenant_id,
  });

  const transfer = data?.transfer ?? null;
  const timeline = Array.isArray(data?.timeline) ? data.timeline : [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl rounded-[2rem]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black italic tracking-tighter uppercase">
            Transfer Tracking
          </DialogTitle>
          <DialogDescription className="font-bold italic">
            Transfer ID: {transferId}
          </DialogDescription>
        </DialogHeader>

        {isLoading && <LoadingSpinner label="Loading transfer tracking…" />}

        {!isLoading && isError && (
          <QueryErrorState message={(error as any)?.message || "Failed to load transfer tracking data"} onRetry={() => refetch()} />
        )}

        {!isLoading && !isError && !transfer && (
          <QueryEmptyState message="No tracking data available for this transfer." />
        )}

        {!isLoading && !isError && transfer && (
          <div className="space-y-6 py-4">
            {/* Transfer Summary */}
            <div className="bg-secondary/5 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-primary" />
                  <div>
                    <div className="text-xs text-muted-foreground font-bold">Origin</div>
                    <div className="font-black italic">{transfer.from}</div>
                  </div>
                </div>
                <Truck className="w-6 h-6 text-muted-foreground" />
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground font-bold">Destination</div>
                    <div className="font-black italic">{transfer.to}</div>
                  </div>
                  <MapPin className="w-5 h-5 text-success" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
                <div>
                  <div className="text-xs text-muted-foreground font-bold">Status</div>
                  <Badge className="bg-primary text-primary font-black italic mt-1">
                    {transfer.status}
                  </Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-bold">ETA</div>
                  <div className="font-black italic flex items-center gap-1 mt-1">
                    <Clock className="w-4 h-4" />
                    {transfer.eta}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-bold">Items</div>
                  <div className="font-black italic flex items-center gap-1 mt-1">
                    <Package className="w-4 h-4" />
                    {transfer.items} Units
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            {timeline.length > 0 && (
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Shipment Timeline</div>
                <div className="space-y-4">
                  {timeline.map((event, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          event.completed ? 'bg-success/10' : 'bg-secondary/10'
                        }`}>
                          {event.completed ? (
                            <CheckCircle2 className="w-5 h-5 text-success" />
                          ) : (
                            <div className="w-3 h-3 rounded-full bg-muted/30" />
                          )}
                        </div>
                        {idx < timeline.length - 1 && (
                          <div className={`w-0.5 h-12 ${event.completed ? 'bg-success/20' : 'bg-muted/20'}`} />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between mb-1">
                          <div className={`font-black italic ${event.completed ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {event.desc}
                          </div>
                          <div className="text-xs text-muted-foreground font-bold">{event.time}</div>
                        </div>
                        <Badge className={`text-xs font-black italic ${
                          event.completed ? 'bg-success text-success' : 'bg-secondary/10 text-muted-foreground'
                        }`}>
                          {event.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {timeline.length === 0 && (
              <QueryEmptyState message="No timeline events available for this transfer." />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
