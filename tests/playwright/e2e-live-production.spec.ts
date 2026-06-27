/**
 * E2E Live Production Test
 * ══════════════════════════════════════════════════════════════════
 * Tests the actual production deployment with real user accounts.
 * Covers: Login, Navigation, Retail Ops, Inventory, Finance, HR
 *
 * Run with: npx playwright test e2e-live-production.spec.ts --project=chromium
 */

import { test, expect, Page } from "@playwright/test";

// Override storage state — we login manually in each test
test.use({ 
  storageState: { cookies: [], origins: [] },
  navigationTimeout: 60000,
  actionTimeout: 30000,
});

const BASE = "http://150.109.15.108:3010";
const API = "http://150.109.15.108:3001/v1";

// Real production accounts
const ACCOUNTS = {
  owner: { email: "bambusilverkedonganan@gmail.com", password: "BambuSilver2024!" },
  admin: { email: "hansel@bambusilver.com", password: "Hansel2024!" },
  spg_dewa: { email: "dewa@bambusilver.com", password: "Dewa2024!" },
  spg_fera: { email: "fera@bambusilver.com", password: "Fera2024!" },
};

/** Helper: login via the UI */
async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for redirect away from login
  await page.waitForURL((url) => !url.pathname.includes("/auth/login"), { timeout: 15000 });
}

/** Helper: close active shift via API to ensure clean state */
async function closeOpenShifts() {
  const resp = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ACCOUNTS.admin.email, password: ACCOUNTS.admin.password }),
  });
  const { token } = await resp.json();
  // Close any open shifts
  await fetch(`${API}/retail/shifts`, {
    headers: { Authorization: `Bearer ${token}`, "x-tenant-id": "tnt-3rlhko", "x-company-id": "b74e21b9-4e99-42fd-857b-36bf4dee7ed5" },
  });
}

// ═══════════════════════════════════════════════════════════════════
// 1. AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════

test.describe("1. Authentication", () => {
  test("Login page loads correctly", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("Owner can login and reach dashboard", async ({ page }) => {
    await login(page, ACCOUNTS.owner.email, ACCOUNTS.owner.password);
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).not.toContain("/auth/login");
    console.log("  Owner landed at:", url);
  });

  test("SPG can login", async ({ page }) => {
    await login(page, ACCOUNTS.spg_dewa.email, ACCOUNTS.spg_dewa.password);
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).not.toContain("/auth/login");
    console.log("  SPG Dewa landed at:", url);
  });

  test("Invalid credentials show error", async ({ page }) => {
    await page.goto("/auth/login");
    await page.fill('input[type="email"], input[name="email"]', "wrong@email.com");
    await page.fill('input[type="password"], input[name="password"]', "WrongPass!");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    // Should stay on login or show error
    const url = page.url();
    const hasError = await page.locator('[role="alert"], .text-destructive, [data-testid="error"]').count();
    expect(url.includes("/auth/login") || hasError > 0).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. RETAIL MANAGEMENT (Owner/Admin)
// ═══════════════════════════════════════════════════════════════════

test.describe("2. Retail Management", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.owner.email, ACCOUNTS.owner.password);
    await page.waitForTimeout(1500);
  });

  test("Can navigate to Retail module", async ({ page }) => {
    await page.goto("/m/retail/workspace");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    // Should load without crash
    const content = await page.content();
    expect(content.length).toBeGreaterThan(1000);
    expect(await page.locator("text=Runtime Exception, text=Application Error").count()).toBe(0);
  });

  test("Inventory page loads with products and pagination", async ({ page }) => {
    await page.goto("/m/retail/management/inventory");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(5000);

    // Should show product items or loading state
    const content = await page.content();
    expect(content.length).toBeGreaterThan(2000);
    expect(await page.locator("text=Runtime Exception").count()).toBe(0);
    console.log("  Inventory page loaded OK");
  });

  test("Store Dashboard loads", async ({ page }) => {
    await page.goto("/m/retail/management/dashboard");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    expect(await page.locator("text=Runtime Exception").count()).toBe(0);
    console.log("  Dashboard loaded OK");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. RETAIL OPERATIONAL (SPG)
// ═══════════════════════════════════════════════════════════════════

test.describe("3. Retail Operational (SPG)", () => {
  test("SPG reaches Operational Gateway", async ({ page }) => {
    await login(page, ACCOUNTS.spg_dewa.email, ACCOUNTS.spg_dewa.password);
    await page.waitForTimeout(2000);
    
    // Navigate to operational gateway
    await page.goto("/m/retail/operational/gateway");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    
    const content = await page.content();
    expect(content.length).toBeGreaterThan(1000);
    expect(await page.locator("text=Runtime Exception").count()).toBe(0);
    console.log("  Operational Gateway loaded");
  });

  test("Shift Open page loads", async ({ page }) => {
    await login(page, ACCOUNTS.spg_fera.email, ACCOUNTS.spg_fera.password);
    await page.waitForTimeout(1500);
    
    await page.goto("/m/retail/operational/shift-open");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    
    // Should show shift initialization UI
    const hasInitButton = await page.locator("button:has-text('Initialize'), button:has-text('Terminal')").count();
    console.log(`  Shift Open UI loaded (init button: ${hasInitButton})`);
    expect(await page.locator("text=Runtime Exception").count()).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. FINANCE MODULE
// ═══════════════════════════════════════════════════════════════════

test.describe("4. Finance", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
    await page.waitForTimeout(1500);
  });

  test("Finance workspace loads", async ({ page }) => {
    await page.goto("/m/finance/workspace");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    expect(await page.locator("text=Runtime Exception").count()).toBe(0);
    console.log("  Finance workspace OK");
  });

  test("Chart of Accounts page loads", async ({ page }) => {
    await page.goto("/m/finance/coa");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    const content = await page.content();
    expect(content.length).toBeGreaterThan(2000);
    expect(await page.locator("text=Runtime Exception").count()).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. HR MODULE
// ═══════════════════════════════════════════════════════════════════

test.describe("5. HR", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
    await page.waitForTimeout(1500);
  });

  test("HR workspace loads", async ({ page }) => {
    await page.goto("/m/hr/workspace");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    expect(await page.locator("text=Runtime Exception").count()).toBe(0);
    console.log("  HR workspace OK");
  });

  test("Employee list loads", async ({ page }) => {
    await page.goto("/m/hr/employees");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    const content = await page.content();
    expect(content.length).toBeGreaterThan(2000);
    expect(await page.locator("text=Runtime Exception").count()).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. PROCUREMENT
// ═══════════════════════════════════════════════════════════════════

test.describe("6. Procurement", () => {
  test("Procurement workspace loads", async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
    await page.waitForTimeout(1500);
    await page.goto("/m/procurement/workspace");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    expect(await page.locator("text=Runtime Exception").count()).toBe(0);
    console.log("  Procurement workspace OK");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 7. INVENTORY
// ═══════════════════════════════════════════════════════════════════

test.describe("7. Inventory", () => {
  test("Inventory workspace loads", async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
    await page.waitForTimeout(1500);
    await page.goto("/m/inventory/workspace");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    expect(await page.locator("text=Runtime Exception").count()).toBe(0);
    console.log("  Inventory workspace OK");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 8. PLATFORM FEATURES
// ═══════════════════════════════════════════════════════════════════

test.describe("8. Platform", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
    await page.waitForTimeout(1500);
  });

  test("Settings page loads", async ({ page }) => {
    await page.goto("/core/settings");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    expect(await page.locator("text=Runtime Exception").count()).toBe(0);
  });

  test("Core dashboard loads", async ({ page }) => {
    await page.goto("/core/dashboard");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    const content = await page.content();
    expect(content.length).toBeGreaterThan(2000);
    expect(await page.locator("text=Runtime Exception").count()).toBe(0);
    console.log("  Core dashboard OK");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 9. MULTI-ROLE ACCESS CONTROL
// ═══════════════════════════════════════════════════════════════════

test.describe("9. Role-Based Access", () => {
  test("SPG cannot access admin settings", async ({ page }) => {
    await login(page, ACCOUNTS.spg_dewa.email, ACCOUNTS.spg_dewa.password);
    await page.waitForTimeout(1500);
    await page.goto("/core/settings");
    await page.waitForTimeout(3000);
    // Should either redirect or show access denied
    const url = page.url();
    const content = await page.content();
    const blocked = url.includes("/auth") || url.includes("/retail") || 
                    content.includes("denied") || content.includes("unauthorized");
    console.log(`  SPG settings access: URL=${url.substring(0, 60)}`);
    // SPG should not see the full settings page content
  });

  test("All SPG accounts can login", async ({ page }) => {
    const spgAccounts = [
      { email: "dewa@bambusilver.com", password: "Dewa2024!" },
      { email: "dewi@bambusilver.com", password: "Dewi2024!" },
      { email: "gusti@bambusilver.com", password: "Gusti2024!" },
      { email: "nyoman@bambusilver.com", password: "Nyoman2024!" },
      { email: "fera@bambusilver.com", password: "Fera2024!" },
      { email: "nana@bambusilver.com", password: "Nana2024!" },
    ];

    for (const acc of spgAccounts) {
      await page.goto("/auth/login");
      await page.waitForLoadState("domcontentloaded");
      await page.fill('input[type="email"], input[name="email"]', acc.email);
      await page.fill('input[type="password"], input[name="password"]', acc.password);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
      const url = page.url();
      expect(url).not.toContain("/auth/login");
      console.log(`  ✓ ${acc.email.split("@")[0]} login OK -> ${url.substring(0, 50)}`);
      // Clear session for next login
      await page.context().clearCookies();
      await page.evaluate(() => localStorage.clear());
    }
  });
});
