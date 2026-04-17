import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import type { DeclarativeRuntimeDefinition } from "@/lib/declarative-service-runtime-types";
import { convertLegacyRuntimeDefinition } from "@/lib/legacy-runtime-converter";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";

export const serviceDefinition = {
  "version": 1,
  "definitionId": "elb",
  "serviceCode": "ELB",
  "serviceName": "Elastic Load Balance",
  "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Networking/ELB.png",
  "implementation": "configurable",
  "billingOptions": [
    "Pay-per-use",
    "Yearly/Monthly"
  ],
  "defaults": {
    "type": "Shared load balancer",
    "networkType": "Private network",
    "sharedChargeMode": "By traffic",
    "usageHours": 744,
    "sharedBandwidthMbit": 5,
    "sharedTrafficAmount": 0,
    "sharedTrafficUnit": "GB",
    "specificationType": "Fixed",
    "fixedAvailabilityAzCount": 1,
    "fixedNetworkEnabled": true,
    "fixedNetworkSpec": "Small I",
    "fixedApplicationEnabled": false,
    "fixedApplicationSpec": "Small I",
    "tcpEnabled": true,
    "tcpNewConnections": 0,
    "tcpMaxConcurrentConnections": 0,
    "tcpMetricMode": "By traffic",
    "tcpProcessedTrafficGbPerHour": 0,
    "tcpAverageBandwidthMbit": 0,
    "udpEnabled": false,
    "udpNewConnections": 0,
    "udpMaxConcurrentConnections": 0,
    "udpMetricMode": "By traffic",
    "udpProcessedTrafficGbPerHour": 0,
    "udpAverageBandwidthMbit": 0,
    "tlsEnabled": false,
    "tlsNewConnections": 0,
    "tlsMaxConcurrentConnections": 0,
    "tlsMetricMode": "By traffic",
    "tlsProcessedTrafficGbPerHour": 0,
    "tlsAverageBandwidthMbit": 0,
    "httpEnabled": false,
    "httpNewConnections": 0,
    "httpMaxConcurrentConnections": 0,
    "httpMetricMode": "By traffic",
    "httpProcessedTrafficGbPerHour": 0,
    "httpAverageBandwidthMbit": 0,
    "httpQueriesPerSecond": 0,
    "httpForwardingRules": 0
  },
  "fields": [
    {
      "id": "type",
      "type": "select",
      "label": "Type",
      "required": true,
      "options": [
        "Shared load balancer",
        "Dedicated load balancer"
      ]
    },
    {
      "id": "networkType",
      "type": "select",
      "label": "Network Type",
      "required": true,
      "options": [
        "Public network",
        "Private network"
      ]
    },
    {
      "id": "sharedChargeMode",
      "type": "select",
      "label": "Billing By",
      "required": true,
      "options": [
        "By traffic",
        "By bandwidth"
      ],
      "visibleWhen": {
        "field": "networkType",
        "equals": "Public network"
      }
    },
    {
      "id": "usageHours",
      "type": "number",
      "label": "Required Duration",
      "required": true,
      "unit": "hours",
      "min": 1,
      "step": 1,
      "visibleWhen": {
        "field": "showUsageHours",
        "equals": true
      }
    },
    {
      "id": "sharedBandwidthMbit",
      "type": "number",
      "label": "Bandwidth",
      "required": true,
      "unit": "Mbit/s",
      "inputMode": "decimal",
      "min": 0,
      "visibleWhen": {
        "field": "showSharedBandwidth",
        "equals": true
      }
    },
    {
      "id": "sharedTrafficAmount",
      "type": "number",
      "label": "Traffic",
      "required": true,
      "inputMode": "decimal",
      "min": 0,
      "visibleWhen": {
        "field": "showSharedTraffic",
        "equals": true
      }
    },
    {
      "id": "sharedTrafficUnit",
      "type": "select",
      "label": "Traffic Unit",
      "required": true,
      "options": [
        "GB",
        "TB"
      ],
      "visibleWhen": {
        "field": "showSharedTraffic",
        "equals": true
      }
    },
    {
      "id": "specificationType",
      "type": "select",
      "label": "Specifications",
      "required": true,
      "options": [
        "Fixed",
        "Elastic"
      ],
      "visibleWhen": {
        "field": "type",
        "equals": "Dedicated load balancer"
      }
    },
    {
      "id": "fixedAvailabilityAzCount",
      "type": "select",
      "label": "Availability AZs",
      "required": true,
      "optionsSource": "catalog.fixedAvailabilityAzCountOptions",
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Fixed"
        }
      ]
    },
    {
      "id": "fixedNetworkEnabled",
      "type": "checkbox",
      "label": "Network Load Balancing",
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Fixed"
        }
      ]
    },
    {
      "id": "fixedNetworkSpec",
      "type": "select",
      "label": "Network Spec",
      "required": true,
      "options": [
        "Small I",
        "Small II",
        "Medium I",
        "Medium II",
        "Large I",
        "Large II"
      ],
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Fixed"
        },
        {
          "field": "fixedNetworkEnabled",
          "equals": true
        }
      ]
    },
    {
      "id": "fixedApplicationEnabled",
      "type": "checkbox",
      "label": "Application Load Balancing",
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Fixed"
        }
      ]
    },
    {
      "id": "fixedApplicationSpec",
      "type": "select",
      "label": "Application Spec",
      "required": true,
      "options": [
        "Small I",
        "Small II",
        "Medium I",
        "Medium II",
        "Large I",
        "Large II"
      ],
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Fixed"
        },
        {
          "field": "fixedApplicationEnabled",
          "equals": true
        }
      ]
    },
    {
      "id": "tcpEnabled",
      "type": "checkbox",
      "label": "TCP Protocol",
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Elastic"
        }
      ]
    },
    {
      "id": "tcpNewConnections",
      "type": "number",
      "label": "TCP New Connections",
      "required": true,
      "unit": "per second",
      "min": 0,
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Elastic"
        },
        {
          "field": "tcpEnabled",
          "equals": true
        }
      ]
    },
    {
      "id": "tcpMaxConcurrentConnections",
      "type": "number",
      "label": "TCP Max Concurrent Connections",
      "required": true,
      "unit": "connections",
      "min": 0,
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Elastic"
        },
        {
          "field": "tcpEnabled",
          "equals": true
        }
      ]
    },
    {
      "id": "tcpMetricMode",
      "type": "select",
      "label": "TCP Metric",
      "required": true,
      "options": [
        "By traffic",
        "By bandwidth"
      ],
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Elastic"
        },
        {
          "field": "tcpEnabled",
          "equals": true
        }
      ]
    },
    {
      "id": "tcpProcessedTrafficGbPerHour",
      "type": "number",
      "label": "TCP Processed Traffic",
      "required": true,
      "unit": "GB/hour",
      "inputMode": "decimal",
      "min": 0,
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Elastic"
        },
        {
          "field": "tcpEnabled",
          "equals": true
        },
        {
          "field": "tcpMetricMode",
          "equals": "By traffic"
        }
      ]
    },
    {
      "id": "tcpAverageBandwidthMbit",
      "type": "number",
      "label": "TCP Average Bandwidth",
      "required": true,
      "unit": "Mbit/s",
      "inputMode": "decimal",
      "min": 0,
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Elastic"
        },
        {
          "field": "tcpEnabled",
          "equals": true
        },
        {
          "field": "tcpMetricMode",
          "equals": "By bandwidth"
        }
      ]
    },
    {
      "id": "udpEnabled",
      "type": "checkbox",
      "label": "UDP Protocol",
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Elastic"
        }
      ]
    },
    {
      "id": "udpNewConnections",
      "type": "number",
      "label": "UDP New Connections",
      "required": true,
      "unit": "per second",
      "min": 0,
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Elastic"
        },
        {
          "field": "udpEnabled",
          "equals": true
        }
      ]
    },
    {
      "id": "udpMaxConcurrentConnections",
      "type": "number",
      "label": "UDP Max Concurrent Connections",
      "required": true,
      "unit": "connections",
      "min": 0,
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Elastic"
        },
        {
          "field": "udpEnabled",
          "equals": true
        }
      ]
    },
    {
      "id": "udpMetricMode",
      "type": "select",
      "label": "UDP Metric",
      "required": true,
      "options": [
        "By traffic",
        "By bandwidth"
      ],
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Elastic"
        },
        {
          "field": "udpEnabled",
          "equals": true
        }
      ]
    },
    {
      "id": "udpProcessedTrafficGbPerHour",
      "type": "number",
      "label": "UDP Processed Traffic",
      "required": true,
      "unit": "GB/hour",
      "inputMode": "decimal",
      "min": 0,
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Elastic"
        },
        {
          "field": "udpEnabled",
          "equals": true
        },
        {
          "field": "udpMetricMode",
          "equals": "By traffic"
        }
      ]
    },
    {
      "id": "udpAverageBandwidthMbit",
      "type": "number",
      "label": "UDP Average Bandwidth",
      "required": true,
      "unit": "Mbit/s",
      "inputMode": "decimal",
      "min": 0,
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Elastic"
        },
        {
          "field": "udpEnabled",
          "equals": true
        },
        {
          "field": "udpMetricMode",
          "equals": "By bandwidth"
        }
      ]
    },
    {
      "id": "tlsEnabled",
      "type": "checkbox",
      "label": "TLS Protocol",
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Elastic"
        }
      ]
    },
    {
      "id": "tlsNewConnections",
      "type": "number",
      "label": "TLS New Connections",
      "required": true,
      "unit": "per second",
      "min": 0,
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Elastic"
        },
        {
          "field": "tlsEnabled",
          "equals": true
        }
      ]
    },
    {
      "id": "tlsMaxConcurrentConnections",
      "type": "number",
      "label": "TLS Max Concurrent Connections",
      "required": true,
      "unit": "connections",
      "min": 0,
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Elastic"
        },
        {
          "field": "tlsEnabled",
          "equals": true
        }
      ]
    },
    {
      "id": "tlsMetricMode",
      "type": "select",
      "label": "TLS Metric",
      "required": true,
      "options": [
        "By traffic",
        "By bandwidth"
      ],
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Elastic"
        },
        {
          "field": "tlsEnabled",
          "equals": true
        }
      ]
    },
    {
      "id": "tlsProcessedTrafficGbPerHour",
      "type": "number",
      "label": "TLS Processed Traffic",
      "required": true,
      "unit": "GB/hour",
      "inputMode": "decimal",
      "min": 0,
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Elastic"
        },
        {
          "field": "tlsEnabled",
          "equals": true
        },
        {
          "field": "tlsMetricMode",
          "equals": "By traffic"
        }
      ]
    },
    {
      "id": "tlsAverageBandwidthMbit",
      "type": "number",
      "label": "TLS Average Bandwidth",
      "required": true,
      "unit": "Mbit/s",
      "inputMode": "decimal",
      "min": 0,
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Elastic"
        },
        {
          "field": "tlsEnabled",
          "equals": true
        },
        {
          "field": "tlsMetricMode",
          "equals": "By bandwidth"
        }
      ]
    },
    {
      "id": "httpEnabled",
      "type": "checkbox",
      "label": "HTTP/HTTPS Protocol",
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Elastic"
        }
      ]
    },
    {
      "id": "httpNewConnections",
      "type": "number",
      "label": "HTTP New Connections",
      "required": true,
      "unit": "per second",
      "min": 0,
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Elastic"
        },
        {
          "field": "httpEnabled",
          "equals": true
        }
      ]
    },
    {
      "id": "httpMaxConcurrentConnections",
      "type": "number",
      "label": "HTTP Max Concurrent Connections",
      "required": true,
      "unit": "connections",
      "min": 0,
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Elastic"
        },
        {
          "field": "httpEnabled",
          "equals": true
        }
      ]
    },
    {
      "id": "httpMetricMode",
      "type": "select",
      "label": "HTTP Metric",
      "required": true,
      "options": [
        "By traffic",
        "By bandwidth"
      ],
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Elastic"
        },
        {
          "field": "httpEnabled",
          "equals": true
        }
      ]
    },
    {
      "id": "httpProcessedTrafficGbPerHour",
      "type": "number",
      "label": "HTTP Processed Traffic",
      "required": true,
      "unit": "GB/hour",
      "inputMode": "decimal",
      "min": 0,
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Elastic"
        },
        {
          "field": "httpEnabled",
          "equals": true
        },
        {
          "field": "httpMetricMode",
          "equals": "By traffic"
        }
      ]
    },
    {
      "id": "httpAverageBandwidthMbit",
      "type": "number",
      "label": "HTTP Average Bandwidth",
      "required": true,
      "unit": "Mbit/s",
      "inputMode": "decimal",
      "min": 0,
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Elastic"
        },
        {
          "field": "httpEnabled",
          "equals": true
        },
        {
          "field": "httpMetricMode",
          "equals": "By bandwidth"
        }
      ]
    },
    {
      "id": "httpQueriesPerSecond",
      "type": "number",
      "label": "Queries Per Second",
      "required": true,
      "unit": "QPS",
      "min": 0,
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Elastic"
        },
        {
          "field": "httpEnabled",
          "equals": true
        }
      ]
    },
    {
      "id": "httpForwardingRules",
      "type": "number",
      "label": "Forwarding Rules",
      "required": true,
      "unit": "rules",
      "min": 0,
      "visibleWhenAll": [
        {
          "field": "type",
          "equals": "Dedicated load balancer"
        },
        {
          "field": "specificationType",
          "equals": "Elastic"
        },
        {
          "field": "httpEnabled",
          "equals": true
        }
      ]
    }
  ],
  "summary": {
    "selectionTemplate": "{type} | {networkType}",
    "notes": [
      "ELB is now rendered from the shared JSON-backed calculator runtime.",
      "Dedicated elastic pricing combines base load balancer cost with protocol-specific LCU usage."
    ]
  }
} satisfies ServiceDefinition;

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

const legacyRuntimeDefinition = {
    quantityLabel: "Instance",
    showGlobalQuantityControl: true,
    usesSharedBillingHeader: true,
    catalog: { route: "elb-pricing" },
    showSharedUsageHoursExpression: "false",
    catalogViewExpression: `(() => {
      const type = values.type === 'Dedicated load balancer' ? 'Dedicated load balancer' : 'Shared load balancer';
      const specificationType = values.specificationType === 'Elastic' ? 'Elastic' : 'Fixed';
      const networkType = values.networkType === 'Private network' ? 'Private network' : 'Public network';
      const sharedChargeMode = values.sharedChargeMode === 'By bandwidth' ? 'By bandwidth' : 'By traffic';
      const sharedBandwidthMbit = helpers.normalizeObsPositiveNumber(values.sharedBandwidthMbit, 0, 0);
      const sharedTrafficAmount = helpers.normalizeObsPositiveNumber(values.sharedTrafficAmount, 0, 0);
      const sharedTrafficUnit = values.sharedTrafficUnit === 'TB' ? 'TB' : 'GB';
      const fixedAvailabilityAzCountOptions = (() => {
        const rateSet = catalog?.dedicatedRates?.fixed?.[helpers.elbDefaults.subAz];
        if (!rateSet) return [String(helpers.elbDefaults.fixedAvailabilityAzCount)];
        const options = Object.keys(rateSet).map(Number).filter((value) => Number.isFinite(value) && value > 0).sort((left, right) => left - right).map(String);
        return options.length > 0 ? options : [String(helpers.elbDefaults.fixedAvailabilityAzCount)];
      })();
      const fixedAvailabilityAzCount = Number.isFinite(Number(values.fixedAvailabilityAzCount)) ? Math.max(1, Math.floor(Number(values.fixedAvailabilityAzCount))) : Number(fixedAvailabilityAzCountOptions[0] ?? helpers.elbDefaults.fixedAvailabilityAzCount);
      const fixedNetworkEnabled = values.fixedNetworkEnabled === 'true';
      const fixedApplicationEnabled = values.fixedApplicationEnabled === 'true';
      const fixedNetworkSpec = helpers.elbFixedSpecOptions.includes(values.fixedNetworkSpec) ? values.fixedNetworkSpec : helpers.elbDefaults.fixedTypeSpecs['Network load balancing (TCP/UDP/TLS)'];
      const fixedApplicationSpec = helpers.elbFixedSpecOptions.includes(values.fixedApplicationSpec) ? values.fixedApplicationSpec : helpers.elbDefaults.fixedTypeSpecs['Application load balancing (HTTP/HTTPS)'];
      const showSharedChargeMode = helpers.shouldShowElbSharedChargeMode(type, networkType);
      const showSharedBandwidth = helpers.shouldShowElbSharedBandwidth(type, networkType, sharedChargeMode);
      const showSharedTraffic = helpers.shouldShowElbSharedTraffic(type, networkType, sharedChargeMode);
      const protocols = [
        { protocol: 'Network load balancing (TCP)', prefix: 'tcp' },
        { protocol: 'Network load balancing (UDP)', prefix: 'udp' },
        { protocol: 'Network load balancing (TLS)', prefix: 'tls' },
        { protocol: 'Application load balancing (HTTP/HTTPS)', prefix: 'http' },
      ].map(({ protocol, prefix }) => {
        const enabled = values[prefix + 'Enabled'] === 'true';
        const metricMode = values[prefix + 'MetricMode'] === 'By bandwidth' ? 'By bandwidth' : 'By traffic';
        return {
          protocol,
          prefix,
          enabled,
          input: {
            newConnections: helpers.normalizeObsPositiveNumber(values[prefix + 'NewConnections'], 0, 0),
            maxConcurrentConnections: helpers.normalizeObsPositiveNumber(values[prefix + 'MaxConcurrentConnections'], 0, 0),
            metricMode,
            processedTrafficGbPerHour: helpers.normalizeObsPositiveNumber(values[prefix + 'ProcessedTrafficGbPerHour'], 0, 0),
            averageBandwidthMbit: helpers.normalizeObsPositiveNumber(values[prefix + 'AverageBandwidthMbit'], 0, 0),
            queriesPerSecond: prefix === 'http' ? helpers.normalizeObsPositiveNumber(values.httpQueriesPerSecond, 0, 0) : 0,
            forwardingRules: prefix === 'http' ? helpers.normalizeObsPositiveNumber(values.httpForwardingRules, 0, 0) : 0,
          },
        };
      });
      const enabledProtocolPrefixes = protocols.filter((entry) => entry.enabled).map((entry) => entry.prefix);
      const normalizedFixedNetworkEnabled = type === 'Dedicated load balancer' && specificationType === 'Fixed' && !fixedNetworkEnabled && !fixedApplicationEnabled ? true : fixedNetworkEnabled;
      const normalizedFixedApplicationEnabled = type === 'Dedicated load balancer' && specificationType === 'Fixed' && !fixedNetworkEnabled && !fixedApplicationEnabled ? false : fixedApplicationEnabled;
      const normalizedProtocols = protocols.map((entry) => entry.prefix === 'tcp' && type === 'Dedicated load balancer' && specificationType === 'Elastic' && enabledProtocolPrefixes.length === 0 ? { ...entry, enabled: true } : entry);
      const selectedProtocols = normalizedProtocols.filter((entry) => entry.enabled).map((entry) => entry.protocol);
      const protocolInputs = Object.fromEntries(normalizedProtocols.map((entry) => [entry.protocol, entry.input]));
      const estimateInput = {
        type,
        specificationType,
        subAz: helpers.elbDefaults.subAz,
        fixedAvailabilityAzCount,
        fixedSelectedTypes: type === 'Dedicated load balancer' && specificationType === 'Fixed'
          ? [
              ...(normalizedFixedNetworkEnabled ? ['Network load balancing (TCP/UDP/TLS)'] : []),
              ...(normalizedFixedApplicationEnabled ? ['Application load balancing (HTTP/HTTPS)'] : []),
            ]
          : [],
        fixedTypeSpecs: {
          'Network load balancing (TCP/UDP/TLS)': fixedNetworkSpec,
          'Application load balancing (HTTP/HTTPS)': fixedApplicationSpec,
        },
        selectedProtocols: type === 'Dedicated load balancer' && specificationType === 'Elastic' ? selectedProtocols : [],
        protocolInputs: type === 'Dedicated load balancer' && specificationType === 'Elastic' ? protocolInputs : {},
        networkType,
        billingMode: billingMode === 'Pay-per-use' ? 'Pay-per-use' : 'Yearly/Monthly',
        sharedDurationHours: usageHoursValue,
        sharedChargeMode,
        sharedTrafficAmount: showSharedTraffic ? sharedTrafficAmount : 0,
        sharedTrafficUnit,
        sharedBandwidthMbit: showSharedBandwidth ? sharedBandwidthMbit : 0,
      };
      const estimate = catalog ? helpers.estimateElbConfiguration(catalog, estimateInput) : null;
      return { type, specificationType, networkType, sharedChargeMode, sharedBandwidthMbit, sharedTrafficAmount, sharedTrafficUnit, fixedAvailabilityAzCountOptions, fixedAvailabilityAzCount, fixedNetworkEnabled: normalizedFixedNetworkEnabled, fixedApplicationEnabled: normalizedFixedApplicationEnabled, fixedNetworkSpec, fixedApplicationSpec, showSharedChargeMode, showSharedBandwidth, showSharedTraffic, protocols: normalizedProtocols, selectedProtocols, protocolInputs, estimate };
    })()`,
    syncValuesExpression: `(() => {
      const next = {
        type: catalogView.type,
        networkType: catalogView.networkType,
        sharedChargeMode: catalogView.sharedChargeMode,
        specificationType: catalogView.specificationType,
        fixedAvailabilityAzCount: String(catalogView.fixedAvailabilityAzCount),
        fixedNetworkEnabled: catalogView.fixedNetworkEnabled ? 'true' : 'false',
        fixedApplicationEnabled: catalogView.fixedApplicationEnabled ? 'true' : 'false',
        fixedNetworkSpec: catalogView.fixedNetworkSpec,
        fixedApplicationSpec: catalogView.fixedApplicationSpec,
      };
      for (const entry of catalogView.protocols) {
        next[entry.prefix + 'Enabled'] = entry.enabled ? 'true' : 'false';
      }
      return next;
    })()`,
    visibilityContextExpression: `({
      showUsageHours: true,
      showSharedBandwidth: catalogView.showSharedBandwidth,
      showSharedTraffic: catalogView.showSharedTraffic,
      type: catalogView.type,
      specificationType: catalogView.specificationType,
      networkType: catalogView.networkType,
      fixedNetworkEnabled: catalogView.fixedNetworkEnabled,
      fixedApplicationEnabled: catalogView.fixedApplicationEnabled,
      tcpEnabled: catalogView.protocols.find((entry) => entry.prefix === 'tcp')?.enabled ?? false,
      tcpMetricMode: values.tcpMetricMode === 'By bandwidth' ? 'By bandwidth' : 'By traffic',
      udpEnabled: catalogView.protocols.find((entry) => entry.prefix === 'udp')?.enabled ?? false,
      udpMetricMode: values.udpMetricMode === 'By bandwidth' ? 'By bandwidth' : 'By traffic',
      tlsEnabled: catalogView.protocols.find((entry) => entry.prefix === 'tls')?.enabled ?? false,
      tlsMetricMode: values.tlsMetricMode === 'By bandwidth' ? 'By bandwidth' : 'By traffic',
      httpEnabled: catalogView.protocols.find((entry) => entry.prefix === 'http')?.enabled ?? false,
      httpMetricMode: values.httpMetricMode === 'By bandwidth' ? 'By bandwidth' : 'By traffic',
    })`,
    activeBillingOptionsExpression: "helpers.getElbBillingOptions(catalogView.type)",
    fieldRuntime: {
      fixedAvailabilityAzCount: { optionsExpression: "helpers.optionList(catalogView.fixedAvailabilityAzCountOptions)" },
      sharedBandwidthMbit: { minExpression: "0" },
      sharedTrafficAmount: { minExpression: "0" },
      tcpNewConnections: { minExpression: "0" },
      tcpMaxConcurrentConnections: { minExpression: "0" },
      tcpProcessedTrafficGbPerHour: { minExpression: "0" },
      tcpAverageBandwidthMbit: { minExpression: "0" },
      udpNewConnections: { minExpression: "0" },
      udpMaxConcurrentConnections: { minExpression: "0" },
      udpProcessedTrafficGbPerHour: { minExpression: "0" },
      udpAverageBandwidthMbit: { minExpression: "0" },
      tlsNewConnections: { minExpression: "0" },
      tlsMaxConcurrentConnections: { minExpression: "0" },
      tlsProcessedTrafficGbPerHour: { minExpression: "0" },
      tlsAverageBandwidthMbit: { minExpression: "0" },
      httpNewConnections: { minExpression: "0" },
      httpMaxConcurrentConnections: { minExpression: "0" },
      httpProcessedTrafficGbPerHour: { minExpression: "0" },
      httpAverageBandwidthMbit: { minExpression: "0" },
      httpQueriesPerSecond: { minExpression: "0" },
      httpForwardingRules: { minExpression: "0" },
    },
    estimateExpression: "catalogView.estimate",
    addToListErrorExpression: "catalogView.estimate ? null : (pricingError || 'ELB pricing is unavailable for the current selection.')",
    selectionSummaryExpression: "catalogView.estimate ? `Selected specifications: ${catalogView.type}${catalogView.type === 'Dedicated load balancer' ? ` | ${catalogView.specificationType}` : ''}${catalogView.type === 'Dedicated load balancer' && catalogView.specificationType === 'Fixed' ? ` | ${catalogView.fixedAvailabilityAzCount} AZs` : ''} | ${catalogView.networkType}${catalogView.showSharedChargeMode ? ` | ${catalogView.sharedChargeMode}${catalogView.showSharedBandwidth ? ` | ${catalogView.sharedBandwidthMbit} Mbit/s` : ''}${catalogView.showSharedTraffic ? ` | ${catalogView.sharedTrafficAmount} ${catalogView.sharedTrafficUnit}` : ''}` : ''}${catalogView.type === 'Dedicated load balancer' ? ` | ${catalogView.estimate.estimatedLcus.total} estimated LCU` : ''} | ${helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix)}` : 'Selected specifications:'",
    selectionNotesExpression: "catalogView.estimate ? [...helpers.formatBreakdownNotes(catalogView.estimate.currency, catalogView.estimate.suffix, catalogView.estimate.breakdown), ...helpers.asArray(catalogView.estimate.notes)] : []",
    referenceNoteExpression: "`Pricing sourced from Huawei Cloud ELB calculator API for ${catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Sources: ${helpers.elbPricingReference.pricingUrl}, ${helpers.elbPricingReference.fixedDrawerNetworkUrl}, and ${helpers.elbPricingReference.fixedDrawerAppUrl}`",
    buildRequestBodiesExpression: `catalogView.estimate ? ({
      serviceCode: selectedServiceCode,
      serviceName: selectedService,
      productType: 'elb',
      title: \`\${selectedService} \${catalogView.type}\`,
      quantity: instanceCountValue,
      config: {
        region: regionValue,
        catalogRegionId: catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue),
        billingMode: billingMode === 'Pay-per-use' ? 'Pay-per-use' : 'Yearly/Monthly',
        type: catalogView.type,
        specificationType: catalogView.specificationType,
        subAz: helpers.elbDefaults.subAz,
        fixedAvailabilityAzCount: catalogView.type === 'Dedicated load balancer' && catalogView.specificationType === 'Fixed' ? catalogView.fixedAvailabilityAzCount : null,
        fixedSelectedTypes: catalogView.type === 'Dedicated load balancer' && catalogView.specificationType === 'Fixed'
          ? [
              ...(catalogView.fixedNetworkEnabled ? ['Network load balancing (TCP/UDP/TLS)'] : []),
              ...(catalogView.fixedApplicationEnabled ? ['Application load balancing (HTTP/HTTPS)'] : []),
            ]
          : [],
        fixedTypeSpecs: catalogView.type === 'Dedicated load balancer' && catalogView.specificationType === 'Fixed'
          ? {
              'Network load balancing (TCP/UDP/TLS)': catalogView.fixedNetworkSpec,
              'Application load balancing (HTTP/HTTPS)': catalogView.fixedApplicationSpec,
            }
          : {},
        networkType: catalogView.networkType,
        sharedChargeMode: catalogView.showSharedChargeMode ? catalogView.sharedChargeMode : null,
        sharedBandwidthMbit: catalogView.showSharedBandwidth ? catalogView.sharedBandwidthMbit : null,
        sharedTrafficAmount: catalogView.showSharedTraffic ? catalogView.sharedTrafficAmount : null,
        sharedTrafficUnit: catalogView.showSharedTraffic ? catalogView.sharedTrafficUnit : null,
        selectedProtocols: catalogView.type === 'Dedicated load balancer' && catalogView.specificationType === 'Elastic' ? catalogView.selectedProtocols : [],
        protocolInputs: catalogView.type === 'Dedicated load balancer' && catalogView.specificationType === 'Elastic' ? catalogView.protocolInputs : {},
        estimatedNetworkLcus: catalogView.estimate.estimatedLcus.network,
        estimatedApplicationLcus: catalogView.estimate.estimatedLcus.application,
        estimatedTotalLcus: catalogView.estimate.estimatedLcus.total,
        selectedNetworkSpecLcus: catalogView.estimate.selectedSpecLcus.network,
        selectedApplicationSpecLcus: catalogView.estimate.selectedSpecLcus.application,
        usageHours: usageHoursValue,
      },
      pricing: {
        total: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount * instanceCountValue, catalogView.estimate.suffix),
        estimate: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix),
        monthlyAverage: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.monthlyAverageAmount, '/mo'),
        breakdown: helpers.byLabelAmount(catalogView.estimate.currency, catalogView.estimate.suffix, catalogView.estimate.breakdown),
      },
    }) : null`,
    hydrateExpression: `(() => {
      if (product.productType !== 'elb' || !helpers.isRecord(product.config)) {
        return { handled: false, error: 'This product cannot be edited from the calculator.' };
      }
      const fixedSelectedTypes = Array.isArray(product.config.fixedSelectedTypes) ? product.config.fixedSelectedTypes.filter((entry) => typeof entry === 'string') : [];
      const fixedTypeSpecs = helpers.isRecord(product.config.fixedTypeSpecs) ? product.config.fixedTypeSpecs : {};
      const selectedProtocols = Array.isArray(product.config.selectedProtocols) ? product.config.selectedProtocols.filter((entry) => typeof entry === 'string') : [];
      const protocolInputs = helpers.isRecord(product.config.protocolInputs) ? product.config.protocolInputs : {};
      return {
        handled: true,
        values: {
          type: product.config.type === 'Dedicated load balancer' ? 'Dedicated load balancer' : 'Shared load balancer',
          specificationType: product.config.specificationType === 'Elastic' ? 'Elastic' : 'Fixed',
          networkType: product.config.networkType === 'Private network' ? 'Private network' : 'Public network',
          sharedChargeMode: product.config.sharedChargeMode === 'By bandwidth' ? 'By bandwidth' : 'By traffic',
          usageHours: typeof product.config.usageHours === 'number' ? String(Math.max(1, Math.floor(product.config.usageHours))) : '744',
          sharedBandwidthMbit: typeof product.config.sharedBandwidthMbit === 'number' ? String(Math.max(0, product.config.sharedBandwidthMbit)) : String(helpers.elbDefaults.sharedBandwidthMbit),
          sharedTrafficAmount: typeof product.config.sharedTrafficAmount === 'number' ? String(Math.max(0, product.config.sharedTrafficAmount)) : String(helpers.elbDefaults.sharedTrafficGb),
          sharedTrafficUnit: product.config.sharedTrafficUnit === 'TB' ? 'TB' : 'GB',
          fixedAvailabilityAzCount: typeof product.config.fixedAvailabilityAzCount === 'number' ? String(Math.max(1, Math.floor(product.config.fixedAvailabilityAzCount))) : String(helpers.elbDefaults.fixedAvailabilityAzCount),
          fixedNetworkEnabled: fixedSelectedTypes.includes('Network load balancing (TCP/UDP/TLS)') ? 'true' : 'false',
          fixedNetworkSpec: typeof fixedTypeSpecs['Network load balancing (TCP/UDP/TLS)'] === 'string' ? String(fixedTypeSpecs['Network load balancing (TCP/UDP/TLS)']) : helpers.elbDefaults.fixedTypeSpecs['Network load balancing (TCP/UDP/TLS)'],
          fixedApplicationEnabled: fixedSelectedTypes.includes('Application load balancing (HTTP/HTTPS)') ? 'true' : 'false',
          fixedApplicationSpec: typeof fixedTypeSpecs['Application load balancing (HTTP/HTTPS)'] === 'string' ? String(fixedTypeSpecs['Application load balancing (HTTP/HTTPS)']) : helpers.elbDefaults.fixedTypeSpecs['Application load balancing (HTTP/HTTPS)'],
          tcpEnabled: selectedProtocols.includes('Network load balancing (TCP)') ? 'true' : 'false',
          udpEnabled: selectedProtocols.includes('Network load balancing (UDP)') ? 'true' : 'false',
          tlsEnabled: selectedProtocols.includes('Network load balancing (TLS)') ? 'true' : 'false',
          httpEnabled: selectedProtocols.includes('Application load balancing (HTTP/HTTPS)') ? 'true' : 'false',
        },
        nextRegion: typeof product.config.region === 'string' ? product.config.region : regionValue,
        nextBillingMode: product.config.billingMode === 'Yearly/Monthly' ? 'Yearly/Monthly' : 'Pay-per-use',
        nextUsageHours: typeof product.config.usageHours === 'number' ? String(Math.max(1, Math.floor(product.config.usageHours))) : usageHours,
        nextInstanceCount: String(Math.max(1, product.quantity)),
      };
    })()`,
  } satisfies DeclarativeRuntimeDefinition;

export const configurableServiceBundle = {
  service: serviceDefinition,
  pricing: pricingDefinition,
  runtime: convertLegacyRuntimeDefinition(legacyRuntimeDefinition),
} as const satisfies ConfigurableServiceBundleDefinition;
