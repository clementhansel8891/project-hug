import * as React from "react";
import { 
  BarChart3, 
  Store, 
  Users, 
  Clock, 
  Globe, 
  PackageCheck, 
  Tag, 
  Eye, 
  Layout, 
  UserCircle, 
  ShoppingCart, 
  ArrowDownLeft, 
  Archive, 
  History, 
  ShieldCheck, 
  GitBranch, 
  Cpu, 
  Briefcase, 
  Settings,
  Activity,
  Warehouse,
  Layers,
  PackageOpen,
  PackageCheck as PackingIcon,
  TrendingUp,
  ClipboardCheck,
  Globe2,
  BarChart2,
  UserCheck,
} from "lucide-react";
import { useRetail } from "../context/RetailContext";
import { RetailModeSwitchControl } from "../components/RetailModeSwitchControl";
import { RetailContextSwitcher } from "../components/RetailContextSwitcher";
import DepartmentWorkspaceLayout, { MenuSection } from "@/components/layouts/DepartmentWorkspaceLayout";

const SECTIONS: MenuSection[] = [
  {
    title: "GOVERNANCE",
    items: [
      { label: "Retail Home", to: "/m/retail/workspace", icon: Layout },
      { label: "Command Center", to: "/m/retail/management/dashboard", icon: BarChart3 },
      { label: "Store Profile", to: "/m/retail/management/profile", icon: Store },
      { label: "Audit Ledger", to: "/m/retail/management/audit", icon: ShieldCheck },
    ],
  },
  {
    title: "FULFILMENT",
    items: [
      { label: "Fulfillment Hub", to: "/m/retail/management/orders", icon: PackageCheck },
      { label: "Inventory Visibility", to: "/m/retail/management/inventory", icon: Eye },
      { label: "Pricing Desk", to: "/m/retail/management/pricing", icon: Tag },
      { label: "Stock Request", to: "/m/retail/management/prs?dept=RETAIL", icon: ShoppingCart },
      { label: "Stock Intake", to: "/m/retail/operational/receiving", icon: ArrowDownLeft },
      { label: "Stock Opname", to: "/m/retail/operational/opname", icon: Archive },
    ],
  },
  {
    title: "E-COMMERCE",
    items: [
      { label: "Commerce Channels", to: "/m/retail/management/ecommerce", icon: Globe2 },
      { label: "E-Commerce Analytics", to: "/m/retail/management/ecommerce-analytics", icon: BarChart2 },
      { label: "Customer Activity", to: "/m/retail/management/customers", icon: UserCheck },
    ],
  },
  {
    title: "WAREHOUSE",
    items: [
      { label: "Warehouse Hub", to: "/core/warehouse", icon: Warehouse },
      { label: "Storage Hierarchy", to: "/core/warehouse/hierarchy", icon: Layers },
      { label: "WH Receiving", to: "/core/warehouse/receiving", icon: PackageOpen },
      { label: "Picking", to: "/core/warehouse/picking", icon: PackageCheck },
      { label: "Packing", to: "/core/warehouse/packing", icon: PackingIcon },
      { label: "Occupancy Trends", to: "/core/warehouse/analytics", icon: TrendingUp },
      { label: "WH Audit", to: "/core/warehouse/audit", icon: ClipboardCheck },
    ],
  },
  {
    title: "WORKFORCE",
    items: [
      { label: "Shift Control", to: "/m/retail/management/shifts", icon: Clock },
      { label: "Staff Assignments", to: "/m/retail/management/staff", icon: Users },
      { label: "Staff Schedule", to: "/m/retail/management/schedule", icon: Briefcase },
      { label: "Attendance Tracker", to: "/m/retail/management/attendance", icon: Clock },
      { label: "Staff Portal", to: "/m/retail/management/portal", icon: UserCircle },
    ],
  },
  {
    title: "INFRASTRUCTURE",
    items: [
      { label: "Device Control", to: "/m/retail/management/devices", icon: Cpu },
      { label: "Infra Control", to: "/m/retail/management/infrastructure", icon: Globe },
      { label: "Administrative", to: "/m/retail/management/admin", icon: Settings },
      { label: "System Logs", to: "/m/retail/management/logs?scope=RETAIL", icon: History },
      { label: "Workflow Inbox", to: "/m/retail/management/workflow?scope=RETAIL", icon: GitBranch },
    ],
  },
];

const ROUTE_LABELS: Record<string, string> = {
  "workspace": "Retail Home",
  "dashboard": "Command Center",
  "profile": "Store Profile",
  "audit": "Audit Ledger",
  "orders": "Fulfillment Hub",
  "inventory": "Inventory Visibility",
  "pricing": "Pricing Desk",
  "prs": "Stock Request",
  "receiving": "Stock Intake",
  "opname": "Stock Opname",
  "shifts": "Shift Control",
  "staff": "Staff Assignments",
  "schedule": "Staff Schedule",
  "attendance": "Attendance Tracker",
  "portal": "Staff Portal",
  "devices": "Device Control",
  "infrastructure": "Infra Control",
  "admin": "Administrative",
  "logs": "System Logs",
  "workflow": "Workflow Inbox",
  "warehouse": "Warehouse Hub",
  "hierarchy": "Storage Hierarchy",
  "picking": "Picking",
  "packing": "Packing",
  "analytics": "Occupancy Trends",
};

export const RetailManagementShell: React.FC<{ children: React.ReactNode }> = () => {
  return (
    <DepartmentWorkspaceLayout
      title="Retail Plane"
      subtitle="Enterprise-grade multi-store governance and organizational control."
      headerIcon={Store}
      accentColor="indigo"
      engineName="RETAIL_MGMT"
      pulseLabel="Retail Pulse"
      pulseIcon={Activity}
      sections={SECTIONS}
      routeLabels={ROUTE_LABELS}
      basePath="/m/retail"
      headerActions={
        <div className="flex items-center gap-4 mr-4">
          <RetailContextSwitcher />
          <div className="h-6 w-px bg-muted dark:bg-muted" />
          <RetailModeSwitchControl />
        </div>
      }
    />
  );
};


