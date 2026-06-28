import React from "react";
import { useRetail } from "../context/RetailContext";
import {
  Building2,
  Store,
  Globe,
  ShieldAlert,
  ArrowRight,
  PlusCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { RegisterStoreDialog } from "@/pages/retail/management/modals/RegisterStoreDialog";

export const GenesisGuard: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isConfigured, isLoading, refreshState } = useRetail();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground font-bold italic animate-pulse uppercase tracking-widest text-xs">
          Synchronizing Zenvix State...
        </p>
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center space-y-4">
          <Badge className="bg-warning hover:bg-warning px-4 py-1 font-black italic tracking-widest">
            CORE_REQUIREMENT_MISSING
          </Badge>
          <h1 className="text-5xl font-black italic tracking-tighter text-foreground leading-none">
            WORKSPACE GENESIS
            <br />
            REQUIRED
          </h1>
          <p className="text-muted-foreground font-medium max-w-lg mx-auto italic">
            A Retail Workspace cannot exist in a vacuum. You must establish at
            least one Physical Branch or E-commerce Channel to activate
            governance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-2 border-border hover:border-primary transition-all group overflow-hidden bg-card rounded-[2rem] shadow-xl">
            <CardHeader className="p-8">
              <div className="w-16 h-16 bg-primary/5 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <Store className="w-8 h-8" />
              </div>
              <CardTitle className="text-2xl font-black italic tracking-tighter mt-4">
                PHYSICAL BRANCH
              </CardTitle>
              <CardDescription className="font-bold italic text-xs uppercase tracking-widest text-muted-foreground">
                Brick & Mortar Establishment
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-6">
              <p className="text-muted-foreground text-sm font-medium italic">
                Connect a retail warehouse or storefront. This activates Shift
                Control, POS Registry, and Local Inventory ATS.
              </p>
              <RegisterStoreDialog
                onSuccess={async (store) => {
                  try {
                    await refreshState();
                    navigate("/m/retail/management/profile");
                  } catch (e) {
                    console.error("Failed to refresh state", e);
                  }
                }}
                trigger={
                  <Button className="w-full h-14 rounded-2xl bg-secondary hover:bg-primary font-black italic tracking-widest gap-2">
                    ESTABLISH BRANCH
                    <PlusCircle className="w-5 h-5" />
                  </Button>
                }
              />
            </CardContent>
          </Card>

          <Card className="border-2 border-border hover:border-cyan-500 transition-all group overflow-hidden bg-card rounded-[2rem] shadow-xl">
            <CardHeader className="p-8">
              <div className="w-16 h-16 bg-cyan-50 rounded-2xl flex items-center justify-center text-cyan-600 group-hover:scale-110 transition-transform">
                <Globe className="w-8 h-8" />
              </div>
              <CardTitle className="text-2xl font-black italic tracking-tighter mt-4">
                COMMERCE CHANNEL
              </CardTitle>
              <CardDescription className="font-bold italic text-xs uppercase tracking-widest text-muted-foreground">
                Headless / Marketplace Sync
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-6">
              <p className="text-muted-foreground text-sm font-medium italic">
                Link a Shopify, WooCommerce, or Custom Headless instance.
                Activates Fulfillment Hub and API Key rotation.
              </p>
              <Button
                onClick={() => navigate("/m/retail/management/ecommerce")}
                variant="outline"
                className="w-full h-14 rounded-2xl border-2 border-border hover:border-cyan-500 hover:text-cyan-600 font-black italic tracking-widest gap-2"
              >
                CONNECT CHANNEL
                <ArrowRight className="w-5 h-5" />
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <ShieldAlert className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] italic">
            Governance Protocol 15.0 - Strict Context Enforcement
          </span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
