import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(2000);

  // Helper: open base-ui select and pick an option
  async function selectOption(triggerText: RegExp, optionText: RegExp) {
    const trigger = page.locator("button[role='combobox']").filter({ hasText: triggerText }).first();
    await trigger.click();
    await page.waitForTimeout(500);
    const listboxId = await trigger.getAttribute("aria-controls");
    const listbox = page.locator("#" + listboxId!);
    await listbox.locator("[role='option']").filter({ hasText: optionText }).first().click();
    await page.waitForTimeout(500);
  }

  // Helper: click a button that matches text
  async function clickButton(text: string | RegExp) {
    const btn = page.locator("button").filter({ hasText: text }).first();
    await btn.click();
    await page.waitForTimeout(500);
  }

  // 1. Select Sao Paulo region
  await selectOption(/Sao Paulo|Brazil/i, /LA-Sao Paulo1/);
  console.log("1. Region: LA-Sao Paulo1 selected");

  // 2. Ensure Pay-per-use
  const ppuBtn = page.locator("button").filter({ hasText: /^Pay-per-use$/ }).first();
  const ppuPressed = await ppuBtn.getAttribute("aria-pressed");
  if (ppuPressed !== "true") {
    await ppuBtn.click();
    await page.waitForTimeout(300);
  }
  console.log("2. Billing: Pay-per-use");

  // 3. Pick a 2vCPU 4GB ECS flavor
  const searchInput = page.locator("input[placeholder='Search flavors']");
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill("s6.small.2");
    await page.waitForTimeout(1000);
  }

  // Click first flavor row
  const flavorRow = page.locator("tr").nth(1);
  await flavorRow.click();
  await page.waitForTimeout(500);
  console.log("3. ECS flavor selected");

  // Click Add to List
  await clickButton(/^Add to List$/);
  await page.waitForTimeout(2000);
  console.log("4. ECS added to list");

  await page.screenshot({ path: "test-results/step1-ecs.png", fullPage: true });

  // 4. Switch to ELB
  await selectOption(/^Price Calculator$|Elastic Cloud Server/i, /Elastic Load Balance/i);
  await page.waitForTimeout(1500);
  console.log("5. Switched to ELB");

  // Select Dedicated
  await clickButton(/Dedicated/i);
  await page.waitForTimeout(500);
  console.log("6. ELB: Dedicated selected");

  await clickButton(/^Add to List$/);
  await page.waitForTimeout(2000);
  console.log("7. ELB added to list");

  await page.screenshot({ path: "test-results/step2-elb.png", fullPage: true });

  // 5. Switch to EIP
  await selectOption(/Price Calculator|Elastic Load Balance/i, /Elastic IP/i);
  await page.waitForTimeout(1500);
  console.log("8. Switched to EIP");

  // Set quantity to 3 (click + twice, starts at 1)
  const plusBtn = page.locator("button").filter({ hasText: /^\+$/ }).first();
  await plusBtn.click();
  await page.waitForTimeout(200);
  await plusBtn.click();
  await page.waitForTimeout(500);
  console.log("9. EIP quantity set to 3");

  await clickButton(/^Add to List$/);
  await page.waitForTimeout(2000);
  console.log("10. EIP x3 added to list");

  await page.screenshot({ path: "test-results/step3-eip.png", fullPage: true });

  // 6. Create project
  const projectName = page.locator("input[placeholder='New project name']").first();
  await projectName.fill("Test Inquiry Pricing");
  await clickButton(/^New Project$/);
  await page.waitForTimeout(3000);
  console.log("11. Project created");

  await page.screenshot({ path: "test-results/final.png", fullPage: true });

  // Log final product list
  const priceTexts = await page.evaluate(() => {
    const prices = [...document.querySelectorAll("p")].filter(el => el.className?.includes("font-semibold"));
    const warnings = [...document.querySelectorAll("p")].filter(el => el.className?.includes("text-amber"));
    return {
      prices: prices.map(el => el.textContent?.trim()),
      warnings: warnings.map(el => el.textContent?.trim()),
    };
  });
  console.log("\nPrices:", JSON.stringify(priceTexts.prices, null, 2));
  console.log("Warnings:", JSON.stringify(priceTexts.warnings, null, 2));

  if (consoleErrors.length > 0) {
    console.log("\nConsole errors:\n" + consoleErrors.join("\n"));
  }

  await browser.close();
  console.log("\nDone!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
