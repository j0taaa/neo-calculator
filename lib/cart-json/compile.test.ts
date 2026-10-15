import { expect, test } from "bun:test";
import Ajv from "ajv/dist/2020";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixture } from "../calculator-rules/test-fixture";
import { CalculatorEngine } from "../calculator-rules/engine";
import { SnapshotStore } from "../huawei-snapshot/store";
import { ResourceCompiler, describeConfiguration } from "./compile";
import { publishedResourceSchema, assertDocumentStructure, resourceSchemaOrigin } from "./schema";
import { ResourceDocumentError, type ResourceIntent } from "./types";
import { readResourceJson } from "./http";

const intent = (changes: Partial<ResourceIntent> = {}): ResourceIntent => ({ serviceCode: "HUAWEI:ecs", region: "region", billingMode: "ONDEMAND", choices: [], ...changes });
const cart = (products: ResourceIntent[] = [intent()]) => ({ schemaVersion: 2, resourceType: "cart", cart: { name: "Generated", products } });
test("schema URLs use the public proxy origin without leaking the internal port", () => {
  for (const [headers, expected] of [
    [{ "x-forwarded-proto": "https", "x-forwarded-host": "calculator.example" }, "https://calculator.example"],
    [{ "x-forwarded-proto": "https", "host": "calculator.example" }, "https://calculator.example"],
    [{ "x-forwarded-proto": "https", "x-forwarded-host": "calculator.example:443" }, "https://calculator.example"],
    [{ "x-forwarded-proto": "https, http", "x-forwarded-host": "calculator.example:8443, internal:3000" }, "https://calculator.example:8443"],
    [{ "host": "127.0.0.1:3307" }, "http://127.0.0.1:3307"],
    [{}, "http://localhost:3000"],
  ] as const) expect(resourceSchemaOrigin(new Request("http://localhost:3000/api/v1/cart/schema", { headers }))).toBe(expected);
});
async function setup(run: (compiler: ResourceCompiler) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "neo-resource-json-"));
  try {
    const { scope, release } = fixture(), store = new SnapshotStore(root);
    release.directory = { services: [{ id: "ecs", name: "ECS", category: "Compute", available: true }], regions: [{ id: "region", name: "Region" }], billingModes: { ecs: { region: ["ONDEMAND", "PERIOD"] } } };
    release.scopes = { "ecs/region": await store.writeScope(scope) };
    await store.publish(release);
    await run(new ResourceCompiler(await store.active(), store));
  } finally { await rm(root, { recursive: true, force: true }); }
}
test("one portable schema validates drafts locally and includes all published availability", async () => setup(async compiler => {
  const schema = publishedResourceSchema(compiler.release, "https://calculator.example");
  const ajv = new Ajv({ strict: false, allowUnionTypes: true }), validate = ajv.compile(schema);
  expect(validate(cart())).toBe(true);
  expect(validate(cart([intent({ serviceCode: "HUAWEI:unknown" })]))).toBe(false);
  expect(validate(cart([intent({ region: "unknown" })]))).toBe(false);
  expect(validate(cart([intent({ billingMode: "RI" })]))).toBe(false);
  expect(validate(schema.examples[0])).toBe(true);
  expect(schema["x-neo"].endpoints.validate.authentication).toBe("none");
}));
test("a draft needs no UI state or price proof; choices and quantities reconstruct the same local price", async () => setup(async compiler => {
  const input = cart([intent({ title: "Two small VMs", choices: [{ field: "flavor:0", option: "Small" }, { field: "global_ONDEMANDTIME:0", value: 3 }, { field: "global_QUANTITY:0", value: 2 }] })]);
  const result = await compiler.document(input);
  expect(result.productCount).toBe(1);
  expect(result.totals).toEqual({ USD: 12 });
  expect(result.payload.resourceType).toBe("cart");
  const products = result.normalized.resourceType === "cart" ? result.normalized.cart!.products : [];
  expect(products[0]).toMatchObject({ quantity: 2, title: "Two small VMs", pricing: { amount: 12, currency: "USD", source: "huawei-catalog" } });
  const scope = await compiler.store.scope(compiler.release, "ecs", "region", false);
  const engine = new CalculatorEngine(scope.rules!, scope, JSON.parse(compiler.release.menu), compiler.release.id, "ONDEMAND");
  engine.change("flavor:0", "1"); engine.change("global_ONDEMANDTIME:0", 3); engine.change("global_QUANTITY:0", 2);
  expect(products[0].pricing).toMatchObject({ amount: engine.state.quote!.amount });
  expect((await compiler.document(result.normalized)).totals).toEqual(result.totals);
}));
test("configuration discovery produces a valid schema for numbers, labels and exact values", async () => setup(async compiler => {
  const { state } = await compiler.configure(intent());
  const description = describeConfiguration(state);
  const validate = new Ajv({ strict: false }).compile(description.nextChoiceSchema);
  expect(validate({ field: "flavor:0", option: "Small" })).toBe(true);
  expect(validate({ field: "flavor:0", value: "1" })).toBe(true);
  expect(validate({ field: "flavor:0", option: "Unavailable" })).toBe(false);
  expect(validate({ field: "global_QUANTITY:0", value: 1.5 })).toBe(false);
  expect(validate({ field: "global_ONDEMANDTIME:0", value: 10000 })).toBe(false);
  expect(description.controls.some(control => control.id === "flavor:0")).toBe(true);
}));
test("invalid scopes and choices return exact document paths; no partial normalized cart", async () => setup(async compiler => {
  for (const [product, suffix] of [
    [intent({ serviceCode: "HUAWEI:invalid" }), "serviceCode"],
    [intent({ region: "invalid" }), "region"],
    [intent({ billingMode: "RI" }), "billingMode"],
    [intent({ choices: [{ field: "flavor:0", option: "Invalid" }] }), "choices/0/option"],
    [intent({ choices: [{ field: "flavor:0", label: "Wrong control", option: "Small" }] }), "choices/0/label"],
    [intent({ choices: [{ field: "hidden", value: true }] }), "choices/0/field"],
    [intent({ choices: [{ field: "global_QUANTITY:0", value: 0 }] }), "choices/0/value"],
    [intent({ choices: [{ field: "global_QUANTITY:0", value: 1.5 }] }), "choices/0/value"],
  ] as const) {
    try { await compiler.document(cart([intent(), product])); throw new Error("Accepted invalid input"); }
    catch (error) {
      expect(error).toBeInstanceOf(ResourceDocumentError);
      expect((error as ResourceDocumentError).issues[0].path).toBe(`/cart/products/1/${suffix}`);
    }
  }
}));
test("schema rejects typos, injected prices, unknown versions, mixed documents and malformed choice values", () => {
  for (const value of [
    { ...cart(), schemaVersion: 99 },
    { ...cart(), unexpected: true },
    { ...cart(), project: { name: "Both", lists: [] } },
    cart([{ ...intent(), pricing: { amount: 0 } } as ResourceIntent]),
    cart([{ ...intent(), choices: [{ field: "flavor:0", option: "Small", value: "1" }] } as unknown as ResourceIntent]),
    cart([{ ...intent(), choices: [{ field: "global_QUANTITY:0", value: null }] } as unknown as ResourceIntent]),
  ]) expect(() => assertDocumentStructure(value, "intent")).toThrow(ResourceDocumentError);
});
test("saved export monetary tampering is discarded and invalid quantities/configurations are rejected", async () => setup(async compiler => {
  const { normalized } = await compiler.document(cart());
  const saved = structuredClone(normalized);
  Object.assign(saved.cart!.products[0], { id: "source-product-id", createdAt: "source-time", updatedAt: "source-time" });
  saved.cart!.products[0].pricing = { amount: -999, currency: "JPY" };
  const imported = await compiler.document(saved);
  expect(imported.totals).toEqual({ USD: 4 });
  expect(imported.normalized.cart!.products[0]).not.toHaveProperty("id");
  expect(imported.normalized.cart!.products[0]).not.toHaveProperty("createdAt");
  saved.cart!.products[0].quantity = 0;
  await expect(compiler.document(saved)).rejects.toThrow("quantity");
  saved.cart!.products[0].quantity = 2;
  await expect(compiler.document(saved)).rejects.toThrow("disagrees");
  saved.cart!.products[0].quantity = 1;
  saved.cart!.products[0].config = {};
  await expect(compiler.document(saved)).rejects.toThrow("Missing saved Huawei configuration");
}));
test("projects share one release, support mixed modes and return empty carts faithfully", async () => setup(async compiler => {
  const document = { schemaVersion: 2, releaseId: compiler.release.id, resourceType: "project", project: { name: "Project", description: "Description", lists: [cart().cart, { name: "Monthly", products: [intent({ billingMode: "PERIOD" })] }, { name: "Empty", products: [] }] } };
  const result = await compiler.document(document);
  expect(result.productCount).toBe(2);
  expect(result.totals.USD).toBeGreaterThan(4);
  expect(result.normalized.project!.lists).toHaveLength(3);
  expect(result.normalized.project!.lists[2].products).toEqual([]);
  await expect(compiler.document({ ...document, releaseId: "a".repeat(64) })).rejects.toThrow("catalog changed");
}));
test("saved selections can be verified against current rates without an unavailable historical snapshot", async () => setup(async compiler => {
  const { normalized } = await compiler.document(cart());
  const config = normalized.cart!.products[0].config as { local: { release: string } };
  config.local.release = "b".repeat(64);
  expect((await compiler.document(normalized)).totals).toEqual({ USD: 4 });
}));
test("changing a parent must not silently reset a requested child option", async () => setup(async compiler => {
  const scope = await compiler.store.scope(compiler.release, "ecs", "region", false);
  scope.rules!.components[0].optionKeys = ["family", "size"];
  scope.rules!.components[0].titles = ["Family", "Size"];
  for (const row of scope.products.product.ec2_vm) row.family = "A";
  scope.products.product.ec2_vm.push({ ...structuredClone(scope.products.product.ec2_vm[1]), family: "B", resourceSpecCode: "vm.B.Large" });
  await compiler.store.publish({ ...compiler.release, scopes: { "ecs/region": await compiler.store.writeScope(scope) } });
  const changed = new ResourceCompiler(await compiler.store.active(), compiler.store);
  const choices = [{ field: "flavor:1", option: "Small" }, { field: "flavor:0", option: "B" }];
  await expect(changed.document(cart([intent({ choices })]))).rejects.toThrow("reset or removed");
  choices.push({ field: "flavor:1", option: "Large" });
  expect((await changed.document(cart([intent({ choices })]))).totals.USD).toBeGreaterThan(0);
}));
test("informational scopes can be discovered but cannot be imported as priced resources", async () => setup(async compiler => {
  const scope = await compiler.store.scope(compiler.release, "ecs", "region", false);
  scope.modeAvailability = { ONDEMAND: "information" };
  await compiler.store.publish({ ...compiler.release, scopes: { "ecs/region": await compiler.store.writeScope(scope) } });
  const changed = new ResourceCompiler(await compiler.store.active(), compiler.store);
  expect((await changed.configure(intent())).state.availability).toBe("information");
  await expect(changed.document(cart())).rejects.toThrow("cannot be quoted");
}));
test("validation is pinned to a captured release while the daily publisher changes prices", async () => setup(async compiler => {
  const scope = await compiler.store.scope(compiler.release, "ecs", "region", false);
  for (const row of scope.products.product.ec2_vm) row.planList![0].amount! *= 2;
  await compiler.store.publish({ ...compiler.release, createdAt: "second", scopes: { "ecs/region": await compiler.store.writeScope(scope) } });
  expect((await compiler.document(cart())).totals).toEqual({ USD: 4 });
  const fresh = new ResourceCompiler(await compiler.store.active(), compiler.store);
  expect((await fresh.document(cart())).totals).toEqual({ USD: 8 });
  const saved = (await compiler.document(cart())).normalized;
  expect((await fresh.document(saved)).totals).toEqual({ USD: 8 });
}));
test("bounded JSON reader rejects malformed and oversized requests", async () => {
  await expect(readResourceJson(new Request("http://localhost", { method: "POST", body: "{" }))).rejects.toThrow("valid JSON");
  await expect(readResourceJson(new Request("http://localhost", { method: "POST", body: " ".repeat(2000001) }))).rejects.toThrow("2 MB");
  expect(await readResourceJson(new Request("http://localhost", { method: "POST", body: JSON.stringify(cart()) }))).toEqual(cart());
});
