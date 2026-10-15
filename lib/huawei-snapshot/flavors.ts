import type { CatalogFlavor, FlavorBillingMode } from "../calculator-types";
import type { ScopeSnapshot } from "./types";
/** Compatibility with archived releases created before choices were compiled during synchronization. */
function legacyFlavorGenerations(config: string | undefined) {
  if (!config) return undefined;
  const component = config.match(
    /id:\s*['"]calculator_ecs_radio['"]\s*,\s*type:\s*['"]CommonRadioGroup['"]([\s\S]*?)titleTips:/,
  )?.[1];
  const keys = component?.match(/optionKeys:\s*\[([^\]]+)\]/)?.[1]
    .match(/['"][^'"]+['"]/g)?.map(key => key.slice(1, -1));
  const index = keys?.indexOf("generation");
  const values = index === undefined || index < 0 ? undefined
    : component?.match(new RegExp(`\\b${index}:\\s*\\[([\\s\\S]*?)\\]`))?.[1]
      .replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "");
  if (!values || !/^(?:\s*['"][\w.-]+['"]\s*,?)*\s*$/.test(values))
    throw new Error("The official flavor-generation choices could not be read");
  return new Set([...values.matchAll(/['"]([\w.-]+)['"]/g)].map(match => match[1].toLowerCase()));
}
export function snapshotFlavors(
  scope: ScopeSnapshot,
  locationCode = "",
): CatalogFlavor[] {
  const flavors = new Map<string, CatalogFlavor>();
  const generations = scope.flavorGenerations
    ? new Set(scope.flavorGenerations.map(generation => generation.toLowerCase()))
    : legacyFlavorGenerations(scope.config);
  const rows = Object.values(scope.products.product).flat();
  const reserved = new Set(rows.filter(row =>
    row.resourceType === "hws.resource.type.vm" &&
    (row.locationCode ?? "") === locationCode && row.RITime &&
    row.planList?.some(plan => plan.billingMode === "RI"),
  ).map(row => row.resourceSpecCode));
  for (const row of rows) {
    if (
      row.resourceType !== "hws.resource.type.vm" ||
      (generations && !generations.has(String(row.generation ?? row.series).toLowerCase())) ||
      (row.locationCode ?? "") !== locationCode ||
      row.RITime ||
      !row.planList?.length
    )
      continue;
    const code = row.resourceSpecCode;
    const description =
      typeof row.productSpecSysDesc === "string"
        ? row.productSpecSysDesc
        : null;
    const text = (value: unknown) => (typeof value === "string" ? value : null);
    const flavor: CatalogFlavor = flavors.get(code) ?? {
      resourceSpecCode: code,
      family: text(row.performType),
      architecture: text(row.instanceArch),
      series: text(row.generation) ?? text(row.series),
      description,
      cpu: Number(String(row.cpu ?? "").match(/\d+/)?.[0] ?? 0),
      ramGiB: description?.match(/Memory:(\d+)MB/i)
        ? Number(description.match(/Memory:(\d+)MB/i)![1]) / 1024
        : Number(String(row.mem ?? "").match(/[\d.]+/)?.[0] ?? 0) /
          (/BSSUNIT\.[\w.]*\.21\b|MB/i.test(String(row.mem ?? "")) ? 1024 : 1),
      prices: {},
      billingModes: reserved.has(code) ? ["RI"] : [],
      currency: "USD",
      updatedAt: scope.source.fetchedAt,
    };
    for (const plan of row.planList) {
      if (
        !["ONDEMAND", "MONTHLY", "YEARLY"].includes(plan.billingMode) ||
        !Number.isFinite(plan.amount) ||
        plan.divisionList
      )
        continue;
      const mode = plan.billingMode as FlavorBillingMode;
      if (!flavor.billingModes!.includes(mode)) flavor.billingModes!.push(mode);
      const amount = plan.amount! / (plan.periodNum || 1);
      if (flavor.prices[mode] === undefined) flavor.prices[mode] = amount;
    }
    flavors.set(code, flavor);
  }
  return [...flavors.values()];
}
