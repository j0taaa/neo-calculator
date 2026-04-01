import { expect, test } from "bun:test";

import { estimateVpnConfiguration, type VpnPricingCatalog } from "@/lib/vpn-catalog";

const classicCatalog: VpnPricingCatalog = {
  currency: "USD",
  regionId: "sa-brazil-1",
  gateways: [
    {
      mode: "Site-to-Cloud",
      specification: "Basic",
      accessViaNonFixedIp: "Off",
      resourceSpecCode: "ClassicVPN",
      plans: [
        {
          billingMode: "ONDEMAND",
          periodNum: null,
          tiers: [{ start: 0, end: null, amount: 0.05 }],
        },
      ],
    },
  ],
  publicBandwidth: [
    {
      allocation: "Shared bandwidth",
      resourceSpecCode: "classic_bgp",
      plans: [{ billingMode: "ONDEMAND", periodNum: null, amount: 0.023 }],
    },
  ],
};

const enterpriseMonthlyCatalog: VpnPricingCatalog = {
  currency: "USD",
  regionId: "la-south-2",
  gateways: [
    {
      mode: "Site-to-Cloud",
      specification: "Professional 2",
      accessViaNonFixedIp: "Off",
      resourceSpecCode: "V1G",
      plans: [
        {
          billingMode: "MONTHLY",
          periodNum: 1,
          tiers: [
            { start: 0, end: 1, amount: 409 },
            { start: 1, end: null, amount: 8.25 },
          ],
        },
      ],
    },
  ],
  publicBandwidth: [
    {
      allocation: "Dedicated bandwidth",
      resourceSpecCode: "19_bgp",
      plans: [
        { billingMode: "MONTHLY", periodNum: 1, amount: 9 },
      ],
    },
  ],
};

const enterprisePaygCatalog: VpnPricingCatalog = {
  currency: "USD",
  regionId: "la-south-2",
  gateways: [
    {
      mode: "Site-to-Cloud",
      specification: "Professional 2",
      accessViaNonFixedIp: "Off",
      resourceSpecCode: "V300",
      plans: [
        {
          billingMode: "ONDEMAND",
          periodNum: null,
          tiers: [
            { start: 0, end: 1, amount: 0.33 },
            { start: 1, end: null, amount: 0.035 },
          ],
        },
      ],
    },
  ],
  publicBandwidth: [
    {
      allocation: "Shared bandwidth",
      resourceSpecCode: "19_share",
      plans: [
        { billingMode: "ONDEMAND", periodNum: null, amount: 24.3 },
      ],
    },
  ],
};

test("VPN pricing examples stay aligned", () => {
  expect(
    estimateVpnConfiguration(classicCatalog, {
      mode: "Site-to-Cloud",
      networkType: "Public network",
      specification: "Basic",
      billingMode: "Pay-per-use",
      accessViaNonFixedIp: "Off",
      connectionGroups: 1,
      useSharedBandwidth: true,
      eipBandwidthMbit1: 0,
      eipBandwidthMbit2: 0,
      usageHours: 744,
      durationMonths: 1,
    })?.amount,
  ).toBe(37.2);

  expect(
    estimateVpnConfiguration(enterpriseMonthlyCatalog, {
      mode: "Site-to-Cloud",
      networkType: "Public network",
      specification: "Professional 2",
      billingMode: "Yearly/Monthly",
      accessViaNonFixedIp: "Off",
      connectionGroups: 10,
      useSharedBandwidth: false,
      eipBandwidthMbit1: 10,
      eipBandwidthMbit2: 10,
      usageHours: 744,
      durationMonths: 1,
    })?.amount,
  ).toBe(663.25);

  expect(
    estimateVpnConfiguration(enterprisePaygCatalog, {
      mode: "Site-to-Cloud",
      networkType: "Public network",
      specification: "Professional 2",
      billingMode: "Pay-per-use",
      accessViaNonFixedIp: "Off",
      connectionGroups: 1,
      useSharedBandwidth: true,
      eipBandwidthMbit1: 0,
      eipBandwidthMbit2: 0,
      usageHours: 1,
      durationMonths: 1,
    })?.amount,
  ).toBe(0.33);
});

test("VPN rejects unsupported term lengths instead of coercing them", () => {
  expect(
    estimateVpnConfiguration(enterpriseMonthlyCatalog, {
      mode: "Site-to-Cloud",
      networkType: "Public network",
      specification: "Professional 2",
      billingMode: "Yearly/Monthly",
      accessViaNonFixedIp: "Off",
      connectionGroups: 10,
      useSharedBandwidth: false,
      eipBandwidthMbit1: 10,
      eipBandwidthMbit2: 10,
      usageHours: 744,
      durationMonths: 13,
    }),
  ).toBeNull();
});
