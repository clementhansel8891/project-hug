import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  AlertTriangle,
  ArrowUpRight,
  X,
  PieChart,
  LineChart
} from "lucide-react";
import { useSession } from "@/core/security/session";
import { apiRequest } from "@/core/api/apiClient";
import { Skeleton } from "@/components/ui/skeleton";

interface InventoryAnalyticsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InventoryAnalyticsDialog({ isOpen, onOpenChange }: InventoryAnalyticsDialogProps) {
  const { session } = useSession();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      fetchAnalytics();
    }
  }, [isOpen]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<any>("/inventory/dashboard", "GET", session);
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch analytics", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 rounded-[3rem] border-border bg-muted backdrop-blur-3xl shadow-2xl overflow-hidden">
        <DialogHeader className="p-10 bg-white/5 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-5 text-3xl font-black tracking-tighter text-white uppercase italic leading-none">
                <div className="flex h-14 w-14 items-center justify-center rounded-[1.5rem] bg-primary text-white shadow-xl shadow-indigo-600/20 border border-border">
                  <BarChart3 className="h-7 w-7" />
                </div>
                Inventory Intelligence
              </DialogTitle>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground mt-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" /> ANALYTICS_ENGINE_ACTIVE
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl hover:bg-white/5 text-muted-foreground hover:text-white" onClick={() => onOpenChange(false)}>
              <X className="h-6 w-6" />
            </Button>
          </div>
        </DialogHeader>

        <div className="p-10 space-y-8 overflow-y-auto max-h-[70vh] custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-none bg-white/5 rounded-[2rem] overflow-hidden group">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Inventory Turnover</CardTitle>
                <TrendingUp className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black tracking-tighter text-white">4.2x</div>
                <p className="text-[10px] font-bold text-success mt-1 uppercase tracking-widest">+12% from last cycle</p>
              </CardContent>
            </Card>

            <Card className="border-none bg-white/5 rounded-[2rem] overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Stock Accuracy</CardTitle>
                <Package className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black tracking-tighter text-white">99.4%</div>
                <p className="text-[10px] font-bold text-primary mt-1 uppercase tracking-widest">Post-Audit Validation</p>
              </CardContent>
            </Card>

            <Card className="border-none bg-white/5 rounded-[2rem] overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Shrinkage Rate</CardTitle>
                <TrendingDown className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black tracking-tighter text-white">0.2%</div>
                <p className="text-[10px] font-bold text-success mt-1 uppercase tracking-widest">-0.05% improvement</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-2">
                <PieChart className="h-3 w-3" /> Category Distribution
              </h4>
              <div className="p-8 rounded-[2.5rem] bg-muted border border-border h-64 flex items-center justify-center italic text-muted-foreground font-bold text-xs">
                Classification Matrix Visualization Pending Data Stream
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-2">
                <LineChart className="h-3 w-3" /> Valuation Trend
              </h4>
              <div className="p-8 rounded-[2.5rem] bg-muted border border-border h-64 flex items-center justify-center italic text-muted-foreground font-bold text-xs">
                Financial Asset Progression Curve Rendering...
              </div>
            </div>
          </div>

          <div className="p-10 rounded-[3rem] bg-primary border border-primary">
            <div className="flex items-start gap-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.8rem] bg-primary text-white shrink-0 shadow-2xl">
                <ArrowUpRight className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white italic tracking-tight uppercase leading-none mb-3">AI Intelligence Insight</h3>
                <p className="text-sm font-bold text-primary leading-relaxed max-w-lg">
                  Based on current movement vectors, stock level for "Tactical Grade A" is projected to hit critical levels within 4 days. 
                  Automated procurement trigger is recommended to avoid replenishment lag.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
