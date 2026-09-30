import { expect, test } from "@playwright/test";
import type { NativeState } from "../lib/huawei-sync/native-types";

async function close(request: import("@playwright/test").APIRequestContext, session: string) {
  await request.post("/api/sync-lab/live", { data: { action: "close", session } });
}
test("discovers the Huawei service and region directory", async ({ request }) => {
  const response = await request.get("/api/sync-lab/live");
  expect(response.ok()).toBe(true);
  const directory = await response.json();
  expect(directory.services.length).toBeGreaterThan(90);
  expect(directory.regions.length).toBeGreaterThan(20);
  for (const id of ["ecs", "elb", "redis", "nat"])
    expect(directory.services.some((s: { id: string }) => s.id === id)).toBe(true);
  expect(directory.regions.some((r: { id: string }) => r.id === "sa-brazil-1")).toBe(true);
});

test("ECS renders dependencies, adds and removes disks, and never displays a stale price", async ({ page }) => {
  await page.goto("/sync-lab");
  await page.getByRole("button", { name: "Open calculator", exact: true }).click();
  await expect(page.getByTestId("lab-price")).toBeVisible({ timeout: 100000 });
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await page.getByLabel("CPU Architecture", { exact: true }).selectOption({ label: "Kunpeng" });
  await expect(page.getByTestId("lab-price")).toHaveCount(0);
  await expect(page.getByTestId("lab-price")).toBeVisible();
  await page.getByRole("button", { name: "Add data disk", exact: true }).click();
  await expect(page.getByLabel("Data Disk amount", { exact: true })).toHaveValue("100");
  await expect(page.getByTestId("lab-price")).toBeVisible();
  await page.getByLabel("Data Disk amount", { exact: true }).fill("-1");
  await expect(page.getByTestId("lab-price")).toHaveCount(0);
  await page.getByLabel("Data Disk amount", { exact: true }).press("Tab");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Enter a value");
  await page.getByLabel("Data Disk amount", { exact: true }).fill("200");
  await page.getByLabel("Data Disk amount", { exact: true }).press("Tab");
  await expect(page.getByTestId("lab-price")).toBeVisible();
  await page.getByRole("button", { name: "Remove data disk", exact: true }).click();
  await expect(page.getByLabel("Data Disk amount", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("lab-price")).toBeVisible();
  await page.getByLabel("EIP", { exact: true }).selectOption({ label: "Not required" });
  await expect(page.getByLabel("Bandwidth Size", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("lab-price")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/neo-native-mobile.png", fullPage: true });
  await page.goto("/sync-lab/audit"); // pagehide closes the anonymous renderer session
});

test("ELB derives LCU charges and handles HTTP, fixed and shared variants", async ({ page }) => {
  await page.goto("/sync-lab");
  await page.getByLabel("Huawei service").selectOption("elb");
  await page.getByRole("button", { name: "Open calculator", exact: true }).click();
  await expect(page.getByTestId("lab-price")).toBeVisible({ timeout: 100000 });
  const initial = await page.getByTestId("lab-price").innerText();
  await page.getByLabel("New Connections", { exact: true }).fill("10000");
  await page.getByLabel("New Connections", { exact: true }).press("Tab");
  await expect(page.getByTestId("lab-price")).toBeVisible();
  await expect(page.getByTestId("lab-price")).not.toHaveText(initial);
  await expect(page.getByLabel("LCUs (Network Load Balancing)", { exact: true })).toHaveValue("13");
  await page.getByLabel("Application load balancing (HTTP/HTTPS)", { exact: true }).check();
  await expect(page.getByTestId("lab-price")).toBeVisible();
  await page.getByLabel("Specifications", { exact: true }).selectOption({ label: "Fixed" });
  await expect(page.getByTestId("lab-price")).toBeVisible();
  await page.getByLabel("Type", { exact: true }).selectOption({ label: "Shared load balancer" });
  await expect(page.getByTestId("lab-price")).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/neo-native-elb.png", fullPage: true });
  await page.goto("/sync-lab/audit");
});

test("session API rejects stale updates, client-forged fields, invalid scopes and expired sessions", async ({
  request,
}) => {
  expect(
    (
      await request.post("/api/sync-lab/live", {
        data: { action: "open", service: "invented", region: "ap-southeast-1" },
      })
    ).status(),
  ).toBe(422);
  const response = await request.post("/api/sync-lab/live", {
    data: { action: "open", service: "nat", region: "sa-brazil-1" },
    timeout: 110000,
  });
  expect(response.ok()).toBe(true);
  let state: NativeState = await response.json();
  try {
    expect(state.diagnostics).toEqual([]);
    expect(state.quote).not.toBeNull();
    for (const patch of [
      { revision: 9999, field: "global_ONDEMANDTIME:0", value: 2 },
      { revision: state.revision, field: "body", value: true },
      { revision: state.revision, field: "global_ONDEMANDTIME:0", value: -1 },
    ]) {
      const result = await request.post("/api/sync-lab/live", {
        data: { action: "change", session: state.session, ...patch },
      });
      expect(result.ok()).toBe(false);
    }
    for (const label of ["Private network", "Large"]) {
      const field = state.fields.find((f) => f.options?.some((o) => o.label === label))!;
      const result = await request.post("/api/sync-lab/live", {
        data: {
          action: "change",
          session: state.session,
          revision: state.revision,
          field: field.id,
          value: field.options!.find((o) => o.label === label)!.value,
        },
      });
      expect(result.ok()).toBe(true);
      state = await result.json();
      expect(state.quote).not.toBeNull();
    }
    const changed = await request.post("/api/sync-lab/live", {
      data: {
        action: "change",
        session: state.session,
        revision: state.revision,
        field: "global_ONDEMANDTIME:0",
        value: 2,
      },
    });
    expect(changed.ok()).toBe(true);
    state = await changed.json();
    expect(state.quote).not.toBeNull();
    expect(state.inquiry?.regionId).toBe("sa-brazil-1");
    const competing = await Promise.all(
      [3, 4].map((value) =>
        request.post("/api/sync-lab/live", {
          data: {
            action: "change",
            session: state.session,
            revision: state.revision,
            field: "global_ONDEMANDTIME:0",
            value,
          },
        }),
      ),
    );
    expect(competing.map((result) => result.status()).sort()).toEqual([200, 409]);
    state = await competing.find((result) => result.ok())!.json();
    expect(state.quote).not.toBeNull();
  } finally {
    await close(request, state.session);
  }
  const expired = await request.post("/api/sync-lab/live", {
    data: {
      action: "change",
      session: state.session,
      revision: state.revision,
      field: "global_ONDEMANDTIME:0",
      value: 3,
    },
  });
  expect(expired.status()).toBe(410);
});
