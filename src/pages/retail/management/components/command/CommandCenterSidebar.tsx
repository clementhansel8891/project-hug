import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  ArrowRight,
  Fingerprint,
  Link2,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const CommandCenterSidebar = ({
  inventoryStats,
  syncStatus,
  recentOrders,
  onExpansionRequest,
}: {
  inventoryStats: any;
  syncStatus: any;
  recentOrders: any[];
  onExpansionRequest: (feature: string) => void;
}) => {
  return (
    <div className="space-y-10">
      {/* Inventory Health */}
      <Card className="rounded-[2rem] border border-border shadow-2xl bg-card backdrop-blur-3xl overflow-hidden group/inventory">
        <CardHeader className="p-8 border-b border-border bg-card">
          <CardTitle className="text-[11px] font-black italic uppercase tracking-[0.3em] flex items-center gap-3 text-foreground italic">
            <Package className="w-5 h-5 text-warning shadow-xl" />
            Inventory Health
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <div className="flex justify-between items-center p-5 rounded-2xl bg-destructive/10 border border-destructive/20 shadow-xl group/critical hover:scale-[1.02] transition-transform">
            <div className="flex items-center gap-4">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <span className="text-[10px] font-black italic text-destructive uppercase tracking-widest italic">
                Critical Depletion
              </span>
            </div>
            <Badge className="bg-destructive/20 text-destructive border border-destructive/30 font-black italic text-[11px] px-3 h-6 rounded-lg">
              {inventoryStats?.outOfStockCount || 0}
            </Badge>
          </div>
          <div className="flex justify-between items-center p-5 rounded-2xl bg-warning border border-warning/20 shadow-xl group/low hover:scale-[1.02] transition-transform">
            <div className="flex items-center gap-4">
              <AlertCircle className="w-5 h-5 text-warning" />
              <span className="text-[10px] font-black italic text-warning uppercase tracking-widest italic">
                Low Stock Threshold
              </span>
            </div>
            <Badge className="bg-warning text-warning border border-warning/30 font-black italic text-[11px] px-3 h-6 rounded-lg">
              {inventoryStats?.lowStockCount || 0}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Core Sync Status */}
      <Card className="rounded-[2rem] border border-border shadow-2xl bg-card backdrop-blur-3xl overflow-hidden group/sync">
        <CardHeader className="p-8 border-b border-border bg-card">
          <CardTitle className="text-[11px] font-black italic uppercase tracking-[0.3em] flex items-center gap-3 text-primary italic">
            <Link2 className="w-5 h-5 shadow-xl" />
            Consensus Sync
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 space-y-5">
          {[
            { label: "Finance (Ledger)", status: "LOCKED", color: "text-primary", dot: "bg-primary/40" },
            { label: "HR (Coverage)", status: "ACTIVE", color: "text-success", dot: "bg-success" },
            { label: "IT (Security)", status: "OPTIMAL", color: "text-sky-400", dot: "bg-sky-400" },
          ].map((item, i) => (
            <div
              key={i}
              className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.3em] italic"
            >
              <span className="text-muted-foreground">{item.label}</span>
              <span className={cn("flex items-center gap-2", item.color)}>
                <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.2)]", item.dot)} />
                {item.status}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Audit Ledger Snippet */}
      <Card className="rounded-[2rem] border border-border shadow-2xl bg-card backdrop-blur-3xl overflow-hidden group/audit">
        <CardHeader className="p-8 border-b border-border bg-card">
          <CardTitle className="text-[11px] font-black italic uppercase tracking-[0.3em] flex items-center gap-3 text-foreground italic">
            <Fingerprint className="w-5 h-5 text-primary shadow-xl" />
            Real-time Audit
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {recentOrders.slice(0, 5).map((order: any) => (
              <div
                key={order.id}
                className="p-6 hover:bg-muted transition-all duration-500 group/item cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-full blur-2xl opacity-0 group-hover/item:opacity-100 transition-opacity" />
                <div className="flex justify-between items-start mb-2 relative z-10">
                  <span className="text-[10px] font-mono text-primary font-bold italic">
                    {order.id.slice(0, 8)}...
                  </span>
                  <span className="text-sm font-black italic text-foreground italic tracking-tighter">
                    Rp {order.totalAmount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] relative z-10 italic">
                  <span>{new Date(order.createdAt).toLocaleTimeString()}</span>
                  <ArrowRight className="w-4 h-4 group-hover/item:text-foreground group-hover/item:translate-x-2 transition-all" />
                </div>
              </div>
            ))}
          </div>
          <div className="p-8 bg-card border-t border-border">
            <button 
              onClick={() => onExpansionRequest("Real-time Global Ledger")}
              className="w-full h-14 rounded-2xl bg-secondary/40 border border-border text-muted-foreground font-black italic text-[10px] uppercase tracking-[0.3em] hover:bg-muted/10 hover:text-foreground transition-all flex items-center justify-center gap-3 italic"
            >
               View Full Ledger <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

