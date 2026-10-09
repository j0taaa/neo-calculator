import { test, expect } from "@playwright/test";
import type { NativeState } from "../lib/huawei-native/native-types";

test("duration edits calculate with native rules without any HTTP request, iframe or upstream app", async ({ page }) => {
  const measurements: Record<string, number[]> = {};
  for (const service of ["ECS", "ELB", "NAT"]) {
    await page.goto(`/?service=${service}&region=cn-hong-kong`);
    await expect(page.getByTestId("lab-price")).toBeVisible();
    const unit = Number((await page.getByTestId("lab-price").innerText()).replace(/[^\d.]/g, ""));
    await expect(page.locator("iframe")).toHaveCount(0);
    // All resources for this scope are already loaded. Abort every request,
    // including same-origin requests, to prove that option changes are independent.
    const requests: string[] = [];
    await page.route("**/*", route => { requests.push(route.request().url()); return route.abort(); });
    measurements[service] = [];
    for (const value of [2, 3, 720]) {
      await page.locator('input[data-field-id="global_ONDEMANDTIME:0"]').fill(String(value));
      const elapsed = await page.evaluate(() => new Promise<number>((resolve, reject) => {
        const start = performance.now();
        const timer = setTimeout(() => { removeEventListener("neo:calculator-state", listener); reject(new Error("Local edit timed out")); }, 2000);
        const listener = (event: Event) => {
          const state = (event as CustomEvent<NativeState>).detail;
          if (!state.quote) return;
          clearTimeout(timer); removeEventListener("neo:calculator-state", listener); resolve(performance.now() - start);
        };
        addEventListener("neo:calculator-state", listener);
        (document.activeElement as HTMLElement).blur();
      }));
      measurements[service].push(elapsed);
      await expect.poll(async () => Number((await page.getByTestId("lab-price").innerText()).replace(/[^\d.]/g, ""))).toBeCloseTo(unit * value, 6);
      expect(elapsed).toBeLessThan(500);
    }
    expect(requests).toEqual([]);
    await page.unroute("**/*");
  }
  console.log("Native duration edits with every HTTP request blocked (ms)", JSON.stringify(measurements));
});
