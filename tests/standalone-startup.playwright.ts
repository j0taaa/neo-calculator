import { expect, test } from "@playwright/test";
import type { NativeState } from "../lib/huawei-native/native-types";

type ObservedWindow = Window & { startupState?: NativeState };

test("parallel startup preserves defaults, conditional options and prices across all billing modes", async ({ browser, baseURL }) => {
  test.setTimeout(120000);
  const cases = [
    ["ECS", "cn-hong-kong", "Pay-per-use"],
    ["ECS", "cn-hong-kong", "Yearly/Monthly"],
    ["ECS", "cn-hong-kong", "RI"],
    ["ELB", "cn-hong-kong", "Pay-per-use"],
    ["Flexus L", "cn-hong-kong", "Yearly/Monthly"],
    ["CCM", "cn-hong-kong", "One-time"],
    ["HUAWEI:apig", "cn-east-4", "Pay-per-use"],
  ];
  for (const [service, region, billing] of cases) {
    const states: NativeState[] = [];
    for (const preload of [false, true]) {
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        const external: string[] = [], errors: string[] = [];
        page.on("request", request => {
          if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(baseURL!).origin)
            external.push(request.url());
        });
        page.on("pageerror", error => errors.push(error.message));
        await page.addInitScript(() => {
          addEventListener("message", event => {
            const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Local calculator rules"]');
            if (event.source === frame?.contentWindow && event.data?.result?.fields)
              (window as ObservedWindow).startupState = event.data.result;
          });
        });
        // A fulfilled frame lacks network address-space metadata. Fulfill its
        // assets too so Chromium's loopback protection does not block this A/B harness.
        await page.route("**/api/calculator/snapshot/*/asset/*", async route => {
          const response = await route.fetch();
          await route.fulfill({ response });
        });
        await page.route("**/api/calculator/snapshot/frame?*", async route => {
          const response = await route.fetch();
          const body = await response.text();
          expect(body).toContain('rel="modulepreload"');
          await route.fulfill({ response, body: preload ? body : body.replace(/<link rel="(?:modulepreload|preload)"[^>]*>/g, "") });
        });
        const params = new URLSearchParams({ service, region, billing });
        await page.goto(`${baseURL}/?${params}`);
        await page.waitForFunction(() => !!(window as ObservedWindow).startupState?.quote, undefined, { timeout: 20000 });
        const state = await page.evaluate(() => (window as ObservedWindow).startupState!);
        expect(state.diagnostics).toEqual([]);
        expect(external).toEqual([]);
        expect(errors).toEqual([]);
        const frame = page.frames().find(frame => frame.url().includes("/snapshot/frame"))!;
        // The browser must reuse the preload when the entry script imports it.
        const modules = await frame.evaluate(() => performance.getEntriesByType("resource")
          .filter(entry => ["script", "link"].includes((entry as PerformanceResourceTiming).initiatorType))
          .map(entry => entry.name));
        expect(new Set(modules).size).toBe(modules.length);
        states.push(state);
      } finally { await context.close(); }
    }
    expect(states[1].selection.fields, `${service}/${billing} conditional form`).toEqual(states[0].selection.fields);
    expect(states[1].notes).toEqual(states[0].notes);
    expect(states[1].quote!.amount).toBe(states[0].quote!.amount);
    expect(states[1].quote!.currency).toBe(states[0].quote!.currency);
    expect(states[1].quote!.breakdown.map(({ amount, label }) => ({ amount, label })))
      .toEqual(states[0].quote!.breakdown.map(({ amount, label }) => ({ amount, label })));
    expect(states[1].quote!.payment).toEqual(states[0].quote!.payment);
  }
});

test("immediate initial opening waits for directory and bookmark hydration", async ({ page }) => {
  test.setTimeout(60000);
  await page.route("**/api/calculator/native", async route => {
    const response = await route.fetch();
    await new Promise(resolve => setTimeout(resolve, 750));
    await route.fulfill({ response });
  });
  const frames: URL[] = [];
  page.on("request", request => {
    if (request.url().includes("/api/calculator/snapshot/frame?")) frames.push(new URL(request.url()));
  });
  for (const [service, nativeId, mode, billing] of [
    ["CCM", "ccm", "ONETIME", "One-time"],
    ["Flexus L", "hcss", "PERIOD", "Yearly/Monthly"],
    ["ECS", "ecs", "RI", "RI"],
  ]) {
    frames.length = 0;
    await page.goto(`/?${new URLSearchParams({ service, region: "cn-hong-kong", billing })}`);
    await expect(page.getByTestId("lab-price")).toBeVisible();
    expect(frames).toHaveLength(1);
    expect(frames[0].searchParams.get("service")).toBe(nativeId);
    expect(frames[0].searchParams.get("region")).toBe("ap-southeast-1");
    expect(frames[0].searchParams.get("mode")).toBe(mode);
  }
});
