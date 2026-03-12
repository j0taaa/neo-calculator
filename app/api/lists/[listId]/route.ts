import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

async function getSession(headers: Headers) {
  return auth.api.getSession({
    headers,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ listId: string }> },
) {
  const session = await getSession(request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listId } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | {
        name?: string | null;
        huaweiCartKey?: string | null;
        huaweiCartName?: string | null;
        projectId?: string | null;
      }
    | null;

  const list = db
    .query("SELECT id, project_id, name, huawei_cart_key, huawei_cart_name FROM project_list WHERE id = ? AND user_id = ?")
    .get(listId, session.user.id) as {
      id: string;
      project_id: string;
      name: string;
      huawei_cart_key: string | null;
      huawei_cart_name: string | null;
    } | null;

  if (!list) {
    return Response.json({ error: "List not found" }, { status: 404 });
  }

  const nextListName = body?.name?.trim() || list.name;
  const nextKey = body && "huaweiCartKey" in body ? body.huaweiCartKey?.trim() || null : list.huawei_cart_key;
  const nextHuaweiName = body && "huaweiCartName" in body ? body.huaweiCartName?.trim() || null : list.huawei_cart_name;
  const nextProjectId = body && "projectId" in body ? body.projectId?.trim() || list.project_id : list.project_id;
  const now = new Date().toISOString();

  if (nextProjectId !== list.project_id) {
    const targetProject = db
      .query("SELECT id FROM project WHERE id = ? AND user_id = ?")
      .get(nextProjectId, session.user.id) as { id: string } | null;

    if (!targetProject) {
      return Response.json({ error: "Target project not found" }, { status: 404 });
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
          WHERE id = ? AND user_id = ?
        `,
      ).run(nextProjectId, nextListName, nextKey, nextHuaweiName, now, listId, session.user.id);

      if (nextProjectId !== list.project_id) {
        db.query("UPDATE list_product SET project_id = ?, updated_at = ? WHERE list_id = ? AND user_id = ?").run(
          nextProjectId,
          now,
          listId,
          session.user.id,
        );
      }

      db.query("UPDATE project SET updated_at = ? WHERE id = ? AND user_id = ?").run(now, list.project_id, session.user.id);
      if (nextProjectId !== list.project_id) {
        db.query("UPDATE project SET updated_at = ? WHERE id = ? AND user_id = ?").run(now, nextProjectId, session.user.id);
      }
    })();
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      return Response.json({ error: "That Huawei cart is already linked to another list." }, { status: 409 });
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
  const session = await getSession(request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listId } = await context.params;
  const list = db
    .query("SELECT id, project_id FROM project_list WHERE id = ? AND user_id = ?")
    .get(listId, session.user.id) as { id: string; project_id: string } | null;

  if (!list) {
    return Response.json({ error: "List not found" }, { status: 404 });
  }

  const now = new Date().toISOString();

  db.transaction(() => {
    db.query("DELETE FROM project_list WHERE id = ? AND user_id = ?").run(listId, session.user.id);
    db.query("UPDATE project SET updated_at = ? WHERE id = ? AND user_id = ?").run(now, list.project_id, session.user.id);
  })();

  return Response.json({
    id: listId,
    projectId: list.project_id,
    deleted: true,
    updatedAt: now,
  });
}
