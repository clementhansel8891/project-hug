import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Layers, AlertTriangle, Archive, BarChart3, TrendingUp } from "lucide-react";

type InventoryStats = {
  totalSKUs: number;
  totalSOH: number;
  totalATS: number;
  critical: number;
  low: number;
  totalValue?: number;
  totalCapitalValue?: number;
  currency?: string;
};

type Props = {
  stats: InventoryStats;
  isAggregating?: boolean;
};

export const InventoryKpiBar: React.FC<Props> = ({ stats, isAggregating }) => {
  const formatValue = (val: number | undefined) => {
    if (val === undefined || val === null) return "0";
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatCurrency = (val: number | undefined) => {
    if (val === undefined || val === null) return "0";
    const currency = stats.currency || "IDR";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Top Row: Core Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Branch SKUs */}
        <Card className="border border-border dark:border-border shadow-xl bg-white dark:bg-muted backdrop-blur-md rounded-[2rem] overflow-hidden hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all duration-300 group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Branch SKUs</CardTitle>
            <Layers className="h-4 w-4 text-primary opacity-50" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-foreground">{formatValue(stats.totalSKUs)}</div>
            <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-widest italic">Active models</p>
          </CardContent>
        </Card>

        {/* Card 2: Branch On Hand */}
        <Card className="border border-border dark:border-border shadow-xl bg-white dark:bg-muted backdrop-blur-md rounded-[2rem] overflow-hidden hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/5 transition-all duration-300 group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Branch On Hand</CardTitle>
            <Package className="h-4 w-4 text-success opacity-50" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-success dark:text-success">{isAggregating ? "..." : formatValue(stats.totalSOH)}</div>
            <p className="text-[10px] font-bold text-success mt-1 uppercase tracking-widest italic">Total physical units</p>
          </CardContent>
        </Card>

        {/* Card 3: Out of Stock */}
        <Card className="border border-border dark:border-border shadow-xl bg-white dark:bg-muted backdrop-blur-md rounded-[2rem] overflow-hidden hover:-translate-y-1 hover:shadow-2xl hover:shadow-rose-500/5 transition-all duration-300 group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Out of Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive opacity-50" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-destructive dark:text-destructive">{isAggregating ? "..." : formatValue(stats.critical)}</div>
            <p className="text-[10px] font-bold text-destructive mt-1 uppercase tracking-widest italic">Critical Shortage</p>
          </CardContent>
        </Card>

        {/* Card 4: Low Stock */}
        <Card className="border border-border dark:border-border shadow-xl bg-white dark:bg-muted backdrop-blur-md rounded-[2rem] overflow-hidden hover:-translate-y-1 hover:shadow-2xl hover:shadow-amber-500/5 transition-all duration-300 group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning opacity-50" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-warning dark:text-warning">{isAggregating ? "..." : formatValue(stats.low)}</div>
            <p className="text-[10px] font-bold text-warning mt-1 uppercase tracking-widest italic">Below buffer threshold</p>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Large Valuations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 5: Branch Valuation (capital) */}
        <Card className="border border-primary shadow-2xl bg-white dark:bg-muted backdrop-blur-md rounded-[2rem] overflow-hidden hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent relative group">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-6 px-8">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-primary">Branch Valuation (Capital)</CardTitle>
            <BarChart3 className="h-5 w-5 text-primary opacity-60 group-hover:scale-110 transition-transform duration-300" />
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <div className="text-3xl sm:text-4xl lg:text-4xl xl:text-5xl font-black tracking-tighter text-primary dark:text-primary break-words whitespace-normal leading-tight">
              {isAggregating ? "..." : formatCurrency(stats.totalCapitalValue)}
            </div>
            <p className="text-xs font-bold text-primary mt-2 uppercase tracking-widest italic">Capital / Supplier Price Cost</p>
          </CardContent>
        </Card>

        {/* Card 6: Branch Valuation (selling price) */}
        <Card className="border border-primary shadow-2xl bg-white dark:bg-muted backdrop-blur-md rounded-[2rem] overflow-hidden hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 bg-gradient-to-br from-primary/5 via-transparent to-transparent relative group">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-6 px-8">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-primary">Branch Valuation (Selling Price)</CardTitle>
            <TrendingUp className="h-5 w-5 text-primary opacity-60 group-hover:scale-110 transition-transform duration-300" />
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <div className="text-3xl sm:text-4xl lg:text-4xl xl:text-5xl font-black tracking-tighter text-primary dark:text-primary break-words whitespace-normal leading-tight">
              {isAggregating ? "..." : formatCurrency(stats.totalValue)}
            </div>
            <p className="text-xs font-bold text-primary mt-2 uppercase tracking-widest italic">Total Customer Retail Value</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
