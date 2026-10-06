import { instrumentNativePricing } from "./native-pricing";
import type { Snapshot } from "./types";

type Source = Pick<Snapshot, "hash" | "body">;

/** Download existing scripts together while preserving Huawei's original execution order. */
export function preloadNativeScripts(body: string): string {
  const links = new Set<string>();
  for (const script of body.matchAll(/<script\b[^>]*>/gi)) {
    const src = script[0].match(/\bsrc\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (!src || !/^https:\/\/(?:[\w-]+\.)*(?:hc-cdn\.com|hc-cdn\.cn)\//i.test(src)) continue;
    const type = script[0].match(/\btype\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (type && !["module", "text/javascript", "application/javascript"].includes(type)) continue;
    const cross = script[0].match(/\bcrossorigin\s*=\s*(["'])(.*?)\1/i)?.[2];
    const href = src.replace(/"/g, "&quot;");
    links.add(`<link rel="${type === "module" ? "modulepreload" : "preload"}"${type === "module" ? "" : ' as="script"'} href="${href}"${cross ? ` crossorigin="${cross === "use-credentials" ? cross : "anonymous"}"` : ""}>`);
  }
  return body.replace(/<head\b[^>]*>/i, head => head + [...links].join(""));
}

/** Only the newest common assets are retained; existing sessions pin their own strings. */
export class NativeAssets {
  private shared: Partial<Record<"page" | "menu" | "framework", Source>> = {};

  body(kind: "page" | "menu", source: Source): string {
    if (this.shared[kind]?.hash !== source.hash) this.shared[kind] = { hash: source.hash, body: kind === "page" ? preloadNativeScripts(source.body) : source.body };
    return this.shared[kind]!.body;
  }

  framework(source: Source): string {
    if (this.shared.framework?.hash !== source.hash) {
      // A changed, unsupported framework must fail instead of falling back to stale code.
      const body = instrumentNativePricing(source.body);
      this.shared.framework = { hash: source.hash, body };
    }
    return this.shared.framework!.body;
  }

  clear(): void { this.shared = {}; }
}
