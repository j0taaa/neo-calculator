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
}, validate?: { services: ReadonlySet<string>; regions: ReadonlySet<string> }) {
  return Object.fromEntries(
    menu.menuInfos.flatMap((group) =>
      group.subCategoryLists.map((service) => {
        const regions: Record<string, NativeBillingMode[]> = {};
        if (validate && !validate.services.has(service.urlPath))
          return [service.urlPath, regions];
        for (const availability of [service.regionOnline, service.regionBeta])
          for (const [region, value] of Object.entries(availability ?? {})) {
            if (validate && !validate.regions.has(region)) continue;
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
            if (validate && modes.some(mode => !isNativeBillingMode(mode)))
              throw new Error(`Unsupported advertised billing mode for ${service.urlPath}/${region}: ${JSON.stringify(modes)}`);
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
