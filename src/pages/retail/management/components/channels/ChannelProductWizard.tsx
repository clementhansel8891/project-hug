import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronRight, 
  ChevronLeft, 
  Search, 
  CheckCircle2, 
  Package, 
  Layers, 
  Settings2,
  Trash2,
  AlertCircle,
  RefreshCw,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { retailService } from "@/core/services/retail/retailService";
import { ecommerceHubService } from "@/core/services/retail/ecommerceHubService";
import type { SessionContext } from "@/core/security/session";
import { Roles } from "@/core/security/roles";

interface Props {
  channelId: string;
  session: SessionContext;
  onFinished?: () => void;
}

export const ChannelProductWizard: React.FC<Props> = ({
  channelId,
  session,
  onFinished
}) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Data
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selectedProds, setSelectedProds] = useState<Record<string, { visible: boolean; stock: number }>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const isHOD = [Roles.DEPT_HEAD, Roles.OWNER, Roles.SUPERADMIN, Roles.COMPANY_ADMIN].includes(session.role);

  // If no categories exist, skip step 1 and go straight to products
  const hasCategories = categories.length > 0;
  const effectiveStep = !hasCategories && step === 1 ? 2 : step;

  // --- Initial Load ---
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        // Load categories and channel-specific products in parallel
        const [catList, channelCats, channelProds] = await Promise.all([
          retailService.listCategories(session.tenant_id, session).catch(() => []),
          ecommerceHubService.getChannelCategories(session, channelId).catch(() => []),
          ecommerceHubService.listChannelProducts(session, channelId).catch(() => [])
        ]);

        setCategories(Array.isArray(catList) ? catList : []);
        setSelectedCats(Array.isArray(channelCats) ? channelCats : []);
        
        // If no channel-specific products, load from master inventory
        let productList = Array.isArray(channelProds) ? channelProds : [];
        if (productList.length === 0) {
          try {
            const masterData = await retailService.listInventory(session.tenant_id, session, { page: 1, pageSize: 100 });
            const masterItems = (masterData as any)?.items || (masterData as any)?.data || (Array.isArray(masterData) ? masterData : []);
            // Map master inventory items to channel product format
            productList = masterItems.map((item: any) => ({
              id: item.id,
              name: item.name,
              sku: item.sku,
              category_id: item.category_id || item.categoryId || "",
              categoryName: item.category || item.categoryName || "Uncategorized",
              stock: item.on_hand ?? item.currentStock ?? item.stock ?? 0,
              price: item.selling_price ?? item.base_price ?? item.sellingPrice ?? 0,
              visible: false, // default hidden for new items
            }));
          } catch (e) {
            console.warn("Could not load master inventory", e);
          }
        }
        
        setProducts(productList);

        // Convert array to record for easy management
        const prodMap: Record<string, { visible: boolean; stock: number }> = {};
        productList.forEach((p: any) => {
          prodMap[p.id] = { visible: p.visible ?? false, stock: p.stock_limit ?? p.stock ?? 0 };
        });
        setSelectedProds(prodMap);
        
        // Auto-select all categories if none are pre-selected
        if ((Array.isArray(channelCats) ? channelCats : []).length === 0 && catList.length > 0) {
          setSelectedCats(catList.map((c: any) => c.id));
        }
      } catch (err) {
        console.error("Wizard Init Failure", err);
        toast({ title: "Failed to load channel data", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [channelId]);

  // --- Filtering ---
  const filteredProducts = useMemo(() => {
    return (Array.isArray(products) ? products : []).filter(p => {
      // If no categories selected or product has no category, show all products
      const matchCat = selectedCats.length === 0 || !p.category_id || selectedCats.includes(p.category_id);
      const matchSearch = !searchQuery || 
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.sku?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, selectedCats, searchQuery]);

  // --- Handlers ---
  const toggleStep1 = (catId: string) => {
    setSelectedCats(prev => 
      prev.includes(catId) ? (Array.isArray(prev) ? prev : []).filter(id => id !== catId) : [...prev, catId]
    );
  };

  const toggleProduct = (prodId: string) => {
    setSelectedProds(prev => ({
      ...prev,
      [prodId]: { ...prev[prodId], visible: !prev[prodId].visible }
    }));
  };

  const updateProductStock = (prodId: string, val: string) => {
    const num = parseInt(val) || 0;
    setSelectedProds(prev => ({
      ...prev,
      [prodId]: { ...prev[prodId], stock: num }
    }));
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      // 1. Update Categories
      await ecommerceHubService.updateChannelCategories(session, channelId, selectedCats);

      // 2. Update Products
      const updates = Object.entries(selectedProds).map(([id, cfg]) => ({
        product_id: id,
        visible: cfg.visible,
        stock_limit: cfg.stock
      }));
      await ecommerceHubService.updateChannelProducts(session, channelId, updates);

      toast({ 
        title: "Channel synchronized", 
        description: isHOD ? "Master inventory and website visibility updated." : "Updates submitted for approval."
      });
      if (onFinished) onFinished();
    } catch (err) {
      toast({ title: "Sync failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // --- Components ---
  const StepIndicator = () => (
    <div className="flex items-center gap-4 mb-8">
      {(hasCategories ? [1, 2, 3] : [2, 3]).map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center font-black italic transition-all",
            effectiveStep === s ? "bg-secondary text-foreground scale-110 shadow-lg" : 
            effectiveStep > s ? "bg-success text-foreground" : "bg-secondary/10 text-muted-foreground"
          )}>
            {effectiveStep > s ? <CheckCircle2 className="w-4 h-4" /> : s}
          </div>
          <span className={cn(
            "text-[10px] font-black uppercase tracking-widest",
            effectiveStep === s ? "text-foreground" : "text-muted-foreground"
          )}>
            {s === 1 ? "Categories" : s === 2 ? "Items" : "Parameters"}
          </span>
          {s < 3 && <ChevronRight className="w-4 h-4 text-muted-foreground/60" />}
        </div>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs font-black italic text-muted-foreground uppercase tracking-widest">
          Synchronizing Global Ledger...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-8 border-b bg-secondary/5">
        <StepIndicator />
        <div className="space-y-1">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-foreground">
            {effectiveStep === 1 ? "Select Channel Categories" : 
             effectiveStep === 2 ? "Refine Product Selection" : 
             "Configure Sync Parameters"}
          </h2>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            {effectiveStep === 1 ? "Choose which product families are available for this website." : 
             effectiveStep === 2 ? "Select specific items to publish or keep private." : 
             "Assign stock levels and finalize warehouse assignments."}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {/* Step 1: Categories */}
        {effectiveStep === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(Array.isArray(categories) ? categories : []).map((cat) => (
              <Card 
                key={cat.id} 
                className={cn(
                  "cursor-pointer transition-all rounded-[2rem] border-2 flex items-center p-6 gap-4",
                  selectedCats.includes(cat.id) ? "border-border bg-secondary/5" : "border-border hover:border-border"
                )}
                onClick={() => toggleStep1(cat.id)}
              >
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center",
                  selectedCats.includes(cat.id) ? "bg-secondary text-foreground" : "bg-secondary/10 text-muted-foreground"
                )}>
                  <Layers className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black italic uppercase text-foreground">{cat.name}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{(Array.isArray(products) ? products : []).filter(p => p.category_id === cat.id).length} Items Available</p>
                </div>
                <Checkbox checked={selectedCats.includes(cat.id)} className="rounded-full h-5 w-5" />
              </Card>
            ))}
          </div>
        )}

        {/* Step 2: Products */}
        {effectiveStep === 2 && (
          <div className="space-y-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="SEARCH SKU OR NAME..." 
                className="pl-12 h-14 rounded-2xl font-bold uppercase text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              {(Array.isArray(filteredProducts) ? filteredProducts : []).map((p) => (
                <Card key={p.id} className="rounded-2xl border-border p-4 hover:bg-secondary/5 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black italic uppercase truncate">{p.name}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{p.sku}</p>
                    </div>
                    <div className="text-right mr-4">
                      <Badge variant="outline" className="text-[10px] font-black">{p.categoryName || "Uncategorized"}</Badge>
                    </div>
                    <Button 
                      size="sm"
                      variant={selectedProds[p.id]?.visible ? "default" : "outline"}
                      className={cn(
                        "rounded-xl font-black italic uppercase text-[10px] px-6 h-10 transition-all",
                        selectedProds[p.id]?.visible ? "bg-success hover:bg-success border-none" : ""
                      )}
                      onClick={() => toggleProduct(p.id)}
                    >
                      {selectedProds[p.id]?.visible ? "Visible" : "Hidden"}
                    </Button>
                  </div>
                </Card>
              ))}
              {filteredProducts.length === 0 && (
                <div className="text-center p-6 space-y-4">
                  <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto" />
                  <p className="text-xs font-black italic text-muted-foreground uppercase tracking-widest">No matching assets found in selected categories</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Stock Assignment */}
        {effectiveStep === 3 && (
          <div className="space-y-6">
            <div className="p-6 bg-primary/5 rounded-3xl border border-primary flex gap-4">
              <Settings2 className="w-10 h-10 text-primary" />
              <div>
                <h4 className="font-black italic text-primary text-sm">Sync Logic Override</h4>
                <p className="text-[11px] font-bold text-primary leading-relaxed max-w-xl">
                  Assigning stock here updates the **Master Inventory**. Changes by non-HOD users 
                  will be cached for approval. Website reservations occur only at checkout.
                </p>
              </div>
            </div>

            <div className="divide-y border-y">
              {(Array.isArray(filteredProducts) ? filteredProducts : []).filter(p => selectedProds[p.id]?.visible).map((p) => (
                <div key={p.id} className="py-6 flex items-center gap-8 group">
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-black italic uppercase">{p.name}</p>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="text-[9px] font-black uppercase">SOH: {p.stock}</Badge>
                      <Badge className="bg-success/10 text-success hover:bg-success/10 text-[9px] font-black border-none uppercase">Published</Badge>
                    </div>
                  </div>
                  <div className="w-48 space-y-2">
                    <label className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Website Stock</label>
                    <Input 
                      type="number"
                      className="h-12 rounded-xl font-black italic text-sm text-center"
                      value={selectedProds[p.id]?.stock}
                      onChange={(e) => updateProductStock(p.id, e.target.value)}
                    />
                  </div>
                </div>
              ))}
              {(Array.isArray(filteredProducts) ? filteredProducts : []).filter(p => selectedProds[p.id]?.visible).length === 0 && (
                <div className="text-center py-12">
                   <p className="text-xs font-black italic text-muted-foreground uppercase tracking-widest">No items selected for visibility</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="p-8 border-t flex justify-between items-center bg-secondary/5">
        <Button 
          variant="ghost" 
          className="h-14 px-8 rounded-2xl font-black italic uppercase text-xs text-muted-foreground hover:text-destructive transition-colors"
          onClick={onFinished}
        >
          {effectiveStep <= 2 ? "Exit Wizard" : "Back"}
        </Button>
        <div className="flex gap-4">
          {effectiveStep > 2 && (
            <Button 
              variant="outline" 
              className="h-14 px-10 rounded-2xl font-black italic uppercase text-xs border-2 border-border"
              onClick={() => setStep(step - 1)}
            >
              Previous Node
            </Button>
          )}
          <Button 
            className={cn(
              "h-14 px-12 rounded-2xl font-black italic uppercase text-xs gap-3 shadow-xl",
              effectiveStep === 3 ? "bg-success hover:bg-success" : "bg-secondary hover:bg-secondary/60"
            )}
            onClick={effectiveStep === 3 ? handleFinish : () => setStep(step + 1)}
            disabled={saving || (effectiveStep === 1 && selectedCats.length === 0)}
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
             effectiveStep === 3 ? <CheckCircle2 className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            {saving ? "Finalizing Sync..." : effectiveStep === 3 ? "Synchronize & Publish" : "Next Segment"}
          </Button>
        </div>
      </div>
    </div>
  );
};
