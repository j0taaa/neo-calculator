import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fixture } from "../calculator-rules/test-fixture";
import { SnapshotStore } from "../huawei-snapshot/store";
import { ResourceCompiler } from "../cart-json/compile";
import {
  exportCart,
  importCart,
  cartDigest,
  checkTransfer,
  signTransfer,
} from "./transfer";
import { verifySavedHuaweiProduct } from "./preserved-server";
import { seal, unseal } from "./secrets";

async function setup(
  run: (compiler: ResourceCompiler, store: SnapshotStore) => Promise<void>,
) {
  const root = await mkdtemp(join(tmpdir(), "neo-huawei-transfer-test-"));
  try {
    const { release, scope } = fixture(),
      store = new SnapshotStore(root);
    release.directory = {
      services: [
        { id: "ecs", name: "ECS", category: "Compute", available: true },
      ],
      regions: [{ id: "region", name: "Region" }],
      billingModes: { ecs: { region: ["ONDEMAND", "PERIOD"] } },
    };
    release.scopes = { "ecs/region": await store.writeScope(scope) };
    await store.publish(release);
    await run(new ResourceCompiler(await store.active(), store), store);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test("native cart transfer round trips choices, duration, quantity and exact locally calculated prices in both billing modes", async () =>
  setup(async (compiler, store) => {
    for (const billingMode of ["ONDEMAND", "PERIOD"] as const) {
      const product = await compiler.intentProduct(
        {
          serviceCode: "HUAWEI:ecs",
          region: "region",
          billingMode,
          title: "Quotation",
          choices: [
            { field: "flavor:0", option: "Large" },
            { field: "global_QUANTITY:0", value: 3 },
            ...(billingMode === "ONDEMAND"
              ? [{ field: "global_ONDEMANDTIME:0", value: 19 }]
              : []),
          ],
        },
        "/",
      );
      const payload = await exportCart("Quotation", [product], store);
      expect(payload.cartListData).toHaveLength(1);
      expect(payload.totalPrice.amount).toBe(
        (product.pricing as { amount: number }).amount,
      );
      const restored = await importCart(payload, store);
      expect(restored.preserved).toBe(0);
      expect(
        (restored.cart.products[0].config as { selection: { fields: unknown } })
          .selection.fields,
      ).toEqual(
        (product.config as { selection: { fields: unknown } }).selection.fields,
      );
      expect(restored.cart.products[0].pricing).toEqual(product.pricing);
      expect(restored.cart.products[0].quantity).toBe(3);
    }
  }));
test("unrecognized vendor resources survive import, JSON validation and export without losing any options", async () =>
  setup(async (compiler, store) => {
    const raw = {
      buyUrl: "https://console-intl.huaweicloud.com/",
      rewriteValue: { custom: { nested: [1, "two", { futureOption: true }] } },
      selectedProduct: {
        serviceCode: "future-service",
        region: "future-region",
        amount: 12.34567,
        purchaseNum: { measureValue: 2 },
        arbitraryVendorData: { untouched: true },
      },
    };
    const imported = await importCart(
      { name: "Future cart", cartListData: [raw] },
      store,
    );
    expect(imported.preserved).toBe(1);
    const compiled = await compiler.document(imported);
    expect(compiled.productCount).toBe(1);
    expect(
      verifySavedHuaweiProduct(
        JSON.parse(
          (await import("./value")).canonical(imported.cart.products[0]),
        ),
      ),
    ).toEqual(imported.cart.products[0]);
    const exported = await exportCart(
      "Future cart",
      imported.cart.products,
      store,
    );
    expect(exported.cartListData).toEqual([raw]);
    expect(exported.totalPrice.amount).toBe(12.34567);
    for (const field of ["title", "quantity", "config", "pricing"] as const) {
      const changed = structuredClone(imported.cart.products[0]);
      if (field === "title") changed.title = "Changed";
      if (field === "quantity") changed.quantity++;
      if (field === "config")
        (changed.config as { huaweiCartItem: unknown }).huaweiCartItem = {};
      if (field === "pricing")
        changed.pricing = {
          amount: 0,
          currency: "USD",
          source: "huawei-saved",
        };
      expect(() => verifySavedHuaweiProduct(changed)).toThrow();
      await expect(exportCart("Changed", [changed], store)).rejects.toThrow();
    }
  }));
test("Huawei-side edits invalidate Neo replay metadata and preserve the changed original instead of guessing", async () =>
  setup(async (compiler, store) => {
    const product = await compiler.intentProduct(
      {
        serviceCode: "HUAWEI:ecs",
        region: "region",
        billingMode: "ONDEMAND",
        choices: [],
      },
      "/",
    );
    const exported = await exportCart("Test", [product], store);
    (
      exported.cartListData[0].selectedProduct as Record<string, unknown>
    ).amount = 987;
    (
      exported.cartListData[0].selectedProduct as {
        productAllInfos: { resourceSpecCode: string }[];
      }
    ).productAllInfos[0].resourceSpecCode = "changed-outside-Neo";
    const imported = await importCart(exported, store);
    expect(imported.preserved).toBe(1);
    expect(
      (imported.cart.products[0].pricing as { amount: number }).amount,
    ).toBe(987);
  }));
test("official cart control values can be independently restored without Neo metadata", async () =>
  setup(async (compiler, store) => {
    const original = await compiler.intentProduct(
      {
        serviceCode: "HUAWEI:ecs",
        region: "region",
        billingMode: "ONDEMAND",
        choices: [
          { field: "global_QUANTITY:0", value: 4 },
          { field: "global_ONDEMANDTIME:0", value: 123 },
        ],
      },
      "/",
    );
    const payload = await exportCart("Official-shaped", [original], store);
    delete (payload.cartListData[0].selectedProduct as Record<string, unknown>)
      .neoCalculator;
    const restored = await importCart(payload, store);
    expect(restored.preserved).toBe(0);
    expect(restored.cart.products[0].quantity).toBe(4);
    expect(restored.cart.products[0].pricing).toEqual(original.pricing);
  }));
test("unreadable cart items fail the entire import rather than disappearing", async () => {
  await expect(
    importCart({
      name: "Broken",
      cartListData: [{ selectedProduct: {} }, null],
    }),
  ).rejects.toThrow("Nothing was imported");
});
test("confirmation binds destination, source, account, expiry and nonce", () => {
  const proof = {
    session: "session",
    payload: "hash",
    key: null,
    revision: null,
    nonce: "nonce",
    expiresAt: Date.now(),
  };
  const signature = signTransfer(proof);
  expect(checkTransfer(proof, signature)).toBe(true);
  for (const field of Object.keys(proof))
    expect(checkTransfer({ ...proof, [field]: "tampered" }, signature)).toBe(
      false,
    );
  expect(checkTransfer(proof, "not a signature")).toBe(false);
  expect(cartDigest({ x: 1, y: 2 })).toBe(cartDigest({ y: 2, x: 1 }));
});
test("server sessions use authenticated encryption with random IVs", () => {
  const secret = "HWS_INTL_ID=private-session";
  const a = seal(secret),
    b = seal(secret);
  expect(a).not.toBe(b);
  expect(a).not.toContain(secret);
  expect(unseal(a)).toBe(secret);
  const bytes = Buffer.from(a, "base64url");
  bytes[15] ^= 1;
  expect(() => unseal(bytes.toString("base64url"))).toThrow();
});
