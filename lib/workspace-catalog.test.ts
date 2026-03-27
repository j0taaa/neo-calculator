import { expect, test } from "bun:test";

import {
  estimateWorkspaceConfiguration,
  listWorkspaceCpuOptions,
  listWorkspaceDiskTypes,
  listWorkspaceMemoryOptions,
} from "@/lib/workspace-catalog";
import { parseWorkspacePricingCatalogResponse } from "@/lib/workspace-pricing";

const fixture = {
  product: {
    workspace_desktop: [
      {
        architecture: "x86",
        packageType: "ultimate",
        cpu: "2",
        memory: "4096",
        resourceSpecCode: "workspace.desktop.2vcpu.4gb",
        planList: [{ productId: "workspace.x86.ultimate.large1", billingMode: "ONDEMAND", amount: 0.10499999 }],
      },
      {
        architecture: "x86",
        packageType: "ultimate",
        cpu: "2",
        memory: "8192",
        resourceSpecCode: "workspace.desktop.2vcpu.8gb",
        planList: [{ productId: "workspace.x86.ultimate.large2", billingMode: "ONDEMAND", amount: 0.125 }],
      },
      {
        architecture: "x86",
        packageType: "ultimate",
        cpu: "4",
        memory: "8192",
        resourceSpecCode: "workspace.desktop.4vcpu.8gb",
        planList: [{ productId: "workspace.x86.ultimate.xlarge2", billingMode: "ONDEMAND", amount: 0.22299731 }],
      },
      {
        architecture: "x86",
        packageType: "ultimate",
        cpu: "4",
        memory: "16384",
        resourceSpecCode: "workspace.desktop.4vcpu.16gb",
        planList: [{ productId: "workspace.x86.ultimate.xlarge4", billingMode: "ONDEMAND", amount: 0.26233535 }],
      },
      {
        architecture: "x86",
        packageType: "ultimate",
        cpu: "8",
        memory: "16384",
        resourceSpecCode: "workspace.desktop.8vcpu.16gb",
        planList: [{ productId: "workspace.x86.ultimate.2xlarge2", billingMode: "ONDEMAND", amount: 0.46313172 }],
      },
      {
        architecture: "x86",
        packageType: "ultimate",
        cpu: "8",
        memory: "32768",
        resourceSpecCode: "workspace.desktop.8vcpu.32gb",
        planList: [{ productId: "workspace.x86.ultimate.2xlarge4", billingMode: "ONDEMAND", amount: 0.50322151 }],
      },
    ],
    workspace_volume: [
      {
        type: "SAS",
        resourceSpecCode: "workspace.volume.high",
        planList: [{ productId: "workspace.volume.high", billingMode: "ONDEMAND", amount: 0.0003225806 }],
      },
      {
        type: "SSD",
        resourceSpecCode: "workspace.volume.ultrahigh",
        planList: [{ productId: "workspace.volume.ultrahigh", billingMode: "ONDEMAND", amount: 0.0005208333 }],
      },
      {
        type: "GPSSD",
        resourceSpecCode: "workspace.volume.gpssd",
        planList: [{ productId: "workspace.volume.gpssd", billingMode: "ONDEMAND", amount: 0.00044 }],
      },
    ],
  },
};

test("Workspace parser extracts CPU, memory, and disk options from productInfo", () => {
  const catalog = parseWorkspacePricingCatalogResponse(fixture, "ap-southeast-1");

  expect(listWorkspaceCpuOptions(catalog)).toEqual(["2 vCPUs", "4 vCPUs", "8 vCPUs"]);
  expect(listWorkspaceMemoryOptions(catalog, "2 vCPUs")).toEqual(["4 GB", "8 GB"]);
  expect(listWorkspaceMemoryOptions(catalog, "4 vCPUs")).toEqual(["8 GB", "16 GB"]);
  expect(listWorkspaceMemoryOptions(catalog, "8 vCPUs")).toEqual(["16 GB", "32 GB"]);
  expect(listWorkspaceDiskTypes(catalog)).toEqual(["High I/O", "Ultra-high I/O", "General purpose SSD"]);
});

test("Workspace estimator matches the documented example prices", () => {
  const catalog = parseWorkspacePricingCatalogResponse(fixture, "ap-southeast-1");

  const small = estimateWorkspaceConfiguration(catalog, {
    architecture: "x86 desktop",
    specification: "Ultimate",
    cpu: "2 vCPUs",
    memory: "4 GB",
    cpuUsageHours: 744,
    diskType: "High I/O",
    diskSizeGb: 80,
    diskUsageHours: 744,
    quantity: 1,
  });
  const medium = estimateWorkspaceConfiguration(catalog, {
    architecture: "x86 desktop",
    specification: "Ultimate",
    cpu: "4 vCPUs",
    memory: "8 GB",
    cpuUsageHours: 744,
    diskType: "High I/O",
    diskSizeGb: 80,
    diskUsageHours: 744,
    quantity: 1,
  });
  const large = estimateWorkspaceConfiguration(catalog, {
    architecture: "x86 desktop",
    specification: "Ultimate",
    cpu: "8 vCPUs",
    memory: "16 GB",
    cpuUsageHours: 744,
    diskType: "Ultra-high I/O",
    diskSizeGb: 80,
    diskUsageHours: 744,
    quantity: 1,
  });

  expect(small?.amount).toBeCloseTo(97.32, 2);
  expect(medium?.amount).toBeCloseTo(185.11, 2);
  expect(large?.amount).toBeCloseTo(375.57, 2);
});
