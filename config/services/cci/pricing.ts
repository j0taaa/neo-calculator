import type { PricingDefinition } from "@/lib/service-config-types";

export const pricingDefinition = {
  "version": 1,
  "definitionId": "cci",
  "serviceCode": "CCI",
  "serviceName": "Cloud Container Instance",
  "catalogAdapter": "cci",
  "rateSources": {
    "cpu": {
      "catalogKey": "compute.cpuRate"
    },
    "memory": {
      "catalogKey": "compute.memoryRate"
    }
  },
  "metrics": [
    {
      "id": "cpu",
      "label": "CPU",
      "rateSource": "cpu",
      "quantity": {
        "source": "field",
        "field": "cpu"
      },
      "unit": "vCPU"
    },
    {
      "id": "memory",
      "label": "Memory",
      "rateSource": "memory",
      "quantity": {
        "source": "field",
        "field": "memoryGiB"
      },
      "unit": "GiB"
    }
  ]
} satisfies PricingDefinition;
