export const nativeBillingModes = {
  ONDEMAND: { label: "Pay-per-use", chargingMode: 1 },
  PERIOD: { label: "Yearly/Monthly", chargingMode: 0 },
  ONETIME: { label: "One-time", chargingMode: 2 },
  RI: { label: "RI", chargingMode: 10 },
} as const;
export type NativeBillingMode = keyof typeof nativeBillingModes;
export function isNativeBillingMode(
  value: unknown,
): value is NativeBillingMode {
  return typeof value === "string" && Object.hasOwn(nativeBillingModes, value);
}
/** Billing availability belongs to Huawei's service/region menu, not a local service table. */
export function nativeBillingDirectory(menu: {
  menuInfos: {
    subCategoryLists: {
      urlPath: string;
      regionOnline?: Record<string, unknown>;
      regionBeta?: Record<string, unknown>;
    }[];
  }[];
}) {
  return Object.fromEntries(
    menu.menuInfos.flatMap((group) =>
      group.subCategoryLists.map((service) => {
        const regions: Record<string, NativeBillingMode[]> = {};
        for (const availability of [service.regionOnline, service.regionBeta])
          for (const [region, value] of Object.entries(availability ?? {})) {
            const offer = value as {
              common?: unknown;
              homeZoneAZCodes?: string[];
              [key: string]: unknown;
            };
            const modes = [
              ...(Array.isArray(offer.common) ? offer.common : []),
              ...(Array.isArray(offer.homeZoneAZCodes)
                ? offer.homeZoneAZCodes.flatMap((code) =>
                    Array.isArray(offer[code]) ? offer[code] : [],
                  )
                : []),
            ];
            if (modes.length)
              regions[region] = [
                ...new Set([
                  ...(regions[region] ?? []),
                  ...modes.filter(isNativeBillingMode),
                ]),
              ];
          }
        return [service.urlPath, regions];
      }),
    ),
  );
}
