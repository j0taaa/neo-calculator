import { instrumentNativePricing } from "../huawei-native/native-pricing";
import { digest } from "./store";
import type { SnapshotRelease } from "./types";

/** Imported scripts and styles can change conditional choices independently of the entry script. */
export function frameworkAssetsHash(assets: SnapshotRelease["assets"]) {
  return digest(JSON.stringify(Object.entries(assets).sort(([a], [b]) => a.localeCompare(b))));
}

/** Worker-only observation of the dependency order used by global billing terms. */
export function observeRuleOrder(source: string) {
  if (source.includes("window.__neoRuleOrder = Object.keys(product);")) return source;
  const anchor = "for (const componentKey of Object.keys(product)) {";
  if (source.split(anchor).length !== 2) throw new Error("Huawei's billing dependency observer changed");
  return source.replace(anchor, "window.__neoRuleOrder = Object.keys(product);\n  " + anchor);
}

/** Replace only the two component-emission delays; conditional and pricing functions stay intact. */
export function localEmissions(source: string) {
  let matches = 0;
  const delays = new Set<string>();
  const adapted = source.replace(
    /const emitValue = lodash_debounce\(function\(\) \{([\s\S]*?)\}, (50|100)\);/g,
    (match, body: string, delay: string) => {
      const marker = delay === "50"
        ? "value: compactObject(value)"
        : "let selectedProduct = parseSelected(filteredValue, funcList, languagePack.value, tempGlobalInfo, viewConfig);";
      if (!body.includes(marker))
        throw new Error("Huawei's component emission adapter changed");
      matches++;
      delays.add(delay);
      return match.replace("lodash_debounce", "window.__neoLocalEmissions.debounce");
    },
  );
  if (matches !== 2 || delays.size !== 2 || adapted.includes("const emitValue = lodash_debounce("))
    throw new Error("Huawei's component emission adapter changed");
  return adapted;
}

/** Isolate vendor storage, API origins and scheduling. Pricing/conditional functions remain unchanged. */
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
  return localEmissions(instrumentNativePricing(source));
}
