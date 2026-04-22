import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import { and, call, coalesce, eq, ifElse, max, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const configurableServiceBundle = {
  service: {
    version: 1,
    definitionId: "waf",
    serviceCode: "WAF",
    serviceName: "Web Application Firewall",
    icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/WAF.png",
    implementation: "configurable",
    billingOptions: ["Yearly/Monthly"],
    defaults: {
      edition: "Standard",
      quantity: 1,
    },
    fields: [
      { id: "edition", type: "select", label: "Edition", required: true, optionsSource: "catalog.editions" },
      { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, minSource: "catalog.constraints.quantity.min", step: 1 },
    ],
    summary: {
      selectionTemplate: "{edition} | {quantity} PCS",
      notes: [
        "WAF pricing is subscription-based with Standard, Professional, and Enterprise editions.",
      ],
    },
  },
  pricing: {
    version: 1,
    definitionId: "waf",
    serviceCode: "WAF",
    serviceName: "Web Application Firewall",
    catalogAdapter: "waf",
    rateSources: {
      instance: {
        catalogKey: "tiers.prices",
        description: "WAF instance rates from the productInfo catalog.",
      },
    },
    metrics: [
      {
        id: "wafInstance",
        label: "WAF instances",
        rateSource: "instance",
        quantity: { source: "field", field: "quantity" },
      },
    ],
  },
  catalogDefinition: {
    source: {
      displayName: "WAF",
      urlPath: "waf",
      tab: "calc",
    },
    parser: {
      kind: "recursive-grouped-records",
      currency: "USD",
      rootPath: "product",
      collectionKey: "tiers",
      catalogStatic: {
        constraints: {
          quantity: { min: 1 },
          usageHours: { min: 1, max: 87600 },
        },
      },
      recordFilters: [
        { kind: "field-equals", path: "resourceType", value: "hws.resource.type.waf" },
      ],
      fields: [
        {
          key: "edition",
          required: true,
          extractor: {
            kind: "keyword-map",
            textPaths: ["productSpecSysDesc", "resourceSpecCode"],
            mappings: [
              { keywords: ["ultimate"], value: "Enterprise" },
              { keywords: ["enterprise"], value: "Professional" },
              { keywords: ["professional"], value: "Professional" },
              { keywords: ["standard"], value: "Standard" },
            ],
          },
        },
        { key: "prices", extractor: { kind: "rate-set", modes: ["MONTHLY", "YEARLY"] } },
        { key: "productIds.MONTHLY", extractor: { kind: "plan-product-id", billingMode: "MONTHLY" } },
        { key: "productIds.YEARLY", extractor: { kind: "plan-product-id", billingMode: "YEARLY" } },
      ],
      dedupeBy: ["edition"],
      minByPath: "prices.MONTHLY",
      sort: [{ path: "edition", direction: "asc", order: ["Standard", "Professional", "Enterprise"] }],
    },
  },
  runtime: {
    quantityLabel: "Instance",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "waf-pricing" },
    showSharedUsageHours: false,
    derived: [
      {
        key: "editionOptions",
        value: ifElse(ref("catalog"), call("listWafEditions", ref("catalog")), []),
      },
      { key: "edition", value: call("resolveOption", ref("values.edition"), ref("derived.editionOptions"), ref("helpers.wafDefaults.edition")) },
      { key: "quantity", value: max(1, call("clampInteger", ref("values.quantity"), 1)) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateWafConfiguration", ref("catalog"), {
            edition: ref("derived.edition"),
            quantity: ref("derived.quantity"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      edition: ref("derived.edition"),
      quantity: ref("derived.quantity"),
    },
    visibilityContext: {},
    fieldRuntime: {
      edition: { options: call("optionList", ref("derived.editionOptions")) },
      quantity: { min: 1, normalize: ref("derived.quantity") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(ref("derived.estimate"), null, call("firstMeaningfulText", ref("pricingError"), "WAF pricing is unavailable for the current selection.")),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      call(
        "joinSelectionParts",
        [
          "Selected:",
          ref("derived.edition"),
          template("{quantity} instance{suffix}", {
            quantity: ref("derived.quantity"),
            suffix: ifElse(eq(ref("derived.quantity"), 1), "", "s"),
          }),
          call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.amount"), ref("derived.estimate.suffix")),
        ],
      ),
      "Selected:",
    ),
    selectionNotes: ifElse(
      ref("derived.estimate"),
      call(
        "concatArrays",
        call("formatBreakdownNotes", ref("derived.estimate.currency"), ref("derived.estimate.suffix"), ref("derived.estimate.breakdown")),
        [template("Monthly average: {avg}.", { avg: call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.monthlyAverageAmount"), "/mo") })],
        call("asArray", ref("derived.estimate.notes")),
      ),
      [],
    ),
    referenceNote: template(
      "Pricing sourced from Huawei Cloud WAF calculator API for {region}. Sources: {pricingUrl} and {productUrl}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.wafPricingReference.pricingUrl"),
        productUrl: ref("helpers.wafPricingReference.productUrl"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "waf",
        title: template("{service} {edition}", {
          service: ref("selectedService"),
          edition: ref("derived.edition"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: "Yearly/Monthly",
          edition: ref("derived.edition"),
          quantity: ref("derived.quantity"),
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
      and(eq(ref("product.productType"), "waf"), call("isRecord", ref("product.config"))),
      {
        handled: true,
        values: {
          edition: coalesce(ref("product.config.edition"), ref("helpers.wafDefaults.edition")),
          quantity: coalesce(ref("product.config.quantity"), ref("helpers.wafDefaults.quantity")),
        },
        nextRegion: coalesce(ref("product.config.region"), ref("regionValue")),
      },
      {
        handled: false,
        error: "This product cannot be edited from the calculator.",
      },
    ),
  },
} as const satisfies ConfigurableServiceBundleDefinition;

export const serviceDefinition = configurableServiceBundle.service;
export const pricingDefinition = configurableServiceBundle.pricing;
