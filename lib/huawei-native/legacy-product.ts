import type { AppProduct } from "@/lib/calculator-types";

export const LEGACY_RECONFIGURE_MESSAGE =
  "This estimate uses the retired calculator. Open it in Huawei live and reselect its options before saving or requesting a current price.";

export function isLegacyHuaweiProduct(product: { serviceCode?: string; productType?: string }) {
  return product.serviceCode?.startsWith("HWC:") || product.productType === "huawei-synchronized";
}

export function isHuaweiCalculatorProduct(product: { serviceCode?: string; productType?: string }) {
  return product.serviceCode?.startsWith("HUAWEI:") || product.productType === "huawei-native" ||
    isLegacyHuaweiProduct(product);
}

/** Old option identifiers are not native replay instructions. Never guess their equivalents. */
export function legacyHuaweiConfiguration(product: Pick<AppProduct, "serviceCode" | "config">) {
  const config = product.config as {
    region?: unknown;
    huaweiSync?: { service?: unknown; input?: { region?: unknown; duration?: unknown; values?: unknown } };
  } | null;
  const input = config?.huaweiSync?.input;
  const service = product.serviceCode.startsWith("HWC:")
    ? product.serviceCode.slice(4)
    : config?.huaweiSync?.service;
  const region = input?.region ?? config?.region;
  if (typeof service !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(service) ||
      typeof region !== "string" || !/^[a-z0-9-]{1,80}$/.test(region))
    throw new Error("This old estimate has no valid service or region. Its saved configuration has been preserved.");
  return { service, region, duration: input?.duration, values: input?.values };
}

export function synchronizedRedirect(params: Record<string, string | string[] | undefined>) {
  const target = new URLSearchParams({ tab: "huawei-live" });
  const edit = typeof params.edit === "string" ? params.edit : undefined;
  if (edit) target.set("editProduct", edit);
  return `/?${target}`;
}
