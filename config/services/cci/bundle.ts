import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import type { DeclarativeRuntimeDefinition } from "@/lib/declarative-service-runtime-types";
import { convertLegacyRuntimeDefinition } from "@/lib/legacy-runtime-converter";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";

export const serviceDefinition = {
  "version": 1,
  "definitionId": "cci",
  "serviceCode": "CCI",
  "serviceName": "Cloud Container Instance",
  "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Containers/CCI.png",
  "implementation": "configurable",
  "billingOptions": [
    "Pay-per-use",
    "Yearly/Monthly"
  ],
  "defaults": {
    "cpu": 1,
    "memoryGiB": 1
  },
  "fields": [
    {
      "id": "cpu",
      "type": "number",
      "label": "CPU",
      "required": true,
      "unit": "vCPU",
      "min": 1,
      "step": 1
    },
    {
      "id": "memoryGiB",
      "type": "number",
      "label": "Memory",
      "required": true,
      "unit": "GiB",
      "min": 1,
      "step": 1
    }
  ],
  "summary": {
    "selectionTemplate": "{cpu} vCPU | {memoryGiB} GiB"
  }
} satisfies ServiceDefinition;

export const pricingDefinition = {
  "version": 1,
  "definitionId": "cci",
  "serviceCode": "CCI",
  "serviceName": "Cloud Container Instance",
  "catalogAdapter": "cci",
  "rateSources": {
    "cpu": {
      "catalogKey": "compute.cpuRate"
    },
    "memory": {
      "catalogKey": "compute.memoryRate"
    }
  },
  "metrics": [
    {
      "id": "cpu",
      "label": "CPU",
      "rateSource": "cpu",
      "quantity": {
        "source": "field",
        "field": "cpu"
      },
      "unit": "vCPU"
    },
    {
      "id": "memory",
      "label": "Memory",
      "rateSource": "memory",
      "quantity": {
        "source": "field",
        "field": "memoryGiB"
      },
      "unit": "GiB"
    }
  ]
} satisfies PricingDefinition;

const legacyRuntimeDefinition = {
    quantityLabel: "Instance",
    showGlobalQuantityControl: true,
    usesSharedBillingHeader: true,
    showSharedUsageHoursExpression: "true",
    fieldRuntime: {
      cpu: {
        minExpression: "1",
        normalizeExpression: "helpers.clampInteger(values.cpu || 1, 1)",
      },
      memoryGiB: {
        minExpression: "1",
        normalizeExpression: "helpers.clampInteger(values.memoryGiB || 1, 1)",
      },
    },
    selectionSummaryExpression: "`Selected specifications: ${helpers.clampInteger(values.cpu || 1, 1)} vCPU | ${helpers.clampInteger(values.memoryGiB || 1, 1)} GiB`",
    buildRequestBodiesExpression: `({
      serviceCode: selectedServiceCode,
      serviceName: selectedService,
      productType: 'cci',
      title: \`\${selectedService} \${helpers.clampInteger(values.cpu || 1, 1)} vCPU \${helpers.clampInteger(values.memoryGiB || 1, 1)} GiB\`,
      quantity: instanceCountValue,
      config: {
        region: regionValue,
        billingMode,
        cpu: helpers.clampInteger(values.cpu || 1, 1),
        memoryGiB: helpers.clampInteger(values.memoryGiB || 1, 1),
        usageHours: billingMode === 'Pay-per-use' ? usageHoursValue : null,
      },
      pricing: { total: 'USD 0.00' },
    })`,
    hydrateExpression: `(() => {
      if (product.productType !== 'cci' || !helpers.isRecord(product.config)) {
        return { handled: false, error: 'This product cannot be edited from the calculator.' };
      }
      return {
        handled: true,
        values: {
          cpu: typeof product.config.cpu === 'number' ? String(Math.max(1, Math.floor(product.config.cpu))) : '1',
          memoryGiB: typeof product.config.memoryGiB === 'number' ? String(Math.max(1, Math.floor(product.config.memoryGiB))) : '1',
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
