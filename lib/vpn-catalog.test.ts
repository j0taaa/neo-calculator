import { expect, test } from "bun:test";

import { 
  estimateVpnConfiguration, 
  listVpnSpecifications,
  shouldShowVpnAccessViaNonFixedIp,
  shouldShowVpnConnectionGroups,
  shouldShowVpnEipGroup,
  shouldShowVpnPublicBandwidth,
  type VpnPricingCatalog,
} from "@/lib/vpn-catalog";

const enterpriseCatalog: VpnPricingCatalog = {
  currency: "USD",
  regionId: "sa-brazil-1",
  gateways: [
    {
      mode: "Site-to-Cloud",
      specification: "Professional 2",
      accessViaNonFixedIp: "Off",
      resourceSpecCode: "V1G",
      plans: [
        {
          billingMode: "ONDEMAND",
          periodNum: null,
          tiers: [
            { start: 0, end: 1, amount: 0.63 },
            { start: 1, end: null, amount: 0.035 },
          ],
        },
        {
          billingMode: "MONTHLY",
          periodNum: 1,
          tiers: [
            { start: 0, end: 1, amount: 409 },
            { start: 1, end: null, amount: 8.25 },
          ],
        },
        {
          billingMode: "YEARLY",
          periodNum: 1,
          tiers: [
            { start: 0, end: 1, amount: 4090 },
            { start: 1, end: null, amount: 82.5 },
          ],
        },
      ],
    },
    {
      mode: "Site-to-Cloud",
      specification: "Professional 2",
      accessViaNonFixedIp: "On",
      resourceSpecCode: "S2C-VPN-Ent.Pro2-NonFixedIP",
      plans: [
        {
          billingMode: "MONTHLY",
          periodNum: 1,
          tiers: [
            { start: 0, end: 1, amount: 529 },
            { start: 1, end: null, amount: 8.25 },
          ],
        },
      ],
    },
    {
      mode: "Point-to-Cloud",
      specification: "Professional 1",
      accessViaNonFixedIp: "Off",
      resourceSpecCode: "P2C-VPN-Ent.Pro1",
      plans: [
        {
          billingMode: "MONTHLY",
          periodNum: 1,
          tiers: [
            { start: 0, end: 1, amount: 209 },
            { start: 1, end: 10, amount: 0 },
            { start: 10, end: 50, amount: 2.95 },
            { start: 50, end: 100, amount: 2.25 },
            { start: 100, end: 500, amount: 1.65 },
            { start: 500, end: 1000, amount: 1.55 },
            { start: 1000, end: null, amount: 1.54 },
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
        { billingMode: "ONDEMAND", periodNum: null, amount: 0.0281 },
        { billingMode: "MONTHLY", periodNum: 1, amount: 9 },
        { billingMode: "YEARLY", periodNum: 1, amount: 90 },
      ],
    },
    {
      allocation: "Shared bandwidth",
      resourceSpecCode: "19_share",
      plans: [
        { billingMode: "ONDEMAND", periodNum: null, amount: 0.0281 },
        { billingMode: "MONTHLY", periodNum: 1, amount: 9 },
        { billingMode: "YEARLY", periodNum: 1, amount: 90 },
      ],
    },
  ],
};

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
          tiers: [
            { start: 0, end: null, amount: 0.05 },
          ],
        },
      ],
    },
  ],
  publicBandwidth: [
    {
      allocation: "Shared bandwidth",
      resourceSpecCode: "classic_bgp",
      plans: [
        { billingMode: "ONDEMAND", periodNum: null, amount: 0.023 },
      ],
    },
  ],
};

test("shouldShowVpnAccessViaNonFixedIp returns true only for Enterprise S2C + Public network", () => {
  expect(shouldShowVpnAccessViaNonFixedIp("Site-to-Cloud", "Public network")).toBe(true);
  expect(shouldShowVpnAccessViaNonFixedIp("Site-to-Cloud", "Private network")).toBe(false);
  expect(shouldShowVpnAccessViaNonFixedIp("Point-to-Cloud", "Public network")).toBe(false);
});

test("shouldShowVpnConnectionGroups returns false for Classic edition", () => {
  expect(shouldShowVpnConnectionGroups("Classic")).toBe(false);
  expect(shouldShowVpnConnectionGroups("Enterprise")).toBe(true);
});

test("shouldShowVpnEipGroup returns false for Classic edition", () => {
  expect(shouldShowVpnEipGroup("Classic")).toBe(false);
  expect(shouldShowVpnEipGroup("Enterprise")).toBe(true);
});

test("shouldShowVpnPublicBandwidth returns false for Classic edition", () => {
  expect(shouldShowVpnPublicBandwidth("Classic", "Public network")).toBe(false);
  expect(shouldShowVpnPublicBandwidth("Enterprise", "Public network")).toBe(true);
  expect(shouldShowVpnPublicBandwidth("Enterprise", "Private network")).toBe(false);
});

test("listVpnSpecifications returns Basic for Classic mode", () => {
  const specs = listVpnSpecifications("Site-to-Cloud", classicCatalog);
  expect(specs).toEqual(["Basic"]);
});

test("listVpnSpecifications returns Professional tiers for Enterprise mode", () => {
  const specs = listVpnSpecifications("Site-to-Cloud", enterpriseCatalog);
  expect(specs).toContain("Professional 2");
  
  const p2cSpecs = listVpnSpecifications("Point-to-Cloud", enterpriseCatalog);
  expect(p2cSpecs).toContain("Professional 1");
});

test("estimateVpnConfiguration Classic VPN pay-per-use pricing", () => {
  const estimate = estimateVpnConfiguration(classicCatalog, {
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
  });

  expect(estimate).not.toBeNull();
  expect(estimate!.amount).toBe(37.2);
  expect(estimate!.suffix).toBe("/744h");
  expect(estimate!.breakdown).toHaveLength(1);
  expect(estimate!.breakdown[0]).toEqual({ key: "gateway", label: "VPN gateway", amount: 37.2 });
});

test("estimateVpnConfiguration Enterprise S2C monthly gateway and bandwidth", () => {
  const estimate = estimateVpnConfiguration(enterpriseCatalog, {
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
  });

  expect(estimate).not.toBeNull();
  expect(estimate!.amount).toBe(663.25);
  expect(estimate!.suffix).toBe("/1mo");
});

test("estimateVpnConfiguration excludes public bandwidth for private network pricing", () => {
  const estimate = estimateVpnConfiguration(enterpriseCatalog, {
    mode: "Site-to-Cloud",
    networkType: "Private network",
    specification: "Professional 2",
    billingMode: "Yearly/Monthly",
    accessViaNonFixedIp: "On",
    connectionGroups: 10,
    useSharedBandwidth: false,
    eipBandwidthMbit1: 10,
    eipBandwidthMbit2: 10,
    usageHours: 744,
    durationMonths: 1,
  });

  expect(estimate).not.toBeNull();
  expect(estimate!.amount).toBe(603.25);
  expect(estimate!.breakdown).toHaveLength(1);
});

test("estimateVpnConfiguration prices pay-per-use only when gateway has on-demand tiers", () => {
  const estimate = estimateVpnConfiguration(enterpriseCatalog, {
    mode: "Site-to-Cloud",
    networkType: "Public network",
    specification: "Professional 2",
    billingMode: "Pay-per-use",
    accessViaNonFixedIp: "Off",
    connectionGroups: 10,
    useSharedBandwidth: true,
    eipBandwidthMbit1: 10,
    eipBandwidthMbit2: 10,
    usageHours: 24,
    durationMonths: 1,
  });

  expect(estimate).not.toBeNull();
  expect(estimate!.amount).toBe(36.168);
});

test("estimateVpnConfiguration returns null when no matching gateway tier", () => {
  expect(
    estimateVpnConfiguration(enterpriseCatalog, {
      mode: "Site-to-Cloud",
      networkType: "Private network",
      specification: "Professional 1",
      billingMode: "Pay-per-use",
      accessViaNonFixedIp: "On",
      connectionGroups: 10,
      useSharedBandwidth: false,
      eipBandwidthMbit1: 0,
      eipBandwidthMbit2: 0,
      usageHours: 24,
      durationMonths: 1,
    }),
  ).toBeNull();
});

test("estimateVpnConfiguration Enterprise P2C Point-to-Cloud monthly", () => {
  const estimate = estimateVpnConfiguration(enterpriseCatalog, {
    mode: "Point-to-Cloud",
    networkType: "Public network",
    specification: "Professional 1",
    billingMode: "Yearly/Monthly",
    accessViaNonFixedIp: "Off",
    connectionGroups: 10,
    useSharedBandwidth: false,
    eipBandwidthMbit1: 0,
    eipBandwidthMbit2: 0,
    usageHours: 744,
    durationMonths: 1,
  });

  expect(estimate).not.toBeNull();
  expect(estimate!.amount).toBe(209);
  expect(estimate!.suffix).toBe("/1mo");
});

test("estimateVpnConfiguration supports a single pay-per-use connection group for V300-style pricing", () => {
  const apSingaporeCatalog: VpnPricingCatalog = {
    currency: "USD",
    regionId: "ap-southeast-1",
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

  const estimate = estimateVpnConfiguration(apSingaporeCatalog, {
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
  });

  expect(estimate).not.toBeNull();
  expect(estimate!.amount).toBe(0.33);
  expect(estimate!.suffix).toBe("/1h");
});
