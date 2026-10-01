import ts from "typescript";
import { HuaweiCollector, PAGE_URL } from "../../lib/huawei-sync/collector";
import {
  nativeBillingDirectory,
  type NativeBillingMode,
} from "../../lib/huawei-sync/native-billing";
import { inspectConfig } from "../../lib/huawei-sync/engine";
import { instrumentNativePricing } from "../../lib/huawei-sync/native-pricing";
import type { NativeDirectory } from "../../lib/huawei-sync/native-types";

// Happy DOM wraps classic scripts in a function; restore their browser-global var bindings.
export function globalize(source: string) {
  const ast = ts.createSourceFile(
    "config.js",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const names = ast.statements.flatMap((s) =>
    ts.isVariableStatement(s) &&
    !(s.declarationList.flags & ts.NodeFlags.BlockScoped)
      ? s.declarationList.declarations.map((d) => {
          if (!ts.isIdentifier(d.name))
            throw Error("Unsupported global binding");
          return d.name.text;
        })
      : ts.isFunctionDeclaration(s) && s.name
        ? [s.name.text]
        : [],
  );
  return `${source}\nObject.assign(window,{${names.join(",")}});`;
}
export type Scope = {
  service: string;
  region: string;
  billingMode: NativeBillingMode;
};
export class DemoSources {
  constructor(readonly collector: HuaweiCollector) {}
  private shared?: Promise<{
    assets: Record<string, string>;
    frameworkUrl: string;
    css: string;
    menu: string;
    directory: NativeDirectory;
  }>;
  private sharedAt = 0;
  getShared() {
    if (Date.now() - this.sharedAt >= 6 * 60 * 60_000) {
      this.sharedAt = Date.now();
      this.shared = undefined;
    }
    return (this.shared ??= this.loadShared().catch((error) => {
      this.shared = undefined;
      throw error;
    }));
  }
  private async loadShared() {
    const [framework, { snapshot: menu, services }] = await Promise.all([
      this.collector.framework(),
      this.collector.directory(),
    ]);
    const data = JSON.parse(menu.body);
    const directory: NativeDirectory = {
      services: services.filter((s) => s.available),
      billingModes: nativeBillingDirectory(data),
      regions: Object.keys(data.regionRules)
        .filter(
          (id) =>
            data.regionsOfSite.HWC.includes(id) &&
            (data.regionRules[id] === "ALL" ||
              data.regionRules[id]?.calc === true),
        )
        .map((id) => ({ id, name: data.global[id] || id })),
    };
    const assets: Record<string, string> = { [framework.url]: framework.body };
    const queue = [framework.url];
    while (queue.length) {
      const url = queue.shift()!;
      for (const match of assets[url].matchAll(
        /(?:from\s*|import\s*)["'](\.\.?\/[^"']+)["']/g,
      )) {
        const child = new URL(match[1], url).href;
        if (!child.startsWith(new URL(".", framework.url).href))
          throw Error("Unexpected framework import");
        if (child in assets) continue;
        if (Object.keys(assets).length >= 20)
          throw Error("Too many framework imports");
        assets[child] = (
          await this.collector.fetch(child, 6 * 60 * 60_000)
        ).body;
        queue.push(child);
      }
    }
    const css = (
      await this.collector.fetch(
        new URL("style.css", framework.url).href,
        6 * 60 * 60_000,
      )
    ).body;
    return {
      assets,
      frameworkUrl: framework.url,
      css,
      menu: menu.body,
      directory,
    };
  }
  async forScope(scope: Scope) {
    const shared = await this.getShared();
    if (
      !shared.directory.services.some((s) => s.id === scope.service) ||
      !shared.directory.regions.some((r) => r.id === scope.region) ||
      !shared.directory.billingModes[scope.service]?.[scope.region]?.includes(
        scope.billingMode,
      )
    )
      throw Error("Unavailable service/region/billing mode");
    const { config, products } = await this.collector.service(
      scope.service,
      scope.region,
      scope.billingMode === "RI",
    );
    const framework = this.collector.store.latest(shared.frameworkUrl)!;
    const menu = this.collector.store.latest(
      "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/menuInfo?sign=common&language=en-us",
    )!;
    const metadata = await inspectConfig(config.body);
    const known = new Set([
      "CommonSelect",
      "CommonRadioGroup",
      "CommonStepper",
      "CommonRadioStepper",
      "CommonCheckboxGroup",
      "CommonAddible",
      "CommonSwitch",
      "CommonTip",
    ]);
    const unsupported = metadata.components
      .filter((c) => !c.id.startsWith("global_") && !known.has(c.type))
      .map((c) => c.type);
    return {
      unsupported: [...new Set(unsupported)],
      input: {
        ...shared,
        scope,
        config: globalize(config.body),
        products: products.body,
        assets: {
          ...shared.assets,
          [shared.frameworkUrl]: instrumentNativePricing(framework.body),
        },
      },
      source: {
        page: this.collector.store.latest(PAGE_URL)!.hash,
        config: config.hash,
        products: products.hash,
        framework: framework.hash,
        menu: menu.hash,
        fetchedAt: products.fetchedAt,
      },
    };
  }
}
