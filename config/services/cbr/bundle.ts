import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";
import { and, call, coalesce, eq, ifElse, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const serviceDefinition = {
  version: 1,
  definitionId: "cbr",
  serviceCode: "CBR",
  serviceName: "Cloud Backup and Recovery",
  icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Storage/CBR.png",
  implementation: "configurable",
  billingOptions: ["Yearly/Monthly", "Pay-per-use"],
  defaults: {
    vaultType: "Server",
    vaultCapacityGb: 100,
    durationMonths: 1,
    quantity: 1,
  },
  fields: [
    { id: "vaultType", type: "select", label: "Vault Type", required: true, optionsSource: "catalog.vaultTypeOptions" },
    { id: "vaultCapacityGb", type: "number", label: "Vault Capacity", required: true, unit: "GB", min: 1, step: 1 },
    { id: "durationMonths", type: "select", label: "Required Duration", required: true, optionsSource: "catalog.durationMonthOptions", visibleWhen: { field: "billingMode", equals: "Yearly/Monthly" } },
    { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, step: 1 },
  ],
  summary: {
    selectionTemplate: "{vaultType} | {vaultCapacityGb} GB | {quantity}",
    notes: [
      "This calculator models the Cloud Backup and Recovery vault-capacity flow from the Huawei cbr catalog.",
      "Vault replication traffic rows are present in the catalog but not exposed in the default vault-capacity workflow.",
    ],
  },
} satisfies ServiceDefinition;

export const pricingDefinition = {
  version: 1,
  definitionId: "cbr",
  serviceCode: "CBR",
  serviceName: "Cloud Backup and Recovery",
  catalogAdapter: "cbr",
  rateSources: {
    vault: {
      catalogKey: "vaultTiers.plans",
      description: "Normalized Cloud Backup and Recovery vault plans from the Huawei cbr calculator catalog.",
    },
  },
  metrics: [
    {
      id: "vault",
      label: "Vault capacity",
      rateSource: "vault",
      quantity: {
        source: "field",
        field: "vaultCapacityGb",
      },
      unit: "GB",
    },
  ],
} satisfies PricingDefinition;

export const configurableServiceBundle = {
  service: serviceDefinition,
  pricing: pricingDefinition,
  catalogDefinition: {
    source: {
      displayName: "Cloud Backup and Recovery",
      urlPath: "cbr",
      tab: "calc",
    },
    parser: {
      kind: "grouped-sections",
      currency: "USD",
      sections: [
        {
          targetPath: "vaultTiers",
          path: "product.cbr_cbr.vault",
          fields: [
            { key: "vaultType", required: true, extractor: { kind: "path", path: "type" } },
            { key: "resourceSpecCode", extractor: { kind: "path", path: "resourceSpecCode" } },
            { key: "plans", extractor: { kind: "path", path: "planList" } },
          ],
          dedupeBy: ["vaultType"],
          sort: [
            { path: "vaultType", direction: "asc" },
          ],
        },
      ],
    },
  },
  runtime: {
    quantityLabel: "Vault",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "cbr-pricing" },
    showSharedUsageHours: true,
    derived: [
      { key: "vaultTypeOptions", value: ifElse(ref("catalog"), call("listCbrVaultTypes", ref("catalog")), []) },
      { key: "vaultType", value: call("resolveOption", ref("values.vaultType"), ref("derived.vaultTypeOptions"), ref("helpers.cbrDefaults.vaultType")) },
      { key: "vaultCapacityGb", value: call("clampInteger", ref("values.vaultCapacityGb"), 1) },
      { key: "durationMonthOptions", value: ifElse(ref("catalog"), call("listCbrDurationMonths", ref("catalog"), ref("derived.vaultType")), []) },
      { key: "durationMonths", value: call("resolveNumberOption", ref("values.durationMonths"), ref("derived.durationMonthOptions"), ref("helpers.cbrDefaults.durationMonths")) },
      { key: "quantity", value: call("clampInteger", ref("values.quantity"), 1) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateCbrConfiguration", ref("catalog"), {
            billingMode: ifElse(eq(ref("billingMode"), "Pay-per-use"), "Pay-per-use", "Yearly/Monthly"),
            vaultType: ref("derived.vaultType"),
            vaultCapacityGb: ref("derived.vaultCapacityGb"),
            durationMonths: ref("derived.durationMonths"),
            usageHours: ref("usageHoursValue"),
            quantity: ref("derived.quantity"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      vaultType: ref("derived.vaultType"),
      vaultCapacityGb: ref("derived.vaultCapacityGb"),
      durationMonths: ref("derived.durationMonths"),
      quantity: ref("derived.quantity"),
    },
    fieldRuntime: {
      vaultType: { options: call("optionList", ref("derived.vaultTypeOptions")) },
      vaultCapacityGb: { min: 1, normalize: ref("derived.vaultCapacityGb") },
      durationMonths: { options: call("optionList", ref("derived.durationMonthOptions")) },
      quantity: { min: 1, normalize: ref("derived.quantity") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(
      ref("derived.estimate"),
      null,
      call("firstMeaningfulText", ref("pricingError"), "Cloud Backup and Recovery pricing is unavailable for the current selection."),
    ),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      template("Selected specifications: {vaultType} | {capacity} GB | {term} | {quantity} | {estimate}", {
        vaultType: ref("derived.vaultType"),
        capacity: ref("derived.vaultCapacityGb"),
        term: ifElse(eq(ref("billingMode"), "Pay-per-use"), template("{hours}h", { hours: ref("usageHoursValue") }), template("{months}mo", { months: ref("derived.durationMonths") })),
        quantity: template("{quantity} vault{suffix}", {
          quantity: ref("derived.quantity"),
          suffix: ifElse(eq(ref("derived.quantity"), 1), "", "s"),
        }),
        estimate: call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.amount"), ref("derived.estimate.suffix")),
      }),
      "Selected specifications:",
    ),
    selectionNotes: ifElse(
      ref("derived.estimate"),
      call(
        "concatArrays",
        call("formatBreakdownNotes", ref("derived.estimate.currency"), ref("derived.estimate.suffix"), ref("derived.estimate.breakdown")),
        [
          template("Monthly average: {avg}.", {
            avg: call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.monthlyAverageAmount"), "/mo"),
          }),
        ],
        call("asArray", ref("derived.estimate.notes")),
      ),
      [],
    ),
    referenceNote: template(
      "Pricing sourced from Huawei Cloud Backup and Recovery calculator API for {region}. Sources: {pricingUrl}, {productUrl}, and {calculatorApi}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.cbrPricingReference.pricingUrl"),
        productUrl: ref("helpers.cbrPricingReference.productUrl"),
        calculatorApi: ref("helpers.cbrPricingReference.calculatorApi"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "cbr",
        title: template("{service} {vaultType}", {
          service: ref("selectedService"),
          vaultType: ref("derived.vaultType"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: ifElse(eq(ref("billingMode"), "Pay-per-use"), "Pay-per-use", "Yearly/Monthly"),
          vaultType: ref("derived.vaultType"),
          vaultCapacityGb: ref("derived.vaultCapacityGb"),
          durationMonths: ifElse(eq(ref("billingMode"), "Yearly/Monthly"), ref("derived.durationMonths"), null),
          usageHours: ifElse(eq(ref("billingMode"), "Pay-per-use"), ref("usageHoursValue"), null),
          quantity: ref("derived.quantity"),
          resourceSpecCode: ref("derived.estimate.tier.resourceSpecCode"),
          productId: ref("derived.estimate.selectedPlan.productId"),
        },
        pricing: {
          total: call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.amount"), ref("derived.estimate.suffix")),
          estimate: call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.amount"), ref("derived.estimate.suffix")),
          monthlyAverage: call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.monthlyAverageAmount"), "/mo"),
          breakdown: call("byLabelAmount", ref("derived.estimate.currency"), ref("derived.estimate.suffix"), ref("derived.estimate.breakdown")),
        },
      },
      null,
    ),
    hydrate: ifElse(
      and(call("isRecord", ref("product.config")), eq(ref("product.productType"), "cbr")),
      {
        handled: true,
        values: {
          vaultType: coalesce(ref("product.config.vaultType"), ref("helpers.cbrDefaults.vaultType")),
          vaultCapacityGb: call("integerString", ref("product.config.vaultCapacityGb"), ref("helpers.cbrDefaults.vaultCapacityGb"), 1),
          durationMonths: call("integerString", ref("product.config.durationMonths"), ref("helpers.cbrDefaults.durationMonths"), 1, 60),
          quantity: call("integerString", ref("product.config.quantity"), ref("helpers.cbrDefaults.quantity"), 1),
        },
        nextRegion: coalesce(ref("product.config.region"), ref("regionValue")),
        nextBillingMode: coalesce(ref("product.config.billingMode"), "Yearly/Monthly"),
      },
      {
        handled: false,
        error: "This product cannot be edited from the calculator.",
      },
    ),
  },
} as const satisfies ConfigurableServiceBundleDefinition;

export const pricing = pricingDefinition;
export const service = serviceDefinition;

