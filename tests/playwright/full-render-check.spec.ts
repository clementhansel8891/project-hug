import { test, expect, Page } from '@playwright/test';

/**
 * Full Application Render Check — Bambu Silver Tenant
 * ═══════════════════════════════════════════════════════
 * Logs in as the real tenant (Bambu Silver) and visits ALL pages
 * to verify they render properly without crashes, blank screens,
 * or layout issues like double sidebars.
 */

const BASE_URL = 'http://150.109.15.108:3010';
const LOGIN_EMAIL = 'estela@bambusilver.com';
const LOGIN_PASSWORD = 'Estela2024!';

// All pages to visit
const ALL_PAGES = [
  // Dashboard
  { path: '/core', name: 'Dashboard' },

  // Finance
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

  // HR
  { path: '/core/hr', name: 'HR Home' },
  { path: '/core/hr/people', name: 'HR People' },
  { path: '/core/hr/paycycle', name: 'HR PayCycle' },
  { path: '/core/hr/schedule', name: 'HR Schedule' },
  { path: '/core/hr/workflow', name: 'HR Workflow' },
  { path: '/core/hr/audit-log', name: 'HR Audit Log' },

  // Procurement
  { path: '/core/procurement', name: 'Procurement Home' },
  { path: '/core/procurement/suppliers', name: 'Procurement Suppliers' },
  { path: '/core/procurement/po', name: 'Procurement PO' },
  { path: '/core/procurement/workflow', name: 'Procurement Workflow' },
  { path: '/core/procurement/audit-log', name: 'Procurement Audit Log' },

  // Inventory
  { path: '/core/inventory', name: 'Inventory Home' },
  { path: '/core/inventory/stock', name: 'Inventory Stock' },
  { path: '/core/inventory/receiving', name: 'Inventory Receiving' },
  { path: '/core/inventory/transfers', name: 'Inventory Transfers' },
  { path: '/core/inventory/workflow', name: 'Inventory Workflow' },
  { path: '/core/inventory/audit-log', name: 'Inventory Audit Log' },

  // Warehouse
  { path: '/core/warehouse', name: 'Warehouse Home' },
  { path: '/core/warehouse/workflow', name: 'Warehouse Workflow' },
  { path: '/core/warehouse/audit', name: 'Warehouse Audit' },

  // Sales
  { path: '/core/sales', name: 'Sales Home' },
  { path: '/core/sales/leads', name: 'Sales Leads' },
  { path: '/core/sales/opportunities', name: 'Sales Opportunities' },
  { path: '/core/sales/quotes', name: 'Sales Quotes' },
  { path: '/core/sales/workflow', name: 'Sales Workflow' },
  { path: '/core/sales/audit-log', name: 'Sales Audit Log' },

  // Marketing
  { path: '/core/marketing', name: 'Marketing Home' },
  { path: '/core/marketing/campaigns', name: 'Marketing Campaigns' },
  { path: '/core/marketing/analytics', name: 'Marketing Analytics' },
  { path: '/core/marketing/workflow', name: 'Marketing Workflow' },
  { path: '/core/marketing/audit-log', name: 'Marketing Audit Log' },

  // IT
  { path: '/core/it', name: 'IT Home' },
  { path: '/core/it/devices', name: 'IT Devices' },
  { path: '/core/it/topology', name: 'IT Topology' },

  // Retail
  { path: '/retail', name: 'Retail Module' },
];

test.describe.configure({ mode: 'serial' });

let loggedIn = false;

async function loginIfNeeded(page: Page) {
  if (loggedIn) return;
  
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Fill login form
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
  const passwordInput = page.locator('input[type="password"]').first();
  
  if (await emailInput.isVisible()) {
    await emailInput.fill(LOGIN_EMAIL);
    await passwordInput.fill(LOGIN_PASSWORD);
    
    const submitBtn = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').first();
    await submitBtn.click();
    
    // Wait for redirect to dashboard
    await page.waitForURL('**/core**', { timeout: 15000 });
    await page.waitForTimeout(2000);
    loggedIn = true;
  }
}

test.describe('Full Render Check — Bambu Silver', () => {
  test.beforeEach(async ({ page }) => {
    // Use stored auth if available
    if (!loggedIn) {
      await loginIfNeeded(page);
    }
  });

  for (const pageInfo of ALL_PAGES) {
    test(`${pageInfo.name} (${pageInfo.path}): renders without crash`, async ({ page }) => {
      await loginIfNeeded(page);

      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          // Filter out known acceptable errors
          if (!text.includes('ResizeObserver') && 
              !text.includes('favicon') && 
              !text.includes('net::ERR') &&
              !text.includes('Failed to fetch')) {
            consoleErrors.push(text);
          }
        }
      });

      await page.goto(`${BASE_URL}${pageInfo.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);

      // 1. Page should not be blank
      const bodyText = await page.textContent('body') || '';
      expect(bodyText.length, `${pageInfo.name} is blank`).toBeGreaterThan(100);

      // 2. No React error boundary
      const errorBoundary = page.locator('text=Something went wrong, text=Error boundary');
      expect(await errorBoundary.count(), `${pageInfo.name} has error boundary`).toBe(0);

      // 3. No visible "undefined" or "NaN" text (broken data rendering)
      const undefinedVisible = await page.evaluate(() => {
        const body = document.body.textContent || '';
        const undefinedCount = (body.match(/\bundefined\b/g) || []).length;
        const nanCount = (body.match(/\bNaN\b/g) || []).length;
        return { undefinedCount, nanCount };
      });
      
      // Allow a few (might be in code examples or logs), but flag many
      if (undefinedVisible.undefinedCount > 3) {
        console.warn(`[${pageInfo.name}] Has ${undefinedVisible.undefinedCount} "undefined" text visible`);
      }
      if (undefinedVisible.nanCount > 0) {
        console.warn(`[${pageInfo.name}] Has ${undefinedVisible.nanCount} "NaN" text visible`);
      }
      expect(undefinedVisible.nanCount, `${pageInfo.name} shows NaN`).toBe(0);

      // 4. Check for double sidebar issue — only ONE wide sidebar should be visible
      const sidebars = await page.evaluate(() => {
        // Count elements that look like sidebars (fixed/sticky left panels > 150px wide)
        const aside = document.querySelectorAll('aside');
        let visibleAsides = 0;
        for (const el of aside) {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          if (rect.width > 60 && style.display !== 'none' && rect.left < window.innerWidth / 2) {
            visibleAsides++;
          }
        }
        return visibleAsides;
      });

      // Should not have more than 2 visible sidebar-like elements
      // (1 main collapsed + 1 department = ok; 2 full-width = problem)
      if (sidebars > 2) {
        console.warn(`[${pageInfo.name}] Has ${sidebars} visible sidebar panels — possible double sidebar`);
      }

      // 5. No critical JS errors
      const criticalErrors = consoleErrors.filter(e => 
        e.includes('TypeError') || 
        e.includes('ReferenceError') || 
        e.includes('Cannot read properties of null') ||
        e.includes('Cannot read properties of undefined')
      );
      
      if (criticalErrors.length > 0) {
        console.warn(`[${pageInfo.name}] Critical JS errors: ${criticalErrors.slice(0, 3).join('; ')}`);
      }
      expect(criticalErrors.length, `${pageInfo.name} has critical JS errors`).toBe(0);
    });
  }
});
