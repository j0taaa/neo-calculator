import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import type { DeclarativeRuntimeDefinition } from "@/lib/declarative-service-runtime-types";
import { convertLegacyRuntimeDefinition } from "@/lib/legacy-runtime-converter";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";

export const serviceDefinition = {
  "version": 1,
  "definitionId": "obs",
  "serviceCode": "OBS",
  "serviceName": "Object Storage Service",
  "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Storage/OBS.png",
  "implementation": "configurable",
  "billingOptions": [
    "Pay-per-use"
  ],
  "defaults": {
    "productType": "Object storage",
    "storageClass": "Standard",
    "redundancy": "Single-AZ storage",
    "storageAmount": 100,
    "storageUnit": "GB",
    "durationMonths": 1,
    "outboundTrafficAmount": 0,
    "outboundTrafficUnit": "GB",
    "readRequests": 0,
    "writeRequests": 0,
    "deleteRequests": 0,
    "pullTrafficAmount": 0,
    "pullTrafficUnit": "GB",
    "restorationType": null,
    "readTrafficAmount": 0,
    "readTrafficUnit": "GB",
    "replicationTrafficAmount": 0,
    "replicationTrafficUnit": "GB",
    "lifecycleTransitionRequests": 0
  },
  "fields": [
    {
      "id": "productType",
      "type": "select",
      "label": "Product Type",
      "required": true,
      "optionsSource": "catalog.productTypes"
    },
    {
      "id": "storageClass",
      "type": "select",
      "label": "Storage Class",
      "required": true,
      "optionsSource": "catalog.storageClasses"
    },
    {
      "id": "redundancy",
      "type": "select",
      "label": "Data Redundancy Policy",
      "required": true,
      "optionsSource": "catalog.redundancies"
    },
    {
      "id": "storageAmount",
      "type": "number",
      "label": "Storage Space",
      "required": true,
      "inputMode": "decimal",
      "minSource": "catalog.storage.min",
      "maxSource": "catalog.storage.max"
    },
    {
      "id": "storageUnit",
      "type": "select",
      "label": "Storage Unit",
      "required": true,
      "options": [
        "GB",
        "TB",
        "PB"
      ]
    },
    {
      "id": "durationMonths",
      "type": "number",
      "label": "Storage Duration",
      "required": true,
      "unit": "months",
      "min": 1,
      "step": 1
    },
    {
      "id": "outboundTrafficAmount",
      "type": "number",
      "label": "Internet Outbound Traffic",
      "required": true,
      "inputMode": "decimal",
      "min": 0
    },
    {
      "id": "outboundTrafficUnit",
      "type": "select",
      "label": "Outbound Traffic Unit",
      "required": true,
      "options": [
        "GB",
        "TB",
        "PB"
      ]
    },
    {
      "id": "pullTrafficAmount",
      "type": "number",
      "label": "Pull Traffic",
      "required": true,
      "inputMode": "decimal",
      "min": 0,
      "visibleWhen": {
        "field": "productType",
        "equals": "Object storage"
      }
    },
    {
      "id": "pullTrafficUnit",
      "type": "select",
      "label": "Pull Traffic Unit",
      "required": true,
      "options": [
        "GB",
        "TB",
        "PB"
      ],
      "visibleWhen": {
        "field": "productType",
        "equals": "Object storage"
      }
    },
    {
      "id": "restorationType",
      "type": "select",
      "label": "Restoration Type",
      "required": true,
      "optionsSource": "catalog.restorationTypes",
      "visibleWhen": {
        "field": "showRestorationFields",
        "equals": true
      }
    },
    {
      "id": "readTrafficAmount",
      "type": "number",
      "label": "Read Traffic",
      "required": true,
      "inputMode": "decimal",
      "min": 0,
      "visibleWhen": {
        "field": "showRestorationFields",
        "equals": true
      }
    },
    {
      "id": "readTrafficUnit",
      "type": "select",
      "label": "Read Traffic Unit",
      "required": true,
      "options": [
        "GB",
        "TB",
        "PB"
      ],
      "visibleWhen": {
        "field": "showRestorationFields",
        "equals": true
      }
    },
    {
      "id": "lifecycleTransitionRequests",
      "type": "number",
      "label": "Lifecycle Transition Requests",
      "required": true,
      "min": 0,
      "visibleWhen": {
        "field": "showRestorationFields",
        "equals": true
      }
    },
    {
      "id": "replicationTrafficAmount",
      "type": "number",
      "label": "Cross-region Replication Traffic",
      "required": true,
      "inputMode": "decimal",
      "min": 0,
      "visibleWhen": {
        "field": "showReplicationTraffic",
        "equals": true
      }
    },
    {
      "id": "replicationTrafficUnit",
      "type": "select",
      "label": "Replication Traffic Unit",
      "required": true,
      "options": [
        "GB",
        "TB",
        "PB"
      ],
      "visibleWhen": {
        "field": "showReplicationTraffic",
        "equals": true
      }
    },
    {
      "id": "readRequests",
      "type": "number",
      "label": "Read Requests",
      "required": true,
      "inputMode": "decimal",
      "min": 0
    },
    {
      "id": "writeRequests",
      "type": "number",
      "label": "Write Requests",
      "required": true,
      "inputMode": "decimal",
      "min": 0
    },
    {
      "id": "deleteRequests",
      "type": "number",
      "label": "Delete Requests",
      "required": true,
      "inputMode": "decimal",
      "min": 0
    }
  ],
  "summary": {
    "selectionTemplate": "{productType} | {storageClass} | {storageAmount} {storageUnit}",
    "notes": [
      "Request counters are entered in blocks of 10,000 requests to match the current calculator workflow."
    ]
  },
  "batchAdd": {
    "supported": true
  }
} satisfies ServiceDefinition;

export const pricingDefinition = {
  "version": 1,
  "definitionId": "obs",
  "serviceCode": "OBS",
  "serviceName": "Object Storage Service",
  "catalogAdapter": "obs",
  "rateSources": {
    "storage": {
      "catalogKey": "storage.rate"
    },
    "outbound": {
      "catalogKey": "traffic.outboundRate"
    },
    "requestRead": {
      "catalogKey": "requests.readRate"
    },
    "requestWrite": {
      "catalogKey": "requests.writeRate"
    },
    "requestDelete": {
      "catalogKey": "requests.deleteRate"
    },
    "pullTraffic": {
      "catalogKey": "traffic.pullRate"
    },
    "readTraffic": {
      "catalogKey": "traffic.readRate"
    },
    "replicationTraffic": {
      "catalogKey": "traffic.replicationRate"
    },
    "lifecycleTransition": {
      "catalogKey": "requests.lifecycleTransitionRate"
    }
  },
  "metrics": [
    {
      "id": "storage",
      "label": "Storage",
      "rateSource": "storage",
      "quantity": {
        "source": "field",
        "field": "storageAmount"
      }
    },
    {
      "id": "outboundTraffic",
      "label": "Outbound traffic",
      "rateSource": "outbound",
      "quantity": {
        "source": "field",
        "field": "outboundTrafficAmount"
      }
    },
    {
      "id": "readRequests",
      "label": "Read requests",
      "rateSource": "requestRead",
      "quantity": {
        "source": "field",
        "field": "readRequests"
      }
    },
    {
      "id": "writeRequests",
      "label": "Write requests",
      "rateSource": "requestWrite",
      "quantity": {
        "source": "field",
        "field": "writeRequests"
      }
    },
    {
      "id": "deleteRequests",
      "label": "Delete requests",
      "rateSource": "requestDelete",
      "quantity": {
        "source": "field",
        "field": "deleteRequests"
      }
    },
    {
      "id": "pullTraffic",
      "label": "Pull traffic",
      "rateSource": "pullTraffic",
      "quantity": {
        "source": "field",
        "field": "pullTrafficAmount"
      },
      "enabledWhen": {
        "field": "productType",
        "equals": "Object storage"
      }
    },
    {
      "id": "readTraffic",
      "label": "Read traffic",
      "rateSource": "readTraffic",
      "quantity": {
        "source": "field",
        "field": "readTrafficAmount"
      },
      "enabledWhen": {
        "field": "showRestorationFields",
        "equals": true
      }
    },
    {
      "id": "replicationTraffic",
      "label": "Replication traffic",
      "rateSource": "replicationTraffic",
      "quantity": {
        "source": "field",
        "field": "replicationTrafficAmount"
      },
      "enabledWhen": {
        "field": "showReplicationTraffic",
        "equals": true
      }
    },
    {
      "id": "lifecycleTransitionRequests",
      "label": "Lifecycle transition requests",
      "rateSource": "lifecycleTransition",
      "quantity": {
        "source": "field",
        "field": "lifecycleTransitionRequests"
      },
      "enabledWhen": {
        "field": "showRestorationFields",
        "equals": true
      }
    }
  ]
} satisfies PricingDefinition;

const legacyRuntimeDefinition = {
    quantityLabel: "Bucket",
    showGlobalQuantityControl: true,
    usesSharedBillingHeader: true,
    catalog: { route: "obs-pricing" },
    showSharedUsageHoursExpression: "false",
    catalogViewExpression: `(() => {
      const productTypeOptions = catalog ? helpers.listObsProductTypes(catalog) : ['Object storage', 'Parallel file system'];
      const productType = productTypeOptions.includes(values.productType) ? values.productType : 'Object storage';
      const storageClassOptions = catalog ? helpers.listObsStorageClasses(catalog, productType) : helpers.getObsStorageClassOptions(productType);
      const storageClass = storageClassOptions.includes(values.storageClass) ? values.storageClass : (storageClassOptions[0] ?? 'Standard');
      const redundancyOptions = catalog ? helpers.listObsRedundancies(catalog, productType, storageClass) : helpers.getObsRedundancyOptions(productType, storageClass);
      const redundancy = redundancyOptions.includes(values.redundancy) ? values.redundancy : (redundancyOptions[0] ?? 'Single-AZ storage');
      const restorationTypeOptions = helpers.listObsRestorationTypes(storageClass);
      const restorationType = restorationTypeOptions.includes(values.restorationType) ? values.restorationType : (restorationTypeOptions[0] ?? null);
      const showReplicationTraffic = productType === 'Object storage' && (storageClass === 'Standard' || storageClass === 'Infrequent Access');
      const showPullTraffic = helpers.shouldShowObsPullTraffic(productType);
      const storageAmount = helpers.normalizeObsPositiveNumber(values.storageAmount, helpers.obsStorageSizeBounds.min, helpers.obsStorageSizeBounds.min);
      const storageUnit = ['GB', 'TB', 'PB'].includes(values.storageUnit) ? values.storageUnit : 'GB';
      const durationMonths = Math.max(1, Math.floor(helpers.normalizeObsPositiveNumber(values.durationMonths, 1, 1)));
      const outboundTrafficAmount = helpers.normalizeObsPositiveNumber(values.outboundTrafficAmount, 0, 0);
      const outboundTrafficUnit = ['GB', 'TB', 'PB'].includes(values.outboundTrafficUnit) ? values.outboundTrafficUnit : 'GB';
      const readRequests = helpers.normalizeObsPositiveNumber(values.readRequests, 0, 0);
      const writeRequests = helpers.normalizeObsPositiveNumber(values.writeRequests, 0, 0);
      const deleteRequests = helpers.normalizeObsPositiveNumber(values.deleteRequests, 0, 0);
      const pullTrafficAmount = helpers.normalizeObsPositiveNumber(values.pullTrafficAmount, 0, 0);
      const pullTrafficUnit = ['GB', 'TB', 'PB'].includes(values.pullTrafficUnit) ? values.pullTrafficUnit : 'GB';
      const readTrafficAmount = helpers.normalizeObsPositiveNumber(values.readTrafficAmount, 0, 0);
      const readTrafficUnit = ['GB', 'TB', 'PB'].includes(values.readTrafficUnit) ? values.readTrafficUnit : 'GB';
      const replicationTrafficAmount = helpers.normalizeObsPositiveNumber(values.replicationTrafficAmount, 0, 0);
      const replicationTrafficUnit = ['GB', 'TB', 'PB'].includes(values.replicationTrafficUnit) ? values.replicationTrafficUnit : 'GB';
      const lifecycleTransitionRequests = helpers.normalizeObsPositiveNumber(values.lifecycleTransitionRequests, 0, 0);
      const estimate = catalog ? helpers.estimateObsConfiguration(catalog, {
        productType, storageClass, redundancy, storageAmount, storageUnit, durationMonths,
        outboundTrafficAmount, outboundTrafficUnit,
        readRequests: helpers.convertObsRequestInputToCount(readRequests),
        writeRequests: helpers.convertObsRequestInputToCount(writeRequests),
        deleteRequests: helpers.convertObsRequestInputToCount(deleteRequests),
        pullTrafficAmount: showPullTraffic ? pullTrafficAmount : 0,
        pullTrafficUnit,
        restorationType,
        readTrafficAmount,
        readTrafficUnit,
        replicationTrafficAmount: showReplicationTraffic ? replicationTrafficAmount : 0,
        replicationTrafficUnit,
        lifecycleTransitionRequests: helpers.convertObsRequestInputToCount(lifecycleTransitionRequests),
      }) : null;
      return { productTypeOptions, productType, storageClassOptions, storageClass, redundancyOptions, redundancy, restorationTypeOptions, restorationType, showReplicationTraffic, showPullTraffic, storageAmount, storageUnit, durationMonths, outboundTrafficAmount, outboundTrafficUnit, readRequests, writeRequests, deleteRequests, pullTrafficAmount, pullTrafficUnit, readTrafficAmount, readTrafficUnit, replicationTrafficAmount, replicationTrafficUnit, lifecycleTransitionRequests, estimate };
    })()`,
    syncValuesExpression: "({ productType: catalogView.productType, storageClass: catalogView.storageClass, redundancy: catalogView.redundancy, storageAmount: String(catalogView.storageAmount), storageUnit: catalogView.storageUnit, durationMonths: String(catalogView.durationMonths), outboundTrafficAmount: String(catalogView.outboundTrafficAmount), outboundTrafficUnit: catalogView.outboundTrafficUnit, readRequests: String(catalogView.readRequests), writeRequests: String(catalogView.writeRequests), deleteRequests: String(catalogView.deleteRequests), pullTrafficAmount: String(catalogView.pullTrafficAmount), pullTrafficUnit: catalogView.pullTrafficUnit, restorationType: catalogView.restorationType ?? '', readTrafficAmount: String(catalogView.readTrafficAmount), readTrafficUnit: catalogView.readTrafficUnit, replicationTrafficAmount: String(catalogView.replicationTrafficAmount), replicationTrafficUnit: catalogView.replicationTrafficUnit, lifecycleTransitionRequests: String(catalogView.lifecycleTransitionRequests) })",
    visibilityContextExpression: "({ showRestorationFields: catalogView.restorationTypeOptions.length > 0, showReplicationTraffic: catalogView.showReplicationTraffic })",
    fieldRuntime: {
      productType: { optionsExpression: "helpers.optionList(catalogView.productTypeOptions)" },
      storageClass: { optionsExpression: "helpers.optionList(catalogView.storageClassOptions)" },
      redundancy: { optionsExpression: "helpers.optionList(catalogView.redundancyOptions)" },
      storageAmount: { minExpression: "helpers.obsStorageSizeBounds.min", maxExpression: "helpers.obsStorageSizeBounds.max", normalizeExpression: "String(catalogView.storageAmount)" },
      restorationType: { optionsExpression: "helpers.optionList(catalogView.restorationTypeOptions)" },
    },
    estimateExpression: "catalogView.estimate ? { currency: catalogView.estimate.currency, amount: catalogView.estimate.amount * instanceCountValue, suffix: catalogView.estimate.suffix, unitAmount: catalogView.estimate.amount, monthlyAverageAmount: catalogView.estimate.monthlyAverageAmount, breakdown: catalogView.estimate.breakdown, notes: catalogView.estimate.notes, variant: catalogView.estimate.variant } : null",
    addToListErrorExpression: "catalogView.estimate ? null : (pricingError || 'Select an OBS storage class first.')",
    selectionSummaryExpression: "catalogView.estimate ? `Selected specifications: ${catalogView.productType} | ${catalogView.storageClass} | ${catalogView.redundancy}${catalogView.restorationType ? ` | ${catalogView.restorationType}` : ''} | ${catalogView.storageAmount} ${catalogView.storageUnit}${catalogView.readTrafficAmount > 0 ? ` | Read ${catalogView.readTrafficAmount} ${catalogView.readTrafficUnit}` : ''} | ${catalogView.durationMonths}mo | ${helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix)}` : 'Selected specifications:'",
    selectionNotesExpression: "catalogView.estimate ? [...helpers.formatBreakdownNotes(catalogView.estimate.currency, catalogView.estimate.suffix, catalogView.estimate.breakdown), ...helpers.asArray(catalogView.estimate.notes)] : []",
    referenceNoteExpression: "`Pricing sourced from Huawei Cloud OBS calculator API for ${catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Sources: ${helpers.obsPricingReference.productUrl}, ${helpers.obsPricingReference.billingUrl}, and ${helpers.obsPricingReference.packageOverviewUrl}`",
    buildRequestBodiesExpression: `catalogView.estimate ? ({
      serviceCode: selectedServiceCode,
      serviceName: selectedService,
      productType: 'obs',
      title: \`\${selectedService} \${catalogView.productType} \${catalogView.storageClass} \${catalogView.storageAmount} \${catalogView.storageUnit}\`,
      quantity: Math.max(1, instanceCountValue),
      config: {
        region: regionValue,
        catalogRegionId: catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue),
        billingMode: 'Pay-per-use',
        description: selectedService,
        productType: catalogView.productType,
        storageClass: catalogView.storageClass,
        redundancy: catalogView.redundancy,
        storageAmount: catalogView.storageAmount,
        storageUnit: catalogView.storageUnit,
        storageGiB: helpers.convertObsCapacityToGb(catalogView.storageAmount, catalogView.storageUnit),
        durationMonths: catalogView.durationMonths,
        outboundTrafficAmount: catalogView.outboundTrafficAmount,
        outboundTrafficUnit: catalogView.outboundTrafficUnit,
        readRequests: helpers.convertObsRequestInputToCount(catalogView.readRequests),
        writeRequests: helpers.convertObsRequestInputToCount(catalogView.writeRequests),
        deleteRequests: helpers.convertObsRequestInputToCount(catalogView.deleteRequests),
        pullTrafficAmount: catalogView.showPullTraffic ? catalogView.pullTrafficAmount : 0,
        pullTrafficUnit: catalogView.pullTrafficUnit,
        restorationType: catalogView.restorationType,
        readTrafficAmount: catalogView.readTrafficAmount,
        readTrafficUnit: catalogView.readTrafficUnit,
        replicationTrafficAmount: catalogView.showReplicationTraffic ? catalogView.replicationTrafficAmount : 0,
        replicationTrafficUnit: catalogView.replicationTrafficUnit,
        lifecycleTransitionRequests: helpers.convertObsRequestInputToCount(catalogView.lifecycleTransitionRequests),
        minimumStorageDays: catalogView.estimate.variant.minimumStorageDays,
      },
      pricing: {
        total: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount * Math.max(1, instanceCountValue), catalogView.estimate.suffix),
        estimate: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix),
        monthlyAverage: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.monthlyAverageAmount, '/mo'),
        breakdown: helpers.byLabelAmount(catalogView.estimate.currency, catalogView.estimate.suffix, catalogView.estimate.breakdown),
      },
    }) : null`,
    batchPanel: {
      placeholderExpression: "`[\\n  {\\n    \\\"size\\\": 500\\n  },\\n  {\\n    \\\"productType\\\": \\\"Object storage\\\",\\n    \\\"storageClass\\\": \\\"Archive\\\",\\n    \\\"redundancy\\\": \\\"Single-AZ storage\\\",\\n    \\\"size\\\": 2,\\n    \\\"sizeUnit\\\": \\\"TB\\\",\\n    \\\"durationMonths\\\": 3,\\n    \\\"outboundTraffic\\\": 120,\\n    \\\"readRequests\\\": 50,\\n    \\\"writeRequests\\\": 8,\\n    \\\"deleteRequests\\\": 1,\\n    \\\"pullTraffic\\\": 50,\\n    \\\"replicationTraffic\\\": 20,\\n    \\\"quantity\\\": 2,\\n    \\\"description\\\": \\\"Media archive\\\"\\n  }\\n]`",
      descriptionExpression: "`Paste a JSON array of OBS items. Required field: size. Optional fields: productType, storageClass, redundancy, sizeUnit, durationMonths, outboundTraffic, readRequests, writeRequests, deleteRequests, pullTraffic, replicationTraffic, quantity, and description. Request fields use units of 10,000, so 2 means 20,000 requests.`",
      defaultsExpression: "`If omitted, productType defaults to ${catalogView.productType}, storageClass defaults to ${catalogView.storageClass}, redundancy defaults to ${catalogView.redundancy}, size defaults to ${catalogView.storageAmount}, sizeUnit defaults to ${catalogView.storageUnit}, and durationMonths defaults to ${catalogView.durationMonths}.`",
      validationExpression: "`Each JSON item should include a positive storage size. When present, productType, storageClass, redundancy, and all unit fields should match the available OBS options for the selected region. Unsupported combinations fail item-by-item.`",
    },
    buildBatchRequestBodiesExpression: `(() => {
      if (!catalog) {
        return null;
      }
      const productType = helpers.getBatchObsProductType(item, catalogView.productType);
      const storageClass = helpers.getBatchObsStorageClass(item, catalogView.storageClass);
      const redundancy = helpers.getBatchObsRedundancy(item, catalogView.redundancy);
      const storageAmount = helpers.getBatchObsStorageSize(item, catalogView.storageAmount);
      const storageUnit = helpers.getBatchObsUnit(item, catalogView.storageUnit, ['sizeUnit', 'storageUnit']);
      const durationMonths = Math.max(1, Math.floor(helpers.getBatchObsAmount(item, catalogView.durationMonths, ['durationMonths', 'months'])));
      const outboundTrafficAmount = helpers.getBatchObsAmount(item, catalogView.outboundTrafficAmount, ['outboundTraffic', 'outboundTrafficAmount']);
      const outboundTrafficUnit = helpers.getBatchObsUnit(item, catalogView.outboundTrafficUnit, ['outboundTrafficUnit']);
      const readRequests = helpers.getBatchObsAmount(item, catalogView.readRequests, ['readRequests']);
      const writeRequests = helpers.getBatchObsAmount(item, catalogView.writeRequests, ['writeRequests']);
      const deleteRequests = helpers.getBatchObsAmount(item, catalogView.deleteRequests, ['deleteRequests']);
      const pullTrafficAmount = helpers.getBatchObsAmount(item, catalogView.pullTrafficAmount, ['pullTraffic', 'pullTrafficAmount']);
      const pullTrafficUnit = helpers.getBatchObsUnit(item, catalogView.pullTrafficUnit, ['pullTrafficUnit']);
      const replicationTrafficAmount = helpers.getBatchObsAmount(item, catalogView.replicationTrafficAmount, ['replicationTraffic', 'replicationTrafficAmount']);
      const replicationTrafficUnit = helpers.getBatchObsUnit(item, catalogView.replicationTrafficUnit, ['replicationTrafficUnit']);
      const quantity = helpers.parseBatchQuantity(helpers.isRecord(item) ? item.quantity : undefined);
      const description = helpers.getBatchDescription(item, selectedService);
      const estimate = helpers.estimateObsConfiguration(catalog, {
        productType, storageClass, redundancy, storageAmount, storageUnit, durationMonths,
        outboundTrafficAmount, outboundTrafficUnit,
        readRequests: helpers.convertObsRequestInputToCount(readRequests),
        writeRequests: helpers.convertObsRequestInputToCount(writeRequests),
        deleteRequests: helpers.convertObsRequestInputToCount(deleteRequests),
        pullTrafficAmount: productType === 'Object storage' ? pullTrafficAmount : 0,
        pullTrafficUnit,
        restorationType: null,
        readTrafficAmount: 0,
        readTrafficUnit: 'GB',
        replicationTrafficAmount: (productType === 'Object storage' && (storageClass === 'Standard' || storageClass === 'Infrequent Access')) ? replicationTrafficAmount : 0,
        replicationTrafficUnit,
        lifecycleTransitionRequests: 0,
      });
      if (!estimate) {
        return null;
      }
      return [{
        serviceCode: selectedServiceCode,
        serviceName: selectedService,
        productType: 'obs',
        title: \`\${selectedService} \${productType} \${storageClass} \${storageAmount} \${storageUnit}\`,
        quantity,
        config: {
          region: regionValue,
          catalogRegionId: catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue),
          billingMode: 'Pay-per-use',
          description,
          productType,
          storageClass,
          redundancy,
          storageAmount,
          storageUnit,
          storageGiB: helpers.convertObsCapacityToGb(storageAmount, storageUnit),
          durationMonths,
          outboundTrafficAmount,
          outboundTrafficUnit,
          readRequests: helpers.convertObsRequestInputToCount(readRequests),
          writeRequests: helpers.convertObsRequestInputToCount(writeRequests),
          deleteRequests: helpers.convertObsRequestInputToCount(deleteRequests),
          pullTrafficAmount: productType === 'Object storage' ? pullTrafficAmount : 0,
          pullTrafficUnit,
          restorationType: null,
          readTrafficAmount: 0,
          readTrafficUnit: 'GB',
          replicationTrafficAmount: (productType === 'Object storage' && (storageClass === 'Standard' || storageClass === 'Infrequent Access')) ? replicationTrafficAmount : 0,
          replicationTrafficUnit,
          lifecycleTransitionRequests: 0,
          minimumStorageDays: estimate.variant.minimumStorageDays,
        },
        pricing: {
          total: helpers.formatFlavorAmount(estimate.currency, estimate.amount * quantity, estimate.suffix),
          estimate: helpers.formatFlavorAmount(estimate.currency, estimate.amount, estimate.suffix),
          monthlyAverage: helpers.formatFlavorAmount(estimate.currency, estimate.monthlyAverageAmount, '/mo'),
          breakdown: helpers.byLabelAmount(estimate.currency, estimate.suffix, estimate.breakdown),
        },
      }];
    })()`,
    hydrateExpression: `(() => {
      if (product.productType !== 'obs' || !helpers.isRecord(product.config)) {
        return { handled: false, error: 'This product cannot be edited from the calculator.' };
      }
      return {
        handled: true,
        values: {
          productType: typeof product.config.productType === 'string' ? product.config.productType : 'Object storage',
          storageClass: typeof product.config.storageClass === 'string' ? product.config.storageClass : 'Standard',
          redundancy: typeof product.config.redundancy === 'string' ? product.config.redundancy : 'Single-AZ storage',
          storageAmount: typeof product.config.storageAmount === 'number' ? String(Math.max(helpers.obsStorageSizeBounds.min, product.config.storageAmount)) : (typeof product.config.storageGiB === 'number' ? String(Math.max(helpers.obsStorageSizeBounds.min, product.config.storageGiB)) : String(helpers.obsStorageSizeBounds.min)),
          storageUnit: ['GB', 'TB', 'PB'].includes(product.config.storageUnit) ? product.config.storageUnit : 'GB',
          durationMonths: typeof product.config.durationMonths === 'number' ? String(Math.max(1, Math.floor(product.config.durationMonths))) : '1',
          outboundTrafficAmount: typeof product.config.outboundTrafficAmount === 'number' ? String(Math.max(0, product.config.outboundTrafficAmount)) : '0',
          outboundTrafficUnit: ['GB', 'TB', 'PB'].includes(product.config.outboundTrafficUnit) ? product.config.outboundTrafficUnit : 'GB',
          readRequests: typeof product.config.readRequests === 'number' ? helpers.formatObsRequestInputValue(product.config.readRequests) : '0',
          writeRequests: typeof product.config.writeRequests === 'number' ? helpers.formatObsRequestInputValue(product.config.writeRequests) : '0',
          deleteRequests: typeof product.config.deleteRequests === 'number' ? helpers.formatObsRequestInputValue(product.config.deleteRequests) : '0',
          pullTrafficAmount: typeof product.config.pullTrafficAmount === 'number' ? String(Math.max(0, product.config.pullTrafficAmount)) : '0',
          pullTrafficUnit: ['GB', 'TB', 'PB'].includes(product.config.pullTrafficUnit) ? product.config.pullTrafficUnit : 'GB',
          restorationType: typeof product.config.restorationType === 'string' ? product.config.restorationType : '',
          readTrafficAmount: typeof product.config.readTrafficAmount === 'number' ? String(Math.max(0, product.config.readTrafficAmount)) : '0',
          readTrafficUnit: ['GB', 'TB', 'PB'].includes(product.config.readTrafficUnit) ? product.config.readTrafficUnit : 'GB',
          replicationTrafficAmount: typeof product.config.replicationTrafficAmount === 'number' ? String(Math.max(0, product.config.replicationTrafficAmount)) : '0',
          replicationTrafficUnit: ['GB', 'TB', 'PB'].includes(product.config.replicationTrafficUnit) ? product.config.replicationTrafficUnit : 'GB',
          lifecycleTransitionRequests: typeof product.config.lifecycleTransitionRequests === 'number' ? helpers.formatObsRequestInputValue(product.config.lifecycleTransitionRequests) : '0',
        },
        nextRegion: typeof product.config.region === 'string' ? product.config.region : regionValue,
        nextBillingMode: 'Pay-per-use',
        nextUsageHours: usageHours,
        nextInstanceCount: String(Math.max(1, product.quantity)),
      };
    })()`,
  } satisfies DeclarativeRuntimeDefinition;

export const configurableServiceBundle = {
  service: serviceDefinition,
  pricing: pricingDefinition,
  runtime: convertLegacyRuntimeDefinition(legacyRuntimeDefinition),
} as const satisfies ConfigurableServiceBundleDefinition;
