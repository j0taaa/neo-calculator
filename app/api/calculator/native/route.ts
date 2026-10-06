import { isNativeOperationId } from "@/lib/huawei-native/native-operations";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const rates = new Map<string, { start: number; requests: number; opens: number }>();
const headers = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" };
async function proxy(request: Request) {
  const base = process.env.HUAWEI_NATIVE_URL, token = process.env.HUAWEI_NATIVE_TOKEN;
  if (!base || !token) return Response.json({ error: "Huawei live calculator is not enabled" }, { status: 404, headers });
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
    if (rates.size > 5000) rates.clear();
    let rate = rates.get(ip);
    if (!rate || Date.now() - rate.start > 60000) { rate = { start: Date.now(), requests: 0, opens: 0 }; rates.set(ip, rate); }
    let body: string | undefined;
    let closing = false;
    if (request.method === "POST") {
      const origin = request.headers.get("origin");
      if (origin && origin !== new URL(request.url).origin && origin !== process.env.BETTER_AUTH_URL) return new Response(null, { status: 403 });
      body = await request.text();
      if (body.length > 120000) return new Response(null, { status: 413 });
      const data = JSON.parse(body);
      closing = (data.action === "close" && typeof data.session === "string") || (data.action === "cancel" && isNativeOperationId(data.operationId));
      if (["open", "restore"].includes(data.action) && ++rate.opens > 20) return Response.json({ error: "Too many new sessions; please wait a minute" }, { status: 429, headers });
    }
    // Cleanup must remain available when interactive requests hit the rate limit.
    if (!closing && ++rate.requests > 60) return Response.json({ error: "Too many requests; please wait a minute" }, { status: 429, headers });
    const response = await fetch(`${base}/${request.method === "GET" ? "directory" : "session"}`, { method: request.method,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body, cache: "no-store", signal: closing ? AbortSignal.timeout(300000) : AbortSignal.any([request.signal, AbortSignal.timeout(300000)]) });
    return new Response(await response.text(), { status: response.status, headers: { ...headers, "content-type": "application/json" } });
  } catch { return Response.json({ error: "The live calculator is temporarily unavailable. Try reopening it." }, { status: 502, headers }); }
}
export const GET = proxy;
export const POST = proxy;
