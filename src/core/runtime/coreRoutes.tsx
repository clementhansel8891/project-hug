// ============================================================================
// CORE ROUTE BUILDER (PHASE 3)
// ============================================================================
//
// Purpose:
// - Build canonical Core routes from CorePageResolver
// - Core pages are always active
// - No licensing, no modules, no tenant conditions
//
// Core is administrative backbone.
//
// ============================================================================

import { Navigate, Route } from "react-router-dom";

import { resolveCorePages } from "./corePageResolver";
import ProtectedRoute from "@/core/security/ProtectedRoute";
import GrowthTrajectoryPage from "@/pages/core/GrowthTrajectory";
import RiskMatrixPage from "@/pages/core/RiskMatrix";
import DataArchivesPage from "@/pages/core/DataArchives";
import HRWorkspaceLayout from "@/pages/core/HR/HRWorkspaceLayout";
import PulseDesk from "@/pages/core/HR/PulseDesk";
import RosterGrid from "@/pages/core/HR/RosterGrid";
import PeopleCore from "@/pages/core/HR/PeopleCore";
import OrgMap from "@/pages/core/HR/OrgMap";
import VaultSpace from "@/pages/core/HR/VaultSpace";
import FlowGate from "@/pages/core/HR/FlowGate";
import TalentFlow from "@/pages/core/HR/TalentFlow";
import SkillTrack from "@/pages/core/HR/SkillTrack";
import GrowthCycle from "@/pages/core/HR/GrowthCycle";
import PayCycleStudio from "@/pages/core/HR/PayCycleStudio";
import SchedulingStudio from "@/pages/core/HR/SchedulingStudio";
import DepartmentScheduleStudio from "@/pages/core/HR/DepartmentScheduleStudio";
import LexBoard from "@/pages/core/HR/LexBoard";
import InsightLayer from "@/pages/core/HR/InsightLayer";
import CaseDesk from "@/pages/core/HR/Cases/CaseDesk";
import CaseDetail from "@/pages/core/HR/Cases/CaseDetail";
import FinanceWorkspaceLayout from "@/pages/core/finance/FinanceWorkspaceLayout";
import MoneyDesk from "@/pages/core/finance/MoneyDesk";
import TreasuryMap from "@/pages/core/finance/TreasuryMap";
import LedgerCore from "@/pages/core/finance/LedgerCore";
import PayFlow from "@/pages/core/finance/PayFlow";
import ReceivableDesk from "@/pages/core/finance/ReceivableDesk";
import PayableDesk from "@/pages/core/finance/PayableDesk";
import ClosePeriodStudio from "@/pages/core/finance/ClosePeriodStudio";
import AuditVault from "@/pages/core/finance/AuditVault";
import FinanceInsights from "@/pages/core/finance/FinanceInsights";
import InvoiceCapture from "@/pages/core/finance/InvoiceCapture";
import FinanceDocs from "@/pages/core/finance/FinanceDocs";
import Assets from "@/pages/core/finance/Assets";
import PolicyManager from "@/pages/core/finance/PolicyManager";
import JVDesk from "@/pages/core/finance/JVDesk";
import PayslipStudio from "@/pages/core/finance/PayslipStudio";
import { CFODashboard } from "@/pages/core/finance/CFODashboard";
import { CFOProvider } from "@/core/finance/CFOContext";
import PaymentWorkspaceLayout from "@/pages/core/payment/PaymentWorkspaceLayout";
import PaymentDashboard from "@/pages/core/payment/PaymentDashboard";
import PaymentExecutionHub from "@/pages/core/payment/PaymentExecutionHub";
import ProviderRoutingDesk from "@/pages/core/payment/ProviderRoutingDesk";
import DeviceRoutingDesk from "@/pages/core/payment/DeviceRoutingDesk";
import RefundDesk from "@/pages/core/payment/RefundDesk";
import DisputeCenter from "@/pages/core/payment/DisputeCenter";
import PaymentAuditVault from "@/pages/core/payment/PaymentAuditVault";
import ProcurementWorkspaceLayout from "@/pages/core/procurement/ProcurementWorkspaceLayout";
import SupplierDesk from "@/pages/core/procurement/SupplierDesk";
import ContractDesk from "@/pages/core/procurement/ContractDesk";
import PurchaseRequestDesk from "@/pages/core/procurement/PurchaseRequestDesk";
import PoReleaseDesk from "@/pages/core/procurement/PoReleaseDesk";
import SupplierPortalDesk from "@/pages/core/procurement/SupplierPortalDesk";
import ProcurementRiskCenter from "@/pages/core/procurement/ProcurementRiskCenter";
import ProcurementInsights from "@/pages/core/procurement/ProcurementInsights";
import InventoryWorkspaceLayout from "@/pages/core/inventory/InventoryWorkspaceLayout";
import InventoryDashboard from "@/pages/core/inventory/InventoryDashboard";
import InventoryStockHub from "@/pages/core/inventory/InventoryStockHub";
import InventoryReceiving from "@/pages/core/inventory/InventoryReceiving";
import InventoryAdjustments from "@/pages/core/inventory/InventoryAdjustments";
import InventoryAuditLog from "@/pages/core/inventory/InventoryAuditLog";
import InventoryInsights from "@/pages/core/inventory/InventoryInsights";
import WarehouseWorkspaceLayout from "@/pages/core/warehouse/WarehouseWorkspaceLayout";
import WarehouseManagement from "@/pages/core/warehouse/WarehouseManagement";
import StorageHierarchy from "@/pages/core/warehouse/StorageHierarchy";
import WarehouseReceiving from "@/pages/core/warehouse/WarehouseReceiving";
import WarehousePicking from "@/pages/core/warehouse/WarehousePicking";
import WarehousePacking from "@/pages/core/warehouse/WarehousePacking";
import OccupancyTrends from "@/pages/core/warehouse/OccupancyTrends";
import WarehouseAudit from "@/pages/core/warehouse/WarehouseAudit";
import IotEventFeed from "@/pages/core/inventory/IotEventFeed";
import TransferDesk from "@/pages/core/inventory/TransferDesk";
import InventoryStockOpname from "@/pages/core/inventory/InventoryStockOpname";
import ITWorkspaceLayout from "@/pages/core/it/ITWorkspaceLayout";
import ITDashboard from "@/pages/core/it/ITDashboard";
import SystemHealth from "@/pages/core/it/SystemHealth";
import AccountDesk from "@/pages/core/it/AccountDesk";
import DeviceDesk from "@/pages/core/it/DeviceDesk";
import SalesWorkspaceLayout from "@/pages/core/sales/SalesWorkspaceLayout";
import SalesOverview from "@/pages/core/sales/SalesOverview";
import SalesDashboard from "@/pages/core/sales/SalesDashboard";
import LeadDesk from "@/pages/core/sales/LeadDesk";
import PipelineBoard from "@/pages/core/sales/PipelineBoard";
import OpportunityDesk from "@/pages/core/sales/OpportunityDesk";
import QuoteDesk from "@/pages/core/sales/QuoteDesk";
import TimelineDesk from "@/pages/core/sales/TimelineDesk";
import SalesOrderDesk from "@/pages/core/sales/SalesOrderDesk";
import ManagerDesk from "@/pages/core/sales/ManagerDesk";
import ForecastDesk from "@/pages/core/sales/ForecastDesk";
import SalesAuditLog from "@/pages/core/sales/SalesAuditLog";
import IncentiveDesk from "@/pages/core/sales/Incentives/IncentiveDesk";
import MarketingWorkspaceLayout from "@/pages/core/marketing/MarketingWorkspaceLayout";
import CampaignDesk from "@/pages/core/marketing/CampaignDesk";
import ExecutionDesk from "@/pages/core/marketing/ExecutionDesk";
import MarketingAnalytics from "@/pages/core/marketing/MarketingAnalytics";
import MarketingDashboard from "@/pages/core/marketing/MarketingDashboard";
import LeadCaptureDesk from "@/pages/core/marketing/LeadCaptureDesk";
import NurtureStudio from "@/pages/core/marketing/NurtureStudio";
import ConnectedAccountsDesk from "@/pages/core/marketing/ConnectedAccountsDesk";
import MarketingAlerts from "@/pages/core/marketing/MarketingAlerts";
import MarketingAuditLog from "@/pages/core/marketing/MarketingAuditLog";
import Customer360Desk from "@/pages/core/marketing/Customer360Desk";
import AppointmentDesk from "@/pages/core/marketing/AppointmentDesk";
import FunnelBuilderDesk from "@/pages/core/marketing/FunnelBuilderDesk";
import OmnichannelInbox from "@/pages/core/marketing/OmnichannelInbox";
import CreativeLibrary from "@/pages/core/marketing/CreativeLibrary";
import Customer360 from "@/pages/core/marketing/Customer360";
import StrategyControlDesk from "@/pages/core/marketing/StrategyControlDesk";
import ComplianceCommand from "@/pages/core/compliance/ComplianceCommand";
import LogisticsControlCenter from "@/pages/core/logistics/LogisticsControlCenter";
import FinancialOperationsDesk from "@/pages/core/finance/FinancialOperationsDesk";
import SalesIntelligenceEngine from "@/pages/core/sales/SalesIntelligenceEngine";
import AutomationLab from "@/pages/core/marketing/AutomationLab";
import WhiteLabelSettings from "@/pages/core/settings/WhiteLabelSettings";
import TopologyMap from "@/pages/core/it/TopologyMap";
import RoleGovernance from "@/pages/core/it/RoleGovernance";
import TechShop from "@/pages/core/it/TechShop";
import AdminWorkspaceLayout from "@/pages/core/adminWorkspace/AdminWorkspaceLayout";
import RequestDesk from "@/pages/core/adminWorkspace/RequestDesk";
import RequestAssign from "@/pages/core/adminWorkspace/RequestAssign";
import RequestTrack from "@/pages/core/adminWorkspace/RequestTrack";
import WorkflowInbox from "@/pages/core/WorkflowInbox";
import ToolsHome from "@/pages/core/tools/ToolsHome";
import DocumentTool from "@/pages/core/tools/DocumentTool";
import SpreadsheetTool from "@/pages/core/tools/SpreadsheetTool";
import PresentationTool from "@/pages/core/tools/PresentationTool";
import CalculatorTool from "@/pages/core/tools/CalculatorTool";
import ExportTool from "@/pages/core/tools/ExportTool";
import Explorer from "@/pages/core/tools/Explorer";
import CoreSettings from "@/pages/core/Settings";
import AuditHub from "@/pages/core/audit/AuditHub";
import LogHub from "@/pages/core/logs/LogHub";
import BulletinHub from "@/pages/core/comms/BulletinHub";
import MailHub from "@/pages/core/comms/MailHub";
import ChatHub from "@/pages/core/comms/ChatHub";
import MyPulse from "@/pages/portal/MyPulse";
import { DeptAdmin } from "@/components/shared/DeptAdmin";
import DepartmentAttendanceStudio from "@/pages/core/HR/DepartmentAttendanceStudio";

/**
 * Build Core Routes.
 *
 * RULES:
 * - Always exists
 * - Always accessible (permissions handled elsewhere)
 * - Derived from resolver only
 */
export function buildCoreRoutes(): JSX.Element[] {
  const pages = resolveCorePages();
  const defaultPage = pages.find((page) => page.id === "dashboard") ?? pages[0];
  const defaultPath = defaultPage?.route.replace("/core/", "") ?? "";

  const routes = (Array.isArray(pages) ? pages : []).map((page) => {
    const Component = page.component;
    return (
      <Route
        key={page.id}
        path={page.route.replace("/core/", "")}
        element={<Component />}
      />
    );
  });

  if (!defaultPath) {
    return routes;
  }

  return [
    <Route key="core-index" index element={<Navigate to={defaultPath} replace />} />,
    <Route key="core-purchasing-legacy" path="purchasing" element={<Navigate to="/core/procurement" replace />} />,
    <Route key="core-settings-devices-legacy" path="settings/devices" element={<Navigate to="/core/it/devices" replace />} />,
    <Route key="core-settings-tabs" path="settings/:tab" element={<CoreSettings />} />,
    <Route key="core-trajectory" path="trajectory" element={<GrowthTrajectoryPage />} />,
    <Route key="core-risk" path="risk" element={<RiskMatrixPage />} />,
    <Route key="core-archives" path="archives" element={<DataArchivesPage />} />,
    <Route
      key="core-finance"
      path="finance/*"
      element={
        <ProtectedRoute permission="finance.workspace.access" scope="COMPANY">
          <CFOProvider>
            <FinanceWorkspaceLayout />
          </CFOProvider>
        </ProtectedRoute>
      }
    >
      <Route index element={<CFODashboard />} />
      <Route
        path="moneydesk"
        element={
          <ProtectedRoute permission="finance.workspace.access" scope="COMPANY">
            <MoneyDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="treasury"
        element={
          <ProtectedRoute permission="finance.treasury.view" scope="COMPANY">
            <TreasuryMap />
          </ProtectedRoute>
        }
      />
      <Route
        path="payslip-studio"
        element={
          <ProtectedRoute permission="core.finance.access" scope="COMPANY">
            <PayslipStudio />
          </ProtectedRoute>
        }
      />
      <Route
        path="ledger"
        element={
          <ProtectedRoute permission="finance.ledger.view" scope="COMPANY">
            <LedgerCore />
          </ProtectedRoute>
        }
      />
      <Route
        path="payflow"
        element={
          <ProtectedRoute permission="finance.payments.manage" scope="COMPANY">
            <PayFlow />
          </ProtectedRoute>
        }
      />
      <Route
        path="receivables"
        element={
          <ProtectedRoute permission="finance.receivables.view" scope="COMPANY">
            <ReceivableDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="payables"
        element={
          <ProtectedRoute permission="finance.payables.view" scope="COMPANY">
            <PayableDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="close"
        element={
          <ProtectedRoute permission="finance.close.manage" scope="COMPANY">
            <ClosePeriodStudio />
          </ProtectedRoute>
        }
      />
      <Route
        path="audit"
        element={
          <ProtectedRoute permission="finance.audit.view" scope="COMPANY">
            <AuditVault />
          </ProtectedRoute>
        }
      />
      <Route
        path="insights"
        element={
          <ProtectedRoute permission="finance.insights.view" scope="COMPANY">
            <FinanceInsights />
          </ProtectedRoute>
        }
      />
      <Route
        path="invoices"
        element={
          <ProtectedRoute permission="finance.invoices.manage" scope="COMPANY">
            <InvoiceCapture />
          </ProtectedRoute>
        }
      />
      <Route
        path="docs"
        element={
          <ProtectedRoute permission="finance.docs.view" scope="COMPANY">
            <FinanceDocs />
          </ProtectedRoute>
        }
      />
      <Route
        path="assets"
        element={
          <ProtectedRoute permission="finance.assets.view" scope="COMPANY">
            <Assets />
          </ProtectedRoute>
        }
      />
      <Route
        path="policy"
        element={
          <ProtectedRoute permission="finance.policy.manage" scope="COMPANY">
            <PolicyManager />
          </ProtectedRoute>
        }
      />
      <Route
        path="jv"
        element={
          <ProtectedRoute permission="finance.workspace.access" scope="COMPANY">
            <JVDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="operations"
        element={
          <ProtectedRoute permission="finance.workspace.access" scope="COMPANY">
            <FinancialOperationsDesk />
          </ProtectedRoute>
        }
      />
      <Route path="schedule" element={<DepartmentScheduleStudio workspaceDeptId="FINANCE" title="Finance" />} />
      <Route path="attendance" element={<DepartmentAttendanceStudio workspaceDeptId="FINANCE" title="Finance" />} />
      <Route path="admin" element={<DeptAdmin departmentId="FINANCE" departmentName="Finance & Treasury" />} />
      <Route path="prs" element={<PurchaseRequestDesk />} />
      <Route path="receiving" element={<InventoryReceiving />} />
      <Route path="stock" element={<InventoryStockHub />} />
      <Route path="portal" element={<MyPulse />} />
      <Route path="logs" element={<LogHub />} />
      <Route path="audit-log" element={<AuditHub />} />
      <Route path="workflow" element={<WorkflowInbox />} />
    </Route>,
    <Route
      key="core-payment"
      path="payment/*"
      element={
        <ProtectedRoute permission="finance.workspace.access" scope="COMPANY">
          <PaymentWorkspaceLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<PaymentDashboard />} />
      <Route
        path="dashboard"
        element={
          <ProtectedRoute permission="finance.workspace.access" scope="COMPANY">
            <PaymentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="execution"
        element={
          <ProtectedRoute permission="finance.workspace.access" scope="COMPANY">
            <PaymentExecutionHub />
          </ProtectedRoute>
        }
      />
      <Route
        path="providers"
        element={
          <ProtectedRoute permission="finance.workspace.access" scope="COMPANY">
            <ProviderRoutingDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="devices"
        element={
          <ProtectedRoute permission="finance.workspace.access" scope="COMPANY">
            <DeviceRoutingDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="refunds"
        element={
          <ProtectedRoute permission="finance.workspace.access" scope="COMPANY">
            <RefundDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="disputes"
        element={
          <ProtectedRoute permission="finance.workspace.access" scope="COMPANY">
            <DisputeCenter />
          </ProtectedRoute>
        }
      />
      <Route
        path="audit"
        element={
          <ProtectedRoute permission="finance.workspace.access" scope="COMPANY">
            <PaymentAuditVault />
          </ProtectedRoute>
        }
      />
    </Route>,
    <Route
      key="core-procurement"
      path="procurement/*"
      element={
        <ProtectedRoute permission="core.procurement.access" scope="COMPANY">
          <ProcurementWorkspaceLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<PurchaseRequestDesk />} />
      <Route
        path="suppliers"
        element={
          <ProtectedRoute permission="core.procurement.access" scope="COMPANY">
            <SupplierDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="contracts"
        element={
          <ProtectedRoute permission="core.procurement.access" scope="COMPANY">
            <ContractDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="prs"
        element={
          <ProtectedRoute permission="core.procurement.access" scope="COMPANY">
            <PurchaseRequestDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="po-release"
        element={
          <ProtectedRoute permission="core.procurement.access" scope="COMPANY">
            <PoReleaseDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="portal"
        element={
          <ProtectedRoute permission="core.procurement.access" scope="COMPANY">
            <SupplierPortalDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="risk"
        element={
          <ProtectedRoute permission="core.procurement.access" scope="COMPANY">
            <ProcurementRiskCenter />
          </ProtectedRoute>
        }
      />
      <Route
        path="insights"
        element={
          <ProtectedRoute permission="core.procurement.access" scope="COMPANY">
            <ProcurementInsights />
          </ProtectedRoute>
        }
      />
      <Route path="schedule" element={<DepartmentScheduleStudio workspaceDeptId="PROCUREMENT" title="Procurement" />} />
      <Route path="attendance" element={<DepartmentAttendanceStudio workspaceDeptId="PROCUREMENT" title="Procurement" />} />
      <Route path="admin" element={<DeptAdmin departmentId="PROCUREMENT" departmentName="Procurement & Sourcing" />} />
      <Route path="prs" element={<PurchaseRequestDesk />} />
      <Route path="receiving" element={<InventoryReceiving />} />
      <Route path="stock" element={<InventoryStockHub />} />
      <Route path="portal" element={<MyPulse />} />
      <Route path="logs" element={<LogHub />} />
      <Route path="audit-log" element={<AuditHub />} />
      <Route path="workflow" element={<WorkflowInbox />} />
    </Route>,
    <Route
      key="core-inventory"
      path="inventory/*"
      element={
        <ProtectedRoute permission="core.tools.access" scope="COMPANY">
          <InventoryWorkspaceLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<InventoryDashboard />} />
      <Route
        path="dashboard"
        element={
          <ProtectedRoute permission="core.tools.access" scope="COMPANY">
            <InventoryDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="stock"
        element={
          <ProtectedRoute permission="core.tools.access" scope="COMPANY">
            <InventoryStockHub />
          </ProtectedRoute>
        }
      />
      <Route
        path="receiving"
        element={
          <ProtectedRoute permission="core.tools.access" scope="COMPANY">
            <InventoryReceiving />
          </ProtectedRoute>
        }
      />
      <Route
        path="adjustments"
        element={
          <ProtectedRoute permission="core.tools.access" scope="COMPANY">
            <InventoryAdjustments />
          </ProtectedRoute>
        }
      />
      <Route
        path="transfers"
        element={
          <ProtectedRoute permission="core.tools.access" scope="COMPANY">
            <TransferDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="opname"
        element={
          <ProtectedRoute permission="core.tools.access" scope="COMPANY">
            <InventoryStockOpname />
          </ProtectedRoute>
        }
      />
      <Route
        path="audit"
        element={
          <ProtectedRoute permission="core.tools.access" scope="COMPANY">
            <InventoryAuditLog />
          </ProtectedRoute>
        }
      />
      <Route
        path="insights"
        element={
          <ProtectedRoute permission="core.tools.access" scope="COMPANY">
            <InventoryInsights />
          </ProtectedRoute>
        }
      />
      <Route
        path="iot"
        element={
          <ProtectedRoute permission="core.tools.access" scope="COMPANY">
            <IotEventFeed />
          </ProtectedRoute>
        }
      />
      <Route path="schedule" element={<DepartmentScheduleStudio workspaceDeptId="INVENTORY" title="Inventory" />} />
      <Route path="attendance" element={<DepartmentAttendanceStudio workspaceDeptId="INVENTORY" title="Inventory" />} />
      <Route path="admin" element={<DeptAdmin departmentId="INVENTORY" departmentName="Inventory & Logistics" />} />
      <Route path="prs" element={<PurchaseRequestDesk />} />
      <Route path="portal" element={<MyPulse />} />
      <Route path="logs" element={<LogHub />} />
      <Route path="audit-log" element={<AuditHub />} />
      <Route path="workflow" element={<WorkflowInbox />} />
    </Route>,
    <Route
      key="core-warehouse"
      path="warehouse/*"
      element={
        <ProtectedRoute permission="core.tools.access" scope="COMPANY">
          <WarehouseWorkspaceLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<WarehouseManagement />} />
      <Route path="hierarchy" element={<StorageHierarchy />} />
      <Route path="receiving" element={<WarehouseReceiving />} />
      <Route path="picking" element={<WarehousePicking />} />
      <Route path="packing" element={<WarehousePacking />} />
      <Route path="analytics" element={<OccupancyTrends />} />
      <Route path="audit" element={<WarehouseAudit />} />
      <Route
        path="dashboard"
        element={
          <ProtectedRoute permission="core.tools.access" scope="COMPANY">
            <WarehouseManagement />
          </ProtectedRoute>
        }
      />
      <Route path="schedule" element={<DepartmentScheduleStudio workspaceDeptId="WAREHOUSE" title="Warehouse" />} />
      <Route path="attendance" element={<DepartmentAttendanceStudio workspaceDeptId="WAREHOUSE" title="Warehouse" />} />
      <Route path="admin" element={<DeptAdmin departmentId="WAREHOUSE" departmentName="Warehouse & Logistics" />} />
      <Route path="prs" element={<PurchaseRequestDesk />} />
      <Route path="portal" element={<MyPulse />} />
      <Route path="logs" element={<LogHub />} />
      <Route path="audit-log" element={<AuditHub />} />
      <Route path="workflow" element={<WorkflowInbox />} />
    </Route>,
    <Route
      key="core-it"
      path="it/*"
      element={
        <ProtectedRoute permission="core.it.access" scope="COMPANY">
          <ITWorkspaceLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<ITDashboard />} />
      <Route
        path="dashboard"
        element={
          <ProtectedRoute permission="core.it.access" scope="COMPANY">
            <ITDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="accounts"
        element={
          <ProtectedRoute permission="core.it.access" scope="COMPANY">
            <AccountDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="devices"
        element={
          <ProtectedRoute permission="core.it.access" scope="COMPANY">
            <DeviceDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="health"
        element={
          <ProtectedRoute permission="core.it.access" scope="COMPANY">
            <SystemHealth />
          </ProtectedRoute>
        }
      />
      <Route
        path="topology"
        element={
          <ProtectedRoute permission="core.it.access" scope="COMPANY">
            <TopologyMap />
          </ProtectedRoute>
        }
      />
      <Route
        path="roles"
        element={
          <ProtectedRoute permission="core.it.access" scope="COMPANY">
            <RoleGovernance />
          </ProtectedRoute>
        }
      />
      <Route
        path="shop"
        element={
          <ProtectedRoute permission="core.it.access" scope="COMPANY">
            <TechShop />
          </ProtectedRoute>
        }
      />
      <Route path="schedule" element={<DepartmentScheduleStudio workspaceDeptId="IT" title="IT & Tech" />} />
      <Route path="attendance" element={<DepartmentAttendanceStudio workspaceDeptId="IT" title="IT & Tech" />} />
      <Route path="admin" element={<DeptAdmin departmentId="IT" departmentName="IT & Infrastructure" />} />
      <Route path="prs" element={<PurchaseRequestDesk />} />
      <Route path="receiving" element={<InventoryReceiving />} />
      <Route path="stock" element={<InventoryStockHub />} />
      <Route path="portal" element={<MyPulse />} />
      <Route path="logs" element={<LogHub />} />
      <Route path="audit-log" element={<AuditHub />} />
      <Route path="workflow" element={<WorkflowInbox />} />
    </Route>,
    <Route
      key="core-sales"
      path="sales/*"
      element={
        <ProtectedRoute permission="core.sales.access" scope="COMPANY">
          <SalesWorkspaceLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<Navigate to="overview" replace />} />
      <Route
        path="overview"
        element={
          <ProtectedRoute permission="core.sales.access" scope="COMPANY">
            <SalesOverview />
          </ProtectedRoute>
        }
      />
      <Route
        path="dashboard"
        element={
          <ProtectedRoute permission="core.sales.access" scope="COMPANY">
            <SalesDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="leads"
        element={
          <ProtectedRoute permission="core.sales.access" scope="COMPANY">
            <LeadDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="pipeline"
        element={
          <ProtectedRoute permission="core.sales.access" scope="COMPANY">
            <PipelineBoard />
          </ProtectedRoute>
        }
      />
      <Route
        path="opps"
        element={
          <ProtectedRoute permission="core.sales.access" scope="COMPANY">
            <OpportunityDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="quotes"
        element={
          <ProtectedRoute permission="core.sales.access" scope="COMPANY">
            <QuoteDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="timeline"
        element={
          <ProtectedRoute permission="core.sales.access" scope="COMPANY">
            <TimelineDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="orders"
        element={
          <ProtectedRoute permission="core.sales.access" scope="COMPANY">
            <SalesOrderDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="manager"
        element={
          <ProtectedRoute permission="core.sales.access" scope="COMPANY">
            <ManagerDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="forecast"
        element={
          <ProtectedRoute permission="core.sales.access" scope="COMPANY">
            <ForecastDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="audit"
        element={
          <ProtectedRoute permission="core.sales.access" scope="COMPANY">
            <SalesAuditLog />
          </ProtectedRoute>
        }
      />
      <Route
        path="customers"
        element={
          <ProtectedRoute permission="core.sales.access" scope="COMPANY">
            <Customer360Desk />
          </ProtectedRoute>
        }
      />
      <Route
        path="commissions"
        element={
          <ProtectedRoute permission="core.sales.access" scope="COMPANY">
            <IncentiveDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="intelligence"
        element={
          <ProtectedRoute permission="core.sales.access" scope="COMPANY">
            <SalesIntelligenceEngine />
          </ProtectedRoute>
        }
      />
      <Route path="schedule" element={<DepartmentScheduleStudio workspaceDeptId="SALES" title="Sales" />} />
      <Route path="attendance" element={<DepartmentAttendanceStudio workspaceDeptId="SALES" title="Sales" />} />
      <Route path="admin" element={<DeptAdmin departmentId="SALES" departmentName="Sales & Revenue" />} />
      <Route path="prs" element={<PurchaseRequestDesk />} />
      <Route path="receiving" element={<InventoryReceiving />} />
      <Route path="stock" element={<InventoryStockHub />} />
      <Route path="portal" element={<MyPulse />} />
      <Route path="logs" element={<LogHub />} />
      <Route path="audit-log" element={<AuditHub />} />
      <Route path="workflow" element={<WorkflowInbox />} />
    </Route>,
    <Route
      key="core-marketing"
      path="marketing/*"
      element={
        <ProtectedRoute permission="core.marketing.access" scope="COMPANY">
          <MarketingWorkspaceLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<MarketingDashboard />} />
      <Route
        path="dashboard"
        element={
          <ProtectedRoute permission="core.marketing.access" scope="COMPANY">
            <MarketingDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="customer-360"
        element={
          <ProtectedRoute permission="core.marketing.access" scope="COMPANY">
            <Customer360Desk />
          </ProtectedRoute>
        }
      />
      <Route
        path="appointments"
        element={
          <ProtectedRoute permission="core.marketing.access" scope="COMPANY">
            <AppointmentDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="campaigns"
        element={
          <ProtectedRoute permission="core.marketing.access" scope="COMPANY">
            <CampaignDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="execution"
        element={
          <ProtectedRoute permission="core.marketing.access" scope="COMPANY">
            <ExecutionDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="automation"
        element={
          <ProtectedRoute permission="core.marketing.access" scope="COMPANY">
            <AutomationLab />
          </ProtectedRoute>
        }
      />
      <Route
        path="strategy"
        element={
          <ProtectedRoute permission="core.marketing.access" scope="COMPANY">
            <StrategyControlDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="leads"
        element={
          <ProtectedRoute permission="core.marketing.access" scope="COMPANY">
            <LeadCaptureDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="nurture"
        element={
          <ProtectedRoute permission="core.marketing.access" scope="COMPANY">
            <NurtureStudio />
          </ProtectedRoute>
        }
      />
      <Route
        path="funnels"
        element={
          <ProtectedRoute permission="core.marketing.access" scope="COMPANY">
            <FunnelBuilderDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="inbox"
        element={
          <ProtectedRoute permission="core.marketing.access" scope="COMPANY">
            <OmnichannelInbox />
          </ProtectedRoute>
        }
      />
      <Route
        path="accounts"
        element={
          <ProtectedRoute permission="core.marketing.access" scope="COMPANY">
            <ConnectedAccountsDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="analytics"
        element={
          <ProtectedRoute permission="core.marketing.access" scope="COMPANY">
            <MarketingAnalytics />
          </ProtectedRoute>
        }
      />
      <Route
        path="alerts"
        element={
          <ProtectedRoute permission="core.marketing.access" scope="COMPANY">
            <MarketingAlerts />
          </ProtectedRoute>
        }
      />
      <Route
        path="audit"
        element={
          <ProtectedRoute permission="core.marketing.access" scope="COMPANY">
            <MarketingAuditLog />
          </ProtectedRoute>
        }
      />
      <Route
        path="white-label"
        element={
          <ProtectedRoute permission="core.marketing.access" scope="COMPANY">
            <WhiteLabelSettings />
          </ProtectedRoute>
        }
      />
      <Route
        path="creative"
        element={
          <ProtectedRoute permission="core.marketing.access" scope="COMPANY">
            <CreativeLibrary />
          </ProtectedRoute>
        }
      />
      <Route
        path="customer-360"
        element={
          <ProtectedRoute permission="core.marketing.access" scope="COMPANY">
            <Customer360 />
          </ProtectedRoute>
        }
      />
      <Route path="schedule" element={<DepartmentScheduleStudio workspaceDeptId="MARKETING" title="Marketing" />} />
      <Route path="attendance" element={<DepartmentAttendanceStudio workspaceDeptId="MARKETING" title="Marketing" />} />
      <Route path="admin" element={<DeptAdmin departmentId="MARKETING" departmentName="Marketing & Growth" />} />
      <Route path="prs" element={<PurchaseRequestDesk />} />
      <Route path="receiving" element={<InventoryReceiving />} />
      <Route path="stock" element={<InventoryStockHub />} />
      <Route path="portal" element={<MyPulse />} />
      <Route path="logs" element={<LogHub />} />
      <Route path="audit-log" element={<AuditHub />} />
      <Route path="workflow" element={<WorkflowInbox />} />
    </Route>,
    <Route
      key="core-logistics"
      path="logistics/*"
      element={
        <ProtectedRoute permission="core.tools.access" scope="COMPANY">
          <LogisticsControlCenter />
        </ProtectedRoute>
      }
    />,
    <Route
      key="core-admin-workspace"
      path="admin/*"
      element={
        <ProtectedRoute permission="core.admin.requests" scope="COMPANY">
          <AdminWorkspaceLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<RequestDesk />} />
      <Route
        path="requests"
        element={
          <ProtectedRoute permission="core.admin.requests" scope="COMPANY">
            <RequestDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="assign"
        element={
          <ProtectedRoute permission="core.admin.requests" scope="COMPANY">
            <RequestAssign />
          </ProtectedRoute>
        }
      />
      <Route
        path="track"
        element={
          <ProtectedRoute permission="core.admin.requests" scope="COMPANY">
            <RequestTrack />
          </ProtectedRoute>
        }
      />
    </Route>,
    <Route
      key="core-hr"
      path="hr/*"
      element={
        <ProtectedRoute permission="core.hr.access" scope="COMPANY">
          <HRWorkspaceLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<PulseDesk />} />
      <Route
        path="dashboard"
        element={
          <ProtectedRoute permission="core.hr.access" scope="COMPANY">
            <PulseDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="people"
        element={
          <ProtectedRoute permission="hr.directory.view" scope="DEPARTMENT">
            <RosterGrid />
          </ProtectedRoute>
        }
      />
      <Route
        path="people/:id"
        element={
          <ProtectedRoute permission="hr.staff.view" scope="SELF">
            <PeopleCore />
          </ProtectedRoute>
        }
      />
      <Route
        path="org-map"
        element={
          <ProtectedRoute permission="hr.directory.view" scope="DEPARTMENT">
            <OrgMap />
          </ProtectedRoute>
        }
      />
      <Route
        path="vault"
        element={
          <ProtectedRoute permission="core.hr.legal.manage" scope="COMPANY">
            <VaultSpace />
          </ProtectedRoute>
        }
      />
      <Route
        path="flowgate"
        element={
          <ProtectedRoute permission="hr.workspace.access" scope="COMPANY">
            <FlowGate />
          </ProtectedRoute>
        }
      />
      <Route
        path="cases"
        element={
          <ProtectedRoute permission="hr.workspace.access" scope="COMPANY">
            <CaseDesk />
          </ProtectedRoute>
        }
      />
      <Route
        path="cases/:id"
        element={
          <ProtectedRoute permission="hr.workspace.access" scope="COMPANY">
            <CaseDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="talent"
        element={
          <ProtectedRoute permission="hr.recruitment.manage" scope="COMPANY">
            <TalentFlow />
          </ProtectedRoute>
        }
      />
      <Route
        path="skilltrack"
        element={
          <ProtectedRoute permission="hr.training.manage" scope="COMPANY">
            <SkillTrack />
          </ProtectedRoute>
        }
      />
      <Route
        path="scheduling"
        element={
          <ProtectedRoute permission="hr.directory.view" scope="COMPANY">
            <SchedulingStudio />
          </ProtectedRoute>
        }
      />
      <Route
        path="growth"
        element={
          <ProtectedRoute permission="hr.performance.view" scope="COMPANY">
            <GrowthCycle />
          </ProtectedRoute>
        }
      />
      <Route
        path="paycycle"
        element={
          <ProtectedRoute permission="core.hr.payroll.manage" scope="COMPANY">
            <PayCycleStudio />
          </ProtectedRoute>
        }
      />
      <Route path="schedule" element={<DepartmentScheduleStudio workspaceDeptId="HR" title="HR & Legal" />} />
      <Route path="attendance" element={<DepartmentAttendanceStudio workspaceDeptId="HR" title="HR & Legal" />} />
      <Route path="admin" element={<DeptAdmin departmentId="HR" departmentName="Human Resources & Legal" />} />
      <Route path="prs" element={<PurchaseRequestDesk />} />
      <Route path="receiving" element={<InventoryReceiving />} />
      <Route path="stock" element={<InventoryStockHub />} />
      <Route path="portal" element={<MyPulse />} />
      <Route path="logs" element={<LogHub />} />
      <Route path="audit-log" element={<AuditHub />} />
      <Route path="workflow" element={<WorkflowInbox />} />
      <Route
        path="lexboard"
        element={
          <ProtectedRoute permission="core.hr.legal.manage" scope="COMPANY">
            <LexBoard />
          </ProtectedRoute>
        }
      />
      <Route
        path="insights"
        element={
          <ProtectedRoute permission="core.hr.access" scope="COMPANY">
            <InsightLayer />
          </ProtectedRoute>
        }
      />
    </Route>,
    <Route
      key="core-portal"
      path="portal/*"
      element={
        <ProtectedRoute permission="hr.staff.view" scope="SELF">
          <MyPulse />
        </ProtectedRoute>
      }
    />,
    <Route
      key="core-workflow"
      path="workflow"
      element={
        <ProtectedRoute permission="hr.workspace.access" scope="COMPANY">
          <WorkflowInbox />
        </ProtectedRoute>
      }
    />,
    <Route
      key="core-tools"
      path="tools"
      element={
        <ProtectedRoute permission="core.tools.access" scope="COMPANY">
          <ToolsHome />
        </ProtectedRoute>
      }
    />,
    <Route
      key="core-tools-explorer"
      path="tools/explorer"
      element={
        <ProtectedRoute permission="core.tools.access" scope="COMPANY">
          <Explorer />
        </ProtectedRoute>
      }
    />,
    <Route
      key="core-tools-docs"
      path="tools/docs"
      element={
        <ProtectedRoute permission="core.tools.access" scope="COMPANY">
          <DocumentTool />
        </ProtectedRoute>
      }
    />,
    <Route
      key="core-tools-sheets"
      path="tools/sheets"
      element={
        <ProtectedRoute permission="core.tools.access" scope="COMPANY">
          <SpreadsheetTool />
        </ProtectedRoute>
      }
    />,
    <Route
      key="core-tools-slides"
      path="tools/slides"
      element={
        <ProtectedRoute permission="core.tools.access" scope="COMPANY">
          <PresentationTool />
        </ProtectedRoute>
      }
    />,
    <Route
      key="core-tools-calculators"
      path="tools/calculators"
      element={
        <ProtectedRoute permission="core.tools.access" scope="COMPANY">
          <CalculatorTool />
        </ProtectedRoute>
      }
    />,
    <Route
      key="core-tools-exports"
      path="tools/exports"
      element={
        <ProtectedRoute permission="core.tools.access" scope="COMPANY">
          <ExportTool />
        </ProtectedRoute>
      }
    />,

    <Route
      key="core-audit"
      path="audit"
      element={
        <ProtectedRoute permission="core.it.access" scope="COMPANY">
          <AuditHub />
        </ProtectedRoute>
      }
    />,
    <Route
      key="core-logs"
      path="logs"
      element={
        <ProtectedRoute permission="core.it.access" scope="COMPANY">
          <LogHub />
        </ProtectedRoute>
      }
    />,
    <Route
      key="core-bulletin"
      path="bulletin"
      element={
        <ProtectedRoute permission="core.it.access" scope="COMPANY">
          <BulletinHub />
        </ProtectedRoute>
      }
    />,
    <Route
      key="core-mail"
      path="mail"
      element={
        <ProtectedRoute permission="core.it.access" scope="COMPANY">
          <MailHub />
        </ProtectedRoute>
      }
    />,
    <Route
      key="core-chat"
      path="chat"
      element={
        <ProtectedRoute permission="core.it.access" scope="COMPANY">
          <ChatHub />
        </ProtectedRoute>
      }
    />,




    ...routes,
  ];
}
