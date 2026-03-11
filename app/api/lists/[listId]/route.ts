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
        huaweiCartKey?: string | null;
        huaweiCartName?: string | null;
      }
    | null;

  const list = db
    .query("SELECT id, project_id FROM project_list WHERE id = ? AND user_id = ?")
    .get(listId, session.user.id) as { id: string; project_id: string } | null;

  if (!list) {
    return Response.json({ error: "List not found" }, { status: 404 });
  }

  const nextKey = body?.huaweiCartKey?.trim() || null;
  const nextName = body?.huaweiCartName?.trim() || null;
  const now = new Date().toISOString();

  try {
    db.transaction(() => {
      db.query(
        `
          UPDATE project_list
          SET
            huawei_cart_key = ?,
            huawei_cart_name = ?,
            huawei_last_error = NULL,
            updated_at = ?
          WHERE id = ? AND user_id = ?
        `,
      ).run(nextKey, nextName, now, listId, session.user.id);

      db.query("UPDATE project SET updated_at = ? WHERE id = ?").run(now, list.project_id);
    })();
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      return Response.json({ error: "That Huawei cart is already linked to another list." }, { status: 409 });
    }

    throw error;
  }

  return Response.json({
    id: listId,
    projectId: list.project_id,
    huaweiCartKey: nextKey,
    huaweiCartName: nextName,
    huaweiLastError: null,
    updatedAt: now,
  });
}
