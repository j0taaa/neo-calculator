import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";
import { and, call, coalesce, eq, ifElse, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const serviceDefinition = {
  version: 1,
  definitionId: "sfs",
  serviceCode: "SFS",
  serviceName: "Scalable File Service",
  icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Storage/SFS.png",
  implementation: "configurable",
  billingOptions: ["Yearly/Monthly", "Pay-per-use"],
  defaults: {
    fileSystemType: "General",
    type: "Capacity-Oriented",
    storageSpaceGb: 100,
    durationMonths: 1,
    quantity: 1,
  },
  fields: [
    { id: "fileSystemType", type: "select", label: "File System Type", required: true, options: ["General"] },
    { id: "type", type: "select", label: "Type", required: true, optionsSource: "catalog.typeOptions" },
    { id: "storageSpaceGb", type: "select", label: "Storage Space", required: true, optionsSource: "catalog.storageSpaceOptions" },
    { id: "durationMonths", type: "select", label: "Required Duration", required: true, optionsSource: "catalog.durationMonthOptions", visibleWhen: { field: "billingMode", equals: "Yearly/Monthly" } },
    { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, step: 1 },
  ],
  summary: {
    selectionTemplate: "{fileSystemType} | {type} | {storageSpaceGb} GB | {quantity}",
    notes: [
      "This calculator models the Scalable File Service General workflow from the Huawei sfs catalog.",
      "The current live catalog exposes package pricing for Capacity-Oriented storage and pay-per-use pricing for General storage.",
    ],
  },
} satisfies ServiceDefinition;

export const pricingDefinition = {
  version: 1,
  definitionId: "sfs",
  serviceCode: "SFS",
  serviceName: "Scalable File Service",
  catalogAdapter: "sfs",
  rateSources: {
    package: {
      catalogKey: "packageTiers.plans",
      description: "Normalized Scalable File Service package plans from the Huawei sfs calculator catalog.",
    },
    payg: {
      catalogKey: "paygTiers.ratePerGbHour",
      description: "Normalized Scalable File Service pay-per-use storage rate from the Huawei sfs calculator catalog.",
    },
  },
  metrics: [
    {
      id: "storage",
      label: "Storage",
      rateSource: "package",
      quantity: {
        source: "field",
        field: "storageSpaceGb",
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
      displayName: "Scalable File Service",
      urlPath: "sfs",
      tab: "calc",
    },
    parser: {
      kind: "grouped-sections",
      currency: "USD",
      sections: [
        {
          targetPath: "packageTiers",
          path: "product.sfs_sfs",
          filters: [
            { kind: "field-starts-with", path: "resourceSpecCode", value: "sfs.storage." },
          ],
          fields: [
            { key: "fileSystemType", extractor: { kind: "literal", value: "General" } },
            { key: "type", extractor: { kind: "literal", value: "Capacity-Oriented" } },
            { key: "storageSpaceGb", required: true, extractor: { kind: "number-from-pattern", paths: ["productSpecSysDesc", "resourceSpecCode"], pattern: "(\\d+)GB" } },
            { key: "resourceSpecCode", extractor: { kind: "path", path: "resourceSpecCode" } },
            { key: "plans", extractor: { kind: "path", path: "planList" } },
          ],
          dedupeBy: ["storageSpaceGb"],
          sort: [
            { path: "storageSpaceGb", direction: "asc" },
          ],
        },
        {
          targetPath: "paygTiers",
          path: "product.sfs_sfs",
          filters: [
            { kind: "field-equals", path: "resourceSpecCode", value: "SFS_SATA" },
          ],
          fields: [
            { key: "fileSystemType", extractor: { kind: "literal", value: "General" } },
            { key: "type", extractor: { kind: "literal", value: "General" } },
            { key: "resourceSpecCode", extractor: { kind: "path", path: "resourceSpecCode" } },
            { key: "ratePerGbHour", extractor: { kind: "plan-amount", billingMode: "ONDEMAND", billingEvent: "event.type.sfs.size" } },
            { key: "productId", extractor: { kind: "plan-product-id", billingMode: "ONDEMAND" } },
          ],
          dedupeBy: ["type"],
        },
      ],
    },
  },
  runtime: {
    quantityLabel: "File System",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "sfs-pricing" },
    showSharedUsageHours: true,
    derived: [
      { key: "fileSystemTypeOptions", value: call("listSfsFileSystemTypes") },
      { key: "fileSystemType", value: call("resolveOption", ref("values.fileSystemType"), ref("derived.fileSystemTypeOptions"), ref("helpers.sfsDefaults.fileSystemType")) },
      {
        key: "typeOptions",
        value: ifElse(
          ref("catalog"),
          call("listSfsTypes", ref("catalog"), ifElse(eq(ref("billingMode"), "Pay-per-use"), "Pay-per-use", "Yearly/Monthly")),
          ifElse(eq(ref("billingMode"), "Pay-per-use"), ["General"], ["Capacity-Oriented"]),
        ),
      },
      { key: "type", value: call("resolveOption", ref("values.type"), ref("derived.typeOptions"), ref("helpers.sfsDefaults.type")) },
      { key: "storageSpaceOptions", value: ifElse(ref("catalog"), call("listSfsStorageSpaceOptions", ref("catalog")), [100, 500, 1024, 5120, 10240, 30720, 51200, 102400, 204800]) },
      { key: "storageSpaceGb", value: call("resolveNumberOption", ref("values.storageSpaceGb"), ref("derived.storageSpaceOptions"), ref("helpers.sfsDefaults.storageSpaceGb")) },
      { key: "durationMonthOptions", value: ifElse(ref("catalog"), call("listSfsDurationMonths", ref("catalog"), ref("derived.type")), [1, 2, 3, 4, 5, 6, 7, 8, 12]) },
      { key: "durationMonths", value: call("resolveNumberOption", ref("values.durationMonths"), ref("derived.durationMonthOptions"), ref("helpers.sfsDefaults.durationMonths")) },
      { key: "quantity", value: call("clampInteger", ref("values.quantity"), 1) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateSfsConfiguration", ref("catalog"), {
            billingMode: ifElse(eq(ref("billingMode"), "Pay-per-use"), "Pay-per-use", "Yearly/Monthly"),
            fileSystemType: ref("derived.fileSystemType"),
            type: ref("derived.type"),
            storageSpaceGb: ref("derived.storageSpaceGb"),
            durationMonths: ref("derived.durationMonths"),
            usageHours: ref("usageHoursValue"),
            quantity: ref("derived.quantity"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      fileSystemType: ref("derived.fileSystemType"),
      type: ref("derived.type"),
      storageSpaceGb: ref("derived.storageSpaceGb"),
      durationMonths: ref("derived.durationMonths"),
      quantity: ref("derived.quantity"),
    },
    fieldRuntime: {
      fileSystemType: { options: call("optionList", ref("derived.fileSystemTypeOptions")) },
      type: { options: call("optionList", ref("derived.typeOptions")) },
      storageSpaceGb: { options: call("optionList", ref("derived.storageSpaceOptions")) },
      durationMonths: { options: call("optionList", ref("derived.durationMonthOptions")) },
      quantity: { min: 1, normalize: ref("derived.quantity") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(
      ref("derived.estimate"),
      null,
      call("firstMeaningfulText", ref("pricingError"), "Scalable File Service pricing is unavailable for the current selection."),
    ),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      template("Selected specifications: {fileSystemType} | {type} | {storageSpace} | {term} | {quantity} | {estimate}", {
        fileSystemType: ref("derived.fileSystemType"),
        type: ref("derived.type"),
        storageSpace: template("{storageSpaceGb} GB", { storageSpaceGb: ref("derived.storageSpaceGb") }),
        term: ifElse(eq(ref("billingMode"), "Pay-per-use"), template("{hours}h", { hours: ref("usageHoursValue") }), template("{months}mo", { months: ref("derived.durationMonths") })),
        quantity: template("{quantity} file system{suffix}", {
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
      "Pricing sourced from Huawei Scalable File Service calculator API for {region}. Sources: {pricingUrl}, {productUrl}, and {calculatorApi}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.sfsPricingReference.pricingUrl"),
        productUrl: ref("helpers.sfsPricingReference.productUrl"),
        calculatorApi: ref("helpers.sfsPricingReference.calculatorApi"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "sfs",
        title: template("{service} {type}", {
          service: ref("selectedService"),
          type: ref("derived.type"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: ifElse(eq(ref("billingMode"), "Pay-per-use"), "Pay-per-use", "Yearly/Monthly"),
          fileSystemType: ref("derived.fileSystemType"),
          type: ref("derived.type"),
          storageSpaceGb: ref("derived.storageSpaceGb"),
          durationMonths: ifElse(eq(ref("billingMode"), "Yearly/Monthly"), ref("derived.durationMonths"), null),
          usageHours: ifElse(eq(ref("billingMode"), "Pay-per-use"), ref("usageHoursValue"), null),
          quantity: ref("derived.quantity"),
          resourceSpecCode: coalesce(ref("derived.estimate.packageTier.resourceSpecCode"), ref("derived.estimate.paygTier.resourceSpecCode")),
          productId: coalesce(ref("derived.estimate.selectedPlan.productId"), ref("derived.estimate.paygTier.productId")),
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
      and(call("isRecord", ref("product.config")), eq(ref("product.productType"), "sfs")),
      {
        handled: true,
        values: {
          fileSystemType: coalesce(ref("product.config.fileSystemType"), ref("helpers.sfsDefaults.fileSystemType")),
          type: coalesce(ref("product.config.type"), ref("helpers.sfsDefaults.type")),
          storageSpaceGb: call("integerString", ref("product.config.storageSpaceGb"), ref("helpers.sfsDefaults.storageSpaceGb"), 1),
          durationMonths: call("integerString", ref("product.config.durationMonths"), ref("helpers.sfsDefaults.durationMonths"), 1, 12),
          quantity: call("integerString", ref("product.config.quantity"), ref("helpers.sfsDefaults.quantity"), 1),
        },
        nextRegion: coalesce(ref("product.config.region"), ref("regionValue")),
        nextBillingMode: coalesce(ref("product.config.billingMode"), "Yearly/Monthly"),
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

