import { writeFile } from "node:fs/promises";
import { SnapshotStore } from "../lib/huawei-snapshot/store";
import { CalculatorEngine } from "../lib/calculator-rules/engine";
import { productFromIndependentState } from "../lib/huawei-snapshot/product";
import {
  exportCart,
  importCart,
  canonical,
} from "../lib/huawei-carts/transfer";

const store = new SnapshotStore(),
  release = await store.active();
const report = {
  release: release.id,
  scopes: Object.keys(release.scopes).length,
  attempted: 0,
  quoted: 0,
  unavailable: 0,
  editableRoundTrips: 0,
  officialShapeEditable: 0,
  officialShapePreserved: 0,
  failures: [] as {
    service: string;
    region: string;
    mode: string;
    error: string;
  }[],
};
// This audit must never turn into a live-pricing fallback.
const originalFetch = globalThis.fetch;
globalThis.fetch = (() => {
  throw new Error(
    "External requests are blocked in the offline cart-transfer audit",
  );
}) as typeof fetch;
try {
  for (const key of Object.keys(release.scopes)) {
    const slash = key.indexOf("/"),
      service = key.slice(0, slash),
      region = key.slice(slash + 1),
      scope = await store.scope(release, service, region, false);
    for (const mode of scope.modes) {
      report.attempted++;
      try {
        if (!scope.rules) throw new Error("Missing compiled scope");
        const state = new CalculatorEngine(
          scope.rules,
          scope,
          JSON.parse(release.menu),
          release.id,
          mode,
        ).state;
        if (!state.quote || !state.local || state.diagnostics.length) {
          report.unavailable++;
          continue;
        }
        const product = productFromIndependentState(
          {
            serviceCode: `HUAWEI:${service}`,
            serviceName:
              release.directory.services.find((item) => item.id === service)
                ?.name ?? service,
            productType: "huawei-native",
            title: "Transfer audit",
            quantity: 1,
            config: {},
            pricing: null,
          },
          state,
          scope,
          release,
        );
        const exported = await exportCart("Transfer audit", [product], store);
        if (
          Math.abs(exported.totalPrice.amount - state.quote.amount) > 0.000001
        )
          throw new Error("Export total changed");
        const selected = exported.cartListData[0].selectedProduct as {
          productAllInfos: {
            inquiryResult?: { amount: number; perAmount?: number };
          }[];
          perAmount?: number;
          installAmount?: number;
          installNum?: number;
        };
        const sum = selected.productAllInfos.reduce(
          (sum, row) => sum + (row.inquiryResult?.amount ?? 0),
          0,
        );
        if (Math.abs(sum - state.quote.amount) > 0.000001)
          throw new Error("Exported component prices do not add to the quote");
        if (state.quote.payment) {
          const payment =
            (selected.installAmount ?? 0) +
            (selected.perAmount ?? 0) * (selected.installNum ?? 0);
          if (Math.abs(payment - state.quote.amount) > 0.000001)
            throw new Error("Exported payment schedule changed");
        }
        const imported = await importCart(exported, store);
        if (
          imported.preserved ||
          imported.cart.products.length !== 1 ||
          imported.cart.products[0].quantity !== product.quantity ||
          Math.abs(
            (imported.cart.products[0].pricing as { amount: number }).amount -
              state.quote.amount,
          ) > 0.000001
        )
          throw new Error("Editable round trip changed the cart");
        report.editableRoundTrips++;
        delete (
          exported.cartListData[0].selectedProduct as Record<string, unknown>
        ).neoCalculator;
        const plain = await importCart(exported, store);
        if (plain.cart.products.length !== 1)
          throw new Error("Official-shaped import lost a resource");
        if (plain.preserved) {
          report.officialShapePreserved++;
          const restored = await exportCart(
            "Transfer audit",
            plain.cart.products,
            store,
          );
          if (
            canonical(restored.cartListData) !==
            canonical(exported.cartListData)
          )
            throw new Error("Preserved transfer lost original fields");
        } else {
          report.officialShapeEditable++;
          if (
            Math.abs(
              (plain.cart.products[0].pricing as { amount: number }).amount -
                state.quote.amount,
            ) > 0.000001
          )
            throw new Error("Restored official-shaped price changed");
        }
        report.quoted++;
      } catch (error) {
        report.failures.push({
          service,
          region,
          mode,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      if (report.attempted % 100 === 0)
        console.log(
          JSON.stringify({
            attempted: report.attempted,
            quoted: report.quoted,
            failures: report.failures.length,
          }),
        );
    }
  }
} finally {
  globalThis.fetch = originalFetch;
}
await writeFile(
  process.env.NEO_TRANSFER_AUDIT_OUTPUT ||
    "/tmp/neo-huawei-cart-transfer-audit.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report));
if (report.failures.length) process.exitCode = 1;
