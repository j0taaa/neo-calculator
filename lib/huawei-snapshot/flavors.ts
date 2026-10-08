import type { CatalogFlavor, FlavorBillingMode } from "../calculator-types";
import type { ScopeSnapshot } from "./types";
export function snapshotFlavors(
  scope: ScopeSnapshot,
  locationCode = "",
): CatalogFlavor[] {
  const flavors = new Map<string, CatalogFlavor>();
  for (const row of Object.values(scope.products.product).flat()) {
    if (
      row.resourceType !== "hws.resource.type.vm" ||
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
      series: text(row.series),
      description,
      cpu: Number(String(row.cpu ?? "").match(/\d+/)?.[0] ?? 0),
      ramGiB: description?.match(/Memory:(\d+)MB/i)
        ? Number(description.match(/Memory:(\d+)MB/i)![1]) / 1024
        : Number(String(row.mem ?? "").match(/[\d.]+/)?.[0] ?? 0) /
          (/BSSUNIT\.[\w.]*\.21\b|MB/i.test(String(row.mem ?? "")) ? 1024 : 1),
      prices: {},
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
      const amount = plan.amount! / (plan.periodNum || 1);
      if (flavor.prices[mode] === undefined) flavor.prices[mode] = amount;
    }
    flavors.set(code, flavor);
  }
  return [...flavors.values()];
}
