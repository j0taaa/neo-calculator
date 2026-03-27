import type { PricingDefinition } from "@/lib/service-config-types";

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
