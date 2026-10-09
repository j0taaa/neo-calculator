import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SnapshotStore } from "@/lib/huawei-snapshot/store";
import { frameHtml, rewriteImports } from "@/lib/huawei-snapshot/frame-html";
import { frameDataPath, frameDataScript } from "@/lib/huawei-snapshot/frame-data";
import { isNativeBillingMode } from "@/lib/huawei-native/native-billing";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const baseHeaders = {
  "x-robots-tag": "noindex, nofollow",
  "x-content-type-options": "nosniff",
};
export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const url = new URL(request.url),
    { path } = await context.params,
    store = new SnapshotStore();
  const origin = process.env.BETTER_AUTH_URL
    ? new URL(process.env.BETTER_AUTH_URL).origin
    : new URL(
        `${request.headers.get("x-forwarded-proto") ?? "http"}://${request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host}`,
      ).origin;
  try {
    if (path.length === 1 && path[0] === "bridge") {
      const body = await readFile(
        join(process.cwd(), "public/calculator-snapshot-bridge.js"),
      );
      return new Response(body, {
        headers: {
          ...baseHeaders,
          "content-type": "application/javascript",
          "cache-control": "no-cache",
          "access-control-allow-origin": "*",
        },
      });
    }
    if (path.length === 1 && path[0] === "frame") {
      const release = await store.active();
      const service = url.searchParams.get("service") ?? "",
        region = url.searchParams.get("region") ?? "",
        mode = url.searchParams.get("mode"),
        token = url.searchParams.get("token") ?? "";
      if (!/^[a-f0-9-]{36}$/.test(token) || !isNativeBillingMode(mode))
        throw new Error("Invalid calculator scope");
      const scope = await store.scopeHeader(release, service, region);
      return new Response(frameHtml(release, scope, mode, origin, token, undefined,
        frameDataPath(release, service, region)), {
        headers: {
          ...baseHeaders,
          "content-type": "text/html",
          "cache-control": "no-store",
          "content-security-policy": `default-src 'none'; script-src ${origin}/api/calculator/snapshot/ 'unsafe-inline' 'unsafe-eval'; style-src ${origin}/api/calculator/snapshot/ 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'`,
        },
      });
    }
    if (path.length === 3 && path[1] === "data") {
      const release = await store.release(path[0]);
      const key = Object.keys(release.scopes).find(key => release.scopes[key] === path[2]);
      if (!key) throw new Error("Unknown synchronized scope data");
      const [service, region] = key.split("/");
      const scope = await store.scope(release, service, region, false);
      return new Response(frameDataScript(release, scope), {
        headers: {
          ...baseHeaders,
          "content-type": "application/javascript",
          "cache-control": "public, max-age=31536000, immutable",
          "access-control-allow-origin": "*",
        },
      });
    }
    if (path.length === 3 && path[1] === "asset") {
      const release = await store.release(path[0]);
      const entry = Object.entries(release.assets).find(
        ([, asset]) => asset.hash === path[2],
      );
      if (!entry) throw new Error("Unknown synchronized asset");
      let body = await store.read(entry[1].hash);
      if (entry[1].type === "application/javascript")
        body = rewriteImports(body, entry[0], release);
      return new Response(body, {
        headers: {
          ...baseHeaders,
          "content-type": entry[1].type,
          "cache-control": "public, max-age=31536000, immutable",
          "access-control-allow-origin": "*",
        },
      });
    }
    throw new Error("Unknown snapshot resource");
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Snapshot unavailable",
      },
      { status: 503, headers: { ...baseHeaders, "cache-control": "no-store" } },
    );
  }
}
