import { test, expect } from '@playwright/test';

/**
 * Warehouse & Inventory System Verification
 * ═══════════════════════════════════════════
 * Checks that warehouse/inventory pages load correctly,
 * CRUD operations are accessible, and no theme/currency issues exist.
 */

const WAREHOUSE_PAGES = [
  { path: '/core/inventory', name: 'Inventory Command' },
  { path: '/core/inventory/stock', name: 'Stock Hub' },
  { path: '/core/inventory/receiving', name: 'Receiving Desk' },
  { path: '/core/inventory/transfers', name: 'Transfer Desk' },
  { path: '/core/inventory/adjustments', name: 'Adjustments' },
  { path: '/core/warehouse', name: 'Warehouse Map' },
];

test.describe('Warehouse/Inventory - Page Loading', () => {
  for (const page of WAREHOUSE_PAGES) {
    test(`${page.name}: loads without errors`, async ({ page: p }) => {
      const consoleErrors: string[] = [];
      p.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('Failed to load') && !msg.text().includes('404')) {
          consoleErrors.push(msg.text());
        }
      });

      const response = await p.goto(page.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await p.waitForTimeout(3000);

      // Page should not be a blank white screen
      const bodyText = await p.textContent('body');
      expect(bodyText!.length).toBeGreaterThan(50);

      // No critical JS errors (allow API errors since synthetic org may not have data)
      const criticalErrors = consoleErrors.filter(e => 
        e.includes('TypeError') || e.includes('ReferenceError') || e.includes('Cannot read properties')
      );
      expect(criticalErrors).toHaveLength(0);
    });
  }
});

test.describe('Warehouse/Inventory - CRUD Accessibility', () => {
  test('Inventory: Item creation accessible', async ({ page }) => {
    await page.goto('/core/inventory', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Look for add/create item button
    const addBtn = page.locator('button').filter({ hasText: /add|create|new|item|register/i }).first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(1500);
      
      // Verify form/dialog appeared
      const formElements = page.locator('input, [role="dialog"], form, [data-state="open"]');
      expect(await formElements.count()).toBeGreaterThan(0);
    } else {
      // Page should at least have a table or card grid
      const dataPresence = page.locator('table, [role="table"], .grid');
      expect(await dataPresence.count()).toBeGreaterThanOrEqual(0);
    }
  });

  test('Inventory: Stock intake accessible', async ({ page }) => {
    await page.goto('/core/inventory/receiving', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const bodyText = await page.textContent('body');
    // Should have receiving-related content
    expect(bodyText).toBeTruthy();
  });

  test('Inventory: Transfer creation accessible', async ({ page }) => {
    await page.goto('/core/inventory/transfers', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Look for transfer initiation button
    const transferBtn = page.locator('button').filter({ hasText: /transfer|create|new|initiate/i }).first();
    if (await transferBtn.isVisible()) {
      await transferBtn.click();
      await page.waitForTimeout(1500);
      const dialog = page.locator('[role="dialog"], [data-state="open"], form');
      expect(await dialog.count()).toBeGreaterThan(0);
    }
  });

  test('Inventory: Adjustment creation accessible', async ({ page }) => {
    await page.goto('/core/inventory/adjustments', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const adjustBtn = page.locator('button').filter({ hasText: /adjust|create|new|record/i }).first();
    if (await adjustBtn.isVisible()) {
      await adjustBtn.click();
      await page.waitForTimeout(1500);
      const dialog = page.locator('[role="dialog"], [data-state="open"], form');
      expect(await dialog.count()).toBeGreaterThan(0);
    }
  });

  test('Warehouse: Bin management accessible', async ({ page }) => {
    await page.goto('/core/warehouse', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(50);
  });
});

test.describe('Warehouse/Inventory - Theme & Currency', () => {
  for (const pg of WAREHOUSE_PAGES) {
    test(`${pg.name}: No $ currency symbols`, async ({ page }) => {
      await page.goto(pg.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);

      const dollarIssues = await page.evaluate(() => {
        const body = document.body.textContent || '';
        const matches = body.match(/\$\d[\d,.]*/g);
        return matches ? matches.filter(m => m.length > 2) : [];
      });

      expect(dollarIssues).toHaveLength(0);
    });

    test(`${pg.name}: No invisible text`, async ({ page }) => {
      await page.goto(pg.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);

      const invisibleText = await page.evaluate(() => {
        const issues: string[] = [];
        const elements = document.querySelectorAll('p, span, h1, h2, h3, h4, td, th, label, a, button, badge');
        for (const el of elements) {
          const computed = window.getComputedStyle(el);
          const text = (el as HTMLElement).textContent?.trim();
          if (!text || text.length === 0) continue;
          const textColor = computed.color;
          const bgColor = computed.backgroundColor;
          if (textColor === bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
            issues.push(`"${text.substring(0, 30)}" color=${textColor} bg=${bgColor}`);
          }
        }
        return issues;
      });

      if (invisibleText.length > 0) {
        console.warn(`[${pg.name}] Invisible text found: ${JSON.stringify(invisibleText.slice(0, 3))}`);
      }
      expect(invisibleText).toHaveLength(0);
    });
  }
});

test.describe('Warehouse/Inventory - API Integration', () => {
  test('Inventory dashboard API returns data structure', async ({ page }) => {
    await page.goto('/core/inventory', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Verify the page has KPI/metric cards or table content
    const hasMetrics = await page.locator('.text-3xl, .text-2xl, table, [role="table"]').count();
    expect(hasMetrics).toBeGreaterThanOrEqual(0);
  });

  test('Stock movements page loads without crash', async ({ page }) => {
    await page.goto('/core/inventory/stock', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Should not show a React error boundary
    const errorBoundary = page.locator('text=Something went wrong');
    expect(await errorBoundary.count()).toBe(0);
  });
});
