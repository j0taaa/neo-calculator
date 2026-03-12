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
  context: { params: Promise<{ projectId: string }> },
) {
  const session = await getSession(request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | {
        name?: string;
        description?: string | null;
      }
    | null;

  const name = body?.name?.trim();

  if (!name) {
    return Response.json({ error: "Project name is required" }, { status: 400 });
  }

  const existingProject = db
    .query("SELECT id FROM project WHERE id = ? AND user_id = ?")
    .get(projectId, session.user.id) as { id: string } | null;

  if (!existingProject) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const description = body?.description?.trim() || null;

  db.query(
    `
      UPDATE project
      SET name = ?, description = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `,
  ).run(name, description, now, projectId, session.user.id);

  return Response.json({
    id: projectId,
    name,
    description,
    updatedAt: now,
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const session = await getSession(request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await context.params;

  const existingProject = db
    .query("SELECT id FROM project WHERE id = ? AND user_id = ?")
    .get(projectId, session.user.id) as { id: string } | null;

  if (!existingProject) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  db.query("DELETE FROM project WHERE id = ? AND user_id = ?").run(projectId, session.user.id);

  return Response.json({
    id: projectId,
    deleted: true,
  });
}
