import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import { and, call, coalesce, eq, ifElse, max, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const configurableServiceBundle = {
  service: {
    version: 1,
    definitionId: "cdm",
    serviceCode: "CDM",
    serviceName: "Cloud Data Migration",
    icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Migration/CDM.png",
    implementation: "configurable",
    billingOptions: ["Pay-per-use"],
    defaults: {
      instanceType: "cdm.large",
      quantity: 1,
      usageHours: 744,
    },
    fields: [
      { id: "instanceType", type: "select", label: "Instance Flavor", required: true, optionsSource: "catalog.instanceTypes" },
      { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, step: 1 },
      { id: "usageHours", type: "number", label: "Required Duration", required: true, unit: "hours", min: 1, max: 87600, step: 24 },
    ],
    summary: {
      selectionTemplate: "{instanceType} | {quantity} PCS",
      notes: [
        "CDM pricing is based on instance flavor and usage hours.",
      ],
    },
  },
  pricing: {
    version: 1,
    definitionId: "cdm",
    serviceCode: "CDM",
    serviceName: "Cloud Data Migration",
    catalogAdapter: "cdm",
    rateSources: {
      instance: {
        catalogKey: "tiers.prices",
        description: "CDM instance hourly rates from the productInfo catalog.",
      },
    },
    metrics: [
      {
        id: "cdmInstance",
        label: "CDM instances",
        rateSource: "instance",
        quantity: { source: "field", field: "quantity" },
      },
    ],
  },
  catalogDefinition: {
    source: {
      displayName: "CDM",
      urlPath: "cdm",
      tab: "calc",
    },
    parser: {
      kind: "recursive-grouped-records",
      currency: "USD",
      rootPath: "product",
      collectionKey: "tiers",
      recordFilters: [
        { kind: "text-includes", paths: ["resourceSpecCode"], value: "cdm" },
        { kind: "text-excludes", paths: ["resourceSpecCode"], value: "offline" },
        { kind: "text-excludes", paths: ["resourceSpecCode"], value: "volume" },
      ],
      fields: [
        {
          key: "instanceType",
          required: true,
          extractor: { kind: "path", path: "resourceSpecCode" },
        },
        {
          key: "label",
          required: true,
          extractor: { kind: "path", path: "resourceSpecCode" },
        },
        { key: "prices", extractor: { kind: "rate-set", modes: ["ONDEMAND"] } },
        { key: "productIds.ONDEMAND", extractor: { kind: "plan-product-id", billingMode: "ONDEMAND" } },
      ],
      dedupeBy: ["instanceType"],
      minByPath: "prices.ONDEMAND",
      sort: [
        { path: "instanceType", direction: "asc", order: ["cdm.small", "cdm.medium", "cdm.large", "cdm.2xlarge", "cdm.4xlarge"] },
      ],
    },
  },
  runtime: {
    quantityLabel: "Instance",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "cdm-pricing" },
    showSharedUsageHours: false,
    derived: [
      {
        key: "instanceTypeOptions",
        value: ifElse(ref("catalog"), call("listCdmInstanceTypes", ref("catalog")), []),
      },
      { key: "instanceType", value: call("resolveOption", ref("values.instanceType"), ref("derived.instanceTypeOptions"), ref("helpers.cdmDefaults.instanceType")) },
      { key: "quantity", value: max(1, call("clampInteger", ref("values.quantity"), 1)) },
      { key: "cdmUsageHoursValue", value: max(1, call("clampInteger", ref("values.usageHours"), 1, 87600)) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateCdmConfiguration", ref("catalog"), {
            instanceType: ref("derived.instanceType"),
            quantity: ref("derived.quantity"),
            usageHours: ref("derived.cdmUsageHoursValue"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      instanceType: ref("derived.instanceType"),
      quantity: ref("derived.quantity"),
      usageHours: ref("derived.cdmUsageHoursValue"),
    },
    visibilityContext: {},
    fieldRuntime: {
      instanceType: { options: call("optionList", ref("derived.instanceTypeOptions")) },
      quantity: { min: 1, normalize: ref("derived.quantity") },
      usageHours: { min: 1, max: 87600, normalize: ref("derived.cdmUsageHoursValue") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(ref("derived.estimate"), null, call("firstMeaningfulText", ref("pricingError"), "CDM pricing is unavailable for the current selection.")),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      call(
        "joinSelectionParts",
        [
          "Selected:",
          ref("derived.instanceType"),
          template("{quantity} instance{suffix}", {
            quantity: ref("derived.quantity"),
            suffix: ifElse(eq(ref("derived.quantity"), 1), "", "s"),
          }),
          template("{hours}h", { hours: ref("derived.cdmUsageHoursValue") }),
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
      "Pricing sourced from Huawei Cloud CDM calculator API for {region}. Sources: {pricingUrl} and {productUrl}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.cdmPricingReference.pricingUrl"),
        productUrl: ref("helpers.cdmPricingReference.productUrl"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "cdm",
        title: template("{service} {instanceType}", {
          service: ref("selectedService"),
          instanceType: ref("derived.instanceType"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: "Pay-per-use",
          instanceType: ref("derived.instanceType"),
          quantity: ref("derived.quantity"),
          usageHours: ref("derived.cdmUsageHoursValue"),
          resourceSpecCode: ref("derived.estimate.tier.resourceSpecCode"),
          productId: ref("derived.estimate.productId"),
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
      and(eq(ref("product.productType"), "cdm"), call("isRecord", ref("product.config"))),
      {
        handled: true,
        values: {
          instanceType: coalesce(ref("product.config.instanceType"), ref("helpers.cdmDefaults.instanceType")),
          quantity: coalesce(ref("product.config.quantity"), ref("helpers.cdmDefaults.quantity")),
          usageHours: coalesce(ref("product.config.usageHours"), ref("helpers.cdmDefaults.usageHours")),
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
