import { getApiKeyUser, getTrimmedString, jsonError, readJsonBody } from "@/lib/api-route";
import { db } from "@/lib/db";
import { getListAccessForUser, getProjectAccessForUser } from "@/lib/resource-access";
import { touchProject } from "@/lib/resource-persistence";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ listId: string }> },
) {
  const apiKeyUser = await getApiKeyUser(request.headers);

  if (!apiKeyUser) {
    return jsonError("Invalid or missing API key. Provide your key via the X-API-Key header.", 401);
  }

  const { listId } = await context.params;
  const body = await readJsonBody<{
    name?: string | null;
    huaweiCartKey?: string | null;
    huaweiCartName?: string | null;
    projectId?: string | null;
  }>(request);

  const listAccess = getListAccessForUser(apiKeyUser.userId, listId);
  const list = db
    .query("SELECT id, project_id, name, huawei_cart_key, huawei_cart_name FROM project_list WHERE id = ?")
    .get(listId) as {
      id: string;
      project_id: string;
      name: string;
      huawei_cart_key: string | null;
      huawei_cart_name: string | null;
    } | null;

  if (!list || !listAccess) {
    return jsonError("List not found", 404);
  }

  if (!body) {
    return jsonError("Request body is required");
  }

  const hasNameUpdate = Object.prototype.hasOwnProperty.call(body, "name");
  const hasHuaweiKeyUpdate = Object.prototype.hasOwnProperty.call(body, "huaweiCartKey");
  const hasHuaweiNameUpdate = Object.prototype.hasOwnProperty.call(body, "huaweiCartName");
  const hasProjectUpdate = Object.prototype.hasOwnProperty.call(body, "projectId");

  if (!hasNameUpdate && !hasHuaweiKeyUpdate && !hasHuaweiNameUpdate && !hasProjectUpdate) {
    return jsonError("At least one field must be provided");
  }

  if (hasNameUpdate && !listAccess.canRename) {
    return jsonError("You do not have permission to rename this cart", 403);
  }

  if ((hasHuaweiKeyUpdate || hasHuaweiNameUpdate) && !listAccess.canManageHuaweiLink) {
    return jsonError("You do not have permission to manage Huawei cart links for this cart", 403);
  }

  const nextListName = hasNameUpdate ? getTrimmedString(body.name) : list.name;
  const nextKey = hasHuaweiKeyUpdate ? getTrimmedString(body.huaweiCartKey) : list.huawei_cart_key;
  const nextHuaweiName = hasHuaweiNameUpdate ? getTrimmedString(body.huaweiCartName) : list.huawei_cart_name;
  const nextProjectId = hasProjectUpdate ? getTrimmedString(body.projectId) : list.project_id;

  if (!nextListName) {
    return jsonError("List name is required");
  }
  if (!nextProjectId) {
    return jsonError("Target project is required");
  }

  const now = new Date().toISOString();

  if (nextProjectId !== list.project_id) {
    if (!listAccess.canMove) {
      return jsonError("Only the cart owner can move this cart", 403);
    }

    const targetProject = getProjectAccessForUser(apiKeyUser.userId, nextProjectId);

    if (!targetProject || !targetProject.canCreateLists) {
      return jsonError("Target project not found", 404);
    }
  }

  try {
    db.transaction(() => {
      db.query(
        `
          UPDATE project_list
          SET
            project_id = ?,
            name = ?,
            huawei_cart_key = ?,
            huawei_cart_name = ?,
            huawei_last_error = NULL,
            updated_at = ?
          WHERE id = ?
        `,
      ).run(nextProjectId, nextListName, nextKey, nextHuaweiName, now, listId);

      if (nextProjectId !== list.project_id) {
        db.query("UPDATE list_product SET project_id = ?, updated_at = ? WHERE list_id = ?").run(
          nextProjectId,
          now,
          listId,
        );
      }

      touchProject(list.project_id, now);
      if (nextProjectId !== list.project_id) {
        touchProject(nextProjectId, now);
      }
    })();
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      return jsonError("That Huawei cart is already linked to another list.", 409);
    }

    throw error;
  }

  return Response.json({
    id: listId,
    projectId: nextProjectId,
    previousProjectId: list.project_id,
    name: nextListName,
    huaweiCartKey: nextKey,
    huaweiCartName: nextHuaweiName,
    huaweiLastError: null,
    updatedAt: now,
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ listId: string }> },
) {
  const apiKeyUser = await getApiKeyUser(request.headers);

  if (!apiKeyUser) {
    return jsonError("Invalid or missing API key. Provide your key via the X-API-Key header.", 401);
  }

  const { listId } = await context.params;
  const listAccess = getListAccessForUser(apiKeyUser.userId, listId);
  const list = db
    .query("SELECT id, project_id FROM project_list WHERE id = ?")
    .get(listId) as { id: string; project_id: string } | null;

  if (!list || !listAccess) {
    return jsonError("List not found", 404);
  }
  if (!listAccess.canDelete) {
    return jsonError("Only the cart owner can delete this cart", 403);
  }

  const now = new Date().toISOString();

  db.transaction(() => {
    db.query("DELETE FROM project_list WHERE id = ?").run(listId);
    touchProject(list.project_id, now);
  })();

  return Response.json({
    id: listId,
    projectId: list.project_id,
    deleted: true,
    updatedAt: now,
  });
}