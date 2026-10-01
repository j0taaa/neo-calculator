import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium } from "playwright";
import type { DemoState } from "./runtime";

// The browser tests the UI only. The calculator runtime must have no browser process.
const url =
  process.env.BROWSERLESS_URL ||
  "https://calculator-lab.hwctools.site/browserless-demo/";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
page.setDefaultTimeout(65000);
const errors: string[] = [];
page.on("pageerror", (error) => errors.push(error.message));
const exec = promisify(execFile);
async function response(action: () => Promise<unknown>, kind = "open") {
  const [reply] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/session") &&
        r.request().method() === "POST" &&
        r.request().postDataJSON().action === kind,
    ),
    action(),
  ]);
  return {
    status: reply.status(),
    data: (await reply.json()) as DemoState & {
      session: string;
      error?: string;
    },
  };
}
async function open(
  service: string,
  mode = "ONDEMAND",
  region = "ap-southeast-1",
) {
  await page.getByLabel("Service", { exact: true }).selectOption(service);
  await page.getByLabel("Region", { exact: true }).selectOption(region);
  await page.getByLabel("Billing mode", { exact: true }).selectOption(mode);
  const result = await response(() =>
    page.getByRole("button", { name: "Open demo", exact: true }).click(),
  );
  if (result.status !== 200) throw Error(result.data.error);
  await page.waitForFunction(
    () => !document.querySelector<HTMLButtonElement>("#close")!.disabled,
  );
  assert(result.data.quote, result.data.priceError);
  return result.data;
}
async function change(state: DemoState, label: RegExp) {
  const field = state.fields.find((f) =>
    f.options?.some((o) => label.test(o.label) && !o.disabled),
  );
  assert(field);
  const option = field.options!.find(
    (o) => label.test(o.label) && !o.disabled,
  )!;
  const result = await response(
    () =>
      page.locator(`[data-field-id="${field.id}"]`).selectOption(option.value),
    "change",
  );
  assert.equal(result.status, 200, result.data.error);
  assert(result.data.quote, result.data.priceError);
  await page.waitForFunction(
    () => !document.querySelector<HTMLFieldSetElement>("#fields")!.disabled,
  );
  assert.equal(
    result.data.fields.find((f) => f.id === field.id)?.value,
    option.value,
  );
  return result.data;
}
async function close() {
  await response(
    () => page.getByRole("button", { name: "Close demo", exact: true }).click(),
    "close",
  );
}
async function post(body: unknown) {
  return page.request.post(new URL("api/session", url).href, {
    data: Buffer.from(JSON.stringify(body)),
    headers: { "content-type": "application/json" },
  });
}
try {
  await page.goto(url);
  await page.waitForFunction(
    () =>
      document.querySelector<HTMLSelectElement>("#service")!.options.length ===
      97,
  );
  assert.equal(await page.locator("#mode option").count(), 2);
  const unknown = await post({
    action: "open",
    service: "not-a-service",
    region: "ap-southeast-1",
    billingMode: "ONDEMAND",
  });
  assert.equal(unknown.status(), 422);
  let state = await open("nat");
  assert.equal(state.quote!.amount, 2.438);
  const containers = (
    await exec("docker", [
      "ps",
      "--filter",
      "ancestor=neo-browserless-runtime:demo",
      "--format",
      "{{.ID}}",
    ])
  ).stdout
    .trim()
    .split("\n");
  assert.equal(containers.length, 1);
  assert(containers[0]);
  const inspected = JSON.parse(
    (await exec("docker", ["inspect", containers[0]])).stdout,
  )[0];
  assert.equal(inspected.HostConfig.NetworkMode, "none");
  assert.equal(inspected.HostConfig.ReadonlyRootfs, true);
  assert.equal(inspected.Config.User, "65534:65534");
  assert.equal(inspected.HostConfig.Memory, 1536 * 1024 * 1024);
  assert.deepEqual(inspected.HostConfig.CapDrop, ["ALL"]);
  assert.equal(inspected.Mounts.length, 0);
  const processes = (
    await exec("docker", ["top", containers[0], "-eo", "pid,comm"])
  ).stdout;
  assert(!/chrome|chromium/i.test(processes), processes);
  const slot = await post({
    action: "open",
    service: "elb",
    region: "ap-southeast-1",
    billingMode: "ONDEMAND",
  });
  assert.equal(slot.status(), 429);
  state = await change(state, /^Private/);
  assert.equal(state.quote!.amount, 0.102);
  const number = state.fields.find((f) => f.type === "number" && !f.disabled)!;
  assert(number);
  const changed = await response(
    () =>
      page
        .locator(`[data-field-id="${number.id}"]`)
        .fill("2")
        .then(() => page.locator(`[data-field-id="${number.id}"]`).blur()),
    "change",
  );
  assert.equal(changed.status, 200, changed.data.error);
  assert.equal(changed.data.quote!.amount, 0.204);
  await page.waitForFunction(
    () => !document.querySelector<HTMLFieldSetElement>("#fields")!.disabled,
  );
  await page.locator(`[data-field-id="${number.id}"]`).fill("");
  await page.locator(`[data-field-id="${number.id}"]`).blur();
  assert(await page.locator("#price").isHidden());
  assert.match(await page.locator("#error").innerText(), /valid value/);
  await close();
  state = await open("ecs", "RI");
  state = await change(state, /^aC8$/);
  const images = state.fields.filter((f) => /image/i.test(f.label));
  assert(images.length >= 1);
  assert(images.some((f) => f.disabled && !f.options?.length));
  const disabled = images.find((f) => f.disabled)!;
  assert(await page.locator(`[data-field-id="${disabled.id}"]`).isDisabled());
  const invalid = await post({
    action: "change",
    session: state.session,
    field: disabled.id,
    value: "invalid",
  });
  assert.equal(invalid.status(), 422);
  assert.equal((await invalid.json()).quote, undefined);
  // Invalid edits close their session; clean up the UI before the next case.
  await close();
  for (const service of ["function", "mrs", "vod"]) {
    await page.getByLabel("Service", { exact: true }).selectOption(service);
    const result = await response(() =>
      page.getByRole("button", { name: "Open demo", exact: true }).click(),
    );
    assert.equal(result.status, 422);
    assert.match(result.data.error!, /cannot map all inputs/);
    await page.waitForFunction(
      () => !document.querySelector<HTMLButtonElement>("#open")!.disabled,
    );
    assert.match(
      await page.locator("#error").innerText(),
      /No price is offered/,
    );
    assert(await page.locator("#price").isHidden());
  }
  await page.getByLabel("Service", { exact: true }).selectOption("maas");
  assert(
    await page
      .getByRole("button", { name: "Open demo", exact: true })
      .isDisabled(),
  );
  const expired = await post({
    action: "change",
    session: "unknown",
    field: "x",
    value: 1,
  });
  assert.equal(expired.status(), 410);
  const malformed = await page.request.post(new URL("api/session", url).href, {
    data: Buffer.from("{"),
    headers: { "content-type": "application/json" },
  });
  assert.equal(malformed.status(), 422);
  const invalidBody = await post("unexpected string");
  assert.equal(invalidBody.status(), 422);
  await page.getByLabel("Service", { exact: true }).selectOption("ccm");
  assert(await page.locator('#mode option[value="ONETIME"]').count());
  assert.match(
    await page.locator("#status").innerText(),
    /Select a configuration/,
  );
  assert.equal(await page.locator("#error").innerText(), "");
  const oversized = await page.request.post(new URL("api/session", url).href, {
    data: "x".repeat(5000),
  });
  assert.equal(oversized.status(), 413);
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.screenshot({
    path: "/tmp/neo-browserless-demo-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: public UI, HTTP validation, four advertised modes, conditional NAT, RI images, unsupported services, numeric drafts, sandbox confinement, mobile layout.",
  );
} finally {
  if (
    await page
      .getByRole("button", { name: "Close demo", exact: true })
      .isEnabled()
      .catch(() => false)
  )
    await close().catch(() => {});
  await browser.close();
}
