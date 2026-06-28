// ============================================================
// RETAIL MODULE
// Industry Module: Retail POS
// ============================================================

import type {
  ModuleContract,
  ModulePageDefinition,
  ModuleConfig,
  ModuleConfigValidationResult,
  ReadonlyModuleConfig,
  Permission,
} from "../shared/contract";

// PAGE COMPONENT IMPORTS (MODULE OWNED)
// ============================================================

import RetailWorkspace from "@/pages/retail/layout/RetailWorkspace";

// Management Pages
import StoreDashboard from "@/pages/retail/management/StoreDashboard";
import StoreProfile from "@/pages/retail/management/StoreProfile";
import StaffAssignments from "@/pages/retail/management/StaffAssignments";
import ShiftControl from "@/pages/retail/management/ShiftControl";

import EcommerceConnector from "@/pages/retail/management/EcommerceConnector";
import { EcommerceAnalytics } from "@/pages/retail/management/EcommerceAnalytics";
import { RetailCustomerActivity as RetailCustomerActivityBase } from "@/pages/retail/management/RetailCustomerActivity";
import InfrastructureControl from "@/pages/retail/management/InfrastructureControl";
import OrderFulfillment from "@/pages/retail/management/OrderFulfillment";
import PricingPromoDesk from "@/pages/retail/management/PricingPromoDesk";
import InventoryVisibility from "@/pages/retail/management/InventoryVisibility";
import DeviceControlCenter from "@/pages/retail/management/DeviceControlCenter";
import ComplianceAuditLedger from "@/pages/retail/management/ComplianceAuditLedger";
import InfrastructureMap from "@/pages/retail/management/InfrastructureMap";
import NexusCommand from "@/pages/retail/management/NexusCommand";
import WorkforceComplianceHub from "@/pages/retail/management/WorkforceComplianceHub";

// Operational Pages
import CashierPOS from "@/pages/retail/operational/CashierPOS";
import RefundReturnDesk from "@/pages/retail/operational/RefundReturnDesk";
import StockOpnameScanner from "@/pages/retail/operational/StockOpnameScanner";
import ReceivingTerminal from "@/pages/retail/operational/ReceivingTerminal";
import SelfServiceKiosk from "@/pages/retail/operational/SelfServiceKiosk";
import ShiftCloseTerminal from "@/pages/retail/operational/ShiftCloseTerminal";
import ShiftOpenTerminal from "@/pages/retail/operational/ShiftOpenTerminal";
import CashMovementTerminal from "@/pages/retail/operational/CashMovementTerminal";
import RetailOperationalGateway from "@/pages/retail/operational/OperationalGateway";
import DepartmentScheduleStudio from "@/pages/core/HR/DepartmentScheduleStudio";
import DepartmentAttendanceStudio from "@/pages/core/HR/DepartmentAttendanceStudio";
import { DeptAdmin } from "@/components/shared/DeptAdmin";

// Shared Governance Components
import PurchaseRequestDesk from "@/pages/core/procurement/PurchaseRequestDesk";
import MyPulse from "@/pages/portal/MyPulse";
import LogHub from "@/pages/core/logs/LogHub";
import WorkflowInbox from "@/pages/core/WorkflowInbox";

// Governance Wrappers
const RetailCustomerActivity = () => <RetailCustomerActivityBase />;
const RetailSchedulePage = () => <DepartmentScheduleStudio workspaceDeptId="RETAIL" title="Retail Operations" noShell={true} />;
const RetailAttendancePage = () => <DepartmentAttendanceStudio workspaceDeptId="RETAIL" title="Retail Operations" noShell={true} />;
const RetailAdminPage = () => <DeptAdmin departmentId="RETAIL" departmentName="Retail Operations" noShell={true} />;
const RetailPurchaseRequestPage = () => <PurchaseRequestDesk noShell={true} />;
const RetailMyPulsePage = () => <MyPulse noShell={true} />;
const RetailLogHubPage = () => <LogHub noShell={true} />;
const RetailWorkflowInboxPage = () => <WorkflowInbox noShell={true} />;
const RetailStockOpnamePage = () => <StockOpnameScanner noShell={true} />;
const RetailAuditLedgerPage = () => <ComplianceAuditLedger noShell={true} />;
const RetailComplianceHubPage = () => <WorkforceComplianceHub noShell={true} />;

// ============================================================
// MODULE IDENTITY (LOCKED)
// ============================================================

const MODULE_ID = "retail" as const;
const MODULE_VERSION = "2.0.0" as const;

/**
 * Canonical module route prefix.
 * ALL module pages MUST live under this base.
 */
const BASE_ROUTE = `/m/${MODULE_ID}` as const;

// ============================================================
// CONFIGURATION
// ============================================================

export interface RetailModuleConfig extends ModuleConfig {
  taxRate: number;
  features: {
    barcodeScanning: boolean;
    requireShiftStart: boolean;
  };
}

const DEFAULT_CONFIG: RetailModuleConfig = {
  taxRate: 10,
  features: {
    barcodeScanning: true,
    requireShiftStart: true,
  },
};

// ============================================================
// PERMISSIONS (CANONICAL)
// ============================================================

const PERMISSIONS = {
  RETAIL_ACCESS: { resource: "retail", actions: ["read", "manage"] },
  OPERATIONAL_POS: { resource: "retail_pos", actions: ["manage"] },
} satisfies Record<string, Permission>;

// ============================================================
// PAGE DECLARATIONS (PHASE 3 COMPLIANT)
// ============================================================

const PAGES: ReadonlyArray<ModulePageDefinition> = [
  // Gateway
  {
    id: "workspace",
    moduleId: MODULE_ID,
    title: "Retail Home",
    route: "/m/retail/workspace",
    icon: "Layout",
    menuGroup: "overview",
    requiredPermissions: [PERMISSIONS.RETAIL_ACCESS],
    component: RetailWorkspace,
  },

  // --- MANAGEMENT PLANE ---
  {
    id: "mgt-dashboard",
    moduleId: MODULE_ID,
    title: "Store Dashboard",
    route: "/m/retail/management/dashboard",
    icon: "BarChart3",
    menuGroup: "management",
    requiredPermissions: [PERMISSIONS.RETAIL_ACCESS],
    component: StoreDashboard,
  },
  {
    id: "mgt-profile",
    moduleId: MODULE_ID,
    title: "Store Profile",
    route: "/m/retail/management/profile/*",
    icon: "Store",
    menuGroup: "management",
    requiredPermissions: [PERMISSIONS.RETAIL_ACCESS],
    component: StoreProfile,
  },
  {
    id: "mgt-staff",
    moduleId: MODULE_ID,
    title: "Staff Roles",
    route: "/m/retail/management/staff",
    icon: "Users",
    menuGroup: "management",
    requiredPermissions: [PERMISSIONS.RETAIL_ACCESS],
    component: StaffAssignments,
  },
  {
    id: "mgt-shifts",
    moduleId: MODULE_ID,
    title: "Shift Control",
    route: "/m/retail/management/shifts",
    icon: "Clock",
    menuGroup: "management",
    requiredPermissions: [PERMISSIONS.RETAIL_ACCESS],
    component: ShiftControl,
  },

  {
    id: "mgt-ecommerce",
    moduleId: MODULE_ID,
    title: "Ecommerce Channels",
    route: "/m/retail/management/ecommerce",
    icon: "ShoppingBag",
    menuGroup: "management",
    requiredPermissions: [PERMISSIONS.RETAIL_ACCESS],
    component: EcommerceConnector,
  },
  {
    id: "mgt-ecommerce-analytics",
    moduleId: MODULE_ID,
    title: "E-Commerce Analytics",
    route: "/m/retail/management/ecommerce-analytics",
    icon: "BarChart3",
    menuGroup: "management",
    requiredPermissions: [PERMISSIONS.RETAIL_ACCESS],
    component: EcommerceAnalytics,
  },
  {
    id: "mgt-customers",
    moduleId: MODULE_ID,
    title: "Customer Activity",
    route: "/m/retail/management/customers",
    icon: "Users",
    menuGroup: "management",
    requiredPermissions: [PERMISSIONS.RETAIL_ACCESS],
    component: RetailCustomerActivity,
  },
  {
    id: "mgt-infrastructure",
    moduleId: MODULE_ID,
    title: "Infra Control",
    route: "/m/retail/management/infrastructure",
    icon: "Network",
    menuGroup: "management",
    requiredPermissions: [PERMISSIONS.RETAIL_ACCESS],
    component: InfrastructureControl,
  },
  {
    id: "mgt-orders",
    moduleId: MODULE_ID,
    title: "Fulfillment Hub",
    route: "/m/retail/management/orders",
    icon: "PackageCheck",
    menuGroup: "management",
    requiredPermissions: [PERMISSIONS.RETAIL_ACCESS],
    component: OrderFulfillment,
  },
  {
    id: "mgt-pricing",
    moduleId: MODULE_ID,
    title: "Pricing Desk",
    route: "/m/retail/management/pricing",
    icon: "Tag",
    menuGroup: "management",
    requiredPermissions: [PERMISSIONS.RETAIL_ACCESS],
    component: PricingPromoDesk,
  },
  {
    id: "mgt-inventory",
    moduleId: MODULE_ID,
    title: "Inventory Visibility",
    route: "/m/retail/management/inventory",
    icon: "Eye",
    menuGroup: "management",
    requiredPermissions: [PERMISSIONS.RETAIL_ACCESS],
    component: InventoryVisibility,
  },
  {
    id: "mgt-devices",
    moduleId: MODULE_ID,
    title: "Device Control",
    route: "/m/retail/management/devices",
    icon: "MonitorRemote",
    menuGroup: "management",
    requiredPermissions: [PERMISSIONS.RETAIL_ACCESS],
    component: DeviceControlCenter,
  },
  {
    id: "mgt-audit",
    moduleId: MODULE_ID,
    title: "Audit Ledger",
    route: "/m/retail/management/audit",
    icon: "FileText",
    menuGroup: "management",
    requiredPermissions: [PERMISSIONS.RETAIL_ACCESS],
    component: RetailAuditLedgerPage,
  },
  {
    id: "mgt-schedule",
    moduleId: MODULE_ID,
    title: "Staff Schedule",
    route: "/m/retail/management/schedule",
    icon: "Calendar",
    menuGroup: "management",
    requiredPermissions: [PERMISSIONS.RETAIL_ACCESS],
    component: RetailSchedulePage,
  },
  {
    id: "mgt-attendance",
    moduleId: MODULE_ID,
    title: "Attendance",
    route: "/m/retail/management/attendance",
    icon: "Clock",
    menuGroup: "management",
    requiredPermissions: [PERMISSIONS.RETAIL_ACCESS],
    component: RetailAttendancePage,
  },
  {
    id: "mgt-admin",
    moduleId: MODULE_ID,
    title: "Administrative",
    route: "/m/retail/management/admin",
    icon: "Settings",
    menuGroup: "management",
    requiredPermissions: [PERMISSIONS.RETAIL_ACCESS],
    component: RetailAdminPage,
  },
  {
    id: "mgt-prs",
    moduleId: MODULE_ID,
    title: "Stock Request",
    route: "/m/retail/management/prs",
    icon: "ShoppingCart",
    menuGroup: "management",
    requiredPermissions: [PERMISSIONS.RETAIL_ACCESS],
    component: RetailPurchaseRequestPage,
  },
  {
    id: "mgt-portal",
    moduleId: MODULE_ID,
    title: "Staff Portal",
    route: "/m/retail/management/portal",
    icon: "UserCircle",
    menuGroup: "management",
    requiredPermissions: [PERMISSIONS.RETAIL_ACCESS],
    component: RetailMyPulsePage,
  },
  {
    id: "mgt-logs",
    moduleId: MODULE_ID,
    title: "Log Hub",
    route: "/m/retail/management/logs",
    icon: "History",
    menuGroup: "management",
    requiredPermissions: [PERMISSIONS.RETAIL_ACCESS],
    component: RetailLogHubPage,
  },
  {
    id: "mgt-workflow",
    moduleId: MODULE_ID,
    title: "Workflow Inbox",
    route: "/m/retail/management/workflow",
    icon: "GitBranch",
    menuGroup: "management",
    requiredPermissions: [PERMISSIONS.RETAIL_ACCESS],
    component: RetailWorkflowInboxPage,
  },
  {
    id: "mgt-infra-map",
    moduleId: MODULE_ID,
    title: "Infrastructure Map",
    route: "/m/retail/management/infrastructure-map",
    icon: "Globe",
    menuGroup: "management",
    requiredPermissions: [PERMISSIONS.RETAIL_ACCESS],
    component: InfrastructureMap,
  },
  {
    id: "mgt-nexus-command",
    moduleId: MODULE_ID,
    title: "Nexus Command",
    route: "/m/retail/management/nexus-command",
    icon: "Zap",
    menuGroup: "management",
    requiredPermissions: [PERMISSIONS.RETAIL_ACCESS],
    component: NexusCommand,
  },
  {
    id: "mgt-workforce-compliance",
    moduleId: MODULE_ID,
    title: "Workforce & Compliance",
    route: "/m/retail/management/workforce-compliance",
    icon: "ShieldCheck",
    menuGroup: "management",
    requiredPermissions: [PERMISSIONS.RETAIL_ACCESS],
    component: RetailComplianceHubPage,
  },

  // --- OPERATIONAL PLANE ---
  {
    id: "ops-gateway",
    moduleId: MODULE_ID,
    title: "Operational Terminal",
    route: "/m/retail/operational/gateway",
    icon: "Monitor",
    menuGroup: "operational",
    requiredPermissions: [PERMISSIONS.OPERATIONAL_POS],
    component: RetailOperationalGateway,
  },
  {
    id: "ops-cash-movement",
    moduleId: MODULE_ID,
    title: "Cash Movement",
    route: "/m/retail/operational/cash-movement",
    icon: "Banknote",
    menuGroup: "operational",
    requiredPermissions: [PERMISSIONS.OPERATIONAL_POS],
    component: CashMovementTerminal,
  },
  {
    id: "ops-pos",
    moduleId: MODULE_ID,
    title: "Cashier Terminal",
    route: "/m/retail/operational/pos",
    icon: "ShoppingCart",
    menuGroup: "operational",
    requiredPermissions: [PERMISSIONS.OPERATIONAL_POS],
    component: CashierPOS,
    supportedDeviceTypes: ["desktop", "tablet"],
  },
  {
    id: "ops-refund",
    moduleId: MODULE_ID,
    title: "Refund Desk",
    route: "/m/retail/operational/refund",
    icon: "RotateCcw",
    menuGroup: "operational",
    requiredPermissions: [PERMISSIONS.OPERATIONAL_POS],
    component: RefundReturnDesk,
  },
  {
    id: "ops-opname",
    moduleId: MODULE_ID,
    title: "Stock Opname",
    route: "/m/retail/operational/opname",
    icon: "ScanLine",
    menuGroup: "operational",
    requiredPermissions: [PERMISSIONS.OPERATIONAL_POS],
    component: RetailStockOpnamePage,
    supportedDeviceTypes: ["desktop", "mobile", "tablet"],
  },
  {
    id: "ops-receiving",
    moduleId: MODULE_ID,
    title: "Stock Intake",
    route: "/m/retail/operational/receiving",
    icon: "Truck",
    menuGroup: "operational",
    requiredPermissions: [PERMISSIONS.OPERATIONAL_POS],
    component: ReceivingTerminal,
  },
  {
    id: "ops-kiosk",
    moduleId: MODULE_ID,
    title: "Self-Service Kiosk",
    route: "/m/retail/operational/kiosk",
    icon: "Monitor",
    menuGroup: "operational",
    requiredPermissions: [PERMISSIONS.OPERATIONAL_POS],
    component: SelfServiceKiosk,
    supportedDeviceTypes: ["desktop", "kiosk"],
  },
  {
    id: "ops-shift-open",
    moduleId: MODULE_ID,
    title: "Shift Open",
    route: "/m/retail/operational/shift-open",
    icon: "Power",
    menuGroup: "operational",
    requiredPermissions: [PERMISSIONS.OPERATIONAL_POS],
    component: ShiftOpenTerminal,
    isOperational: true,
  },
  {
    id: "ops-shift-close",
    moduleId: MODULE_ID,
    title: "Shift Close",
    route: "/m/retail/operational/shift-close",
    icon: "Lock",
    menuGroup: "operational",
    requiredPermissions: [PERMISSIONS.OPERATIONAL_POS],
    component: ShiftCloseTerminal,
    isOperational: true,
  },
];

// ============================================================
// CONFIG VALIDATION (STRICT)
// ============================================================

function validateConfig(config: ModuleConfig): ModuleConfigValidationResult {
  const errors: string[] = [];
  const cfg = config as Partial<RetailModuleConfig>;

  if (typeof cfg.taxRate !== "number" || cfg.taxRate < 0) {
    errors.push("taxRate must be a non-negative number");
  }

  if (!cfg.features) {
    errors.push("features configuration is required");
  } else {
    if (typeof cfg.features.barcodeScanning !== "boolean") {
      errors.push("features.barcodeScanning must be a boolean");
    }
    if (typeof cfg.features.requireShiftStart !== "boolean") {
      errors.push("features.requireShiftStart must be a boolean");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================
// MODULE CONTRACT (FINAL)
// ============================================================

export const retailModule: ModuleContract = {
  id: MODULE_ID,
  name: "Retail Operations",
  description: "Retail sales and inventory",
  version: MODULE_VERSION,
  category: "industry",

  requiredCoreServices: ["inventory", "financial", "shift"],

  requiredPermissions: Object.values(PERMISSIONS),

  supportedDeviceTypes: ["desktop", "tablet", "kiosk"],

  getDefaultConfig: () => structuredClone(DEFAULT_CONFIG),

  validateConfig,

  /**
   * Single source of truth for navigation + routing.
   */
  getPages: (_config: ReadonlyModuleConfig) => PAGES,

  async onActivate(tenantId) {
    console.info(`[Retail] Activated for tenant ${tenantId}`);
  },

  async onDeactivate(tenantId) {
    console.info(`[Retail] Deactivated for tenant ${tenantId}`);
  },
};
