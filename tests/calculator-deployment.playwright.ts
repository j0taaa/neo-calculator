import { test, expect } from "@playwright/test";

test("retired calculator hosts permanently redirect paths and queries to production", async ({ request }) => {
  for (const host of ["calculator-offline.hwctools.site", "calculator-lab.hwctools.site"]) {
    for (const path of ["/", "/?service=ECS&region=cn-hong-kong&billing=Pay-per-use", "/docs?example=1", "/api/calculator/native?check=1", "/?service=Flexus%20L&description=a%2Fb%20c"]) {
      const response = await request.get(`https://${host}${path}`, { maxRedirects: 0 });
      expect(response.status()).toBe(301);
      expect(response.headers().location).toBe(`https://calculator.hwctools.site${path}`);
    }
  }
});

test("a bookmarked calculator configuration reaches the sole application", async ({ page, request }) => {
  const main = await (await request.get("https://calculator.hwctools.site/api/calculator/native")).json();
  for (const host of ["calculator-offline.hwctools.site", "calculator-lab.hwctools.site"]) {
    await page.goto(`https://${host}/?service=ECS&region=cn-hong-kong&billing=Pay-per-use`);
    await expect(page).toHaveURL("https://calculator.hwctools.site/?service=ECS&region=cn-hong-kong&billing=Pay-per-use");
    await expect(page.getByTestId("lab-price")).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(0);
    const followed = await (await request.get(`https://${host}/api/calculator/native`)).json();
    expect(followed).toEqual(main);
    expect(main.engine.kind).toBe("neo-rules");
  }
});

test("retired API hosts preserve POST methods with permanent redirects", async ({ request }) => {
  for (const host of ["calculator-offline.hwctools.site", "calculator-lab.hwctools.site"]) {
    const response = await request.post(`https://${host}/api/calculator/native?check=1`, { data: { probe: true }, maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe("https://calculator.hwctools.site/api/calculator/native?check=1");
  }
});

test("old standalone lab pages preserve configuration in the main workspace", async ({ request, page }) => {
  for (const path of ["/sync-lab", "/sync-lab/audit"]) {
    const response = await request.get(`https://calculator.hwctools.site${path}?service=ECS&region=cn-hong-kong&billing=Pay-per-use`, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    const target = new URL(response.headers().location, "https://calculator.hwctools.site");
    expect(target.pathname).toBe("/");
    expect(target.searchParams.get("tab")).toBe("calculator");
    expect(target.searchParams.get("service")).toBe("ECS");
    expect(target.searchParams.get("region")).toBe("cn-hong-kong");
    expect(target.searchParams.get("billing")).toBe("Pay-per-use");
    await page.goto(target.href);
    await expect(page.getByTestId("lab-price")).toBeVisible();
  }
});
