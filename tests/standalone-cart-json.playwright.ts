import { test, expect } from "@playwright/test";
import Ajv from "ajv/dist/2020";
import { calculatorApiKey } from "./calculator-api-fixture";
import { readFile } from "node:fs/promises";
import type { ResourceIntent, ResourceChoice } from "../lib/cart-json/types";
import type { NativeField } from "../lib/huawei-native/native-types";

type AvailableScope = { region: string; billingModes: string[] };
type AvailableService = { serviceCode: string; regions: AvailableScope[] };

test.beforeEach(async ({ baseURL }) => expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname));

test("an agent discovers ECS/ELB/Flexus L options, validates a mixed project and imports JSON files with no external access", async ({page, baseURL}) => {
  test.setTimeout(180000);
  const external: string[] = [], errors: string[] = [];
  await page.route("**/*", async route => {
    if (/^https?:/.test(route.request().url()) && new URL(route.request().url()).origin !== new URL(baseURL!).origin) {
      external.push(route.request().url()); await route.abort();
    } else await route.continue();
  });
  page.on("pageerror", error => errors.push(error.message));
  const request = page.request;
  const schemaResponse = await request.get("/api/v1/cart/schema");
  expect(schemaResponse.status()).toBe(200);
  expect(schemaResponse.headers()["content-type"]).toContain("application/schema+json");
  const schema = await schemaResponse.json(), releaseId = schema["x-neo"].releaseId;
  const configureUrl = schema["x-neo"].endpoints.configure.url;
  const validateUrl = schema["x-neo"].endpoints.validate.url;
  expect(configureUrl).toBe(`${baseURL}/api/v1/cart/configure`);
  expect(validateUrl).toBe(`${baseURL}/api/v1/cart/validate`);
  const validator = new Ajv({ strict: false, allowUnionTypes: true }).compile(schema);
  expect(validator(schema.examples[0]), JSON.stringify(validator.errors)).toBe(true);
  const products: ResourceIntent[] = [];
  const quotedAmounts: number[] = [];
  for (const [serviceCode, billingMode] of [["HUAWEI:ecs", "ONDEMAND"], ["HUAWEI:elb", "PERIOD"], ["HUAWEI:hcss", "PERIOD"], ["HUAWEI:ecs", "RI"]]) {
    const service = schema["x-neo"].services.find((entry: AvailableService) => entry.serviceCode === serviceCode);
    expect(service,serviceCode).toBeTruthy();
    const scope = service.regions.find((scope: AvailableScope) => scope.region === "cn-hong-kong" && scope.billingModes.includes(billingMode)) ?? service.regions.find((scope: AvailableScope) => scope.billingModes.includes(billingMode));
    expect(scope, `${serviceCode}/${billingMode}`).toBeTruthy();
    const product: ResourceIntent = { serviceCode, region: scope.region, billingMode: billingMode as ResourceIntent["billingMode"], choices: [], title: `${serviceCode} ${billingMode}` };
    const configure = async () => {
      const response = await request.post(configureUrl,{data:{releaseId,product}});
      expect(response.status(),await response.text()).toBe(200);
      return response.json();
    };
    let state = await configure();
    const select = state.controls.find((field: NativeField) => field.type === "select" && !field.disabled && !field.unitSelector && field.options!.filter(option => !option.disabled).length > 1) as NativeField;
    if (select) {
      const option = select.options!.find(option => !option.disabled && option.value !== select.value)!;
      const choice: ResourceChoice = {field:select.id,label:select.label,option:option.label};
      expect(new Ajv({strict:false}).compile(state.nextChoiceSchema)(choice)).toBe(true);
      product.choices.push(choice); state = await configure();
    }
    if (serviceCode === "HUAWEI:ecs" && billingMode === "ONDEMAND") {
      const addDisk = state.controls.find((field: NativeField) => field.type === "action" && !field.disabled && /Add data disk/i.test(field.label));
      expect(addDisk).toBeTruthy();
      if (addDisk) {
        const previousIds = new Set(state.controls.map((field:NativeField)=>field.id));
        product.choices.push({field:addDisk.id,value:true}); state = await configure();
        const diskSize = state.controls.find((field: NativeField) => field.type === "number" && !field.disabled && !previousIds.has(field.id));
        expect(diskSize).toBeTruthy();
        if (diskSize) product.choices.push({field:diskSize.id,value:Math.min(diskSize.max ?? 100,Math.max(diskSize.min ?? 0,100))});
        state = await configure();
      }
      product.choices.push({field:"global_ONDEMANDTIME:0",value:37});
    }
    const quantity = state.controls.find((field: NativeField) => field.id === "global_QUANTITY:0" && !field.disabled);
    if (quantity) product.choices.push({field:quantity.id,value:2});
    state = await configure();
    expect(state.quote, `${serviceCode}: ${state.priceError}`).toBeTruthy();
    quotedAmounts.push(state.quote.amount); products.push(product);
  }
  const document = {schemaVersion:2,releaseId,resourceType:"project",project:{name:"Agent generated project",lists:[{name:"Mixed infrastructure",products},{name:"Empty",products:[]}]}};
  expect(validator(document), JSON.stringify(validator.errors)).toBe(true);
  const verifiedResponse = await request.post(validateUrl,{data:document});
  expect(verifiedResponse.status(),await verifiedResponse.text()).toBe(200);
  const verified = await verifiedResponse.json();
  expect(verified.valid).toBe(true);
  expect(verified.productCount).toBe(4);
  verified.normalized.project.lists[0].products.forEach((product:{pricing:{amount:number}},index:number)=>expect(product.pricing.amount).toBeCloseTo(quotedAmounts[index],8));
  const headers = await calculatorApiKey(page);
  const imported = await request.post("/api/v1/private/import",{headers,data:{payload:document}});
  expect(imported.status(),await imported.text()).toBe(201);
  const importedIds = await imported.json();
  const originalProducts = await (await request.get(`/api/lists/${importedIds.firstListId}/products`)).json();
  expect(originalProducts).toHaveLength(4);
  const before = await (await request.get("/api/projects")).json();
  const invalid = structuredClone(document);
  invalid.project.lists[0].products[2].choices.push({field:"not-a-control",value:10});
  for (const [url,auth] of [["/api/import",{}],["/api/v1/private/import",headers]] as const) {
    const response = await request.post(url,{headers:auth,data:{payload:invalid}});
    expect(response.status()).toBe(422);
    expect((await response.json()).errors[0].path).toContain("/project/lists/0/products/2/choices/");
  }
  expect(await (await request.get("/api/projects")).json()).toEqual(before);
  const tampered = structuredClone(verified.normalized);
  for (const product of tampered.project.lists[0].products) product.pricing = {amount:-999,currency:"JPY"};
  const rechecked = await (await request.post("/api/v1/cart/validate",{data:tampered})).json();
  expect(rechecked.valid).toBe(true);
  expect(rechecked.totals).toEqual(verified.totals);
  await page.goto(`/?service=ECS&project=${importedIds.projectId}&list=${importedIds.firstListId}`);
  await expect(page.getByTestId("lab-price")).toBeVisible();
  await page.getByRole("button",{name:"Open actions for Mixed infrastructure",exact:true}).click();
  await page.getByRole("menuitem",{name:"Export Cart JSON",exact:true}).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button",{name:"Download JSON",exact:true}).click();
  const download = await downloadPromise;
  const buffer = await readFile((await download.path())!);
  expect(JSON.parse(buffer.toString()).cart.products).toHaveLength(4);
  await page.getByRole("button",{name:"Close Export Cart JSON",exact:true}).click();
  await page.getByRole("button",{name:"Open actions for Agent generated project",exact:true}).click();
  await page.getByRole("menuitem",{name:"Import Cart",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"Import Cart JSON",exact:true})).toBeVisible();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button",{name:"Choose JSON file",exact:true}).click();
  const importResponse = page.waitForResponse(response=>response.url().endsWith("/api/import") && response.request().method()==="POST");
  await (await chooser).setFiles({name:"saved-cart.json",mimeType:"application/json",buffer});
  const fileImported = await importResponse;
  expect(fileImported.status(),await fileImported.text()).toBe(201);
  await page.getByRole("button",{name:"Open project actions",exact:true}).click();
  await page.getByRole("menuitem",{name:"Import Project",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"Import Project JSON",exact:true})).toBeVisible();
  const projectChooser = page.waitForEvent("filechooser");
  await page.getByRole("button",{name:"Choose JSON file",exact:true}).click();
  const projectResponse = page.waitForResponse(response=>response.url().endsWith("/api/import") && response.request().method()==="POST");
  await (await projectChooser).setFiles({name:"agent-project.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(document))});
  expect((await projectResponse).status()).toBe(201);
  const uploaded = await (await projectResponse).json();
  const copiedProducts = await (await request.get(`/api/lists/${uploaded.firstListId}/products`)).json();
  expect(copiedProducts).toHaveLength(4);
  for (const product of copiedProducts) {
    const region = product.config.region;
    await page.goto(`/?service=${encodeURIComponent(product.serviceCode)}&region=${region}&project=${uploaded.projectId}&list=${uploaded.firstListId}&editProduct=${product.id}&editList=${uploaded.firstListId}`);
    await expect(page.getByTestId("lab-price")).toBeVisible();
    const amount = Number((await page.getByTestId("lab-price").innerText()).replace(/[^\d.]/g,""));
    expect(amount).toBeCloseTo(product.pricing.amount,6);
  }
  const stale = await request.post("/api/v1/cart/validate",{data:{...document,releaseId:"a".repeat(64)}});
  expect(stale.status()).toBe(422);
  expect((await stale.json()).errors[0].code).toBe("catalog.changed");
  const unauthorized = await request.post("/api/v1/private/import",{headers:{"X-API-Key":"invalid"},data:{payload:document}});
  expect(unauthorized.status()).toBe(401);
  const malformed = await request.post("/api/v1/cart/validate",{data:"{"});
  expect(malformed.status()).toBe(422);
  await page.goto("/docs");
  const schemaDownload = page.waitForEvent("download");
  await page.getByRole("link",{name:"Download the complete resource JSON schema",exact:true}).click();
  expect((await schemaDownload).suggestedFilename()).toBe("neocalculator-resource-schema.json");
  expect(external).toEqual([]); expect(errors).toEqual([]);
});

test("the agent format discovers and prices every published service, region and billing mode", async ({ request }) => {
  test.setTimeout(15*60*1000);
  const schema = await (await request.get("/api/v1/cart/schema")).json();
  const failures: string[] = [], summary = {scopes:0,quoted:0,unavailable:0};
  for (const service of schema["x-neo"].services) {
    for (const scope of service.regions as AvailableScope[]) for (const mode of scope.billingModes) {
      const product = {serviceCode:service.serviceCode,region:scope.region,billingMode:mode,choices:[]};
      const response = await request.post("/api/v1/cart/configure",{data:{releaseId:schema["x-neo"].releaseId,product}});
      if(response.status()!==200){ failures.push(`${service.serviceCode}/${mode}: ${await response.text()}`); continue; }
      const state = await response.json(); summary.scopes++;
      const validation = await request.post("/api/v1/cart/validate",{data:{schemaVersion:2,releaseId:schema["x-neo"].releaseId,resourceType:"cart",cart:{name:"Service smoke",products:[product]}}});
      if(state.quote){
        if(validation.status()!==200) failures.push(`${service.serviceCode}/${mode}: ${await validation.text()}`);
        else {
          const validated = await validation.json();
          expect(validated.normalized.cart.products[0].pricing.amount).toBeCloseTo(state.quote.amount,8);
          summary.quoted++;
        }
      } else {
        expect(validation.status()).toBe(422); summary.unavailable++;
      }
    }
  }
  console.log("Agent discovery and validation coverage",JSON.stringify(summary));
  expect(failures).toEqual([]);
});
