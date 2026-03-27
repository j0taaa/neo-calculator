import type { PricingDefinition } from "@/lib/service-config-types";

export const pricingDefinition = {
  "version": 1,
  "definitionId": "nat",
  "serviceCode": "NAT",
  "serviceName": "NAT Gateway",
  "catalogAdapter": "nat",
  "rateSources": {
    "gateway": {
      "catalogKey": "gateway.baseRate"
    }
  },
  "metrics": [
    {
      "id": "gateway",
      "label": "Gateway",
      "rateSource": "gateway",
      "quantity": {
        "source": "expression",
        "expression": "1"
      }
    }
  ]
} satisfies PricingDefinition;
