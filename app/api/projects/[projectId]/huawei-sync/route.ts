import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { HuaweiSessionError, listHuaweiCarts, pushLocalProductsToHuaweiCart } from "@/lib/huawei-calculator";

export const runtime = "nodejs";

async function getSession(headers: Headers) {
  return auth.api.getSession({
    headers,
  });
}

type ListRow = {
  id: string;
  project_id: string;
  name: string;
  huawei_cart_key: string | null;
  huawei_cart_name: string | null;
  huawei_last_synced_at: string | null;
};

type ProductRow = {
  id: string;
  list_id: string;
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
  context: { params: Promise<{ projectId: string }> },
) {
  const session = await getSession(request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await context.params;
  const body = (await request.json().catch(() => null)) as { cookie?: string } | null;
  const cookie = body?.cookie?.trim() ?? "";

  if (!cookie) {
    return Response.json({ error: "Huawei Cloud cookie is required" }, { status: 400 });
  }

  const project = db
    .query("SELECT id, name FROM project WHERE id = ? AND user_id = ?")
    .get(projectId, session.user.id) as { id: string; name: string } | null;

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const lists = db
    .query(
      `
        SELECT id, project_id, name, huawei_cart_key
             , huawei_cart_name, huawei_last_synced_at
        FROM project_list
        WHERE project_id = ? AND user_id = ?
        ORDER BY updated_at DESC
      `,
    )
    .all(projectId, session.user.id) as ListRow[];

  if (lists.length === 0) {
    return Response.json({ error: "This project does not have carts to sync." }, { status: 400 });
  }

  try {
    await listHuaweiCarts(cookie);
  } catch (error) {
    if (error instanceof HuaweiSessionError) {
      return Response.json({ error: error.message }, { status: 401 });
    }

    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to validate Huawei Cloud session" },
      { status: 400 },
    );
  }

  const productRows = db
    .query(
      `
        SELECT id, list_id, service_code, service_name, product_type, title, quantity, config_json, pricing_json
        FROM list_product
        WHERE project_id = ? AND user_id = ?
        ORDER BY updated_at DESC
      `,
    )
    .all(projectId, session.user.id) as ProductRow[];

  const productsByListId = new Map<string, ProductRow[]>();
  for (const row of productRows) {
    const current = productsByListId.get(row.list_id) ?? [];
    current.push(row);
    productsByListId.set(row.list_id, current);
  }

  const touchedAt = new Date().toISOString();
  const results: Array<{
    id: string;
    huaweiCartKey: string | null;
    huaweiCartName: string | null;
    huaweiLastSyncedAt: string | null;
    huaweiLastError: string | null;
    updatedAt: string;
  }> = [];
  let syncedCount = 0;
  let failedCount = 0;

  for (const list of lists) {
    const listProducts = (productsByListId.get(list.id) ?? []).map((product) => ({
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
        products: listProducts,
        cookie,
      });

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
      ).run(syncedCart.key, syncedCart.name, now, now, list.id, session.user.id);

      results.push({
        id: list.id,
        huaweiCartKey: syncedCart.key,
        huaweiCartName: syncedCart.name,
        huaweiLastSyncedAt: now,
        huaweiLastError: null,
        updatedAt: now,
      });
      syncedCount += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sync with Huawei Cloud Calculator";

      db.query(
        `
          UPDATE project_list
          SET huawei_last_error = ?, updated_at = ?
          WHERE id = ? AND user_id = ?
        `,
      ).run(message, now, list.id, session.user.id);

      results.push({
        id: list.id,
        huaweiCartKey: list.huawei_cart_key,
        huaweiCartName: list.huawei_cart_name,
        huaweiLastSyncedAt: list.huawei_last_synced_at,
        huaweiLastError: message,
        updatedAt: now,
      });
      failedCount += 1;
    }
  }

  db.query("UPDATE project SET updated_at = ? WHERE id = ? AND user_id = ?").run(touchedAt, projectId, session.user.id);

  return Response.json({
    projectId,
    projectName: project.name,
    updatedAt: touchedAt,
    syncedCount,
    failedCount,
    lists: results,
  });
}
