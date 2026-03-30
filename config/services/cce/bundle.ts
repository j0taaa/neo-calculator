import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";

export const serviceDefinition = {
  "version": 1,
  "definitionId": "cce",
  "serviceCode": "CCE",
  "serviceName": "Cloud Container Engine",
  "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Containers/CCE.png",
  "implementation": "configurable",
  "billingOptions": [
    "Pay-per-use",
    "Yearly/Monthly"
  ],
  "defaults": {
    "clusterScale": "50 nodes",
    "masterNodes": "3 Masters"
  },
  "fields": [
    {
      "id": "clusterScale",
      "type": "select",
      "label": "Cluster Scale",
      "required": true,
      "optionsSource": "catalog.clusterScales"
    },
    {
      "id": "masterNodes",
      "type": "select",
      "label": "Master Nodes",
      "required": true,
      "optionsSource": "catalog.masterNodeCounts"
    }
  ],
  "summary": {
    "selectionTemplate": "{clusterScale} | {masterNodes}"
  }
} satisfies ServiceDefinition;

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

export const configurableServiceBundle = {
  service: serviceDefinition,
  pricing: pricingDefinition,
} as const satisfies ConfigurableServiceBundleDefinition;
