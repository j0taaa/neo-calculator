import { chromium, type Browser } from "playwright";
import { readFile } from "node:fs/promises";
import { frameHtml, rewriteImports } from "../huawei-snapshot/frame-html";
import { frameDataScript } from "../huawei-snapshot/frame-data";
import { observeRuleOrder } from "../huawei-snapshot/framework";
import { SnapshotStore } from "../huawei-snapshot/store";
import type { ScopeSnapshot, SnapshotRelease } from "../huawei-snapshot/types";
import type { NativeState } from "../huawei-native/native-types";
import type { NativeBillingMode } from "../huawei-native/native-billing";

/** Worker/test-only reference. No application module imports this browser oracle. */
export class CalculatorOracle {
  private constructor(private browser: Browser, private store: SnapshotStore, private bridge: string) {}
  static async create(store: SnapshotStore) {
    const bridge = await readFile("public/calculator-snapshot-bridge.js", "utf8");
    return new CalculatorOracle(await chromium.launch({ headless: true }), store, bridge);
  }
  async close() { await this.browser.close(); }
  async open(release: SnapshotRelease, scope: ScopeSnapshot, mode: NativeBillingMode, locationCode?: string) {
    const context = await this.browser.newContext({ viewport: { width: 1500, height: 1300 }, serviceWorkers: "block" });
    const token = crypto.randomUUID(), origin = "http://oracle.local", dataPath = "/scope-data";
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: `<script>window.messages={};addEventListener('message',e=>{if(e.source===document.querySelector('iframe').contentWindow&&e.data.token===${JSON.stringify(token)}){if(e.data.ready)window.ready=true;else window.messages[e.data.id]=e.data;}});</script><iframe sandbox="allow-scripts" src="/frame?inIframe=true&region=${scope.region}#/${scope.service}" style="width:1440px;height:1200px"></iframe>` });
      if (url.pathname === "/frame") return route.fulfill({ contentType: "text/html", body: frameHtml(release, scope, mode, origin, token, locationCode, dataPath) });
      if (url.pathname === dataPath) return route.fulfill({ contentType: "application/javascript", body: frameDataScript(release, scope) });
      if (url.pathname.endsWith("/bridge")) return route.fulfill({ contentType: "application/javascript", body: this.bridge });
      const entry = Object.entries(release.assets).find(([, asset]) => asset.hash === url.pathname.split("/").at(-1));
      if (!entry) return route.abort();
      let body = entry[0] === "neo:bridge" ? this.bridge : await this.store.read(entry[1].hash);
      if (entry[1].type === "application/javascript") {
        body = rewriteImports(body, entry[0], release);
        if (entry[0] === release.frameworkUrl) body = observeRuleOrder(body);
      }
      return route.fulfill({ contentType: entry[1].type, headers: { "access-control-allow-origin": "*" }, body });
    });
    const page = await context.newPage();
    try {
      await page.goto(origin);
      await page.waitForFunction(() => (window as unknown as { ready?: boolean }).ready, undefined, { timeout: 20000 });
    } catch (error) { await context.close(); throw error; }
    async function action(body: Record<string, unknown>): Promise<NativeState> {
      const id = crypto.randomUUID();
      await page.evaluate(({ body, id, token }) => document.querySelector("iframe")!.contentWindow!.postMessage({ ...body, id, token }, "*"), { body, id, token });
      await page.waitForFunction(id => Boolean((window as unknown as { messages: Record<string, unknown> }).messages[id]), id, { timeout: 20000 });
      const response = await page.evaluate(id => (window as unknown as { messages: Record<string, { error?: string; result: NativeState }> }).messages[id], id);
      if (response.error) throw new Error(response.error);
      response.result.ruleOrder = await page.frames()[1].evaluate(() => (window as unknown as { __neoRuleOrder?: string[] }).__neoRuleOrder);
      return response.result;
    }
    return { action, frame: page.frames()[1], close: () => context.close() };
  }
}
