import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";

export const serviceDefinition = {
  "version": 1,
  "definitionId": "obs",
  "serviceCode": "OBS",
  "serviceName": "Object Storage Service",
  "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Storage/OBS.png",
  "implementation": "configurable",
  "billingOptions": [
    "Pay-per-use"
  ],
  "defaults": {
    "productType": "Object storage",
    "storageClass": "Standard",
    "redundancy": "Single-AZ storage",
    "storageAmount": 100,
    "storageUnit": "GB",
    "durationMonths": 1,
    "outboundTrafficAmount": 0,
    "outboundTrafficUnit": "GB",
    "readRequests": 0,
    "writeRequests": 0,
    "deleteRequests": 0,
    "pullTrafficAmount": 0,
    "pullTrafficUnit": "GB",
    "restorationType": null,
    "readTrafficAmount": 0,
    "readTrafficUnit": "GB",
    "replicationTrafficAmount": 0,
    "replicationTrafficUnit": "GB",
    "lifecycleTransitionRequests": 0
  },
  "fields": [
    {
      "id": "productType",
      "type": "select",
      "label": "Product Type",
      "required": true,
      "optionsSource": "catalog.productTypes"
    },
    {
      "id": "storageClass",
      "type": "select",
      "label": "Storage Class",
      "required": true,
      "optionsSource": "catalog.storageClasses"
    },
    {
      "id": "redundancy",
      "type": "select",
      "label": "Data Redundancy Policy",
      "required": true,
      "optionsSource": "catalog.redundancies"
    },
    {
      "id": "storageAmount",
      "type": "number",
      "label": "Storage Space",
      "required": true,
      "inputMode": "decimal",
      "minSource": "catalog.storage.min",
      "maxSource": "catalog.storage.max"
    },
    {
      "id": "storageUnit",
      "type": "select",
      "label": "Storage Unit",
      "required": true,
      "options": [
        "GB",
        "TB",
        "PB"
      ]
    },
    {
      "id": "durationMonths",
      "type": "number",
      "label": "Storage Duration",
      "required": true,
      "unit": "months",
      "min": 1,
      "step": 1
    },
    {
      "id": "outboundTrafficAmount",
      "type": "number",
      "label": "Internet Outbound Traffic",
      "required": true,
      "inputMode": "decimal",
      "min": 0
    },
    {
      "id": "outboundTrafficUnit",
      "type": "select",
      "label": "Outbound Traffic Unit",
      "required": true,
      "options": [
        "GB",
        "TB",
        "PB"
      ]
    },
    {
      "id": "pullTrafficAmount",
      "type": "number",
      "label": "Pull Traffic",
      "required": true,
      "inputMode": "decimal",
      "min": 0,
      "visibleWhen": {
        "field": "productType",
        "equals": "Object storage"
      }
    },
    {
      "id": "pullTrafficUnit",
      "type": "select",
      "label": "Pull Traffic Unit",
      "required": true,
      "options": [
        "GB",
        "TB",
        "PB"
      ],
      "visibleWhen": {
        "field": "productType",
        "equals": "Object storage"
      }
    },
    {
      "id": "restorationType",
      "type": "select",
      "label": "Restoration Type",
      "required": true,
      "optionsSource": "catalog.restorationTypes",
      "visibleWhen": {
        "field": "showRestorationFields",
        "equals": true
      }
    },
    {
      "id": "readTrafficAmount",
      "type": "number",
      "label": "Read Traffic",
      "required": true,
      "inputMode": "decimal",
      "min": 0,
      "visibleWhen": {
        "field": "showRestorationFields",
        "equals": true
      }
    },
    {
      "id": "readTrafficUnit",
      "type": "select",
      "label": "Read Traffic Unit",
      "required": true,
      "options": [
        "GB",
        "TB",
        "PB"
      ],
      "visibleWhen": {
        "field": "showRestorationFields",
        "equals": true
      }
    },
    {
      "id": "lifecycleTransitionRequests",
      "type": "number",
      "label": "Lifecycle Transition Requests",
      "required": true,
      "min": 0,
      "visibleWhen": {
        "field": "showRestorationFields",
        "equals": true
      }
    },
    {
      "id": "replicationTrafficAmount",
      "type": "number",
      "label": "Cross-region Replication Traffic",
      "required": true,
      "inputMode": "decimal",
      "min": 0,
      "visibleWhen": {
        "field": "showReplicationTraffic",
        "equals": true
      }
    },
    {
      "id": "replicationTrafficUnit",
      "type": "select",
      "label": "Replication Traffic Unit",
      "required": true,
      "options": [
        "GB",
        "TB",
        "PB"
      ],
      "visibleWhen": {
        "field": "showReplicationTraffic",
        "equals": true
      }
    },
    {
      "id": "readRequests",
      "type": "number",
      "label": "Read Requests",
      "required": true,
      "inputMode": "decimal",
      "min": 0
    },
    {
      "id": "writeRequests",
      "type": "number",
      "label": "Write Requests",
      "required": true,
      "inputMode": "decimal",
      "min": 0
    },
    {
      "id": "deleteRequests",
      "type": "number",
      "label": "Delete Requests",
      "required": true,
      "inputMode": "decimal",
      "min": 0
    }
  ],
  "summary": {
    "selectionTemplate": "{productType} | {storageClass} | {storageAmount} {storageUnit}",
    "notes": [
      "Request counters are entered in blocks of 10,000 requests to match the current calculator workflow."
    ]
  },
  "batchAdd": {
    "supported": true
  }
} satisfies ServiceDefinition;

export const pricingDefinition = {
  "version": 1,
  "definitionId": "obs",
  "serviceCode": "OBS",
  "serviceName": "Object Storage Service",
  "catalogAdapter": "obs",
  "rateSources": {
    "storage": {
      "catalogKey": "storage.rate"
    },
    "outbound": {
      "catalogKey": "traffic.outboundRate"
    },
    "requestRead": {
      "catalogKey": "requests.readRate"
    },
    "requestWrite": {
      "catalogKey": "requests.writeRate"
    },
    "requestDelete": {
      "catalogKey": "requests.deleteRate"
    },
    "pullTraffic": {
      "catalogKey": "traffic.pullRate"
    },
    "readTraffic": {
      "catalogKey": "traffic.readRate"
    },
    "replicationTraffic": {
      "catalogKey": "traffic.replicationRate"
    },
    "lifecycleTransition": {
      "catalogKey": "requests.lifecycleTransitionRate"
    }
  },
  "metrics": [
    {
      "id": "storage",
      "label": "Storage",
      "rateSource": "storage",
      "quantity": {
        "source": "field",
        "field": "storageAmount"
      }
    },
    {
      "id": "outboundTraffic",
      "label": "Outbound traffic",
      "rateSource": "outbound",
      "quantity": {
        "source": "field",
        "field": "outboundTrafficAmount"
      }
    },
    {
      "id": "readRequests",
      "label": "Read requests",
      "rateSource": "requestRead",
      "quantity": {
        "source": "field",
        "field": "readRequests"
      }
    },
    {
      "id": "writeRequests",
      "label": "Write requests",
      "rateSource": "requestWrite",
      "quantity": {
        "source": "field",
        "field": "writeRequests"
      }
    },
    {
      "id": "deleteRequests",
      "label": "Delete requests",
      "rateSource": "requestDelete",
      "quantity": {
        "source": "field",
        "field": "deleteRequests"
      }
    },
    {
      "id": "pullTraffic",
      "label": "Pull traffic",
      "rateSource": "pullTraffic",
      "quantity": {
        "source": "field",
        "field": "pullTrafficAmount"
      },
      "enabledWhen": {
        "field": "productType",
        "equals": "Object storage"
      }
    },
    {
      "id": "readTraffic",
      "label": "Read traffic",
      "rateSource": "readTraffic",
      "quantity": {
        "source": "field",
        "field": "readTrafficAmount"
      },
      "enabledWhen": {
        "field": "showRestorationFields",
        "equals": true
      }
    },
    {
      "id": "replicationTraffic",
      "label": "Replication traffic",
      "rateSource": "replicationTraffic",
      "quantity": {
        "source": "field",
        "field": "replicationTrafficAmount"
      },
      "enabledWhen": {
        "field": "showReplicationTraffic",
        "equals": true
      }
    },
    {
      "id": "lifecycleTransitionRequests",
      "label": "Lifecycle transition requests",
      "rateSource": "lifecycleTransition",
      "quantity": {
        "source": "field",
        "field": "lifecycleTransitionRequests"
      },
      "enabledWhen": {
        "field": "showRestorationFields",
        "equals": true
      }
    }
  ]
} satisfies PricingDefinition;

export const configurableServiceBundle = {
  service: serviceDefinition,
  pricing: pricingDefinition,
} as const satisfies ConfigurableServiceBundleDefinition;
