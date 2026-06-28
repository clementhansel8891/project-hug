import React from "react";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const marketplaces = [
  {
    id: "tokopedia",
    name: "Tokopedia",
    color: "emerald",
    slug: "Official Store",
  },
  { id: "shopee", name: "Shopee", color: "orange", slug: "Power Merchant" },
  { id: "lazada", name: "Lazada", color: "blue", slug: "LazMall" },
  { id: "tiktok", name: "TikTok Shop", color: "slate", slug: "Verified Shop" },
];

interface MarketplaceGalleryProps {
  onSelect?: (name: string, type: string, platform: string) => void;
}

export const MarketplaceGallery = ({ onSelect }: MarketplaceGalleryProps) => {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground italic">
          Pre-Integrated Marketplace Hub
        </h3>
        <Badge
          variant="outline"
          className="font-black italic text-[9px] border-border uppercase"
        >
          Regional Presets
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {(Array.isArray(marketplaces) ? marketplaces : []).map((mp) => (
          <Card
            key={mp.id}
            onClick={() => onSelect?.(mp.name, "MARKETPLACE", mp.id)}
            className="rounded-2xl bg-card border-none shadow-xl hover:shadow-2xl hover:scale-[1.02] cursor-pointer transition-all group overflow-hidden"
          >
            <CardContent className="p-6 flex flex-col items-center justify-center text-center">
              <div
                className={`w-20 h-20 bg-${mp.color}-50 rounded-[2rem] flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform duration-500`}
              >
                <ShoppingBag className={`w-8 h-8 text-${mp.color}-600`} />
              </div>
              <div className="space-y-2 mb-8">
                <div className="font-black italic text-foreground text-xl tracking-tighter uppercase italic">
                  {mp.name}
                </div>
                <div className="text-[9px] text-muted-foreground font-black uppercase tracking-widest">
                  {mp.slug}
                </div>
              </div>

              <div className="w-full h-[1px] bg-secondary/10 mb-8" />

              <div className="flex items-center gap-2 text-[9px] font-black text-primary uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                Connect Channel <ArrowRight className="w-3 h-3" />
              </div>
            </CardContent>
          </Card>
        ))}

        <Card className="rounded-2xl border-2 border-dashed border-border bg-secondary/5 flex flex-col justify-center items-center p-6 text-center space-y-4 hover:bg-muted transition-all group">
          <div className="w-16 h-16 rounded-3xl border-2 border-dashed border-border flex items-center justify-center group-hover:scale-110 transition-transform">
            <ShoppingBag className="w-8 h-8 text-muted-foreground/60" />
          </div>
          <div>
            <div className="font-black italic text-muted-foreground text-xs uppercase tracking-widest">
              Request API
            </div>
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-tighter mt-1 italic">
              Missing a platform?
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};
