import { test, expect } from "@playwright/test";

test("warm ECS, ELB and NAT duration edits finish locally without timed component debounces", async ({ page, baseURL }) => {
  const external: string[] = [];
  page.on("request", request => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(baseURL!).origin)
      external.push(request.url());
  });
  const measurements: Record<string, number[]> = {};
  for (const service of ["ECS", "ELB", "NAT"]) {
    await page.goto(`/?service=${service}&region=cn-hong-kong`);
    await expect(page.getByTestId("lab-price")).toBeVisible();
    const unit = Number((await page.getByTestId("lab-price").innerText()).replace(/[^\d.]/g, ""));
    const frame = page.frames().find(frame => frame.url().includes("/snapshot/frame"))!;
    expect(await frame.evaluate(() => "__neoLocalEmissions" in window)).toBe(true);
    measurements[service] = [];
    for (const value of [2, 3, 720]) {
      await page.locator('input[data-field-id="global_ONDEMANDTIME:0"]').fill(String(value));
      const elapsed = await page.evaluate(() => new Promise<number>((resolve, reject) => {
        const start = performance.now();
        const timer = setTimeout(() => { observer.disconnect(); reject(new Error("Local edit timed out")); }, 5000);
        const observer = new MutationObserver(() => {
          if (document.querySelector('[data-testid="lab-price"]')) {
            clearTimeout(timer);
            observer.disconnect();
            resolve(performance.now() - start);
          }
        });
        observer.observe(document.body, { subtree: true, childList: true, characterData: true });
        (document.activeElement as HTMLElement).blur();
      }));
      measurements[service].push(elapsed);
      const price = Number((await page.getByTestId("lab-price").innerText()).replace(/[^\d.]/g, ""));
      expect(price).toBeCloseTo(unit * value, 6);
      expect(await frame.evaluate(() => (window as unknown as { __neoLocalEmissions: { pending: number } }).__neoLocalEmissions.pending)).toBe(0);
    }
  }
  console.log("Warm local duration edits (ms)", JSON.stringify(measurements));
  expect(external).toEqual([]);
});

test("a completed price is withheld until outstanding conditional emissions finish", async ({ page }) => {
  await page.goto("/?service=ECS&region=cn-hong-kong");
  await expect(page.getByTestId("lab-price")).toBeVisible();
  const frame = page.frames().find(frame => frame.url().includes("/snapshot/frame"))!;
  const priorEpoch = await frame.evaluate(() => {
    const queue = (window as unknown as { __neoLocalEmissions: { pending: number } }).__neoLocalEmissions;
    const pending = Object.getOwnPropertyDescriptor(queue, "pending")!.get!;
    Object.defineProperty(queue, "pending", { configurable: true, get: () => pending.call(queue) + 1 });
    (window as unknown as { releaseEmissions: () => void }).releaseEmissions = () => Object.defineProperty(queue, "pending", { configurable: true, get: pending });
    return (window as unknown as { __neoNativePricing: { epoch: number } }).__neoNativePricing.epoch;
  });
  await page.locator('input[data-field-id="global_ONDEMANDTIME:0"]').fill("2");
  await page.locator('input[data-field-id="global_ONDEMANDTIME:0"]').press("Tab");
  await frame.waitForFunction(prior => {
    const pricing = (window as unknown as { __neoNativePricing: { pending: boolean; epoch: number } }).__neoNativePricing;
    return !pricing.pending && pricing.epoch > prior;
  }, priorEpoch);
  await expect(page.getByTestId("lab-price")).toHaveCount(0);
  await frame.evaluate(() => (window as unknown as { releaseEmissions: () => void }).releaseEmissions());
  await expect(page.getByTestId("lab-price")).toBeVisible();
});
