import { isRecord } from "../product-input";

/** Resolve semantic values, never option indexes, from a Huawei saved-cart control tree. */
export function cartControlValue(
  key: string,
  component: string,
  rewrite: Record<string, unknown>,
): unknown {
  const region = isRecord(rewrite.global_REGIONINFO)
    ? rewrite.global_REGIONINFO
    : {};
  if (key === "global_LOCATIONTYPE") return region.locationType;
  if (key === "global_LOCATIONCODE") return region.locationCode;
  if (
    key === "global_FEEINSTALLMODE" &&
    isRecord(rewrite.global_FEEINSTALLMODE)
  )
    return `${rewrite.global_FEEINSTALLMODE.feeInstallMode}/${rewrite.global_FEEINSTALLMODE.installPeriodType ?? ""}`;
  const template = isRecord(rewrite.template_RENDER)
    ? rewrite.template_RENDER
    : {};
  let value: unknown = component.startsWith("global_")
    ? rewrite[component]
    : template[component];
  if (
    key === "global_PERIODTIME:period" &&
    isRecord(value) &&
    isRecord(value.UNSET_PeriodTime)
  )
    return `${value.UNSET_PeriodTime.measureValue}_${value.UNSET_PeriodTime.measureId}`;
  const namespace = key.slice(
    0,
    key.indexOf(":option:") >= 0
      ? key.indexOf(":option:")
      : key.indexOf(":step:") >= 0
        ? key.indexOf(":step:")
        : key.indexOf(":input") >= 0
          ? key.indexOf(":input")
          : key.length,
  );
  if (isRecord(value) && namespace.includes(":main"))
    value = value[`${component}_main`];
  else if (isRecord(value) && /:extra:\d+/.test(namespace))
    value =
      value[`${component}_|addible0|_${namespace.match(/:extra:(\d+)/)![1]}`];
  if (/:input$/.test(key))
    return isRecord(value) ? value.UNSET_Input : undefined;
  const step = key.match(/:step:(\d+)(:unit)?$/);
  if (step && isRecord(value)) {
    const emitted = value[`UNSET_Stepper_${step[1]}`];
    return isRecord(emitted)
      ? emitted[step[2] ? "measureId" : "measureValue"]
      : undefined;
  }
  const option = key.match(/:option:([^:]+)(?::(.+))?$/);
  if (!option) return undefined;
  if (option[2])
    return Array.isArray(value) ? value.includes(option[2]) : undefined;
  return isRecord(value) ? value[option[1]] : value;
}

function normalized(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalized);
  if (isRecord(value))
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key, entry]) =>
            ![
              "measureNameBeforeTrans",
              "measurePluralNameBeforeTrans",
              "transRate",
              "transTarget",
            ].includes(key) &&
            entry !== undefined &&
            entry !== "",
        )
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, normalized(entry)]),
    );
  return value;
}
export function sameCartValues(a: unknown, b: unknown) {
  return JSON.stringify(normalized(a)) === JSON.stringify(normalized(b));
}

/** Compare every saved control component. Unknown components force preservation. */
export function cartControlsMatch(
  original: Record<string, unknown>,
  restored: Record<string, unknown>,
) {
  const source = isRecord(original.template_RENDER)
      ? original.template_RENDER
      : {},
    target = isRecord(restored.template_RENDER) ? restored.template_RENDER : {};
  if (
    !Object.entries(source).every(([key, value]) =>
      sameCartValues(value, target[key]),
    )
  )
    return false;
  for (const key of [
    "global_ONDEMANDTIME",
    "global_QUANTITY",
    "global_PERIODTIME",
    "global_FEEINSTALLMODE",
  ])
    if (
      original[key] !== undefined &&
      !sameCartValues(original[key], restored[key])
    )
      return false;
  return true;
}
