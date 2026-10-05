export const nativeBillingModes = {
  ONDEMAND: { label: "Pay-per-use", chargingMode: 1 },
  PERIOD: { label: "Yearly/Monthly", chargingMode: 0 },
  ONETIME: { label: "One-time", chargingMode: 2 },
  RI: { label: "RI", chargingMode: 10 },
} as const;
export type NativeBillingMode = keyof typeof nativeBillingModes;
export function isNativeBillingMode(value: unknown): value is NativeBillingMode {
  return typeof value === "string" && Object.hasOwn(nativeBillingModes, value);
}
/** Billing availability belongs to Huawei's service/region menu, not a local service table. */
export function nativeBillingDirectory(menu: { menuInfos: { subCategoryLists: { urlPath: string; regionOnline?: Record<string, unknown> }[] }[] }) {
  return Object.fromEntries(menu.menuInfos.flatMap(group => group.subCategoryLists.map(service => [service.urlPath,
    Object.fromEntries(Object.entries(service.regionOnline ?? {}).flatMap(([region, value]) => {
      const modes = (value as { common?: unknown })?.common;
      return Array.isArray(modes) ? [[region, modes.filter(isNativeBillingMode)]] : [];
    })),
  ])));
}
