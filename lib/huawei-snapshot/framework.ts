import { instrumentNativePricing } from "../huawei-native/native-pricing";
import { digest } from "./store";
import type { SnapshotRelease } from "./types";

/** Imported scripts and styles can change conditional choices independently of the entry script. */
export function frameworkAssetsHash(assets: SnapshotRelease["assets"]) {
  return digest(JSON.stringify(Object.entries(assets).sort(([a], [b]) => a.localeCompare(b))));
}

/** Isolate vendor storage and API origins. Pricing/conditional functions remain unchanged. */
export function offlineFramework(source: string) {
  let origins = 0;
  source = source.replace(
    /const baseURL(\$1)? = \(window.location.origin[\s\S]*?\n\}\);/g,
    (_, suffix = "") => {
      origins++;
      return `const baseURL${suffix} = "https://portal-intl.huaweicloud.com";`;
    },
  );
  if (origins !== 2)
    throw new Error(
      "Huawei's API origin adapter changed; the previous snapshot will remain active",
    );
  const start = source.indexOf("class IdbStorage {");
  const end = source.indexOf("const getHandlePriceBoardAmountFn =", start);
  if (
    start < 0 ||
    end < 0 ||
    source.indexOf("class IdbStorage {", start + 1) >= 0
  )
    throw new Error(
      "Huawei's storage adapter changed; the previous snapshot will remain active",
    );
  source =
    source.slice(0, start) +
    `class IdbStorage {
    static values = new Map();
    static async set(key, value) {this.values.set(key,value);}
    static async get(key) {return this.values.get(key) ?? null;}
    static async remove(key) {this.values.delete(key);}
    static async clearAll() {this.values.clear();}
    static async getAllKeys() {return [...this.values.keys()];}
  }\n` +
    source.slice(end);
  const emptyGuard =
    "if (!selectedProduct || selectedProduct.productAllInfos.length === 0) {\n        return;\n      }";
  if (source.split(emptyGuard).length !== 2)
    throw new Error("Huawei's empty-selection observer changed");
  source = source.replace(
    emptyGuard,
    `window.__neoNativeEmptySelection = !selectedProduct || selectedProduct.productAllInfos.length === 0;
      if (window.__neoNativeEmptySelection) {
        const bridge = window.__neoNativePricing ||= { epoch: 0 };
        bridge.epoch++;
        bridge.pending = false;
        bridge.result = null;
        bridge.selectedProduct = selectedProduct;
        return;
      }`,
  );
  return instrumentNativePricing(source);
}
