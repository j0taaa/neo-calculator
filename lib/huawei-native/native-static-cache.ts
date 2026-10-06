import type { Route } from "playwright";

type Asset = { body: Buffer; headers: Record<string, string>; expires: number };
const MAX_BYTES = 16 * 1024 * 1024;
/** Only versioned public calculator scripts/styles; never catalog, config, login or prices. */
export class NativeStaticCache {
  private entries = new Map<string, Asset>();
  private bytes = 0;
  constructor(private readonly limit = MAX_BYTES, private readonly now = Date.now) {}
  private eligible(url: string, type: string) {
    const source = new URL(url);
    return source.protocol === "https:" && ["portal.hc-cdn.com", "res.hc-cdn.com"].includes(source.hostname) &&
      [...source.searchParams].every(([key, value]) => ["sttl", "ttr"].includes(key) && /^\d+(?:\.\d+)+$/.test(value)) &&
      ["script", "stylesheet"].includes(type) && /^\/(?:CBC-PortalCalculator|cnpm-[\w-]+|cpage-[\w-]+)\/\d+\.\d+\.[\w.-]+\/.+\.(?:js|css)$/.test(source.pathname);
  }
  get(url: string, type: string): Asset | undefined {
    if (!this.eligible(url, type)) return;
    const entry = this.entries.get(url);
    if (!entry) return;
    if (entry.expires <= this.now()) { this.delete(url); return; }
    this.entries.delete(url); this.entries.set(url, entry);
    return entry;
  }
  put(url: string, type: string, status: number, headers: Record<string, string>, body: Buffer) {
    if (!this.eligible(url, type) || status !== 200 || body.length > this.limit || headers["set-cookie"] ||
      /(?:no-store|no-cache|private)/i.test(headers["cache-control"] ?? "") ||
      (headers.vary && headers.vary.toLowerCase() !== "accept-encoding") ||
      !/(?:javascript|text\/css)/i.test(headers["content-type"] ?? "")) return;
    const age = headers["cache-control"]?.match(/(?:^|,)\s*max-age=(\d+)/i);
    const ttl = Math.min(15 * 60, age ? Number(age[1]) : 15 * 60) * 1000;
    if (!ttl) return;
    const clean = { ...headers };
    // Playwright returns decompressed bytes. Do not replay encoded lengths or cookies.
    delete clean["content-encoding"]; delete clean["content-length"]; delete clean["transfer-encoding"];
    this.delete(url);
    while (this.bytes + body.length > this.limit || this.entries.size >= 64) this.delete(this.entries.keys().next().value!);
    this.entries.set(url, { body, headers: clean, expires: this.now() + ttl }); this.bytes += body.length;
  }
  private delete(url: string) { const entry = this.entries.get(url); if (entry) this.bytes -= entry.body.length; this.entries.delete(url); }
  sweep() { for (const [url, entry] of this.entries) if (entry.expires <= this.now()) this.delete(url); }
  clear() { this.entries.clear(); this.bytes = 0; }
  async serve(route: Route) {
    const request = route.request();
    if (request.method() !== "GET" || !this.eligible(request.url(), request.resourceType())) return false;
    const cached = this.get(request.url(), request.resourceType());
    if (cached) { await route.fulfill({ status: 200, headers: cached.headers, body: cached.body }); return true; }
    const response = await route.fetch({ timeout: 30000 });
    const body = await response.body();
    this.put(request.url(), request.resourceType(), response.status(), response.headers(), body);
    await route.fulfill({ response, body });
    await response.dispose();
    return true;
  }
}
