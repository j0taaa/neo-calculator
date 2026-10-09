import { test, expect } from "@playwright/test";
import type { NativeDirectory, NativeState } from "../lib/huawei-native/native-types";
import { nativeBillingModes } from "../lib/huawei-native/native-billing";
import { nativeDraft } from "../lib/huawei-native/native-draft";
import { calculatorApiKey } from "./calculator-api-fixture";

type ObservedWindow = Window & { apiState?: NativeState };

test("API discovery, calculation, saves and updates use the offline engine and reject inconsistent inputs", async ({ page, baseURL }) => {
  test.setTimeout(5 * 60 * 1000);
  expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname);
  const request = page.request;
  expect((await request.post("/api/v1/calculate", { data: { products: [] } })).status()).toBe(401);
  expect((await request.post("/api/v1/calculate", { headers: { "X-API-Key": "invalid" }, data: { products: [] } })).status()).toBe(401);
  const headers = await calculatorApiKey(page);
  const project = await (await request.post("/api/v1/private/projects", { headers, data: { name: "API regression" } })).json();
  const list = await (await request.post(`/api/v1/private/projects/${project.id}/lists`, { headers, data: { name: "API regression" } })).json();
  const apiProducts = `/api/v1/private/lists/${list.id}/products`, sessionProducts = `/api/lists/${list.id}/products`;
  try {
    const reads = await Promise.all(Array.from({ length: 5 }, () => request.get("/api/calculator/native")));
    const directories = await Promise.all(reads.map(response => response.json()));
    for (const directory of directories) expect(directory).toEqual(directories[0]);
    const directory = directories[0] as NativeDirectory;
    const regions = await (await request.get("/api/v1/public/regions")).json();
    expect(regions.regions.map((region: { id: string }) => region.id)).toEqual(directory.regions.map(region => region.id));
    expect(regions.releaseId).toBe(directories[0].releaseId);
    const services = await (await request.get("/api/v1/public/services")).json();
    expect(new Set(services.services.map((service: { calculator: { serviceId: string } }) => service.calculator.serviceId)).size).toBe(directory.services.length);
    for (const service of services.services) {
      expect(service.pricingUrl).toBe("/api/v1/calculate");
      expect(service.pricingMethod).toBe("POST");
      expect(service.calculator).not.toHaveProperty("sessionUrl");
      const schemaResponse = await request.get(service.schemaUrl);
      expect(schemaResponse.status(), service.code).toBe(200);
      const schema = await schemaResponse.json();
      expect(schema.serviceCode).toBe(`HUAWEI:${service.calculator.serviceId}`);
      expect(schema.calculator.regions.map((region: { id: string }) => region.id).sort()).toEqual(
        Object.keys(schema.calculator.billingModes).filter(region => schema.calculator.billingModes[region].length).sort());
      expect(schema.schema.properties.config.required).toEqual(["region", "billingMode", "selection", "local"]);
      expect(schema.calculator).not.toHaveProperty("sessionUrl");
    }
    for (const code of ["ECS", "Flexus L", "dcs", "HUAWEI:ecs"]) {
      const catalog = await request.get(`/api/v1/public/catalog/${encodeURIComponent(code)}`);
      expect(catalog.status()).toBe(200);
      expect((await catalog.json()).releaseId).toBe(directories[0].releaseId);
    }
    expect((await request.get("/api/v1/public/catalog/ECS/pricing?region=cn-hong-kong")).status()).toBe(200);
    expect((await request.get("/api/v1/public/catalog/ECS?region=nonexistent")).status()).toBe(400);
    expect((await request.get("/api/v1/public/catalog/ECS?region=")).status()).toBe(400);
    expect((await request.get("/api/v1/public/catalog/nonexistent")).status()).toBe(404);
    expect((await request.get("/api/v1/public/services/nonexistent/schema")).status()).toBe(404);
    for (const code of ["constructor", "toString", "__proto__"]) {
      expect((await request.get(`/api/v1/public/catalog/${code}`)).status()).toBe(404);
      expect((await request.get(`/api/v1/public/services/${code}/schema`)).status()).toBe(404);
    }

    await page.addInitScript(() => addEventListener("message", event => {
      const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Local calculator rules"]');
      if (event.source === frame?.contentWindow && event.data?.result?.local)
        (window as ObservedWindow).apiState = event.data.result;
    }));
    let first: ReturnType<typeof nativeDraft> | undefined, productId = "";
    for (const [service, mode, region] of [
      ["ECS", "ONDEMAND", "ap-southeast-1"], ["ECS", "PERIOD", "ap-southeast-1"], ["ECS", "RI", "ap-southeast-1"],
      ["ELB", "ONDEMAND", "ap-southeast-1"], ["Flexus L", "PERIOD", "ap-southeast-1"], ["OBS", "ONDEMAND", "ap-southeast-1"],
      ["CCM", "ONETIME", "ap-southeast-1"], ["HUAWEI:supportplans", "PERIOD", "ap-southeast-1"], ["APIG", "ONDEMAND", "cn-east-4"],
    ] as const) {
      const params = new URLSearchParams({ service, region, billing: nativeBillingModes[mode].label });
      await page.goto(`/?${params}`);
      await page.waitForFunction(mode => (window as ObservedWindow).apiState?.quote && (window as ObservedWindow).apiState?.billingMode === mode, mode);
      const state = await page.evaluate(() => (window as ObservedWindow).apiState!);
      const draft = nativeDraft(state, service, service, true);
      if (!first) first = structuredClone(draft);
      const session = await request.post(sessionProducts, { data: draft });
      const saved = await request.post(apiProducts, { headers, data: draft });
      expect(session.status()).toBe(201); expect(saved.status()).toBe(201);
      const sessionBody = await session.json(), savedBody = await saved.json();
      for (const body of [sessionBody, savedBody]) expect(body.pricing.amount).toBe(state.quote!.amount);
      productId = savedBody.id;
      const repeats = await Promise.all(Array.from({ length: 3 }, () => request.post("/api/v1/calculate", { headers, data: { products: [draft] } })));
      const results = await Promise.all(repeats.map(async response => { expect(response.status()).toBe(200); return (await response.json()).results; }));
      for (const result of results) {
        expect(result[0].pricing).toEqual(savedBody.pricing);
        expect(result[0].quantity).toBe(savedBody.quantity);
      }
      const quantity = state.fields.find(field => field.component === "global_QUANTITY");
      if (quantity) {
        await page.locator(`[data-field-id="${quantity.id}"]`).fill("2");
        await page.locator(`[data-field-id="${quantity.id}"]`).press("Tab");
        await page.waitForFunction(() => {
          const state = (window as ObservedWindow).apiState;
          return state?.quote && Number(state.selection.fields.find(field => field.component === "global_QUANTITY")?.value) === 2;
        });
        const multi = await page.evaluate(() => (window as ObservedWindow).apiState!);
        const multiDraft = nativeDraft(multi, service, service, true);
        for (const [path, auth] of [[`${apiProducts}/${productId}`, headers], [`${sessionProducts}/${sessionBody.id}`, {}]] as const) {
          const update = await request.patch(path, { headers: auth, data: multiDraft });
          expect(update.status()).toBe(200);
          const body = await update.json();
          expect(body.quantity).toBe(2); expect(body.pricing.amount).toBe(multi.quote!.amount);
        }
      }
      console.log(`API price and save agreement: ${service}/${mode}/${region}`);
    }
    const config = first!.config as Record<string, unknown>;
    const price = (await (await request.post("/api/v1/calculate", { headers, data: { products: [first] } })).json()).results[0].pricing.amount;
    const tampered = structuredClone(first!);
    tampered.quantity = 999; tampered.pricing = { amount: 0, currency: "JPY" };
    (tampered.config as { local: NativeState["local"] }).local!.pricing.result!.amount = 0;
    const safeSave = await request.post(apiProducts, { headers, data: tampered });
    expect(safeSave.status()).toBe(201);
    expect(await safeSave.json()).toMatchObject({ quantity: 1, pricing: { amount: price, currency: "USD" } });
    const badQuantity = structuredClone(first!);
    (badQuantity.config as { selection: NativeState["selection"] }).selection.fields.find(field => field.component === "global_QUANTITY")!.value = 999;
    const badPurchase = structuredClone(badQuantity);
    (badPurchase.config as { local: NativeState["local"] }).local!.pricing.selectedProduct.purchaseNum!.measureValue = 999;
    const badRegion = { ...first, config: { ...config, region: "nonexistent" } };
    const withoutProof = { ...config }; delete withoutProof.local;
    const missing = { ...first, config: withoutProof };
    for (const bad of [badQuantity, badPurchase, badRegion, missing]) {
      expect((await request.post(apiProducts, { headers, data: bad })).status()).toBe(422);
      expect((await request.post(sessionProducts, { data: bad })).status()).toBe(422);
      expect((await request.patch(`${apiProducts}/${productId}`, { headers, data: bad })).status()).toBe(422);
      expect((await request.post("/api/v1/calculate", { headers, data: { products: [bad] } })).status()).toBe(422);
    }
    for (const bad of [null, {}, { ...first, config: null }, { serviceCode: 42 }, { ...first, title: [] }, { ...first, quantity: 1.5 }]) {
      expect((await request.post("/api/v1/calculate", { headers, data: { products: [bad] } })).status()).toBe(400);
      expect((await request.post(apiProducts, { headers, data: bad })).status()).toBe(400);
      expect((await request.post(sessionProducts, { data: bad })).status()).toBe(400);
      expect((await request.patch(`${apiProducts}/${productId}`, { headers, data: bad })).status()).toBe(400);
      expect((await request.patch(`${sessionProducts}/${productId}`, { data: bad })).status()).toBe(400);
    }
    expect((await request.post("/api/v1/calculate", { headers, data: { region: "nonexistent", products: [first] } })).status()).toBe(400);
    expect((await request.post("/api/v1/calculate", { headers, data: { region: "cn-east-4", products: [first] } })).status()).toBe(422);
    expect((await request.post("/api/v1/calculate", { headers, data: { region: "cn-hong-kong", products: [first] } })).status()).toBe(200);
    for (const data of [[], { products: [] }, { products: Array.from({ length: 101 }, () => first) }])
      expect((await request.post("/api/v1/calculate", { headers, data })).status()).toBe(400);
    expect((await request.post("/api/v1/calculate", { headers: { ...headers, "content-type": "application/json" }, data: "{" })).status()).toBe(400);
    const mixed = await request.post("/api/v1/calculate", { headers, data: { products: [first, badQuantity] } });
    expect(mixed.status()).toBe(207);
    const mixedBody = await mixed.json();
    expect(mixedBody.results[0].pricing.amount).toBe(price);
    expect(mixedBody.results[1]).toMatchObject({ pricing: null });
    expect(mixedBody.results[1].error).toContain("quantity");
    expect((await request.post("/api/v1/calculate", { headers, data: { products: [{ ...first, serviceCode: "ECS" }] } })).status()).toBe(200);
    for (const path of [apiProducts, sessionProducts]) {
      const aliasSave = await request.post(path, { headers, data: { ...first, serviceCode: "ECS" } });
      expect(aliasSave.status()).toBe(201);
      expect(await aliasSave.json()).toMatchObject({ serviceCode: "HUAWEI:ecs", quantity: 1, pricing: { amount: price } });
    }
    const forgedError = await request.post("/api/v1/calculate", { headers, data: { products: [{ ...first, error: "client error" }] } });
    expect(forgedError.status()).toBe(200);
    expect((await forgedError.json()).results[0]).not.toHaveProperty("error");
    const padded = { ...first, serviceCode: ` ${first!.serviceCode} `, title: " VM " };
    expect((await request.post(sessionProducts, { data: padded })).status()).toBe(201);
    expect((await request.post(apiProducts, { headers, data: padded })).status()).toBe(201);
    expect((await request.post("/api/v1/calculate", { headers, data: { products: [{ serviceCode: "ECS", config: { flavor: "c9.large.2.linux" } }] } })).status()).toBe(422);
    const spec = await (await request.get("/docs/openapi.json")).json();
    expect(spec.paths["/calculate"].post.responses).toHaveProperty("207");
    expect(spec.paths["/public/catalog/{service}/pricing"].get.deprecated).toBe(true);
  } finally {
    expect((await request.delete(`/api/v1/private/projects/${project.id}`, { headers })).ok()).toBe(true);
  }
});
