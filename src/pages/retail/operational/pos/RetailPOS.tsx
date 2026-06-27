import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Search, Monitor, Package, Store } from "lucide-react";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { FeedbackAlert } from "@/core/tools/FeedbackAlert";
import { useSession } from "@/core/security/session";
import { retailService } from "@/core/services/retail/retailService";
import type {
  RetailOrder,
  RetailStore,
  POSDevice,
  BranchDevice,
} from "@/core/types/retail/retail";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Roles } from "@/core/security/roles";

const INVENTORY = [
  {
    id: "item-001",
    name: "Premium Coffee Beans",
    price: 225000,
    category: "Coffee",
  },
  { id: "item-002", name: "Ceramic Mug", price: 187500, category: "Merchandise" },
  { id: "item-003", name: "Tote Bag", price: 120000, category: "Merchandise" },
  { id: "item-004", name: "Gift Card Rp 750.000", price: 750000, category: "Services" },
  { id: "item-005", name: "Dark Roast Blend", price: 270000, category: "Coffee" },
  {
    id: "item-006",
    name: "Travel Tumbler",
    price: 360000,
    category: "Merchandise",
  },
];

export default function RetailPOS() {
  const session = useSession();
  const [activeStore, setActiveStore] = useState<RetailStore | null>(null);
  const [stores, setStores] = useState<RetailStore[]>([]);
  const [devices, setDevices] = useState<BranchDevice[]>([]); // Changed type to BranchDevice[]
  const [activeDeviceId, setActiveDeviceId] = useState("");
  const [cart, setCart] = useState<
    { itemId: string; name: string; price: number; quantity: number }[]
  >([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const categories = [
    "All",
    ...Array.from(new Set((Array.isArray(INVENTORY) ? INVENTORY : []).map((i) => i.category))),
  ];

  const filteredInventory = useMemo(() => {
    return (Array.isArray(INVENTORY) ? INVENTORY : []).filter((item) => {
      const matchesSearch = item.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesCategory =
        activeCategory === "All" || item.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory]);

  const handleStoreChange = useCallback(
    async (storeId: string) => {
      if (!session.tenant_id) return;
      try {
        const selected = await retailService.getStore(
          session.tenant_id,
          storeId,
          session,
        );
        if (selected) {
          await retailService.validateAccess(
            session.tenant_id,
            session.user_id!,
            selected.id,
            session,
          );
          setActiveStore(selected);
          const deviceList = await retailService.listDevices(
            session.tenant_id,
            session,
            selected.id,
          );
          setDevices(deviceList);
          if (deviceList.length > 0) setActiveDeviceId(deviceList[0].id);
          setAccessError(null);
        }
      } catch (err: unknown) {
        setActiveStore(null);
        setAccessError(
          err instanceof Error ? err.message : "Access validation failed",
        );
      }
    },
    [session],
  ); // Added session to dependency array

  useEffect(() => {
    const initPOS = async () => {
      if (!session.tenant_id) return;
      try {
        const storeList = await retailService.listStores(
          session.tenant_id,
          session,
        );
        setStores(storeList);
        if (storeList.length > 0) {
          await handleStoreChange(storeList[0].id);
        }
      } catch (err) {
        console.error("POS Failed to load", err);
      }
    };
    initPOS();
  }, [session.tenant_id, session, handleStoreChange]); // Added handleStoreChange to dependency array

  const addToCart = (item: (typeof INVENTORY)[0]) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.itemId === item.id);
      if (existing) {
        return (Array.isArray(prev) ? prev : []).map((i) =>
          i.itemId === item.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        { itemId: item.id, name: item.name, price: item.price, quantity: 1 },
      ];
    });
  };

  const [idempotencyKey, setIdempotencyKey] = useState<string>(
    window.crypto.randomUUID?.() || Math.random().toString(36).substring(2),
  );

  const processCheckout = async () => {
    if (!activeStore || !session.tenant_id) return;
    try {
      // Atomic Backend Checkout with Idempotency
      const order = await retailService.checkout(
        session.tenant_id,
        session,
        {
          store_id: activeStore.id,
          terminal_id: activeDeviceId || "terminal-pos",
          items: (Array.isArray(cart) ? cart : []).map((i) => ({
            product_id: i.itemId,
            name: i.name,
            quantity: i.quantity,
            unit_price: i.price,
          })),
          payment_method: "card",
          payment_received: total,
          grand_total: total,
        },
        idempotencyKey,
      );

      setStatusMessage(
        `Order #${(order?.id || "").slice(-6).toUpperCase()} processed successfully!`,
      );
      setCart([]);
      setIdempotencyKey(
        window.crypto.randomUUID?.() || Math.random().toString(36).substring(2),
      );
    } catch (err: unknown) {
      console.error("Checkout Error:", err);
      setAccessError(err instanceof Error ? err.message : "Checkout failed");
    }
  };

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const tax = cartTotal * 0.1;
  const total = cartTotal + tax;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-4 md:p-6">
      <FeedbackAlert
        message={statusMessage}
        error={accessError}
        onClear={() => {
          setStatusMessage(null);
          setAccessError(null);
        }}
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <PageHeader
          title="POS Terminal"
          subtitle={
            activeStore
              ? `${activeStore.name} (${activeStore.code})`
              : "Select Store"
          }
        />
        <div className="flex items-center gap-3">
          {(session.role === Roles.SUPERADMIN ||
            session.role === Roles.OWNER) && (
            <Select onValueChange={handleStoreChange} value={activeStore?.id}>
              <SelectTrigger className="w-[180px] h-9">
                <Store className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Store" />
              </SelectTrigger>
              <SelectContent>
                {(Array.isArray(stores) ? stores : []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select onValueChange={setActiveDeviceId} value={activeDeviceId}>
            <SelectTrigger className="w-[180px] h-9">
              <Monitor className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Device" />
            </SelectTrigger>
            <SelectContent>
              {(Array.isArray(devices) ? devices : []).map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 space-y-4">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search catalog..."
                className="pl-10 h-11"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Tabs value={activeCategory} onValueChange={setActiveCategory}>
              <TabsList className="h-11">
                {(Array.isArray(categories) ? categories : []).map((cat) => (
                  <TabsTrigger key={cat} value={cat}>
                    {cat}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <WorkspacePanel
            title="Product Catalog"
            description={`Showing ${filteredInventory.length} items`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-2">
              {(Array.isArray(filteredInventory) ? filteredInventory : []).map((item) => (
                <Card
                  key={item.id}
                  className="cursor-pointer hover:border-primary hover:shadow-md transition-all group overflow-hidden"
                  onClick={() => addToCart(item)}
                >
                  <div className="h-24 bg-secondary/10 flex items-center justify-center text-muted-foreground/60 group-hover:bg-primary/5">
                    <Package className="w-8 h-8" />
                  </div>
                  <CardHeader className="p-4">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-sm line-clamp-1">
                        {item.name}
                      </CardTitle>
                      <Badge variant="secondary" className="text-[9px]">
                        {item.category}
                      </Badge>
                    </div>
                    <CardDescription className="font-bold text-foreground">
                      ${item.price.toFixed(2)}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </WorkspacePanel>
        </div>

        <div className="xl:col-span-4">
          <Card className="h-full flex flex-col border-none shadow-lg bg-secondary/5 sticky top-6">
            <CardHeader className="border-b border-border bg-card rounded-t-lg">
              <CardTitle className="text-xl">Active Cart</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-6 bg-card">
              <div className="flex-1 space-y-4 overflow-y-auto max-h-[500px] mb-6">
                {cart.length === 0 ? (
                  <p className="text-center text-muted-foreground italic py-12">
                    Empty Cart
                  </p>
                ) : (
                  (Array.isArray(cart) ? cart : []).map((item, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{item.quantity}x</Badge>
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      <span className="text-sm font-semibold">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t pt-6 space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-extrabold text-2xl pt-2">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                <Button
                  className="w-full mt-6 bg-primary"
                  size="lg"
                  disabled={cart.length === 0}
                  onClick={processCheckout}
                >
                  Complete Payment
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
