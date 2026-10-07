import { instrumentNativePricing } from "../huawei-native/native-pricing";

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
  return instrumentNativePricing(
    source.slice(0, start) +
      `class IdbStorage {
    static values = new Map();
    static async set(key, value) {this.values.set(key,value);}
    static async get(key) {return this.values.get(key) ?? null;}
    static async remove(key) {this.values.delete(key);}
    static async clearAll() {this.values.clear();}
    static async getAllKeys() {return [...this.values.keys()];}
  }\n` +
      source.slice(end),
  );
}
