import { getSessionFromHeaders, jsonError, readJsonBody } from "@/lib/api-route";
import { db } from "@/lib/db";
import { HuaweiSessionError, pushLocalProductsToHuaweiCart } from "@/lib/huawei-calculator";
import { getListAccessForUser } from "@/lib/resource-access";
import { mapStoredProductRow, touchProject, type StoredProductRow } from "@/lib/resource-persistence";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ listId: string }> },
) {
  const session = await getSessionFromHeaders(request.headers);

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const { listId } = await context.params;
  const body = await readJsonBody<{ cookie?: string }>(request);
  const cookie = body?.cookie?.trim() ?? "";

  if (!cookie) {
    return jsonError("Huawei Cloud cookie is required");
  }

  const access = getListAccessForUser(session.user.id, listId);
  const list = db
    .query(
      `
        SELECT id, project_id, name, huawei_cart_key
        FROM project_list
        WHERE id = ?
      `,
    )
    .get(listId) as
    | { id: string; project_id: string; name: string; huawei_cart_key: string | null }
    | null;

  if (!list || !access) {
    return jsonError("List not found", 404);
  }
  if (!access.canSyncHuawei) {
    return jsonError("You do not have permission to sync this cart with Huawei Cloud", 403);
  }

  const productRows = db
    .query(
      `
        SELECT id, user_id, service_code, service_name, product_type, title, quantity, config_json, pricing_json
        FROM list_product
        WHERE list_id = ?
        ORDER BY updated_at DESC
      `,
    )
    .all(listId) as StoredProductRow[];

  const products = productRows.map(mapStoredProductRow);

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
          WHERE id = ?
        `,
      ).run(syncedCart.key, syncedCart.name, now, now, listId);

      touchProject(list.project_id, now);
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
        WHERE id = ?
      `,
    ).run(message, now, listId);

    if (error instanceof HuaweiSessionError) {
      return jsonError(message, 401);
    }

    return jsonError(message);
  }
}
