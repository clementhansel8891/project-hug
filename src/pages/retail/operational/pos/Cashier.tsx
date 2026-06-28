import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Wallet,
  Smartphone,
  ShoppingCart,
  Package,
  X,
  Receipt,
  User,
  Clock,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { useApp } from '@/contexts/AppContext';
import { toast } from '@/hooks/use-toast';
import { retailService } from '@/core/services/retail/retailService';
import { useSession } from '@/core/security/session';
import { apiRequest } from '@/core/api/apiClient';
import { getMutationToastHandlers } from '@/lib/modal-helpers';
import { RetailProduct } from '@/core/types/retail/retail';

// ─── Zod Schema for POS checkout ────────────────────────────────────────────────

const posCheckoutSchema = z.object({
  paymentMethod: z.enum(['cash', 'card', 'qr'], {
    required_error: 'Payment method is required',
  }),
  cashReceived: z.number().optional(),
  grandTotal: z.number().positive('Total must be greater than 0'),
});

export type PosCheckoutFormValues = z.infer<typeof posCheckoutSchema>;

interface CartItem {
  product: RetailProduct;
  quantity: number;
}

const retailCategories = ['All', 'Coffee', 'Merchandise', 'Gift Cards', 'Equipment'];

export default function RetailCashier() {
  const session = useSession();
  const queryClient = useQueryClient();
  const { state, addToCart, removeFromCart, clearCart } = useApp();
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<RetailProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'qr'>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const barcodeRef = useRef<HTMLInputElement>(null);

  // ─── React Hook Form for checkout ──────────────────────────────────────────
  const form = useForm<PosCheckoutFormValues>({
    resolver: zodResolver(posCheckoutSchema),
    defaultValues: {
      paymentMethod: 'cash',
      cashReceived: undefined,
      grandTotal: 0,
    },
  });

  // ─── useMutation for POS checkout ─────────────────────────────────────────
  const checkoutMutation = useMutation({
    mutationFn: (data: PosCheckoutFormValues) => {
      const payload = {
        store_id: state.settings.defaultLocationId || 'default-store',
        terminal_id: 'terminal-pos',
        items: cartItems.map((item) => ({
          product_id: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          unit_price: item.product.price,
        })),
        payment_method: data.paymentMethod,
        payment_received: data.cashReceived || data.grandTotal,
        grand_total: data.grandTotal,
        currency: 'IDR',
      };

      return apiRequest('/v1/retail/checkout', 'POST', session, payload);
    },
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [['retail', 'pos', 'transactions'], ['retail', 'inventory']],
      onClose: () => {
        setIsCheckoutOpen(false);
        clearCartLocal();
        barcodeRef.current?.focus();
      },
      form,
      successTitle: 'Transaction Complete',
      successDescription: `Payment received via ${paymentMethod}`,
    }),
  });

  const isProcessing = checkoutMutation.isPending;

  // Focus barcode input on mount
  useEffect(() => {
    barcodeRef.current?.focus();
    
    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const data = await retailService.listInventory(session.tenant_id!, session, {
          locationId: state.settings.defaultLocationId || undefined
        });
        setProducts(data);
      } catch (e) {
        toast({
          title: "Error",
          description: "Failed to load products from registry.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (session.tenant_id) {
      fetchProducts();
    }
  }, [session.tenant_id, state.settings.defaultLocationId]);

  // Filter products
  const filteredProducts = (Array.isArray(products) ? products : []).filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.barcode?.includes(searchTerm);
    const matchesCategory = selectedCategory === 'All' || product.categoryName === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Barcode scanning
  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && barcodeInput) {
      const product = products.find((p) => p.barcode === barcodeInput);
      if (product) {
        addToCartLocal(product);
        toast({
          title: 'Item added',
          description: `${product.name} added to cart`,
        });
      } else {
        toast({
          title: 'Product not found',
          description: `No product with barcode ${barcodeInput}`,
          variant: 'destructive',
        });
      }
      setBarcodeInput('');
    }
  };

  // Cart management
  const addToCartLocal = (product: RetailProduct) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return (Array.isArray(prev) ? prev : []).map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCartItems((prev) =>
      (Array.isArray(prev) ? prev : []).map((item) =>
          item.product.id === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCartLocal = (productId: string) => {
    setCartItems((prev) => (Array.isArray(prev) ? prev : []).filter((item) => item.product.id !== productId));
  };

  const clearCartLocal = () => {
    setCartItems([]);
  };

  // Calculations
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const tax = subtotal * 0.1;
  const total = subtotal + tax;
  const change = cashReceived ? parseFloat(cashReceived) - total : 0;

  // Checkout
  const handleCheckout = () => {
    if (cartItems.length === 0) {
      toast({
        title: 'Cart is empty',
        description: 'Add items before checkout',
        variant: 'destructive',
      });
      return;
    }
    setIsCheckoutOpen(true);
    setCashReceived('');
  };

  const completeTransaction = () => {
    // Update form and submit via mutation
    form.setValue('paymentMethod', paymentMethod);
    form.setValue('grandTotal', total);
    form.setValue('cashReceived', cashReceived ? parseFloat(cashReceived) : undefined);

    checkoutMutation.mutate({
      paymentMethod,
      grandTotal: total,
      cashReceived: cashReceived ? parseFloat(cashReceived) : undefined,
    });
  };

  const quickCashAmounts = [20, 50, 100, 200];

  return (
    <div className="flex h-full">
      {/* Left Panel - Products */}
      <div className="flex-1 flex flex-col p-4 gap-4">
        {/* Search and Barcode Row */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-12"
            />
          </div>
          <div className="relative w-64">
            <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={barcodeRef}
              placeholder="Scan barcode..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={handleBarcodeScan}
              className="pl-9 h-12 font-mono"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <ScrollArea className="w-full">
          <div className="flex gap-2 pb-2">
            {(Array.isArray(retailCategories) ? retailCategories : []).map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="whitespace-nowrap"
              >
                {category}
              </Button>
            ))}
          </div>
        </ScrollArea>

        {/* Product Grid */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p>Loading catalog...</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {(Array.isArray(filteredProducts) ? filteredProducts : []).map((product) => (
                <Card
                  key={product.id}
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-md hover:border-primary/50 active:scale-95',
                    product.stock === 0 && 'opacity-50 pointer-events-none'
                  )}
                  onClick={() => addToCartLocal(product)}
                >
                  <CardContent className="p-3">
                    <div className="aspect-square bg-muted rounded-lg mb-2 flex items-center justify-center">
                      <Package className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-medium text-sm truncate">{product.name}</h3>
                    <div className="flex items-center justify-between mt-1">
                      <p className="font-bold text-primary">{formatCurrency(product.price)}</p>
                      {product.stock !== undefined && (
                        <Badge variant={product.stock < 10 ? 'destructive' : 'secondary'} className="text-xs">
                          {product.stock}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right Panel - Cart */}
      <div className="w-96 border-l bg-card flex flex-col">
        {/* Cart Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              <h2 className="font-semibold">Current Sale</h2>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{state.currentUser?.name || 'Guest'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{new Date().toLocaleTimeString()}</span>
            <Badge variant="outline" className="ml-auto">
              {cartItems.reduce((sum, item) => sum + item.quantity, 0)} items
            </Badge>
          </div>
        </div>

        {/* Cart Items */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {cartItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>Cart is empty</p>
                <p className="text-sm">Scan a barcode or tap products to add</p>
              </div>
            ) : (
              (Array.isArray(cartItems) ? cartItems : []).map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(item.product.price)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateQuantity(item.product.id, -1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center font-semibold">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateQuantity(item.product.id, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="font-semibold w-20 text-right">
                    {formatCurrency(item.product.price * item.quantity)}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => removeFromCartLocal(item.product.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Cart Footer */}
        <div className="p-4 border-t space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax (10%)</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-xl font-bold">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={clearCartLocal}
              disabled={cartItems.length === 0}
            >
              Clear Cart
            </Button>
            <Button onClick={handleCheckout} disabled={cartItems.length === 0}>
              <Receipt className="h-4 w-4 mr-2" />
              Checkout
            </Button>
          </div>
        </div>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={isCheckoutOpen} onOpenChange={(open) => { if (!open && !isProcessing) setIsCheckoutOpen(false); }}>
        <DialogContent className="max-w-md" aria-describedby="checkout-dialog-description">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Complete Payment
            </DialogTitle>
          </DialogHeader>

          <fieldset disabled={isProcessing} className="space-y-6">
            {/* Order Summary */}
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span>Items</span>
                <span>{cartItems.reduce((sum, i) => sum + i.quantity, 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-xl font-bold">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-3">
              <p className="font-medium">Payment Method</p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                  className="flex-col h-20 gap-2"
                  onClick={() => setPaymentMethod('cash')}
                >
                  <Wallet className="h-6 w-6" />
                  <span>Cash</span>
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === 'card' ? 'default' : 'outline'}
                  className="flex-col h-20 gap-2"
                  onClick={() => setPaymentMethod('card')}
                >
                  <CreditCard className="h-6 w-6" />
                  <span>Card</span>
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === 'qr' ? 'default' : 'outline'}
                  className="flex-col h-20 gap-2"
                  onClick={() => setPaymentMethod('qr')}
                >
                  <Smartphone className="h-6 w-6" />
                  <span>QR Pay</span>
                </Button>
              </div>
            </div>

            {/* Cash Input */}
            {paymentMethod === 'cash' && (
              <div className="space-y-3">
                <p className="font-medium">Cash Received</p>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  className="text-2xl h-14 text-center font-bold"
                />
                <div className="grid grid-cols-4 gap-2">
                  {(Array.isArray(quickCashAmounts) ? quickCashAmounts : []).map((amount) => (
                    <Button
                      key={amount}
                      variant="outline"
                      size="sm"
                      onClick={() => setCashReceived(amount.toString())}
                    >
                      ${amount}
                    </Button>
                  ))}
                </div>
                {change > 0 && (
                  <div className="p-4 bg-success/10 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">Change Due</p>
                    <p className="text-2xl font-bold text-success">{formatCurrency(change)}</p>
                  </div>
                )}
              </div>
            )}
          </fieldset>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsCheckoutOpen(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button
              onClick={completeTransaction}
              disabled={
                isProcessing ||
                (paymentMethod === 'cash' && (!cashReceived || parseFloat(cashReceived) < total))
              }
              className="min-w-32"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : `Pay ${formatCurrency(total)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
