import type { ServiceDefinition } from "@/lib/service-config-types";

export const serviceDefinition = {
  "version": 1,
  "definitionId": "nat",
  "serviceCode": "NAT",
  "serviceName": "NAT Gateway",
  "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Networking/NAT.png",
  "implementation": "configurable",
  "billingOptions": [
    "Pay-per-use",
    "Yearly/Monthly"
  ],
  "defaults": {
    "natType": "Public NAT Gateway",
    "natSize": "Small"
  },
  "fields": [
    {
      "id": "natType",
      "type": "select",
      "label": "Gateway Type",
      "required": true,
      "optionsSource": "catalog.gatewayTypes"
    },
    {
      "id": "natSize",
      "type": "select",
      "label": "Specifications",
      "required": true,
      "optionsSource": "catalog.gatewaySizes"
    }
  ],
  "summary": {
    "selectionTemplate": "{natType} | {natSize}",
    "notes": [
      "Billing mode remains controlled by the shared calculator header because NAT availability depends on the selected gateway type."
    ]
  }
} satisfies ServiceDefinition;
