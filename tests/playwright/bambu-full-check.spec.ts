import { test, expect, Page } from '@playwright/test';

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

test.describe.configure({ mode: 'serial' });

test.describe('Bambu Silver Full Check', () => {
  test('Step 1: Login succeeds', async ({ page }) => {
    // Go to login page
    await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    // Check if already on a /core page (already logged in)
    if (page.url().includes('/core')) {
      console.log('✅ Already authenticated — skipping login');
      await page.context().storageState({ path: 'tests/playwright/.auth/bambu-silver.json' });
      return;
    }

    // Fill login form
    await page.fill('input[name="email"]', LOGIN_EMAIL);
    await page.fill('input[name="password"]', LOGIN_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for navigation
    await page.waitForURL(/\/(core|dashboard|onboarding)/, { timeout: 20000 });
    await page.waitForTimeout(2000);

    const url = page.url();
    expect(url).not.toContain('/auth/login');
    console.log(`✅ Login successful → ${url}`);

    // Save state
    await page.context().storageState({ path: 'tests/playwright/.auth/bambu-silver.json' });
  });

  for (const pageInfo of ALL_PAGES) {
    test(`Step 2: ${pageInfo.name} (${pageInfo.path})`, async ({ page }) => {
      // Navigate — use longer timeout and don't wait for full load
      try {
        await page.goto(`${BASE_URL}${pageInfo.path}`, { timeout: 60000 });
      } catch (e: any) {
        // If it's a timeout, check if page loaded partially
        if (!e.message?.includes('timeout')) throw e;
      }
      
      // If redirected to login, re-authenticate
      if (page.url().includes('/auth/login')) {
        await page.fill('input[name="email"]', LOGIN_EMAIL);
        await page.fill('input[name="password"]', LOGIN_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL(/\/(core|dashboard)/, { timeout: 30000 });
        try {
          await page.goto(`${BASE_URL}${pageInfo.path}`, { timeout: 60000 });
        } catch { /* partial load ok */ }
      }

      await page.waitForTimeout(2500);

      // Checks
      const bodyText = await page.textContent('body') || '';
      expect(bodyText.length, 'Page is blank').toBeGreaterThan(50);

      // No error boundary
      const errBoundary = await page.locator('text="Something went wrong"').count();
      expect(errBoundary, 'Error boundary visible').toBe(0);

      // No NaN
      const hasNaN = bodyText.includes('NaN');
      expect(hasNaN, 'NaN visible').toBe(false);

      // Check for $ currency (should be Rp)
      const dollarMatches = bodyText.match(/\$\d[\d,.]*/g) || [];
      if (dollarMatches.length > 0) {
        console.warn(`  ⚠️ Found $ symbols: ${dollarMatches.slice(0, 3).join(', ')}`);
      }

      console.log(`  ✅ ${pageInfo.name} — OK (${bodyText.length} chars)`);
    });
  }
});
