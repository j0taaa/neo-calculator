import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { evaluateForm } from "@/lib/huawei-sync/engine";
import { currentRelease, getSyncStore, parseFormInput, syncedQuote } from "@/lib/huawei-sync/service";
import type { AuditReport } from "@/lib/huawei-sync/audit-types";
import { ENGINE_VERSION } from "@/lib/huawei-sync/program";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" };
const requests = new Map<string, { since: number; count: number }>();

async function report() {
  const directory = process.env.HUAWEI_SYNC_LAB_DIR;
  if (!directory) return null;
  return JSON.parse(await readFile(join(directory, "report.json"), "utf8")) as AuditReport;
}

export async function GET(request: Request) {
  const data = await report();
  if (!data) return Response.json({ error: "Preview is not enabled" }, { status: 404 });
  const image = new URL(request.url).searchParams.get("image");
  if (image) {
    if (!/^[a-z0-9-]+\.png$/.test(image) || !data.results.some(item => item.screenshot === image)) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(await readFile(join(process.env.HUAWEI_SYNC_LAB_DIR!, image))), { headers: { ...headers, "content-type": "image/png" } });
  }
  const store = getSyncStore();
  const releases = store.listReleases();
  const defaultChecks = JSON.parse(await readFile(join(process.env.HUAWEI_SYNC_LAB_DIR!, "dcs-default-checks.json"), "utf8").catch(() => "[]")) as { region: string; result: string; cases?: number; error?: string; configHash: string; productsHash: string; engineVersion: string }[];
  return Response.json({ ...data, results: data.results.map(item => {
    const release = releases.find(r => r.service.id === item.service && r.region === item.region);
    let verified = false;
    try { verified = currentRelease(item.service, item.region).id === release?.id && release?.configHash === item.configHash && release?.productsHash === item.productsHash; } catch { /* Held scopes remain inspectable. */ }
    return { ...item, verified, releaseId: release?.id, cases: release?.verification?.cases ?? 0, diagnostics: release?.diagnostics ?? [], defaultCheck: item.service === "redis" ? defaultChecks.find(check => check.region === item.region && check.configHash === item.configHash && check.productsHash === item.productsHash && check.engineVersion === ENGINE_VERSION) : undefined };
  }) }, { headers });
}

export async function POST(request: Request) {
  const data = await report();
  if (!data) return Response.json({ error: "Preview is not enabled" }, { status: 404 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const previous = requests.get(ip);
  const rate = previous && Date.now() - previous.since < 60000 ? previous : { since: Date.now(), count: 0 };
  if (++rate.count > 60) return Response.json({ error: "Too many preview requests" }, { status: 429 });
  if (requests.size > 5000) requests.clear();
  requests.set(ip, rate);
  try {
    const raw = await request.text();
    if (raw.length > 64000) return new Response(null, { status: 413 });
    const body = JSON.parse(raw);
    const input = parseFormInput(body);
    const item = data.results.find(item => item.service === body.service && item.region === input.region);
    if (!item) throw new Error("This scope is not part of the preview");
    if (body.action === "quote") {
      if (typeof body.releaseId !== "string") throw new Error("A verified release is required");
      const release = currentRelease(item.service, input.region, body.releaseId);
      if (release.configHash !== item.configHash || release.productsHash !== item.productsHash) throw new Error("Preview snapshot has changed; recapture it before quoting");
      const { quote } = await syncedQuote(item.service, input, body.releaseId, true);
      return Response.json({ quote }, { headers });
    }
    if (body.action !== "form") throw new Error("Invalid action");
    const store = getSyncStore();
    const form = await evaluateForm(store.body(item.configHash), JSON.parse(store.body(item.productsHash)), input);
    return Response.json({ form }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Preview unavailable" }, { status: 422, headers });
  }
}
