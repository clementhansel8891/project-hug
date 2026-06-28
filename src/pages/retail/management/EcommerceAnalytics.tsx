import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  RefreshCw,
  Package,
  Heart,
  Activity,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useSession } from "@/core/security/session";
import { retailService } from "@/core/services/retail/retailService";
import { ecommerceHubService } from "@/core/services/retail/ecommerceHubService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EcommerceAnalytics() {
  const session = useSession();
  const [analytics, setAnalytics] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!session.tenant_id) return;
    try {
      setLoading(true);
      setError(null);
      const [analyticsData, customersData, channelsData] = await Promise.all([
        retailService.getEcommerceAnalytics(session.tenant_id, session).catch(() => null),
        retailService.listCustomers(session.tenant_id, session).catch(() => []),
        ecommerceHubService.listChannels(session).catch(() => []),
      ]);
      setAnalytics(analyticsData || { revenue: 0, orderCount: 0, topProducts: [] });
      setCustomers(Array.isArray(customersData) ? customersData : []);
      setChannels(Array.isArray(channelsData) ? channelsData : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [session.tenant_id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const activeChannels = channels.filter(c => c.status === "active");
  const totalCustomers = customers.length;
  const customersWithCart = customers.filter(c => {
    const cart = c.retail_carts;
    if (Array.isArray(cart)) return cart.some((ct: any) => ct.retail_cart_items?.length > 0);
    return cart?.retail_cart_items?.length > 0;
  }).length;
  const customersWithWishlist = customers.filter(c => {
    const wl = c.retail_wishlists;
    if (Array.isArray(wl)) return wl.some((w: any) => w.retail_wishlist_items?.length > 0);
    return wl?.retail_wishlist_items?.length > 0;
  }).length;

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="text-center space-y-4">
        <RefreshCw className="w-10 h-10 text-primary animate-spin mx-auto" />
        <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest animate-pulse">
          Loading Analytics...
        </p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center py-32">
      <div className="text-center space-y-4">
        <p className="text-sm text-destructive font-bold">{error}</p>
        <Button onClick={fetchAll} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" /> Retry
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-foreground">
              E-Commerce Analytics
            </h2>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
              {activeChannels.length} active channel{activeChannels.length !== 1 ? "s" : ""} · tnt-3rlhko
            </p>
          </div>
        </div>
        <Button onClick={fetchAll} variant="outline" className="gap-2 h-10 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Gross Revenue"
          value={`Rp ${(analytics?.revenue || 0).toLocaleString("id-ID")}`}
          sub="From ecommerce orders"
          icon={DollarSign}
          color="text-primary bg-primary/10"
          trend={analytics?.orderCount > 0 ? `${analytics.orderCount} orders` : "No orders yet"}
          isPositive={analytics?.orderCount > 0}
        />
        <KpiCard
          title="Total Orders"
          value={analytics?.orderCount || 0}
          sub="Paid & processed"
          icon={ShoppingCart}
          color="text-success bg-success/10"
          trend="From storefront"
          isPositive={true}
        />
        <KpiCard
          title="Registered Customers"
          value={totalCustomers}
          sub="Storefront accounts"
          icon={Users}
          color="text-warning bg-warning/10"
          trend={`${customersWithCart} with cart items`}
          isPositive={totalCustomers > 0}
        />
        <KpiCard
          title="Active Channels"
          value={activeChannels.length}
          sub="Connected storefronts"
          icon={Activity}
          color="text-info bg-info/10 border-info/20"
          trend={`${channels.length} total registered`}
          isPositive={activeChannels.length > 0}
        />
      </div>

      {/* Customer Engagement */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 rounded-2xl border border-border bg-card shadow-sm">
          <CardHeader className="p-6 border-b border-border">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Customer Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {totalCustomers === 0 ? (
              <div className="text-center py-8">
                <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">No customers registered yet</p>
                <p className="text-xs text-muted-foreground mt-1">Customers register on the storefront at 150.109.15.108:3020</p>
              </div>
            ) : (
              <div className="space-y-3">
                <EngagementRow
                  label="Total Registered"
                  value={totalCustomers}
                  total={totalCustomers}
                  color="bg-primary"
                />
                <EngagementRow
                  label="With Cart Items"
                  value={customersWithCart}
                  total={totalCustomers}
                  color="bg-warning"
                />
                <EngagementRow
                  label="With Wishlist"
                  value={customersWithWishlist}
                  total={totalCustomers}
                  color="bg-success"
                />
                {/* Customer list preview */}
                <div className="pt-4 border-t border-border space-y-2">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Recent Customers</p>
                  {customers.slice(0, 5).map(c => (
                    <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="text-xs font-bold text-foreground">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground">{c.email}</p>
                      </div>
                      <div className="flex gap-2">
                        {(() => { const cart = c.retail_carts; return (Array.isArray(cart) ? cart.some((ct: any) => ct.retail_cart_items?.length > 0) : cart?.retail_cart_items?.length > 0); })() && (
                          <Badge className="text-[8px] bg-warning/10 text-warning border-none">Cart</Badge>
                        )}
                        {(() => { const wl = c.retail_wishlists; return (Array.isArray(wl) ? wl.some((w: any) => w.retail_wishlist_items?.length > 0) : wl?.retail_wishlist_items?.length > 0); })() && (
                          <Badge className="text-[8px] bg-success/10 text-success border-none">Wishlist</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Channels Status */}
        <Card className="rounded-2xl border border-border bg-card shadow-sm">
          <CardHeader className="p-6 border-b border-border">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" /> Channel Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            {channels.length === 0 ? (
              <div className="text-center py-6">
                <Globe className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">No channels</p>
              </div>
            ) : (
              channels.map(ch => (
                <div key={ch.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
                  <div>
                    <p className="text-xs font-bold text-foreground truncate max-w-[120px]">{ch.name}</p>
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{ch.integrationCategory}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={cn("w-2 h-2 rounded-full", ch.status === "active" ? "bg-success animate-pulse" : "bg-muted-foreground")} />
                    <span className={cn("text-[9px] font-black uppercase tracking-widest", ch.status === "active" ? "text-success" : "text-muted-foreground")}>
                      {ch.status}
                    </span>
                  </div>
                </div>
              ))
            )}

            {/* Storefront link */}
            <div className="pt-4 border-t border-border">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Live Storefront</p>
              <a
                href="http://150.109.15.108:3020"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors"
              >
                <Globe className="w-4 h-4 text-primary" />
                <span className="text-[10px] font-black text-primary uppercase tracking-widest">150.109.15.108:3020</span>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Products from Analytics */}
      {analytics?.topProducts && analytics.topProducts.length > 0 && (
        <Card className="rounded-2xl border border-border bg-card shadow-sm">
          <CardHeader className="p-6 border-b border-border">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" /> Top Selling Products (Ecommerce Orders)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {analytics.topProducts.map((product: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center font-black text-primary text-xs">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{product.name}</p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-foreground">{product.count} units sold</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* If no orders yet, show guidance */}
      {(!analytics?.orderCount || analytics.orderCount === 0) && (
        <Card className="rounded-2xl border border-border bg-card shadow-sm">
          <CardContent className="p-8 text-center space-y-3">
            <ShoppingCart className="w-10 h-10 text-muted-foreground/30 mx-auto" />
            <p className="text-sm font-bold text-foreground">No ecommerce orders yet</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Orders from the Bambu Silver storefront (port 3020) will appear here once customers complete purchases.
              The storefront is live and connected to this tenant.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiCard({ title, value, sub, icon: Icon, color, trend, isPositive }: any) {
  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
          <Icon className="w-5 h-5" />
        </div>
        <Badge className={cn("text-[9px] font-black border-none rounded-lg px-2", isPositive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
          {isPositive ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
          {trend}
        </Badge>
      </div>
      <div>
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{title}</p>
        <p className="text-2xl font-black tracking-tighter text-foreground mt-1">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>
      </div>
    </Card>
  );
}

function EngagementRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[11px] font-bold text-foreground">{label}</span>
        <span className="text-[11px] font-black text-foreground">{value} <span className="text-muted-foreground font-medium">({pct}%)</span></span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
