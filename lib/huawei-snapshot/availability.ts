import type { NativeBillingMode } from "../huawei-native/native-billing";
export type RegionRule = {
  tag?: string;
  hideChargeModeList?: string[];
  hideChargeModeMap?: Record<string, string[]>;
};
/** The service configuration can narrow the availability advertised by the menu. */
export function configuredBillingModes(
  modes: NativeBillingMode[],
  region: string,
  rules: RegionRule[],
  tag = "general.online.portal",
) {
  return modes.filter(
    (mode) =>
      !rules
        .filter((rule) => !rule.tag || rule.tag === tag)
        .some(
          (rule) =>
            rule.hideChargeModeList?.includes(mode) ||
            rule.hideChargeModeMap?.[mode]?.includes(region),
        ),
  );
}
