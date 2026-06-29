import React from "react";
import {
  ShieldCheck,
  ChevronRight,
  Store,
  Globe,
  PlusCircle,
} from "lucide-react";
import { useRetail } from "../context/RetailContext";
import { useSession } from "@/core/security/session";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const RetailGlobalAdminBar = () => {
  const {
    activeStore,
    activeChannel,
    stores,
    channels,
    setStore,
    setChannel,
    mode,
  } = useRetail();
  const session = useSession();

  return (
    <div className="bg-secondary text-white h-10 px-4 flex items-center justify-between text-[10px] font-black uppercase tracking-widest border-b border-border z-[60]">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-primary">
          <ShieldCheck className="w-3.5 h-3.5" />
          Estela Gea Superadmin control
        </div>
        <Separator orientation="vertical" className="h-4 bg-white/20" />
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Tenant:</span>
          <span className="text-white">{session.tenant_id}</span>
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Active Entity:</span>
          {activeStore ? (
            <Store className="w-3 h-3 text-primary" />
          ) : (
            <Globe className="w-3 h-3 text-cyan-400" />
          )}
          <span className="text-white">
            {activeStore?.name || activeChannel?.name || "Global Scope"}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 hover:bg-muted/10 text-[9px] font-black italic"
              >
                [ Switch ]
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-56 bg-card border-2 border-border shadow-2xl rounded-xl"
            >
              <DropdownMenuLabel className="text-[10px] uppercase font-black italic tracking-widest text-muted-foreground">
                Physical Stores
              </DropdownMenuLabel>
              {(Array.isArray(stores) ? stores : []).map((store) => (
                <DropdownMenuItem
                  key={store.id}
                  className="gap-2 focus:bg-primary/5 cursor-pointer"
                  onClick={() => setStore(store.id)}
                >
                  <Store className="w-4 h-4 text-primary" />
                  <span className="font-bold text-foreground">{store.name}</span>
                  {activeStore?.id === store.id && (
                    <ShieldCheck className="w-3 h-3 ml-auto text-success" />
                  )}
                </DropdownMenuItem>
              ))}
              {stores.length === 0 && (
                <DropdownMenuItem
                  disabled
                  className="text-[10px] text-muted-foreground italic"
                >
                  No stores found
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase font-black italic tracking-widest text-muted-foreground">
                Digital Channels
              </DropdownMenuLabel>
              {(Array.isArray(channels) ? channels : []).map((channel) => (
                <DropdownMenuItem
                  key={channel.id}
                  className="gap-2 focus:bg-cyan-50 cursor-pointer"
                  onClick={() => setChannel(channel.id)}
                >
                  <Globe className="w-4 h-4 text-cyan-500" />
                  <span className="font-bold text-foreground">
                    {channel.name}
                  </span>
                  {activeChannel?.id === channel.id && (
                    <ShieldCheck className="w-3 h-3 ml-auto text-success" />
                  )}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 text-primary focus:bg-primary/5 font-black italic uppercase text-[10px] tracking-tighter"
                onClick={() =>
                  (window.location.href = "/m/retail/management/profile")
                }
              >
                <PlusCircle className="w-4 h-4" />
                Provision New Branch
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Mode:</span>
          <span
            className={
              mode === "management" ? "text-primary" : "text-primary"
            }
          >
            {mode} plane
          </span>
        </div>
        <Separator orientation="vertical" className="h-4 bg-white/20" />
        <div className="flex items-center gap-2 bg-secondary/40 px-2 py-0.5 rounded-md border border-border">
          <Globe className="w-3 h-3 text-success" />
          Authority: Operational
        </div>
      </div>
    </div>
  );
};
