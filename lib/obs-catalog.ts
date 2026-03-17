export const obsPricingReference = {
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/obs.html",
  billingUrl: "https://support.huaweicloud.com/intl/en-us/price-obs/obs_42_0009.html",
  packageOverviewUrl: "https://support.huaweicloud.com/intl/en-us/price-obs/obs_42_0020.html",
  hourlyConversionDays: 30,
} as const;

export const obsStorageClasses = [
  {
    id: "standard",
    title: "Standard",
    description: "Frequently accessed data with immediate retrieval.",
    monthlyPriceUsdPerGiB: 0.023,
    minimumStorageDays: 0,
    retrievalSummary: "Immediate",
  },
  {
    id: "infrequent-access",
    title: "Infrequent Access",
    description: "Lower-cost storage with real-time access for colder data.",
    monthlyPriceUsdPerGiB: 0.014,
    minimumStorageDays: 30,
    retrievalSummary: "Immediate",
  },
  {
    id: "archive",
    title: "Archive",
    description: "Long-term archive storage with restore workflows.",
    monthlyPriceUsdPerGiB: 0.0045,
    minimumStorageDays: 90,
    retrievalSummary: "Restore required",
  },
  {
    id: "deep-archive",
    title: "Deep Archive",
    description: "Lowest-cost long-term storage for rarely accessed data.",
    monthlyPriceUsdPerGiB: 0.002,
    minimumStorageDays: 180,
    retrievalSummary: "Restore required",
  },
  {
    id: "intelligent-tiering",
    title: "Intelligent Tiering",
    description: "Automatically moves data to more economical access tiers.",
    monthlyPriceUsdPerGiB: 0.005,
    minimumStorageDays: 0,
    retrievalSummary: "Immediate",
  },
] as const;

export type ObsStorageClass = (typeof obsStorageClasses)[number]["title"];

export function isObsStorageClass(value: unknown): value is ObsStorageClass {
  return typeof value === "string" && obsStorageClasses.some((storageClass) => storageClass.title === value);
}

export function findObsStorageClass(storageClass: ObsStorageClass) {
  return obsStorageClasses.find((entry) => entry.title === storageClass) ?? obsStorageClasses[0];
}

export function estimateObsStoragePrice(storageClass: ObsStorageClass, storageGiB: number, usageHours: number) {
  const selectedClass = findObsStorageClass(storageClass);
  const normalizedStorageGiB = Math.max(1, storageGiB);
  const normalizedUsageHours = Math.max(1, usageHours);
  const monthlyAmount = selectedClass.monthlyPriceUsdPerGiB * normalizedStorageGiB;
  const hourlyRatePerGiB = selectedClass.monthlyPriceUsdPerGiB / (24 * obsPricingReference.hourlyConversionDays);
  const amount = hourlyRatePerGiB * normalizedStorageGiB * normalizedUsageHours;

  return {
    currency: "USD",
    amount,
    suffix: `/${normalizedUsageHours}h`,
    monthlyAmount,
    monthlySuffix: "/mo",
    monthlyRatePerGiB: selectedClass.monthlyPriceUsdPerGiB,
    hourlyRatePerGiB,
    storageClass: selectedClass,
  };
}
