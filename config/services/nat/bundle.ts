import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import { and, call, coalesce, eq, ifElse, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const configurableServiceBundle = {
  service: {
    version: 1,
    definitionId: "nat",
    serviceCode: "NAT",
    serviceName: "NAT Gateway",
    icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Networking/NAT.png",
    implementation: "configurable",
    billingOptions: ["Pay-per-use", "Yearly/Monthly"],
    defaults: {
      natType: "Public NAT Gateway",
      natSize: "Small",
    },
    fields: [
      {
        id: "natType",
        type: "select",
        label: "Gateway Type",
        required: true,
        optionsSource: "catalog.gatewayTypes",
      },
      {
        id: "natSize",
        type: "select",
        label: "Specifications",
        required: true,
        optionsSource: "catalog.gatewaySizes",
      },
    ],
    summary: {
      selectionTemplate: "{natType} | {natSize}",
      notes: [
        "Billing mode remains controlled by the shared calculator header because NAT availability depends on the selected gateway type.",
      ],
    },
  },
  pricing: {
    version: 1,
    definitionId: "nat",
    serviceCode: "NAT",
    serviceName: "NAT Gateway",
    catalogAdapter: "nat",
    rateSources: {
      gateway: {
        catalogKey: "gateway.baseRate",
      },
    },
    metrics: [
      {
        id: "gateway",
        label: "Gateway",
        rateSource: "gateway",
        quantity: {
          source: "expression",
          expression: "1",
        },
      },
    ],
  },
  catalogDefinition: {
    source: {
      displayName: "NAT",
      urlPath: "nat",
      tab: "calc",
    },
    parser: {
      kind: "sectioned-rate-set",
      currency: "USD",
      collectionKey: "tiers",
      sections: [
        {
          path: "product.natgateway_natgateway",
          fields: [
            { key: "type", extractor: { kind: "literal", value: "Public NAT Gateway" } },
            {
              key: "size",
              required: true,
              extractor: {
                kind: "contains-map",
                path: "resourceSpecCode",
                mappings: [
                  { contains: "middle", value: "Medium" },
                  { contains: "medium", value: "Medium" },
                  { contains: "xlarge", value: "Extra-large" },
                  { contains: "large", value: "Large" },
                  { contains: "small", value: "Small" },
                ],
              },
            },
            { key: "resourceSpecCode", extractor: { kind: "path-or-template", path: "resourceSpecCode", template: "{type}-{size}" } },
            { key: "prices", extractor: { kind: "rate-set", modes: ["ONDEMAND", "MONTHLY", "YEARLY"] } },
          ],
        },
        {
          path: "product.natgateway_privatenat",
          fields: [
            { key: "type", extractor: { kind: "literal", value: "Private NAT Gateway" } },
            {
              key: "size",
              required: true,
              extractor: {
                kind: "contains-map",
                path: "resourceSpecCode",
                mappings: [
                  { contains: "middle", value: "Medium" },
                  { contains: "medium", value: "Medium" },
                  { contains: "xlarge", value: "Extra-large" },
                  { contains: "large", value: "Large" },
                  { contains: "small", value: "Small" },
                ],
              },
            },
            { key: "resourceSpecCode", extractor: { kind: "path-or-template", path: "resourceSpecCode", template: "{type}-{size}" } },
            { key: "prices", extractor: { kind: "rate-set", modes: ["ONDEMAND", "MONTHLY", "YEARLY"] } },
          ],
        },
      ],
    },
  },
  runtime: {
    quantityLabel: "Gateway",
    showGlobalQuantityControl: true,
    usesSharedBillingHeader: true,
    catalog: { route: "nat-pricing" },
    derived: [
      { key: "activeCatalog", value: coalesce(ref("catalog"), call("getFallbackNatPricingCatalog")) },
      { key: "natTypeOptions", value: call("listNatGatewayTypes", ref("derived.activeCatalog")) },
      { key: "natType", value: call("resolveOption", ref("values.natType"), ref("derived.natTypeOptions"), ref("helpers.natDefaults.type")) },
      { key: "natSizeOptions", value: call("listNatGatewaySizes", ref("derived.natType"), ref("derived.activeCatalog")) },
      { key: "natSize", value: call("resolveOption", ref("values.natSize"), ref("derived.natSizeOptions"), ref("helpers.natDefaults.size")) },
      {
        key: "estimate",
        value: call("estimateNatConfiguration", ref("derived.activeCatalog"), {
          type: ref("derived.natType"),
          size: ref("derived.natSize"),
          billingMode: ifElse(eq(ref("billingMode"), "Pay-per-use"), "Pay-per-use", "Yearly/Monthly"),
          usageHours: ref("usageHoursValue"),
        }),
      },
    ],
    syncValues: {
      natType: ref("derived.natType"),
      natSize: ref("derived.natSize"),
    },
    activeBillingOptions: ifElse(
      eq(ref("derived.natType"), "Public NAT Gateway"),
      ["Pay-per-use", "Yearly/Monthly"],
      ["Pay-per-use"],
    ),
    fieldRuntime: {
      natType: { options: call("optionList", ref("derived.natTypeOptions")) },
      natSize: { options: call("optionList", ref("derived.natSizeOptions")) },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(ref("derived.estimate"), null, call("firstMeaningfulText", ref("pricingError"), "NAT pricing is unavailable for the current selection.")),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      template("Selected specifications: {type} | {size} | {estimate}", {
        type: ref("derived.natType"),
        size: ref("derived.natSize"),
        estimate: call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.amount"), ref("derived.estimate.suffix")),
      }),
      "Selected specifications:",
    ),
    referenceNote: template(
      "Pricing sourced from Huawei Cloud NAT calculator API for {region}. Sources: {pricingUrl} and {specsUrl}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.natPricingReference.pricingUrl"),
        specsUrl: ref("helpers.natPricingReference.specsUrl"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "nat",
        title: template("{service} {type} {size}", {
          service: ref("selectedService"),
          type: ref("derived.natType"),
          size: ref("derived.natSize"),
        }),
        quantity: ref("instanceCountValue"),
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: ifElse(eq(ref("billingMode"), "Pay-per-use"), "Pay-per-use", "Yearly/Monthly"),
          type: ref("derived.natType"),
          size: ref("derived.natSize"),
          resourceSpecCode: ref("derived.estimate.tier.resourceSpecCode"),
          usageHours: ifElse(eq(ref("billingMode"), "Pay-per-use"), ref("usageHoursValue"), null),
          billableDays: ref("derived.estimate.billableDays"),
        },
        pricing: {
          total: call("formatFlavorAmount", ref("derived.estimate.currency"), call("multiplyNumbers", ref("derived.estimate.amount"), ref("instanceCountValue")), ref("derived.estimate.suffix")),
          estimate: call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.amount"), ref("derived.estimate.suffix")),
        },
      },
      null,
    ),
    hydrate: ifElse(
      and(eq(ref("product.productType"), "nat"), call("isRecord", ref("product.config"))),
      {
        handled: true,
        values: {
          natType: ifElse(eq(ref("product.config.type"), "Private NAT Gateway"), "Private NAT Gateway", "Public NAT Gateway"),
          natSize: call("resolveOption", ref("product.config.size"), ["Small", "Medium", "Large", "Extra-large"], "Small"),
        },
        nextRegion: coalesce(ref("product.config.region"), ref("regionValue")),
        nextBillingMode: ifElse(eq(ref("product.config.billingMode"), "Yearly/Monthly"), "Yearly/Monthly", "Pay-per-use"),
        nextUsageHours: call("integerString", ref("product.config.usageHours"), ref("usageHours"), 1),
        nextInstanceCount: call("integerString", ref("product.quantity"), 1, 1),
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
