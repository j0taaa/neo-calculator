import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import type { DeclarativeRuntimeDefinition } from "@/lib/declarative-service-runtime-types";
import { convertLegacyRuntimeDefinition } from "@/lib/legacy-runtime-converter";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";

export const serviceDefinition = {
  "version": 1,
  "definitionId": "workspace",
  "serviceCode": "Workspace",
  "serviceName": "Workspace",
  "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/BusinessApplications/Workspace.png",
  "implementation": "configurable",
  "billingOptions": [
    "Pay-per-use"
  ],
  "defaults": {
    "architecture": "x86 desktop",
    "specification": "Basic",
    "cpu": "2 vCPUs",
    "memory": "4 GB",
    "cpuUsageHours": 744,
    "diskType": "High I/O",
    "diskSizeGb": 40,
    "diskUsageHours": 744,
    "quantity": 1
  },
  "fields": [
    {
      "id": "architecture",
      "type": "select",
      "label": "Architecture",
      "required": true,
      "options": [
        "x86 desktop"
      ]
    },
    {
      "id": "specification",
      "type": "select",
      "label": "Specifications",
      "required": true,
      "options": [
        "Ultimate"
      ]
    },
    {
      "id": "cpu",
      "type": "select",
      "label": "CPU",
      "required": true,
      "optionsSource": "catalog.cpuOptions"
    },
    {
      "id": "memory",
      "type": "select",
      "label": "Memory",
      "required": true,
      "optionsSource": "catalog.memoryOptions"
    },
    {
      "id": "cpuUsageHours",
      "type": "number",
      "label": "CPU usage duration",
      "required": true,
      "unit": "hours",
      "min": 1,
      "max": 87600,
      "step": 24
    },
    {
      "id": "diskType",
      "type": "select",
      "label": "System Disk Type",
      "required": true,
      "optionsSource": "catalog.diskTypes"
    },
    {
      "id": "diskSizeGb",
      "type": "number",
      "label": "System Disk Size",
      "required": true,
      "unit": "GB",
      "min": 80,
      "max": 32760,
      "step": 10
    },
    {
      "id": "diskUsageHours",
      "type": "number",
      "label": "Disk usage duration",
      "required": true,
      "unit": "hours",
      "min": 1,
      "max": 87600,
      "step": 24
    },
    {
      "id": "quantity",
      "type": "number",
      "label": "Quantity",
      "required": true,
      "unit": "PCS",
      "min": 1,
      "step": 1
    }
  ],
  "summary": {
    "selectionTemplate": "{architecture} | {specification} | {cpu} | {memory}",
    "notes": [
      "Workspace desktop pricing combines the selected desktop package and the system disk.",
      "The calculator models the system disk only. Up to 10 additional EVS disks can be attached separately."
    ]
  }
} satisfies ServiceDefinition;

export const pricingDefinition = {
  "version": 1,
  "definitionId": "workspace",
  "serviceCode": "Workspace",
  "serviceName": "Workspace",
  "catalogAdapter": "workspace",
  "rateSources": {
    "desktop": {
      "catalogKey": "desktopTiers.prices",
      "description": "Normalized Workspace desktop hourly rates from the productInfo catalog."
    },
    "systemDisk": {
      "catalogKey": "diskTiers.prices",
      "description": "Normalized Workspace system disk hourly rates from the productInfo catalog."
    }
  },
  "metrics": [
    {
      "id": "desktop",
      "label": "Desktop packages",
      "rateSource": "desktop",
      "quantity": {
        "source": "field",
        "field": "quantity"
      }
    },
    {
      "id": "systemDisk",
      "label": "System disk capacity",
      "rateSource": "systemDisk",
      "quantity": {
        "source": "field",
        "field": "diskSizeGb"
      },
      "unit": "GB"
    }
  ]
} satisfies PricingDefinition;

const legacyRuntimeDefinition = {
    quantityLabel: "Desktop",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "workspace-pricing" },
    showSharedUsageHoursExpression: "false",
    catalogViewExpression: `(() => {
      const cpuOptions = catalog ? helpers.listWorkspaceCpuOptions(catalog) : ['2 vCPUs', '4 vCPUs', '8 vCPUs'];
      const cpu = cpuOptions.includes(values.cpu) ? values.cpu : helpers.workspaceDefaults.cpu;
      const memoryOptions = catalog ? helpers.listWorkspaceMemoryOptions(catalog, cpu) : (cpu === '2 vCPUs' ? ['4 GB', '8 GB'] : cpu === '4 vCPUs' ? ['8 GB', '16 GB'] : ['16 GB', '32 GB']);
      const memory = memoryOptions.includes(values.memory) ? values.memory : (memoryOptions[0] ?? helpers.workspaceDefaults.memory);
      const diskTypeOptions = catalog ? helpers.listWorkspaceDiskTypes(catalog) : ['High I/O', 'Ultra-high I/O', 'General purpose SSD'];
      const diskType = diskTypeOptions.includes(values.diskType) ? values.diskType : helpers.workspaceDefaults.diskType;
      const cpuUsageHours = helpers.clampInteger(values.cpuUsageHours || 744, 1, 87600);
      const diskSizeGb = helpers.clampInteger(values.diskSizeGb || 80, 80, 32760);
      const diskUsageHours = helpers.clampInteger(values.diskUsageHours || 744, 1, 87600);
      const quantity = helpers.clampInteger(values.quantity || 1, 1);
      const estimate = catalog ? helpers.estimateWorkspaceConfiguration(catalog, { architecture: 'x86 desktop', specification: 'Ultimate', cpu, memory, cpuUsageHours, diskType, diskSizeGb, diskUsageHours, quantity }) : null;
      return { cpuOptions, cpu, memoryOptions, memory, diskTypeOptions, diskType, cpuUsageHours, diskSizeGb, diskUsageHours, quantity, estimate };
    })()`,
    syncValuesExpression: "({ architecture: 'x86 desktop', specification: 'Ultimate', cpu: catalogView.cpu, memory: catalogView.memory, cpuUsageHours: String(catalogView.cpuUsageHours), diskType: catalogView.diskType, diskSizeGb: String(catalogView.diskSizeGb), diskUsageHours: String(catalogView.diskUsageHours), quantity: String(catalogView.quantity) })",
    fieldRuntime: {
      architecture: { disabledExpression: "true" },
      specification: { disabledExpression: "true" },
      cpu: { optionsExpression: "helpers.optionList(catalogView.cpuOptions)" },
      memory: { optionsExpression: "helpers.optionList(catalogView.memoryOptions)" },
      diskType: { optionsExpression: "helpers.optionList(catalogView.diskTypeOptions)" },
      cpuUsageHours: { minExpression: "1", maxExpression: "87600", normalizeExpression: "helpers.clampInteger(values.cpuUsageHours || 744, 1, 87600)" },
      diskSizeGb: { minExpression: "80", maxExpression: "32760", normalizeExpression: "helpers.clampInteger(values.diskSizeGb || 80, 80, 32760)" },
      diskUsageHours: { minExpression: "1", maxExpression: "87600", normalizeExpression: "helpers.clampInteger(values.diskUsageHours || 744, 1, 87600)" },
      quantity: { minExpression: "1", normalizeExpression: "helpers.clampInteger(values.quantity || 1, 1)" },
    },
    estimateExpression: "catalogView.estimate",
    addToListErrorExpression: "catalogView.estimate ? null : (pricingError || 'Workspace pricing is unavailable for the current selection.')",
    selectionSummaryExpression: "`Selected specifications: x86 desktop | Ultimate | ${catalogView.cpu} | ${catalogView.memory} | ${catalogView.diskType} ${catalogView.diskSizeGb} GB | CPU ${catalogView.cpuUsageHours}h | Disk ${catalogView.diskUsageHours}h | ${catalogView.quantity} desktop${catalogView.quantity === 1 ? '' : 's'}${catalogView.estimate ? ` | ${helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix)}` : ''}`",
    selectionNotesExpression: "catalogView.estimate ? [...helpers.formatBreakdownNotes(catalogView.estimate.currency, catalogView.estimate.suffix, catalogView.estimate.breakdown), `Monthly average: ${helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.monthlyAverageAmount, '/mo')}.`, ...helpers.asArray(catalogView.estimate.notes)] : []",
    referenceNoteExpression: "`Pricing sourced from Huawei Cloud Workspace calculator API for ${catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Sources: ${helpers.workspacePricingReference.pricingUrl} and ${helpers.workspacePricingReference.productUrl}`",
    buildRequestBodiesExpression: `catalogView.estimate ? ({
      serviceCode: selectedServiceCode,
      serviceName: selectedService,
      productType: 'workspace',
      title: \`\${selectedService} \${catalogView.cpu} \${catalogView.memory}\`,
      quantity: 1,
      config: {
        region: regionValue,
        catalogRegionId: catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue),
        billingMode: 'Pay-per-use',
        architecture: 'x86 desktop',
        specification: 'Ultimate',
        cpu: catalogView.cpu,
        memory: catalogView.memory,
        cpuUsageHours: catalogView.cpuUsageHours,
        diskType: catalogView.diskType,
        diskSizeGb: catalogView.diskSizeGb,
        diskUsageHours: catalogView.diskUsageHours,
        quantity: catalogView.quantity,
        desktopResourceSpecCode: catalogView.estimate.desktopTier.resourceSpecCode,
        desktopProductId: catalogView.estimate.desktopTier.productIds.ONDEMAND ?? null,
        diskResourceSpecCode: catalogView.estimate.diskTier.resourceSpecCode,
        diskProductId: catalogView.estimate.diskTier.productIds.ONDEMAND ?? null,
      },
      pricing: {
        total: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix),
        estimate: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix),
        monthlyAverage: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.monthlyAverageAmount, '/mo'),
        breakdown: helpers.byLabelAmount(catalogView.estimate.currency, catalogView.estimate.suffix, catalogView.estimate.breakdown),
      },
    }) : null`,
    hydrateExpression: `(() => {
      if (product.productType !== 'workspace' || !helpers.isRecord(product.config)) {
        return { handled: false, error: 'This product cannot be edited from the calculator.' };
      }
      return {
        handled: true,
        values: {
          architecture: 'x86 desktop',
          specification: 'Ultimate',
          cpu: typeof product.config.cpu === 'string' ? product.config.cpu : helpers.workspaceDefaults.cpu,
          memory: typeof product.config.memory === 'string' ? product.config.memory : helpers.workspaceDefaults.memory,
          cpuUsageHours: typeof product.config.cpuUsageHours === 'number' ? String(Math.max(1, Math.floor(product.config.cpuUsageHours))) : String(helpers.workspaceDefaults.cpuUsageHours),
          diskType: typeof product.config.diskType === 'string' ? product.config.diskType : helpers.workspaceDefaults.diskType,
          diskSizeGb: typeof product.config.diskSizeGb === 'number' ? String(Math.max(80, Math.floor(product.config.diskSizeGb))) : String(helpers.workspaceDefaults.diskSizeGb),
          diskUsageHours: typeof product.config.diskUsageHours === 'number' ? String(Math.max(1, Math.floor(product.config.diskUsageHours))) : String(helpers.workspaceDefaults.diskUsageHours),
          quantity: typeof product.config.quantity === 'number' ? String(Math.max(1, Math.floor(product.config.quantity))) : String(helpers.workspaceDefaults.quantity),
        },
        nextRegion: typeof product.config.region === 'string' ? product.config.region : regionValue,
      };
    })()`,
  } satisfies DeclarativeRuntimeDefinition;

export const configurableServiceBundle = {
  service: serviceDefinition,
  pricing: pricingDefinition,
  runtime: convertLegacyRuntimeDefinition(legacyRuntimeDefinition),
} as const satisfies ConfigurableServiceBundleDefinition;
