import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";

export const serviceDefinition = {
  "version": 1,
  "definitionId": "modelarts",
  "serviceCode": "ModelArts",
  "serviceName": "ModelArts",
  "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/AI/ModelArts.png",
  "implementation": "configurable",
  "billingOptions": [
    "Pay-per-use",
    "Yearly/Monthly"
  ],
  "defaults": {
    "serviceType": "AI Development Lifecycle",
    "resourceType": "Public Resource Pool",
    "specification": "Compute CPU instance (2U)",
    "quantity": 1,
    "storageQuotaGb": 1,
    "usageHours": 744,
    "durationMonths": 1
  },
  "fields": [
    {
      "id": "serviceType",
      "type": "select",
      "label": "Service Type",
      "required": true,
      "options": [
        "AI Development Lifecycle"
      ]
    },
    {
      "id": "resourceType",
      "type": "select",
      "label": "Resource Type",
      "required": true,
      "optionsSource": "catalog.resourceTypes"
    },
    {
      "id": "specification",
      "type": "select",
      "label": "Specifications",
      "required": true,
      "optionsSource": "catalog.specifications"
    },
    {
      "id": "quantity",
      "type": "number",
      "label": "Quantity",
      "required": true,
      "min": 1,
      "step": 1,
      "visibleWhen": {
        "field": "resourceType",
        "notEquals": "EVS Storage"
      }
    },
    {
      "id": "storageQuotaGb",
      "type": "number",
      "label": "Quota",
      "required": true,
      "unit": "GB",
      "min": 1,
      "step": 1,
      "visibleWhen": {
        "field": "resourceType",
        "equals": "EVS Storage"
      }
    },
    {
      "id": "usageHours",
      "type": "number",
      "label": "Required Duration",
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
      "type": "select",
      "label": "Required Duration",
      "required": true,
      "options": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        12
      ],
      "visibleWhen": {
        "field": "billingMode",
        "equals": "Yearly/Monthly"
      }
    }
  ],
  "summary": {
    "selectionTemplate": "{serviceType} | {resourceType} | {specification}",
    "notes": [
      "Billing mode controls which ModelArts resource types are available.",
      "The generated form keeps Service Type fixed to the AI Development Lifecycle flow."
    ]
  }
} satisfies ServiceDefinition;

export const pricingDefinition = {
  "version": 1,
  "definitionId": "modelarts",
  "serviceCode": "ModelArts",
  "serviceName": "ModelArts",
  "catalogAdapter": "modelarts",
  "rateSources": {
    "compute": {
      "catalogKey": "compute.prices",
      "description": "Normalized ModelArts compute instance rates from the productInfo catalog."
    },
    "storage": {
      "catalogKey": "storage.prices",
      "description": "Normalized ModelArts instance storage rate from the productInfo catalog."
    }
  },
  "metrics": [
    {
      "id": "computeInstances",
      "label": "Compute instances",
      "rateSource": "compute",
      "quantity": {
        "source": "field",
        "field": "quantity"
      },
      "enabledWhen": {
        "field": "resourceType",
        "notEquals": "EVS Storage"
      }
    },
    {
      "id": "instanceStorage",
      "label": "Instance storage",
      "rateSource": "storage",
      "quantity": {
        "source": "field",
        "field": "storageQuotaGb"
      },
      "unit": "GB",
      "enabledWhen": {
        "field": "resourceType",
        "equals": "EVS Storage"
      }
    }
  ]
} satisfies PricingDefinition;

export const configurableServiceBundle = {
  service: serviceDefinition,
  pricing: pricingDefinition,
} as const satisfies ConfigurableServiceBundleDefinition;
