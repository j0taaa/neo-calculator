import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
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
    "specification": "Ultimate",
    "cpu": "2 vCPUs",
    "memory": "4 GB",
    "cpuUsageHours": 744,
    "diskType": "High I/O",
    "diskSizeGb": 80,
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

export const configurableServiceBundle = {
  service: serviceDefinition,
  pricing: pricingDefinition,
} as const satisfies ConfigurableServiceBundleDefinition;
