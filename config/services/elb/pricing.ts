import type { PricingDefinition } from "@/lib/service-config-types";

export const pricingDefinition = {
  "version": 1,
  "definitionId": "elb",
  "serviceCode": "ELB",
  "serviceName": "Elastic Load Balance",
  "catalogAdapter": "elb",
  "rateSources": {
    "sharedBase": {
      "catalogKey": "sharedRates"
    },
    "publicBandwidth": {
      "catalogKey": "publicNetworkRates.bandwidthPerMbitHour"
    },
    "publicTraffic": {
      "catalogKey": "publicNetworkRates.trafficPerGb"
    },
    "dedicatedFixed": {
      "catalogKey": "dedicatedRates.fixed"
    },
    "dedicatedElasticBase": {
      "catalogKey": "dedicatedRates.elastic.basePerHour"
    },
    "dedicatedElasticLcu": {
      "catalogKey": "dedicatedRates.elastic.lcuRates"
    }
  },
  "metrics": [
    {
      "id": "loadBalancerBase",
      "label": "Load Balancer Base",
      "rateSource": "sharedBase",
      "quantity": {
        "source": "expression",
        "expression": "billing dependent"
      }
    },
    {
      "id": "publicBandwidth",
      "label": "Public Bandwidth",
      "rateSource": "publicBandwidth",
      "quantity": {
        "source": "field",
        "field": "sharedBandwidthMbit"
      },
      "unit": "Mbit/s",
      "enabledWhen": {
        "field": "showSharedBandwidth",
        "equals": true
      }
    },
    {
      "id": "publicTraffic",
      "label": "Public Traffic",
      "rateSource": "publicTraffic",
      "quantity": {
        "source": "field",
        "field": "sharedTrafficAmount"
      },
      "unit": "GB",
      "enabledWhen": {
        "field": "showSharedTraffic",
        "equals": true
      }
    },
    {
      "id": "fixedDedicatedLcu",
      "label": "Dedicated Fixed LCU",
      "rateSource": "dedicatedFixed",
      "quantity": {
        "source": "expression",
        "expression": "selected fixed spec lcus"
      },
      "enabledWhen": {
        "field": "specificationType",
        "equals": "Fixed"
      }
    },
    {
      "id": "elasticDedicatedBase",
      "label": "Dedicated Elastic Base",
      "rateSource": "dedicatedElasticBase",
      "quantity": {
        "source": "expression",
        "expression": "duration hours"
      },
      "enabledWhen": {
        "field": "specificationType",
        "equals": "Elastic"
      }
    },
    {
      "id": "elasticDedicatedLcu",
      "label": "Dedicated Elastic LCU",
      "rateSource": "dedicatedElasticLcu",
      "quantity": {
        "source": "expression",
        "expression": "estimated protocol lcus"
      },
      "enabledWhen": {
        "field": "specificationType",
        "equals": "Elastic"
      }
    }
  ]
} satisfies PricingDefinition;
