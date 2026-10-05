import { runtimeExpression, type RuntimeContext } from "@/lib/runtime-expression";
import type { TypedDeclarativeRuntimeDefinition } from "@/lib/typed-declarative-runtime-types";
import type { ModelArtsPricingCatalog } from "@/lib/modelarts-catalog";
import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";

export const serviceDefinition = {
  version: 1,
  definitionId: "modelarts",
  serviceCode: "ModelArts",
  serviceName: "ModelArts",
  icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/AI/ModelArts.png",
  implementation: "configurable",
  billingOptions: ["Pay-per-use", "Yearly/Monthly"],
  defaults: {
    serviceType: "AI Development Lifecycle",
    resourceType: "Public Resource Pool",
    specification: "Compute CPU instance (2U)",
    quantity: 1,
    storageQuotaGb: 1,
    usageHours: 744,
    durationMonths: 1,
  },
  fields: [
    {
      id: "serviceType",
      type: "select",
      label: "Service Type",
      required: true,
      options: ["AI Development Lifecycle"],
    },
    {
      id: "resourceType",
      type: "select",
      label: "Resource Type",
      required: true,
      optionsSource: "catalog.resourceTypes",
    },
    {
      id: "specification",
      type: "select",
      label: "Specifications",
      required: true,
      optionsSource: "catalog.specifications",
    },
    {
      id: "quantity",
      type: "number",
      label: "Quantity",
      required: true,
      min: 1,
      step: 1,
      visibleWhen: {
        field: "resourceType",
        notEquals: "EVS Storage",
      },
    },
    {
      id: "storageQuotaGb",
      type: "number",
      label: "Quota",
      required: true,
      unit: "GB",
      min: 1,
      step: 1,
      visibleWhen: {
        field: "resourceType",
        equals: "EVS Storage",
      },
    },
    {
      id: "usageHours",
      type: "number",
      label: "Required Duration",
      required: true,
      unit: "hours",
      min: 1,
      step: 24,
      visibleWhen: {
        field: "billingMode",
        equals: "Pay-per-use",
      },
    },
    {
      id: "durationMonths",
      type: "select",
      label: "Required Duration",
      required: true,
      options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 12],
      visibleWhen: {
        field: "billingMode",
        equals: "Yearly/Monthly",
      },
    },
  ],
  summary: {
    selectionTemplate: "{serviceType} | {resourceType} | {specification}",
    notes: [
      "Billing mode controls which ModelArts resource types are available.",
      "The generated form keeps Service Type fixed to the AI Development Lifecycle flow.",
    ],
  },
} satisfies ServiceDefinition;

export const pricingDefinition = {
  version: 1,
  definitionId: "modelarts",
  serviceCode: "ModelArts",
  serviceName: "ModelArts",
  catalogAdapter: "modelarts",
  rateSources: {
    compute: {
      catalogKey: "compute.prices",
      description: "Normalized ModelArts compute instance rates from the productInfo catalog.",
    },
    storage: {
      catalogKey: "storage.prices",
      description: "Normalized ModelArts instance storage rate from the productInfo catalog.",
    },
  },
  metrics: [
    {
      id: "computeInstances",
      label: "Compute instances",
      rateSource: "compute",
      quantity: {
        source: "field",
        field: "quantity",
      },
      enabledWhen: {
        field: "resourceType",
        notEquals: "EVS Storage",
      },
    },
    {
      id: "instanceStorage",
      label: "Instance storage",
      rateSource: "storage",
      quantity: {
        source: "field",
        field: "storageQuotaGb",
      },
      unit: "GB",
      enabledWhen: {
        field: "resourceType",
        equals: "EVS Storage",
      },
    },
  ],
} satisfies PricingDefinition;

function deriveCatalog({
  catalog,
  helpers,
  billingMode,
  values,
  usageHoursValue,
}: RuntimeContext<ModelArtsPricingCatalog>) {
  return (() => {
    const resourceTypeOptions = catalog
      ? helpers.listModelArtsResourceTypes(catalog, billingMode === "Yearly/Monthly" ? "Yearly/Monthly" : "Pay-per-use")
      : billingMode === "Yearly/Monthly"
        ? (["Dedicated Resource Pool"] as const)
        : (["Public Resource Pool", "Dedicated Resource Pool", "EVS Storage"] as const);
    const resourceType =
      resourceTypeOptions.find((option) => option === values.resourceType) ??
      resourceTypeOptions[0] ??
      helpers.modelArtsDefaults.resourceType;
    const specificationOptions = catalog
      ? helpers.listModelArtsSpecifications(catalog, {
          billingMode: billingMode === "Yearly/Monthly" ? "Yearly/Monthly" : "Pay-per-use",
          resourceType,
        })
      : [helpers.modelArtsDefaults.specification];
    const specification =
      specificationOptions.find((option) => option === values.specification) ??
      specificationOptions[0] ??
      helpers.modelArtsDefaults.specification;
    const quantity = helpers.clampInteger(values.quantity || 1, 1);
    const storageQuotaGb = helpers.clampNumber(values.storageQuotaGb || 1, 1);
    const durationMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12].includes(Number(values.durationMonths))
      ? Number(values.durationMonths)
      : helpers.modelArtsDefaults.durationMonths;
    const estimate = catalog
      ? helpers.estimateModelArtsConfiguration(catalog, {
          billingMode: billingMode === "Yearly/Monthly" ? "Yearly/Monthly" : "Pay-per-use",
          serviceType: "AI Development Lifecycle",
          resourceType,
          specification,
          quantity,
          storageQuotaGb,
          usageHours: usageHoursValue,
          durationMonths,
        })
      : null;
    return {
      resourceTypeOptions,
      resourceType,
      specificationOptions,
      specification,
      quantity,
      storageQuotaGb,
      durationMonths,
      estimate,
    };
  })();
}
type Scope = RuntimeContext<ModelArtsPricingCatalog, ReturnType<typeof deriveCatalog>>;
const compute = runtimeExpression<Scope>;

const runtimeDefinition = {
  quantityLabel: "Configuration",
  showGlobalQuantityControl: false,
  usesSharedBillingHeader: true,
  catalog: { route: "modelarts-pricing" },
  showSharedUsageHours: compute(() => false),
  catalogView: compute(deriveCatalog),
  syncValues: compute(({ catalogView, usageHoursValue }) => ({
    serviceType: "AI Development Lifecycle",
    resourceType: catalogView.resourceType,
    specification: catalogView.specification,
    quantity: String(catalogView.quantity),
    storageQuotaGb: String(catalogView.storageQuotaGb),
    durationMonths: String(catalogView.durationMonths),
    usageHours: String(usageHoursValue),
  })),
  fieldRuntime: {
    serviceType: {
      disabled: compute(() => true),
    },
    resourceType: {
      options: compute(({ helpers, catalogView }) => helpers.optionList(catalogView.resourceTypeOptions)),
    },
    specification: {
      options: compute(({ helpers, catalogView }) => helpers.optionList(catalogView.specificationOptions)),
    },
    quantity: {
      min: compute(() => 1),
      normalize: compute(({ helpers, values }) => helpers.clampInteger(values.quantity || 1, 1)),
    },
    storageQuotaGb: {
      min: compute(() => 1),
      normalize: compute(({ helpers, values }) => helpers.clampNumber(values.storageQuotaGb || 1, 1)),
    },
    usageHours: {
      min: compute(() => 1),
      max: compute(() => 87600),
      normalize: compute(({ helpers, values }) => helpers.clampInteger(values.usageHours || 744, 1, 87600)),
    },
  },
  estimate: compute(({ catalogView }) => catalogView.estimate),
  addToListError: compute(({ catalogView, pricingError }) =>
    catalogView.estimate ? null : pricingError || "ModelArts pricing is unavailable for the current selection.",
  ),
  selectionSummary: compute(
    ({ catalogView, billingMode, usageHoursValue, helpers }) =>
      `Selected specifications: AI Development Lifecycle | ${catalogView.resourceType} | ${catalogView.specification}${catalogView.resourceType === "EVS Storage" ? ` | ${catalogView.storageQuotaGb} GB` : ` | ${catalogView.quantity} instance${catalogView.quantity === 1 ? "" : "s"}`}${billingMode === "Yearly/Monthly" ? ` | ${catalogView.durationMonths === 12 ? "1yr" : `${catalogView.durationMonths}mo`}` : ` | ${usageHoursValue}h`}${catalogView.estimate ? ` | ${helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix)}` : ""}`,
  ),
  selectionNotes: compute(({ catalogView, helpers }) =>
    catalogView.estimate
      ? [
          ...helpers.formatBreakdownNotes(
            catalogView.estimate.currency,
            catalogView.estimate.suffix,
            catalogView.estimate.breakdown,
          ),
          `Monthly average: ${helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.monthlyAverageAmount, "/mo")}.`,
          ...helpers.asArray(catalogView.estimate.notes),
        ]
      : [],
  ),
  referenceNote: compute(
    ({ catalogRegionId, helpers, regionValue }) =>
      `Pricing sourced from Huawei Cloud ModelArts calculator API for ${catalogRegionId ?? helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue}. Sources: ${helpers.modelArtsPricingReference.pricingUrl} and ${helpers.modelArtsPricingReference.productUrl}`,
  ),
  buildRequestBodies: compute(
    ({
      catalogView,
      selectedServiceCode,
      selectedService,
      regionValue,
      catalogRegionId,
      helpers,
      billingMode,
      usageHoursValue,
    }) =>
      catalogView.estimate
        ? {
            serviceCode: selectedServiceCode,
            serviceName: selectedService,
            productType: "modelarts",
            title: `${selectedService} ${catalogView.resourceType} ${catalogView.specification}`,
            quantity: 1,
            config: {
              region: regionValue,
              catalogRegionId: catalogRegionId ?? helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue,
              billingMode: billingMode === "Yearly/Monthly" ? "Yearly/Monthly" : "Pay-per-use",
              serviceType: "AI Development Lifecycle",
              resourceType: catalogView.resourceType,
              specification: catalogView.specification,
              quantity: catalogView.resourceType === "EVS Storage" ? null : catalogView.quantity,
              storageQuotaGb: catalogView.resourceType === "EVS Storage" ? catalogView.storageQuotaGb : null,
              usageHours: billingMode === "Pay-per-use" ? usageHoursValue : null,
              durationMonths: billingMode === "Yearly/Monthly" ? catalogView.durationMonths : null,
              resourceSpecCode: catalogView.estimate.tier.resourceSpecCode,
            },
            pricing: {
              total: helpers.formatFlavorAmount(
                catalogView.estimate.currency,
                catalogView.estimate.amount,
                catalogView.estimate.suffix,
              ),
              estimate: helpers.formatFlavorAmount(
                catalogView.estimate.currency,
                catalogView.estimate.amount,
                catalogView.estimate.suffix,
              ),
              monthlyAverage: helpers.formatFlavorAmount(
                catalogView.estimate.currency,
                catalogView.estimate.monthlyAverageAmount,
                "/mo",
              ),
              breakdown: helpers.byLabelAmount(
                catalogView.estimate.currency,
                catalogView.estimate.suffix,
                catalogView.estimate.breakdown,
              ),
            },
          }
        : null,
  ),
  hydrate: compute(({ product, helpers, usageHours, regionValue }) =>
    (() => {
      if (product.productType !== "modelarts" || !helpers.isRecord(product.config)) {
        return { handled: false, error: "This product cannot be edited from the calculator." };
      }
      return {
        handled: true,
        values: {
          serviceType: "AI Development Lifecycle",
          resourceType:
            typeof product.config.resourceType === "string"
              ? product.config.resourceType
              : helpers.modelArtsDefaults.resourceType,
          specification:
            typeof product.config.specification === "string"
              ? product.config.specification
              : helpers.modelArtsDefaults.specification,
          quantity:
            typeof product.config.quantity === "number"
              ? String(Math.max(1, Math.floor(product.config.quantity)))
              : String(helpers.modelArtsDefaults.quantity),
          storageQuotaGb:
            typeof product.config.storageQuotaGb === "number"
              ? String(Math.max(1, product.config.storageQuotaGb))
              : String(helpers.modelArtsDefaults.storageQuotaGb),
          durationMonths:
            typeof product.config.durationMonths === "number"
              ? String(product.config.durationMonths)
              : String(helpers.modelArtsDefaults.durationMonths),
          usageHours:
            typeof product.config.usageHours === "number"
              ? String(Math.max(1, Math.floor(product.config.usageHours)))
              : usageHours,
        },
        nextRegion: typeof product.config.region === "string" ? product.config.region : regionValue,
        nextBillingMode: product.config.billingMode === "Yearly/Monthly" ? "Yearly/Monthly" : "Pay-per-use",
        nextUsageHours:
          typeof product.config.usageHours === "number"
            ? String(Math.max(1, Math.floor(product.config.usageHours)))
            : usageHours,
        nextInstanceCount: "1",
      };
    })(),
  ),
} satisfies TypedDeclarativeRuntimeDefinition;

export const configurableServiceBundle = {
  service: serviceDefinition,
  pricing: pricingDefinition,
  runtime: runtimeDefinition,
} as const satisfies ConfigurableServiceBundleDefinition;
