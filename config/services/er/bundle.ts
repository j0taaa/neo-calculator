import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";
import { and, call, coalesce, eq, ifElse, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const serviceDefinition = {
  version: 1,
  definitionId: "er",
  serviceCode: "ER",
  serviceName: "Enterprise Router",
  icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Networking/ER.png",
  implementation: "configurable",
  billingOptions: ["Pay-per-use"],
  defaults: {
    attachmentQuantity: 1,
    usageHours: 744,
    trafficGb: 0,
    quantity: 1,
  },
  fields: [
    { id: "attachmentQuantity", type: "number", label: "Attachment Quantity", required: true, unit: "PCS", min: 1, step: 1 },
    { id: "usageHours", type: "number", label: "Required Duration", required: true, unit: "hour", min: 1, max: 87600, step: 1 },
    { id: "trafficGb", type: "number", label: "Traffic", required: true, unit: "GB", min: 0, step: 1, inputMode: "decimal" },
    { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, step: 1 },
  ],
  summary: {
    selectionTemplate: "{attachmentQuantity} attachments | {usageHours}h | {trafficGb} GB | {quantity}",
    notes: [
      "This calculator models the visible Enterprise Router pay-per-use flow from the Huawei er calculator.",
    ],
  },
} satisfies ServiceDefinition;

export const pricingDefinition = {
  version: 1,
  definitionId: "er",
  serviceCode: "ER",
  serviceName: "Enterprise Router",
  catalogAdapter: "er",
  rateSources: {
    attachment: {
      catalogKey: "attachmentTiers[0].ratePerHour",
      description: "Enterprise Router attachment hourly rate from the Huawei er calculator catalog.",
    },
    traffic: {
      catalogKey: "trafficTiers[0].ratePerGb",
      description: "Enterprise Router traffic rate per GB from the Huawei er calculator catalog.",
    },
  },
  metrics: [
    {
      id: "attachment",
      label: "Attachment duration",
      rateSource: "attachment",
      quantity: {
        source: "expression",
        expression: "attachmentQuantity x usageHours x quantity",
      },
      unit: "attachment-hour",
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
      displayName: "Enterprise Router",
      urlPath: "er",
      tab: "calc",
    },
    parser: {
      kind: "grouped-sections",
      currency: "USD",
      sections: [
        {
          targetPath: "attachmentTiers",
          path: "product.er_er.attachment",
          fields: [
            { key: "resourceSpecCode", extractor: { kind: "path", path: "resourceSpecCode" } },
            { key: "attachmentType", extractor: { kind: "path-or-template", path: "attachment type", template: "VPC" } },
            { key: "ratePerHour", extractor: { kind: "plan-amount", billingMode: "ONDEMAND", billingEvent: "event.type.er.erattachment.duration" } },
            { key: "productId", extractor: { kind: "plan-product-id", billingMode: "ONDEMAND" } },
          ],
          sort: [{ path: "attachmentType", direction: "asc" }],
        },
        {
          targetPath: "trafficTiers",
          path: "product.er_er.traffic",
          fields: [
            { key: "resourceSpecCode", extractor: { kind: "path", path: "resourceSpecCode" } },
            { key: "trafficType", extractor: { kind: "path-or-template", path: "traffic type", template: "VPC" } },
            { key: "ratePerGb", extractor: { kind: "plan-amount", billingMode: "ONDEMAND", billingEvent: "event.type.er.ertraffic.downflow" } },
            { key: "productId", extractor: { kind: "plan-product-id", billingMode: "ONDEMAND" } },
          ],
          sort: [{ path: "trafficType", direction: "asc" }],
        },
      ],
    },
  },
  runtime: {
    quantityLabel: "Router",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "er-pricing" },
    showSharedUsageHours: false,
    derived: [
      { key: "attachmentQuantity", value: call("clampInteger", ref("values.attachmentQuantity"), 1) },
      { key: "usageHours", value: call("clampInteger", ref("values.usageHours"), 1, 87600) },
      { key: "trafficGb", value: call("clampNumber", ref("values.trafficGb"), 0) },
      { key: "quantity", value: call("clampInteger", ref("values.quantity"), 1) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateErConfiguration", ref("catalog"), {
            attachmentQuantity: ref("derived.attachmentQuantity"),
            usageHours: ref("derived.usageHours"),
            trafficGb: ref("derived.trafficGb"),
            quantity: ref("derived.quantity"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      attachmentQuantity: ref("derived.attachmentQuantity"),
      usageHours: ref("derived.usageHours"),
      trafficGb: ref("derived.trafficGb"),
      quantity: ref("derived.quantity"),
    },
    fieldRuntime: {
      attachmentQuantity: { min: 1, normalize: ref("derived.attachmentQuantity") },
      usageHours: { min: 1, max: 87600, normalize: ref("derived.usageHours") },
      trafficGb: { min: 0, normalize: ref("derived.trafficGb") },
      quantity: { min: 1, normalize: ref("derived.quantity") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(
      ref("derived.estimate"),
      null,
      call("firstMeaningfulText", ref("pricingError"), "Enterprise Router pricing is unavailable for the current selection."),
    ),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      template("Selected specifications: {attachments} attachment{attachmentSuffix} | {usageHours}h | {trafficGb} GB | {quantity} | {estimate}", {
        attachments: ref("derived.attachmentQuantity"),
        attachmentSuffix: ifElse(eq(ref("derived.attachmentQuantity"), 1), "", "s"),
        usageHours: ref("derived.usageHours"),
        trafficGb: ref("derived.trafficGb"),
        quantity: template("{quantity} router{suffix}", {
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
      "Pricing sourced from Huawei Cloud Enterprise Router calculator API for {region}. Sources: {pricingUrl}, {productUrl}, and {calculatorApi}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.erPricingReference.pricingUrl"),
        productUrl: ref("helpers.erPricingReference.productUrl"),
        calculatorApi: ref("helpers.erPricingReference.calculatorApi"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "er",
        title: template("{service} {attachments} attachment{suffix}", {
          service: ref("selectedService"),
          attachments: ref("derived.attachmentQuantity"),
          suffix: ifElse(eq(ref("derived.attachmentQuantity"), 1), "", "s"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: "Pay-per-use",
          attachmentQuantity: ref("derived.attachmentQuantity"),
          usageHours: ref("derived.usageHours"),
          trafficGb: ref("derived.trafficGb"),
          quantity: ref("derived.quantity"),
          attachmentResourceSpecCode: ref("derived.estimate.attachmentTier.resourceSpecCode"),
          attachmentProductId: ref("derived.estimate.attachmentTier.productId"),
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
      and(call("isRecord", ref("product.config")), eq(ref("product.productType"), "er")),
      {
        handled: true,
        values: {
          attachmentQuantity: call("integerString", ref("product.config.attachmentQuantity"), ref("helpers.erDefaults.attachmentQuantity"), 1),
          usageHours: call("integerString", ref("product.config.usageHours"), ref("helpers.erDefaults.usageHours"), 1, 87600),
          trafficGb: coalesce(ref("product.config.trafficGb"), ref("helpers.erDefaults.trafficGb")),
          quantity: call("integerString", ref("product.config.quantity"), ref("helpers.erDefaults.quantity"), 1),
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
