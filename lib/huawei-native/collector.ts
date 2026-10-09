import { sendHttpRequest } from "@/lib/huawei-http";
import { SourceStore } from "./store";
import type { Snapshot, HuaweiService } from "./types";

export const CALCULATOR_BASE =
  "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api";
export const MENU_URL = `${CALCULATOR_BASE}/menuInfo?sign=common&language=en-us`;
export const PAGE_URL =
  "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html";
export type Transport = (
  url: string,
) => Promise<{ ok: boolean; status: number; bodyText: string }>;
const transport: Transport = (url) =>
  sendHttpRequest({
    method: "GET",
    url,
    headers: { "X-Language": "en-us" },
    timeoutMs: 30_000,
  });

export function parseDirectory(body: string): HuaweiService[] {
  const data = JSON.parse(body);
  if (!Array.isArray(data.menuInfos) || !data.menuInfos.length)
    throw new Error("Invalid or empty Huawei directory");
  const services: HuaweiService[] = [];
  for (const group of data.menuInfos) {
    if (!Array.isArray(group.subCategoryLists))
      throw new Error("Incomplete Huawei directory");
    for (const entry of group.subCategoryLists) {
      if (
        typeof entry.urlPath !== "string" ||
        !/^[a-zA-Z0-9_-]{1,80}$/.test(entry.urlPath) ||
        typeof entry.categoryName !== "string"
      )
        throw new Error("Invalid Huawei service identity");
      if (services.some((s) => s.id === entry.urlPath))
        throw new Error("Duplicate Huawei service identity");
      services.push({
        id: entry.urlPath,
        name: entry.categoryName,
        category: group.parentCategoryName || "Other",
        available:
          entry.hasCalculator === true && entry.hideCalculator !== true,
      });
    }
  }
  if (!services.length) throw new Error("Empty Huawei directory");
  return services;
}

export class HuaweiCollector {
  private pending = new Map<string, Promise<Snapshot>>();
  private refreshedConfigs = new Set<string>();
  constructor(
    readonly store: SourceStore,
    private readonly request: Transport = transport,
  ) {}
  async fetch(
    url: string,
    ttlMs = 0,
    validate?: (body: string) => void,
  ): Promise<Snapshot> {
    const cached = this.store.latest(url);
    if (cached && Date.now() - Date.parse(cached.fetchedAt) < ttlMs) {
      validate?.(cached.body);
      return cached;
    }
    const existing = this.pending.get(url);
    if (existing) {
      const result = await existing;
      validate?.(result.body);
      return result;
    }
    const request = this.fetchSource(url, validate);
    this.pending.set(url, request);
    try {
      return await request;
    } finally {
      this.pending.delete(url);
    }
  }
  private async fetchSource(
    url: string,
    validate?: (body: string) => void,
  ): Promise<Snapshot> {
    let error: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await this.request(url);
        if (!response.ok)
          throw new Error(`Huawei source request failed (${response.status})`);
        if (!response.bodyText || response.bodyText.length > 20_000_000)
          throw new Error("Invalid Huawei source size");
        validate?.(response.bodyText);
        return this.store.snapshot(url, response.bodyText);
      } catch (caught) {
        error = caught;
        if (attempt < 2)
          await new Promise((resolve) =>
            setTimeout(resolve, 500 * 2 ** attempt),
          );
      }
    }
    throw error;
  }
  async directory() {
    const snapshot = await this.fetch(MENU_URL, 6 * 60 * 60_000, (body) => {
      parseDirectory(body);
    });
    const services = parseDirectory(snapshot.body);
    return { snapshot, services };
  }
  async framework() {
    const page = await this.fetch(PAGE_URL, 6 * 60 * 60_000);
    const match = page.body.match(
      /https:\/\/portal\.hc-cdn\.com\/CBC-PortalCalculator\/[\w.-]+\/framework\.js/,
    );
    if (!match) throw new Error("Huawei calculator framework not found");
    return this.fetch(match[0], 6 * 60 * 60_000);
  }
  async service(
    service: string,
    region: string,
    freshProducts = false,
    tag:
      | "general.online.portal"
      | "general.online.beta" = "general.online.portal",
    freshConfig = false,
  ) {
    if (
      !/^[a-zA-Z0-9_-]{1,80}$/.test(service) ||
      !/^[a-z0-9-]{1,80}$/.test(region)
    )
      throw new Error("Invalid source scope");
    const params = `urlPath=${service}&tag=${tag}&tab=calc&sign=common&language=en-us`;
    const configUrl = `${CALCULATOR_BASE}/config?${params}`;
    const [config, products] = await Promise.all([
      this.fetch(
        configUrl,
        freshConfig && !this.refreshedConfigs.has(configUrl)
          ? 0
          : 6 * 60 * 60_000,
      ),
      this.fetch(
        `${CALCULATOR_BASE}/productInfo?${params}&region=${region}`,
        freshProducts ? 0 : 15 * 60_000,
        (body) => {
          const parsed = JSON.parse(body);
          if (
            !parsed.product ||
            parsed.region !== region ||
            parsed.urlPath !== service
          )
            throw new Error(
              "Huawei product response does not match requested scope",
            );
        },
      ),
    ]);
    if (freshConfig) this.refreshedConfigs.add(configUrl);
    return { config, products };
  }
}
