/**
 * Retry failed pages with extended timeout (60s per page)
 * Run: npx tsx tests/playwright/screenshot-retry-failed.ts
 */
import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "http://150.109.15.108:3010";
const CREDENTIALS = { email: "estela@bambusilver.com", password: "Estella2024!" };
const SCREENSHOT_DIR = "tests/playwright/screenshots/audit";

// Failed pages from the first run
const FAILED_ROUTES: Record<string, string> = {
  "hr_scheduling": "/core/hr/scheduling",
  "hr_payroll": "/core/hr/pay-cycle",
  "hr_vault": "/core/hr/vault",
  "hr_lex": "/core/hr/lex-board",
  "hr_cases": "/core/hr/cases",
  "sales_overview": "/core/sales/overview",
  "sales_leads": "/core/sales/leads",
  "sales_pipeline": "/core/sales/pipeline",
  "sales_opportunities": "/core/sales/opportunities",
  "sales_incentives": "/core/sales/incentives",
  "marketing_campaigns": "/core/marketing/campaigns",
  "marketing_funnels": "/core/marketing/funnels",
  "inventory_opname": "/core/inventory/stock-opname",
  "warehouse_mgmt": "/core/warehouse",
  "it_health": "/core/it/health",
  "comms_mail": "/core/comms/mail",
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
  await page.waitForTimeout(5000);
  console.log(`✅ Logged in → ${page.url()}`);

  let success = 0, fail = 0;

  for (const theme of ["light", "dark"] as const) {
    console.log(`\n🎨 === ${theme.toUpperCase()} THEME (retry with 60s timeout) ===`);

    for (const [name, route] of Object.entries(FAILED_ROUTES)) {
      try {
        // Navigate with extended timeout
        await page.goto(`${BASE_URL}${route}`, { timeout: 60000, waitUntil: "load" });
        // Extra wait for heavy pages to render
        await page.waitForTimeout(5000);

        // Set theme
        await page.evaluate((t) => {
          document.documentElement.classList.remove("light", "dark");
          document.documentElement.classList.add(t);
          localStorage.setItem("theme", t);
          localStorage.setItem("vite-ui-theme", t);
        }, theme);
        await page.waitForTimeout(500);

        await page.screenshot({ path: `${SCREENSHOT_DIR}/${theme}/${name}.png`, fullPage: true });
        console.log(`  ✅ ${name}`);
        success++;
      } catch (e: any) {
        console.log(`  ❌ ${name} — ${e.message?.slice(0, 80)}`);
        fail++;
        // Still capture whatever is visible
        try {
          await page.screenshot({ path: `${SCREENSHOT_DIR}/${theme}/${name}-timeout.png`, fullPage: true });
          console.log(`     📸 Captured partial screenshot`);
        } catch {}
      }
    }
  }

  console.log(`\n${"═".repeat(50)}`);
  console.log(`📊 RETRY DONE: ${success} captured, ${fail} still failing`);
  await browser.close();
}

main().catch(console.error);
