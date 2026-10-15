export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Validate untrusted JSON before routes access strings or pass it to pricing. */
export function productInputError(value: unknown): string | null {
  if (!isRecord(value)) return "Product must be an object";
  for (const key of ["serviceCode", "serviceName", "productType", "title"])
    if (value[key] !== undefined && typeof value[key] !== "string")
      return `${key} must be a string`;
  if (value.config !== undefined && !isRecord(value.config))
    return "config must be an object";
  if (value.quantity !== undefined &&
    (typeof value.quantity !== "number" || !Number.isSafeInteger(value.quantity) || value.quantity < 1 || value.quantity > 9999))
    return "quantity must be an integer between 1 and 9999";
  return null;
}

/** A local snapshot configuration must always use snapshot verification, even with a legacy alias. */
export function snapshotServiceCode(code: string, config: unknown) {
  if (!isRecord(config) || config.local === undefined) return code;
  const id = huaweiServiceId(code);
  const selected = isRecord(config.selection) ? config.selection.service : undefined;
  return `HUAWEI:${typeof selected === "string" && selected.toLowerCase() === id.toLowerCase() ? selected : id}`;
}
import { huaweiServiceId } from "./calculator/service-directory";
