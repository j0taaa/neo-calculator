import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import type { DeclarativeRuntimeDefinition } from "@/lib/declarative-service-runtime-types";
import { convertLegacyRuntimeDefinition } from "@/lib/legacy-runtime-converter";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";

export const serviceDefinition = {
  "version": 1,
  "definitionId": "vpn",
  "serviceCode": "VPN",
  "serviceName": "Virtual Private Network",
  "icon": "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Networking/VPN.png",
  "implementation": "configurable",
  "billingOptions": [
    "Pay-per-use",
    "Yearly/Monthly"
  ],
  "defaults": {
    "edition": "Classic",
    "mode": "Site-to-Cloud",
    "networkType": "Public network",
    "specification": "Basic",
    "useSharedBandwidth": "No",
    "eipBandwidthMbit1": 10,
    "eipBandwidthMbit2": 10,
    "durationMonths": 1
  },
  "fields": [
    {
      "id": "edition",
      "type": "select",
      "label": "VPN Edition",
      "required": true,
      "options": [
        "Classic",
        "Enterprise"
      ]
    },
    {
      "id": "mode",
      "type": "select",
      "label": "Mode",
      "required": true,
      "optionsSource": "catalog.modes",
      "visibleWhen": {
        "field": "edition",
        "equals": "Enterprise"
      }
    },
    {
      "id": "networkType",
      "type": "select",
      "label": "Network Type",
      "required": true,
      "options": [
        "Public network",
        "Private network"
      ],
      "visibleWhen": {
        "field": "edition",
        "equals": "Enterprise"
      }
    },
    {
      "id": "specification",
      "type": "select",
      "label": "Specification",
      "required": true,
      "optionsSource": "catalog.specifications",
      "visibleWhen": {
        "field": "edition",
        "equals": "Enterprise"
      }
    },
    {
      "id": "useSharedBandwidth",
      "type": "select",
      "label": "Using Shared Bandwidth",
      "required": true,
      "options": [
        "Yes",
        "No"
      ],
      "visibleWhenAll": [
        {
          "field": "edition",
          "equals": "Enterprise"
        },
        {
          "field": "networkType",
          "equals": "Public network"
        }
      ]
    },
    {
      "id": "eipBandwidthMbit1",
      "type": "number",
      "label": "EIP 1 Bandwidth",
      "required": true,
      "unit": "Mbit/s",
      "inputMode": "decimal",
      "min": 0,
      "visibleWhenAll": [
        {
          "field": "edition",
          "equals": "Enterprise"
        },
        {
          "field": "networkType",
          "equals": "Public network"
        }
      ]
    },
    {
      "id": "eipBandwidthMbit2",
      "type": "number",
      "label": "EIP 2 Bandwidth",
      "required": true,
      "unit": "Mbit/s",
      "inputMode": "decimal",
      "min": 0,
      "visibleWhenAll": [
        {
          "field": "edition",
          "equals": "Enterprise"
        },
        {
          "field": "networkType",
          "equals": "Public network"
        }
      ]
    },
    {
      "id": "durationMonths",
      "type": "select",
      "label": "Required Duration",
      "required": true,
      "options": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        12,
        24,
        36
      ],
      "visibleWhen": {
        "field": "billingMode",
        "equals": "Yearly/Monthly"
      }
    }
  ],
  "summary": {
    "selectionTemplate": "{edition} | {mode} | {networkType} | {specification}",
    "notes": [
      "Specification options are derived from the current calculator catalog and remain read-only in the generated form."
    ]
  }
} satisfies ServiceDefinition;

export const pricingDefinition = {
  "version": 1,
  "definitionId": "vpn",
  "serviceCode": "VPN",
  "serviceName": "Virtual Private Network",
  "catalogAdapter": "vpn",
  "rateSources": {
    "gateway": {
      "catalogKey": "gateway.rate"
    },
    "publicBandwidth": {
      "catalogKey": "publicBandwidth.rate"
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
    },
    {
      "id": "publicBandwidth1",
      "label": "EIP 1 bandwidth",
      "rateSource": "publicBandwidth",
      "quantity": {
        "source": "field",
        "field": "eipBandwidthMbit1"
      },
      "enabledWhen": {
        "field": "networkType",
        "equals": "Public network"
      }
    },
    {
      "id": "publicBandwidth2",
      "label": "EIP 2 bandwidth",
      "rateSource": "publicBandwidth",
      "quantity": {
        "source": "field",
        "field": "eipBandwidthMbit2"
      },
      "enabledWhen": {
        "field": "networkType",
        "equals": "Public network"
      }
    }
  ]
} satisfies PricingDefinition;

const legacyRuntimeDefinition = {
    quantityLabel: "Gateway",
    showGlobalQuantityControl: true,
    usesSharedBillingHeader: true,
    catalog: { route: "vpn-pricing" },
    catalogViewExpression: `(() => {
      const activeCatalog = catalog ?? helpers.getFallbackVpnPricingCatalog();
      const edition = billingMode === 'Yearly/Monthly' ? 'Enterprise' : (values.edition === 'Enterprise' ? 'Enterprise' : 'Classic');
      const modeOptions = helpers.listVpnModes(activeCatalog, { billingMode: billingMode === 'Pay-per-use' ? 'Pay-per-use' : 'Yearly/Monthly', edition });
      const mode = edition === 'Classic' ? 'Site-to-Cloud' : (modeOptions.includes(values.mode) ? values.mode : (modeOptions[0] ?? helpers.vpnDefaults.mode));
      const networkType = edition === 'Classic' ? 'Public network' : (values.networkType === 'Private network' ? 'Private network' : 'Public network');
      const specificationOptions = helpers.listVpnSpecifications(mode, activeCatalog);
      const specification = edition === 'Classic' ? 'Basic' : (specificationOptions[0] ?? (mode === 'Point-to-Cloud' ? 'Professional 1' : 'Professional 2'));
      const useSharedBandwidth = edition === 'Classic' ? false : values.useSharedBandwidth === 'Yes';
      const eipBandwidthMbit1 = Math.max(0, Number(values.eipBandwidthMbit1) || helpers.vpnDefaults.eipBandwidthMbit1);
      const eipBandwidthMbit2 = Math.max(0, Number(values.eipBandwidthMbit2) || helpers.vpnDefaults.eipBandwidthMbit2);
      const durationMonths = [1,2,3,4,5,6,7,8,9,12,24,36].includes(Number(values.durationMonths)) ? Number(values.durationMonths) : helpers.vpnDefaults.durationMonths;
      const showPublicBandwidth = helpers.shouldShowVpnPublicBandwidth(edition, networkType);
      const availableBillingOptions = helpers.getVpnBillingOptions(activeCatalog, { mode, networkType, specification, accessViaNonFixedIp: 'Off' });
      const estimate = helpers.estimateVpnConfiguration(activeCatalog, { mode, networkType, specification, billingMode: billingMode === 'Pay-per-use' ? 'Pay-per-use' : 'Yearly/Monthly', accessViaNonFixedIp: 'Off', connectionGroups: 10, useSharedBandwidth, eipBandwidthMbit1, eipBandwidthMbit2, usageHours: usageHoursValue, durationMonths });
      return { activeCatalog, edition, modeOptions, mode, networkType, specificationOptions, specification, useSharedBandwidth, eipBandwidthMbit1, eipBandwidthMbit2, durationMonths, showPublicBandwidth, availableBillingOptions, estimate };
    })()`,
    syncValuesExpression: "({ edition: catalogView.edition, mode: catalogView.mode, networkType: catalogView.networkType, useSharedBandwidth: catalogView.useSharedBandwidth ? 'Yes' : 'No', specification: catalogView.specification, eipBandwidthMbit1: String(catalogView.eipBandwidthMbit1), eipBandwidthMbit2: String(catalogView.eipBandwidthMbit2), durationMonths: String(catalogView.durationMonths) })",
    activeBillingOptionsExpression: "catalogView.availableBillingOptions.length > 0 ? catalogView.availableBillingOptions : ['Yearly/Monthly']",
    fieldRuntime: {
      edition: { optionsExpression: "helpers.optionList(billingMode === 'Yearly/Monthly' ? ['Enterprise'] : ['Classic', 'Enterprise'])" },
      mode: { optionsExpression: "helpers.optionList(catalogView.modeOptions)" },
      specification: { optionsExpression: "helpers.optionList(catalogView.specificationOptions)", disabledExpression: "true" },
      eipBandwidthMbit1: { minExpression: "0", normalizeExpression: "String(catalogView.eipBandwidthMbit1)" },
      eipBandwidthMbit2: { minExpression: "0", normalizeExpression: "String(catalogView.eipBandwidthMbit2)" },
    },
    estimateExpression: "catalogView.estimate",
    addToListErrorExpression: "catalogView.estimate ? null : (pricingError || 'VPN pricing is unavailable for the current selection.')",
    selectionSummaryExpression: "catalogView.estimate ? `Selected specifications: ${catalogView.edition}${catalogView.edition === 'Enterprise' ? ` | ${catalogView.mode} | ${catalogView.networkType} | ${catalogView.specification}${catalogView.showPublicBandwidth ? ` | ${catalogView.useSharedBandwidth ? 'Shared' : 'Dedicated'} bandwidth | EIP1 ${catalogView.eipBandwidthMbit1} Mbit/s | EIP2 ${catalogView.eipBandwidthMbit2} Mbit/s` : ''}` : ''}${billingMode === 'Yearly/Monthly' ? ` | ${catalogView.durationMonths}mo` : ''} | ${helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix)}` : 'Selected specifications:'",
    selectionNotesExpression: "catalogView.estimate ? [...helpers.formatBreakdownNotes(catalogView.estimate.currency, catalogView.estimate.suffix, catalogView.estimate.breakdown), `Monthly average: ${helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.monthlyAverageAmount, '/mo')}.`, ...helpers.asArray(catalogView.estimate.notes)] : []",
    referenceNoteExpression: "`Pricing sourced from Huawei Cloud VPN calculator API for ${catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Sources: ${helpers.vpnPricingReference.pricingUrl}, ${helpers.vpnPricingReference.productUrl}, and ${helpers.vpnPricingReference.specsUrl}`",
    buildRequestBodiesExpression: `catalogView.estimate ? ({
      serviceCode: selectedServiceCode,
      serviceName: selectedService,
      productType: 'vpn',
      title: \`\${selectedService} \${catalogView.edition} \${catalogView.mode} \${catalogView.specification}\`,
      quantity: instanceCountValue,
      config: {
        region: regionValue,
        catalogRegionId: catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue),
        billingMode: billingMode === 'Pay-per-use' ? 'Pay-per-use' : 'Yearly/Monthly',
        edition: catalogView.edition,
        mode: catalogView.mode,
        networkType: catalogView.networkType,
        specification: catalogView.specification,
        accessViaNonFixedIp: 'Off',
        connectionGroups: 10,
        useSharedBandwidth: catalogView.showPublicBandwidth ? catalogView.useSharedBandwidth : null,
        eipBandwidthMbit1: catalogView.showPublicBandwidth ? catalogView.eipBandwidthMbit1 : null,
        eipBandwidthMbit2: catalogView.showPublicBandwidth ? catalogView.eipBandwidthMbit2 : null,
        durationMonths: billingMode === 'Yearly/Monthly' ? catalogView.durationMonths : null,
        usageHours: billingMode === 'Pay-per-use' ? usageHoursValue : null,
        gatewayResourceSpecCode: catalogView.estimate.gatewayTier.resourceSpecCode,
        bandwidthResourceSpecCode: catalogView.estimate.bandwidthTier?.resourceSpecCode ?? null,
      },
      pricing: {
        total: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount * instanceCountValue, catalogView.estimate.suffix),
        estimate: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix),
        monthlyAverage: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.monthlyAverageAmount, '/mo'),
        breakdown: helpers.byLabelAmount(catalogView.estimate.currency, catalogView.estimate.suffix, catalogView.estimate.breakdown),
      },
    }) : null`,
    hydrateExpression: `(() => {
      if (product.productType !== 'vpn' || !helpers.isRecord(product.config)) {
        return { handled: false, error: 'This product cannot be edited from the calculator.' };
      }
      return {
        handled: true,
        values: {
          edition: product.config.edition === 'Enterprise' ? 'Enterprise' : 'Classic',
          mode: product.config.mode === 'Point-to-Cloud' ? 'Point-to-Cloud' : 'Site-to-Cloud',
          networkType: product.config.networkType === 'Private network' ? 'Private network' : 'Public network',
          useSharedBandwidth: product.config.useSharedBandwidth === true ? 'Yes' : 'No',
          eipBandwidthMbit1: typeof product.config.eipBandwidthMbit1 === 'number' ? String(product.config.eipBandwidthMbit1) : String(helpers.vpnDefaults.eipBandwidthMbit1),
          eipBandwidthMbit2: typeof product.config.eipBandwidthMbit2 === 'number' ? String(product.config.eipBandwidthMbit2) : String(helpers.vpnDefaults.eipBandwidthMbit2),
          durationMonths: typeof product.config.durationMonths === 'number' ? String(product.config.durationMonths) : String(helpers.vpnDefaults.durationMonths),
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
