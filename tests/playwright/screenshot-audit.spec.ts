/**
 * Visual Audit: Full screenshot of all app pages in both themes.
 * 
 * Run: npx playwright test tests/playwright/screenshot-audit.spec.ts --project=chromium --headed
 * 
 * This script logs in to the live site, navigates every page, captures screenshots
 * in both light and dark mode, and attempts to open modals where possible.
 */
import { test, expect, Page } from "@playwright/test";

const BASE_URL = "http://150.109.15.108:3010";
const CREDENTIALS = {
  email: "estela@bambusilver.com",
  password: "Estella2024!",
};

const SCREENSHOT_DIR = "tests/playwright/screenshots/audit";

// All known routes in the app
const ROUTES = {
  // Core
  dashboard: "/",
  finance: "/finance",
  financeLedger: "/finance/ledger",
  financePayables: "/finance/payables",
  financeReceivables: "/finance/receivables",
  financeMoneyDesk: "/finance/money-desk",
  financePayFlow: "/finance/payflow",
  financeInvoices: "/finance/invoices",
  financeJV: "/finance/jv",
  hr: "/hr",
  hrPeople: "/hr/people",
  hrRoster: "/hr/roster",
  hrPayroll: "/hr/payroll",
  hrTalent: "/hr/talent",
  hrPulse: "/hr/pulse",
  sales: "/sales",
  salesOverview: "/sales/overview",
  salesPipeline: "/sales/pipeline",
  inventory: "/inventory",
  inventoryStock: "/inventory/stock",
  marketing: "/marketing",
  marketingCampaigns: "/marketing/campaigns",
  procurement: "/procurement",
  procurementSuppliers: "/procurement/suppliers",
  it: "/it",
  audit: "/audit",
  logs: "/logs",
  settings: "/settings",
  // Retail Management
  retailDashboard: "/retail/management",
  retailStores: "/retail/management/stores",
  retailChannels: "/retail/management/channels",
  retailInventory: "/retail/management/inventory",
  retailOrders: "/retail/management/orders",
  retailPricing: "/retail/management/pricing",
  retailShifts: "/retail/management/shifts",
  retailDevices: "/retail/management/devices",
  retailCustomers: "/retail/management/customers",
  retailStaff: "/retail/management/staff",
  // Retail Operational
  retailPOS: "/retail/operational/pos",
  retailShiftOpen: "/retail/operational/shift-open",
  retailShiftClose: "/retail/operational/shift-close",
  retailStockOpname: "/retail/operational/stock-opname",
  retailReceiving: "/retail/operational/receiving",
  retailRefund: "/retail/operational/refund",
  retailCashMovement: "/retail/operational/cash-movement",
};

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState("networkidle");
  
  // Fill login form
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]');
  const passwordInput = page.locator('input[type="password"], input[name="password"]');
  
  if (await emailInput.isVisible({ timeout: 5000 })) {
    await emailInput.fill(CREDENTIALS.email);
    await passwordInput.fill(CREDENTIALS.password);
    
    const submitBtn = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    await submitBtn.click();
    await page.waitForURL(/(?!.*login).*/, { timeout: 15000 });
  }
  
  await page.waitForLoadState("networkidle");
}

async function setTheme(page: Page, theme: "light" | "dark") {
  // Try toggling theme via the app's theme switcher
  await page.evaluate((t) => {
    const root = document.documentElement;
    if (t === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
    }
    localStorage.setItem("theme", t);
    localStorage.setItem("vite-ui-theme", t);
  }, theme);
  await page.waitForTimeout(300);
}

async function screenshotPage(page: Page, name: string, theme: string) {
  const filename = `${SCREENSHOT_DIR}/${theme}/${name}.png`;
  await page.screenshot({ path: filename, fullPage: true });
}

test.describe.configure({ mode: "serial" });

test.describe("Visual Audit - All Pages", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
    page = await context.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  for (const theme of ["light", "dark"] as const) {
    test(`Capture all pages in ${theme} mode`, async () => {
      test.setTimeout(300000); // 5 min for all pages
      
      await setTheme(page, theme);
      
      for (const [name, route] of Object.entries(ROUTES)) {
        try {
          await page.goto(`${BASE_URL}${route}`, { timeout: 15000, waitUntil: "networkidle" });
          await page.waitForTimeout(1000); // Let animations settle
          await screenshotPage(page, name, theme);
          console.log(`  ✓ ${theme}/${name}`);
        } catch (e) {
          console.log(`  ✗ ${theme}/${name} — ${(e as Error).message?.slice(0, 80)}`);
          // Still try to screenshot whatever loaded
          try {
            await screenshotPage(page, `${name}-error`, theme);
          } catch {}
        }
      }
    });
  }
});
