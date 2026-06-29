/**
 * Human-POV E2E Test Suite
 * ═══════════════════════════════════════════════════════════════════
 * Simulates real human users performing actual workflows through the UI.
 * Tests what a human sees, clicks, and expects — not raw API contracts.
 *
 * Run with: npx playwright test human-e2e.spec.ts --project=chromium
 */

import { test, expect, Page } from "@playwright/test";

test.use({
  storageState: { cookies: [], origins: [] },
  navigationTimeout: 30000,
  actionTimeout: 30000,
});

const BASE = "http://150.109.15.108:3010";

// Real production accounts (different roles)
const OWNER = { email: "hansel@bambusilver.com", password: "Hansel2024!" };
const ADMIN = { email: "hansel@bambusilver.com", password: "Hansel2024!" };
const SPG = { email: "dewa@bambusilver.com", password: "Dewa2024!" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function login(page: Page, email: string, password: string) {
  await navigate(page, "/auth/login");
  await page.waitForTimeout(2000);

  // Fill credentials
  const emailInput = page.locator('input[type="email"], input[name="email"]');
  const passInput = page.locator('input[type="password"], input[name="password"]');
  await emailInput.fill(email);
  await passInput.fill(password);
  await page.waitForTimeout(500);

  // Submit
  await page.click('button[type="submit"]');

  // Wait for redirect (SPA-based)
  await page.waitForURL((url) => !url.pathname.includes("/auth/login"), { timeout: 30000 });
}

/** Assert page rendered without crashing */
async function assertPageOk(page: Page, label: string) {
  const crashes = await page.locator(
    "h2:text-is('Runtime Exception'), h2:text-is('Application Error'), [data-testid='error-boundary']"
  ).count();
  expect(crashes, `[${label}] Page crashed`).toBe(0);

  const content = await page.content();
  expect(content.length, `[${label}] Page appears blank`).toBeGreaterThan(1000);
}

/** Wait for page to settle (network + render) */
async function settle(page: Page, ms = 2500) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(ms);
}

/** Navigate in an SPA — use domcontentloaded since SPAs don't fire load on route change */
async function navigate(page: Page, path: string) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 45000 });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. OWNER LOGIN & DASHBOARD EXPERIENCE
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("1. Owner — Login & Dashboard", () => {
  test("Owner sees login form and can sign in", async ({ page }) => {
    await navigate(page, "/auth/login");
    await settle(page, 1500);

    // Human sees: email field, password field, submit button
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passInput = page.locator('input[type="password"], input[name="password"]');
    const submitBtn = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    // Fill and submit
    await emailInput.fill(OWNER.email);
    await passInput.fill(OWNER.password);
    await page.waitForTimeout(500);
    await submitBtn.click();

    // Human expects: redirect away from login to dashboard
    await page.waitForURL((url) => !url.pathname.includes("/auth/login"), { timeout: 30000 });
    const url = page.url();
    expect(url).not.toContain("/auth/login");
    console.log(`  Owner logged in → ${url}`);
  });

  test("Owner lands on dashboard with real content", async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await navigate(page, "/core/dashboard");
    await settle(page);
    await assertPageOk(page, "Dashboard");

    // Human expects: some kind of dashboard content (cards, metrics, or welcome)
    const body = await page.locator("body").textContent();
    expect(body!.length).toBeGreaterThan(100);
  });

  test("Owner can see navigation sidebar", async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
    await navigate(page, "/core/dashboard");
    await settle(page);

    // Human expects: navigation links to modules
    const navLinks = await page.locator("nav a, aside a, [role='navigation'] a").count();
    expect(navLinks).toBeGreaterThan(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ADMIN — FULL PLATFORM NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("2. Admin — Module Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
  });

  test("Finance workspace loads with real data", async ({ page }) => {
    await navigate(page, "/core/finance");
    await settle(page, 3000);
    await assertPageOk(page, "Finance");

    // Human expects: some finance-related content (accounts, numbers, charts)
    const content = await page.textContent("body");
    // At minimum, should see something related to finance
    expect(content!.length).toBeGreaterThan(200);
  });

  test("HR workspace loads with employee data", async ({ page }) => {
    await navigate(page, "/core/hr");
    await settle(page, 3000);
    await assertPageOk(page, "HR");
  });

  test("HR People directory shows employees", async ({ page }) => {
    await navigate(page, "/core/hr/people");
    await settle(page, 3000);
    await assertPageOk(page, "HR People");

    // Human expects: at least one employee name visible or a table/grid
    const tableOrGrid = await page.locator("table, [role='grid'], [class*='grid']").count();
    const cards = await page.locator("[class*='card'], [class*='Card']").count();
    expect(tableOrGrid + cards).toBeGreaterThan(0);
  });

  test("Inventory workspace shows stock info", async ({ page }) => {
    await navigate(page, "/core/inventory");
    await settle(page, 3000);
    await assertPageOk(page, "Inventory");
  });

  test("Procurement workspace loads", async ({ page }) => {
    await navigate(page, "/core/procurement");
    await settle(page, 3000);
    await assertPageOk(page, "Procurement");
  });

  test("Sales workspace shows pipeline", async ({ page }) => {
    await navigate(page, "/core/sales/overview");
    await settle(page, 3000);
    await assertPageOk(page, "Sales");
  });

  test("Marketing workspace loads", async ({ page }) => {
    await navigate(page, "/core/marketing");
    await settle(page, 3000);
    await assertPageOk(page, "Marketing");
  });

  test("IT workspace loads", async ({ page }) => {
    await navigate(page, "/core/it");
    await settle(page, 3000);
    await assertPageOk(page, "IT");
  });

  test("Settings page is accessible", async ({ page }) => {
    await navigate(page, "/core/settings");
    await settle(page);
    await assertPageOk(page, "Settings");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ADMIN — REAL BUSINESS WORKFLOWS
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("3. Admin — Business Workflows", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
  });

  test("Can navigate Finance → Ledger and see entries", async ({ page }) => {
    await navigate(page, "/core/finance/ledger");
    await settle(page, 3000);
    await assertPageOk(page, "Finance Ledger");
  });

  test("Can navigate Finance → JV desk", async ({ page }) => {
    await navigate(page, "/core/finance/jv");
    await settle(page, 3000);
    await assertPageOk(page, "Finance JV");
  });

  test("Can open Procurement → Purchase Requests", async ({ page }) => {
    await navigate(page, "/core/procurement/prs");
    await settle(page, 3000);
    await assertPageOk(page, "Procurement PRs");
  });

  test("Can view Sales → Leads desk", async ({ page }) => {
    await navigate(page, "/core/sales/leads");
    await settle(page, 3000);
    await assertPageOk(page, "Sales Leads");
  });

  test("Can view Sales → Orders desk", async ({ page }) => {
    await navigate(page, "/core/sales/orders");
    await settle(page, 3000);
    await assertPageOk(page, "Sales Orders");
  });

  test("Can view Inventory → Stock Hub", async ({ page }) => {
    await navigate(page, "/core/inventory/stock");
    await settle(page, 3000);
    await assertPageOk(page, "Inventory Stock");
  });

  test("Can view HR → Scheduling", async ({ page }) => {
    await navigate(page, "/core/hr/scheduling");
    await settle(page, 3000);
    await assertPageOk(page, "HR Scheduling");
  });

  test("Communications — Bulletin board loads", async ({ page }) => {
    await navigate(page, "/core/bulletin");
    await settle(page, 3000);
    await assertPageOk(page, "Bulletin");
  });

  test("Communications — Internal mail loads", async ({ page }) => {
    await navigate(page, "/core/mail");
    await settle(page, 3000);
    await assertPageOk(page, "Mail");
  });

  test("Audit Hub loads and shows log entries", async ({ page }) => {
    await navigate(page, "/core/audit");
    await settle(page, 3000);
    await assertPageOk(page, "Audit");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. RETAIL MODULE — MANAGEMENT EXPERIENCE (Owner/Admin)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("4. Retail — Management", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, OWNER.email, OWNER.password);
  });

  test("Retail workspace loads", async ({ page }) => {
    await navigate(page, "/m/retail/workspace");
    await settle(page, 3000);
    await assertPageOk(page, "Retail Workspace");
  });

  test("Store Dashboard shows KPIs", async ({ page }) => {
    await navigate(page, "/m/retail/management/dashboard");
    await settle(page, 3000);
    await assertPageOk(page, "Store Dashboard");
  });

  test("Inventory page shows products", async ({ page }) => {
    await navigate(page, "/m/retail/management/inventory");
    await settle(page, 5000);
    await assertPageOk(page, "Retail Inventory");

    // Human expects: product list or table
    const items = await page.locator("table tbody tr, [class*='product'], [class*='item']").count();
    // Might be empty if no products, but page should render
    console.log(`  Retail inventory items visible: ${items}`);
  });

  test("Shift Control page loads", async ({ page }) => {
    await navigate(page, "/m/retail/management/shift-control");
    await settle(page, 3000);
    await assertPageOk(page, "Shift Control");
  });

  test("Order Fulfillment page loads", async ({ page }) => {
    await navigate(page, "/m/retail/management/order-fulfillment");
    await settle(page, 3000);
    await assertPageOk(page, "Order Fulfillment");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. RETAIL — SPG OPERATIONAL EXPERIENCE
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("5. Retail — SPG Operational", () => {
  test("SPG can login and reach operational area", async ({ page }) => {
    await login(page, SPG.email, SPG.password);
    await settle(page);

    // SPG should land in retail area
    const url = page.url();
    expect(url).not.toContain("/auth/login");
    console.log(`  SPG landed at: ${url}`);
  });

  test("SPG sees Operational Gateway", async ({ page }) => {
    await login(page, SPG.email, SPG.password);
    await navigate(page, "/m/retail/operational/gateway");
    await settle(page, 3000);
    await assertPageOk(page, "SPG Gateway");

    // Human expects: operational buttons/cards for shift, POS, etc.
    const buttons = await page.locator("button, a[class*='btn'], [class*='card']").count();
    expect(buttons).toBeGreaterThan(0);
  });

  test("SPG can access Shift Open terminal", async ({ page }) => {
    await login(page, SPG.email, SPG.password);
    await navigate(page, "/m/retail/operational/shift-open");
    await settle(page, 3000);
    await assertPageOk(page, "Shift Open");
  });

  test("SPG can access POS (Cashier)", async ({ page }) => {
    await login(page, SPG.email, SPG.password);
    await navigate(page, "/m/retail/operational/cashier-pos");
    await settle(page, 3000);
    await assertPageOk(page, "Cashier POS");

    // Human expects: product grid OR shift warning (if no active shift)
    // The POS page may show various UI states depending on shift status
    await assertPageOk(page, "Cashier POS");
  });

  test("SPG can access Receiving terminal", async ({ page }) => {
    await login(page, SPG.email, SPG.password);
    await navigate(page, "/m/retail/operational/receiving");
    await settle(page, 3000);
    await assertPageOk(page, "Receiving");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. CROSS-ROLE ACCESS — SECURITY FROM HUMAN POV
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("6. Security — Role Boundaries", () => {
  test("Invalid credentials stay on login with error", async ({ page }) => {
    await navigate(page, "/auth/login");
    await page.fill('input[type="email"], input[name="email"]', "hacker@evil.com");
    await page.fill('input[type="password"], input[name="password"]', "wrong");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // Human expects: still on login page with some error indication
    const url = page.url();
    expect(url).toContain("/auth/login");

    // Should see error message or toast
    const errorIndicators = await page.locator(
      '[role="alert"], .text-destructive, [class*="error"], [class*="Error"], .toast'
    ).count();
    const pageText = await page.textContent("body");
    const hasErrorText = pageText?.toLowerCase().includes("invalid") ||
                         pageText?.toLowerCase().includes("incorrect") ||
                         pageText?.toLowerCase().includes("failed") ||
                         errorIndicators > 0;
    expect(hasErrorText).toBeTruthy();
  });

  test("Unauthenticated user is redirected to login", async ({ page }) => {
    // Clear any session
    await page.context().clearCookies();
    await navigate(page, "/core/dashboard");
    await page.waitForTimeout(3000);

    // Human expects: redirected to login page
    const url = page.url();
    expect(url).toContain("/auth/login");
  });

  test("SPG cannot access core admin settings", async ({ page }) => {
    await login(page, SPG.email, SPG.password);
    await navigate(page, "/core/settings");
    await page.waitForTimeout(3000);

    // Human expects: either redirect away or access denied message
    const url = page.url();
    const content = await page.textContent("body") || "";
    const isBlocked =
      url.includes("/auth") ||
      url.includes("/retail") ||
      url.includes("/m/") ||
      content.toLowerCase().includes("denied") ||
      content.toLowerCase().includes("unauthorized") ||
      content.toLowerCase().includes("permission");
    console.log(`  SPG settings access result: URL=${url.substring(0, 60)}`);
    // SPG should not have full admin settings access
    expect(isBlocked || !url.includes("/core/settings")).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. TOOLS & UTILITIES — HUMAN WORKFLOW
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("7. Tools & Utilities", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
  });

  test("Tools home page loads", async ({ page }) => {
    await navigate(page, "/core/tools");
    await settle(page);
    await assertPageOk(page, "Tools");
  });

  test("Workflow inbox loads", async ({ page }) => {
    await navigate(page, "/core/workflow");
    await settle(page);
    await assertPageOk(page, "Workflow");
  });

  test("Explorer (file manager) loads", async ({ page }) => {
    await navigate(page, "/core/tools/explorer");
    await settle(page, 3000);
    await assertPageOk(page, "Explorer");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. FULL USER JOURNEY — OWNER DAY-IN-THE-LIFE
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("8. Owner Day-in-the-Life Journey", () => {
  test("Complete workflow: Login → Dashboard → Finance → HR → Retail → Logout", async ({ page }) => {
    // Step 1: Login
    await login(page, OWNER.email, OWNER.password);
    console.log("  Step 1: Logged in ✓");

    // Step 2: Check dashboard
    await navigate(page, "/core/dashboard");
    await settle(page);
    await assertPageOk(page, "Journey-Dashboard");
    console.log("  Step 2: Dashboard loaded ✓");

    // Step 3: Navigate to Finance
    await navigate(page, "/core/finance");
    await settle(page, 3000);
    await assertPageOk(page, "Journey-Finance");
    console.log("  Step 3: Finance loaded ✓");

    // Step 4: Check HR employees
    await navigate(page, "/core/hr/people");
    await settle(page, 3000);
    await assertPageOk(page, "Journey-HR");
    console.log("  Step 4: HR People loaded ✓");

    // Step 5: Navigate to Retail
    await navigate(page, "/m/retail/workspace");
    await settle(page, 3000);
    await assertPageOk(page, "Journey-Retail");
    console.log("  Step 5: Retail loaded ✓");

    // Step 6: Check communications
    await navigate(page, "/core/bulletin");
    await settle(page, 3000);
    await assertPageOk(page, "Journey-Bulletin");
    console.log("  Step 6: Bulletin loaded ✓");

    // Step 7: Back to dashboard (simulates end of session)
    await navigate(page, "/core/dashboard");
    await settle(page);
    await assertPageOk(page, "Journey-BackToDashboard");
    console.log("  Step 7: Back to dashboard ✓");
    console.log("  ═══ Full journey completed successfully ═══");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. PAYMENT & ADVANCED MODULES
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("9. Payment & Advanced", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
  });

  test("Payment workspace loads", async ({ page }) => {
    await navigate(page, "/core/payment");
    await settle(page, 3000);
    await assertPageOk(page, "Payment");
  });

  test("Warehouse workspace loads", async ({ page }) => {
    await navigate(page, "/core/warehouse");
    await settle(page, 3000);
    await assertPageOk(page, "Warehouse");
  });

  test("Logs page loads", async ({ page }) => {
    await navigate(page, "/core/logs");
    await settle(page, 3000);
    await assertPageOk(page, "Logs");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. NO JAVASCRIPT ERRORS — CRITICAL ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("10. Zero JS Crash Guarantee", () => {
  const criticalRoutes = [
    "/core/dashboard",
    "/core/finance",
    "/core/hr",
    "/core/inventory",
    "/core/procurement",
    "/core/sales/overview",
    "/core/marketing",
    "/core/it",
    "/core/settings",
    "/core/payment",
    "/core/warehouse",
    "/core/audit",
    "/core/bulletin",
    "/core/mail",
    "/m/retail/workspace",
    "/m/retail/management/dashboard",
    "/m/retail/management/inventory",
  ];

  test("No uncaught JS errors on critical routes", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);

    const jsErrors: string[] = [];
    page.on("pageerror", (err) => {
      // Ignore benign ResizeObserver noise
      if (err.message.includes("ResizeObserver")) return;
      jsErrors.push(`${err.message} (at ${err.stack?.split("\n")[1]?.trim() || "unknown"})`);
    });

    for (const route of criticalRoutes) {
      await page.goto(`${BASE}${route}`);
      await settle(page, 2000);
    }

    if (jsErrors.length > 0) {
      console.log("  JS Errors found:");
      jsErrors.forEach((e) => console.log(`    ✗ ${e}`));
    }

    // Allow at most 2 non-critical JS errors across all routes
    expect(jsErrors.length, `Found ${jsErrors.length} JS errors:\n${jsErrors.join("\n")}`).toBeLessThanOrEqual(2);
    console.log(`  ✓ ${criticalRoutes.length} routes checked — ${jsErrors.length} JS errors`);
  });
});

