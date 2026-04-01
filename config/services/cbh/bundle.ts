import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";
import { and, call, coalesce, eq, ifElse, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const serviceDefinition = {
  version: 1,
  definitionId: "cbh",
  serviceCode: "CBH",
  serviceName: "Cloud Bastion Host",
  icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/CBH.png",
  implementation: "configurable",
  billingOptions: ["Yearly/Monthly"],
  defaults: {
    instanceType: "Single-node",
    edition: "Standard 50",
    durationMonths: 1,
    quantity: 1,
  },
  fields: [
    { id: "instanceType", type: "select", label: "Instance Type", required: true, optionsSource: "catalog.instanceTypeOptions" },
    { id: "edition", type: "select", label: "Edition", required: true, optionsSource: "catalog.editionOptions" },
    { id: "durationMonths", type: "select", label: "Required Duration", required: true, optionsSource: "catalog.durationMonthOptions" },
    { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, step: 1 },
  ],
  summary: {
    selectionTemplate: "{instanceType} | {edition} | {durationMonths} months | {quantity}",
    notes: [
      "This calculator models the Cloud Bastion Host yearly/monthly flow from the Huawei cbh catalog.",
      "The current live pricing catalog only exposes Single-node SKUs.",
    ],
  },
} satisfies ServiceDefinition;

export const pricingDefinition = {
  version: 1,
  definitionId: "cbh",
  serviceCode: "CBH",
  serviceName: "Cloud Bastion Host",
  catalogAdapter: "cbh",
  rateSources: {
    edition: {
      catalogKey: "editionTiers.plans",
      description: "Normalized Cloud Bastion Host edition plans from the Huawei cbh calculator catalog.",
    },
  },
  metrics: [
    {
      id: "edition",
      label: "CBH editions",
      rateSource: "edition",
      quantity: {
        source: "field",
        field: "quantity",
      },
    },
  ],
} satisfies PricingDefinition;

export const configurableServiceBundle = {
  service: serviceDefinition,
  pricing: pricingDefinition,
  catalogDefinition: {
    source: {
      displayName: "Cloud Bastion Host",
      urlPath: "cbh",
      tab: "calc",
    },
    parser: {
      kind: "grouped-sections",
      currency: "USD",
      sections: [
        {
          targetPath: "editionTiers",
          path: "product.cbh_cbh.ins",
          fields: [
            {
              key: "instanceType",
              required: true,
              extractor: {
                kind: "keyword-map",
                directPath: "mode",
                directMap: {
                  Single: "Single-node",
                },
                textPaths: ["mode", "productSpecSysDesc", "resourceSpecCode"],
                mappings: [
                  { keywords: ["single"], value: "Single-node" },
                  { keywords: ["primary", "standby"], value: "Primary/Standby" },
                ],
              },
            },
            {
              key: "editionType",
              required: true,
              extractor: {
                kind: "keyword-map",
                directPath: "type",
                directMap: {
                  Standard: "Standard",
                  Professional: "Professional",
                },
                textPaths: ["type", "productSpecSysDesc", "resourceSpecCode"],
                mappings: [
                  { keywords: ["standard"], value: "Standard" },
                  { keywords: ["professional"], value: "Professional" },
                ],
              },
            },
            { key: "assetCount", required: true, extractor: { kind: "number-from-pattern", paths: ["Assets", "productSpecSysDesc", "resourceSpecCode"] } },
            { key: "edition", required: true, extractor: { kind: "path-or-template", path: "editionLabel", template: "{editionType} {assetCount}" } },
            { key: "resourceSpecCode", extractor: { kind: "path", path: "resourceSpecCode" } },
            { key: "plans", extractor: { kind: "path", path: "planList" } },
          ],
          dedupeBy: ["instanceType", "edition"],
          sort: [
            { path: "instanceType", direction: "asc", order: ["Single-node", "Primary/Standby"] },
            { path: "assetCount", direction: "asc" },
            { path: "editionType", direction: "asc", order: ["Standard", "Professional"] },
          ],
        },
      ],
    },
  },
  runtime: {
    quantityLabel: "Instance",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "cbh-pricing" },
    showSharedUsageHours: false,
    derived: [
      { key: "instanceTypeOptions", value: ifElse(ref("catalog"), call("listCbhInstanceTypes", ref("catalog")), ["Single-node"]) },
      { key: "instanceType", value: call("resolveOption", ref("values.instanceType"), ref("derived.instanceTypeOptions"), ref("helpers.cbhDefaults.instanceType")) },
      { key: "editionOptions", value: ifElse(ref("catalog"), call("listCbhEditions", ref("catalog"), ref("derived.instanceType")), [ref("helpers.cbhDefaults.edition")]) },
      { key: "edition", value: call("resolveOption", ref("values.edition"), ref("derived.editionOptions"), ref("helpers.cbhDefaults.edition")) },
      { key: "durationMonthOptions", value: ifElse(ref("catalog"), call("listCbhDurationMonths", ref("catalog"), ref("derived.instanceType"), ref("derived.edition")), [1, 2, 3, 4, 5, 6, 7, 8, 9, 12]) },
      { key: "durationMonths", value: call("resolveNumberOption", ref("values.durationMonths"), ref("derived.durationMonthOptions"), ref("helpers.cbhDefaults.durationMonths")) },
      { key: "quantity", value: call("clampInteger", ref("values.quantity"), 1) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateCbhConfiguration", ref("catalog"), {
            instanceType: ref("derived.instanceType"),
            edition: ref("derived.edition"),
            durationMonths: ref("derived.durationMonths"),
            quantity: ref("derived.quantity"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      instanceType: ref("derived.instanceType"),
      edition: ref("derived.edition"),
      durationMonths: ref("derived.durationMonths"),
      quantity: ref("derived.quantity"),
    },
    fieldRuntime: {
      instanceType: { options: call("optionList", ref("derived.instanceTypeOptions")) },
      edition: { options: call("optionList", ref("derived.editionOptions")) },
      durationMonths: { options: call("optionList", ref("derived.durationMonthOptions")) },
      quantity: { min: 1, normalize: ref("derived.quantity") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(
      ref("derived.estimate"),
      null,
      call("firstMeaningfulText", ref("pricingError"), "Cloud Bastion Host pricing is unavailable for the current selection."),
    ),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      template("Selected specifications: {instanceType} | {edition} | {quantity} | {estimate}", {
        instanceType: ref("derived.instanceType"),
        edition: ref("derived.edition"),
        quantity: template("{quantity} instance{suffix}", {
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
      "Pricing sourced from Huawei Cloud Bastion Host calculator API for {region}. Sources: {pricingUrl}, {productUrl}, and {calculatorApi}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.cbhPricingReference.pricingUrl"),
        productUrl: ref("helpers.cbhPricingReference.productUrl"),
        calculatorApi: ref("helpers.cbhPricingReference.calculatorApi"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "cbh",
        title: template("{service} {edition}", {
          service: ref("selectedService"),
          edition: ref("derived.edition"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: "Yearly/Monthly",
          instanceType: ref("derived.instanceType"),
          edition: ref("derived.edition"),
          durationMonths: ref("derived.durationMonths"),
          quantity: ref("derived.quantity"),
          resourceSpecCode: ref("derived.estimate.tier.resourceSpecCode"),
          productId: ref("derived.estimate.selectedPlan.productId"),
          assetCount: ref("derived.estimate.tier.assetCount"),
          editionType: ref("derived.estimate.tier.editionType"),
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
      and(call("isRecord", ref("product.config")), eq(ref("product.productType"), "cbh")),
      {
        handled: true,
        values: {
          instanceType: coalesce(ref("product.config.instanceType"), ref("helpers.cbhDefaults.instanceType")),
          edition: coalesce(ref("product.config.edition"), ref("helpers.cbhDefaults.edition")),
          durationMonths: call("integerString", ref("product.config.durationMonths"), ref("helpers.cbhDefaults.durationMonths"), 1, 36),
          quantity: call("integerString", ref("product.config.quantity"), ref("helpers.cbhDefaults.quantity"), 1),
        },
        nextRegion: coalesce(ref("product.config.region"), ref("regionValue")),
        nextBillingMode: "Yearly/Monthly",
      },
      {
        handled: false,
        error: "This product cannot be edited from the calculator.",
      },
    ),
  },
} as const satisfies ConfigurableServiceBundleDefinition;
