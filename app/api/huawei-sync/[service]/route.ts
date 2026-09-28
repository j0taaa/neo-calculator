import { getSessionFromHeaders } from "@/lib/api-route";
import { getListAccessForUser } from "@/lib/resource-access";
import { insertListProducts, touchProject } from "@/lib/resource-persistence";
import { db } from "@/lib/db";
import { parseFormInput, syncedForm, syncedQuote } from "@/lib/huawei-sync/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const requests = new Map<string, { since: number; count: number }>();

export async function GET(request: Request, context: { params: Promise<{ service: string }> }) {
  const session = await getSessionFromHeaders(request.headers);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("productId");
  const { service } = await context.params;
  const row = id ? db.query<{ id: string; list_id: string; config_json: string }, [string, string]>("SELECT id,list_id,config_json FROM list_product WHERE id=? AND service_code=?").get(id, `HWC:${service}`) : null;
  if (!row || !getListAccessForUser(session.user.id, row.list_id)) return Response.json({ error: "Estimate not found" }, { status: 404 });
  return Response.json({ id: row.id, listId: row.list_id, config: JSON.parse(row.config_json) });
}

export async function POST(request: Request, context: { params: Promise<{ service: string }> }) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const previous = requests.get(ip);
  const rate = previous && Date.now() - previous.since < 60_000 ? previous : { since: Date.now(), count: 0 };
  if (++rate.count > 60) return Response.json({ error: "Too many calculator requests" }, { status: 429 });
  if (requests.size > 5000) requests.clear();
  requests.set(ip, rate);
  try {
    const raw = await request.text();
    if (raw.length > 64_000) return Response.json({ error: "Request too large" }, { status: 413 });
    const body = JSON.parse(raw);
    const input = parseFormInput(body);
    const { service } = await context.params;
    if (body.action === "form") {
      const { release, form } = await syncedForm(service, input);
      return Response.json({ releaseId: release.id, verifiedAt: release.verification?.checkedAt, form });
    }
    if (!["quote", "save"].includes(body.action) || typeof body.releaseId !== "string") throw new Error("Invalid calculator action");
    const session = body.action === "save" ? await getSessionFromHeaders(request.headers) : null;
    const list = session && typeof body.listId === "string" ? getListAccessForUser(session.user.id, body.listId) : null;
    if (body.action === "save" && (!session || !list?.canEditProducts)) return Response.json({ error: "Sign in and select an editable cart" }, { status: 403 });
    if (body.productId && !db.query("SELECT id FROM list_product WHERE id=? AND list_id=? AND service_code=?").get(body.productId, body.listId, `HWC:${service}`)) return Response.json({ error: "Estimate not found in this cart" }, { status: 404 });
    const result = await syncedQuote(service, input, body.releaseId, body.action === "save");
    if (body.action === "quote") return Response.json({ quote: result.quote });
    const now = new Date().toISOString();
    const products = db.transaction(() => {
      if (body.productId) {
        db.query("UPDATE list_product SET title=?,config_json=?,pricing_json=?,updated_at=? WHERE id=? AND list_id=?").run(result.product.title, JSON.stringify(result.product.config), JSON.stringify(result.product.pricing), now, body.productId, body.listId);
        touchProject(list!.projectId, now);
        return [{ ...result.product, id: body.productId }];
      }
      const inserted = insertListProducts({ listId: body.listId, projectId: list!.projectId, userId: session!.user.id, now, products: [result.product] });
      touchProject(list!.projectId, now);
      return inserted;
    })();
    return Response.json({ product: products[0], quote: result.quote }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Calculator unavailable" }, { status: 422 });
  }
}
