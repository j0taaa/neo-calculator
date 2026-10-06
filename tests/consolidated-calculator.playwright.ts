import { chooseControl, trackNativeSessions, waitForNativePrice } from "./calculator-controls";
import { expect, test, type Page } from "@playwright/test";
const cleanups = new WeakMap<import("@playwright/test").Page, () => Promise<void>>();
test.beforeEach(({ page }) => { cleanups.set(page, trackNativeSessions(page)); });
test.afterEach(async ({ page }) => { await cleanups.get(page)?.(); });
import type { NativeState, NativeDirectory } from "../lib/huawei-native/native-types";
import flavorsFixture from "./fixtures/native-ecs-flavors.json";
import type { CalculatorScope } from "../lib/calculator/service-directory";

const directory: NativeDirectory = { services: ["ecs", "nat", "elb", "redis", "ccm", "future-service"].map(id => ({ id,
  name: id === "future-service" ? "Future Huawei Service" : id, category: "Test", available: true })),
  regions: [{ id: "ap-southeast-1", name: "Hong Kong" }, { id: "me-new-1", name: "New region" }],
  billingModes: Object.fromEntries(["ecs", "nat", "elb", "redis", "ccm", "future-service"].map(service => [service,
    { "ap-southeast-1": ["ONDEMAND", "PERIOD", "RI", "ONETIME"], "me-new-1": ["PERIOD"] }])) };
function fixture(scope: CalculatorScope, revision = 1): NativeState {
  const fields = [{ id: "kind", component: "kind", label: "Type", type: "select" as const, presentation: "options" as const, value: "basic", disabled: false,
    options: [{ value: "basic", label: "Basic", disabled: false }, { value: "advanced", label: "Advanced", disabled: false }] },
  { id: "duration", component: "global_ONDEMANDTIME", label: "Required Duration", type: "number" as const, value: 1, min: 1, max: 100, disabled: false }];
  return { ...scope, session: `${scope.service}-${scope.region}-${revision}`, revision, expiresAt: "2030-01-01", fields, notes: [], diagnostics: [],
    selection: { version: 2, ...scope, initial: fields, fields, steps: [] }, inquiry: null, inquiries: [],
    source: { page: "", config: "", products: "", framework: "", menu: "", fetchedAt: "" },
    quote: { amount: revision * 10, currency: "USD", quotedAt: "2026-10-06T01:00:00Z", breakdown: [], source: "huawei-inquiry", releaseId: "fixture", requestHash: "" } };
}
async function mocked(page: Page) {
  const requests: Record<string, unknown>[] = [];
  let current: NativeState;
  await page.route("**/api/catalog/ecs-flavors?*", route => route.fulfill({ json: { flavors: [], diskPricing: null } }));
  await page.route("**/api/calculator/native", async route => {
    if (route.request().method() === "GET") return route.fulfill({ json: directory });
    const data = route.request().postDataJSON(); requests.push(data);
    if (["close", "cancel"].includes(data.action)) return route.fulfill({ json: { ok: true } });
    if (data.action === "open") current = fixture(data);
    else if (data.action === "restore") current = fixture(data.selection);
    else {
      current = { ...current!, revision: current!.revision + 1,
        fields: current!.fields.map(field => field.id === data.field ? { ...field, value: data.value } : field),
        quote: { ...current!.quote!, amount: current!.quote!.amount + 10 } };
      if (data.field === "kind" && data.value === "advanced") current.fields.push({ id: "capacity", component: "capacity", label: "Advanced capacity", type: "number", value: 2, min: 1, max: 10, disabled: false });
    }
    return route.fulfill({ json: current });
  });
  return requests;
}
async function cart(page: Page, baseURL?: string) {
  expect(["127.0.0.1", "localhost"]).toContain(new URL(baseURL!).hostname);
  expect((await page.request.post("/api/auth/sign-up/email", { data: { name: "Consolidation test", email: `consolidation-${crypto.randomUUID()}@example.test`, password: "Consolidation-test-password-2026" } })).ok()).toBe(true);
  const project = await (await page.request.post("/api/projects", { data: { name: "Consolidation project" } })).json();
  const list = await (await page.request.post(`/api/projects/${project.id}/lists`, { data: { name: "Consolidation cart" } })).json();
  return { project, list };
}

test("one service selector controls the header, official form, region and billing mode; old bookmarks normalize", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const calls = await mocked(page);
  await page.goto("/?tab=huawei-live&service=ELB&region=cn-hong-kong");
  await expect(page.getByRole("tab")).toHaveText(["Calculator", "Batch add"]);
  await expect(page.getByRole("heading", { name: "Elastic Load Balance", exact: true })).toBeVisible();
  await expect(page.getByLabel("Service", { exact: true })).toHaveCount(1);
  await expect(page.getByTestId("lab-price")).toContainText("10.00");
  await page.keyboard.press("Alt+1");
  await expect(page.getByLabel("Type", { exact: true }).getByRole("button", { name: "Basic", exact: true })).toBeFocused();
  expect(calls.find(call => call.action === "open")).toMatchObject({ service: "elb", region: "ap-southeast-1", billingMode: "ONDEMAND" });
  await chooseControl(page, page.getByLabel("Huawei region"), "me-new-1");
  await expect(page.getByLabel("Huawei billing mode")).toHaveAttribute("data-value", "PERIOD");
  await expect.poll(() => calls.filter(call => call.action === "open").at(-1)).toMatchObject({ service: "elb", region: "me-new-1", billingMode: "PERIOD" });
  await expect(page.getByTestId("lab-price")).toBeVisible();
  await chooseControl(page, page.getByLabel("Service", { exact: true }), "HUAWEI:future-service");
  await expect(page.getByRole("heading", { name: "Future Huawei Service", exact: true })).toBeVisible();
  await expect.poll(() => calls.filter(call => call.action === "open").at(-1)?.service).toBe("future-service");
  await chooseControl(page, page.getByLabel("Type", { exact: true }), "advanced");
  await expect(page.getByLabel("Advanced capacity", { exact: true })).toBeVisible();
  await page.getByLabel("Advanced capacity", { exact: true }).fill("99");
  await page.getByLabel("Advanced capacity", { exact: true }).press("Tab");
  await expect(page.getByRole("alert").filter({ hasText: "Enter a value" })).toBeVisible();
  await expect(page.getByTestId("lab-price")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Queue for batch" })).toBeDisabled();
  expect(new URL(page.url()).searchParams.get("tab")).toBe("calculator");
  expect(new URL(page.url()).searchParams.get("service")).toBe("HUAWEI:future-service");
  expect(new URL(page.url()).searchParams.get("region")).toBe("me-new-1");
  expect(errors).toEqual([]);
});

test("new service bookmarks wait for directory discovery and retain region and billing", async ({ page }) => {
  await mocked(page);
  await page.goto("/?service=HUAWEI%3Afuture-service&region=me-new-1&billing=Yearly%2FMonthly");
  await expect(page.getByLabel("Service", { exact: true })).toHaveAttribute("data-value", "HUAWEI:future-service");
  await expect(page.getByLabel("Huawei region")).toHaveAttribute("data-value", "me-new-1");
  await expect(page.getByLabel("Huawei billing mode")).toHaveAttribute("data-value", "PERIOD");
});

test("compatibility calculators preserve unsupported regional identity until a supported region is chosen", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await mocked(page);
  await page.goto("/?service=NAT&region=me-new-1");
  await chooseControl(page, page.getByLabel("Service", { exact: true }), "SMN");
  await expect(page.getByText("This saved calculator does not support the selected region. Choose a supported region to continue.")).toBeVisible();
  await expect(page.getByLabel("Compatibility region")).toHaveValue("");
  expect(new URL(page.url()).searchParams.get("region")).toBe("me-new-1");
  await chooseControl(page, page.getByLabel("Compatibility region"), "cn-hong-kong");
  await expect(page.getByLabel("Compatibility region")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("ECS reference catalogs load only when the flavor browser is expanded", async ({ page }) => {
  await mocked(page);
  let catalogs = 0;
  await page.route("**/api/catalog/ecs-flavors?*", route => { catalogs++; return route.fallback(); });
  await page.goto("/?region=cn-hong-kong");
  await expect(page.getByTestId("lab-price")).toBeVisible();
  expect(catalogs).toBe(0);
  await page.getByText("Search and compare ECS flavors").click();
  await expect(page.getByText("0 matching flavors", { exact: true })).toBeVisible();
  expect(catalogs).toBe(1);
  await page.getByText("Search and compare ECS flavors").click();
  await page.getByText("Search and compare ECS flavors").click();
  await expect(page.getByText("0 matching flavors", { exact: true })).toBeVisible();
  expect(catalogs).toBe(1);
});

test("abandoned requests are cancelled and cannot replace the current form", async ({ page }) => {
  await mocked(page);
  const cancelled: string[] = [];
  page.on("requestfailed", request => {
    if (request.url().endsWith("/api/calculator/native") && request.method() === "POST" && request.postDataJSON()?.service === "ecs") cancelled.push(request.url());
  });
  let release!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>(resolve => { started = resolve; });
  await page.route("**/api/calculator/native", async route => {
    const data = route.request().method() === "POST" ? route.request().postDataJSON() : null;
    if (data?.action !== "open" || data.service !== "ecs") return route.fallback();
    started(); await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: fixture(data) });
  });
  await page.goto("/?region=cn-hong-kong");
  await waiting;
  await chooseControl(page, page.getByLabel("Service", { exact: true }), "NAT");
  await expect(page.getByTestId("lab-price")).toBeVisible();
  release();
  await expect.poll(() => cancelled.length).toBe(1);
  await expect(page.getByRole("heading", { name: "NAT Gateway", exact: true }).first()).toBeVisible();
  await expect(page.locator('[aria-label="ECS flavor browser"]')).toHaveCount(0);
});

test("queued configurations survive service switches, and retry saves only unacknowledged items", async ({ page, baseURL }) => {
  const { project, list } = await cart(page, baseURL);
  await mocked(page);
  const posts: { serviceCode: string; config: Record<string, unknown> }[] = [];
  let fail = true;
  await page.route(`**/api/lists/${list.id}/products`, async route => {
    const body = route.request().postDataJSON(); posts.push(body);
    if (posts.length === 2 && fail) return route.fulfill({ status: 422, json: { error: "Upstream unavailable" } });
    return route.fulfill({ status: 201, json: { ...body, id: crypto.randomUUID(), listId: list.id, projectId: project.id,
      createdAt: "2026-10-06", updatedAt: "2026-10-06", pricing: { amount: 10, currency: "USD", suffix: "/hour" } } });
  });
  await page.goto(`/?project=${project.id}&list=${list.id}&region=cn-hong-kong`);
  await expect(page.getByTestId("lab-price")).toBeVisible();
  await page.getByRole("button", { name: "Queue for batch" }).click();
  await chooseControl(page, page.getByLabel("Service", { exact: true }), "NAT");
  await expect(page.getByTestId("lab-price")).toBeVisible();
  await page.getByRole("button", { name: "Queue for batch" }).click();
  await page.getByRole("tab", { name: "Batch add (2)" }).click();
  await page.getByRole("button", { name: "Save queued configurations" }).click();
  await expect(page.getByText(/1 saved.*Upstream unavailable/)).toBeVisible();
  await expect(page.getByRole("tab", { name: "Batch add (1)" })).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Save queued configurations" }).click();
  await expect(page.getByText("Added 1 configuration with fresh Huawei prices.")).toBeVisible();
  expect(posts.map(post => post.serviceCode)).toEqual(["HUAWEI:ecs", "HUAWEI:nat", "HUAWEI:nat"]);
  for (const post of posts) { expect(post.config.session).toBeUndefined(); expect(post.config.revision).toBeUndefined(); expect(post.config.selection).toBeTruthy(); }
});

for (const [service, code, mode] of [["nat", "NAT", "ONDEMAND"], ["elb", "ELB", "PERIOD"], ["ecs", "ECS", "RI"], ["ccm", "CCM", "ONETIME"], ["hcss", "Flexus L", "PERIOD"]] as const) {
  test(`real ${service}/${mode} uses the unified UI, verifies saves, queues, and restores exact selections`, async ({ page, baseURL }) => {
    test.skip(process.env.NEO_NATIVE_TESTS !== "1", "Requires isolated Chromium sidecar");
    test.setTimeout(360000);
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    const { project, list } = await cart(page, baseURL);
    await page.route("**/api/catalog/ecs-flavors?*", route => route.fulfill({ json: { flavors: [], diskPricing: null } }));
    await page.goto(`/?project=${project.id}&list=${list.id}&service=${encodeURIComponent(code)}&region=cn-hong-kong&billing=${encodeURIComponent(({ ONDEMAND: "Pay-per-use", PERIOD: "Yearly/Monthly", RI: "RI", ONETIME: "One-time" } as const)[mode])}`);
    await expect(page.getByLabel("Service", { exact: true })).toHaveAttribute("data-value", code);
    await expect(page.getByLabel("Huawei billing mode")).toHaveAttribute("data-value", mode);
    await waitForNativePrice(page, 150000);
    await page.getByLabel("Description", { exact: true }).fill(`Verified ${service} ${mode}`);
    const saved = page.waitForResponse(r => r.url().includes(`/api/lists/${list.id}/products`) && r.request().method() === "POST");
    await page.getByRole("button", { name: "Add to List", exact: true }).click();
    expect((await saved).status()).toBe(201);
    const products = await (await page.request.get(`/api/lists/${list.id}/products`)).json();
    expect(products).toHaveLength(1);
    expect(products[0].pricing.amount).toBeGreaterThan(0);
    expect(products[0]).toMatchObject({ serviceCode: `HUAWEI:${service}`, title: `Verified ${service} ${mode}` });
    expect(products[0].config.selection.billingMode).toBe(mode);
    expect(products[0].config.session).toBeUndefined();
    await page.getByRole("button", { name: `Edit ${products[0].title}`, exact: true }).click();
    await waitForNativePrice(page);
    await expect(page.getByRole("button", { name: "Save Changes", exact: true })).toBeEnabled({ timeout: 150000 });
    expect(await page.getByLabel("Service", { exact: true }).getAttribute("data-value")).toBe(code);
    const updated = page.waitForResponse(r => r.url().endsWith(`/products/${products[0].id}`) && r.request().method() === "PATCH");
    await page.getByRole("button", { name: "Save Changes", exact: true }).click();
    expect((await updated).status()).toBe(200);
    const after = await (await page.request.get(`/api/lists/${list.id}/products`)).json();
    expect(after[0].config.selection).toEqual(products[0].config.selection);
    expect(after[0].pricing.amount).toBe(products[0].pricing.amount);
    await page.getByRole("tabpanel", { name: "Calculator", exact: true }).getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("button", { name: "Queue for batch" })).toBeEnabled();
    await page.getByRole("button", { name: "Queue for batch" }).click();
    await page.getByRole("tab", { name: "Batch add (1)" }).click();
    await page.getByRole("button", { name: "Save queued configurations" }).click();
    await expect(page.getByText("Added 1 configuration with fresh Huawei prices.")).toBeVisible({ timeout: 150000 });
    const batched = await (await page.request.get(`/api/lists/${list.id}/products`)).json();
    expect(batched).toHaveLength(2);
    expect(batched[0].config.selection).toEqual(products[0].config.selection);
    expect(batched[0].pricing.amount).toBe(products[0].pricing.amount);
    expect(errors).toEqual([]);
    await page.goto("/projects");
  });
}

test("real ECS flavor search selects the exact catalog SKU and saves its official price", async ({ page, baseURL }) => {
  test.skip(process.env.NEO_NATIVE_TESTS !== "1", "Requires isolated Chromium sidecar");
  test.setTimeout(300000);
  const { project, list } = await cart(page, baseURL);
  await page.route("**/api/catalog/ecs-flavors?*", route => route.fulfill({ json: flavorsFixture }));
  await page.goto(`/?project=${project.id}&list=${list.id}&region=cn-hong-kong`);
  await waitForNativePrice(page, 150000);
  await page.getByText("Search and compare ECS flavors").click();
  await page.getByLabel("Minimum vCPUs").fill("4");
  await page.getByLabel("Minimum RAM").fill("16");
  await page.getByLabel("Search flavors").fill("c6.xlarge.4.linux");
  await expect(page.getByText("1 matching flavors", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Select c6.xlarge.4.linux", exact: true }).click();
  await waitForNativePrice(page, 150000);
  const amount = Number((await page.getByTestId("lab-price").innerText()).replace(/USD|,/g, "").trim());
  const response = page.waitForResponse(r => r.url().includes(`/api/lists/${list.id}/products`) && r.request().method() === "POST");
  await page.getByRole("button", { name: "Add to List", exact: true }).click();
  expect((await response).status()).toBe(201);
  const products = await (await page.request.get(`/api/lists/${list.id}/products`)).json();
  expect(products[0].pricing.amount).toBe(amount);
  const fields = products[0].config.selection.fields;
  expect(fields.find((field: { label: string }) => field.label === "Generation").optionLabel).toBe("C6");
  expect(fields.find((field: { label: string }) => field.label === "vCPUs").optionLabel).toBe("4 vCPUs");
  expect(fields.find((field: { label: string }) => field.label === "Memory").optionLabel).toBe("16GiB");
  expect(products[0].config.selection.steps.length).toBeGreaterThan(0);
  await page.goto("/projects");
});

test("public discovery includes official services, billing scopes and durable native schemas", async ({ request }) => {
  test.skip(process.env.NEO_NATIVE_TESTS !== "1", "Requires isolated Chromium sidecar");
  const live: NativeDirectory = await (await request.get("/api/calculator/native")).json();
  const services = await (await request.get("/api/v1/public/services")).json();
  for (const service of live.services) expect(services.services.some((s: { calculator?: { serviceId: string } }) => s.calculator?.serviceId === service.id)).toBe(true);
  const schema = await request.get("/api/v1/public/services/HUAWEI%3Aecs/schema");
  expect(schema.status()).toBe(200);
  expect((await schema.json()).calculator.billingModes).toEqual(live.billingModes.ecs);
  const regions = await (await request.get("/api/v1/public/regions")).json();
  for (const region of live.regions) expect(regions.regions.some((r: { catalogRegionId: string; liveAvailable: boolean }) => r.catalogRegionId === region.id && r.liveAvailable)).toBe(true);
  const originalSchema = await request.get("/api/v1/public/services/ECS/schema");
  expect(originalSchema.status()).toBe(200);
  expect((await request.get("/api/catalog/ecs-flavors?region=not-a-real-region")).status()).toBe(400);
});

test("native session cleanup remains available after interactive rate limiting", async ({ request }) => {
  test.skip(process.env.NEO_NATIVE_TESTS !== "1", "Requires isolated Chromium sidecar");
  const headers = { "x-forwarded-for": `cleanup-${crypto.randomUUID()}` };
  for (let index = 0; index < 60; index++) expect((await request.get("/api/calculator/native", { headers })).status()).toBe(200);
  expect((await request.get("/api/calculator/native", { headers })).status()).toBe(429);
  const closed = await request.post("/api/calculator/native", { headers, data: { action: "close", session: "already-closed-test-session" } });
  expect(closed.status()).toBe(200);
  const cancelled = await request.post("/api/calculator/native", { headers, data: { action: "cancel", operationId: crypto.randomUUID() } });
  expect(cancelled.status()).toBe(200);
  expect((await request.get("/api/calculator/native", { headers })).status()).toBe(429);
});

test("retired service bookmarks preserve their identity and report unavailability", async ({ page }) => {
  await mocked(page);
  await page.goto("/?service=HUAWEI%3Aremoved-service&region=me-new-1");
  await expect(page.getByLabel("Service", { exact: true })).toHaveAttribute("data-value", "HUAWEI:removed-service");
  await expect(page.getByText("Huawei has no calculator billing modes for this service in the selected region.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open calculator", exact: true })).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get("service")).toBe("HUAWEI:removed-service");
});

test("new and removed services remain searchable through the shared header", async ({ page }) => {
  await mocked(page);
  await page.goto("/?region=cn-hong-kong");
  await page.getByRole("button", { name: "Open service search" }).click();
  await page.getByRole("combobox", { name: "Search services" }).fill("Future Huawei");
  await page.getByRole("listbox").getByRole("option").filter({ hasText: "Future Huawei Service" }).click();
  await expect(page.getByLabel("Service", { exact: true })).toHaveAttribute("data-value", "HUAWEI:future-service");
  await expect(page.getByRole("heading", { name: "Future Huawei Service", exact: true })).toBeVisible();
});


test("automatic initialization waits for slow bookmark discovery and opens exactly one correct scope", async ({ page }) => {
  const calls = await mocked(page);
  await page.route("**/api/calculator/native", async route => {
    if (route.request().method() !== "GET") return route.fallback();
    await new Promise(resolve => setTimeout(resolve, 500));
    return route.fulfill({ json: directory });
  });
  await page.goto("/?service=HUAWEI%3Afuture-service&region=me-new-1&billing=Yearly%2FMonthly");
  await expect(page.getByTestId("lab-price")).toBeVisible();
  expect(calls.filter(call => call.action === "open")).toEqual([expect.objectContaining({ service: "future-service", region: "me-new-1", billingMode: "PERIOD" })]);
  await expect(page.getByRole("button", { name: "Open calculator", exact: true })).toHaveCount(0);
});

test("batch bookmarks defer automatic initialization until Calculator is visible", async ({ page }) => {
  const calls = await mocked(page);
  await page.goto("/?tab=batch-add&service=NAT&region=cn-hong-kong");
  await expect(page.getByRole("tab", { name: "Batch add", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.waitForTimeout(600);
  expect(calls.filter(call => call.action === "open")).toHaveLength(0);
  await page.getByRole("tab", { name: "Calculator", exact: true }).click();
  await expect(page.getByTestId("lab-price")).toBeVisible();
  await page.getByRole("tab", { name: "Batch add", exact: true }).click();
  await page.getByRole("tab", { name: "Calculator", exact: true }).click();
  expect(calls.filter(call => call.action === "open")).toHaveLength(1);
});

test("failed automatic opens show an explicit retry without looping", async ({ page }) => {
  const calls = await mocked(page);
  let attempts = 0;
  await page.route("**/api/calculator/native", async route => {
    if (route.request().method() !== "POST" || route.request().postDataJSON().action !== "open") return route.fallback();
    attempts++;
    if (attempts === 1) return route.fulfill({ status: 503, json: { error: "Temporary Huawei outage" } });
    return route.fallback();
  });
  await page.goto("/?service=NAT&region=cn-hong-kong");
  await expect(page.getByRole("alert").filter({ hasText: "Temporary Huawei outage" })).toBeVisible();
  await page.waitForTimeout(600);
  expect(attempts).toBe(1);
  await page.getByRole("button", { name: "Retry calculator", exact: true }).click();
  await expect(page.getByTestId("lab-price")).toBeVisible();
  expect(attempts).toBe(2);
  expect(calls.filter(call => call.action === "open")).toHaveLength(1);
});

test("number shortcuts choose the focused options and preserve billing mode", async ({ page }) => {
  const calls = await mocked(page);
  await page.goto("/?service=NAT&region=cn-hong-kong");
  await expect(page.getByTestId("lab-price")).toBeVisible();
  await page.keyboard.press("Alt+1");
  await page.keyboard.press("2");
  await expect(page.getByLabel("Advanced capacity", { exact: true })).toBeVisible();
  expect(calls.filter(call => call.action === "change").at(-1)).toMatchObject({ field: "kind", value: "advanced" });
  await expect(page.getByLabel("Huawei billing mode")).toHaveAttribute("data-value", "ONDEMAND");
});


test("styled options preserve Huawei disabled choices and keyboard restrictions", async ({ page }) => {
  const calls = await mocked(page);
  await page.route("**/api/calculator/native", async route => {
    if (route.request().method() !== "POST" || route.request().postDataJSON().action !== "open") return route.fallback();
    const state = fixture(route.request().postDataJSON());
    state.fields[0].options![1].disabled = true;
    return route.fulfill({ json: state });
  });
  await page.goto("/?service=NAT&region=cn-hong-kong");
  await expect(page.getByTestId("lab-price")).toBeVisible();
  await expect(page.getByLabel("Type", { exact: true }).getByRole("button", { name: "Advanced", exact: true })).toBeDisabled();
  await page.keyboard.press("Alt+1"); await page.keyboard.press("2");
  expect(calls.filter(call => call.action === "change")).toHaveLength(0);
  await expect(page.getByLabel("Huawei billing mode")).toHaveAttribute("data-value", "ONDEMAND");
});


test("leaving during a real automatic open releases the abandoned renderer slot", async ({ page, request }) => {
  test.skip(process.env.NEO_NATIVE_TESTS !== "1", "Requires isolated Chromium sidecar");
  const starting = page.waitForRequest(req => req.url().endsWith("/api/calculator/native") && req.method() === "POST" && req.postDataJSON()?.action === "open");
  const cancelled = page.waitForEvent("requestfailed", { predicate: req => req.url().endsWith("/api/calculator/native") && req.method() === "POST" });
  await page.goto("/?service=ECS&region=cn-hong-kong");
  await starting;
  await page.getByRole("link", { name: "Projects", exact: true }).click();
  await cancelled;
  const sessions: string[] = [];
  try {
    // Hold all six allowed slots. A leaked abandoned open would make the last request fail.
    for (let index = 0; index < 6; index++) {
      // The abandoned operation can still be finishing; its slot must release well before the idle TTL.
      await expect.poll(async () => {
        const response = await request.post("/api/calculator/native", { headers: { "x-forwarded-for": `cancel-check-${index}-${crypto.randomUUID()}` },
          data: { action: "open", service: "nat", region: "ap-southeast-1", billingMode: "ONDEMAND" } });
        if (response.status() === 200) {
          const state = await response.json(); sessions.push(state.session);
          expect(state.quote).not.toBeNull();
        }
        return response.status();
      }, { timeout: 60000, intervals: [4000] }).toBe(200);
    }
  } finally {
    await Promise.all(sessions.map(session => request.post("/api/calculator/native", { data: { action: "close", session } })));
  }
});


test("editing can change region and billing without a manual open or duplicate restore", async ({ page, baseURL }) => {
  const { project, list } = await cart(page, baseURL);
  const calls = await mocked(page);
  await page.route(`**/api/lists/${list.id}/products`, async route => {
    if (route.request().method() !== "POST") return route.fallback();
    const body = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { ...body, id: "edit-scope-fixture", listId: list.id, projectId: project.id,
      createdAt: "2026-10-06", updatedAt: "2026-10-06", pricing: { amount: 10, currency: "USD", suffix: "/hour" } } });
  });
  await page.goto(`/?project=${project.id}&list=${list.id}&service=NAT&region=cn-hong-kong`);
  await expect(page.getByTestId("lab-price")).toBeVisible();
  await page.getByLabel("Description", { exact: true }).fill("Edit scope check");
  await page.getByRole("button", { name: "Add to List", exact: true }).click();
  await page.getByRole("button", { name: "Edit Edit scope check", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save Changes", exact: true })).toBeEnabled();
  expect(calls.filter(call => call.action === "restore")).toHaveLength(1);
  await chooseControl(page, page.getByLabel("Huawei region"), "me-new-1");
  await expect(page.getByTestId("lab-price")).toBeVisible();
  await expect(page.getByLabel("Huawei billing mode")).toHaveAttribute("data-value", "PERIOD");
  expect(calls.filter(call => call.action === "open").at(-1)).toMatchObject({ region: "me-new-1", billingMode: "PERIOD" });
  expect(calls.filter(call => call.action === "restore")).toHaveLength(1);
});


test("an incomplete price can be retried without losing options or opening another session", async ({ page }) => {
  await mocked(page);
  const calls: Record<string, unknown>[] = [];
  await page.route("**/api/calculator/native", async route => {
    if (route.request().method() !== "POST") return route.fallback();
    const body = route.request().postDataJSON(); calls.push(body);
    if (body.action === "open") return route.fulfill({ json: { ...fixture(body), quote: null, priceError: "Huawei has not completed pricing this configuration" } });
    if (body.action === "refresh") return route.fulfill({ json: { ...fixture({ service: "nat", region: "ap-southeast-1", billingMode: "ONDEMAND" }, 2), session: "nat-ap-southeast-1-1" } });
    return route.fallback();
  });
  await page.goto("/?service=NAT&region=cn-hong-kong");
  await expect(page.getByRole("button", { name: "Retry price", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Queue for batch", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Retry price", exact: true }).click();
  await expect(page.getByTestId("lab-price")).toContainText("20.00");
  expect(calls.filter(call => call.action === "open")).toHaveLength(1);
  expect(calls.find(call => call.action === "refresh")).toMatchObject({ session: "nat-ap-southeast-1-1", revision: 1 });
  await expect(page.getByLabel("Type", { exact: true })).toHaveAttribute("data-value", "basic");
  await expect(page.getByRole("button", { name: "Queue for batch", exact: true })).toBeEnabled();
});
