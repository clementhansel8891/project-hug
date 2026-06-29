import React from "react";
import {
  ShoppingCart,
  RotateCcw,
  ScanLine,
  Truck,
  Monitor,
  Lock,
  X,
  Banknote,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRetail } from "../context/RetailContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RetailModeSwitchControl } from "./RetailModeSwitchControl";

interface LauncherApp {
  id: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  route: string;
  color: string;
  bg: string;
}

const APPS: LauncherApp[] = [
  {
    id: "ops-pos",
    title: "POS Terminal",
    desc: "Sales Execution",
    icon: ShoppingCart,
    route: "/m/retail/operational/pos",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    id: "ops-refund",
    title: "Refund Desk",
    desc: "Post-Sale Disputes",
    icon: RotateCcw,
    route: "/m/retail/operational/refund",
    color: "text-destructive",
    bg: "bg-destructive",
  },
  {
    id: "ops-cash-movement",
    title: "Cash Movement",
    desc: "Petty Cash & Out",
    icon: Banknote,
    route: "/m/retail/operational/cash-movement",
    color: "text-warning",
    bg: "bg-warning",
  },
  {
    id: "ops-opname",
    title: "Stock Opname",
    desc: "Inventory Audit",
    icon: ScanLine,
    route: "/m/retail/operational/opname",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    id: "ops-receiving",
    title: "Stock Intake",
    desc: "Good Receiving",
    icon: Truck,
    route: "/m/retail/operational/receiving",
    color: "text-warning",
    bg: "bg-warning",
  },
  {
    id: "ops-kiosk",
    title: "Self-Service",
    desc: "Guest Checkout",
    icon: Monitor,
    route: "/m/retail/operational/kiosk",
    color: "text-primary",
    bg: "bg-primary",
  },
  {
    id: "ops-shift-close",
    title: "Shift Close",
    desc: "EndOfDay Reconciliation",
    icon: Lock,
    route: "/m/retail/operational/shift-close",
    color: "text-muted-foreground",
    bg: "bg-muted/40",
  },
];

export const OperationalLauncherOverlay: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { activeShift } = useRetail();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl animate-in fade-in zoom-in duration-200 flex flex-col p-12">
      <div className="flex justify-between items-center mb-12">
        <div>
          <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">
            Estela Gea App Launcher
          </h2>
          <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs mt-2">
            Operational Plane • Shift: {activeShift?.id || "NO_ACTIVE_SHIFT"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-muted/10 w-16 h-16 rounded-2xl"
          onClick={onClose}
        >
          <X className="w-8 h-8" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto w-full flex-1 items-center overflow-auto">
        {(Array.isArray(APPS) ? APPS : []).map((app) => (
          <Card
            key={app.id}
            className="group hover:scale-105 active:scale-95 transition-all cursor-pointer bg-secondary border-border hover:border-primary hover:shadow-[0_0_40px_rgba(59,130,246,0.2)] overflow-hidden h-40 flex items-center"
            onClick={() => {
              navigate(app.route);
              onClose();
            }}
          >
            <CardContent className="p-8 flex items-center gap-6 w-full">
              <div
                className={`w-20 h-20 ${app.bg} rounded-3xl flex items-center justify-center ${app.color} group-hover:rotate-6 transition-transform`}
              >
                <app.icon className="w-10 h-10" />
              </div>
              <div>
                <div className="font-black text-white text-2xl uppercase tracking-tighter italic group-hover:text-primary transition-colors">
                  {app.title}
                </div>
                <div className="text-sm text-muted-foreground font-bold uppercase tracking-widest mt-1">
                  {app.desc}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-12 text-center flex-shrink-0 space-y-4">
        <div className="flex justify-center">
          <RetailModeSwitchControl />
        </div>
        <p className="text-muted-foreground font-black italic tracking-widest text-[10px] uppercase">
          Device Awareness Enforced • Secure Execution Environment
        </p>
      </div>
    </div>
  );
};
