import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { verifySnapshotProduct } from "../huawei-snapshot/product";
import { verifyNativeProduct, isNativeProduct } from "./native-product";
import { SnapshotStore } from "../huawei-snapshot/store";
import type { ProductMutationBody } from "../calculator-types";
import type { ScopeSnapshot, SnapshotRelease } from "../huawei-snapshot/types";

test("saved quotations use local rates, preserve quantity, and reject changed identities", async () => {
  const root = await mkdtemp(join(tmpdir(), "local-product-")),
    store = new SnapshotStore(root);
  try {
    const source = {
      page: "",
      config: "",
      products: "",
      framework: "",
      menu: "",
      fetchedAt: "2026-10-08T00:00:00Z",
    };
    const scope: ScopeSnapshot = {
      service: "ecs",
      region: "ap-southeast-1",
      modes: ["ONDEMAND"],
      config: "",
      source,
      verifiedAt: source.fetchedAt,
      checks: 1,
      products: {
        region: "ap-southeast-1",
        urlPath: "ecs",
        product: {
          rows: [
            {
              resourceSpecCode: "sku",
              resourceType: "resource",
              cloudServiceType: "service",
              planList: [
                {
                  billingMode: "ONDEMAND",
                  amount: 2,
                  measureUnit: 4,
                  productId: "product",
                },
              ],
            },
          ],
        },
      },
    };
    const hash = await store.blob(JSON.stringify(scope), ".json");
    const release: SnapshotRelease = {
      version: 1,
      id: "",
      createdAt: source.fetchedAt,
      directory: { services: [], regions: [], billingModes: {} },
      menu: "{}",
      frameworkUrl: "",
      assets: {},
      scopes: { "ecs/ap-southeast-1": hash },
      diagnostics: [],
    };
    const id = await store.publish(release);
    const fields = [
      {
        id: "quantity",
        component: "global_QUANTITY",
        label: "Quantity",
        type: "number",
        value: 2,
      },
    ];
    const selection = {
      version: 2,
      service: "ecs",
      region: scope.region,
      billingMode: "ONDEMAND",
      initial: fields,
      steps: [],
      fields,
    };
    const inquiry = {
      regionId: scope.region,
      chargingMode: 1,
      periodNum: 1,
      periodType: 4,
      subscriptionNum: 1,
      siteCode: "HWC",
      productInfos: [
        {
          id: "1-0-product",
          cloudServiceType: "service",
          resourceType: "resource",
          resourceSpecCode: "sku",
          productNum: 2,
          usageFactor: "Duration",
          usageMeasureId: 4,
          usageValue: 720,
        },
      ],
    };
    const pricing = {
      epoch: 1,
      pending: false,
      selectedProduct: {
        region: scope.region,
        serviceCode: "ecs",
        chargeMode: "ONDEMAND",
        timeTag: 1,
        periodType: 4,
        periodNum: 1,
        subscriptionNum: 1,
        purchaseNum: { measureValue: 2 },
        productAllInfos: [
          {
            selectIndex: 0,
            resourceSpecCode: "sku",
            productNum: 2,
            selfProductNum: 1,
            inquiryTag: "normal",
            productId: "product",
          },
        ],
      },
      result: { amount: 0, timeTag: 1, productRatingResult: [] },
    };
    const product = {
      serviceCode: "HUAWEI:ecs",
      serviceName: "ECS",
      title: "Example",
      productType: "huawei-native",
      quantity: 999,
      pricing: { amount: 0 },
      config: {
        selection,
        region: scope.region,
        billingMode: "Pay-per-use",
        local: { release: id, pricing, inquiries: [inquiry] },
      },
    } as ProductMutationBody;
    const saved = await verifyNativeProduct(product, store);
    expect(saved.quantity).toBe(2);
    expect(saved.pricing).toMatchObject({
      amount: 2880,
      source: "huawei-catalog",
      quotedAt: source.fetchedAt,
    });
    await expect(
      verifyNativeProduct({ ...product, serviceCode: "HUAWEI:nat" }, store),
    ).rejects.toThrow("scope");
    await expect(
      verifyNativeProduct(
        { ...product, config: { ...product.config, local: undefined } },
        store,
      ),
    ).rejects.toThrow("Open this configuration");
    const freshScope = structuredClone(scope);
    freshScope.source.products = "updated-prices";
    freshScope.source.fetchedAt = "2026-10-09T00:00:00Z";
    freshScope.products.product.rows[0].planList![0].amount = 3;
    const freshHash = await store.blob(JSON.stringify(freshScope), ".json");
    const currentId = await store.publish({
      ...release,
      scopes: { "ecs/ap-southeast-1": freshHash },
    });
    const repriced = await verifySnapshotProduct(product, store, true);
    expect(repriced.pricing).toMatchObject({ amount: 4320 });
    expect(
      (repriced.config as { local: { release: string } }).local.release,
    ).toBe(currentId);
    expect((await verifyNativeProduct(product, store)).pricing).toMatchObject({
      amount: 2880,
    });
    freshScope.source.config = "changed-conditional-rules";
    const changedHash = await store.blob(JSON.stringify(freshScope), ".json");
    await store.publish({
      ...release,
      scopes: { "ecs/ap-southeast-1": changedHash },
    });
    await expect(verifySnapshotProduct(product, store, true)).rejects.toThrow(
      "conditional calculator rules changed",
    );
    expect(isNativeProduct(product)).toBeTruthy();
    expect(isNativeProduct({ serviceCode: "ECS" })).toBeFalsy();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
