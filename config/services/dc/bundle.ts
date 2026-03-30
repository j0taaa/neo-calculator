import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";
import { and, call, coalesce, eq, ifElse, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const serviceDefinition = {
  version: 1,
  definitionId: "dc",
  serviceCode: "DC",
  serviceName: "Direct Connect",
  icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Networking/DC.png",
  implementation: "configurable",
  billingOptions: ["Yearly/Monthly"],
  defaults: {
    portSpeed: "1GE",
    durationMonths: 1,
    quantity: 1,
  },
  fields: [
    { id: "portSpeed", type: "select", label: "Port Speed", required: true, optionsSource: "catalog.portSpeeds" },
    { id: "durationMonths", type: "select", label: "Required Duration", required: true, optionsSource: "catalog.durationMonths" },
    { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, step: 1 },
  ],
  summary: {
    selectionTemplate: "{portSpeed} | {durationMonths} months | {quantity}",
    notes: [
      "This calculator models the Direct Connect yearly/monthly port flow from the Huawei dline catalog.",
      "Monthly durations above 1 month are projected from the direct 1-month rate returned by the live catalog.",
    ],
  },
} satisfies ServiceDefinition;

export const pricingDefinition = {
  version: 1,
  definitionId: "dc",
  serviceCode: "DC",
  serviceName: "Direct Connect",
  catalogAdapter: "direct-connect",
  rateSources: {
    port: {
      catalogKey: "portTiers.plans",
      description: "Normalized Direct Connect port plans from the Huawei dline calculator catalog.",
    },
  },
  metrics: [
    {
      id: "port",
      label: "Port",
      rateSource: "port",
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
      displayName: "Direct Connect",
      urlPath: "dline",
      tab: "calc",
    },
    parser: {
      kind: "grouped-sections",
      currency: "USD",
      sections: [
        {
          targetPath: "portTiers",
          path: "product.dcaas_dcaas.port",
          fields: [
            {
              key: "portSpeed",
              required: true,
              extractor: {
                kind: "keyword-map",
                textPaths: ["resourceSpecCode", "productSpecSysDesc", "PortType"],
                mappings: [
                  { keywords: ["1ge"], value: "1GE" },
                  { keywords: ["10ge"], value: "10GE" },
                  { keywords: ["40ge"], value: "40GE" },
                  { keywords: ["100ge"], value: "100GE" },
                  { keywords: ["porttype:1pcs"], value: "1GE" },
                  { keywords: ["porttype:10pcs"], value: "10GE" },
                  { keywords: ["porttype:40pcs"], value: "40GE" },
                  { keywords: ["porttype:100pcs"], value: "100GE" },
                ],
              },
            },
            { key: "resourceSpecCode", extractor: { kind: "path", path: "resourceSpecCode" } },
            { key: "plans", extractor: { kind: "path", path: "planList" } },
          ],
          dedupeBy: ["portSpeed"],
          sort: [
            { path: "portSpeed", direction: "asc", order: ["1GE", "10GE", "40GE", "100GE"] },
          ],
        },
      ],
    },
  },
  runtime: {
    quantityLabel: "Port",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "direct-connect-pricing" },
    showSharedUsageHours: false,
    derived: [
      { key: "portSpeedOptions", value: ifElse(ref("catalog"), call("listDirectConnectPortSpeeds", ref("catalog")), ["1GE", "10GE", "40GE", "100GE"]) },
      { key: "portSpeed", value: call("resolveOption", ref("values.portSpeed"), ref("derived.portSpeedOptions"), ref("helpers.directConnectDefaults.portSpeed")) },
      { key: "durationMonthOptions", value: ifElse(ref("catalog"), call("listDirectConnectDurationMonths", ref("catalog"), ref("derived.portSpeed")), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) },
      { key: "durationMonths", value: call("resolveNumberOption", ref("values.durationMonths"), ref("derived.durationMonthOptions"), ref("helpers.directConnectDefaults.durationMonths")) },
      { key: "quantity", value: call("clampInteger", ref("values.quantity"), 1) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateDirectConnectConfiguration", ref("catalog"), {
            portSpeed: ref("derived.portSpeed"),
            durationMonths: ref("derived.durationMonths"),
            quantity: ref("derived.quantity"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      portSpeed: ref("derived.portSpeed"),
      durationMonths: ref("derived.durationMonths"),
      quantity: ref("derived.quantity"),
    },
    fieldRuntime: {
      portSpeed: { options: call("optionList", ref("derived.portSpeedOptions")) },
      durationMonths: { options: call("optionList", ref("derived.durationMonthOptions")) },
      quantity: { min: 1, normalize: ref("derived.quantity") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(
      ref("derived.estimate"),
      null,
      call("firstMeaningfulText", ref("pricingError"), "Direct Connect pricing is unavailable for the current selection."),
    ),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      call(
        "joinSelectionParts",
        [
          "Selected specifications:",
          ref("derived.portSpeed"),
          ifElse(eq(ref("derived.durationMonths"), 12), "1yr", ifElse(eq(ref("derived.durationMonths"), 24), "2yr", ifElse(eq(ref("derived.durationMonths"), 36), "3yr", template("{months}mo", { months: ref("derived.durationMonths") })))),
          template("{quantity} port{suffix}", {
            quantity: ref("derived.quantity"),
            suffix: ifElse(eq(ref("derived.quantity"), 1), "", "s"),
          }),
          call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.amount"), ref("derived.estimate.suffix")),
        ],
      ),
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
      "Pricing sourced from Huawei Cloud Direct Connect calculator API for {region}. Sources: {pricingUrl} and {calculatorApi}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.directConnectPricingReference.pricingUrl"),
        calculatorApi: ref("helpers.directConnectPricingReference.calculatorApi"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "direct-connect",
        title: template("{service} {portSpeed}", {
          service: ref("selectedService"),
          portSpeed: ref("derived.portSpeed"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: "Yearly/Monthly",
          portSpeed: ref("derived.portSpeed"),
          durationMonths: ref("derived.durationMonths"),
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
      and(call("isRecord", ref("product.config")), eq(ref("product.productType"), "direct-connect")),
      {
        handled: true,
        values: {
          portSpeed: coalesce(ref("product.config.portSpeed"), ref("helpers.directConnectDefaults.portSpeed")),
          durationMonths: call("integerString", ref("product.config.durationMonths"), ref("helpers.directConnectDefaults.durationMonths"), 1, 36),
          quantity: call("integerString", ref("product.config.quantity"), ref("helpers.directConnectDefaults.quantity"), 1),
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
