import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

async function getSession(headers: Headers) {
  return auth.api.getSession({
    headers,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const session = await getSession(request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await context.params;
  const body = (await request.json()) as { name?: string };
  const name = body.name?.trim();

  if (!name) {
    return Response.json({ error: "List name is required" }, { status: 400 });
  }

  const existingProject = db
    .query("SELECT id FROM project WHERE id = ? AND user_id = ?")
    .get(projectId, session.user.id) as { id: string } | null;

  if (!existingProject) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  db.transaction(() => {
    db.query(
      `
        INSERT INTO project_list (id, project_id, user_id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    ).run(id, projectId, session.user.id, name, now, now);

    db.query("UPDATE project SET updated_at = ? WHERE id = ?").run(now, projectId);
  })();

  return Response.json({ id, projectId, name, createdAt: now, updatedAt: now }, { status: 201 });
}
