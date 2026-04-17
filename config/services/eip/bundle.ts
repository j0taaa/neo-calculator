import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import { and, call, coalesce, eq, ifElse, max, not, or, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const configurableServiceBundle = {
  service: {
    version: 1,
    definitionId: "eip",
    serviceCode: "EIP",
    serviceName: "Elastic IP",
    icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Networking/EIP.png",
    implementation: "configurable",
    billingOptions: ["Pay-per-use", "Yearly/Monthly"],
    defaults: {
      type: "Dedicated EIP",
      chargeMode: "By bandwidth",
      bandwidthMbit: 1,
      enhanced95DurationMonths: 1,
      sharedBandwidthQuantity: 1,
      trafficAmount: 0,
      trafficUnit: "GB",
    },
    fields: [
      {
        id: "type",
        type: "select",
        label: "Type",
        required: true,
        options: ["Dedicated EIP", "Shared EIP"],
      },
      {
        id: "chargeMode",
        type: "select",
        label: "Charge Mode",
        required: true,
        optionsSource: "catalog.chargeModes",
      },
      {
        id: "bandwidthMbit",
        type: "number",
        label: "Bandwidth",
        required: true,
        unit: "Mbit/s",
        inputMode: "decimal",
        minSource: "catalog.bandwidth.min",
        visibleWhen: {
          field: "showBandwidth",
          equals: true,
        },
      },
      {
        id: "enhanced95DurationMonths",
        type: "number",
        label: "Required Duration",
        required: true,
        unit: "months",
        min: 1,
        step: 1,
        visibleWhenAll: [
          { field: "type", equals: "Shared EIP" },
          { field: "chargeMode", equals: "Enhanced 95" },
        ],
      },
      {
        id: "sharedBandwidthQuantity",
        type: "number",
        label: "Bandwidth Quantity",
        required: true,
        min: 1,
        step: 1,
        visibleWhenAll: [
          { field: "type", equals: "Shared EIP" },
          { field: "chargeMode", equals: "By bandwidth" },
        ],
      },
      {
        id: "trafficAmount",
        type: "number",
        label: "Traffic",
        required: true,
        inputMode: "decimal",
        min: 0,
        visibleWhenAll: [
          { field: "type", equals: "Dedicated EIP" },
          { field: "chargeMode", equals: "By traffic" },
        ],
      },
      {
        id: "trafficUnit",
        type: "select",
        label: "Traffic Unit",
        required: true,
        options: ["GB", "TB"],
        visibleWhenAll: [
          { field: "type", equals: "Dedicated EIP" },
          { field: "chargeMode", equals: "By traffic" },
        ],
      },
    ],
    summary: {
      selectionTemplate: "{type} | Dynamic BGP | {chargeMode}",
      notes: [
        "The Huawei calculator currently uses Dynamic BGP for this workflow.",
      ],
    },
  },
  pricing: {
    version: 1,
    definitionId: "eip",
    serviceCode: "EIP",
    serviceName: "Elastic IP",
    catalogAdapter: "eip",
    rateSources: {
      address: { catalogKey: "eip.addressRate" },
      bandwidth: { catalogKey: "eip.bandwidthRate" },
      traffic: { catalogKey: "eip.trafficRate" },
      enhanced95: { catalogKey: "eip.enhanced95Rate" },
    },
    metrics: [
      {
        id: "address",
        label: "Address",
        rateSource: "address",
        quantity: { source: "expression", expression: "1" },
      },
      {
        id: "bandwidth",
        label: "Bandwidth",
        rateSource: "bandwidth",
        quantity: { source: "field", field: "bandwidthMbit" },
        enabledWhen: { field: "showBandwidth", equals: true },
      },
      {
        id: "traffic",
        label: "Traffic",
        rateSource: "traffic",
        quantity: { source: "field", field: "trafficAmount" },
        enabledWhen: { field: "chargeMode", equals: "By traffic" },
      },
      {
        id: "enhanced95",
        label: "Enhanced 95",
        rateSource: "enhanced95",
        quantity: { source: "expression", expression: "1" },
        enabledWhen: { field: "chargeMode", equals: "Enhanced 95" },
      },
    ],
  },
  catalogDefinition: {
    source: {
      displayName: "EIP",
      urlPath: "eip",
      tab: "calc",
    },
    parser: {
      kind: "selected-records",
      currency: "USD",
      collections: [
        { id: "eipItems", path: "product.vpc_ip" },
        { id: "bandwidthItems", path: "product.vpc_bandwidth" },
        { id: "dedicatedEipPreferred", from: "eipItems", filters: [{ kind: "field-equals", path: "resourceSpecCode", value: "5_bgp" }] },
        {
          id: "dedicatedBandwidthPreferred",
          from: "bandwidthItems",
          filters: [
            { kind: "field-equals", path: "resourceSpecCode", value: "19_bgp" },
            { kind: "field-equals", path: "shareType", value: "dataInfo_3_" },
            { kind: "field-equals", path: "eipType", value: "dataInfo_5_" },
          ],
        },
        {
          id: "dedicatedBandwidthFallback",
          from: "bandwidthItems",
          filters: [{ kind: "field-equals", path: "resourceSpecCode", value: "19_bgp" }],
        },
        {
          id: "sharedBandwidthPreferred",
          from: "bandwidthItems",
          filters: [
            { kind: "field-equals", path: "resourceSpecCode", value: "19_share" },
            { kind: "field-equals", path: "shareType", value: "dataInfo_4_" },
            { kind: "field-equals", path: "eipType", value: "dataInfo_5_" },
          ],
        },
        {
          id: "sharedBandwidthFallback",
          from: "bandwidthItems",
          filters: [
            { kind: "field-equals", path: "resourceSpecCode", value: "19_share" },
            { kind: "field-equals", path: "eipType", value: "dataInfo_5_" },
          ],
        },
        {
          id: "sharedEnhanced95",
          from: "bandwidthItems",
          filters: [
            { kind: "field-equals", path: "resourceSpecCode", value: "19_share" },
            { kind: "field-equals", path: "shareType", value: "dataInfo_4_" },
            { kind: "field-equals", path: "eipType", value: "dataInfo_17_" },
          ],
        },
        {
          id: "dedicatedTrafficPreferred",
          from: "bandwidthItems",
          filters: [
            { kind: "field-equals", path: "resourceSpecCode", value: "12_bgp" },
            { kind: "field-equals", path: "shareType", value: "dataInfo_3_" },
          ],
        },
        {
          id: "dedicatedTrafficFallback",
          from: "bandwidthItems",
          filters: [{ kind: "field-equals", path: "resourceSpecCode", value: "12_bgp" }],
        },
        {
          id: "dedicatedTrafficPackages",
          from: "bandwidthItems",
          filters: [
            { kind: "field-starts-with", path: "resourceSpecCode", value: "12_bgp_" },
            { kind: "field-equals", path: "shareType", value: "dataInfo_13_" },
          ],
        },
      ],
      outputs: [
        {
          targetPath: "dedicated.eipRates",
          extractor: { kind: "rate-set", modes: ["ONDEMAND", "MONTHLY", "YEARLY"] },
          fromCollections: ["dedicatedEipPreferred", "eipItems"],
        },
        {
          targetPath: "dedicated.bandwidthRates",
          extractor: { kind: "rate-set", modes: ["ONDEMAND", "MONTHLY", "YEARLY"] },
          fromCollections: ["dedicatedBandwidthPreferred", "dedicatedBandwidthFallback"],
        },
        {
          targetPath: "dedicated.trafficRatePerGb",
          extractor: { kind: "plan-amount", billingMode: "ONDEMAND", billingEvent: "event.type.bandwidthupflow" },
          fromCollections: ["dedicatedTrafficPreferred", "dedicatedTrafficFallback"],
        },
        {
          targetPath: "dedicated.trafficRateTiers",
          extractor: { kind: "division-tiers", billingMode: "ONDEMAND", billingEvent: "event.type.bandwidthupflow" },
          fromCollections: ["dedicatedTrafficPreferred", "dedicatedTrafficFallback"],
        },
        {
          targetPath: "dedicated.trafficPackages.MONTHLY",
          extractor: { kind: "packages", billingModes: ["MONTHLY"], sizePath: "resourceSpecCode", sizeRegex: "_(\\d+)GB$" },
          fromCollection: "dedicatedTrafficPackages",
        },
        {
          targetPath: "dedicated.trafficPackages.YEARLY",
          extractor: { kind: "packages", billingModes: ["YEARLY"], sizePath: "resourceSpecCode", sizeRegex: "_(\\d+)GB$" },
          fromCollection: "dedicatedTrafficPackages",
        },
        {
          targetPath: "shared.bandwidthRates",
          extractor: { kind: "rate-set", modes: ["ONDEMAND", "MONTHLY", "YEARLY"] },
          fromCollections: ["sharedBandwidthPreferred", "sharedBandwidthFallback"],
        },
        {
          targetPath: "shared.enhanced95MonthlyBaseRate",
          extractor: { kind: "plan-amount", billingMode: "ONDEMAND" },
          fromCollection: "sharedEnhanced95",
        },
      ],
    },
  },
  runtime: {
    quantityLabel: "EIP",
    showGlobalQuantityControl: true,
    usesSharedBillingHeader: true,
    catalog: { route: "eip-pricing" },
    derived: [
      { key: "type", value: call("resolveOption", ref("values.type"), ["Dedicated EIP", "Shared EIP"], "Dedicated EIP") },
      {
        key: "chargeModeOptions",
        value: ifElse(eq(ref("derived.type"), "Shared EIP"), ["By bandwidth", "Enhanced 95"], ["By bandwidth", "By traffic"]),
      },
      {
        key: "chargeMode",
        value: call("resolveOption", ref("values.chargeMode"), ref("derived.chargeModeOptions"), "By bandwidth"),
      },
      {
        key: "showBandwidth",
        value: or(eq(ref("derived.chargeMode"), "By bandwidth"), eq(ref("derived.chargeMode"), "Enhanced 95")),
      },
      {
        key: "showTraffic",
        value: and(eq(ref("derived.type"), "Dedicated EIP"), eq(ref("derived.chargeMode"), "By traffic")),
      },
      {
        key: "showEnhanced95DurationMonths",
        value: and(eq(ref("derived.type"), "Shared EIP"), eq(ref("derived.chargeMode"), "Enhanced 95")),
      },
      {
        key: "showSharedBandwidthQuantity",
        value: and(eq(ref("derived.type"), "Shared EIP"), eq(ref("derived.chargeMode"), "By bandwidth")),
      },
      {
        key: "bandwidthMinimumMbit",
        value: ifElse(
          eq(ref("derived.type"), "Shared EIP"),
          ifElse(eq(ref("derived.chargeMode"), "Enhanced 95"), ref("helpers.eipSharedEnhanced95MinimumMbit"), ref("helpers.eipSharedBandwidthMinimumMbit")),
          1,
        ),
      },
      {
        key: "bandwidthMbit",
        value: ifElse(
          ref("derived.showBandwidth"),
          max(
            ref("derived.bandwidthMinimumMbit"),
            call("normalizeObsPositiveNumber", ref("values.bandwidthMbit"), ref("derived.bandwidthMinimumMbit"), 0),
          ),
          0,
        ),
      },
      {
        key: "enhanced95DurationMonths",
        value: max(1, call("clampInteger", ref("values.enhanced95DurationMonths"), 1)),
      },
      {
        key: "sharedBandwidthQuantity",
        value: max(1, call("clampInteger", ref("values.sharedBandwidthQuantity"), 1)),
      },
      {
        key: "trafficAmount",
        value: call("normalizeObsPositiveNumber", ref("values.trafficAmount"), 0, 0),
      },
      {
        key: "trafficUnit",
        value: ifElse(eq(ref("values.trafficUnit"), "TB"), "TB", "GB"),
      },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateEipConfiguration", ref("catalog"), {
            type: ref("derived.type"),
            chargeMode: ref("derived.chargeMode"),
            billingMode: ifElse(eq(ref("billingMode"), "Pay-per-use"), "Pay-per-use", "Yearly/Monthly"),
            durationHours: ref("usageHoursValue"),
            durationMonths: ifElse(ref("derived.showEnhanced95DurationMonths"), ref("derived.enhanced95DurationMonths"), 1),
            bandwidthMbit: ref("derived.bandwidthMbit"),
            sharedBandwidthQuantity: ifElse(ref("derived.showSharedBandwidthQuantity"), ref("derived.sharedBandwidthQuantity"), 1),
            trafficAmount: ifElse(ref("derived.showTraffic"), ref("derived.trafficAmount"), 0),
            trafficUnit: ref("derived.trafficUnit"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      type: ref("derived.type"),
      chargeMode: ref("derived.chargeMode"),
      bandwidthMbit: ref("derived.bandwidthMbit"),
      enhanced95DurationMonths: ref("derived.enhanced95DurationMonths"),
      sharedBandwidthQuantity: ref("derived.sharedBandwidthQuantity"),
      trafficAmount: ref("derived.trafficAmount"),
      trafficUnit: ref("derived.trafficUnit"),
    },
    visibilityContext: {
      showBandwidth: ref("derived.showBandwidth"),
      showTraffic: ref("derived.showTraffic"),
    },
    activeBillingOptions: ifElse(
      and(eq(ref("derived.type"), "Dedicated EIP"), eq(ref("derived.chargeMode"), "By bandwidth")),
      ["Pay-per-use", "Yearly/Monthly"],
      ["Pay-per-use"],
    ),
    showSharedUsageHours: not(ref("derived.showEnhanced95DurationMonths")),
    fieldRuntime: {
      chargeMode: { options: call("optionList", ref("derived.chargeModeOptions")) },
      bandwidthMbit: { min: ref("derived.bandwidthMinimumMbit"), normalize: ref("derived.bandwidthMbit") },
      enhanced95DurationMonths: { min: 1, normalize: ref("derived.enhanced95DurationMonths") },
      sharedBandwidthQuantity: { min: 1, normalize: ref("derived.sharedBandwidthQuantity") },
      trafficAmount: { min: 0, normalize: ref("derived.trafficAmount") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(ref("derived.estimate"), null, call("firstMeaningfulText", ref("pricingError"), "EIP pricing is unavailable for the current selection.")),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      call(
        "joinSelectionParts",
        [
          "Selected specifications:",
          ref("derived.type"),
          "Dynamic BGP",
          ref("derived.chargeMode"),
          ifElse(ref("derived.showBandwidth"), template("{bandwidth} Mbit/s", { bandwidth: ref("derived.bandwidthMbit") }), null),
          ifElse(ref("derived.showEnhanced95DurationMonths"), template("{months}mo", { months: ref("derived.enhanced95DurationMonths") }), null),
          ifElse(
            ref("derived.showSharedBandwidthQuantity"),
            template("{quantity} shared bandwidth{suffix}", {
              quantity: ref("derived.sharedBandwidthQuantity"),
              suffix: ifElse(eq(ref("derived.sharedBandwidthQuantity"), 1), "", "s"),
            }),
            null,
          ),
          ifElse(ref("derived.showTraffic"), template("{amount} {unit}", { amount: ref("derived.trafficAmount"), unit: ref("derived.trafficUnit") }), null),
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
        [template("Monthly average: {avg}.", { avg: call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.monthlyAverageAmount"), "/mo") })],
        call("asArray", ref("derived.estimate.notes")),
      ),
      [],
    ),
    referenceNote: template(
      "Pricing sourced from Huawei Cloud EIP calculator API for {region}. Source: {pricingUrl}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.eipPricingReference.pricingUrl"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "eip",
        title: template("{service} {type} Dynamic BGP {chargeMode}", {
          service: ref("selectedService"),
          type: ref("derived.type"),
          chargeMode: ref("derived.chargeMode"),
        }),
        quantity: ref("instanceCountValue"),
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: ifElse(eq(ref("billingMode"), "Pay-per-use"), "Pay-per-use", "Yearly/Monthly"),
          type: ref("derived.type"),
          eipType: "Dynamic BGP",
          chargeMode: ref("derived.chargeMode"),
          bandwidthMbit: ifElse(ref("derived.showBandwidth"), ref("derived.bandwidthMbit"), null),
          durationMonths: ifElse(ref("derived.showEnhanced95DurationMonths"), ref("derived.enhanced95DurationMonths"), null),
          sharedBandwidthQuantity: ifElse(ref("derived.showSharedBandwidthQuantity"), ref("derived.sharedBandwidthQuantity"), null),
          trafficAmount: ifElse(ref("derived.showTraffic"), ref("derived.trafficAmount"), null),
          trafficUnit: ifElse(ref("derived.showTraffic"), ref("derived.trafficUnit"), null),
          usageHours: ifElse(and(eq(ref("billingMode"), "Pay-per-use"), not(ref("derived.showEnhanced95DurationMonths"))), ref("usageHoursValue"), null),
        },
        pricing: {
          total: call("formatFlavorAmount", ref("derived.estimate.currency"), call("multiplyNumbers", ref("derived.estimate.amount"), ref("instanceCountValue")), ref("derived.estimate.suffix")),
          estimate: call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.amount"), ref("derived.estimate.suffix")),
          monthlyAverage: call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.monthlyAverageAmount"), "/mo"),
          breakdown: call("byLabelAmount", ref("derived.estimate.currency"), ref("derived.estimate.suffix"), ref("derived.estimate.breakdown")),
        },
      },
      null,
    ),
    hydrate: ifElse(
      and(eq(ref("product.productType"), "eip"), call("isRecord", ref("product.config"))),
      {
        handled: true,
        values: {
          type: ifElse(eq(ref("product.config.type"), "Shared EIP"), "Shared EIP", "Dedicated EIP"),
          chargeMode: ifElse(
            or(eq(ref("product.config.chargeMode"), "By traffic"), eq(ref("product.config.chargeMode"), "Enhanced 95")),
            ref("product.config.chargeMode"),
            "By bandwidth",
          ),
          bandwidthMbit: coalesce(ref("product.config.bandwidthMbit"), ref("helpers.eipDefaults.bandwidthMbit")),
          enhanced95DurationMonths: coalesce(ref("product.config.durationMonths"), 1),
          sharedBandwidthQuantity: coalesce(ref("product.config.sharedBandwidthQuantity"), 1),
          trafficAmount: coalesce(ref("product.config.trafficAmount"), 0),
          trafficUnit: ifElse(eq(ref("product.config.trafficUnit"), "TB"), "TB", "GB"),
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
