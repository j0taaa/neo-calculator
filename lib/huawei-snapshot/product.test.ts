import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProductMutationBody } from "../calculator-types";
import type { NativeState } from "../huawei-native/native-types";
import type { ScopeSnapshot, SnapshotRelease } from "./types";
import { SnapshotStore } from "./store";
import { verifySnapshotProduct } from "./product";

test("saving, current-rate repricing and a batch pinned to one release share price reconstruction", async () => {
  const root = await mkdtemp(join(tmpdir(), "neo-product-test-"));
  const store = new SnapshotStore(root);
  try {
    const scope: ScopeSnapshot = { service: "ecs", region: "region", modes: ["ONDEMAND"], config: "rules",
      source: { page: "", config: "rules-1", products: "", framework: "framework-1", menu: "", fetchedAt: "2026-10-09" },
      checks: 1, verifiedAt: "2026-10-09",
      products: { region: "region", urlPath: "ecs", product: { vm: [{ cloudServiceType: "svc", resourceType: "vm", resourceSpecCode: "sku",
        planList: [{ productId: "product", billingMode: "ONDEMAND", measureUnit: 4, amount: 2 }] }] } } };
    const candidate: SnapshotRelease = { version: 1, id: "", createdAt: "first", menu: "{}", frameworkUrl: "", assets: {}, diagnostics: [],
      directory: { services: [], regions: [], billingModes: {} }, scopes: { "ecs/region": await store.writeScope(scope) } };
    const id = await store.publish(candidate);
    const local: NonNullable<NativeState["local"]> = { release: id,
      pricing: { epoch: 1, pending: false, result: null, selectedProduct: { serviceCode: "ecs", region: "region", chargeMode: "ONDEMAND",
        periodNum: 1, periodType: 4, subscriptionNum: 1, timeTag: 1, purchaseNum: { measureValue: 2 },
        productAllInfos: [{ selectIndex: 0, productId: "product", resourceSpecCode: "sku", productNum: 2, selfProductNum: 1, inquiryTag: "normal" }] } },
      inquiries: [{ regionId: "region", chargingMode: 1, periodNum: 1, periodType: 4, subscriptionNum: 1, siteCode: "HWC",
        productInfos: [{ id: "1-0-product", cloudServiceType: "svc", resourceType: "vm", resourceSpecCode: "sku", productNum: 2,
          usageFactor: "duration", usageMeasureId: 4, usageValue: 1 }] }] };
    const draft: ProductMutationBody = { serviceCode: "HUAWEI:ecs", serviceName: "ECS", productType: "huawei-native", title: "VM", quantity: 999,
      pricing: { amount: 0, currency: "JPY" }, config: { region: "region", billingMode: "Pay-per-use", local,
        selection: { version: 2, service: "ecs", region: "region", billingMode: "ONDEMAND", initial: [], steps: [], fields: [
          { id: "global_QUANTITY:0", component: "global_QUANTITY", label: "Quantity", type: "number", value: 2 }] } } };
    const original = await store.active();
    expect((await verifySnapshotProduct(draft, store)).pricing).toMatchObject({ amount: 4, currency: "USD" });
    expect((await verifySnapshotProduct(draft, store)).quantity).toBe(2);
    const changed = structuredClone(scope); changed.products.product.vm[0].planList![0].amount = 3;
    await store.publish({ ...candidate, createdAt: "second", scopes: { "ecs/region": await store.writeScope(changed) } });
    expect((await verifySnapshotProduct(draft, store, false)).pricing).toMatchObject({ amount: 4 });
    expect((await verifySnapshotProduct(draft, store, true)).pricing).toMatchObject({ amount: 6 });
    // A publication between two products cannot cause different rates inside the same batch.
    expect((await verifySnapshotProduct(draft, store, true, original)).pricing).toMatchObject({ amount: 4 });
    changed.source.config = "rules-2";
    await store.publish({ ...candidate, createdAt: "third", scopes: { "ecs/region": await store.writeScope(changed) } });
    await expect(verifySnapshotProduct(draft, store, true)).rejects.toThrow("conditional calculator rules changed");
  } finally { await rm(root, { recursive: true, force: true }); }
});
