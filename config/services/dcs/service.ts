import type { ServiceDefinition } from "@/lib/service-config-types";

export const serviceDefinition = {
  "version": 1,
  "definitionId": "dcs",
  "serviceCode": "DCS",
  "serviceName": "Distributed Cache Service (for Redis)",
  "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Middleware/Memcached.png",
  "implementation": "configurable",
  "billingOptions": [
    "Pay-per-use"
  ],
  "defaults": {
    "edition": "Basic",
    "version": "7.0",
    "instanceType": "Single-node",
    "architecture": "x86 | DRAM",
    "replicas": 2,
    "specification": "4 GB",
    "quantity": 1,
    "elasticBandwidth": "Buy now",
    "bandwidthMbit": 1,
    "usageHours": 744
  },
  "fields": [
    {
      "id": "edition",
      "type": "select",
      "label": "Edition",
      "required": true,
      "options": [
        "Basic"
      ]
    },
    {
      "id": "version",
      "type": "select",
      "label": "Version",
      "required": true,
      "optionsSource": "catalog.versions"
    },
    {
      "id": "instanceType",
      "type": "select",
      "label": "Instance Type",
      "required": true,
      "optionsSource": "catalog.instanceTypes"
    },
    {
      "id": "architecture",
      "type": "select",
      "label": "CPU / Memory",
      "required": true,
      "optionsSource": "catalog.architectures"
    },
    {
      "id": "replicas",
      "type": "select",
      "label": "Replicas",
      "required": true,
      "optionsSource": "catalog.replicas",
      "visibleWhen": {
        "field": "showReplicas",
        "equals": true
      }
    },
    {
      "id": "specification",
      "type": "select",
      "label": "Specification",
      "required": true,
      "optionsSource": "catalog.specifications"
    },
    {
      "id": "quantity",
      "type": "number",
      "label": "Quantity",
      "required": true,
      "min": 1,
      "step": 1
    },
    {
      "id": "elasticBandwidth",
      "type": "select",
      "label": "Elastic Bandwidth",
      "required": true,
      "options": [
        "Buy now",
        "Buy later"
      ]
    },
    {
      "id": "bandwidthMbit",
      "type": "number",
      "label": "Bandwidth",
      "required": true,
      "unit": "Mbit/s",
      "min": 1,
      "step": 1,
      "visibleWhen": {
        "field": "elasticBandwidth",
        "equals": "Buy now"
      }
    },
    {
      "id": "usageHours",
      "type": "number",
      "label": "Required Duration",
      "required": true,
      "unit": "hours",
      "min": 1,
      "max": 87600,
      "step": 24
    }
  ],
  "summary": {
    "selectionTemplate": "{edition} | {version} | {instanceType} | {architecture} | {specification}",
    "notes": [
      "This calculator currently models the Basic Redis pay-per-use flow.",
      "Bandwidth charges are included only when Elastic Bandwidth is set to Buy now."
    ]
  }
} satisfies ServiceDefinition;
