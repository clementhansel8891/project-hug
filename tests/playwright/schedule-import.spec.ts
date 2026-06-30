/**
 * schedule-import.spec.ts — UI smoke test for the Schedule Import feature.
 * The user-facing schedule page (/core/hr/schedule) renders WorkforceScheduler,
 * which now exposes "Template" (download) and "Import" (upload) controls.
 *
 * Run: npx playwright test tests/playwright/schedule-import.spec.ts \
 *        --project=chromium --no-deps --reporter=line
 */
import { test, expect, Page } from "@playwright/test";

const EMAIL = "hansel@bambusilver.com";
const PASSWORD = "Hansel2024!";

async function login(page: Page) {
  await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
  if (!page.url().includes("/auth/")) return; // already authenticated
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/core/**", { timeout: 45000 });
}

test.describe("Schedule Import UI", () => {
  test("Schedule page shows Template + Import controls wired for xlsx/csv", async ({ page }) => {
    await login(page);
    await page.goto("/core/hr/schedule", { waitUntil: "domcontentloaded" });

    const templateBtn = page.getByRole("button", { name: /Template/i });
    const importBtn = page.getByRole("button", { name: /^Import/i });
    await expect(templateBtn).toBeVisible({ timeout: 30000 });
    await expect(importBtn).toBeVisible({ timeout: 15000 });

    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput.first()).toHaveAttribute("accept", /xlsx|csv/);
  });

  test("Template button triggers an .xlsx download", async ({ page }) => {
    await login(page);
    await page.goto("/core/hr/schedule", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /Template/i })).toBeVisible({ timeout: 30000 });

    const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
    await page.getByRole("button", { name: /Template/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain(".xlsx");
  });
});
