import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
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

export const configurableServiceBundle = {
  service: serviceDefinition,
  pricing: pricingDefinition,
} as const satisfies ConfigurableServiceBundleDefinition;
