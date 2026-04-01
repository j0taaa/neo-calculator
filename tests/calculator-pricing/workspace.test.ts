import { expect, test } from "bun:test";

import { estimateWorkspaceConfiguration, type WorkspacePricingCatalog } from "@/lib/workspace-catalog";

const catalog: WorkspacePricingCatalog = {
  currency: "USD",
  regionId: "sa-brazil-1",
  architecture: "x86 desktop",
  specification: "Ultimate",
  desktopTiers: [
    {
      architecture: "x86 desktop",
      specification: "Ultimate",
      cpu: "2 vCPUs",
      memory: "4 GB",
      cpuCount: 2,
      memoryGiB: 4,
      resourceSpecCode: "workspace.desktop.2vcpu.4gb",
      prices: { ONDEMAND: 0.10499999 },
      productIds: { ONDEMAND: "workspace.x86.ultimate.large1" },
    },
    {
      architecture: "x86 desktop",
      specification: "Ultimate",
      cpu: "4 vCPUs",
      memory: "8 GB",
      cpuCount: 4,
      memoryGiB: 8,
      resourceSpecCode: "workspace.desktop.4vcpu.8gb",
      prices: { ONDEMAND: 0.22299731 },
      productIds: { ONDEMAND: "workspace.x86.ultimate.xlarge2" },
    },
    {
      architecture: "x86 desktop",
      specification: "Ultimate",
      cpu: "8 vCPUs",
      memory: "16 GB",
      cpuCount: 8,
      memoryGiB: 16,
      resourceSpecCode: "workspace.desktop.8vcpu.16gb",
      prices: { ONDEMAND: 0.46313172 },
      productIds: { ONDEMAND: "workspace.x86.ultimate.2xlarge2" },
    },
  ],
  diskTiers: [
    {
      diskType: "High I/O",
      resourceSpecCode: "workspace.volume.high",
      prices: { ONDEMAND: 0.0003225806 },
      productIds: { ONDEMAND: "workspace.volume.high" },
    },
    {
      diskType: "Ultra-high I/O",
      resourceSpecCode: "workspace.volume.ultrahigh",
      prices: { ONDEMAND: 0.0005208333 },
      productIds: { ONDEMAND: "workspace.volume.ultrahigh" },
    },
  ],
};

test("Workspace documented examples stay aligned", () => {
  expect(
    estimateWorkspaceConfiguration(catalog, {
      architecture: "x86 desktop",
      specification: "Ultimate",
      cpu: "2 vCPUs",
      memory: "4 GB",
      cpuUsageHours: 744,
      diskType: "High I/O",
      diskSizeGb: 80,
      diskUsageHours: 744,
      quantity: 1,
    })?.amount,
  ).toBeCloseTo(97.32, 2);

  expect(
    estimateWorkspaceConfiguration(catalog, {
      architecture: "x86 desktop",
      specification: "Ultimate",
      cpu: "4 vCPUs",
      memory: "8 GB",
      cpuUsageHours: 744,
      diskType: "High I/O",
      diskSizeGb: 80,
      diskUsageHours: 744,
      quantity: 1,
    })?.amount,
  ).toBeCloseTo(185.11, 2);

  expect(
    estimateWorkspaceConfiguration(catalog, {
      architecture: "x86 desktop",
      specification: "Ultimate",
      cpu: "8 vCPUs",
      memory: "16 GB",
      cpuUsageHours: 744,
      diskType: "Ultra-high I/O",
      diskSizeGb: 80,
      diskUsageHours: 744,
      quantity: 1,
    })?.amount,
  ).toBeCloseTo(375.57, 2);
});

test("Workspace rejects impossible disk sizes", () => {
  expect(
    estimateWorkspaceConfiguration(catalog, {
      architecture: "x86 desktop",
      specification: "Ultimate",
      cpu: "2 vCPUs",
      memory: "4 GB",
      cpuUsageHours: 744,
      diskType: "High I/O",
      diskSizeGb: 1,
      diskUsageHours: 744,
      quantity: 1,
    }),
  ).toBeNull();
});
