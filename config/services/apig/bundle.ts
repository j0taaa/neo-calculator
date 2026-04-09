import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";
import { and, call, coalesce, eq, ifElse, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const serviceDefinition = {
  version: 1,
  definitionId: "apig",
  serviceCode: "APIG",
  serviceName: "API Gateway",
  icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Middleware/APIG.png",
  implementation: "configurable",
  billingOptions: ["Pay-per-use"],
  defaults: {
    edition: "Basic",
    publicOutboundAccess: false,
    bandwidthMbit: 1,
    usageHours: 744,
    quantity: 1,
  },
  fields: [
    { id: "edition", type: "select", label: "Edition", required: true, optionsSource: "catalog.editionOptions" },
    { id: "publicOutboundAccess", type: "checkbox", label: "Public Outbound Access" },
    { id: "bandwidthMbit", type: "number", label: "Bandwidth", required: true, unit: "Mbit/s", min: 1, step: 1, visibleWhen: { field: "publicOutboundAccess", equals: true } },
    { id: "usageHours", type: "number", label: "Required Duration", required: true, unit: "hour", min: 1, max: 87600, step: 1 },
    { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, step: 1 },
  ],
  summary: {
    selectionTemplate: "{edition} | {publicOutboundAccess} | {bandwidthMbit} Mbit/s | {usageHours}h | {quantity}",
    notes: [
      "This calculator models the visible API Gateway pay-per-use flow from the Huawei apig calculator.",
    ],
  },
} satisfies ServiceDefinition;

export const pricingDefinition = {
  version: 1,
  definitionId: "apig",
  serviceCode: "APIG",
  serviceName: "API Gateway",
  catalogAdapter: "apig",
  rateSources: {
    instance: {
      catalogKey: "editionTiers[].hourlyRate",
      description: "API Gateway instance hourly rate from the Huawei apig calculator catalog.",
    },
    publicOutboundBandwidth: {
      catalogKey: "publicBandwidthTiers[0].tiers",
      description: "API Gateway public outbound bandwidth tiered hourly rate from the Huawei apig calculator catalog.",
    },
  },
  metrics: [
    {
      id: "instance",
      label: "Gateway duration",
      rateSource: "instance",
      quantity: {
        source: "expression",
        expression: "usageHours x quantity",
      },
      unit: "gateway-hour",
    },
    {
      id: "publicOutboundBandwidth",
      label: "Public outbound bandwidth duration",
      rateSource: "publicOutboundBandwidth",
      quantity: {
        source: "expression",
        expression: "bandwidthMbit x usageHours x quantity",
      },
      unit: "Mbit/s-hour",
      enabledWhen: { field: "publicOutboundAccess", equals: true },
    },
  ],
} satisfies PricingDefinition;

export const configurableServiceBundle = {
  service: serviceDefinition,
  pricing: pricingDefinition,
  catalogDefinition: {
    source: {
      displayName: "API Gateway",
      urlPath: "apig",
      tab: "calc",
    },
    parser: {
      kind: "grouped-sections",
      currency: "USD",
      sections: [
        {
          targetPath: "editionTiers",
          path: "product.apig_apig.instance",
          fields: [
            {
              key: "edition",
              extractor: {
                kind: "keyword-map",
                directPath: "resourceSpecCode",
                directMap: {
                  BASIC: "Basic",
                  PROFESSIONAL: "Professional",
                  ENTERPRISE: "Enterprise",
                  PLATINUM: "Platinum",
                  PLATINUM_X2: "Platinum 2",
                  PLATINUM_X3: "Platinum 3",
                  PLATINUM_X4: "Platinum 4",
                  PLATINUM_X5: "Platinum 5",
                  PLATINUM_X6: "Platinum 6",
                  PLATINUM_X7: "Platinum 7",
                  PLATINUM_X8: "Platinum 8",
                },
                textPaths: ["resourceSpecCode", "productSpecSysDesc"],
                mappings: [],
              },
              required: true,
            },
            { key: "resourceSpecCode", extractor: { kind: "path", path: "resourceSpecCode" } },
            { key: "hourlyRate", extractor: { kind: "plan-amount", billingMode: "ONDEMAND", billingEvent: "event.type.apig.apiginstance.duration" } },
            { key: "productId", extractor: { kind: "plan-product-id", billingMode: "ONDEMAND" } },
          ],
          dedupeBy: ["edition"],
          sort: [
            { path: "edition", direction: "asc", order: ["Basic", "Professional", "Enterprise", "Platinum", "Platinum 2", "Platinum 3", "Platinum 4", "Platinum 5", "Platinum 6", "Platinum 7", "Platinum 8"] },
          ],
        },
        {
          targetPath: "publicBandwidthTiers",
          path: "product.apig_apig.publicip",
          fields: [
            { key: "resourceSpecCode", extractor: { kind: "path", path: "resourceSpecCode" } },
            { key: "productId", extractor: { kind: "plan-product-id", billingMode: "ONDEMAND" } },
            { key: "ratePerMbitHour", extractor: { kind: "plan-amount", billingMode: "ONDEMAND", billingEvent: "event.type.apig.apigpublicip.duration" } },
            { key: "tiers", extractor: { kind: "division-tiers", billingMode: "ONDEMAND", billingEvent: "event.type.apig.apigpublicip.duration" } },
          ],
        },
      ],
    },
  },
  runtime: {
    quantityLabel: "Gateway",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "apig-pricing" },
    showSharedUsageHours: false,
    derived: [
      { key: "editionOptions", value: ifElse(ref("catalog"), call("listApigEditions", ref("catalog")), []) },
      { key: "edition", value: call("resolveOption", ref("values.edition"), ref("derived.editionOptions"), ref("helpers.apigDefaults.edition")) },
      { key: "publicOutboundAccess", value: eq(call("boolString", ref("values.publicOutboundAccess")), "true") },
      { key: "bandwidthMbit", value: call("clampInteger", ref("values.bandwidthMbit"), 1) },
      { key: "usageHours", value: call("clampInteger", ref("values.usageHours"), 1, 87600) },
      { key: "quantity", value: call("clampInteger", ref("values.quantity"), 1) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateApigConfiguration", ref("catalog"), {
            edition: ref("derived.edition"),
            publicOutboundAccess: ref("derived.publicOutboundAccess"),
            bandwidthMbit: ifElse(ref("derived.publicOutboundAccess"), ref("derived.bandwidthMbit"), 0),
            usageHours: ref("derived.usageHours"),
            quantity: ref("derived.quantity"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      edition: ref("derived.edition"),
      publicOutboundAccess: ref("derived.publicOutboundAccess"),
      bandwidthMbit: ref("derived.bandwidthMbit"),
      usageHours: ref("derived.usageHours"),
      quantity: ref("derived.quantity"),
    },
    fieldRuntime: {
      edition: { options: call("optionList", ref("derived.editionOptions")) },
      publicOutboundAccess: { normalize: ref("derived.publicOutboundAccess") },
      bandwidthMbit: { min: 1, normalize: ref("derived.bandwidthMbit") },
      usageHours: { min: 1, max: 87600, normalize: ref("derived.usageHours") },
      quantity: { min: 1, normalize: ref("derived.quantity") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(
      ref("derived.estimate"),
      null,
      call("firstMeaningfulText", ref("pricingError"), "API Gateway pricing is unavailable for the current selection."),
    ),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      template("Selected specifications: {edition} | {publicAccess} | {bandwidth} | {usageHours}h | {quantity} | {estimate}", {
        edition: ref("derived.edition"),
        publicAccess: ifElse(ref("derived.publicOutboundAccess"), "Public outbound enabled", "Public outbound disabled"),
        bandwidth: ifElse(ref("derived.publicOutboundAccess"), template("{bandwidth} Mbit/s", { bandwidth: ref("derived.bandwidthMbit") }), "No public bandwidth"),
        usageHours: ref("derived.usageHours"),
        quantity: template("{quantity} gateway{suffix}", {
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
      "Pricing sourced from Huawei Cloud API Gateway calculator API for {region}. Sources: {pricingUrl}, {productUrl}, and {calculatorApi}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.apigPricingReference.pricingUrl"),
        productUrl: ref("helpers.apigPricingReference.productUrl"),
        calculatorApi: ref("helpers.apigPricingReference.calculatorApi"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "apig",
        title: template("{service} {edition}", {
          service: ref("selectedService"),
          edition: ref("derived.edition"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: "Pay-per-use",
          edition: ref("derived.edition"),
          publicOutboundAccess: ref("derived.publicOutboundAccess"),
          bandwidthMbit: ifElse(ref("derived.publicOutboundAccess"), ref("derived.bandwidthMbit"), 0),
          usageHours: ref("derived.usageHours"),
          quantity: ref("derived.quantity"),
          resourceSpecCode: ref("derived.estimate.tier.resourceSpecCode"),
          productId: ref("derived.estimate.tier.productId"),
          publicBandwidthProductId: ref("derived.estimate.publicBandwidthTier.productId"),
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
      and(call("isRecord", ref("product.config")), eq(ref("product.productType"), "apig")),
      {
        handled: true,
        values: {
          edition: coalesce(ref("product.config.edition"), ref("helpers.apigDefaults.edition")),
          publicOutboundAccess: ref("product.config.publicOutboundAccess"),
          bandwidthMbit: call("integerString", ref("product.config.bandwidthMbit"), ref("helpers.apigDefaults.bandwidthMbit"), 1),
          usageHours: call("integerString", ref("product.config.usageHours"), ref("helpers.apigDefaults.usageHours"), 1, 87600),
          quantity: call("integerString", ref("product.config.quantity"), ref("helpers.apigDefaults.quantity"), 1),
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
