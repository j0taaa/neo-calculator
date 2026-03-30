import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import type { DeclarativeRuntimeDefinition } from "@/lib/declarative-service-runtime-types";
import { convertLegacyRuntimeDefinition } from "@/lib/legacy-runtime-converter";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";

export const serviceDefinition = {
  "version": 1,
  "definitionId": "evs",
  "serviceCode": "EVS",
  "serviceName": "Elastic Volume Service",
  "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Storage/EVS.png",
  "implementation": "config-pilot",
  "billingOptions": [
    "Pay-per-use",
    "Yearly/Monthly"
  ],
  "defaults": {
    "billingMode": "Pay-per-use",
    "diskType": "General Purpose SSD",
    "diskSizeGiB": 40,
    "usageHours": 744,
    "durationMonths": 1,
    "iops": 3000,
    "throughput": 125
  },
  "fields": [
    {
      "id": "billingMode",
      "type": "select",
      "label": "Billing",
      "required": true,
      "options": [
        "Pay-per-use",
        "Yearly/Monthly"
      ]
    },
    {
      "id": "diskType",
      "type": "select",
      "label": "Volume Type",
      "description": "Disk type list should eventually come from the normalized EVS catalog adapter.",
      "required": true,
      "optionsSource": "catalog.diskTypes"
    },
    {
      "id": "diskSizeGiB",
      "type": "number",
      "label": "Disk Size",
      "unit": "GiB",
      "required": true,
      "minSource": "catalog.constraints.minSizeGiB",
      "maxSource": "catalog.constraints.maxSizeGiB",
      "step": 1
    },
    {
      "id": "usageHours",
      "type": "number",
      "label": "Required Duration",
      "description": "Shown only for pay-per-use EVS selections.",
      "required": true,
      "unit": "hours",
      "min": 1,
      "step": 24,
      "visibleWhen": {
        "field": "billingMode",
        "equals": "Pay-per-use"
      }
    },
    {
      "id": "durationMonths",
      "type": "number",
      "label": "Required Duration",
      "description": "Shown only for yearly/monthly EVS selections.",
      "required": true,
      "unit": "months",
      "min": 1,
      "step": 1,
      "visibleWhen": {
        "field": "billingMode",
        "equals": "Yearly/Monthly"
      }
    },
    {
      "id": "iops",
      "type": "number",
      "label": "IOPS",
      "description": "Only applicable to General Purpose SSD V2.",
      "required": true,
      "minSource": "catalog.gpSsd2.iops.min",
      "maxSource": "catalog.gpSsd2.iops.max",
      "step": 1,
      "visibleWhenAll": [
        {
          "field": "billingMode",
          "equals": "Pay-per-use"
        },
        {
          "field": "diskType",
          "equals": "General Purpose SSD V2"
        }
      ]
    },
    {
      "id": "throughput",
      "type": "number",
      "label": "Throughput",
      "description": "Only applicable to General Purpose SSD V2.",
      "required": true,
      "unit": "MB/s",
      "minSource": "catalog.gpSsd2.throughput.min",
      "maxSource": "catalog.gpSsd2.throughput.max",
      "step": 1,
      "visibleWhenAll": [
        {
          "field": "billingMode",
          "equals": "Pay-per-use"
        },
        {
          "field": "diskType",
          "equals": "General Purpose SSD V2"
        }
      ]
    }
  ],
  "summary": {
    "selectionTemplate": "{diskType} {diskSizeGiB} GiB",
    "notes": [
      "Billing-specific duration inputs are modeled declaratively.",
      "GPSSD2 performance controls are modeled as conditional fields."
    ]
  },
  "batchAdd": {
    "supported": true,
    "example": [
      {
        "size": 40
      },
      {
        "type": "Ultra-high I/O",
        "size": 50000,
        "quantity": 2,
        "description": "Database disks"
      },
      {
        "type": "General Purpose SSD V2",
        "size": 800,
        "iops": 6000,
        "throughput": 250
      }
    ],
    "notes": [
      "Items above the single-disk limit can still be split by the existing EVS workflow.",
      "This JSON is a pilot definition only; the current EVS UI remains custom for now."
    ]
  }
} satisfies ServiceDefinition;

export const pricingDefinition = {
  "version": 1,
  "definitionId": "evs",
  "serviceCode": "EVS",
  "serviceName": "Elastic Volume Service",
  "catalogAdapter": "evs",
  "rateSources": {
    "diskBase": {
      "catalogKey": "disk.baseRate",
      "description": "Base storage rate resolved from the normalized EVS catalog by disk type and billing mode."
    },
    "gpSsd2Iops": {
      "catalogKey": "disk.gpSsd2.iopsRate",
      "description": "Placeholder for future GPSSD2 performance add-on pricing if exposed by the normalized adapter."
    },
    "gpSsd2Throughput": {
      "catalogKey": "disk.gpSsd2.throughputRate",
      "description": "Placeholder for future GPSSD2 throughput pricing if exposed by the normalized adapter."
    }
  },
  "metrics": [
    {
      "id": "diskStorage",
      "label": "Disk capacity",
      "rateSource": "diskBase",
      "quantity": {
        "source": "field",
        "field": "diskSizeGiB"
      },
      "unit": "GiB",
      "notes": [
        "The future pricing engine should multiply by hours or months according to the selected billing mode."
      ]
    },
    {
      "id": "gpSsd2Iops",
      "label": "GPSSD2 IOPS",
      "rateSource": "gpSsd2Iops",
      "quantity": {
        "source": "field",
        "field": "iops"
      },
      "unit": "IOPS",
      "enabledWhen": {
        "field": "diskType",
        "equals": "General Purpose SSD V2"
      }
    },
    {
      "id": "gpSsd2Throughput",
      "label": "GPSSD2 throughput",
      "rateSource": "gpSsd2Throughput",
      "quantity": {
        "source": "field",
        "field": "throughput"
      },
      "unit": "MB/s",
      "enabledWhen": {
        "field": "diskType",
        "equals": "General Purpose SSD V2"
      }
    }
  ]
} satisfies PricingDefinition;

const legacyRuntimeDefinition = {
    quantityLabel: "Volume",
    showGlobalQuantityControl: true,
    usesSharedBillingHeader: false,
    catalog: { route: "evs-pricing", loadingMessage: "Loading EVS pricing..." },
    showSharedUsageHoursExpression: "false",
    catalogViewExpression: `(() => {
      const diskType = helpers.systemDiskOptions.includes(values.diskType) ? values.diskType : 'General Purpose SSD';
      const evsBillingMode = values.billingMode === 'Yearly/Monthly' ? 'Yearly/Monthly' : 'Pay-per-use';
      const diskSizeGiB = Number.isFinite(Number(values.diskSizeGiB)) ? Math.max(helpers.evsDiskSizeBounds.min, Number(values.diskSizeGiB)) : helpers.evsDiskSizeBounds.min;
      const isGpSsd2Selected = diskType === 'General Purpose SSD V2';
      const gpSsd2IopsValue = isGpSsd2Selected ? helpers.normalizeGpSsd2Iops(values.iops, diskSizeGiB) : null;
      const gpSsd2IopsRange = isGpSsd2Selected ? helpers.getGpSsd2IopsBounds(diskSizeGiB) : null;
      const gpSsd2ThroughputValue = isGpSsd2Selected && gpSsd2IopsValue != null ? helpers.normalizeGpSsd2Throughput(values.throughput, gpSsd2IopsValue) : null;
      const gpSsd2ThroughputRange = isGpSsd2Selected && gpSsd2IopsValue != null ? helpers.getGpSsd2ThroughputBounds(gpSsd2IopsValue) : null;
      const durationMonths = Math.max(1, Math.floor(helpers.normalizeObsPositiveNumber(values.durationMonths, 1, 1)));
      const selectedDiskPrice = catalog ? helpers.getDiskPriceForBillingOption(catalog, diskType, diskSizeGiB, evsBillingMode, usageHoursValue, durationMonths) : null;
      return { diskType, evsBillingMode, diskSizeGiB, isGpSsd2Selected, gpSsd2IopsValue, gpSsd2IopsRange, gpSsd2ThroughputValue, gpSsd2ThroughputRange, durationMonths, selectedDiskPrice, splitNotice: helpers.buildEvsSplitNotice(diskSizeGiB) };
    })()`,
    syncValuesExpression: "({ billingMode: catalogView.evsBillingMode, diskType: catalogView.diskType, diskSizeGiB: String(catalogView.diskSizeGiB), usageHours: String(usageHoursValue), durationMonths: String(catalogView.durationMonths), iops: String(catalogView.gpSsd2IopsValue ?? 3000), throughput: String(catalogView.gpSsd2ThroughputValue ?? 125) })",
    fieldRuntime: {
      billingMode: { optionsExpression: "helpers.optionList(['Pay-per-use', 'Yearly/Monthly'])" },
      diskType: { optionsExpression: "helpers.optionList(helpers.systemDiskOptions)" },
      diskSizeGiB: { minExpression: "helpers.evsDiskSizeBounds.min", maxExpression: "helpers.evsDiskSizeBounds.max", normalizeExpression: "String(catalogView.diskSizeGiB)" },
      usageHours: { minExpression: "1", maxExpression: "87600", normalizeExpression: "String(Math.max(1, usageHoursValue))" },
      durationMonths: { minExpression: "1", normalizeExpression: "String(catalogView.durationMonths)" },
      iops: { minExpression: "catalogView.gpSsd2IopsRange?.min", maxExpression: "catalogView.gpSsd2IopsRange?.max", normalizeExpression: "catalogView.gpSsd2IopsValue == null ? values.iops : String(catalogView.gpSsd2IopsValue)" },
      throughput: { minExpression: "catalogView.gpSsd2ThroughputRange?.min", maxExpression: "catalogView.gpSsd2ThroughputRange?.max", normalizeExpression: "catalogView.gpSsd2ThroughputValue == null ? values.throughput : String(catalogView.gpSsd2ThroughputValue)" },
    },
    panelNotesExpression: "[(catalogView.isGpSsd2Selected ? 'Current estimate reflects capacity pricing only. Additional GPSSD2 IOPS and throughput charges are not modeled yet.' : null), `A single EVS disk can be up to 32768 GiB. Entering a larger total will save multiple disks: 32768 GiB chunks plus one final remainder disk.`, catalogView.splitNotice].filter(Boolean)",
    estimateExpression: "catalogView.selectedDiskPrice ? { currency: catalogView.selectedDiskPrice.currency, amount: catalogView.selectedDiskPrice.amount * instanceCountValue, suffix: catalogView.selectedDiskPrice.suffix, unitAmount: catalogView.selectedDiskPrice.amount } : null",
    addToListErrorExpression: "catalogView.selectedDiskPrice ? null : 'Select a volume type first.'",
    selectionSummaryExpression: "catalogView.selectedDiskPrice ? `Selected specifications: ${catalogView.diskType} | ${catalogView.diskSizeGiB} GiB | ${catalogView.evsBillingMode === 'Pay-per-use' ? `${usageHoursValue}h` : `${catalogView.durationMonths}mo`}${catalogView.isGpSsd2Selected && catalogView.gpSsd2IopsValue != null && catalogView.gpSsd2ThroughputValue != null ? ` | ${catalogView.gpSsd2IopsValue} IOPS | ${catalogView.gpSsd2ThroughputValue} MB/s` : ''} | Disk ${helpers.formatFlavorAmount(catalogView.selectedDiskPrice.currency, catalogView.selectedDiskPrice.amount, catalogView.selectedDiskPrice.suffix)}` : 'Selected specifications:'",
    selectionNotesExpression: "catalogView.splitNotice ? [catalogView.splitNotice] : []",
    addSuccessMessageExpression: "requestBodiesCount > 1 ? `Added ${requestBodiesCount} EVS disks to the list because totals above 32768 GiB are split into 32768 GiB chunks plus a final remainder disk.` : 'Product added to list.'",
    updateSuccessMessageExpression: "extraRequestBodiesCount > 0 ? `Product updated and split into ${requestBodiesCount} EVS disks because totals above 32768 GiB are saved in chunks.` : 'Product updated.'",
    batchSuccessMessageExpression: "expandedCount > 0 ? `Added ${createdCount} products to the list. ${expandedCount} extra EVS split disk${expandedCount === 1 ? '' : 's'} were created for sizes above 32768 GiB.` : (createdCount === 1 ? 'Added 1 product to the list.' : `Added ${createdCount} products to the list.`)",
    buildRequestBodiesExpression: `catalogView.selectedDiskPrice ? helpers.buildEvsProductMutationBodies({
      serviceCode: selectedServiceCode,
      serviceName: selectedService,
      serviceTitle: selectedService,
      region: regionValue,
      billingMode,
      usageHours: usageHoursValue,
      durationMonths: catalogView.durationMonths,
      quantity: Math.max(1, instanceCountValue),
      description: selectedService,
      diskType: catalogView.diskType,
      diskSizeGiB: catalogView.diskSizeGiB,
      requestedIops: catalogView.isGpSsd2Selected ? catalogView.gpSsd2IopsValue : null,
      requestedThroughput: catalogView.isGpSsd2Selected ? catalogView.gpSsd2ThroughputValue : null,
      diskPricing: catalog,
    }) : null`,
    batchPanel: {
      placeholderExpression: "`[\\n  {\\n    \\\"size\\\": 40\\n  },\\n  {\\n    \\\"type\\\": \\\"Ultra-high I/O\\\",\\n    \\\"size\\\": 50000,\\n    \\\"durationMonths\\\": 6,\\n    \\\"quantity\\\": 2,\\n    \\\"description\\\": \\\"Database disks\\\"\\n  },\\n  {\\n    \\\"type\\\": \\\"General Purpose SSD V2\\\",\\n    \\\"size\\\": 800,\\n    \\\"iops\\\": 6000,\\n    \\\"throughput\\\": 250\\n  }\\n]`",
      descriptionExpression: "`Paste a JSON array of EVS volumes. Optional fields: type, size, durationMonths, quantity, description, iops, and throughput.`",
      defaultsExpression: "`If omitted, type defaults to ${catalogView.diskType} and size defaults to ${catalogView.diskSizeGiB} GiB. When using yearly/monthly EVS, durationMonths falls back to the active calculator value. Sizes above 32768 are split into multiple disks when saved. For General Purpose SSD V2, omitted iops and throughput use the minimum valid values.`",
      validationExpression: "`Each JSON item should resolve to a valid EVS disk type. When size is above 32768 GiB, it is saved as multiple disks: 32768 GiB chunks plus one final remainder disk. General Purpose SSD V2 accepts configurable iops and throughput values.`",
    },
    buildBatchRequestBodiesExpression: `(() => {
      const quantity = helpers.parseBatchQuantity(helpers.isRecord(item) ? item.quantity : undefined);
      const description = helpers.getBatchDescription(item, selectedService);
      const diskType = helpers.getBatchDiskType(item, catalogView.diskType);
      const diskSizeGiB = helpers.getBatchDiskSize(item, catalogView.diskSizeGiB, helpers.evsDiskSizeBounds);
      const rawDurationMonths = helpers.getNestedRecord(item, 'evs')?.durationMonths ?? helpers.getNestedRecord(item, 'evs')?.months ?? (helpers.isRecord(item) ? item.durationMonths : undefined) ?? (helpers.isRecord(item) ? item.months : undefined);
      const durationMonths = billingMode === 'Yearly/Monthly' ? Math.max(1, Math.floor(helpers.normalizeObsPositiveNumber(rawDurationMonths, catalogView.durationMonths, 1))) : catalogView.durationMonths;
      const requestedIops = diskType === 'General Purpose SSD V2' ? helpers.getGpSsd2RequestedIops(item, diskSizeGiB) : null;
      const requestedThroughput = diskType === 'General Purpose SSD V2' && requestedIops != null ? helpers.getGpSsd2RequestedThroughput(item, requestedIops) : null;
      return helpers.buildEvsProductMutationBodies({
        serviceCode: selectedServiceCode,
        serviceName: selectedService,
        serviceTitle: selectedService,
        region: regionValue,
        billingMode,
        usageHours: usageHoursValue,
        durationMonths,
        quantity,
        description,
        diskType,
        diskSizeGiB,
        requestedIops,
        requestedThroughput,
        diskPricing: catalog,
      });
    })()`,
    hydrateExpression: `(() => {
      if (product.productType !== 'evs' || !helpers.isRecord(product.config)) {
        return { handled: false, error: 'This product cannot be edited from the calculator.' };
      }
      const systemDisk = helpers.isRecord(product.config.systemDisk) ? product.config.systemDisk : null;
      const diskSize = typeof product.config.diskSizeGiB === 'number' ? product.config.diskSizeGiB : (typeof systemDisk?.sizeGiB === 'number' ? systemDisk.sizeGiB : helpers.evsDiskSizeBounds.min);
      return {
        handled: true,
        values: {
          billingMode: product.config.billingMode === 'Yearly/Monthly' ? 'Yearly/Monthly' : 'Pay-per-use',
          diskType: helpers.systemDiskOptions.includes(product.config.diskType) ? product.config.diskType : (helpers.systemDiskOptions.includes(systemDisk?.type) ? systemDisk.type : 'High I/O'),
          diskSizeGiB: String(Math.max(helpers.evsDiskSizeBounds.min, Math.floor(diskSize))),
          usageHours: typeof product.config.usageHours === 'number' ? String(Math.max(1, Math.floor(product.config.usageHours))) : '744',
          durationMonths: typeof product.config.durationMonths === 'number' ? String(Math.max(1, Math.floor(product.config.durationMonths))) : '1',
          iops: String(helpers.getGpSsd2RequestedIops(product.config, diskSize)),
          throughput: String(helpers.getGpSsd2RequestedThroughput(product.config, helpers.getGpSsd2RequestedIops(product.config, diskSize))),
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
