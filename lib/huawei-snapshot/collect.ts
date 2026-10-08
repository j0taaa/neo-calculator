import { readFile } from "node:fs/promises";
import {
  HuaweiCollector,
  PAGE_URL,
  MENU_URL,
  parseDirectory,
} from "../huawei-native/collector";
import {
  nativeBillingDirectory,
  isNativeBillingMode,
} from "../huawei-native/native-billing";
import { compileSupportPricing } from "./compile-pricing";
import { compileFlavorGenerations } from "./compile-flavors";
import { assetImports } from "./imports";
import { offlineFramework } from "./framework";
import { SnapshotStore } from "./store";
import type { SnapshotRelease, ScopeSnapshot } from "./types";

export async function collectRelease(
  collector: HuaweiCollector,
  store: SnapshotStore,
): Promise<SnapshotRelease> {
  const [menu, page] = await Promise.all([
    collector.fetch(MENU_URL, 0, (body) => {
      parseDirectory(body);
    }),
    collector.fetch(PAGE_URL, 0),
  ]);
  const frameworkUrl = page.body.match(
    /https:\/\/portal\.hc-cdn\.com\/CBC-PortalCalculator\/[\w.-]+\/framework\.js/,
  )?.[0];
  if (!frameworkUrl)
    throw new Error("Huawei calculator framework was not found");
  const assets: SnapshotRelease["assets"] = {};
  async function mirror(url: string) {
    if (assets[url]) return;
    if (
      !url.startsWith(new URL(".", frameworkUrl!).href) ||
      !/\.(js|css)$/.test(new URL(url).pathname)
    )
      throw new Error(`Unsupported calculator asset dependency: ${url}`);
    const source = await collector.fetch(url, 0);
    const body =
      url === frameworkUrl ? offlineFramework(source.body) : source.body;
    const hash = await store.blob(body),
      imports = url.endsWith(".js") ? assetImports(body, url) : [];
    assets[url] = {
      hash,
      type: url.endsWith(".js") ? "application/javascript" : "text/css",
      imports,
    };
    for (const dependency of imports) await mirror(dependency.url);
  }
  await mirror(frameworkUrl);
  await mirror(new URL("style.css", frameworkUrl).href);
  const bridgeHash = await store.blob(
    await readFile("public/calculator-snapshot-bridge.js", "utf8"),
  );
  assets["neo:bridge"] = {
    hash: bridgeHash,
    type: "application/javascript",
    imports: [],
  };
  const auditHash = await store.blob(
    (
      await Promise.all(
        [
          "collect",
          "sync-renderer",
          "contracts",
          "audit",
          "compile-pricing",
          "compile-flavors",
          "flavors",
          "coverage",
          "revalidate",
          "rounding-scale",
          "recurring",
          "frame-html",
          "framework",
          "imports",
          "store",
          "../huawei-native/collector",
          "../huawei-native/native-billing",
          "../huawei-native/quotes",
        ].map((name) => readFile(`lib/huawei-snapshot/${name}.ts`, "utf8")),
      )
    ).join("\n") +
      (await readFile("scripts/sync-calculator-snapshot.ts", "utf8")),
  );
  const data = JSON.parse(menu.body);
  const services = parseDirectory(menu.body).filter(service => service.available);
  const regions = Object.keys(data.regionRules)
    .filter(
      (id) => data.regionRules[id] === "ALL" || !!data.regionRules[id]?.calc,
    )
    .map((id) => ({ id, name: data.global[id] || id }));
  return {
    version: 1,
    id: "",
    bridgeHash,
    auditHash,
    createdAt: new Date().toISOString(),
    menu: menu.body,
    frameworkUrl,
    assets,
    scopes: {},
    diagnostics: [],
    directory: {
      services,
      regions,
      billingModes: nativeBillingDirectory(data, {
        services: new Set(services.map(service => service.id)),
        regions: new Set(regions.map(region => region.id)),
      }),
    },
  };
}
export async function collectScope(
  collector: HuaweiCollector,
  release: SnapshotRelease,
  service: string,
  region: string,
): Promise<ScopeSnapshot> {
  const menu = JSON.parse(release.menu);
  const entry = menu.menuInfos
    .flatMap(
      (group: {
        subCategoryLists: {
          urlPath: string;
          regionOnline?: Record<string, { common?: unknown[] }>;
        }[];
      }) => group.subCategoryLists,
    )
    .find((item: { urlPath: string }) => item.urlPath === service);
  const online = entry?.regionOnline?.[region];
  const tag =
    online?.common?.some(isNativeBillingMode) ||
    online?.homeZoneAZCodes?.some((code: string) =>
      online[code]?.some(isNativeBillingMode),
    )
      ? "general.online.portal"
      : "general.online.beta";
  const { config, products } = await collector.service(
    service,
    region,
    true,
    tag,
    true,
  );
  const page = collector.store.latest(PAGE_URL)!;
  const support = compileSupportPricing(config.body);
  const offers =
    entry?.[tag === "general.online.portal" ? "regionOnline" : "regionBeta"]?.[
      region
    ];
  const locationModes = Object.fromEntries(
    (offers?.homeZoneAZCodes ?? []).map((code: string) => [
      code,
      (offers[code] ?? []).filter(isNativeBillingMode),
    ]),
  );
  return {
    service,
    region,
    modes: release.directory.billingModes[service]?.[region] ?? [],
    ...(Object.keys(locationModes).length
      ? {
          locationModes,
          commonModes: (offers.common ?? []).filter(isNativeBillingMode),
        }
      : {}),
    tag,
    config: config.body,
    ...(service === "ecs" ? { flavorGenerations: compileFlavorGenerations(config.body) } : {}),
    ...(support ? { customPricing: { support } } : {}),
    products: JSON.parse(products.body),
    source: {
      page: page.hash,
      config: config.hash,
      products: products.hash,
      framework: release.assets[release.frameworkUrl].hash,
      menu: collector.store.latest(MENU_URL)!.hash,
      fetchedAt: products.fetchedAt,
    },
    ratingRuleVersion: 2,
    verifiedAt: "",
    checks: 0,
  };
}
