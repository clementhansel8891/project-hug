/**
 * Full Visual Audit: Screenshots of all app pages in both themes
 * Run: npx tsx tests/playwright/screenshot-audit-standalone.ts
 */
import { chromium, Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "http://150.109.15.108:3010";
const CREDENTIALS = { email: "estela@bambusilver.com", password: "Estella2024!" };
const SCREENSHOT_DIR = "tests/playwright/screenshots/audit";

// All known routes grouped by module
const ROUTES: Record<string, string> = {
  // Core
  "core_dashboard": "/core/dashboard",
  "core_growth": "/core/growth-trajectory",
  "core_risk": "/core/risk-matrix",
  // Finance
  "finance_cfo": "/core/finance",
  "finance_money_desk": "/core/finance/money-desk",
  "finance_treasury": "/core/finance/treasury",
  "finance_ledger": "/core/finance/ledger",
  "finance_payflow": "/core/finance/payflow",
  "finance_receivables": "/core/finance/receivables",
  "finance_payables": "/core/finance/payables",
  "finance_invoices": "/core/finance/invoices",
  "finance_assets": "/core/finance/assets",
  "finance_jv": "/core/finance/jv",
  "finance_policy": "/core/finance/policy",
  "finance_close": "/core/finance/close-period",
  // HR
  "hr_pulse": "/core/hr/pulse",
  "hr_people": "/core/hr/people",
  "hr_org": "/core/hr/org-map",
  "hr_roster": "/core/hr/roster",
  "hr_scheduling": "/core/hr/scheduling",
  "hr_payroll": "/core/hr/pay-cycle",
  "hr_talent": "/core/hr/talent",
  "hr_growth": "/core/hr/growth-cycle",
  "hr_flow": "/core/hr/flow-gate",
  "hr_vault": "/core/hr/vault",
  "hr_lex": "/core/hr/lex-board",
  "hr_cases": "/core/hr/cases",
  // Sales
  "sales_dashboard": "/core/sales",
  "sales_overview": "/core/sales/overview",
  "sales_leads": "/core/sales/leads",
  "sales_pipeline": "/core/sales/pipeline",
  "sales_opportunities": "/core/sales/opportunities",
  "sales_quotes": "/core/sales/quotes",
  "sales_orders": "/core/sales/orders",
  "sales_incentives": "/core/sales/incentives",
  // Marketing
  "marketing_dashboard": "/core/marketing",
  "marketing_campaigns": "/core/marketing/campaigns",
  "marketing_customer360": "/core/marketing/customer-360",
  "marketing_omnichannel": "/core/marketing/omnichannel",
  "marketing_funnels": "/core/marketing/funnels",
  // Inventory
  "inventory_dashboard": "/core/inventory",
  "inventory_stock": "/core/inventory/stock",
  "inventory_receiving": "/core/inventory/receiving",
  "inventory_adjustments": "/core/inventory/adjustments",
  "inventory_transfers": "/core/inventory/transfers",
  "inventory_opname": "/core/inventory/stock-opname",
  // Warehouse
  "warehouse_mgmt": "/core/warehouse",
  "warehouse_hierarchy": "/core/warehouse/hierarchy",
  "warehouse_receiving": "/core/warehouse/receiving",
  "warehouse_picking": "/core/warehouse/picking",
  // Procurement
  "procurement_suppliers": "/core/procurement/suppliers",
  "procurement_contracts": "/core/procurement/contracts",
  "procurement_requests": "/core/procurement/requests",
  "procurement_po": "/core/procurement/po-release",
  // Payment
  "payment_dashboard": "/core/payment",
  "payment_execution": "/core/payment/execution",
  "payment_providers": "/core/payment/providers",
  "payment_refunds": "/core/payment/refunds",
  // IT
  "it_dashboard": "/core/it",
  "it_health": "/core/it/health",
  "it_accounts": "/core/it/accounts",
  "it_devices": "/core/it/devices",
  // Others
  "audit": "/core/audit",
  "logs": "/core/logs",
  "settings": "/core/settings",
  "comms_chat": "/core/comms/chat",
  "comms_mail": "/core/comms/mail",
  "comms_bulletin": "/core/comms/bulletin",
  "tools": "/core/tools",
  // Retail Module
  "retail_workspace": "/m/retail/workspace",
  "retail_mgmt_stores": "/m/retail/management/stores",
  "retail_mgmt_channels": "/m/retail/management/channels",
  "retail_mgmt_inventory": "/m/retail/management/inventory",
  "retail_mgmt_orders": "/m/retail/management/orders",
  "retail_mgmt_pricing": "/m/retail/management/pricing",
  "retail_mgmt_shifts": "/m/retail/management/shifts",
  "retail_mgmt_devices": "/m/retail/management/devices",
  "retail_mgmt_customers": "/m/retail/management/customers",
  "retail_mgmt_staff": "/m/retail/management/staff",
  "retail_ops_pos": "/m/retail/operational/pos",
  "retail_ops_shift_open": "/m/retail/operational/shift-open",
  "retail_ops_shift_close": "/m/retail/operational/shift-close",
  "retail_ops_stock_opname": "/m/retail/operational/stock-opname",
  "retail_ops_receiving": "/m/retail/operational/receiving",
  "retail_ops_refund": "/m/retail/operational/refund",
  "retail_ops_cash": "/m/retail/operational/cash-movement",
};

async function main() {
  for (const theme of ["light", "dark"]) {
    fs.mkdirSync(path.join(SCREENSHOT_DIR, theme), { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  // Login
  console.log("🔐 Logging in...");
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.locator('input[type="email"]').first().fill(CREDENTIALS.email);
  await page.locator('input[type="password"]').first().fill(CREDENTIALS.password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(4000);
  console.log(`✅ Logged in → ${page.url()}`);

  let success = 0, fail = 0;
  const issues: string[] = [];

  for (const theme of ["light", "dark"] as const) {
    console.log(`\n🎨 === ${theme.toUpperCase()} THEME ===`);

    for (const [name, route] of Object.entries(ROUTES)) {
      try {
        await page.goto(`${BASE_URL}${route}`, { timeout: 12000, waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1500);

        // Set theme
        await page.evaluate((t) => {
          document.documentElement.classList.remove("light", "dark");
          document.documentElement.classList.add(t);
          localStorage.setItem("theme", t);
          localStorage.setItem("vite-ui-theme", t);
        }, theme);
        await page.waitForTimeout(400);

        await page.screenshot({ path: `${SCREENSHOT_DIR}/${theme}/${name}.png`, fullPage: true });
        console.log(`  ✅ ${name}`);
        success++;
      } catch (e: any) {
        console.log(`  ❌ ${name} — ${e.message?.slice(0, 60)}`);
        fail++;
        issues.push(`${theme}/${name}: ${e.message?.slice(0, 100)}`);
        try { await page.screenshot({ path: `${SCREENSHOT_DIR}/${theme}/${name}-error.png` }); } catch {}
      }
    }
  }

  // Write summary
  fs.writeFileSync(path.join(SCREENSHOT_DIR, "summary.json"), JSON.stringify({
    timestamp: new Date().toISOString(),
    total: Object.keys(ROUTES).length * 2,
    success, fail, issues,
  }, null, 2));

  console.log(`\n${"═".repeat(50)}`);
  console.log(`📊 DONE: ${success} captured, ${fail} failed out of ${Object.keys(ROUTES).length * 2} total`);
  await browser.close();
}

main().catch(console.error);
