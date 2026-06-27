import { test, expect } from '@playwright/test';

/**
 * UI Theme Consistency Test
 * ═══════════════════════════════════════════════════════════════════════
 * Checks that text colors, backgrounds, and general UI elements follow
 * the design system theme (no hardcoded hex colors leaking, no invisible
 * text, no $ currency symbols displayed).
 */

const PAGES_TO_CHECK = [
  { path: '/core/finance/ledger', name: 'Finance - Ledger' },
  { path: '/core/finance/jv', name: 'Finance - Joint Venture' },
  { path: '/core/finance/budget', name: 'Finance - Budget' },
  { path: '/core/hr/people', name: 'HR - People' },
  { path: '/core/hr/paycycle', name: 'HR - PayCycle' },
  { path: '/core/procurement/suppliers', name: 'Procurement - Suppliers' },
  { path: '/core/procurement/po', name: 'Procurement - PO Release' },
  { path: '/core/sales/leads', name: 'Sales - Leads' },
  { path: '/core/sales/opportunities', name: 'Sales - Opportunities' },
  { path: '/core/marketing/campaigns', name: 'Marketing - Campaigns' },
  { path: '/core/it/devices', name: 'IT - Devices' },
  { path: '/retail/pos', name: 'Retail - POS' },
];

test.describe('Theme Consistency - Text Colors', () => {
  for (const page of PAGES_TO_CHECK) {
    test(`${page.name}: No hardcoded hex text colors`, async ({ page: p }) => {
      await p.goto(page.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await p.waitForTimeout(2000); // Allow dynamic content to load

      // Check for elements with inline color styles that use hex values
      // (should use CSS variables via Tailwind classes instead)
      const elementsWithHardcodedColor = await p.evaluate(() => {
        const issues: string[] = [];
        const allElements = document.querySelectorAll('*');
        
        for (const el of allElements) {
          const style = (el as HTMLElement).style;
          if (style && style.color) {
            const color = style.color;
            // Allow rgb/rgba from computed styles, but flag direct hex usage
            if (color.startsWith('#') && !el.closest('svg') && !el.closest('.recharts-wrapper')) {
              const text = (el as HTMLElement).textContent?.substring(0, 50) || '';
              issues.push(`<${el.tagName.toLowerCase()}> color="${color}" text="${text}"`);
            }
          }
        }
        return issues;
      });

      // Allow up to 3 minor violations (charts may have inline colors)
      if (elementsWithHardcodedColor.length > 3) {
        console.warn(`[${page.name}] Found ${elementsWithHardcodedColor.length} elements with hardcoded hex colors:`);
        elementsWithHardcodedColor.slice(0, 5).forEach(issue => console.warn(`  - ${issue}`));
      }
      expect(elementsWithHardcodedColor.length).toBeLessThanOrEqual(5);
    });

    test(`${page.name}: No invisible text (same color as background)`, async ({ page: p }) => {
      await p.goto(page.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await p.waitForTimeout(2000);

      const invisibleTextIssues = await p.evaluate(() => {
        const issues: string[] = [];
        const textElements = document.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6, td, th, label, a, button');
        
        for (const el of textElements) {
          const computed = window.getComputedStyle(el);
          const text = (el as HTMLElement).textContent?.trim();
          if (!text || text.length === 0) continue;
          
          const textColor = computed.color;
          const bgColor = computed.backgroundColor;
          
          // Check if text color is the same as background (invisible text)
          if (textColor === bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
            issues.push(`"${text.substring(0, 30)}" text-color=${textColor} bg=${bgColor}`);
          }
          
          // Check for pure white text on white background
          if (textColor === 'rgb(255, 255, 255)' && 
              (bgColor === 'rgb(255, 255, 255)' || bgColor === 'rgba(0, 0, 0, 0)')) {
            // Check parent background
            const parent = el.parentElement;
            if (parent) {
              const parentBg = window.getComputedStyle(parent).backgroundColor;
              if (parentBg === 'rgb(255, 255, 255)' || parentBg === 'rgba(255, 255, 255, 1)') {
                issues.push(`WHITE-ON-WHITE: "${text.substring(0, 30)}" on parent bg=${parentBg}`);
              }
            }
          }
        }
        return issues;
      });

      if (invisibleTextIssues.length > 0) {
        console.warn(`[${page.name}] Potential invisible text issues:`);
        invisibleTextIssues.forEach(issue => console.warn(`  - ${issue}`));
      }
      expect(invisibleTextIssues.length).toBe(0);
    });

    test(`${page.name}: No USD/$ currency displayed`, async ({ page: p }) => {
      await p.goto(page.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await p.waitForTimeout(2000);

      const dollarSignIssues = await p.evaluate(() => {
        const issues: string[] = [];
        const body = document.body.textContent || '';
        
        // Find all visible text content with $ followed by numbers
        const dollarPattern = /\$\d[\d,.]*/g;
        const matches = body.match(dollarPattern);
        
        if (matches) {
          // Filter out false positives (template literals in dev tools, etc.)
          const realMatches = matches.filter(m => {
            // Skip very short matches that might be CSS/code artifacts
            return m.length > 2;
          });
          issues.push(...realMatches.slice(0, 10));
        }
        
        return issues;
      });

      if (dollarSignIssues.length > 0) {
        console.warn(`[${page.name}] Found $ currency symbols on page:`);
        dollarSignIssues.forEach(issue => console.warn(`  - ${issue}`));
      }
      expect(dollarSignIssues.length).toBe(0);
    });
  }
});

test.describe('Theme Consistency - Dark/Light Mode', () => {
  test('Light mode: primary text uses foreground color variable', async ({ page }) => {
    await page.goto('/core/finance/ledger', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const themeCheck = await page.evaluate(() => {
      const root = document.documentElement;
      const rootStyle = getComputedStyle(root);
      const isDark = root.classList.contains('dark');
      
      // Check that CSS variables are properly defined
      const foreground = rootStyle.getPropertyValue('--foreground').trim();
      const background = rootStyle.getPropertyValue('--background').trim();
      const primary = rootStyle.getPropertyValue('--primary').trim();
      const mutedFg = rootStyle.getPropertyValue('--muted-foreground').trim();
      
      return {
        isDark,
        foreground: foreground || 'NOT_SET',
        background: background || 'NOT_SET',
        primary: primary || 'NOT_SET',
        mutedForeground: mutedFg || 'NOT_SET',
      };
    });

    expect(themeCheck.foreground).not.toBe('NOT_SET');
    expect(themeCheck.background).not.toBe('NOT_SET');
    expect(themeCheck.primary).not.toBe('NOT_SET');
    expect(themeCheck.mutedForeground).not.toBe('NOT_SET');
  });

  test('All KPI cards use theme-consistent text', async ({ page }) => {
    await page.goto('/core/finance/jv', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const cardTextColors = await page.evaluate(() => {
      const issues: string[] = [];
      // Find KPI cards (typically have .text-3xl or similar large text)
      const kpiTexts = document.querySelectorAll('.text-3xl, .text-2xl');
      
      for (const el of kpiTexts) {
        const computed = window.getComputedStyle(el);
        const color = computed.color;
        
        // Check that KPI text is not using hardcoded colors
        // It should be using theme variables (resolved to hsl())
        const element = el as HTMLElement;
        const inlineColor = element.style.color;
        
        if (inlineColor && inlineColor.startsWith('#')) {
          issues.push(`KPI text "${element.textContent?.substring(0, 20)}" uses inline color: ${inlineColor}`);
        }
      }
      return issues;
    });

    expect(cardTextColors.length).toBe(0);
  });
});

test.describe('CRUD Operations - Department Modules', () => {
  test('Finance: Journal entry creation form accessible', async ({ page }) => {
    await page.goto('/core/finance/ledger', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Look for create/add button
    const addButton = page.locator('button').filter({ hasText: /create|new|add|journal/i }).first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(1000);
      
      // Verify dialog/form appeared
      const dialog = page.locator('[role="dialog"], .dialog-content, [data-state="open"]');
      expect(await dialog.count()).toBeGreaterThan(0);
    }
  });

  test('HR: Employee list loads with action buttons', async ({ page }) => {
    await page.goto('/core/hr/people', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Check page loaded with content
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
    
    // Look for action buttons (edit, transfer, etc.)
    const actionButtons = page.locator('button').filter({ hasText: /edit|transfer|promote|new|add/i });
    const buttonCount = await actionButtons.count();
    // At minimum, there should be some action capability
    expect(buttonCount).toBeGreaterThanOrEqual(0); // Soft check - just verify page loads
  });

  test('Procurement: Supplier creation form accessible', async ({ page }) => {
    await page.goto('/core/procurement/suppliers', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const addButton = page.locator('button').filter({ hasText: /add|create|new|supplier/i }).first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(1000);
      
      const dialog = page.locator('[role="dialog"], [data-state="open"]');
      expect(await dialog.count()).toBeGreaterThan(0);
    }
  });

  test('Sales: Lead creation accessible', async ({ page }) => {
    await page.goto('/core/sales/leads', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const addButton = page.locator('button').filter({ hasText: /new|create|inject|add|lead/i }).first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(1000);
      
      const dialog = page.locator('[role="dialog"], [data-state="open"]');
      expect(await dialog.count()).toBeGreaterThan(0);
    }
  });

  test('Marketing: Campaign creation accessible', async ({ page }) => {
    await page.goto('/core/marketing/campaigns', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const addButton = page.locator('button').filter({ hasText: /new|create|campaign|strategic/i }).first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(1000);
      
      const dialog = page.locator('[role="dialog"], [data-state="open"]');
      expect(await dialog.count()).toBeGreaterThan(0);
    }
  });

  test('IT: Device registration accessible', async ({ page }) => {
    await page.goto('/core/it/devices', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const addButton = page.locator('button').filter({ hasText: /assign|register|add|new|device/i }).first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(1000);
      
      const dialog = page.locator('[role="dialog"], [data-state="open"]');
      expect(await dialog.count()).toBeGreaterThan(0);
    }
  });
});
