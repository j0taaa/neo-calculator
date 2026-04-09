import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";
import { and, call, coalesce, eq, ifElse, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const serviceDefinition = {
  version: 1,
  definitionId: "ga",
  serviceCode: "GA",
  serviceName: "Global Accelerator",
  icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Networking/GA.png",
  implementation: "configurable",
  billingOptions: ["Pay-per-use"],
  defaults: {
    accessPoint: "Brazil",
    trafficGb: 0,
    usageHours: 744,
    quantity: 1,
  },
  fields: [
    { id: "accessPoint", type: "select", label: "Access Point", required: true, optionsSource: "catalog.accessPointOptions" },
    { id: "trafficGb", type: "number", label: "Traffic", required: true, unit: "GB", min: 0, step: 1, inputMode: "decimal" },
    { id: "usageHours", type: "number", label: "Required Duration", required: true, unit: "hour", min: 1, max: 87600, step: 1 },
    { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, step: 1 },
  ],
  summary: {
    selectionTemplate: "{accessPoint} | {trafficGb} GB | {usageHours}h | {quantity}",
    notes: [
      "This calculator models the visible Global Accelerator pay-per-use flow from the Huawei ga calculator.",
      "The NeoCalculator region is used as the destination endpoint, and the Access Point field selects the source endpoint.",
    ],
  },
} satisfies ServiceDefinition;

export const pricingDefinition = {
  version: 1,
  definitionId: "ga",
  serviceCode: "GA",
  serviceName: "Global Accelerator",
  catalogAdapter: "ga",
  rateSources: {
    accelerator: {
      catalogKey: "acceleratorTiers[0].hourlyRate",
      description: "Global Accelerator instance hourly rate from the Huawei ga calculator catalog.",
    },
    traffic: {
      catalogKey: "trafficTiers[].ratePerGb",
      description: "Global Accelerator traffic rate per GB from the Huawei ga calculator catalog.",
    },
  },
  metrics: [
    {
      id: "accelerator",
      label: "Accelerator duration",
      rateSource: "accelerator",
      quantity: {
        source: "expression",
        expression: "usageHours x quantity",
      },
      unit: "accelerator-hour",
    },
    {
      id: "traffic",
      label: "Traffic",
      rateSource: "traffic",
      quantity: {
        source: "expression",
        expression: "trafficGb x quantity",
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
      displayName: "Global Accelerator",
      urlPath: "ga",
      tab: "calc",
    },
    parser: {
      kind: "grouped-sections",
      currency: "USD",
      sections: [
        {
          targetPath: "acceleratorTiers",
          path: "product.ga_accelerator",
          fields: [
            { key: "resourceSpecCode", extractor: { kind: "path", path: "resourceSpecCode" } },
            { key: "hourlyRate", extractor: { kind: "plan-amount", billingMode: "ONDEMAND", billingEvent: "event.type.ga.accelerator.duration" } },
            { key: "productId", extractor: { kind: "plan-product-id", billingMode: "ONDEMAND" } },
          ],
          dedupeBy: ["resourceSpecCode"],
        },
        {
          targetPath: "trafficTiers",
          path: "product.ga_traffic",
          fields: [
            { key: "resourceSpecCode", extractor: { kind: "path", path: "resourceSpecCode" } },
            { key: "accessPoint", extractor: { kind: "path", path: "Source endpoint" }, required: true },
            { key: "destinationEndpoint", extractor: { kind: "path", path: "Destination endpoint" }, required: true },
            { key: "ratePerGb", extractor: { kind: "plan-amount", billingMode: "ONDEMAND", billingEvent: "event.type.ga.traffic.traffic" } },
            { key: "productId", extractor: { kind: "plan-product-id", billingMode: "ONDEMAND" } },
          ],
          dedupeBy: ["accessPoint", "destinationEndpoint"],
          sort: [
            { path: "destinationEndpoint", direction: "asc" },
            { path: "accessPoint", direction: "asc" },
          ],
        },
      ],
    },
  },
  runtime: {
    quantityLabel: "Accelerator",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "ga-pricing" },
    showSharedUsageHours: false,
    derived: [
      { key: "accessPointOptions", value: ifElse(ref("catalog"), call("listGaAccessPoints", ref("catalog"), ref("regionValue")), []) },
      { key: "accessPoint", value: call("resolveOption", ref("values.accessPoint"), ref("derived.accessPointOptions"), ref("helpers.gaDefaults.accessPoint")) },
      { key: "trafficGb", value: call("clampNumber", ref("values.trafficGb"), 0) },
      { key: "usageHours", value: call("clampInteger", ref("values.usageHours"), 1, 87600) },
      { key: "quantity", value: call("clampInteger", ref("values.quantity"), 1) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateGaConfiguration", ref("catalog"), {
            regionValue: ref("regionValue"),
            accessPoint: ref("derived.accessPoint"),
            trafficGb: ref("derived.trafficGb"),
            usageHours: ref("derived.usageHours"),
            quantity: ref("derived.quantity"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      accessPoint: ref("derived.accessPoint"),
      trafficGb: ref("derived.trafficGb"),
      usageHours: ref("derived.usageHours"),
      quantity: ref("derived.quantity"),
    },
    fieldRuntime: {
      accessPoint: { options: call("optionList", ref("derived.accessPointOptions")) },
      trafficGb: { min: 0, normalize: ref("derived.trafficGb") },
      usageHours: { min: 1, max: 87600, normalize: ref("derived.usageHours") },
      quantity: { min: 1, normalize: ref("derived.quantity") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(
      ref("derived.estimate"),
      null,
      call("firstMeaningfulText", ref("pricingError"), "Global Accelerator pricing is unavailable for the selected destination region or access point."),
    ),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      template("Selected specifications: {destination} | {accessPoint} | {trafficGb} GB | {usageHours}h | {quantity} | {estimate}", {
        destination: coalesce(call("getGaDestinationEndpointForRegion", ref("regionValue")), ref("regionValue")),
        accessPoint: ref("derived.accessPoint"),
        trafficGb: ref("derived.trafficGb"),
        usageHours: ref("derived.usageHours"),
        quantity: template("{quantity} accelerator{suffix}", {
          quantity: ref("derived.quantity"),
          suffix: ifElse(eq(ref("derived.quantity"), 1), "", "s"),
        }),
        estimate: call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.amount"), ref("derived.estimate.suffix")),
      }),
      "Selected specifications:",
    ),
    selectionNotes: ifElse(
      ref("derived.estimate"),
      call("concatArrays", call("formatBreakdownNotes", ref("derived.estimate.currency"), ref("derived.estimate.suffix"), ref("derived.estimate.breakdown")), ref("derived.estimate.notes")),
      [],
    ),
    referenceNote: template(
      "Pricing sourced from Huawei Cloud Global Accelerator calculator API. Destination endpoint: {destination}. Sources: {pricingUrl}, {productUrl}, and {calculatorApi}",
      {
        destination: coalesce(call("getGaDestinationEndpointForRegion", ref("regionValue")), ref("regionValue")),
        pricingUrl: ref("helpers.gaPricingReference.pricingUrl"),
        productUrl: ref("helpers.gaPricingReference.productUrl"),
        calculatorApi: ref("helpers.gaPricingReference.calculatorApi"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "ga",
        title: template("{service} {destination}", {
          service: ref("selectedService"),
          destination: ref("derived.estimate.destinationEndpoint"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: "global-cbc-1",
          billingMode: "Pay-per-use",
          destinationEndpoint: ref("derived.estimate.destinationEndpoint"),
          accessPoint: ref("derived.estimate.accessPoint"),
          trafficGb: ref("derived.trafficGb"),
          usageHours: ref("derived.usageHours"),
          quantity: ref("derived.quantity"),
          acceleratorProductId: ref("derived.estimate.acceleratorTier.productId"),
          trafficProductId: ref("derived.estimate.trafficTier.productId"),
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
      and(call("isRecord", ref("product.config")), eq(ref("product.productType"), "ga")),
      {
        handled: true,
        values: {
          accessPoint: coalesce(ref("product.config.accessPoint"), ref("helpers.gaDefaults.accessPoint")),
          trafficGb: coalesce(ref("product.config.trafficGb"), ref("helpers.gaDefaults.trafficGb")),
          usageHours: call("integerString", ref("product.config.usageHours"), ref("helpers.gaDefaults.usageHours"), 1, 87600),
          quantity: call("integerString", ref("product.config.quantity"), ref("helpers.gaDefaults.quantity"), 1),
        },
        nextRegion: coalesce(ref("product.config.region"), ref("regionValue")),
        nextBillingMode: "Pay-per-use",
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
