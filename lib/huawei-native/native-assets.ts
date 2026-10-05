import { instrumentNativePricing } from "./native-pricing";
import type { Snapshot } from "./types";

type Source = Pick<Snapshot, "hash" | "body">;

/** Only the newest common assets are retained; existing sessions pin their own strings. */
export class NativeAssets {
  private shared: Partial<Record<"page" | "menu" | "framework", Source>> = {};

  body(kind: "page" | "menu", source: Source): string {
    if (this.shared[kind]?.hash !== source.hash) this.shared[kind] = { hash: source.hash, body: source.body };
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
