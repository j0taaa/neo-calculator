import type { ServiceDefinition } from "@/lib/service-config-types";

export const serviceDefinition = {
  "version": 1,
  "definitionId": "eip",
  "serviceCode": "EIP",
  "serviceName": "Elastic IP",
  "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Networking/EIP.png",
  "implementation": "configurable",
  "billingOptions": [
    "Pay-per-use",
    "Yearly/Monthly"
  ],
  "defaults": {
    "type": "Dedicated EIP",
    "chargeMode": "By bandwidth",
    "bandwidthMbit": 10,
    "enhanced95DurationMonths": 1,
    "sharedBandwidthQuantity": 1,
    "trafficAmount": 100,
    "trafficUnit": "GB"
  },
  "fields": [
    {
      "id": "type",
      "type": "select",
      "label": "Type",
      "required": true,
      "options": [
        "Dedicated EIP",
        "Shared EIP"
      ]
    },
    {
      "id": "chargeMode",
      "type": "select",
      "label": "Charge Mode",
      "required": true,
      "optionsSource": "catalog.chargeModes"
    },
    {
      "id": "bandwidthMbit",
      "type": "number",
      "label": "Bandwidth",
      "required": true,
      "unit": "Mbit/s",
      "inputMode": "decimal",
      "minSource": "catalog.bandwidth.min",
      "visibleWhen": {
        "field": "showBandwidth",
        "equals": true
      }
    },
    {
      "id": "enhanced95DurationMonths",
      "type": "number",
      "label": "Required Duration",
      "required": true,
      "unit": "months",
      "min": 1,
      "step": 1,
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Shared EIP"
        },
        {
          "field": "chargeMode",
          "equals": "Enhanced 95"
        }
      ]
    },
    {
      "id": "sharedBandwidthQuantity",
      "type": "number",
      "label": "Bandwidth Quantity",
      "required": true,
      "min": 1,
      "step": 1,
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Shared EIP"
        },
        {
          "field": "chargeMode",
          "equals": "By bandwidth"
        }
      ]
    },
    {
      "id": "trafficAmount",
      "type": "number",
      "label": "Traffic",
      "required": true,
      "inputMode": "decimal",
      "min": 0,
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated EIP"
        },
        {
          "field": "chargeMode",
          "equals": "By traffic"
        }
      ]
    },
    {
      "id": "trafficUnit",
      "type": "select",
      "label": "Traffic Unit",
      "required": true,
      "options": [
        "GB",
        "TB"
      ],
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated EIP"
        },
        {
          "field": "chargeMode",
          "equals": "By traffic"
        }
      ]
    }
  ],
  "summary": {
    "selectionTemplate": "{type} | Dynamic BGP | {chargeMode}",
    "notes": [
      "The Huawei calculator currently uses Dynamic BGP for this workflow."
    ]
  }
} satisfies ServiceDefinition;
