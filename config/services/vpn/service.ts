import type { ServiceDefinition } from "@/lib/service-config-types";

export const serviceDefinition = {
  "version": 1,
  "definitionId": "vpn",
  "serviceCode": "VPN",
  "serviceName": "Virtual Private Network",
  "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Networking/VPN.png",
  "implementation": "configurable",
  "billingOptions": [
    "Pay-per-use",
    "Yearly/Monthly"
  ],
  "defaults": {
    "edition": "Classic",
    "mode": "Site-to-Cloud",
    "networkType": "Public network",
    "specification": "Basic",
    "useSharedBandwidth": "No",
    "eipBandwidthMbit1": 10,
    "eipBandwidthMbit2": 10,
    "durationMonths": 1
  },
  "fields": [
    {
      "id": "edition",
      "type": "select",
      "label": "VPN Edition",
      "required": true,
      "options": [
        "Classic",
        "Enterprise"
      ]
    },
    {
      "id": "mode",
      "type": "select",
      "label": "Mode",
      "required": true,
      "optionsSource": "catalog.modes",
      "visibleWhen": {
        "field": "edition",
        "equals": "Enterprise"
      }
    },
    {
      "id": "networkType",
      "type": "select",
      "label": "Network Type",
      "required": true,
      "options": [
        "Public network",
        "Private network"
      ],
      "visibleWhen": {
        "field": "edition",
        "equals": "Enterprise"
      }
    },
    {
      "id": "specification",
      "type": "select",
      "label": "Specification",
      "required": true,
      "optionsSource": "catalog.specifications",
      "visibleWhen": {
        "field": "edition",
        "equals": "Enterprise"
      }
    },
    {
      "id": "useSharedBandwidth",
      "type": "select",
      "label": "Using Shared Bandwidth",
      "required": true,
      "options": [
        "Yes",
        "No"
      ],
      "visibleWhenAll": [
        {
          "field": "edition",
          "equals": "Enterprise"
        },
        {
          "field": "networkType",
          "equals": "Public network"
        }
      ]
    },
    {
      "id": "eipBandwidthMbit1",
      "type": "number",
      "label": "EIP 1 Bandwidth",
      "required": true,
      "unit": "Mbit/s",
      "inputMode": "decimal",
      "min": 0,
      "visibleWhenAll": [
        {
          "field": "edition",
          "equals": "Enterprise"
        },
        {
          "field": "networkType",
          "equals": "Public network"
        }
      ]
    },
    {
      "id": "eipBandwidthMbit2",
      "type": "number",
      "label": "EIP 2 Bandwidth",
      "required": true,
      "unit": "Mbit/s",
      "inputMode": "decimal",
      "min": 0,
      "visibleWhenAll": [
        {
          "field": "edition",
          "equals": "Enterprise"
        },
        {
          "field": "networkType",
          "equals": "Public network"
        }
      ]
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
        12,
        24,
        36
      ],
      "visibleWhen": {
        "field": "billingMode",
        "equals": "Yearly/Monthly"
      }
    }
  ],
  "summary": {
    "selectionTemplate": "{edition} | {mode} | {networkType} | {specification}",
    "notes": [
      "Specification options are derived from the current calculator catalog and remain read-only in the generated form."
    ]
  }
} satisfies ServiceDefinition;
