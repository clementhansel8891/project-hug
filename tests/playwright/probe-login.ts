import { chromium } from "playwright";
import * as fs from "fs";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  
  console.log("Navigating to /auth/login...");
  await page.goto("http://150.109.15.108:3010/auth/login", { waitUntil: "networkidle", timeout: 30000 });
  
  // Check page state
  const bodyText = await page.locator("body").textContent();
  console.log(`Body text (200): ${bodyText?.trim().slice(0, 200)}`);
  
  // Find inputs
  const inputs = await page.locator("input").all();
  console.log(`\nInputs found: ${inputs.length}`);
  for (const input of inputs) {
    const type = await input.getAttribute("type");
    const name = await input.getAttribute("name");
    const placeholder = await input.getAttribute("placeholder");
    console.log(`  INPUT: type=${type} name=${name} placeholder=${placeholder}`);
  }

  fs.mkdirSync("tests/playwright/screenshots", { recursive: true });
  await page.screenshot({ path: "tests/playwright/screenshots/login-page.png" });

  // Try login
  if (inputs.length >= 2) {
    console.log("\nFilling login form...");
    const emailInput = page.locator('input[type="email"]').first();
    const pwInput = page.locator('input[type="password"]').first();
    
    if (await emailInput.count() > 0) {
      await emailInput.fill("estela@bambusilver.com");
      await pwInput.fill("Estella2024!");
    } else {
      // Fill by order
      await inputs[0].fill("estela@bambusilver.com");
      await inputs[1].fill("Estella2024!");
    }
    
    const btn = page.locator('button[type="submit"], button:has-text("Sign"), button:has-text("Log")').first();
    console.log(`Submit button found: ${await btn.count() > 0}`);
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(5000);
      console.log(`After login URL: ${page.url()}`);
      await page.screenshot({ path: "tests/playwright/screenshots/after-login.png" });
      
      // Navigate to dashboard to verify
      await page.goto("http://150.109.15.108:3010/", { waitUntil: "networkidle", timeout: 15000 });
      console.log(`Dashboard URL: ${page.url()}`);
      await page.screenshot({ path: "tests/playwright/screenshots/dashboard.png" });
    }
  }

  await browser.close();
  console.log("Done.");
}

main().catch(e => { console.error(e); process.exit(1); });
