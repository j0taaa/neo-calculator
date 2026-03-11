import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { HuaweiSessionError, pushLocalProductsToHuaweiCart } from "@/lib/huawei-calculator";

export const runtime = "nodejs";

async function getSession(headers: Headers) {
  return auth.api.getSession({
    headers,
  });
}

type ProductRow = {
  id: string;
  service_code: string;
  service_name: string;
  product_type: string;
  title: string;
  quantity: number;
  config_json: string;
  pricing_json: string | null;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ listId: string }> },
) {
  const session = await getSession(request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listId } = await context.params;
  const body = (await request.json().catch(() => null)) as { cookie?: string } | null;
  const cookie = body?.cookie?.trim() ?? "";

  if (!cookie) {
    return Response.json({ error: "Huawei Cloud cookie is required" }, { status: 400 });
  }

  const list = db
    .query(
      `
        SELECT id, project_id, name, huawei_cart_key
        FROM project_list
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(listId, session.user.id) as
    | { id: string; project_id: string; name: string; huawei_cart_key: string | null }
    | null;

  if (!list) {
    return Response.json({ error: "List not found" }, { status: 404 });
  }

  const productRows = db
    .query(
      `
        SELECT id, service_code, service_name, product_type, title, quantity, config_json, pricing_json
        FROM list_product
        WHERE list_id = ? AND user_id = ?
        ORDER BY updated_at DESC
      `,
    )
    .all(listId, session.user.id) as ProductRow[];

  const products = productRows.map((product) => ({
    id: product.id,
    serviceCode: product.service_code,
    serviceName: product.service_name,
    productType: product.product_type,
    title: product.title,
    quantity: product.quantity,
    config: JSON.parse(product.config_json) as unknown,
    pricing: product.pricing_json ? (JSON.parse(product.pricing_json) as unknown) : null,
  }));

  const now = new Date().toISOString();

  try {
    const syncedCart = await pushLocalProductsToHuaweiCart({
      huaweiCartKey: list.huawei_cart_key,
      listName: list.name,
      products,
      cookie,
    });

    db.transaction(() => {
      db.query(
        `
          UPDATE project_list
          SET
            huawei_cart_key = ?,
            huawei_cart_name = ?,
            huawei_last_synced_at = ?,
            huawei_last_error = NULL,
            updated_at = ?
          WHERE id = ? AND user_id = ?
        `,
      ).run(syncedCart.key, syncedCart.name, now, now, listId, session.user.id);

      db.query("UPDATE project SET updated_at = ? WHERE id = ?").run(now, list.project_id);
    })();

    return Response.json({
      listId,
      projectId: list.project_id,
      huaweiCartKey: syncedCart.key,
      huaweiCartName: syncedCart.name,
      huaweiLastSyncedAt: now,
      huaweiLastError: null,
      updatedAt: now,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync with Huawei Cloud Calculator";
    db.query(
      `
        UPDATE project_list
        SET huawei_last_error = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `,
    ).run(message, now, listId, session.user.id);

    if (error instanceof HuaweiSessionError) {
      return Response.json({ error: message }, { status: 401 });
    }

    return Response.json({ error: message }, { status: 400 });
  }
}
