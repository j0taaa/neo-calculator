import type { PricingDefinition } from "@/lib/service-config-types";

export const pricingDefinition = {
  "version": 1,
  "definitionId": "cce",
  "serviceCode": "CCE",
  "serviceName": "Cloud Container Engine",
  "catalogAdapter": "cce",
  "rateSources": {
    "cluster": {
      "catalogKey": "cluster.managementRate"
    }
  },
  "metrics": [
    {
      "id": "clusterManagement",
      "label": "Cluster management",
      "rateSource": "cluster",
      "quantity": {
        "source": "expression",
        "expression": "1"
      }
    }
  ]
} satisfies PricingDefinition;
