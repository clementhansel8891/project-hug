import { useState } from "react";
import { 
  ShoppingBag, 
  Search, 
  Filter, 
  Info, 
  Truck, 
  Layers,
  Monitor,
  Smartphone,
  Printer,
  ChevronRight,
  Package
} from "lucide-react";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ESTELAGEA_HARDWARE, ITCatalogItem } from "@/core/services/it/itProcurementBridge";
import { EmptyState } from "@/components/shared/AsyncState";
import { toast } from "sonner";
import { HardwareRequestModal } from "./modals/HardwareRequestModal";

export default function TechShop() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<ITCatalogItem | null>(null);

  const filteredItems = (Array.isArray(ESTELAGEA_HARDWARE) ? ESTELAGEA_HARDWARE : []).filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.notes.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "ALL" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-border pb-8 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-[0.3em]">
            <ShoppingBag className="h-3 w-3" /> Hardware Catalog
          </div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic">
            Estela Gea Tech Shop
          </h1>
          <p className="text-sm text-muted-foreground font-medium">Official hardware and provisioning hub for Estela Gea infrastructure.</p>
        </div>

        <div className="flex items-center gap-3">
           <div className="relative w-64 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="Search hardware or SKU..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 rounded-2xl border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
              />
           </div>
           <Button variant="outline" className="h-12 w-12 rounded-2xl border-border p-0">
              <Filter className="h-4 w-4" />
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {filteredItems.length === 0 ? (
          <div className="md:col-span-2 xl:col-span-3">
            <EmptyState
              icon={Package}
              title="No hardware matches"
              description="No catalog items match your search or category filter. Try a different term or category."
            />
          </div>
        ) : null}
        {(Array.isArray(filteredItems) ? filteredItems : []).map((item) => (
          <div 
            key={item.id} 
            className="group relative bg-card border border-border rounded-[2.5rem] overflow-hidden hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 hover:-translate-y-2 p-8"
          >
             <div className="absolute top-0 right-0 p-8">
                <Badge className="bg-primary/10 text-primary border-primary/20 font-black text-[8px] tracking-[0.2em] uppercase px-3">
                   {item.sku}
                </Badge>
             </div>

             <div className="mb-8">
                <div className="h-16 w-16 rounded-3xl bg-muted flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-500">
                   {item.name.includes("Tab") ? <Smartphone className="h-8 w-8" /> : 
                    item.name.includes("Printer") ? <Printer className="h-8 w-8" /> : 
                    <Monitor className="h-8 w-8" />}
                </div>
             </div>

             <div className="space-y-2 mb-8">
                <h3 className="text-xl font-black tracking-tight uppercase italic group-hover:text-primary transition-colors">
                  {item.name}
                </h3>
                <p className="text-sm text-muted-foreground font-medium leading-relaxed line-clamp-2">
                   {item.description}
                </p>
             </div>

             <div className="p-4 rounded-3xl bg-muted mb-8 space-y-3 border border-border">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                   <span>Administrative Note</span>
                   <Info className="h-3 w-3" />
                </div>
                <p className="text-[10px] font-bold text-muted-foreground leading-relaxed italic">
                   "{item.notes}"
                </p>
             </div>

             <div className="flex items-center justify-between mt-auto">
                <div>
                   <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground">Est. Cost</p>
                   <p className="text-lg font-black">
                      Rp {(item.estimatedCost / 1000000).toFixed(1)}M
                   </p>
                </div>
                
                <Button
                  className="rounded-2xl bg-foreground dark:bg-primary text-background font-black text-[10px] uppercase tracking-widest px-6 h-12 group-hover:scale-105 transition-all"
                  onClick={() => {
                    setActiveItem(item);
                    setIsDialogOpen(true);
                  }}
                >
                  Request Gear <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
             </div>
          </div>
        ))}
      </div>

      <WorkspacePanel title="Deployment Flow" description="Understanding the orchestration sequence." className="rounded-[2.5rem] border-border shadow-xl overflow-hidden p-0">
         <div className="grid grid-cols-1 md:grid-cols-4">
            <div className="p-8 border-r border-border flex flex-col items-center text-center space-y-4 group">
               <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ShoppingBag className="h-6 w-6" />
               </div>
               <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Step 01</p>
                  <p className="text-sm font-black uppercase italic">Catalog Selection</p>
               </div>
            </div>
            <div className="p-8 border-r border-border flex flex-col items-center text-center space-y-4 group">
               <div className="h-12 w-12 rounded-2xl bg-success/10 text-success flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Layers className="h-6 w-6" />
               </div>
               <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Step 02</p>
                  <p className="text-sm font-black uppercase italic">Stock Check Bridge</p>
               </div>
            </div>
            <div className="p-8 border-r border-border flex flex-col items-center text-center space-y-4 group">
               <div className="h-12 w-12 rounded-2xl bg-warning/10 text-warning flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Truck className="h-6 w-6" />
               </div>
               <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Step 03</p>
                  <p className="text-sm font-black uppercase italic">Fulfill or Procure</p>
               </div>
            </div>
            <div className="p-8 flex flex-col items-center text-center space-y-4 group">
               <div className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Package className="h-6 w-6" />
               </div>
               <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Step 04</p>
                  <p className="text-sm font-black uppercase italic">Asset Registration</p>
               </div>
            </div>
         </div>
      </WorkspacePanel>

      {activeItem && (
        <HardwareRequestModal
          isOpen={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false);
            setActiveItem(null);
          }}
          catalogItemId={activeItem.id}
          itemName={activeItem.name}
          defaultLocationId="MAIN_WH"
          onSuccess={() => {
            toast.success("Hardware Request Submitted", {
              description: `Request for "${activeItem.name}" has been submitted.`,
            });
          }}
        />
      )}
    </div>
  );
}
