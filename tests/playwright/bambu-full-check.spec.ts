import { test, expect, Page, BrowserContext } from '@playwright/test';

/**
 * Full Application Render Check — Bambu Silver (Real Tenant)
 * Login: bambusilverkedonganan@gmail.com / Estella1234
 */

const BASE_URL = 'http://150.109.15.108:3010';
const LOGIN_EMAIL = 'bambusilverkedonganan@gmail.com';
const LOGIN_PASSWORD = 'Estella1234';

const ALL_PAGES = [
  { path: '/core', name: 'Dashboard' },
  { path: '/core/finance', name: 'Finance Home' },
  { path: '/core/finance/ledger', name: 'Finance Ledger' },
  { path: '/core/finance/treasury', name: 'Finance Treasury' },
  { path: '/core/finance/payflow', name: 'Finance PayFlow' },
  { path: '/core/finance/receivables', name: 'Finance Receivables' },
  { path: '/core/finance/payables', name: 'Finance Payables' },
  { path: '/core/finance/close', name: 'Finance Close Period' },
  { path: '/core/finance/assets', name: 'Finance Assets' },
  { path: '/core/finance/jv', name: 'Finance JV' },
  { path: '/core/finance/operations', name: 'Finance Operations' },
  { path: '/core/finance/workflow', name: 'Finance Workflow' },
  { path: '/core/finance/audit-log', name: 'Finance Audit Log' },
  { path: '/core/hr', name: 'HR Home' },
  { path: '/core/hr/people', name: 'HR People' },
  { path: '/core/hr/paycycle', name: 'HR PayCycle' },
  { path: '/core/hr/workflow', name: 'HR Workflow' },
  { path: '/core/hr/audit-log', name: 'HR Audit Log' },
  { path: '/core/procurement', name: 'Procurement Home' },
  { path: '/core/procurement/suppliers', name: 'Procurement Suppliers' },
  { path: '/core/procurement/po', name: 'Procurement PO' },
  { path: '/core/procurement/workflow', name: 'Procurement Workflow' },
  { path: '/core/procurement/audit-log', name: 'Procurement Audit Log' },
  { path: '/core/inventory', name: 'Inventory Home' },
  { path: '/core/inventory/stock', name: 'Inventory Stock' },
  { path: '/core/inventory/receiving', name: 'Inventory Receiving' },
  { path: '/core/inventory/transfers', name: 'Inventory Transfers' },
  { path: '/core/inventory/adjustments', name: 'Inventory Adjustments' },
  { path: '/core/inventory/workflow', name: 'Inventory Workflow' },
  { path: '/core/inventory/audit-log', name: 'Inventory Audit Log' },
  { path: '/core/warehouse', name: 'Warehouse Home' },
  { path: '/core/warehouse/receiving', name: 'Warehouse Receiving' },
  { path: '/core/warehouse/workflow', name: 'Warehouse Workflow' },
  { path: '/core/warehouse/audit', name: 'Warehouse Audit' },
  { path: '/core/sales', name: 'Sales Home' },
  { path: '/core/sales/leads', name: 'Sales Leads' },
  { path: '/core/sales/opportunities', name: 'Sales Opportunities' },
  { path: '/core/sales/quotes', name: 'Sales Quotes' },
  { path: '/core/sales/orders', name: 'Sales Orders' },
  { path: '/core/sales/workflow', name: 'Sales Workflow' },
  { path: '/core/sales/audit-log', name: 'Sales Audit Log' },
  { path: '/core/marketing', name: 'Marketing Home' },
  { path: '/core/marketing/campaigns', name: 'Marketing Campaigns' },
  { path: '/core/marketing/analytics', name: 'Marketing Analytics' },
  { path: '/core/marketing/leads', name: 'Marketing Leads' },
  { path: '/core/marketing/workflow', name: 'Marketing Workflow' },
  { path: '/core/marketing/audit-log', name: 'Marketing Audit Log' },
  { path: '/core/it', name: 'IT Home' },
  { path: '/core/it/devices', name: 'IT Devices' },
  { path: '/core/it/topology', name: 'IT Topology' },
  { path: '/core/it/accounts', name: 'IT Accounts' },
  { path: '/core/settings', name: 'Settings' },
];

// Use a single shared auth state file
const AUTH_FILE = 'tests/playwright/.auth/bambu-silver.json';

test.describe('Login', () => {
  test('Login as Bambu Silver owner succeeds', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    // Find and fill email
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill(LOGIN_EMAIL);

    // Fill password
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill(LOGIN_PASSWORD);

    // Submit
    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();

    // Wait for successful navigation away from login
    await page.waitForURL(/\/(core|dashboard|onboarding)/, { timeout: 20000 });
    await page.waitForTimeout(2000);

    // Confirm we're authenticated
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/auth/login');
    console.log(`✅ Login successful. Landed on: ${currentUrl}`);

    // Save auth state for subsequent tests
    await page.context().storageState({ path: AUTH_FILE });
  });
});

test.describe('All Pages Render Check', () => {
  test.use({ storageState: AUTH_FILE });

  for (const pageInfo of ALL_PAGES) {
    test(`${pageInfo.name} (${pageInfo.path})`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const t = msg.text();
          if (t.includes('TypeError') || t.includes('Cannot read properties')) {
            errors.push(t.substring(0, 120));
          }
        }
      });

      await page.goto(`${BASE_URL}${pageInfo.path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2500);

      // Check page rendered content
      const bodyLen = (await page.textContent('body') || '').length;
      expect(bodyLen, `Page is blank`).toBeGreaterThan(50);

      // No error boundaries
      const errBoundary = await page.locator('text="Something went wrong"').count();
      expect(errBoundary, `Error boundary visible`).toBe(0);

      // No NaN displayed
      const nanCount = await page.evaluate(() => (document.body.textContent || '').split('NaN').length - 1);
      expect(nanCount, `NaN visible on page`).toBe(0);

      // No critical JS errors
      if (errors.length > 0) {
        console.warn(`  ⚠️ JS Errors: ${errors[0]}`);
      }
      expect(errors.length, `Critical JS errors`).toBe(0);

      console.log(`  ✅ ${pageInfo.name} — rendered (${bodyLen} chars)`);
    });
  }
});
