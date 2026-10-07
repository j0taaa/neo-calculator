import { readFile } from "node:fs/promises";
import {
  HuaweiCollector,
  PAGE_URL,
  MENU_URL,
  parseDirectory,
} from "../huawei-native/collector";
import { nativeBillingDirectory } from "../huawei-native/native-billing";
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
  const data = JSON.parse(menu.body);
  const regions = Object.keys(data.regionRules)
    .filter(
      (id) =>
        data.regionsOfSite.HWC.includes(id) &&
        (data.regionRules[id] === "ALL" || data.regionRules[id]?.calc === true),
    )
    .map((id) => ({ id, name: data.global[id] || id }));
  return {
    version: 1,
    id: "",
    bridgeHash,
    createdAt: new Date().toISOString(),
    menu: menu.body,
    frameworkUrl,
    assets,
    scopes: {},
    diagnostics: [],
    directory: {
      services: parseDirectory(menu.body).filter(
        (service) => service.available,
      ),
      regions,
      billingModes: nativeBillingDirectory(data),
    },
  };
}
export async function collectScope(
  collector: HuaweiCollector,
  release: SnapshotRelease,
  service: string,
  region: string,
): Promise<ScopeSnapshot> {
  const { config, products } = await collector.service(service, region, true);
  const page = collector.store.latest(PAGE_URL)!;
  return {
    service,
    region,
    modes: release.directory.billingModes[service]?.[region] ?? [],
    config: config.body,
    products: JSON.parse(products.body),
    source: {
      page: page.hash,
      config: config.hash,
      products: products.hash,
      framework: release.assets[release.frameworkUrl].hash,
      menu: collector.store.latest(MENU_URL)!.hash,
      fetchedAt: products.fetchedAt,
    },
    verifiedAt: "",
    checks: 0,
  };
}
