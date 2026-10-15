import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { ProductMutationBody } from "../calculator-types";
import { CalculatorEngine } from "../calculator-rules/engine";
import { cartControlsMatch } from "../calculator-rules/cart-controls";
import { isNativeBillingMode } from "../huawei-native/native-billing";
import { SnapshotStore } from "../huawei-snapshot/store";
import {
  productFromIndependentState,
  verifySnapshotProduct,
} from "../huawei-snapshot/product";
import {
  parseNativeSelection,
  selectionBillingMode,
} from "../huawei-native/native-selection";
import { cartPriceFields } from "./cart-prices";
import { isRecord } from "../product-input";
import { isSavedHuaweiProduct } from "./preserved";
import {
  signSavedHuaweiProduct,
  verifySavedHuaweiProduct,
} from "./preserved-server";
import { connectionKey } from "./secrets";

import { canonical } from "./value";
export { canonical } from "./value";
export const cartDigest = (value: unknown) =>
  createHash("sha256").update(canonical(value)).digest("hex");
function withoutMetadata(item: Record<string, unknown>) {
  const result = structuredClone(item);
  if (isRecord(result.selectedProduct))
    delete result.selectedProduct.neoCalculator;
  return result;
}
export async function exportCart(
  name: string,
  products: ProductMutationBody[],
  store = new SnapshotStore(),
) {
  if (!name.trim() || name.length > 50)
    throw new Error(
      "Huawei cart names must contain 1–50 characters. Choose a shorter name for the Huawei copy.",
    );
  const release = await store.active(),
    items: Record<string, unknown>[] = [];
  let amount = 0;
  for (const [index, product] of products.entries()) {
    if (isSavedHuaweiProduct(product)) {
      verifySavedHuaweiProduct(product);
      items.push(
        structuredClone(
          (product.config as { huaweiCartItem: Record<string, unknown> })
            .huaweiCartItem,
        ),
      );
      amount += Number((product.pricing as { amount: number }).amount);
      continue;
    }
    const verified = await verifySnapshotProduct(product, store, true, release);
    const selection = parseNativeSelection(
      (verified.config as { selection: unknown }).selection,
    );
    const scope = await store.scope(
      release,
      selection.service,
      selection.region,
      false,
    );
    if (!scope.rules)
      throw new Error("This resource has no published calculator rules.");
    const engine = new CalculatorEngine(
      scope.rules,
      scope,
      JSON.parse(release.menu),
      release.id,
      selectionBillingMode(selection),
    );
    const state = engine.restore(selection);
    if (!state.quote || !state.local?.pricing.result)
      throw new Error("This resource cannot be exported with a valid price.");
    const selected = structuredClone(
      state.local.pricing.selectedProduct,
    ) as Record<string, unknown>;
    const timeTag = 1000 + index;
    Object.assign(selected, cartPriceFields(state, scope, timeTag));
    Object.assign(selected, {
      timeTag,
      amount: state.quote.amount,
      originalAmount: state.quote.amount,
      discountAmount: 0,
      currency: state.quote.currency,
      description: product.title,
      _customTitle: product.title,
      serviceName: product.serviceName,
      serviceCodeName: product.serviceName,
      chargeModeName:
        state.billingMode === "PERIOD"
          ? selected.periodType === 3
            ? "YEARLY"
            : "MONTHLY"
          : state.billingMode,
    });
    const values = engine.cartValues();
    selected.purchaseTime = isRecord(values.global_ONDEMANDTIME)
      ? values.global_ONDEMANDTIME.UNSET_Stepper_0
      : isRecord(values.global_PERIODTIME)
        ? values.global_PERIODTIME.UNSET_PeriodTime
        : undefined;
    if (state.billingMode === "RI")
      selected.purchaseTime = {
        measureValue: selected.periodNum,
        measureId: selected.periodType === 3 ? 19 : 20,
      };
    if (state.billingMode === "ONETIME") {
      selected.periodNum = null;
      selected.periodType = null;
    }
    const item: Record<string, unknown> = {
      rewriteValue: {
        ...values,
        global_DESCRIPTION: product.title,
        global_TITLE: { tag: scope.tag ?? "general.online.portal" },
      },
      selectedProduct: selected,
    };
    const metadata = { version: 1, selection, checksum: cartDigest(item) };
    selected.neoCalculator = { ...metadata, signature: signTransfer(metadata) };
    items.push(item);
    amount += state.quote.amount;
  }
  return {
    name,
    billingMode: "cart.shareList.billingModeTotal",
    cartListData: items,
    totalPrice: {
      amount: Number(amount.toFixed(6)),
      originalAmount: Number(amount.toFixed(6)),
      discountAmount: 0,
    },
  };
}

/** Unknown vendor configurations remain exact, signed, explicitly read-only saved estimates. */
export async function importCart(
  detail: Record<string, unknown>,
  store = new SnapshotStore(),
) {
  if (!Array.isArray(detail.cartListData) || detail.cartListData.length > 1000)
    throw new Error("Huawei returned an invalid or oversized cart.");
  const products: ProductMutationBody[] = [];
  let preserved = 0;
  for (const raw of detail.cartListData) {
    if (!isRecord(raw) || !isRecord(raw.selectedProduct))
      throw new Error("A Huawei resource is unreadable. Nothing was imported.");
    const selected = raw.selectedProduct,
      metadata = selected.neoCalculator;
    const title = String(
      selected._customTitle ||
        selected.description ||
        selected.serviceName ||
        selected.serviceCode ||
        "Huawei resource",
    ).slice(0, 300);
    const metadataProof = isRecord(metadata)
      ? {
          version: metadata.version,
          selection: metadata.selection,
          checksum: metadata.checksum,
        }
      : null;
    if (
      isRecord(metadata) &&
      metadata.version === 1 &&
      checkTransfer(metadataProof, metadata.signature) &&
      metadata.checksum === cartDigest(withoutMetadata(raw))
    ) {
      try {
        const selection = parseNativeSelection(metadata.selection),
          release = await store.active(),
          scope = await store.scope(
            release,
            selection.service,
            selection.region,
            false,
          );
        if (!scope.rules) throw new Error("Missing rules");
        const state = new CalculatorEngine(
          scope.rules,
          scope,
          JSON.parse(release.menu),
          release.id,
          selectionBillingMode(selection),
        ).restore(selection);
        const service = release.directory.services.find(
          (service) => service.id === selection.service,
        );
        products.push(
          productFromIndependentState(
            {
              serviceCode: `HUAWEI:${selection.service}`,
              serviceName: service?.name ?? selection.service,
              productType: "huawei-native",
              title,
              quantity: 1,
              config: {},
              pricing: null,
            },
            state,
            scope,
            release,
          ),
        );
        continue;
      } catch {
        /* Keep the original item if its published scope changed. */
      }
    }
    if (
      typeof selected.serviceCode === "string" &&
      typeof selected.region === "string" &&
      isNativeBillingMode(selected.chargeMode) &&
      isRecord(raw.rewriteValue)
    ) {
      try {
        const release = await store.active(),
          scope = await store.scope(
            release,
            selected.serviceCode,
            selected.region,
            false,
          );
        if (!scope.rules) throw new Error("Missing rules");
        const engine = new CalculatorEngine(
          scope.rules,
          scope,
          JSON.parse(release.menu),
          release.id,
          selected.chargeMode,
        );
        const state = engine.restoreCartValues(raw.rewriteValue);
        const dimensions = (rows: unknown) => {
          if (!Array.isArray(rows))
            throw new Error("Missing product dimensions");
          return rows
            .map((row) =>
              Object.fromEntries(
                [
                  "cloudServiceType",
                  "resourceType",
                  "resourceSpecCode",
                  "productNum",
                  "resourceSize",
                  "resouceSizeMeasureId",
                  "usageFactor",
                  "usageValue",
                  "usageMeasureId",
                  "billingMode",
                  "skuCode",
                  "planId",
                  "RITime",
                  "paymentType",
                  "feeInstallMode",
                  "installPeriodType",
                  "installNum",
                  "_injectedMode",
                  "siteCode",
                  "locationType",
                  "locationCode",
                ]
                  .filter(
                    (key) =>
                      row[key] !== undefined &&
                      row[key] !== null &&
                      row[key] !== "",
                  )
                  .map((key) => [key, row[key]]),
              ),
            )
            .sort((a, b) => canonical(a).localeCompare(canonical(b)));
        };
        if (
          !state.local ||
          [
            "periodNum",
            "periodType",
            "subscriptionNum",
            "locationType",
            "locationCode",
          ].some(
            (key) =>
              !(
                selected.chargeMode === "ONETIME" &&
                ["periodNum", "periodType"].includes(key)
              ) &&
              selected[key] !== undefined &&
              selected[key] !==
                (
                  state.local!.pricing.selectedProduct as unknown as Record<
                    string,
                    unknown
                  >
                )[key],
          ) ||
          !cartControlsMatch(raw.rewriteValue, engine.cartValues()) ||
          cartDigest(dimensions(selected.productAllInfos)) !==
            cartDigest(
              dimensions(state.local.pricing.selectedProduct.productAllInfos),
            )
        )
          throw new Error("Saved options do not match the independent engine");
        const service = release.directory.services.find(
          (service) => service.id === selected.serviceCode,
        );
        products.push(
          productFromIndependentState(
            {
              serviceCode: `HUAWEI:${selected.serviceCode}`,
              serviceName: service?.name ?? selected.serviceCode,
              productType: "huawei-native",
              title,
              quantity: 1,
              config: {},
              pricing: null,
            },
            state,
            scope,
            release,
          ),
        );
        continue;
      } catch {
        /* Unavailable, unknown or ambiguous configurations are preserved intact. */
      }
    }
    const numeric =
      typeof selected.amount === "number" &&
      Number.isFinite(selected.amount) &&
      selected.amount >= 0;
    const amount = numeric ? Number(selected.amount) : 0;
    const quantity =
      isRecord(selected.purchaseNum) &&
      Number.isInteger(selected.purchaseNum.measureValue) &&
      Number(selected.purchaseNum.measureValue) > 0 &&
      Number(selected.purchaseNum.measureValue) <= 9999
        ? Number(selected.purchaseNum.measureValue)
        : 1;
    products.push(
      signSavedHuaweiProduct({
        serviceCode: String(selected.serviceCode || "HWC"),
        serviceName: String(
          selected.serviceName ||
            selected.serviceCodeName ||
            selected.serviceCode ||
            "Huawei resource",
        ),
        productType: "huawei-saved",
        title,
        quantity,
        config: {
          huaweiCartItem: structuredClone(raw),
          region: selected.region,
          importedAt: new Date().toISOString(),
        },
        pricing: {
          amount,
          currency: String(selected.currency || "USD"),
          source: "huawei-saved",
          total: numeric
            ? `${selected.currency || "USD"} ${amount.toFixed(6)} (saved Huawei estimate)`
            : "Saved price unavailable",
          unavailable: !numeric,
        },
      }),
    );
    preserved++;
  }
  return {
    schemaVersion: 1,
    resourceType: "cart" as const,
    cart: {
      name: String(detail.name || "Huawei cart").slice(0, 300),
      products,
    },
    preserved,
  };
}
export function signTransfer(value: unknown) {
  return createHmac("sha256", connectionKey())
    .update("cart-transfer\0" + canonical(value))
    .digest("hex");
}
export function checkTransfer(value: unknown, signature: unknown) {
  return (
    typeof signature === "string" &&
    /^[a-f0-9]{64}$/.test(signature) &&
    timingSafeEqual(
      Buffer.from(signTransfer(value), "hex"),
      Buffer.from(signature, "hex"),
    )
  );
}
