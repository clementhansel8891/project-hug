import React from "react";
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Package,
  CreditCard,
  Banknote,
  RefreshCw,
  Zap,
  Settings2,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sku: string;
  discount?: number;
}

interface CartPanelProps {
  cart: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onCheckout: (method: "cash" | "card") => void;
  isProcessing: boolean;
  activeStoreName?: string;
  selectedItemId?: string | null;
  onSelectItem?: (id: string) => void;
  cartTaxRate: number;
  cartDiscount: number;
  onOpenModifiers: () => void;
  onApplyLineDiscount?: (id: string, amount: number) => void;
  totals: {
    subtotal: number;
    totalItemDiscount: number;
    cartDiscount: number;
    tax: number;
    grandTotal: number;
  };
}

export const CartPanel: React.FC<CartPanelProps> = ({
  cart,
  onUpdateQuantity,
  onRemove,
  onCheckout,
  isProcessing,
  activeStoreName,
  selectedItemId,
  onSelectItem,
  cartTaxRate,
  cartDiscount,
  onOpenModifiers,
  onApplyLineDiscount,
  totals,
}) => {
  const selectedItem = cart.find((item) => item.id === selectedItemId);

  return (
    <div className="h-full flex flex-col glass-morphism overflow-hidden shadow-[0_40px_80px_-20px_hsl(var(--foreground)/0.1)] rounded-[2.5rem] relative">
      {/* Gloss Effect overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-foreground/5 to-transparent pointer-events-none" />

      {/* Header */}
      <div className="p-4 border-b border-border/40 bg-background/20 shrink-0 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground shadow-2xl shadow-primary/40 ring-4 ring-primary/10">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black italic tracking-tighter uppercase text-foreground leading-none mb-1">
              {activeStoreName || "POS HUB"}
            </h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_10px_hsl(var(--success)/0.5)] animate-pulse" />
              <span className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">
                ACTIVE LINK
              </span>
            </div>
          </div>
        </div>
        <Badge className="h-8 rounded-xl bg-background border border-border text-foreground px-4 font-black italic shadow-lg shadow-primary/5">
          {cart.length} SKUS
        </Badge>
      </div>

      {/* Cart Content */}
      <ScrollArea className="flex-1 relative z-10">
        {cart.length === 0 ? (
          <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-muted-foreground">
            <div className="relative mb-6">
              <ShoppingCart className="w-16 h-16 opacity-10" />
              <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 italic">
              CART IS EMPTY
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {(Array.isArray(cart) ? cart : []).map((item) => {
              const isActive = selectedItemId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => onSelectItem?.(item.id)}
                  className={`group relative flex flex-col gap-3 p-3.5 rounded-[1.5rem] transition-all duration-500 cursor-pointer border ${
                    isActive
                      ? "bg-primary shadow-[0_15px_30px_-10px_hsl(var(--primary)/0.4)] border-primary ring-2 ring-primary/20 translate-x-1"
                      : "bg-background/40 border-border/60 hover:bg-background/60 hover:border-primary/20"
                  }`}
                >
                  {/* Top Row: Core Item Info */}
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h4
                        className={`text-[13px] font-black italic truncate tracking-tight transition-colors ${
                          isActive
                            ? "text-primary-foreground"
                            : "text-foreground group-hover:text-primary"
                        }`}
                      >
                        {item.name}
                      </h4>
                      <div
                        className={`mt-1 text-[9px] font-black uppercase tracking-widest ${
                          isActive ? "text-primary-foreground" : "text-muted-foreground"
                        }`}
                      >
                        UNIT: {formatCurrency(item.price, "IDR", "id-ID")}
                      </div>
                    </div>
                    {isActive && (
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const val = prompt("Enter Discount Amount (Rp):", "0");
                            if (val) onApplyLineDiscount?.(item.id, parseFloat(val));
                          }}
                          className="p-1.5 rounded-lg bg-success/20 text-success hover:text-success-foreground hover:bg-success transition-all flex items-center gap-1"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-black italic">DISC</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemove(item.id);
                          }}
                          className="p-1.5 rounded-lg bg-destructive/20 text-destructive hover:text-destructive-foreground hover:bg-destructive transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {item.discount && item.discount > 0 && (
                    <div className="flex items-center gap-2 -mt-2 mb-1">
                      <Badge variant="outline" className={`text-[9px] font-black italic tracking-tight py-0 px-2 rounded-lg border-success/30 ${isActive ? 'bg-primary-foreground text-success' : 'bg-success/10 text-success'}`}>
                        PROMO APPLIED: - {formatCurrency(item.discount, "IDR", "id-ID")}
                      </Badge>
                    </div>
                  )}

                  {/* Bottom Row: Controls & Line Total */}
                  <div className="flex items-center justify-between gap-4 mt-auto">
                    {/* Horizontal Industrial Quantity Controls */}
                    <div
                      className={`flex items-center gap-1 p-1 rounded-xl transition-colors ${
                        isActive ? "bg-primary-foreground/10" : "bg-foreground/5 shadow-inner"
                      }`}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateQuantity(item.id, -1);
                        }}
                        className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all active:scale-90 ${
                          isActive
                            ? "bg-primary-foreground text-destructive shadow-sm"
                            : "bg-background shadow-sm text-muted-foreground hover:text-destructive font-bold"
                        }`}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <div
                        className={`w-9 h-7 flex items-center justify-center text-sm font-black italic ${
                          isActive ? "text-primary-foreground" : "text-foreground"
                        }`}
                      >
                        {item.quantity}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateQuantity(item.id, 1);
                        }}
                        className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all active:scale-90 ${
                          isActive
                            ? "bg-primary-foreground text-primary shadow-sm"
                            : "bg-background shadow-sm text-foreground hover:text-primary"
                        }`}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="text-right flex flex-col items-end">
                      <span
                        className={`text-[8px] font-black uppercase tracking-[0.2em] opacity-40 leading-none mb-1 ${
                          isActive ? "text-primary-foreground" : "text-muted-foreground"
                        }`}
                      >
                        LINE TOTAL
                      </span>
                      <div
                        className={`text-lg font-black italic tracking-tighter transition-all duration-300 ${
                          isActive
                            ? "text-primary-foreground drop-shadow-lg scale-105"
                            : "text-primary"
                        }`}
                      >
                        <span className="text-[10px] not-italic opacity-40 mr-0.5">
                          RP
                        </span>
                        {formatCurrency(
                          item.price * item.quantity - (item.discount || 0),
                          "IDR",
                          "id-ID",
                        ).replace(/^Rp\s?/, "")}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Totals & Payments Section */}
      <div className="mt-auto shrink-0 relative z-20">
        {/* Totals & Payments Section */}
        <div className="p-4 bg-secondary text-foreground rounded-t-[2.5rem] shadow-[0_-30px_100px_rgba(0,0,0,0.4)] relative overflow-hidden border-t border-border/50">
          {/* Decorative glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/20 blur-[120px] -mr-40 -mt-20 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/10 blur-[100px] -ml-32 -mb-20 pointer-events-none" />

          {/* Totals */}
          <div className="space-y-2 mb-4 relative z-10">
            <div className="flex justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <span>Subtotal</span>
              <span>{formatCurrency(totals.subtotal, "IDR", "id-ID")}</span>
            </div>

            {(totals.totalItemDiscount > 0 || totals.cartDiscount > 0) && (
              <div className="flex justify-between text-xs font-semibold text-success uppercase tracking-wider">
                <span>Discount</span>
                <span>- {formatCurrency(totals.totalItemDiscount + totals.cartDiscount, "IDR", "id-ID")}</span>
              </div>
            )}

            <div className="flex justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <span className="flex items-center gap-2">
                Tax {cartTaxRate > 0 ? `(${cartTaxRate}%)` : "(Item)"}
                <button onClick={onOpenModifiers} className="text-primary hover:text-foreground transition-colors">
                  <Settings2 className="w-3 h-3" />
                </button>
              </span>
              <span>{formatCurrency(totals.tax, "IDR", "id-ID")}</span>
            </div>

            <Separator className="bg-border/20 my-1" />

            {/* GRAND TOTAL */}
            <div className="flex justify-between items-end pt-1">
              <div className="text-sm font-semibold text-primary uppercase tracking-widest">
                Total Due
              </div>

              <div className="text-right">
                <div className="text-3xl font-black tracking-tight text-foreground leading-none">
                  {formatCurrency(totals.grandTotal, "IDR", "id-ID")}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Buttons */}
          <div className="grid grid-cols-2 gap-3 relative z-10">
            <button
              disabled={cart.length === 0 || isProcessing}
              onClick={() => onCheckout("cash")}
              className="h-12 bg-background border border-border hover:bg-accent text-foreground font-semibold flex items-center justify-center gap-2 rounded-xl uppercase tracking-wide transition-all active:scale-95 disabled:opacity-30"
            >
              <Banknote className="w-4 h-4 text-primary" />
              Cash
            </button>

            <button
              disabled={cart.length === 0 || isProcessing}
              onClick={() => onCheckout("card")}
              className="h-12 bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 rounded-xl shadow-[0_10px_20px_hsl(var(--primary)/0.35)] transition-all active:scale-95 disabled:opacity-30"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Card
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
