import type { ServiceDefinition } from "@/lib/service-config-types";

export const serviceDefinition = {
  "version": 1,
  "definitionId": "cci",
  "serviceCode": "CCI",
  "serviceName": "Cloud Container Instance",
  "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Containers/CCI.png",
  "implementation": "configurable",
  "billingOptions": [
    "Pay-per-use",
    "Yearly/Monthly"
  ],
  "defaults": {
    "cpu": 1,
    "memoryGiB": 1
  },
  "fields": [
    {
      "id": "cpu",
      "type": "number",
      "label": "CPU",
      "required": true,
      "unit": "vCPU",
      "min": 1,
      "step": 1
    },
    {
      "id": "memoryGiB",
      "type": "number",
      "label": "Memory",
      "required": true,
      "unit": "GiB",
      "min": 1,
      "step": 1
    }
  ],
  "summary": {
    "selectionTemplate": "{cpu} vCPU | {memoryGiB} GiB"
  }
} satisfies ServiceDefinition;
