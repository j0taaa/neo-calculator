import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import { and, call, coalesce, eq, ifElse, max, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const configurableServiceBundle = {
  service: {
    version: 1,
    definitionId: "cfw",
    serviceCode: "CFW",
    serviceName: "Cloud Firewall",
    icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/CFW.png",
    implementation: "configurable",
    billingOptions: ["Pay-per-use", "Yearly/Monthly"],
    defaults: {
      edition: "Standard",
      quantity: 1,
      usageHours: 744,
    },
    fields: [
      { id: "edition", type: "select", label: "Edition", required: true, optionsSource: "catalog.editions" },
      { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, minSource: "catalog.constraints.quantity.min", step: 1 },
      { id: "usageHours", type: "number", label: "Required Duration", required: true, unit: "hours", min: 1, max: 87600, minSource: "catalog.constraints.usageHours.min", maxSource: "catalog.constraints.usageHours.max", step: 24, visibleWhen: { field: "showUsageHours", equals: true } },
    ],
    summary: {
      selectionTemplate: "{edition} | {quantity} PCS",
      notes: [
        "CFW pricing is based on edition (Standard or Professional) and billing mode.",
      ],
    },
  },
  pricing: {
    version: 1,
    definitionId: "cfw",
    serviceCode: "CFW",
    serviceName: "Cloud Firewall",
    catalogAdapter: "cfw",
    rateSources: {
      instance: {
        catalogKey: "tiers.prices",
        description: "CFW instance rates from the productInfo catalog.",
      },
    },
    metrics: [
      {
        id: "cfwInstance",
        label: "CFW instances",
        rateSource: "instance",
        quantity: { source: "field", field: "quantity" },
      },
    ],
  },
  catalogDefinition: {
    source: {
      displayName: "CFW",
      urlPath: "cfw",
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
        { kind: "text-excludes", paths: ["resourceType"], value: "exp" },
      ],
      fields: [
        {
          key: "edition",
          required: true,
          extractor: {
            kind: "keyword-map",
            textPaths: ["productSpecSysDesc", "resourceSpecCode"],
            mappings: [
              { keywords: ["standard"], value: "Standard" },
              { keywords: ["professional"], value: "Professional" },
            ],
          },
        },
        { key: "prices", extractor: { kind: "rate-set", modes: ["ONDEMAND", "MONTHLY", "YEARLY"] } },
        { key: "productIds.ONDEMAND", extractor: { kind: "plan-product-id", billingMode: "ONDEMAND" } },
        { key: "productIds.MONTHLY", extractor: { kind: "plan-product-id", billingMode: "MONTHLY" } },
        { key: "productIds.YEARLY", extractor: { kind: "plan-product-id", billingMode: "YEARLY" } },
      ],
      dedupeBy: ["edition"],
      minByPath: "prices.ONDEMAND",
      sort: [{ path: "edition", direction: "asc", order: ["Standard", "Professional"] }],
    },
  },
  runtime: {
    quantityLabel: "Instance",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "cfw-pricing" },
    showSharedUsageHours: false,
    derived: [
      {
        key: "editionOptions",
        value: ifElse(ref("catalog"), call("listCfwEditions", ref("catalog")), []),
      },
      { key: "edition", value: call("resolveOption", ref("values.edition"), ref("derived.editionOptions"), ref("helpers.cfwDefaults.edition")) },
      { key: "quantity", value: max(1, call("clampInteger", ref("values.quantity"), 1)) },
      { key: "cfwUsageHoursValue", value: max(1, call("clampInteger", ref("values.usageHours"), 1, 87600)) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateCfwConfiguration", ref("catalog"), {
            edition: ref("derived.edition"),
            quantity: ref("derived.quantity"),
            usageHours: ref("derived.cfwUsageHoursValue"),
            billingMode: ref("billingMode"),
            eipQuantity: 0,
            bandwidthMbit: 0,
            vpcQuantity: 0,
            trafficGb: 0,
          }),
          null,
        ),
      },
    ],
    syncValues: {
      edition: ref("derived.edition"),
      quantity: ref("derived.quantity"),
      usageHours: ref("derived.cfwUsageHoursValue"),
    },
    visibilityContext: {
      showUsageHours: eq(ref("billingMode"), "Pay-per-use"),
    },
    fieldRuntime: {
      edition: { options: call("optionList", ref("derived.editionOptions")) },
      quantity: { min: 1, normalize: ref("derived.quantity") },
      usageHours: { min: 1, max: 87600, normalize: ref("derived.cfwUsageHoursValue") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(ref("derived.estimate"), null, call("firstMeaningfulText", ref("pricingError"), "CFW pricing is unavailable for the current selection.")),
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
          ifElse(eq(ref("billingMode"), "Pay-per-use"), template("{hours}h", { hours: ref("derived.cfwUsageHoursValue") }), null),
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
      "Pricing sourced from Huawei Cloud CFW calculator API for {region}. Sources: {pricingUrl} and {productUrl}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.cfwPricingReference.pricingUrl"),
        productUrl: ref("helpers.cfwPricingReference.productUrl"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "cfw",
        title: template("{service} {edition}", {
          service: ref("selectedService"),
          edition: ref("derived.edition"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: ref("billingMode"),
          edition: ref("derived.edition"),
          quantity: ref("derived.quantity"),
          usageHours: ifElse(eq(ref("billingMode"), "Pay-per-use"), ref("derived.cfwUsageHoursValue"), null),
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
      and(eq(ref("product.productType"), "cfw"), call("isRecord", ref("product.config"))),
      {
        handled: true,
        values: {
          edition: coalesce(ref("product.config.edition"), ref("helpers.cfwDefaults.edition")),
          quantity: coalesce(ref("product.config.quantity"), ref("helpers.cfwDefaults.quantity")),
          usageHours: coalesce(ref("product.config.usageHours"), ref("helpers.cfwDefaults.usageHours")),
        },
        nextRegion: coalesce(ref("product.config.region"), ref("regionValue")),
        nextBillingMode: coalesce(ref("product.config.billingMode"), ref("billingMode")),
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
