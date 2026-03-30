import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import { and, call, coalesce, eq, ifElse, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const configurableServiceBundle = {
  service: {
    version: 1,
    definitionId: "functiongraph",
    serviceCode: "FunctionGraph",
    serviceName: "FunctionGraph",
    icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Compute/FunctionGraph.png",
    implementation: "configurable",
    billingOptions: ["Pay-per-use"],
    defaults: {
      averageRequestsAmount: 233,
      averageRequestsUnit: "month",
      executionDurationMs: 100,
      memoryAmount: 128,
      memoryUnit: "MB",
    },
    fields: [
      {
        id: "averageRequestsAmount",
        type: "number",
        label: "Average Requests",
        description: "Ten thousand counts.",
        required: true,
        min: 0,
        step: 1,
      },
      {
        id: "averageRequestsUnit",
        type: "select",
        label: "Time unit",
        required: true,
        options: ["month", "day", "hour"],
      },
      {
        id: "executionDurationMs",
        type: "number",
        label: "Average Execution Duration",
        required: true,
        unit: "ms",
        min: 1,
        max: 900000,
        step: 10,
      },
      {
        id: "memoryAmount",
        type: "number",
        label: "Amount of Memory Allocated",
        required: true,
        min: 128,
        step: 128,
      },
      {
        id: "memoryUnit",
        type: "select",
        label: "Memory unit",
        required: true,
        options: ["MB", "GB"],
      },
    ],
    summary: {
      selectionTemplate: "{averageRequestsAmount} x 10k/{averageRequestsUnit} | {executionDurationMs} ms | {memoryAmount} {memoryUnit}",
      notes: [
        "FunctionGraph pricing combines request volume with billable GB-seconds after the free monthly quota.",
        "Daily and hourly request averages are projected to a 30-day month.",
      ],
    },
  },
  pricing: {
    version: 1,
    definitionId: "functiongraph",
    serviceCode: "FunctionGraph",
    serviceName: "FunctionGraph",
    catalogAdapter: "functiongraph",
    rateSources: {
      requests: {
        catalogKey: "requestRatePerMillion",
        description: "FunctionGraph request price per million requests above the monthly free tier.",
      },
      compute: {
        catalogKey: "computeRatePerGbSecond",
        description: "FunctionGraph execution duration price per GB-second above the monthly free tier.",
      },
    },
    metrics: [
      {
        id: "requests",
        label: "Requests above free tier",
        rateSource: "requests",
        quantity: {
          source: "expression",
          expression: "billable monthly requests in millions",
        },
      },
      {
        id: "compute",
        label: "Execution duration above free tier",
        rateSource: "compute",
        quantity: {
          source: "expression",
          expression: "billable monthly GB-seconds",
        },
        unit: "GB-s",
      },
    ],
  },
  runtime: {
    quantityLabel: "Function",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "functiongraph-pricing" },
    showSharedUsageHours: false,
    derived: [
      { key: "activeCatalog", value: coalesce(ref("catalog"), call("getFallbackFunctionGraphPricingCatalog")) },
      { key: "averageRequestsUnitOptions", value: ["month", "day", "hour"] },
      { key: "averageRequestsUnit", value: call("resolveOption", ref("values.averageRequestsUnit"), ref("derived.averageRequestsUnitOptions"), ref("helpers.functionGraphDefaults.averageRequestsUnit")) },
      { key: "memoryUnitOptions", value: ["MB", "GB"] },
      { key: "memoryUnit", value: call("resolveOption", ref("values.memoryUnit"), ref("derived.memoryUnitOptions"), ref("helpers.functionGraphDefaults.memoryUnit")) },
      { key: "averageRequestsAmount", value: call("clampInteger", ref("values.averageRequestsAmount"), 0) },
      { key: "executionDurationMs", value: call("clampInteger", ref("values.executionDurationMs"), 1, 900000) },
      {
        key: "memoryAmount",
        value: ifElse(
          eq(ref("derived.memoryUnit"), "GB"),
          call("clampInteger", ref("values.memoryAmount"), 1, 10),
          call("clampInteger", ref("values.memoryAmount"), 128, 10240),
        ),
      },
      {
        key: "estimate",
        value: call("estimateFunctionGraphConfiguration", ref("derived.activeCatalog"), {
          averageRequestsAmount: ref("derived.averageRequestsAmount"),
          averageRequestsUnit: ref("derived.averageRequestsUnit"),
          executionDurationMs: ref("derived.executionDurationMs"),
          memoryAmount: ref("derived.memoryAmount"),
          memoryUnit: ref("derived.memoryUnit"),
        }),
      },
    ],
    syncValues: {
      averageRequestsAmount: ref("derived.averageRequestsAmount"),
      averageRequestsUnit: ref("derived.averageRequestsUnit"),
      executionDurationMs: ref("derived.executionDurationMs"),
      memoryAmount: ref("derived.memoryAmount"),
      memoryUnit: ref("derived.memoryUnit"),
    },
    fieldRuntime: {
      averageRequestsUnit: { options: call("optionList", ref("derived.averageRequestsUnitOptions")) },
      averageRequestsAmount: {
        min: 0,
        normalize: call("clampInteger", ref("values.averageRequestsAmount"), 0),
      },
      executionDurationMs: {
        min: 1,
        max: 900000,
        normalize: call("clampInteger", ref("values.executionDurationMs"), 1, 900000),
      },
      memoryUnit: { options: call("optionList", ref("derived.memoryUnitOptions")) },
      memoryAmount: {
        min: ifElse(eq(ref("derived.memoryUnit"), "GB"), 1, 128),
        max: ifElse(eq(ref("derived.memoryUnit"), "GB"), 10, 10240),
        normalize: ifElse(
          eq(ref("derived.memoryUnit"), "GB"),
          call("clampInteger", ref("values.memoryAmount"), 1, 10),
          call("clampInteger", ref("values.memoryAmount"), 128, 10240),
        ),
      },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(
      ref("derived.estimate"),
      null,
      call("firstMeaningfulText", ref("pricingError"), "FunctionGraph pricing is unavailable for the current selection."),
    ),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      template("Selected specifications: {requests} x 10k/{requestUnit} | {duration} ms | {memory} {memoryUnit} | {estimate}", {
        requests: ref("derived.averageRequestsAmount"),
        requestUnit: ref("derived.averageRequestsUnit"),
        duration: ref("derived.executionDurationMs"),
        memory: ref("derived.memoryAmount"),
        memoryUnit: ref("derived.memoryUnit"),
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
      "Pricing sourced from Huawei Cloud FunctionGraph calculator API for {region}. Sources: {pricingUrl}, {productUrl}, and {calculatorApi}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.functionGraphPricingReference.pricingUrl"),
        productUrl: ref("helpers.functionGraphPricingReference.productUrl"),
        calculatorApi: ref("helpers.functionGraphPricingReference.calculatorApi"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "functiongraph",
        title: template("{service} {memory} {memoryUnit} {duration} ms", {
          service: ref("selectedService"),
          memory: ref("derived.memoryAmount"),
          memoryUnit: ref("derived.memoryUnit"),
          duration: ref("derived.executionDurationMs"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: "Pay-per-use",
          averageRequestsAmount: ref("derived.averageRequestsAmount"),
          averageRequestsUnit: ref("derived.averageRequestsUnit"),
          monthlyRequestCount: ref("derived.estimate.monthlyRequestCount"),
          executionDurationMs: ref("derived.executionDurationMs"),
          memoryAmount: ref("derived.memoryAmount"),
          memoryUnit: ref("derived.memoryUnit"),
          memoryGiB: ref("derived.estimate.memoryGiB"),
          requestFreeCount: ref("derived.activeCatalog.requestFreeCount"),
          requestRatePerMillion: ref("derived.activeCatalog.requestRatePerMillion"),
          computeFreeGbSeconds: ref("derived.activeCatalog.computeFreeGbSeconds"),
          computeRatePerGbSecond: ref("derived.activeCatalog.computeRatePerGbSecond"),
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
      and(ref("product"), call("isRecord", ref("product.config")), eq(ref("product.productType"), "functiongraph")),
      {
        handled: true,
        values: {
          averageRequestsAmount: call("integerString", ref("product.config.averageRequestsAmount"), ref("helpers.functionGraphDefaults.averageRequestsAmount"), 0),
          averageRequestsUnit: call("resolveOption", ref("product.config.averageRequestsUnit"), ["month", "day", "hour"], ref("helpers.functionGraphDefaults.averageRequestsUnit")),
          executionDurationMs: call("integerString", ref("product.config.executionDurationMs"), ref("helpers.functionGraphDefaults.executionDurationMs"), 1, 900000),
          memoryAmount: ifElse(
            eq(ref("product.config.memoryUnit"), "GB"),
            call("integerString", ref("product.config.memoryAmount"), 1, 1, 10),
            call("integerString", ref("product.config.memoryAmount"), ref("helpers.functionGraphDefaults.memoryAmount"), 128, 10240),
          ),
          memoryUnit: call("resolveOption", ref("product.config.memoryUnit"), ["MB", "GB"], ref("helpers.functionGraphDefaults.memoryUnit")),
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

export const serviceDefinition = configurableServiceBundle.service;
export const pricingDefinition = configurableServiceBundle.pricing;
