export type FlexusLPlan = {
  id: string;
  title: string;
  vcpu: number;
  ramGiB: number;
  systemDiskGiB: number;
  peakBandwidthMbit: number;
  dataPackageTiB: number;
  monthlyPriceUsd: number;
  orderUrl: string;
};

export const flexusLPricingReference = {
  region: "ap-southeast-3",
  sourceUrl: "https://www.huaweicloud.com/intl/en-us/product/flexus-l.html",
} as const;

export const flexusLPlans: FlexusLPlan[] = [
  {
    id: "basic_v3",
    title: "2 vCPUs | 2 GiB",
    vcpu: 2,
    ramGiB: 2,
    systemDiskGiB: 60,
    peakBandwidthMbit: 30,
    dataPackageTiB: 3,
    monthlyPriceUsd: 9,
    orderUrl: "https://console-intl.huaweicloud.com/smb/?locale=en-us&region=ap-southeast-3#/create/hecs-light?period=month_1&plan=basic_v3",
  },
  {
    id: "basic_v4",
    title: "2 vCPUs | 4 GiB",
    vcpu: 2,
    ramGiB: 4,
    systemDiskGiB: 80,
    peakBandwidthMbit: 30,
    dataPackageTiB: 4,
    monthlyPriceUsd: 19,
    orderUrl: "https://console-intl.huaweicloud.com/smb/?locale=en-us&region=ap-southeast-3#/create/hecs-light?period=month_1&plan=basic_v4",
  },
  {
    id: "basic_v5",
    title: "2 vCPUs | 8 GiB",
    vcpu: 2,
    ramGiB: 8,
    systemDiskGiB: 160,
    peakBandwidthMbit: 30,
    dataPackageTiB: 5,
    monthlyPriceUsd: 39,
    orderUrl: "https://console-intl.huaweicloud.com/smb/?locale=en-us&region=ap-southeast-3#/create/hecs-light?period=month_1&plan=basic_v5",
  },
  {
    id: "basic_v6",
    title: "4 vCPUs | 8 GiB",
    vcpu: 4,
    ramGiB: 8,
    systemDiskGiB: 240,
    peakBandwidthMbit: 30,
    dataPackageTiB: 6,
    monthlyPriceUsd: 59,
    orderUrl: "https://console-intl.huaweicloud.com/smb/?locale=en-us&region=ap-southeast-3#/create/hecs-light?period=month_1&plan=basic_v6",
  },
  {
    id: "basic_v7",
    title: "4 vCPUs | 16 GiB",
    vcpu: 4,
    ramGiB: 16,
    systemDiskGiB: 320,
    peakBandwidthMbit: 30,
    dataPackageTiB: 7,
    monthlyPriceUsd: 79,
    orderUrl: "https://console-intl.huaweicloud.com/smb/?locale=en-us&region=ap-southeast-3#/create/hecs-light?period=month_1&plan=basic_v7",
  },
] as const;

export function findFlexusLPlan(planId: string) {
  return flexusLPlans.find((plan) => plan.id === planId) ?? null;
}

export function findBestFlexusLPlan(vcpu: number, ramGiB: number) {
  const candidates = flexusLPlans
    .filter((plan) => plan.vcpu >= vcpu && plan.ramGiB >= ramGiB)
    .sort((left, right) => {
      if (left.monthlyPriceUsd !== right.monthlyPriceUsd) {
        return left.monthlyPriceUsd - right.monthlyPriceUsd;
      }

      if (left.vcpu !== right.vcpu) {
        return left.vcpu - right.vcpu;
      }

      return left.ramGiB - right.ramGiB;
    });

  return candidates[0] ?? null;
}
