import { readFile } from "node:fs/promises";
import type { ProductMutationBody } from "../calculator-types";
import type { NativeState } from "../huawei-native/native-types";
import {
  parseNativeSelection,
  selectionBillingMode,
} from "../huawei-native/native-selection";
import { nativeBillingModes } from "../huawei-native/native-billing";
import { SnapshotStore, digest } from "./store";
import { catalogRows } from "./rating";
import { calculateQuote } from "./verify";
import { quotationQuantity } from "./quantity";
import type { SnapshotRelease } from "./types";

export async function verifySnapshotProduct(
  product: ProductMutationBody,
  store = new SnapshotStore(),
  currentRates = false,
  currentRelease?: SnapshotRelease,
): Promise<ProductMutationBody> {
  const config = product.config as {
    selection?: unknown;
    local?: NativeState["local"];
    region?: string;
    billingMode?: string;
  };
  const selection = parseNativeSelection(config?.selection),
    mode = selectionBillingMode(selection),
    local = config?.local;
  if (!local || !Array.isArray(local.inquiries) || local.inquiries.length > 100 ||
    !Array.isArray(local.pricing?.selectedProduct?.productAllInfos) ||
    local.pricing.selectedProduct.productAllInfos.length > 100)
    throw new Error(
      "Open this configuration once to calculate it using the synchronized catalog",
    );
  if (
    product.serviceCode !== `HUAWEI:${selection.service}` ||
    config.region !== selection.region ||
    config.billingMode !== nativeBillingModes[mode].label ||
    local.pricing?.selectedProduct?.chargeMode !== mode
  )
    throw new Error("Quotation scope does not match its configuration");
  const pinned = await store.release(local.release);
  const release = currentRates ? currentRelease ?? await store.active() : pinned;
  const scope = await store.scope(
    release,
    selection.service,
    selection.region,
    false,
  );
  let proof = local;
  if (currentRates && release.id !== pinned.id) {
    const prior = await store.scope(
      pinned,
      selection.service,
      selection.region,
      false,
    );
    if (
      prior.source.config !== scope.source.config ||
      prior.source.framework !== scope.source.framework ||
      pinned.bridgeHash !== release.bridgeHash
    )
      throw new Error(
        "The conditional calculator rules changed. Reopen this configuration before repricing.",
      );
    proof = structuredClone(local);
    proof.release = release.id;
    if (mode === "RI")
      for (const product of proof.pricing.selectedProduct.productAllInfos)
        if (!product._injectedMode && product.inquiryTag !== false) {
          const selected = proof.pricing.selectedProduct;
          const plans = catalogRows(scope)
            .filter(
              (row) =>
                row.resourceSpecCode === product.resourceSpecCode &&
                row.RITime ===
                  `nodeData.${selected.periodNum}_${selected.periodType}`,
            )
            .flatMap((row) => row.planList ?? [])
            .filter((plan) => plan.productId === product.productId);
          product.perPrice = plans.find(
            (plan) => plan.originType === "perPrice",
          )?.amount;
          product.perEffectivePrice = plans.find(
            (plan) => plan.originType === "perEffectivePrice",
          )?.amount;
        }
  }
  if (
    release.bridgeHash &&
    release.bridgeHash !==
      digest(await readFile("public/calculator-snapshot-bridge.js"))
  )
    throw new Error(
      "The calculator rules changed. Reopen this configuration to review its price.",
    );
  if (!scope.modes.includes(mode))
    throw new Error("Billing mode is not available in this snapshot");
  const { quote } = calculateQuote(
    scope,
    release.id,
    proof.pricing,
    proof.inquiries,
  );
  quote.source = "huawei-catalog";
  quote.quotedAt = scope.source.fetchedAt;
  quote.requestHash = digest(
    JSON.stringify({
      release: release.id,
      inquiries: local.inquiries,
      amount: quote.amount,
    }),
  );
  const quantity = quotationQuantity(selection, proof.pricing);
  return {
    ...product,
    productType: "huawei-native",
    quantity,
    config: {
      runtime: "huawei-native",
      region: selection.region,
      billingMode: nativeBillingModes[mode].label,
      selection,
      source: scope.source,
      local: proof,
    },
    pricing: {
      total: `${quote.currency} ${quote.amount.toFixed(6)}`,
      amount: quote.amount,
      currency: quote.currency,
      source: quote.source,
      quotedAt: quote.quotedAt,
      requestHash: quote.requestHash,
      breakdown: quote.breakdown,
      ...(quote.payment ? { payment: quote.payment } : {}),
    },
  };
}
