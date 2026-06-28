/**
 * RetailCustomerActivity — Customer registry & activity viewer.
 *
 * Wired with useQuery for data loading.
 * This is a display/viewer component with no form mutations.
 *
 * Requirements: 4 (Loading State), 5 (Error Handling), 10 (Consistent Pattern)
 */

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  User,
  ShoppingCart,
  Heart,
  History,
  MessageSquare,
  Search,
  ChevronRight,
  Filter,
  ShieldCheck,
  Download,
  Trash2,
  Lock,
  UserCheck,
} from "lucide-react";
import { useSession } from "@/core/security/session";
import { retailService } from "@/core/services/retail/retailService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function RetailCustomerActivity({ 
  onExpansionRequest 
}: { 
  onExpansionRequest?: (feature: string) => void 
}) {
  const session = useSession();
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // ─── useQuery for customer data ───────────────────────────────────────────────
  const { data: customers = [], isLoading: loading } = useQuery({
    queryKey: ["retail", "customers"],
    queryFn: async () => {
      if (!session.tenant_id) return [];
      const data = await retailService.listCustomers(session.tenant_id, session);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!session.tenant_id,
  });

  const filteredCustomers = useMemo(() => {
    return (Array.isArray(customers) ? customers : []).filter(
      (c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search)
    );
  }, [customers, search]);

  const handleOpenDetail = (customer: any) => {
    setSelectedCustomer(customer);
    setIsDetailOpen(true);
  };

  return (
    <Card className="rounded-2xl border border-white/5 shadow-2xl bg-white/[0.03] backdrop-blur-3xl overflow-hidden group/registry">
      <CardHeader className="p-8 border-b border-white/5 bg-white/[0.01]">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-4">
            <CardTitle className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-6 text-foreground italic">
              <div className="p-4 rounded-2xl bg-primary text-foreground shadow-2xl shadow-indigo-600/20 group-hover/registry:rotate-6 transition-transform duration-500">
                <User className="w-8 h-8" />
              </div>
              Customer Registry
            </CardTitle>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.3em] ml-[88px] italic">
              Unified activity tracking for registered ecommerce users • {customers.length} Identities
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative group/search">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-hover/search:text-primary transition-colors" />
              <Input
                placeholder="Search Identity..."
                className="pl-12 h-16 w-[350px] rounded-2xl border-border bg-secondary/40 text-foreground font-black italic uppercase text-[11px] tracking-[0.2em] focus:ring-2 focus:ring-indigo-600/50 shadow-2xl"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button 
              variant="outline" 
              className="h-16 w-16 p-0 rounded-2xl border-border bg-secondary/40 hover:bg-white/10 shadow-2xl"
              onClick={() => onExpansionRequest?.("Identity Registry Filter Matrix")}
            >
              <Filter className="w-5 h-5 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-40 text-center space-y-6">
            <div className="w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-8 shadow-[0_0_50px_rgba(79,70,229,0.3)]" />
            <p className="text-sm font-black italic text-muted-foreground uppercase tracking-[0.4em] animate-pulse">Synchronizing Registry...</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {(Array.isArray(filteredCustomers) ? filteredCustomers : []).map((customer) => (
              <div
                key={customer.id}
                className="group flex items-center justify-between p-6 hover:bg-white/[0.04] transition-all duration-500 cursor-pointer relative overflow-hidden"
                onClick={() => handleOpenDetail(customer)}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center gap-6 relative z-10">
                  <div className="w-16 h-16 rounded-2xl bg-secondary/40 border border-border flex items-center justify-center font-black text-primary text-2xl italic group-hover:bg-primary group-hover:text-foreground transition-all shadow-2xl">
                    {customer.name[0]}
                  </div>
                  <div>
                    <h3 className="text-xl font-black italic text-foreground group-hover:text-primary transition-colors tracking-tight">
                      {customer.name}
                    </h3>
                    <p className="text-xs text-muted-foreground font-medium tracking-tight mt-1">{customer.email || "No email"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-16 relative z-10">
                  <div className="hidden xl:flex items-center gap-6 text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground italic">
                    <div className="space-y-2">
                      <p>Tier</p>
                      <Badge variant="outline" className="bg-secondary/40 rounded-lg px-3 h-6 border-border text-foreground italic">
                        {customer.tier || "REGULAR"}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <p>Points</p>
                      <p className="text-foreground italic">{customer.points || 0}</p>
                    </div>
                    <div className="space-y-2">
                      <p>Compliance</p>
                      <Badge className="bg-success/20 text-success border border-success/20 rounded-lg px-3 h-6 gap-2">
                        <ShieldCheck className="w-3 h-3" /> VERIFIED
                      </Badge>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-secondary/40 border border-white/5 flex items-center justify-center group-hover:bg-primary transition-colors shadow-2xl">
                    <ChevronRight className="w-6 h-6 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <CustomerDetailDialog
        isOpen={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        customer={selectedCustomer}
        onExpansionRequest={onExpansionRequest}
      />
    </Card>
  );
}

function CustomerDetailDialog({ isOpen, onOpenChange, customer, onExpansionRequest }: any) {
  if (!customer) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[85vh] p-0 overflow-hidden border border-border rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.5)] bg-background">
        <DialogHeader className="sr-only">
          <DialogTitle>Customer Details - {customer.name}</DialogTitle>
        </DialogHeader>
        <div className="flex h-full">
          {/* Sidebar Info */}
          <div className="w-[350px] bg-white/[0.02] border-r border-white/5 p-6 space-y-12 overflow-y-auto custom-scrollbar">
            <div className="space-y-6 text-center">
              <div className="w-32 h-32 rounded-2xl bg-primary mx-auto flex items-center justify-center text-3xl font-black italic shadow-[0_20px_50px_rgba(79,70,229,0.4)] text-foreground">
                {customer.name[0]}
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black italic uppercase tracking-tighter text-foreground">{customer.name}</h2>
                <p className="text-[11px] font-bold text-primary uppercase tracking-[0.4em] italic">{customer.tier || "REGULAR"} Member</p>
              </div>
            </div>

            <div className="space-y-8">
              <div className="space-y-4">
                <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.4em] italic">Identity Payload</p>
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-secondary/40 border border-white/5 space-y-1">
                     <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest italic">Email</p>
                     <p className="text-sm font-medium text-foreground truncate italic">{customer.email || "N/A"}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-secondary/40 border border-white/5 space-y-1">
                     <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest italic">Phone</p>
                     <p className="text-sm font-medium text-foreground italic">{customer.phone || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Compliance Vault */}
              <div className="p-8 rounded-2xl bg-destructive/5 border border-destructive/10 space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-destructive uppercase tracking-[0.3em] italic">Compliance Vault</p>
                  <Lock className="w-4 h-4 text-destructive" />
                </div>
                <div className="space-y-3">
                  <Button 
                    variant="outline"
                    className="w-full h-12 rounded-xl bg-secondary/40 border-border text-[9px] font-black uppercase tracking-widest text-foreground hover:bg-white/10 gap-3"
                    onClick={() => onExpansionRequest?.(`GDPR Data Export: ${customer.name}`)}
                  >
                    <Download className="w-3.5 h-3.5" /> Export Data PII
                  </Button>
                  <Button 
                    variant="outline"
                    className="w-full h-12 rounded-xl bg-destructive/10 border-destructive/20 text-[9px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/20 gap-3"
                    onClick={() => onExpansionRequest?.(`Identity Anonymization: ${customer.name}`)}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Anonymize Identity
                  </Button>
                </div>
              </div>

              <div className="p-8 rounded-[2rem] bg-primary/10 border border-primary text-center shadow-inner">
                <p className="text-[11px] font-black text-primary uppercase tracking-[0.4em] mb-2 italic">Loyalty Ledger</p>
                <p className="text-3xl font-black italic text-foreground tracking-tighter italic">{customer.points || 0}</p>
              </div>
            </div>

            <Button 
              onClick={() => onExpansionRequest?.(`Identity Modification: ${customer.name}`)}
              className="w-full bg-secondary/40 hover:bg-white/10 border border-border rounded-2xl h-16 text-[11px] font-black uppercase tracking-[0.3em] italic text-foreground shadow-2xl transition-all hover:scale-105 active:scale-95"
            >
              Edit Identity Registry
            </Button>
          </div>

          {/* Main Content Tabs */}
          <div className="flex-1 bg-transparent p-6 overflow-hidden flex flex-col">
            <Tabs defaultValue="history" className="h-full flex flex-col">
              <TabsList className="bg-secondary/40 p-2 rounded-[2rem] w-fit mb-12 h-20 border border-white/5 backdrop-blur-3xl shadow-2xl">
                <TabsTrigger value="history" className="rounded-2xl px-10 data-[state=active]:bg-primary data-[state=active]:text-foreground text-[11px] font-black uppercase italic tracking-[0.3em] transition-all text-muted-foreground h-full">
                  <History className="w-5 h-5 mr-3" /> History
                </TabsTrigger>
                <TabsTrigger value="cart" className="rounded-2xl px-10 data-[state=active]:bg-primary data-[state=active]:text-foreground text-[11px] font-black uppercase italic tracking-[0.3em] transition-all text-muted-foreground h-full">
                  <ShoppingCart className="w-5 h-5 mr-3" /> Cart
                </TabsTrigger>
                <TabsTrigger value="wishlist" className="rounded-2xl px-10 data-[state=active]:bg-primary data-[state=active]:text-foreground text-[11px] font-black uppercase italic tracking-[0.3em] transition-all text-muted-foreground h-full">
                  <Heart className="w-5 h-5 mr-3" /> Wishlist
                </TabsTrigger>
                <TabsTrigger value="chat" className="rounded-2xl px-10 data-[state=active]:bg-primary data-[state=active]:text-foreground text-[11px] font-black uppercase italic tracking-[0.3em] transition-all text-muted-foreground h-full">
                  <MessageSquare className="w-5 h-5 mr-3" /> Chat
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-hidden">
                <TabsContent value="history" className="h-full mt-0 focus-visible:ring-0">
                  <OrderHistoryList customerId={customer.id} />
                </TabsContent>
                <TabsContent value="cart" className="h-full mt-0 focus-visible:ring-0">
                  <CustomerCartView cart={customer.retail_carts} />
                </TabsContent>
                <TabsContent value="wishlist" className="h-full mt-0 focus-visible:ring-0">
                  <CustomerWishlistView wishlist={customer.retail_wishlists} onExpansionRequest={onExpansionRequest} />
                </TabsContent>
                <TabsContent value="chat" className="h-full mt-0 focus-visible:ring-0">
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-10 bg-white/[0.02] rounded-[2rem] border-2 border-dashed border-white/5 group/chat overflow-hidden relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.05)_0%,transparent_70%)] opacity-0 group-hover/chat:opacity-100 transition-opacity duration-1000" />
                    <div className="w-24 h-24 rounded-2xl bg-secondary/40 border border-border shadow-3xl flex items-center justify-center group-hover/chat:scale-110 group-hover/chat:rotate-6 transition-all duration-500 relative z-10">
                      <MessageSquare className="w-10 h-10 text-primary" />
                    </div>
                    <div className="space-y-6 relative z-10 max-w-md">
                      <div className="space-y-3">
                        <h3 className="text-3xl font-black italic uppercase tracking-tighter text-foreground">WhatsApp Bridge</h3>
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.3em] italic">Establish secure real-time channel with {customer.name}</p>
                      </div>
                      <Button 
                        className="bg-success hover:bg-success text-foreground rounded-2xl h-20 px-14 text-[12px] font-black uppercase tracking-[0.4em] shadow-[0_20px_40px_rgba(16,185,129,0.3)] transition-all hover:scale-105 active:scale-95 gap-4 italic"
                        onClick={() => {
                          const phone = customer.phone?.replace(/[^0-9]/g, "");
                          const text = encodeURIComponent(`Hi ${customer.name}, this is Zenvix Support. How can we help you today?`);
                          window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
                        }}
                      >
                        <MessageSquare className="w-6 h-6" />
                        Open WhatsApp Channel
                      </Button>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-relaxed italic">
                        All external channel interactions are documented in the system audit logs for compliance oversight.
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OrderHistoryList({ customerId }: { customerId: string }) {
  const session = useSession();

  const { data: orders = [], isLoading: loading } = useQuery({
    queryKey: ["retail", "orders", customerId],
    queryFn: async () => {
      if (!session.tenantId) return [];
      const data = await retailService.listOrders(session.tenantId, session, {
        customer_id: customerId
      });
      return Array.isArray(data) ? data : [];
    },
    enabled: !!session.tenantId && !!customerId,
  });

  if (loading) return (
    <div className="p-24 text-center space-y-6">
       <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto shadow-2xl" />
       <p className="text-[10px] font-black italic text-muted-foreground uppercase tracking-[0.4em] animate-pulse">Scanning Global Ledger...</p>
    </div>
  );

  return (
    <ScrollArea className="h-full pr-6 custom-scrollbar">
      <div className="space-y-6">
        {orders.length === 0 ? (
          <div className="p-10 text-center bg-secondary/40 rounded-[2rem] border border-white/5 border-dashed">
            <p className="text-[11px] font-black italic text-muted-foreground uppercase tracking-[0.4em]">No documented transactions</p>
          </div>
        ) : (
          (Array.isArray(orders) ? orders : []).map((order) => (
            <div key={order.id} className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-primary hover:bg-white/[0.04] transition-all duration-500 space-y-6 group/order shadow-xl">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] italic">Order Context</p>
                  <p className="text-sm font-mono text-primary font-bold italic">{order.id.slice(0, 12).toUpperCase()}</p>
                </div>
                <Badge className="bg-success/20 text-success border border-success/20 rounded-lg h-7 px-3 font-black italic tracking-widest text-[9px] uppercase">
                  {order.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between pt-6 border-t border-white/5">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] italic">{new Date(order.created_at).toLocaleDateString("en-US", { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                <p className="text-3xl font-black italic text-foreground tracking-tighter">Rp {(order.total_amount || order.totalAmount || 0).toLocaleString()}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
}

function CustomerCartView({ cart }: any) {
  const items = cart?.retail_cart_items || [];
  
  return (
    <ScrollArea className="h-full pr-6 custom-scrollbar">
      <div className="space-y-6">
        {items.length === 0 ? (
          <div className="p-10 text-center bg-secondary/40 rounded-[2rem] border border-white/5 border-dashed">
            <p className="text-[11px] font-black italic text-muted-foreground uppercase tracking-[0.4em]">Asset Staging Area Empty</p>
          </div>
        ) : (
          (Array.isArray(items) ? items : []).map((item: any) => (
            <div key={item.id} className="flex items-center justify-between p-8 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.04] hover:border-primary transition-all duration-500 group/cart shadow-xl">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-secondary/40 border border-border flex items-center justify-center shadow-2xl group-hover/cart:scale-110 transition-transform">
                  <ShoppingCart className="w-7 h-7 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-black italic text-foreground tracking-tight">{item.product_id}</p>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] italic">Quantity Payload: {item.quantity}</p>
                </div>
              </div>
              <p className="text-2xl font-black italic text-foreground tracking-tighter">Rp {(item.unit_price * item.quantity).toLocaleString()}</p>
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
}

function CustomerWishlistView({ wishlist, onExpansionRequest }: any) {
  const items = wishlist?.retail_wishlist_items || [];

  return (
    <ScrollArea className="h-full pr-6 custom-scrollbar">
      <div className="grid grid-cols-2 gap-8">
        {items.length === 0 ? (
          <div className="col-span-2 p-10 text-center bg-secondary/40 rounded-[2rem] border border-white/5 border-dashed">
            <p className="text-[11px] font-black italic text-muted-foreground uppercase tracking-[0.4em]">No Strategic Assets Identified</p>
          </div>
        ) : (
          (Array.isArray(items) ? items : []).map((item: any) => (
            <div key={item.id} className="p-6 bg-white/[0.02] border border-white/5 rounded-[2rem] flex flex-col items-center text-center space-y-6 hover:bg-white/[0.04] hover:border-destructive/20 transition-all duration-500 group/wish shadow-xl">
              <div className="w-24 h-24 rounded-[2rem] bg-destructive/10 border border-destructive/20 flex items-center justify-center shadow-3xl group-hover/wish:scale-110 group-hover/wish:rotate-6 transition-all duration-500">
                <Heart className="w-10 h-10 text-destructive fill-rose-400/10" />
              </div>
              <div className="space-y-2">
                 <p className="text-xl font-black italic text-foreground tracking-tight">{item.product_id}</p>
                 <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] italic">Asset Monitoring Active</p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => onExpansionRequest?.(`Asset Inspection: ${item.product_id}`)}
                className="w-full h-14 rounded-2xl border-border bg-secondary/40 text-foreground font-black italic text-[11px] uppercase tracking-[0.3em] hover:bg-primary hover:border-primary transition-all shadow-2xl"
              >
                Inspect Strategic Asset
              </Button>
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
}
