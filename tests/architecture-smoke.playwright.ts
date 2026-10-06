import { chooseControl, trackNativeSessions, waitForNativePrice } from "./calculator-controls";
import { expect, test, type Page } from "@playwright/test";
const cleanups = new WeakMap<import("@playwright/test").Page, () => Promise<void>>();
test.beforeEach(({ page }) => { cleanups.set(page, trackNativeSessions(page)); });
test.afterEach(async ({ page }) => { await cleanups.get(page)?.(); });
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getServiceBundle } from "../config/services/bundles";
import { serviceCatalog } from "../lib/service-config";
import expected from "./fixtures/runtime/expected.json";

const services = ["DCS", "NAT", "EVS", "DMS", "ELB", "VPN", "RDS", "EIP"];

async function useCatalogFixtures(page: Page) {
  await page.route("**/api/calculator/native", route => route.fulfill({ json: { services: [], regions: [], billingModes: {} } }));
  // Avoid starting the unrelated ECS catalog synchronizer during these UI scenarios.
  await page.route("**/api/catalog/ecs-flavors?*", (route) => route.fulfill({ json: { flavors: [], diskPricing: null } }));
  for (const code of services) {
    const source = getServiceBundle(code)!.runtime!.catalog!;
    const catalog = JSON.parse(await readFile(resolve(`tests/fixtures/runtime/${code.toLowerCase()}.json`), "utf8"));
    await page.route(`**/api/catalog/${source.route}?*`, (route) => route.fulfill({
      json: { region: "la-sao-paulo1", catalogRegionId: "sa-brazil-1", [source.catalogPath ?? "catalog"]: catalog },
    }));
  }
}

async function createTestCart(page: Page, baseURL: string | undefined) {
  expect(["127.0.0.1", "localhost"]).toContain(new URL(baseURL!).hostname);
  const signup = await page.request.post("/api/auth/sign-up/email", {
    data: { name: "Architecture Test", email: `architecture-${crypto.randomUUID()}@example.test`, password: "Architecture-test-password-2026" },
  });
  expect(signup.ok()).toBe(true);
  const projectResponse = await page.request.post("/api/projects", { data: { name: "Architecture regression" } });
  expect(projectResponse.status()).toBe(201);
  const project = await projectResponse.json();
  const listResponse = await page.request.post(`/api/projects/${project.id}/lists`, { data: { name: "Regression cart" } });
  expect(listResponse.status()).toBe(201);
  const list = await listResponse.json();
  return { project, list };
}

async function selectService(page: Page, code: string) {
  await page.getByRole("button", { name: "Open service search" }).click();
  const search = page.getByRole("combobox", { name: "Search services" });
  await search.fill(code);
  await page.getByRole("option").filter({ hasText: serviceCatalog.find((service) => service.code === code)!.name }).first().click();
}

for (const code of services) {
  test(`${code} calculator renders its catalog and estimate`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await useCatalogFixtures(page);
    await page.goto("/");
    const catalogLoaded = page.waitForResponse((response) => response.url().includes(`/api/catalog/${getServiceBundle(code)!.runtime!.catalog!.route}?`));
    await selectService(page, code);
    await catalogLoaded;
    if (code === "VPN") {
      // Select a concrete billing/edition combination after catalog normalization.
      await page.getByRole("button", { name: "Pay-per-use", exact: true }).click();
      await page.getByRole("button", { name: "Classic", exact: true }).click();
    }
    await expect(page.getByText(`Loading ${code} pricing...`, { exact: true })).toBeHidden();
    const product = expected.find((fixture) => fixture.code === code && fixture.name === "default")?.product;
    const savedTotal = (Array.isArray(product) ? product[0] : product)?.pricing?.total;
    expect(savedTotal).toBeTruthy();
    await expect(page.getByRole("tabpanel", { name: "Calculator" })).toContainText(savedTotal!.split("/")[0]);
    await expect(page.getByText(/Failed to load|pricing is unavailable/).first()).toBeHidden();
    expect(errors).toEqual([]);
  });
}

test("catalog routes preserve public URLs and response keys", async ({ request }) => {
  for (const name of ["nat-pricing", "evs-pricing", "dms-pricing"]) {
    const response = await request.get(`/api/catalog/${name}?region=cn-hong-kong`, { timeout: 60_000 });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body[name === "evs-pricing" ? "diskPricing" : "catalog"]).toBeTruthy();
    expect(body.catalogRegionId).toBe("ap-southeast-1");
  }
  expect((await request.get("/api/catalog/not-a-service")).status()).toBe(404);
  expect((await request.get("/api/projects")).status()).toBe(401);
  expect((await request.get("/api/v1/public/services")).status()).toBe(200);
});

test("saved estimates can be edited, batch-added, cloned, shared, exported and imported", async ({ page, baseURL }) => {
  test.setTimeout(180_000);
  // This scenario writes temporary accounts and must target an isolated local database.
  expect(["127.0.0.1", "localhost"]).toContain(new URL(baseURL!).hostname);
  await useCatalogFixtures(page);
  const { project, list } = await createTestCart(page, baseURL);
  await page.goto(`/?project=${project.id}&list=${list.id}`);
  await selectService(page, "EVS");
  const add = page.getByRole("button", { name: "Add to List", exact: true });
  await expect(add).toBeEnabled();
  const savedResponse = page.waitForResponse((response) => response.url().includes(`/api/lists/${list.id}/products`) && response.request().method() === "POST");
  await add.click();
  expect((await savedResponse).status()).toBe(201);
  let products = await (await page.request.get(`/api/lists/${list.id}/products`)).json();
  expect(products).toHaveLength(1);
  const original = products[0];
  await page.getByRole("button", { name: `Edit ${original.title}`, exact: true }).click();
  const editResponse = page.waitForResponse((response) => response.url().includes(`/products/${original.id}`) && response.request().method() === "PATCH");
  await page.getByRole("button", { name: "Save Changes", exact: true }).first().click();
  expect((await editResponse).ok()).toBe(true);
  products = await (await page.request.get(`/api/lists/${list.id}/products`)).json();
  expect(products[0].pricing).toEqual(original.pricing);
  expect(products[0].config).toEqual(original.config);

  await page.getByRole("tab", { name: "Batch add", exact: true }).click();
  await page.getByText(/Import existing .* text batches/).click();
  await page.locator("textarea").fill(JSON.stringify([{ diskSizeGiB: 80, quantity: 2 }, { diskSizeGiB: 120, quantity: 1 }]));
  await page.getByRole("button", { name: "Add Batch", exact: true }).click();
  await expect.poll(async () => (await (await page.request.get(`/api/lists/${list.id}/products`)).json()).length).toBe(3);
  products = await (await page.request.get(`/api/lists/${list.id}/products`)).json();
  expect(products.map((product: { config: { diskSizeGiB: number } }) => product.config.diskSizeGiB).sort((a: number, b: number) => a - b)).toEqual([original.config.diskSizeGiB, 80, 120]);

  const clone = await page.request.post(`/api/lists/${list.id}/clone`, { data: { name: "Cloned regression cart" } });
  expect(clone.ok()).toBe(true);
  const cloned = await clone.json();
  expect(cloned.products).toHaveLength(3);
  expect(cloned.products.every((copy: { id: string }) => products.every((source: { id: string }) => source.id !== copy.id))).toBe(true);
  const keyResponse = await page.request.post("/api/api-keys");
  expect(keyResponse.status()).toBe(201);
  const { key } = await keyResponse.json();
  const apiClone = await page.request.post(`/api/v1/private/lists/${list.id}/clone`, {
    headers: { "X-API-Key": key }, data: { name: "API cloned regression cart" },
  });
  expect(apiClone.ok()).toBe(true);
  const apiCloned = await apiClone.json();
  expect(apiCloned.products).toHaveLength(3);
  const apiProduct = await page.request.post(`/api/v1/private/lists/${apiCloned.id}/products`, {
    headers: { "X-API-Key": key },
    data: { serviceCode: "DMS", serviceName: "DMS Kafka", config: { ...getServiceBundle("DMS")!.service.defaults, region: "la-sao-paulo1" } },
  });
  expect(apiProduct.status()).toBe(201);
  expect((await apiProduct.json()).pricing.total).toMatch(/^USD /);
  const share = await page.request.post("/api/share", { data: { resourceType: "list", resourceId: list.id, mode: "copy" } });
  expect(share.ok()).toBe(true);
  const shared = await share.json();
  expect((await page.request.get(`/api/share/${shared.id}`)).ok()).toBe(true);
  await page.goto(shared.shareUrl);
  await expect(page.getByText("Regression cart", { exact: true }).first()).toBeVisible();

  await page.goto(`/?project=${project.id}&list=${list.id}`);
  const originalCart = page.getByRole("button", { name: /^Regression cart/ });
  if (!(await originalCart.isVisible())) {
    const expand = page.getByRole("button", { name: "Expand project", exact: true });
    if (await expand.isVisible()) await expand.click();
  }
  await originalCart.click();
  await page.getByRole("button", { name: "Open actions for Regression cart" }).click();
  await page.getByRole("menuitem", { name: "Export Cart JSON", exact: true }).click();
  const exported = JSON.parse(await page.getByRole("textbox", { name: "Resource export JSON" }).inputValue());
  const imported = await page.request.post("/api/import", { data: { payload: exported, targetProjectId: project.id } });
  expect(imported.status()).toBe(201);
  expect((await imported.json()).importedProductCount).toBe(3);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.json$/);
});

for (const code of ["ECS", "Flexus L"]) {
  test(`${code} retains pricing through save, edit and batch add`, async ({ page, baseURL }) => {
    await useCatalogFixtures(page);
    if (code === "ECS") {
      const diskPricing = JSON.parse(await readFile(resolve("tests/fixtures/runtime/evs.json"), "utf8"));
      await page.route("**/api/catalog/ecs-flavors?*", (route) => route.fulfill({ json: {
        flavors: [{
          resourceSpecCode: "c7.large.4", family: "c7", architecture: "x86", series: "c", description: "Regression flavor",
          cpu: 2, ramGiB: 8, prices: { ONDEMAND: 0.1, MONTHLY: 50, RI: 400 }, currency: "USD", updatedAt: "2026-01-01",
        }], diskPricing,
      } }));
    }
    const { project, list } = await createTestCart(page, baseURL);
    await page.goto(`/?project=${project.id}&list=${list.id}`);
    await selectService(page, code);
    if (code === "ECS") {
      await page.getByRole("button", { name: "Pay-per-use", exact: true }).click();
      await expect(page.getByRole("button", { name: /c7.large.4/ }).first()).toBeVisible();
    } else {
      await page.getByRole("button", { name: /2 vCPUs \| 2 GiB/ }).click();
    }
    const savedResponse = page.waitForResponse((response) => response.url().endsWith(`/api/lists/${list.id}/products`) && response.request().method() === "POST");
    await page.getByRole("button", { name: "Add to List", exact: true }).click();
    const response = await savedResponse;
    expect(response.status()).toBe(201);
    const original = await response.json();
    expect(original.pricing.total).toBe(code === "ECS" ? "USD 77.73/744h" : "USD 9.00/mo");
    await page.getByRole("button", { name: `Edit ${original.title}`, exact: true }).click();
    const editedResponse = page.waitForResponse((response) => response.url().endsWith(`/products/${original.id}`) && response.request().method() === "PATCH");
    await page.getByRole("button", { name: "Save Changes", exact: true }).first().click();
    const edited = await (await editedResponse).json();
    expect(edited.config).toEqual(original.config);
    expect(edited.pricing).toEqual(original.pricing);
    await page.getByRole("tab", { name: "Batch add", exact: true }).click();
    await page.getByText(/Import existing .* text batches/).click();
  await page.locator("textarea").fill(JSON.stringify([code === "ECS"
      ? { vcpu: 2, ram: 8, quantity: 2 }
      : { vcpu: 2, ram: 2, quantity: 2 }]));
    await page.getByRole("button", { name: "Add Batch", exact: true }).click();
    await expect.poll(async () => (await (await page.request.get(`/api/lists/${list.id}/products`)).json()).length).toBe(2);
    const products = await (await page.request.get(`/api/lists/${list.id}/products`)).json();
    const batchProduct = products.find((item: { id: string }) => item.id !== original.id);
    expect(batchProduct.quantity).toBe(2);
    expect(batchProduct.pricing.total).toBe(code === "ECS" ? "USD 155.47/744h" : "USD 18.00/mo");
  });
}

test("service shortcuts and dependent ECS disk controls survive the module split", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await useCatalogFixtures(page);
  const diskPricing = JSON.parse(await readFile(resolve("tests/fixtures/runtime/evs.json"), "utf8"));
  await page.route("**/api/catalog/ecs-flavors?*", (route) => route.fulfill({ json: {
    flavors: [{ resourceSpecCode: "c7.large.4", family: "c7", architecture: "x86", series: "c", description: "Test",
      cpu: 2, ramGiB: 8, prices: { ONDEMAND: 0.1, MONTHLY: 50 }, currency: "USD", updatedAt: "2026-01-01" }], diskPricing,
  } }));
  await page.goto("/?service=ECS&region=cn-hong-kong&billing=Pay-per-use&hours=730");
  await expect(page.getByRole("button", { name: /c7.large.4/ }).first()).toBeVisible();
  await expect(page.getByRole("tabpanel", { name: "Calculator" })).toContainText("730h");
  await page.keyboard.press("Control+k");
  const search = page.getByRole("combobox", { name: "Search services" });
  await expect(search).toBeFocused();
  await search.fill("NAT");
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(search).toBeHidden();
  await expect(page.getByRole("tabpanel", { name: "Calculator" })).toContainText("Gateway");
  await selectService(page, "ECS");
  await page.getByRole("combobox").filter({ hasText: "High I/O" }).click();
  await page.getByRole("option", { name: "General Purpose SSD V2", exact: true }).click();
  const iops = page.locator("[data-calculator-focus-group]").filter({ has: page.getByText("IOPS", { exact: true }) }).locator("input");
  await expect(iops).toHaveValue("3000");
  await iops.fill("999999");
  await iops.blur();
  await expect(iops).toHaveValue("20000");
  await page.keyboard.press("Alt+3");
  await expect(page.getByRole("button", { name: "Pay-per-use", exact: true })).toBeFocused();
  expect(errors).toEqual([]);
});

test("saved-item deep links, cart filtering, clipboard and project actions retain state", async ({ page, context, baseURL }) => {
  await useCatalogFixtures(page);
  const { project, list } = await createTestCart(page, baseURL);
  const productBody = { serviceCode: "EVS", serviceName: "Elastic Volume Service", productType: "evs", title: "Disk Alpha", quantity: 1,
    config: { region: "la-sao-paulo1", billingMode: "Pay-per-use", usageHours: 744, diskType: "High I/O", diskSizeGiB: 80, durationMonths: 1 }, pricing: { total: "USD 6.67/744h" } };
  const first = await (await page.request.post(`/api/lists/${list.id}/products`, { data: productBody })).json();
  await page.request.post(`/api/lists/${list.id}/products`, { data: { ...productBody, title: "Disk Beta" } });
  await page.request.post(`/api/projects/${project.id}/lists`, { data: { name: "Another cart" } });
  await page.goto(`/?service=EVS&project=${project.id}&list=${list.id}&editProduct=${first.id}&editList=${list.id}`);
  await expect(page.getByRole("button", { name: "Save Changes", exact: true }).first()).toBeVisible();
  await expect(page.getByText("Architecture regression / Regression cart", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).first().click();
  const filter = page.getByRole("textbox", { name: "Search cart items" });
  await filter.fill("Alpha");
  await expect(page.getByRole("button", { name: "Edit Disk Beta", exact: true })).toBeHidden();
  await filter.blur();
  await page.keyboard.press("Control+a");
  await expect(page.getByText("1 item selected", { exact: true })).toBeVisible();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.keyboard.press("Control+c");
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(JSON.parse(clipboard).map((item: { title: string }) => item.title)).toEqual(["Disk Alpha"]);
  await page.keyboard.press("Escape");
  await expect(page.getByText("1 item selected", { exact: true })).toBeHidden();
  await filter.fill("");
  await filter.blur();
  await page.evaluate((text) => {
    const data = new DataTransfer();
    data.setData("text", text);
    window.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, clipboard);
  await expect.poll(async () => (await (await page.request.get(`/api/lists/${list.id}/products`)).json()).length).toBe(3);
  await page.getByRole("button", { name: "Open actions for Architecture regression", exact: true }).click();
  await page.getByRole("menuitem", { name: "Rename Project", exact: true }).click();
  await page.locator('input[value="Architecture regression"]').fill("Renamed project");
  await page.getByRole("button", { name: "Save project name", exact: true }).click();
  await expect(page.getByText("Renamed project / Regression cart", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete Disk Beta", exact: true }).click();
  await expect.poll(async () => (await (await page.request.get(`/api/lists/${list.id}/products`)).json()).length).toBe(2);
});

test("projects page shares create, clone, export and delete workflows with the dashboard", async ({page,baseURL}) => {
  const errors: string[]=[]; page.on('pageerror', error=>errors.push(error.message));
  const {project,list}=await createTestCart(page,baseURL);
  await page.goto('/projects');
  await expect(page.getByText(project.name,{exact:true}).first()).toBeVisible();
  await page.getByPlaceholder('New project name').fill('Shared workflow project');
  await page.getByRole('button',{name:'New Project',exact:true}).click();
  await expect(page.getByText('Shared workflow project',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:`Open actions for ${project.name}`,exact:true}).click();
  await page.getByRole('menuitem',{name:'Clone Project',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:'Clone Project',exact:true}).click();
  await expect(dialog).toContainText(`Cloned ${project.name}`);
  await page.keyboard.press('Escape');
  const projects=await (await page.request.get('/api/projects')).json();
  expect(projects.some((p: {id:string;lists:{name:string}[]})=>p.id!==project.id&&p.lists.some(l=>l.name===list.name))).toBe(true);
  await page.getByRole('button',{name:`Open actions for ${project.name}`,exact:true}).click();
  await page.getByRole('menuitem',{name:'Export Project JSON',exact:true}).click();
  const exported=JSON.parse(await page.getByLabel('Resource export JSON').inputValue());
  expect(JSON.stringify(exported)).toContain(list.name);
  await page.getByRole('button',{name:'Close Export Project JSON',exact:true}).click();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Delete Shared workflow project',exact:true}).click();
  await expect(page.getByText('Shared workflow project',{exact:true})).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Huawei live saves verified prices into the main cart and reopens durable selections", async ({page,baseURL}) => {
  test.skip(process.env.NEO_NATIVE_TESTS!=='1','Requires the isolated native sidecar');
  test.setTimeout(300000);
  const errors: string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route("**/api/catalog/ecs-flavors?*", route => route.fulfill({ json: { flavors: [], diskPricing: null } }));
  const {project,list}=await createTestCart(page,baseURL);
  await page.goto(`/?project=${project.id}&list=${list.id}&service=NAT&region=cn-hong-kong`);
  await waitForNativePrice(page, 110000);
  const duration=page.locator('[data-field-id="global_ONDEMANDTIME:0"]');
  await duration.fill('2'); await duration.press('Tab');
  await expect(page.getByTestId('lab-price')).toBeVisible();
  const price=await page.getByTestId('lab-price').innerText();
  const saveResponse=page.waitForResponse(r=>r.url().endsWith(`/api/lists/${list.id}/products`)&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Add to List',exact:true}).click();
  const response=await saveResponse;expect(response.status()).toBe(201);
  const product=await response.json();
  expect(product.productType).toBe('huawei-native');
  expect(product.pricing.source).toBe('huawei-inquiry');
  expect(product.pricing.amount).toBe(Number(price.replace('USD','').replaceAll(',','').trim()));
  expect(product.config.selection.version).toBe(2);
  expect(product.config.selection.steps.length).toBeGreaterThan(0);
  expect(product.config.session).toBeUndefined();
  await page.reload(); // unmount releases the renderer; editing must start a new one
  await page.getByRole('button',{name:`Edit ${product.title}`,exact:true}).click();
  await waitForNativePrice(page, 110000);
  const saveEdit=page.waitForResponse(r=>r.url().endsWith(`/products/${product.id}`)&&r.request().method()==='PATCH');
  await page.getByRole('tabpanel',{name:'Calculator',exact:true}).getByRole('button',{name:'Save Changes',exact:true}).click();
  const editedResponse=await saveEdit;expect(editedResponse.status()).toBe(200);
  const edited=await editedResponse.json();
  expect(edited.config.selection).toEqual(product.config.selection);
  expect(edited.pricing.amount).toBe(product.pricing.amount);
  const forged=await page.request.post(`/api/lists/${list.id}/products`,{data:{...product,config:{...product.config,selection:{...product.config.selection,region:'invented'}},pricing:{total:'USD 0'}}});
  expect(forged.status()).toBe(422);
  expect((await (await page.request.get(`/api/lists/${list.id}/products`)).json()).length).toBe(1);
  const keyResponse=await page.request.post('/api/api-keys');
  const {key}=await keyResponse.json();
  const apiCopy=await page.request.post(`/api/v1/private/lists/${list.id}/products`,{headers:{'X-API-Key':key},data:{...product,productType:'forged',quantity:999,pricing:{total:'USD 0'}}});
  expect(apiCopy.status()).toBe(201);
  const copied=await apiCopy.json();
  expect(copied.productType).toBe('huawei-native');
  expect(copied.quantity).toBe(product.quantity);
  expect(copied.pricing.amount).toBe(product.pricing.amount);
  const apiEdit=await page.request.patch(`/api/v1/private/lists/${list.id}/products/${copied.id}`,{headers:{'X-API-Key':key},data:{...copied,quantity:999,pricing:{total:'USD 0'}}});
  expect(apiEdit.status()).toBe(200);
  expect((await apiEdit.json()).pricing.amount).toBe(product.pricing.amount);
  await page.route('**/api/projects',async route=>{
    const response=await route.fetch();
    const projects=await response.json();
    for(const project of projects) for(const list of project.lists) for(const item of list.products){
      if(item.id===product.id){item.config=null;item.title='Invalid native selection';}
    }
    await route.fulfill({response,json:projects});
  });
  await page.reload();
  // The saved edit deep link automatically reopens this invalid item.
  await expect(page.getByRole('alert').filter({hasText:'Missing saved Huawei configuration'})).toBeVisible();
  await expect(page.getByTestId('lab-price')).toBeHidden();
  expect(errors).toEqual([]);
  await page.unrouteAll({behavior:'wait'});
  await page.goto('/projects');
});

for (const [service,billingMode] of [["nat","PERIOD"],["ecs","RI"],["ccm","ONETIME"]] as const) {
  test(`Huawei live ${billingMode} saves terms and payment options and edits them exactly`,async ({page,baseURL}) => {
    test.skip(process.env.NEO_NATIVE_TESTS!=="1","Requires isolated native sidecar");
    test.setTimeout(360000);
    const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
    const {project,list}=await createTestCart(page,baseURL);
    const opened=page.waitForResponse(r=>r.url().endsWith("/api/calculator/native") && r.request().postDataJSON()?.action==="open");
    const code = ({ nat: "NAT", ecs: "ECS", ccm: "CCM" } as const)[service];
    const modeLabel = ({ PERIOD: "Yearly/Monthly", RI: "RI", ONETIME: "One-time" } as const)[billingMode];
    await page.goto(`/?project=${project.id}&list=${list.id}&service=${code}&region=cn-hong-kong&billing=${encodeURIComponent(modeLabel)}`);
    expect((await opened).status()).toBe(200);
    if (billingMode==="RI") {
      await waitForNativePrice(page, 110000);
      await page.getByText("Advanced ECS specification", { exact: true }).click();
      await chooseControl(page, page.locator('[data-field-id="calculator_ecs_radio:2"]'), {label:"aC8"});
      await waitForNativePrice(page, 110000);
      const images=page.locator('[data-field-id^="calculator_ims_select:"]');
      await expect(images).toHaveCount(2);
      for (const image of await images.all()) {
        await expect(image).toBeDisabled();
        await expect(image).toHaveAttribute("data-value", "-1");
        await expect(image).toContainText("Not available for this configuration");
      }
      await chooseControl(page, page.locator('[data-field-id="calculator_ecs_radio:2"]'), {label:"C7n"});
      await waitForNativePrice(page, 110000);
      await expect(images.first()).toBeEnabled();
      await chooseControl(page, page.locator('[data-field-id="calculator_ecs_radio:2"]'), {label:"aC8"});
      await waitForNativePrice(page, 110000);
      await chooseControl(page, page.locator('[data-field-id="calculator_ecs_RIRadio:1"]'), {label:"3 Years"});
      await waitForNativePrice(page, 110000);
      await expect(page.getByTestId("native-payment")).toContainText("Upfront:");
    } else {
      await waitForNativePrice(page, 110000);
      if (billingMode==="PERIOD") {
        await chooseControl(page, page.locator('[data-field-id="global_PERIODTIME:0"]'), {label:"1 year"});
        await waitForNativePrice(page, 110000);
      }
    }
    const saved=page.waitForResponse(r=>r.url().endsWith(`/api/lists/${list.id}/products`) && r.request().method()==="POST");
    await page.getByRole("button",{name:"Add to List",exact:true}).click();
    const response=await saved;expect(response.status()).toBe(201);
    const product=await response.json();
    expect(product.config.selection.billingMode).toBe(billingMode);
    expect(product.pricing.amount).toBeGreaterThan(0);
    if (billingMode==="RI") expect(product.pricing.payment.installments).toBe(36);
    await page.reload();
    await page.getByRole("button",{name:`Edit ${product.title}`,exact:true}).click();
    await waitForNativePrice(page, 110000);
    await expect(page.getByLabel("Huawei billing mode",{exact:true})).toHaveAttribute("data-value", billingMode);
    if (billingMode==="RI") {
      await page.getByText("Advanced ECS specification", { exact: true }).click();
      await expect(page.locator('[data-field-id="calculator_ecs_radio:2"]').getByRole("button", { name: "aC8", exact: true })).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator('[data-field-id="calculator_ims_select:0"]')).toBeDisabled();
      await expect(page.locator('[data-field-id="calculator_ims_select:1"]')).toHaveAttribute("data-value", "-1");
    }
    const edited=page.waitForResponse(r=>r.url().endsWith(`/products/${product.id}`) && r.request().method()==="PATCH");
    await page.getByRole("tabpanel",{name:"Calculator",exact:true}).getByRole("button",{name:"Save Changes",exact:true}).click();
    const editResponse=await edited;expect(editResponse.status()).toBe(200);
    const next=await editResponse.json();
    expect(next.config.selection).toEqual(product.config.selection);
    expect(next.pricing.amount).toBe(product.pricing.amount);
    expect(next.pricing.payment).toEqual(product.pricing.payment);
    expect(errors).toEqual([]);
    await page.goto("/projects");
  });
}

test("Huawei billing choices follow the service and region and switching an open mode reprices",async ({page})=>{
  test.skip(process.env.NEO_NATIVE_TESTS!=="1","Requires isolated native sidecar");
  test.setTimeout(180000);
  await page.goto("/?tab=huawei-live");
  const mode=page.getByLabel("Huawei billing mode",{exact:true});
  await expect(mode.getByRole("button")).toHaveText(["Yearly/Monthly","Pay-per-use","RI"]);
  await chooseControl(page, page.getByLabel("Huawei region",{exact:true}), "cn-north-4");
  await expect(mode.getByRole("button")).toHaveText(["Yearly/Monthly","Pay-per-use"]);
  await chooseControl(page, page.getByLabel("Huawei region",{exact:true}), "ap-southeast-1");
  await chooseControl(page, page.getByLabel("Service",{exact:true}), "NAT");
  await waitForNativePrice(page, 110000);
  const reopened=page.waitForResponse(r=>r.url().endsWith("/api/calculator/native") && r.request().postDataJSON()?.action==="open");
  await chooseControl(page, mode, "PERIOD");
  const response=await reopened;expect(response.status()).toBe(200);
  const state=await response.json();
  expect(state.billingMode).toBe("PERIOD");expect(state.inquiry.chargingMode).toBe(0);
  await expect(page.locator('[data-field-id="global_PERIODTIME:0"]')).toBeVisible();
  await chooseControl(page, page.getByLabel("Service",{exact:true}), "CCM");
  await expect(mode.getByRole("button")).toHaveText(["One-time"]);
  await expect(mode).toHaveAttribute("data-value", "ONETIME");
  await waitForNativePrice(page, 110000);
  const rejected=await page.request.post("/api/calculator/native",{data:{action:"open",service:"ccm",region:"ap-southeast-1",billingMode:"ONDEMAND"}});
  expect(rejected.status()).toBe(422);
  await page.goto("/projects");
});
