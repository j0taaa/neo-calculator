import { expect, test } from "@playwright/test";
import type { AuditReport } from "../lib/huawei-sync/audit-types";

test("report preserves regional differences, verification scope and readable official screenshots", async ({ request }) => {
  const response = await request.get("/api/sync-lab");
  expect(response.ok()).toBe(true);
  const report: AuditReport = await response.json();
  expect(report.results).toHaveLength(12);
  expect(report.results.every(item => !item.auditError)).toBe(true);
  expect(report.results.filter(item => item.verified).map(item => item.service)).toEqual(["nat", "nat", "nat"]);
  const hk = report.results.find(item => item.service === "ecs" && item.region === "ap-southeast-1")!;
  const br = report.results.find(item => item.service === "ecs" && item.region === "sa-brazil-1")!;
  expect(hk.catalog?.specCodes).not.toEqual(br.catalog?.specCodes);
  expect(hk.official?.find(c => c.id === "calculator_ims_select")?.fields[0].options).not.toEqual(br.official?.find(c => c.id === "calculator_ims_select")?.fields[0].options);
  expect(hk.variants?.[0].name).toBe("Kunpeng");
  expect(report.results.filter(item => item.service === "elb").every(item => item.variants?.length === 3)).toBe(true);
  expect(report.results.filter(item => item.service === "redis").every(item => item.defaultCheck?.result === "passed-default-only")).toBe(true);
  const screenshot = await request.get(`/api/sync-lab?image=${hk.screenshot}`);
  expect(screenshot.headers()["content-type"]).toBe("image/png");
  expect((await screenshot.body()).subarray(1, 4).toString()).toBe("PNG");
  expect((await request.get("/api/sync-lab?image=../../etc/passwd")).status()).toBe(404);
});

test("NAT conditional forms and authoritative prices work in all three sampled regions", async ({ page }) => {
  await page.goto("/sync-lab");
  for (const region of ["ap-southeast-1", "sa-brazil-1", "ap-southeast-3"]) {
    await page.getByLabel("Test region").selectOption(region);
    await expect(page.getByTestId("scope-status")).toContainText("16 independent comparisons passed");
    await page.getByLabel("Gateway", { exact: true }).selectOption({ label: "Private network" });
    await expect(page.getByText("Duration (hours)", { exact: true })).toBeVisible();
    await page.getByLabel("Type", { exact: true }).selectOption({ label: "Large" });
    await page.getByRole("button", { name: "Get current Huawei price" }).click();
    await expect(page.getByTestId("lab-price")).toHaveText(/^USD \d+\.\d{2}$/);
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/neo-sync-lab-mobile.png", fullPage: true });
});

test("unsupported ECS and ELB forms cannot quote, including direct API attempts", async ({ page }) => {
  await page.goto("/sync-lab");
  for (const service of ["ecs", "elb"]) {
    await page.getByLabel("Test service").selectOption(service);
    await expect(page.getByTestId("scope-status")).toContainText("Not fully verified");
    await expect(page.getByRole("button", { name: "Get current Huawei price" })).toBeDisabled();
    const response = await page.request.post("/api/sync-lab", { data: { action: "quote", service, region: "ap-southeast-1", values: {}, releaseId: "invented" } });
    expect(response.status()).toBe(422);
  }
  await expect(page.getByRole("main").getByRole("alert")).toContainText("console");
  await page.screenshot({ path: "/tmp/neo-sync-lab-elb.png", fullPage: true });
});

test("DCS distinguishes passing defaults from incomplete coverage", async ({ page }) => {
  await page.goto("/sync-lab");
  await page.getByLabel("Test service").selectOption("redis");
  await expect(page.getByText(/Default configuration matched Huawei in 2 checks/)).toBeVisible();
  await expect(page.getByTestId("scope-status")).toContainText("Not fully verified");
  await expect(page.getByRole("button", { name: "Get current Huawei price" })).toBeDisabled();
});
