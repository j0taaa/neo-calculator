import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";
import { and, call, coalesce, eq, ifElse, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const serviceDefinition = {
  version: 1,
  definitionId: "vpcep",
  serviceCode: "VPCEP",
  serviceName: "VPC Endpoint",
  icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Networking/VPCEP.png",
  implementation: "configurable",
  billingOptions: ["Pay-per-use"],
  defaults: {
    serviceCategory: "Basic Edition",
    usageHours: 744,
    trafficGb: 0,
    quantity: 1,
  },
  fields: [
    { id: "serviceCategory", type: "select", label: "Service Category", required: true, optionsSource: "catalog.serviceCategoryOptions" },
    { id: "usageHours", type: "number", label: "Purchase Duration", required: true, unit: "hour", min: 1, max: 87600, minSource: "catalog.constraints.usageHours.min", maxSource: "catalog.constraints.usageHours.max", step: 1 },
    { id: "trafficGb", type: "number", label: "Traffic", required: true, unit: "GB", min: 0, step: 1, inputMode: "decimal" },
    { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, minSource: "catalog.constraints.quantity.min", step: 1 },
  ],
  summary: {
    selectionTemplate: "{serviceCategory} | {usageHours}h | {trafficGb} GB | {quantity}",
    notes: [
      "This calculator models the VPC Endpoint pay-per-use flow from the Huawei vpcep catalog.",
      "The live catalog currently exposes a duration charge and a zero-rated traffic charge for Basic Edition.",
    ],
  },
} satisfies ServiceDefinition;

export const pricingDefinition = {
  version: 1,
  definitionId: "vpcep",
  serviceCode: "VPCEP",
  serviceName: "VPC Endpoint",
  catalogAdapter: "vpcep",
  rateSources: {
    duration: {
      catalogKey: "serviceTiers.durationRatePerHour",
      description: "Normalized VPC Endpoint duration rate per endpoint hour from the Huawei vpcep calculator catalog.",
    },
    traffic: {
      catalogKey: "serviceTiers.trafficRatePerGb",
      description: "Normalized VPC Endpoint traffic rate per GB from the Huawei vpcep calculator catalog.",
    },
  },
  metrics: [
    {
      id: "duration",
      label: "Endpoint duration",
      rateSource: "duration",
      quantity: {
        source: "field",
        field: "usageHours",
      },
      unit: "hour",
    },
    {
      id: "traffic",
      label: "Traffic",
      rateSource: "traffic",
      quantity: {
        source: "field",
        field: "trafficGb",
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
      displayName: "VPC Endpoint",
      urlPath: "vpcep",
      tab: "calc",
    },
    parser: {
      kind: "grouped-sections",
      currency: "USD",
      catalogStatic: {
        constraints: {
          usageHours: { min: 1, max: 87600 },
          quantity: { min: 1 },
        },
      },
      sections: [
        {
          targetPath: "serviceTiers",
          path: "product.vpc_vpcep",
          fields: [
            {
              key: "serviceCategory",
              required: true,
              extractor: {
                kind: "keyword-map",
                directPath: "type",
                directMap: {
                  basic: "Basic Edition",
                },
                textPaths: ["type", "productSpecSysDesc", "resourceSpecCode"],
                mappings: [
                  { keywords: ["basic"], value: "Basic Edition" },
                ],
              },
            },
            { key: "resourceSpecCode", extractor: { kind: "path", path: "resourceSpecCode" } },
            { key: "durationRatePerHour", extractor: { kind: "plan-amount", billingMode: "ONDEMAND", billingEvent: "event.type.vpc.vpcep.duration" } },
            { key: "trafficRatePerGb", extractor: { kind: "plan-amount", billingMode: "ONDEMAND", billingEvent: "event.type.vpc.vpcep.traffic" } },
            { key: "productId", extractor: { kind: "plan-product-id", billingMode: "ONDEMAND" } },
          ],
          dedupeBy: ["serviceCategory"],
          sort: [
            { path: "serviceCategory", direction: "asc", order: ["Basic Edition"] },
          ],
        },
      ],
    },
  },
  runtime: {
    quantityLabel: "Endpoint",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "vpcep-pricing" },
    showSharedUsageHours: false,
    derived: [
      { key: "serviceCategoryOptions", value: ifElse(ref("catalog"), call("listVpcepServiceCategories", ref("catalog")), []) },
      { key: "serviceCategory", value: call("resolveOption", ref("values.serviceCategory"), ref("derived.serviceCategoryOptions"), ref("helpers.vpcepDefaults.serviceCategory")) },
      { key: "usageHours", value: call("clampInteger", ref("values.usageHours"), 1, 87600) },
      { key: "trafficGb", value: call("clampNumber", ref("values.trafficGb"), 0) },
      { key: "quantity", value: call("clampInteger", ref("values.quantity"), 1) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateVpcepConfiguration", ref("catalog"), {
            serviceCategory: ref("derived.serviceCategory"),
            usageHours: ref("derived.usageHours"),
            trafficGb: ref("derived.trafficGb"),
            quantity: ref("derived.quantity"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      serviceCategory: ref("derived.serviceCategory"),
      usageHours: ref("derived.usageHours"),
      trafficGb: ref("derived.trafficGb"),
      quantity: ref("derived.quantity"),
    },
    fieldRuntime: {
      serviceCategory: { options: call("optionList", ref("derived.serviceCategoryOptions")) },
      usageHours: { min: 1, max: 87600, normalize: ref("derived.usageHours") },
      trafficGb: { min: 0, normalize: ref("derived.trafficGb") },
      quantity: { min: 1, normalize: ref("derived.quantity") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(
      ref("derived.estimate"),
      null,
      call("firstMeaningfulText", ref("pricingError"), "VPC Endpoint pricing is unavailable for the current selection."),
    ),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      template("Selected specifications: {category} | {usageHours}h | {trafficGb} GB | {quantity} | {estimate}", {
        category: ref("derived.serviceCategory"),
        usageHours: ref("derived.usageHours"),
        trafficGb: ref("derived.trafficGb"),
        quantity: template("{quantity} endpoint{suffix}", {
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
        ref("derived.estimate.notes"),
      ),
      [],
    ),
    referenceNote: template(
      "Pricing sourced from Huawei Cloud VPC Endpoint calculator API for {region}. Sources: {pricingUrl}, {productUrl}, and {calculatorApi}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.vpcepPricingReference.pricingUrl"),
        productUrl: ref("helpers.vpcepPricingReference.productUrl"),
        calculatorApi: ref("helpers.vpcepPricingReference.calculatorApi"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "vpcep",
        title: template("{service} {category}", {
          service: ref("selectedService"),
          category: ref("derived.serviceCategory"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: "Pay-per-use",
          serviceCategory: ref("derived.serviceCategory"),
          usageHours: ref("derived.usageHours"),
          trafficGb: ref("derived.trafficGb"),
          quantity: ref("derived.quantity"),
          resourceSpecCode: ref("derived.estimate.tier.resourceSpecCode"),
          productId: ref("derived.estimate.tier.productId"),
          durationRatePerHour: ref("derived.estimate.tier.durationRatePerHour"),
          trafficRatePerGb: ref("derived.estimate.tier.trafficRatePerGb"),
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
      and(call("isRecord", ref("product.config")), eq(ref("product.productType"), "vpcep")),
      {
        handled: true,
        values: {
          serviceCategory: coalesce(ref("product.config.serviceCategory"), ref("helpers.vpcepDefaults.serviceCategory")),
          usageHours: call("integerString", ref("product.config.usageHours"), ref("helpers.vpcepDefaults.usageHours"), 1, 87600),
          trafficGb: coalesce(ref("product.config.trafficGb"), ref("helpers.vpcepDefaults.trafficGb")),
          quantity: call("integerString", ref("product.config.quantity"), ref("helpers.vpcepDefaults.quantity"), 1),
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
