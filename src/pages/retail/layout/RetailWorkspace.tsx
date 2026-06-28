import { useNavigate } from "react-router-dom";
import { useRetail } from "../context/RetailContext";
import {
  BarChart3,
  Store,
  Users,
  Clock,
  Globe,
  Tag,
  Eye,
  MonitorDot,
  FileText,
  Layout,
  Monitor,
  Search,
  AlertCircle,
  ArrowRight,
  BoxSelect,
  ShieldAlert,
  ChevronRight,
  Power,
  Settings,
  ShoppingCart,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/core/security/session";
import { Roles } from "@/core/security/roles";
import { retailService } from "@/core/services/retail/retailService";
import { RetailStore, POSDevice } from "@/core/types/retail/retail";
import { FeedbackAlert } from "@/core/tools/FeedbackAlert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { GenesisGuard } from "../components/GenesisGuard";

const RetailWorkspace = () => {
  const navigate = useNavigate();
  const { activeStore, activeChannel } = useRetail();

  const appSections = [
    {
      title: "Core Governance",
      apps: [
        { id: "mgt-dashboard", title: "Command Center", desc: "Sales & KPIs", icon: BarChart3, route: "/m/retail/management/dashboard", color: "text-primary", bg: "bg-primary/5" },
        { id: "mgt-profile", title: "Store Profile", desc: "Identity & Tax", icon: Store, route: "/m/retail/management/profile", color: "text-primary", bg: "bg-primary/5" },
        { id: "mgt-audit", title: "Audit Ledger", desc: "Transaction logs", icon: ShieldAlert, route: "/m/retail/management/audit", color: "text-destructive", bg: "bg-destructive" },
      ]
    },
    {
      title: "Inventory & Fulfilment",
      apps: [
        { id: "mgt-orders", title: "Fulfillment Hub", desc: "Unified order truth", icon: BoxSelect, route: "/m/retail/management/orders", color: "text-warning", bg: "bg-warning" },
        { id: "mgt-inventory", title: "Inventory ATS", desc: "Stock visibility", icon: Eye, route: "/m/retail/management/inventory", color: "text-success", bg: "bg-success" },
        { id: "mgt-pricing", title: "Pricing Desk", desc: "Maker-checker promos", icon: Tag, route: "/m/retail/management/pricing", color: "text-primary", bg: "bg-primary/5" },
        { id: "mgt-prs", title: "Stock Request", desc: "Purchase requests", icon: ShoppingCart, route: "/m/retail/management/prs?dept=RETAIL", color: "text-warning", bg: "bg-warning" },
        { id: "ops-receiving", title: "Stock Intake", desc: "Goods receiving", icon: MonitorDot, route: "/m/retail/operational/receiving", color: "text-muted-foreground", bg: "bg-secondary/5" },
        { id: "ops-opname", title: "Stock Opname", desc: "Audit & counts", icon: BoxSelect, route: "/m/retail/operational/opname", color: "text-primary", bg: "bg-primary/5" },
      ]
    },
    {
      title: "Workforce & Compliance",
      apps: [
        { id: "mgt-shifts", title: "Shift Control", desc: "Shift gatekeeping", icon: Clock, route: "/m/retail/management/shifts", color: "text-success", bg: "bg-success" },
        { id: "mgt-staff", title: "Staff Roles", desc: "Access enforcement", icon: Users, route: "/m/retail/management/staff", color: "text-primary", bg: "bg-primary" },
        { id: "mgt-schedule", title: "Staff Schedule", desc: "Roster management", icon: FileText, route: "/m/retail/management/schedule", color: "text-primary", bg: "bg-primary/5" },
        { id: "mgt-attendance", title: "Attendance", desc: "Time tracking", icon: Clock, route: "/m/retail/management/attendance", color: "text-success", bg: "bg-success" },
        { id: "mgt-portal", title: "Staff Portal", desc: "Employee self-service", icon: Users, route: "/m/retail/management/portal", color: "text-primary", bg: "bg-primary/5" },
      ]
    },
    {
      title: "Infrastructure & Logs",
      apps: [
        { id: "mgt-devices", title: "Device Registry", desc: "Hardware monitor", icon: MonitorDot, route: "/m/retail/management/devices", color: "text-muted-foreground", bg: "bg-secondary/5" },
        { id: "mgt-infrastructure", title: "Infra Control", desc: "Network & settings", icon: Globe, route: "/m/retail/management/infrastructure", color: "text-primary", bg: "bg-primary/5" },
        { id: "mgt-admin", title: "Administrative", desc: "System settings", icon: Layout, route: "/m/retail/management/admin", color: "text-muted-foreground", bg: "bg-secondary/10" },
        { id: "mgt-logs", title: "System Logs", desc: "Activity history", icon: Search, route: "/m/retail/management/logs?scope=RETAIL", color: "text-muted-foreground", bg: "bg-secondary/5" },
        { id: "mgt-workflow", title: "Workflow Inbox", desc: "Approval tasks", icon: AlertCircle, route: "/m/retail/management/workflow?scope=RETAIL", color: "text-warning", bg: "bg-warning" },
      ]
    },
    {
      title: "Warehouse",
      apps: [
        { id: "wh-hub", title: "Warehouse Hub", desc: "WH operations", icon: BoxSelect, route: "/core/warehouse", color: "text-primary", bg: "bg-primary/5" },
        { id: "wh-hierarchy", title: "Storage Zones", desc: "Location hierarchy", icon: Layout, route: "/core/warehouse/hierarchy", color: "text-primary", bg: "bg-primary/5" },
        { id: "wh-receiving", title: "WH Receiving", desc: "Inbound goods", icon: MonitorDot, route: "/core/warehouse/receiving", color: "text-success", bg: "bg-success" },
        { id: "wh-picking", title: "Picking", desc: "Order pick lists", icon: BoxSelect, route: "/core/warehouse/picking", color: "text-warning", bg: "bg-warning" },
        { id: "wh-packing", title: "Packing", desc: "Pack & ship", icon: BoxSelect, route: "/core/warehouse/packing", color: "text-primary", bg: "bg-primary/5" },
        { id: "wh-analytics", title: "Occupancy", desc: "Trends & capacity", icon: BarChart3, route: "/core/warehouse/analytics", color: "text-muted-foreground", bg: "bg-secondary/5" },
      ]
    },
  ];

  return (
    <GenesisGuard>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* 1. Welcoming Hero */}
        <div className="bg-primary rounded-[2rem] p-8 text-primary-foreground relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-12 opacity-5">
            <Layout className="w-80 h-80" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <Badge className="bg-primary hover:bg-primary px-3 py-1 font-black italic">
                GENESIS_MODE
              </Badge>
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Zenvix Governance Active
              </span>
            </div>
            <h2 className="text-4xl font-black italic tracking-tighter mb-2">
              Welcome to Retail Authority
            </h2>
            <p className="text-muted-foreground max-w-xl font-medium">
              You are currently in the **Management Plane**. From here you can
              govern store policies, monitor staff shifts, and manage
              distribution channels for **
              {activeStore?.name || activeChannel?.name || "Global Context"}**.
            </p>
          </div>
        </div>

        {/* 2. Management App Grid */}
        <div className="space-y-12">
          {appSections.map((section) => (
            <div key={section.title} className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.25em] text-muted-foreground px-4 flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/50 shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
                {section.title}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {section.apps.map((app) => (
                  <Card
                    key={app.id}
                    className="group hover:border-primary hover:shadow-2xl transition-all cursor-pointer bg-card border border-border rounded-[2rem] overflow-hidden backdrop-blur-3xl"
                    onClick={() => navigate(app.route)}
                  >
                    <CardContent className="p-6 space-y-4">
                      <div
                        className={`w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 group-hover:rotate-3 transition-transform`}
                      >
                        <app.icon className="w-7 h-7" />
                      </div>
                      <div>
                        <div className="font-black text-foreground leading-tight uppercase tracking-tighter italic text-sm">
                          {app.title}
                        </div>
                        <div className="text-[10px] leading-tight text-muted-foreground mt-1 font-bold italic truncate">
                          {app.desc}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 3. Operational Quick-Jump */}
        <div className="p-1 border border-border mt-12 bg-card rounded-[2.5rem] shadow-2xl flex items-center justify-between backdrop-blur-3xl">
          <div className="px-8 flex items-center gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Monitor className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-tighter text-foreground italic">
                Looking for the frontline?
              </div>
              <div className="text-[10px] text-muted-foreground font-bold">
                Switch to Operational Plane for POS and Scanners
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            className="h-14 px-8 rounded-2xl border border-primary bg-primary text-primary hover:bg-primary hover:text-white transition-all gap-3"
            onClick={() => navigate("/m/retail/operational/gateway")}
          >
            GO TO OPERATIONAL MODE
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </GenesisGuard>
  );
};

export default RetailWorkspace;
