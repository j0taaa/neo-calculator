import type { PricingDefinition } from "@/lib/service-config-types";

export const pricingDefinition = {
  "version": 1,
  "definitionId": "dcs",
  "serviceCode": "DCS",
  "serviceName": "Distributed Cache Service (for Redis)",
  "catalogAdapter": "dcs",
  "rateSources": {
    "instance": {
      "catalogKey": "instanceTiers.prices",
      "description": "Normalized Redis pay-per-use instance rates from the productInfo catalog."
    },
    "bandwidth": {
      "catalogKey": "bandwidthRatePerMbitHour",
      "description": "Normalized elastic bandwidth rate per Mbit/s per hour from the productInfo catalog."
    }
  },
  "metrics": [
    {
      "id": "redisInstance",
      "label": "Redis instances",
      "rateSource": "instance",
      "quantity": {
        "source": "field",
        "field": "quantity"
      }
    },
    {
      "id": "elasticBandwidth",
      "label": "Elastic bandwidth",
      "rateSource": "bandwidth",
      "quantity": {
        "source": "field",
        "field": "bandwidthMbit"
      },
      "unit": "Mbit/s",
      "enabledWhen": {
        "field": "elasticBandwidth",
        "equals": "Buy now"
      }
    }
  ]
} satisfies PricingDefinition;
