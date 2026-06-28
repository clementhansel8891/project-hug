import React, { useState, useMemo, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { retailService } from "@/core/services/retail/retailService";
import { useSession } from "@/core/security/session";
import { useRetail } from "../context/RetailContext";
import { useNavigate } from "react-router-dom";
import { printerService } from "@/core/services/hardware/printerService";
import type { RetailShift, RetailProduct } from "@/core/types/retail/retail";
import {
  RefreshCw,
  LayoutGrid,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Printer as PrinterIcon,
  QrCode,
  Home,
  LogOut,
  Power,
  Store
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Barcode from "react-barcode";

// POS Components
import { ScannerSearchHeader } from "./pos/ScannerSearchHeader";
import { ProductGrid } from "./pos/ProductGrid";
import { CartPanel } from "./pos/CartPanel";
import { CashPaymentModal } from "./pos/CashPaymentModal";
import { ElectronicPaymentModal } from "./pos/ElectronicPaymentModal";
import { paymentService } from "@/core/services/payment/paymentService";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sku: string;
  taxRate?: number;
  discount?: number;
  isManualDiscount?: boolean;
}

const CashierPOS = () => {
  const session = useSession();
  const { activeStore, activeShift, isLoading: isContextLoading } = useRetail();
  const { toast } = useToast();
  const navigate = useNavigate();

  // State
  const [searchTerm, setSearchTerm] = useState("");
  const [barcodeValue, setBarcodeValue] = useState("");
  const [products, setProducts] = useState<RetailProduct[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [activeCategory, setActiveCategory] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(
    window.crypto.randomUUID?.() || Math.random().toString(36).substring(2),
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [activePaymentModal, setActivePaymentModal] = useState<
    "none" | "cash" | "electronic"
  >("none");
  const [isModifierModalOpen, setIsModifierModalOpen] = useState(false);
  const [cartTaxRate, setCartTaxRate] = useState(0);
  const [cartDiscount, setCartDiscount] = useState(0);
  const [modifierTax, setModifierTax] = useState("0");
  const [modifierDiscount, setModifierDiscount] = useState("0");
  const [modifierReason, setModifierReason] = useState("");
  const [cartNotes, setCartNotes] = useState("");

  const fetchPromotions = React.useCallback(async () => {
    try {
      const promoList = await retailService.listPromotions(session.tenant_id, session);
      setPromotions(promoList);
    } catch (err) {
      console.error("Failed to sync promotions", err);
    }
  }, [session]);

  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

  const applyAutomatedDiscounts = React.useCallback((currentCart: CartItem[]) => {
    return currentCart.map(item => {
      // If manually discounted, we honor that choice and skip automation
      if (item.isManualDiscount) return item;

      const activePromos = (Array.isArray(promotions) ? promotions : []).filter(p => p.status === 'active');
      
      let bestDiscount = 0; 

      for (const promo of activePromos) {
        let applies = false;
        if (promo.target === 'all') applies = true;
        else if (promo.target?.startsWith('sku:') && promo.target.split(':')[1] === item.sku) applies = true;
        else if (promo.target?.startsWith('id:') && promo.target.split(':')[1] === item.id) applies = true;

        if (applies) {
          if (promo.type === 'WHOLESALE') {
             const minQtyMatch = promo.notes?.match(/min_qty:(\d+)/);
             const minQty = minQtyMatch ? parseInt(minQtyMatch[1]) : 0;
             if (item.quantity >= minQty) {
                const discountVal = (Number(promo.value) / 100) * (item.price * item.quantity);
                bestDiscount = Math.max(bestDiscount, discountVal);
             }
          } else if (promo.type === 'PERCENTAGE') {
             const discountVal = (Number(promo.value) / 100) * (item.price * item.quantity);
             bestDiscount = Math.max(bestDiscount, discountVal);
          } else if (promo.type === 'FIXED') {
             // Fixed promo value is typically for the whole line if multiple items
             bestDiscount = Math.max(bestDiscount, Number(promo.value));
          }
        }
      }
      return { ...item, discount: bestDiscount };
    });
  }, [promotions]);

  // Post-Transaction State
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const cartRef = React.useRef<CartItem[]>([]);

  useEffect(() => {
    const discounted = applyAutomatedDiscounts(cart);
    // Deep compare to avoid infinite loops
    if (JSON.stringify(discounted) !== JSON.stringify(cart)) {
      setCart(discounted);
    }
  }, [cart, applyAutomatedDiscounts]);

  const PAGE_SIZE = 20;

  const toastRef = React.useRef(toast);
  React.useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  // Fetches products for the given category (or all if null).
  // Always passes a large pageSize so the backend doesn't truncate the result.
  const fetchProducts = React.useCallback(
    async (categoryId?: string) => {
      if (!session.tenant_id) return;
      setIsProductsLoading(true);
      try {
        const prodData = await retailService.listInventory(
          session.tenant_id,
          session,
          {
            locationId: activeStore?.id || session.location_id,
            categoryId,
            pageSize: 2000, // Ensure we get all items, not just the 20-item default
          },
        );
        setProducts(prodData);
      } catch (error) {
        console.error("Failed to fetch products", error);
        toastRef.current({
          title: "Inventory Error",
          description: "Could not load product catalog.",
          variant: "destructive",
        });
      } finally {
        setIsProductsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session.tenant_id, session.user_id, session.location_id],
  );

  useEffect(() => {
    const init = async () => {
      if (!session.tenant_id) return;
      try {
        setIsLoading(true);
        const catData = await retailService.listCategories(session.tenant_id, session);
        setCategories(catData);
        // Fetch products without a category filter (all items)
        await fetchProducts();
      } catch (error) {
        console.error("Failed to initialize POS", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (session.tenant_id) {
      init();
    } else {
      setIsLoading(false);
    }
  }, [session.tenant_id, fetchProducts]);

  // When the user changes category, re-fetch from the server with the correct filter
  useEffect(() => {
    if (!isLoading && !isContextLoading && !activeShift) {
      toast({
        title: "Fiscal Gate Active",
        description: "Please initialize a shift before accessing the terminal.",
        variant: "destructive",
      });
      navigate("/m/retail/operational/gateway");
    }
  }, [activeShift, isLoading, isContextLoading, navigate, toast]);

  useEffect(() => {
    fetchProducts(activeCategory?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  useEffect(() => {
    if (activeStore?.operationalConfig?.tax_rate !== undefined) {
      setCartTaxRate(activeStore.operationalConfig.tax_rate / 100);
    }
  }, [activeStore]);

  const addToCart = React.useCallback((product: RetailProduct) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return (Array.isArray(prev) ? prev : []).map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          sku: product.sku,
          quantity: 1,
          taxRate: product.taxRate,
          discount: 0,
        },
      ];
    });
    setSelectedItemId(product.id);
  }, []);

  useEffect(() => {
    if (barcodeValue.length >= 8) {
      // First: try local lookup in already-loaded products
      const product = products.find(
        (p) => p.sku === barcodeValue || p.barcode === barcodeValue,
      );
      if (product) {
        addToCart(product);
        setBarcodeValue("");
        toastRef.current({
          title: "Item Scanned",
          description: `${product.name} added.`,
        });
      } else {
        // Fallback: server-side search by barcode/sku
        const barcode = barcodeValue;
        setBarcodeValue("");
        (async () => {
          try {
            const results = await retailService.listInventory(
              session.tenant_id!,
              session,
              {
                q: barcode,
                locationId: activeStore?.id || session.location_id,
                pageSize: 5,
              },
            );
            const match = (results || []).find(
              (p) => p.sku === barcode || p.barcode === barcode,
            );
            if (match) {
              addToCart(match);
              // Also add to local product list so repeated scans work immediately
              setProducts((prev) => {
                if (prev.some((p) => p.id === match.id)) return prev;
                return [...prev, match];
              });
              toastRef.current({
                title: "Item Scanned",
                description: `${match.name} added.`,
              });
            } else {
              toastRef.current({
                title: "Scan Alert",
                description: `Barcode [${barcode}] not recognized in catalog.`,
                variant: "destructive",
              });
            }
          } catch {
            toastRef.current({
              title: "Scan Alert",
              description: `Barcode [${barcode}] not recognized in catalog.`,
              variant: "destructive",
            });
          }
        })();
      }
    }
  }, [barcodeValue, products, addToCart, session, activeStore]);

  // Products are already server-filtered by categoryId; we only need local text search
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const q = searchTerm.toLowerCase();
    return (Array.isArray(products) ? products : []).filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    );
  }, [products, searchTerm]);

  // Reset to page 1 whenever the visible set changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredProducts]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / PAGE_SIZE),
  );
  const pagedProducts = filteredProducts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      (Array.isArray(prev) ? prev : []).map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item,
      ),
    );
  };

  const removeFromCart = (id: string) =>
    setCart((prev) => (Array.isArray(prev) ? prev : []).filter((item) => item.id !== id));

  const handleCheckout = (method: "cash" | "card") => {
    setActivePaymentModal(method === "card" ? "electronic" : "cash");
  };

  // Calculate Totals dynamically
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItemDiscount = cart.reduce((sum, item) => sum + (item.discount || 0), 0);
  const effectiveSubtotal = Math.max(0, subtotal - totalItemDiscount - cartDiscount);
  const tax = cartTaxRate > 0 
    ? effectiveSubtotal * cartTaxRate 
    : cart.reduce((sum, item) => {
        const itemSub = (item.price * item.quantity) - (item.discount || 0);
        return sum + (itemSub * (item.taxRate || 0));
      }, 0);
  const isIDR = activeStore?.currency === "IDR" || !activeStore?.currency;
  const grandTotal = isIDR 
    ? Math.round(effectiveSubtotal + tax)
    : Math.round((effectiveSubtotal + tax) * 100) / 100;

  const finalizeTransaction = async (
    method: string,
    receivedAmount?: number,
    channel?: string,
    notes?: string,
    overrideReason?: string,
  ) => {
    if (cart.length === 0 || !session.tenant_id) return;

    if (!activeStore?.id) {
      toast({
        title: "Store Context Missing",
        description: "Please select a store to proceed.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const paymentMethodMap: Record<
        string,
        "cash" | "card" | "qr" | "wallet"
      > = {
        CASH: "cash",
        CARD: "card",
        QRIS: "qr",
        WALLET: "wallet",
      };

      const finalNotes = overrideReason 
        ? `${notes || ""}\n[COMPLIANCE OVERRIDE REASON]: ${overrideReason}`
        : notes;

      // Atomic Backend Checkout with Idempotency
      const order = await retailService.checkout(
        session.tenant_id,
        session,
        {
          store_id: activeStore.id,
          terminal_id: "terminal-pos",
          items: (Array.isArray(cart) ? cart : []).map((item) => ({
            product_id: item.id,
            name: item.name,
            quantity: item.quantity,
            unit_price: item.price,
            discount: item.discount,
            taxRate: item.taxRate,
            commission_rate: 0.05, // Default 5% for audit demonstration
          })),
          payment_method: paymentMethodMap[method] || "cash",
          payment_received: receivedAmount || grandTotal,
          grand_total: grandTotal,
          shift_id: activeShift?.id || undefined,
          currency: activeStore.currency || "IDR",
          payment_channel: channel,
          notes: finalNotes,
          cart_discount: cartDiscount,
        },
        idempotencyKey,
      );

      // Generate and Print Receipt
      const receiptPayload = {
        storeName: activeStore.name,
        storeAddress: activeStore.locationId || "Main Branch",
        orderId: order.id,
        date: new Date().toLocaleString(),
        cashier: session.fullName || session.user_id,
        items: (Array.isArray(cart) ? cart : []).map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity
        })),
        subtotal,
        tax,
        discount: cartDiscount,
        grandTotal,
        paymentMethod: method,
        receivedAmount: receivedAmount,
        changeAmount: receivedAmount ? receivedAmount - grandTotal : 0,
        notes: finalNotes
      };

      setLastTransaction(receiptPayload);
      setIsSuccessModalOpen(true);

      setCart([]);
      setCartNotes("");
      setModifierReason("");
      setActivePaymentModal("none");
      
      // Generate new key for the next unique transaction
      setIdempotencyKey(
        window.crypto.randomUUID?.() || Math.random().toString(36).substring(2),
      );

      try {
        await printerService.printReceipt(session.tenant_id!, session, receiptPayload);
      } catch (printErr) {
        console.warn("Printing failed but transaction was saved:", printErr);
      }
    } catch (error: any) {
      console.error("Checkout Error:", error);
      toast({
        title: "Transaction Failed",
        description: error instanceof Error ? error.message : "Internal Error.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading || isContextLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background text-muted-foreground font-black italic uppercase tracking-[0.25em]">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-[50%] h-[50%] bg-primary/20 blur-[150px] rounded-full animate-pulse" />
        </div>
        <RefreshCw className="w-16 h-16 mb-8 animate-spin text-primary relative z-10" />
        <span className="relative z-10 text-foreground">Syncing POS Environment...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 relative flex selection:bg-primary/30 selection:text-primary-foreground">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] w-[45%] h-[45%] bg-primary/10 blur-[130px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[35%] h-[35%] bg-info/10 blur-[120px] rounded-full animate-pulse" />
      </div>

      {/* Main Container: Full height, flex row */}
      <div className="flex flex-1 w-full gap-5 px-8 py-8 overflow-hidden relative z-10">
        {/* LEFT PLANE: Includes Controls + Inventory */}
        <div className="flex-[2.8] flex flex-col gap-6 overflow-hidden min-h-0">
          
          {/* TACTICAL HEADER */}
          <div className="flex items-center justify-between glass-morphism p-6 rounded-[2rem] relative overflow-hidden group shrink-0">
            <div className="flex items-center gap-6 relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center text-primary shadow-2xl ring-4 ring-primary/10 group-hover:scale-105 transition-transform duration-500">
                <Store className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-black italic tracking-tighter text-foreground uppercase leading-none mb-2">
                  {activeStore?.name || "RETAIL_TERMINAL"}
                </h1>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-success/10 rounded-lg border border-success/20">
                    <div className="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_10px_hsl(var(--success)/0.5)]" />
                    <span className="text-[10px] font-black uppercase text-success tracking-widest">
                      Session Active
                    </span>
                  </div>
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] italic">
                    Node: {session.user_id.slice(0, 8)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 relative z-10">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchProducts(activeCategory?.id)}
                className="h-12 rounded-xl bg-primary/5 border-primary/10 text-foreground hover:bg-primary/10 font-black italic uppercase text-[10px] tracking-widest gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isProductsLoading ? 'animate-spin' : ''}`} /> Sync Catalog
              </Button>

              {activeShift && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => navigate('/m/retail/operational/shift-close')}
                  className="h-12 rounded-xl font-black italic uppercase text-[10px] tracking-widest gap-2"
                >
                  <Power className="w-3.5 h-3.5" /> Close Shift
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="w-12 h-12 rounded-2xl bg-secondary hover:bg-accent hover:text-accent-foreground text-foreground transition-all"
                onClick={() => {
                  if (activeShift) {
                    toast({
                      title: "Shift Still Active",
                      description: "Please close your shift before logging out.",
                      variant: "destructive",
                    });
                  } else {
                    // Logout logic - will be implemented with auth context
                    window.location.href = "/login";
                  }
                }}
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="w-12 h-12 rounded-2xl bg-secondary hover:bg-accent hover:text-accent-foreground text-foreground transition-all"
                onClick={() => window.location.href = "/"}
                title="Return to Core"
              >
                <Home className="w-5 h-5" />
              </Button>

              {activeShift && (
                <div className="px-4 py-2 bg-success/10 border border-success/20 rounded-xl flex items-center gap-2 h-12">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="text-[10px] font-black italic uppercase text-success tracking-widest">
                    Shift Active: {activeShift.id.slice(-6).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* IN-PLANE COMMAND BAR (Scan, Search, Filter) */}
          <div className="flex items-center gap-4 bg-card/40 backdrop-blur-2xl p-4 rounded-[2rem] border border-border shadow-2xl shrink-0">
            <div className="flex-1">
              <ScannerSearchHeader
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                barcodeValue={barcodeValue}
                onBarcodeChange={setBarcodeValue}
              />
            </div>

            <div className="h-10 w-px bg-border" />

            {/* Touch-Friendly Category Selector */}
            <div className="flex items-center gap-3 px-5 py-3 bg-secondary/50 border border-border rounded-2xl min-w-[240px] h-14 transition-all hover:border-primary/50">
              <Filter className="w-4 h-4 text-primary shrink-0" />
              <select
                className="flex-1 bg-transparent text-[11px] font-black uppercase tracking-widest outline-none text-foreground cursor-pointer h-full appearance-none"
                value={activeCategory?.id || ""}
                onChange={(e) => {
                  const cat = categories.find((c) => c.id === e.target.value);
                  setActiveCategory(cat || null);
                }}
              >
                <option value="" className="bg-background">All Categories</option>
                {(Array.isArray(categories) ? categories : []).map((cat) => (
                  <option key={cat.id} value={cat.id} className="bg-background">
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Button - touch-friendly */}
            <button
              onClick={() => {
                setActiveCategory(null);
                setSearchTerm("");
              }}
              title="Show all products"
              className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all border shrink-0 ${
                !activeCategory && !searchTerm
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                  : "bg-secondary text-muted-foreground border-border hover:text-foreground hover:border-primary/30"
              }`}
            >
              <LayoutGrid className="w-6 h-6" />
            </button>
          </div>

          {/* Section Label — always visible, never scrolls */}
          <div className="flex items-center gap-4 shrink-0 px-2">
            <div className="h-px flex-1 bg-border/30" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground italic flex items-center gap-3">
              {isProductsLoading && (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
              )}
              {searchTerm
                ? "SEARCH DATASET"
                : activeCategory
                  ? activeCategory.name
                  : "ROOT INVENTORY"}
              {!isProductsLoading && (
                <span className="text-primary">
                  [{filteredProducts.length} ASSETS]
                </span>
              )}
            </span>
            <div className="h-px flex-1 bg-border/30" />
          </div>

          {/* Product Grid — this is the only scrollable area */}
          <div className="flex-1 overflow-y-auto min-h-0 pr-2 -mr-2 custom-scrollbar">
            {isProductsLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
                <div className="w-16 h-16 rounded-full border-t-2 border-primary animate-spin" />
                <p className="text-[11px] font-black uppercase tracking-[0.3em]">
                  Hydrating Catalog...
                </p>
              </div>
            ) : (
              <ProductGrid products={pagedProducts} onAddToCart={addToCart} />
            )}
          </div>

          {/* Pagination Bar — always visible, pinned to bottom of left pane */}
          <div className="shrink-0 bg-card/40 backdrop-blur-2xl rounded-[1.5rem] border border-border shadow-2xl px-6 py-4 flex items-center justify-between">
            {/* Range Label */}
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] italic">
              {filteredProducts.length === 0
                ? "No entries found"
                : `Range: ${(currentPage - 1) * PAGE_SIZE + 1} – ${Math.min(currentPage * PAGE_SIZE, filteredProducts.length)} / ${filteredProducts.length}`}
            </span>

            {/* Page Pills + Prev/Next */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isProductsLoading}
                className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center text-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-20 transition-all active:scale-95"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-1.5 px-2">
                {(() => {
                  const window = 1;
                  const start = Math.max(1, currentPage - window);
                  const end = Math.min(totalPages, currentPage + window);
                  const pages = [];
                  for (let i = start; i <= end; i++) {
                    pages.push(
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i)}
                        className={`w-10 h-10 rounded-xl text-[11px] font-black transition-all active:scale-95 ${
                          i === currentPage
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                            : "bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                        }`}
                      >
                        {i}
                      </button>,
                    );
                  }
                  return pages;
                })()}
              </div>

              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages || isProductsLoading}
                className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center text-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-20 transition-all active:scale-95"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PLANE: Cart Panel */}
        <div className="flex-[1.2] min-w-[420px] h-full overflow-hidden">
          <CartPanel
            cart={cart}
            onUpdateQuantity={updateQuantity}
            onRemove={removeFromCart}
            onCheckout={handleCheckout}
            isProcessing={isProcessing}
            activeStoreName={activeStore?.name}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
            cartTaxRate={cartTaxRate}
            cartDiscount={cartDiscount}
            onOpenModifiers={() => {
              setModifierTax(cartTaxRate.toString());
              setModifierDiscount(cartDiscount.toString());
              setModifierReason("");
              setIsModifierModalOpen(true);
            }}
            onApplyLineDiscount={(id, amount) => {
              setCart(prev => prev.map(item => item.id === id ? { ...item, discount: amount, isManualDiscount: true } : item));
            }}
            totals={{ subtotal, totalItemDiscount, cartDiscount, tax, grandTotal }}
          />
        </div>
      </div>

      <CashPaymentModal
        isOpen={activePaymentModal === "cash"}
        onClose={() => setActivePaymentModal("none")}
        total={grandTotal}
        onConfirm={(received, notes) => finalizeTransaction("CASH", received, undefined, notes, modifierReason)}
      />

      <ElectronicPaymentModal
        isOpen={activePaymentModal === "electronic"}
        onClose={() => setActivePaymentModal("none")}
        total={grandTotal}
        isProcessing={isProcessing}
        onConfirm={(method, channel, notes) =>
          finalizeTransaction(method, undefined, channel, notes, modifierReason)
        }
      />

      <Dialog open={isModifierModalOpen} onOpenChange={setIsModifierModalOpen}>
         {/* Modifier content omitted for brevity as per original file structure */}
      </Dialog>

      {/* TRANSACTION SUCCESS MODAL - Thermal Preview */}
      <Dialog open={isSuccessModalOpen} onOpenChange={setIsSuccessModalOpen}>
        <DialogContent className="max-w-md bg-background border-border p-0 overflow-hidden rounded-[2rem]">
          <div className="p-8 bg-primary flex flex-col items-center text-center gap-4">
             <div className="w-20 h-20 bg-primary-foreground/20 rounded-full flex items-center justify-center backdrop-blur-xl animate-bounce">
                <CheckCircle2 className="w-10 h-10 text-primary-foreground" />
             </div>
             <div>
                <h2 className="text-2xl font-black italic uppercase tracking-tighter text-primary-foreground">Payment Received</h2>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-foreground/70">Order Synchronized to Vault</p>
             </div>
          </div>

          <div className="p-8 bg-secondary/50 flex flex-col items-center">
             <div className="w-full bg-card p-6 shadow-2xl space-y-4 font-mono text-[10px] text-black leading-tight uppercase relative mb-8">
                <div className="text-center space-y-1 py-2">
                   <p className="text-xs font-bold tracking-tighter">{lastTransaction?.storeName}</p>
                   <p className="text-[8px]">{lastTransaction?.storeAddress}</p>
                </div>
                <div className="py-2 border-y border-dashed border-muted space-y-0.5 text-[8px]">
                   <div className="flex justify-between"><span>ORDER:</span><span>#{lastTransaction?.orderId?.slice(-8).toUpperCase()}</span></div>
                   <div className="flex justify-between"><span>DATE:</span><span>{lastTransaction?.date}</span></div>
                   <div className="flex justify-between"><span>CASHIER:</span><span>{lastTransaction?.cashier}</span></div>
                </div>
                <div className="py-2 space-y-1">
                   {lastTransaction?.items.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between">
                         <span>{item.quantity}x {item.name}</span>
                         <span>{formatCurrency(item.total, "IDR", "id-ID")}</span>
                      </div>
                   ))}
                </div>
                <div className="py-2 border-t border-dashed border-muted space-y-1 font-bold">
                   <div className="flex justify-between"><span>TOTAL</span><span>{formatCurrency(lastTransaction?.grandTotal, "IDR", "id-ID")}</span></div>
                   <div className="flex justify-between text-primary"><span>METHOD</span><span>{lastTransaction?.paymentMethod}</span></div>
                </div>
                {lastTransaction?.changeAmount > 0 && (
                   <div className="p-3 bg-success/10 rounded-lg flex justify-between items-center text-success">
                      <span className="font-black">CHANGE DUE:</span>
                      <span className="text-sm font-black tracking-tighter">{formatCurrency(lastTransaction.changeAmount, "IDR", "id-ID")}</span>
                   </div>
                )}
                <div className="py-4 flex flex-col items-center">
                   <Barcode 
                      value={lastTransaction?.orderId || "ZEN-TEST"} 
                      width={1.0} 
                      height={40} 
                      displayValue={false} 
                      background="transparent"
                   />
                   <p className="text-[7px] mt-1 tracking-widest font-black italic">{lastTransaction?.orderId}</p>
                </div>
             </div>

             <div className="w-full grid grid-cols-2 gap-3">
                <Button variant="outline" className="h-12 rounded-xl bg-secondary border-border text-foreground font-black italic uppercase text-[10px] tracking-widest gap-2" onClick={() => printerService.printReceipt(session.tenant_id, session, lastTransaction)}>
                   <PrinterIcon className="w-4 h-4" /> Reprint
                </Button>
                <Button className="h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black italic uppercase text-[10px] tracking-widest gap-2 shadow-lg shadow-primary/20" onClick={() => setIsSuccessModalOpen(false)}>
                   Next Customer
                </Button>
             </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CashierPOS;
