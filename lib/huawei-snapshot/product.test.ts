import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProductMutationBody } from "../calculator-types";
import { SnapshotStore } from "./store";
import { verifySnapshotProduct } from "./product";
import { fixture } from "../calculator-rules/test-fixture";
import { CalculatorEngine } from "../calculator-rules/engine";
import type { NativeState } from "../huawei-native/native-types";

test("saving and repricing replay choices, discard client totals and pin each batch to one release", async () => {
  const root = await mkdtemp(join(tmpdir(), "neo-product-test-")), store = new SnapshotStore(root);
  try {
    const { scope, release: candidate, menu } = fixture();
    candidate.scopes = { "ecs/region": await store.writeScope(scope) };
    const id = await store.publish(candidate), engine = new CalculatorEngine(scope.rules!, scope, menu, id, "ONDEMAND");
    engine.evaluate(); engine.change("flavor:0", "1");
    const state = engine.change("global_QUANTITY:0", 2);
    const draft: ProductMutationBody = { serviceCode: "HUAWEI:ecs", serviceName: "ECS", productType: "huawei-native", title: "VM", quantity: 999,
      pricing: { amount: 0, currency: "JPY" }, config: { region: "region", billingMode: "Pay-per-use", local: state.local, selection: state.selection } };
    const original = await store.active();
    expect((await verifySnapshotProduct(draft, store)).pricing).toMatchObject({ amount: 4, currency: "USD" });
    expect((await verifySnapshotProduct(draft, store)).quantity).toBe(2);
    const changed = structuredClone(scope); changed.products.product.ec2_vm[0].planList![0].amount = 3;
    await store.publish({ ...candidate, createdAt: "second", scopes: { "ecs/region": await store.writeScope(changed) } });
    expect((await verifySnapshotProduct(draft, store, false)).pricing).toMatchObject({ amount: 4 });
    expect((await verifySnapshotProduct(draft, store, true)).pricing).toMatchObject({ amount: 6 });
    expect((await verifySnapshotProduct(draft, store, true, original)).pricing).toMatchObject({ amount: 4 });
    changed.products.product.ec2_vm = changed.products.product.ec2_vm.slice(1);
    await store.publish({ ...candidate, createdAt: "third", scopes: { "ecs/region": await store.writeScope(changed) } });
    await expect(verifySnapshotProduct(draft, store, true)).rejects.toThrow("no longer offers");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("the API rebuilds resources instead of trusting a fabricated client resource list", async () => {
  const root = await mkdtemp(join(tmpdir(), "neo-product-test-")), store = new SnapshotStore(root);
  try {
    const { scope, release, menu } = fixture(); release.scopes = { "ecs/region": await store.writeScope(scope) };
    const id = await store.publish(release), state = new CalculatorEngine(scope.rules!, scope, menu, id, "ONDEMAND").evaluate();
    const proof = structuredClone(state.local!); proof.pricing.selectedProduct.productAllInfos[0].resourceSpecCode = "free.fake"; proof.inquiries = [];
    const draft: ProductMutationBody = { serviceCode: "HUAWEI:ecs", serviceName: "ECS", productType: "huawei-native", title: "VM", quantity: 1, config: { region: "region", billingMode: "Pay-per-use", local: proof, selection: state.selection } };
    const verified = await verifySnapshotProduct(draft, store);
    expect(verified.pricing).toMatchObject({ amount: 4, currency: "USD" });
    expect(JSON.stringify(verified.config)).not.toContain("free.fake");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("durable products from the former live calculator migrate through Neo without a browser", async () => {
  const root = await mkdtemp(join(tmpdir(), "neo-product-test-")), store = new SnapshotStore(root);
  try {
    const { scope, release, menu } = fixture(); release.scopes = { "ecs/region": await store.writeScope(scope) };
    const id = await store.publish(release), state = new CalculatorEngine(scope.rules!, scope, menu, id, "ONDEMAND").state;
    const source = { ...state.source, ...Object.fromEntries(["page", "config", "products", "framework", "menu"].map(key => [key, "a".repeat(64)])) };
    const draft: ProductMutationBody = { serviceCode: "HUAWEI:ecs", productType: "huawei-native", serviceName: "ECS", title: "Old live item", quantity: 1, pricing: { amount: 0, currency: "USD" }, config: { runtime: "huawei-native", region: "region", billingMode: "Pay-per-use", source, selection: state.selection } };
    const verified = await verifySnapshotProduct(draft, store);
    expect(verified.pricing).toMatchObject({ amount: 4, source: "huawei-catalog" });
    expect((verified.config as { local: NativeState["local"] }).local?.release).toBe(id);
  } finally { await rm(root, { recursive: true, force: true }); }
});
