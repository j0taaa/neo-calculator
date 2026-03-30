import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import type { DeclarativeRuntimeDefinition } from "@/lib/declarative-service-runtime-types";
import { convertLegacyRuntimeDefinition } from "@/lib/legacy-runtime-converter";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";

export const serviceDefinition = {
  "version": 1,
  "definitionId": "cce",
  "serviceCode": "CCE",
  "serviceName": "Cloud Container Engine",
  "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Containers/CCE.png",
  "implementation": "configurable",
  "billingOptions": [
    "Pay-per-use",
    "Yearly/Monthly"
  ],
  "defaults": {
    "clusterScale": "50 nodes",
    "masterNodes": "3 Masters"
  },
  "fields": [
    {
      "id": "clusterScale",
      "type": "select",
      "label": "Cluster Scale",
      "required": true,
      "optionsSource": "catalog.clusterScales"
    },
    {
      "id": "masterNodes",
      "type": "select",
      "label": "Master Nodes",
      "required": true,
      "optionsSource": "catalog.masterNodeCounts"
    }
  ],
  "summary": {
    "selectionTemplate": "{clusterScale} | {masterNodes}"
  }
} satisfies ServiceDefinition;

export const pricingDefinition = {
  "version": 1,
  "definitionId": "cce",
  "serviceCode": "CCE",
  "serviceName": "Cloud Container Engine",
  "catalogAdapter": "cce",
  "rateSources": {
    "cluster": {
      "catalogKey": "cluster.managementRate"
    }
  },
  "metrics": [
    {
      "id": "clusterManagement",
      "label": "Cluster management",
      "rateSource": "cluster",
      "quantity": {
        "source": "expression",
        "expression": "1"
      }
    }
  ]
} satisfies PricingDefinition;

const legacyRuntimeDefinition = {
    quantityLabel: "Instance",
    showGlobalQuantityControl: true,
    usesSharedBillingHeader: true,
    catalog: { route: "cce-pricing" },
    catalogViewExpression: `(() => {
      const activeCatalog = catalog ?? helpers.getFallbackCcePricingCatalog();
      const clusterScaleOptions = helpers.listCceClusterScales(activeCatalog);
      const clusterScale = clusterScaleOptions.includes(values.clusterScale) ? values.clusterScale : (clusterScaleOptions[0] ?? helpers.cceDefaults.scale);
      const masterNodeOptions = helpers.listCceMasterNodes(clusterScale, activeCatalog);
      const masterNodes = masterNodeOptions.includes(values.masterNodes) ? values.masterNodes : (masterNodeOptions[0] ?? helpers.cceDefaults.masterNodes);
      const estimate = helpers.estimateCceConfiguration(activeCatalog, {
        scale: clusterScale,
        masterNodes,
        billingMode: billingMode === 'Pay-per-use' ? 'Pay-per-use' : 'Yearly/Monthly',
        usageHours: billingMode === 'Pay-per-use' ? usageHoursValue : null,
      });
      return { activeCatalog, clusterScaleOptions, clusterScale, masterNodeOptions, masterNodes, estimate };
    })()`,
    syncValuesExpression: `({ clusterScale: catalogView.clusterScale, masterNodes: catalogView.masterNodes })`,
    fieldRuntime: {
      clusterScale: { optionsExpression: "helpers.optionList(catalogView.clusterScaleOptions)" },
      masterNodes: { optionsExpression: "helpers.optionList(catalogView.masterNodeOptions)" },
    },
    estimateExpression: "catalogView.estimate",
    selectionSummaryExpression: "catalogView.estimate ? `Selected specifications: ${catalogView.clusterScale} | ${catalogView.masterNodes} | ${helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix)}` : 'Selected specifications:'",
    referenceNoteExpression: "`Pricing sourced from Huawei Cloud CCE calculator API for ${catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Source: ${helpers.ccePricingReference.pricingUrl}`",
    buildRequestBodiesExpression: `catalogView.estimate ? ({
      serviceCode: selectedServiceCode,
      serviceName: selectedService,
      productType: 'cce',
      title: \`\${selectedService} \${catalogView.clusterScale} \${catalogView.masterNodes}\`,
      quantity: instanceCountValue,
      config: {
        region: regionValue,
        catalogRegionId: catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue),
        billingMode,
        clusterScale: catalogView.clusterScale,
        masterNodes: catalogView.masterNodes,
        usageHours: billingMode === 'Pay-per-use' ? usageHoursValue : null,
        resourceSpecCode: catalogView.estimate.tier.resourceSpecCode ?? null,
      },
      pricing: {
        total: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount * instanceCountValue, catalogView.estimate.suffix),
        estimate: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix),
      },
    }) : null`,
    hydrateExpression: `(() => {
      if (product.productType !== 'cce' || !helpers.isRecord(product.config)) {
        return { handled: false, error: 'This product cannot be edited from the calculator.' };
      }
      return {
        handled: true,
        values: {
          clusterScale: typeof product.config.clusterScale === 'string' ? product.config.clusterScale : helpers.cceDefaults.scale,
          masterNodes: product.config.masterNodes === 'Single' ? 'Single' : '3 Masters',
        },
        nextRegion: typeof product.config.region === 'string' ? product.config.region : regionValue,
        nextBillingMode: product.config.billingMode === 'Yearly/Monthly' ? 'Yearly/Monthly' : 'Pay-per-use',
        nextUsageHours: typeof product.config.usageHours === 'number' ? String(Math.max(1, Math.floor(product.config.usageHours))) : usageHours,
        nextInstanceCount: String(Math.max(1, product.quantity)),
      };
    })()`,
  } satisfies DeclarativeRuntimeDefinition;

export const configurableServiceBundle = {
  service: serviceDefinition,
  pricing: pricingDefinition,
  runtime: convertLegacyRuntimeDefinition(legacyRuntimeDefinition),
} as const satisfies ConfigurableServiceBundleDefinition;
