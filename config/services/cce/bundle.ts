import { runtimeExpression, type RuntimeContext } from "@/lib/runtime-expression";
import type { TypedDeclarativeRuntimeDefinition } from "@/lib/typed-declarative-runtime-types";
import type { CcePricingCatalog } from "@/lib/cce-catalog";
import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";

export const serviceDefinition = {
  version: 1,
  definitionId: "cce",
  serviceCode: "CCE",
  serviceName: "Cloud Container Engine",
  icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Containers/CCE.png",
  implementation: "configurable",
  billingOptions: ["Pay-per-use", "Yearly/Monthly"],
  defaults: {
    clusterScale: "50 nodes",
    masterNodes: "Single",
  },
  fields: [
    {
      id: "clusterScale",
      type: "select",
      label: "Cluster Scale",
      required: true,
      optionsSource: "catalog.clusterScales",
    },
    {
      id: "masterNodes",
      type: "select",
      label: "Master Nodes",
      required: true,
      optionsSource: "catalog.masterNodeCounts",
    },
  ],
  summary: {
    selectionTemplate: "{clusterScale} | {masterNodes}",
  },
} satisfies ServiceDefinition;

export const pricingDefinition = {
  version: 1,
  definitionId: "cce",
  serviceCode: "CCE",
  serviceName: "Cloud Container Engine",
  catalogAdapter: "cce",
  rateSources: {
    cluster: {
      catalogKey: "cluster.managementRate",
    },
  },
  metrics: [
    {
      id: "clusterManagement",
      label: "Cluster management",
      rateSource: "cluster",
      quantity: {
        source: "expression",
        expression: "1",
      },
    },
  ],
} satisfies PricingDefinition;

function deriveCatalog({ catalog, helpers, values, billingMode, usageHoursValue }: RuntimeContext<CcePricingCatalog>) {
  return (() => {
    const activeCatalog = catalog ?? helpers.getFallbackCcePricingCatalog();
    const clusterScaleOptions = helpers.listCceClusterScales(activeCatalog);
    const clusterScale =
      clusterScaleOptions.find((option) => option === values.clusterScale) ??
      clusterScaleOptions[0] ??
      helpers.cceDefaults.scale;
    const masterNodeOptions = helpers.listCceMasterNodes(clusterScale, activeCatalog);
    const masterNodes =
      masterNodeOptions.find((option) => option === values.masterNodes) ??
      masterNodeOptions[0] ??
      helpers.cceDefaults.masterNodes;
    const estimate = helpers.estimateCceConfiguration(activeCatalog, {
      scale: clusterScale,
      masterNodes,
      billingMode: billingMode === "Pay-per-use" ? "Pay-per-use" : "Yearly/Monthly",
      usageHours: billingMode === "Pay-per-use" ? usageHoursValue : null,
    });
    return { activeCatalog, clusterScaleOptions, clusterScale, masterNodeOptions, masterNodes, estimate };
  })();
}
type Scope = RuntimeContext<CcePricingCatalog, ReturnType<typeof deriveCatalog>>;
const compute = runtimeExpression<Scope>;

const runtimeDefinition = {
  quantityLabel: "Instance",
  showGlobalQuantityControl: true,
  usesSharedBillingHeader: true,
  catalog: { route: "cce-pricing" },
  catalogView: compute(deriveCatalog),
  syncValues: compute(({ catalogView }) => ({
    clusterScale: catalogView.clusterScale,
    masterNodes: catalogView.masterNodes,
  })),
  fieldRuntime: {
    clusterScale: {
      options: compute(({ helpers, catalogView }) => helpers.optionList(catalogView.clusterScaleOptions)),
    },
    masterNodes: {
      options: compute(({ helpers, catalogView }) => helpers.optionList(catalogView.masterNodeOptions)),
    },
  },
  estimate: compute(({ catalogView }) => catalogView.estimate),
  selectionSummary: compute(({ catalogView, helpers }) =>
    catalogView.estimate
      ? `Selected specifications: ${catalogView.clusterScale} | ${catalogView.masterNodes} | ${helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix)}`
      : "Selected specifications:",
  ),
  referenceNote: compute(
    ({ catalogRegionId, helpers, regionValue }) =>
      `Pricing sourced from Huawei Cloud CCE calculator API for ${catalogRegionId ?? helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue}. Source: ${helpers.ccePricingReference.pricingUrl}`,
  ),
  buildRequestBodies: compute(
    ({
      catalogView,
      selectedServiceCode,
      selectedService,
      instanceCountValue,
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
            productType: "cce",
            title: `${selectedService} ${catalogView.clusterScale} ${catalogView.masterNodes}`,
            quantity: instanceCountValue,
            config: {
              region: regionValue,
              catalogRegionId: catalogRegionId ?? helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue,
              billingMode,
              clusterScale: catalogView.clusterScale,
              masterNodes: catalogView.masterNodes,
              usageHours: billingMode === "Pay-per-use" ? usageHoursValue : null,
              resourceSpecCode: catalogView.estimate.tier.resourceSpecCode ?? null,
            },
            pricing: {
              total: helpers.formatFlavorAmount(
                catalogView.estimate.currency,
                catalogView.estimate.amount * instanceCountValue,
                catalogView.estimate.suffix,
              ),
              estimate: helpers.formatFlavorAmount(
                catalogView.estimate.currency,
                catalogView.estimate.amount,
                catalogView.estimate.suffix,
              ),
            },
          }
        : null,
  ),
  hydrate: compute(({ product, helpers, regionValue, usageHours }) =>
    (() => {
      if (product.productType !== "cce" || !helpers.isRecord(product.config)) {
        return { handled: false, error: "This product cannot be edited from the calculator." };
      }
      return {
        handled: true,
        values: {
          clusterScale:
            typeof product.config.clusterScale === "string" ? product.config.clusterScale : helpers.cceDefaults.scale,
          masterNodes: product.config.masterNodes === "Single" ? "Single" : "3 Masters",
        },
        nextRegion: typeof product.config.region === "string" ? product.config.region : regionValue,
        nextBillingMode: product.config.billingMode === "Yearly/Monthly" ? "Yearly/Monthly" : "Pay-per-use",
        nextUsageHours:
          typeof product.config.usageHours === "number"
            ? String(Math.max(1, Math.floor(product.config.usageHours)))
            : usageHours,
        nextInstanceCount: String(Math.max(1, product.quantity)),
      };
    })(),
  ),
} satisfies TypedDeclarativeRuntimeDefinition;

export const configurableServiceBundle = {
  service: serviceDefinition,
  pricing: pricingDefinition,
  runtime: runtimeDefinition,
} as const satisfies ConfigurableServiceBundleDefinition;
