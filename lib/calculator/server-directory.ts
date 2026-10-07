import { huaweiRegions, getCatalogRegionId, type HuaweiRegionKey } from "@/lib/huawei-regions";
import { legacyRegion } from "./service-directory";
import { SnapshotStore } from "@/lib/huawei-snapshot/store";
// Read the published directory without loading individual catalogs or audit evidence.
export async function calculatorDirectory() {
  return new SnapshotStore().active().then(release=>release.directory).catch(()=>null);
}

export async function ecsCatalogScope(requested: string | null) {
  const key = legacyRegion(requested ?? "la-sao-paulo1") as HuaweiRegionKey | undefined;
  if (key) return { region: key as string, catalogRegionId: getCatalogRegionId(key), label: huaweiRegions[key].short as string };
  if (!requested || !/^[a-z0-9-]{1,80}$/.test(requested)) return { error: "Invalid ECS region", status: 400 };
  const directory = await calculatorDirectory();
  if (!directory) return { error: "Unable to validate ECS region", status: 502 };
  const region = directory.regions.find(region => region.id === requested);
  if (!region) return { error: "Unknown ECS region", status: 400 };
  return { region: requested, catalogRegionId: requested, label: region.name };
}
