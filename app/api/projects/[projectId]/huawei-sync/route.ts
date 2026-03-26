import { getSessionFromHeaders, jsonError, readJsonBody } from "@/lib/api-route";
import { db } from "@/lib/db";
import { HuaweiSessionError, listHuaweiCarts, pushLocalProductsToHuaweiCart } from "@/lib/huawei-calculator";
import { getProjectAccessForUser } from "@/lib/resource-access";
import { mapStoredProductsByListId, touchProject, type StoredProductRow } from "@/lib/resource-persistence";

export const runtime = "nodejs";

type ListRow = {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  huawei_cart_key: string | null;
  huawei_cart_name: string | null;
  huawei_last_synced_at: string | null;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const session = await getSessionFromHeaders(request.headers);

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const { projectId } = await context.params;
  const body = await readJsonBody<{ cookie?: string }>(request);
  const cookie = body?.cookie?.trim() ?? "";

  if (!cookie) {
    return jsonError("Huawei Cloud cookie is required");
  }

  const access = getProjectAccessForUser(session.user.id, projectId);
  const project = db
    .query("SELECT id, name FROM project WHERE id = ?")
    .get(projectId) as { id: string; name: string } | null;

  if (!project || !access) {
    return jsonError("Project not found", 404);
  }
  if (!access.canSyncHuawei) {
    return jsonError("You do not have permission to sync this project with Huawei Cloud", 403);
  }

  const lists = db
    .query(
      `
        SELECT id, project_id, name, huawei_cart_key
             , user_id, huawei_cart_name, huawei_last_synced_at
        FROM project_list
        WHERE project_id = ?
        ORDER BY updated_at DESC
      `,
    )
    .all(projectId) as ListRow[];

  if (lists.length === 0) {
    return jsonError("This project does not have carts to sync.");
  }

  try {
    await listHuaweiCarts(cookie);
  } catch (error) {
    if (error instanceof HuaweiSessionError) {
      return jsonError(error.message, 401);
    }

    return jsonError(error instanceof Error ? error.message : "Unable to validate Huawei Cloud session");
  }

  const productRows = db
    .query(
      `
        SELECT id, list_id, user_id, service_code, service_name, product_type, title, quantity, config_json, pricing_json
        FROM list_product
        WHERE project_id = ?
        ORDER BY updated_at DESC
      `,
    )
    .all(projectId) as StoredProductRow[];

  const productsByListId = mapStoredProductsByListId(productRows);

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
    const listProducts = productsByListId.get(list.id) ?? [];
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
          WHERE id = ?
        `,
      ).run(syncedCart.key, syncedCart.name, now, now, list.id);

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
          WHERE id = ?
        `,
      ).run(message, now, list.id);

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

  touchProject(projectId, touchedAt);

  return Response.json({
    projectId,
    projectName: project.name,
    updatedAt: touchedAt,
    syncedCount,
    failedCount,
    lists: results,
  });
}
