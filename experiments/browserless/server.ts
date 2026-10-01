import { readFile } from "node:fs/promises";
import { serve } from "bun";
import { HuaweiCollector } from "../../lib/huawei-sync/collector";
import { SyncStore } from "../../lib/huawei-sync/store";
import { DemoSources, type Scope } from "./sources";
import { BrowserlessSession } from "./runtime";
const store = new SyncStore(
  process.env.BROWSERLESS_DB || "/tmp/neo-browserless-demo/sources.sqlite",
);
const sources = new DemoSources(new HuaweiCollector(store));
const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
const sessions = new Map<
  string,
  { session: BrowserlessSession; touched: number; busy: boolean }
>();
let opening = false;
const opens = new Map<string, { count: number; since: number }>();
const headers = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers });
const server = serve({
  hostname: process.env.BROWSERLESS_HOST || "127.0.0.1",
  port: Number(process.env.BROWSERLESS_PORT || 3318),
  maxRequestBodySize: 4096,
  idleTimeout: 255,
  async fetch(request: Request): Promise<Response> {
    const path =
      new URL(request.url).pathname.replace(/^\/browserless-demo/, "") || "/";
    try {
      if (path === "/" && request.method === "GET")
        return new Response(html, {
          headers: {
            ...headers,
            "content-type": "text/html;charset=utf-8",
            "content-security-policy":
              "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
          },
        });
      if (path === "/api/directory" && request.method === "GET")
        return json((await sources.getShared()).directory);
      if (path === "/api/evidence" && request.method === "GET")
        return json(
          JSON.parse(
            await readFile(new URL("./evidence.json", import.meta.url), "utf8"),
          ),
        );
      if (path !== "/api/session" || request.method !== "POST")
        return json({ error: "Not found" }, 404);
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        return json({ error: "Use application/json" }, 415);
      const body = await request.json();
      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        !["open", "change", "close"].includes(body.action)
      )
        return json({ error: "Invalid action" }, 422);
      if (
        body.action === "open"
          ? [body.service, body.region, body.billingMode].some(
              (value) => typeof value !== "string",
            )
          : typeof body.session !== "string"
      )
        return json({ error: "Invalid scope or session" }, 422);
      if (body.action === "open") {
        if (opening || sessions.size >= 1)
          return json(
            {
              error:
                "The experiment has one sandbox slot. Close the existing demo or wait two minutes.",
            },
            429,
          );
        const ip = server.requestIP(request)?.address || "local";
        let limit = opens.get(ip);
        if (!limit || Date.now() - limit.since >= 3600_000) {
          limit = { count: 0, since: Date.now() };
          opens.set(ip, limit);
        }
        if (++limit.count > 12)
          return json(
            { error: "Demo opening limit reached. Try again later." },
            429,
          );
        opening = true;
        try {
          const session = await BrowserlessSession.open(sources, {
            service: body.service,
            region: body.region,
            billingMode: body.billingMode,
          } as Scope);
          try {
            const state = await session.state();
            const id = crypto.randomUUID();
            sessions.set(id, { session, touched: Date.now(), busy: false });
            return json({ session: id, ...state });
          } catch (error) {
            await session.close();
            throw error;
          }
        } finally {
          opening = false;
        }
      }
      const record = sessions.get(body.session);
      if (!record)
        return json(
          { error: "Demo session expired. Open the calculator again." },
          410,
        );
      if (record.busy)
        return json({ error: "Wait for the current change to finish." }, 409);
      record.busy = true;
      record.touched = Date.now();
      try {
        if (body.action === "close") {
          sessions.delete(body.session);
          await record.session.close();
          return json({ closed: true });
        }
        if (
          body.action !== "change" ||
          typeof body.field !== "string" ||
          !["string", "number", "boolean"].includes(typeof body.value)
        )
          return json({ error: "Invalid action" }, 422);
        const state = await record.session.change(body.field, body.value);
        record.touched = Date.now();
        return json({ session: body.session, ...state });
      } catch (error) {
        sessions.delete(body.session);
        await record.session.close();
        throw error;
      } finally {
        record.busy = false;
      }
    } catch (error) {
      return json(
        {
          error:
            error instanceof Error ? error.message : "Experiment unavailable",
        },
        422,
      );
    }
  },
});
const sweep = setInterval(() => {
  for (const [id, record] of sessions)
    if (!record.busy && Date.now() - record.touched > 120_000) {
      sessions.delete(id);
      void record.session.close();
    }
  for (const [ip, limit] of opens)
    if (Date.now() - limit.since > 3600_000) opens.delete(ip);
}, 15000);
async function stop() {
  clearInterval(sweep);
  server.stop(true);
  await Promise.all([...sessions.values()].map((r) => r.session.close()));
  store.close();
  process.exit();
}
process.on("SIGTERM", () => void stop());
process.on("SIGINT", () => void stop());
console.log(
  `Browserless experiment listening on ${server.hostname}:${server.port}`,
);
