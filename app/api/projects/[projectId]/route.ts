import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProjectAccessForUser } from "@/lib/resource-access";

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

  const existingProject = getProjectAccessForUser(session.user.id, projectId);
  if (!existingProject) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }
  if (!existingProject.canRename) {
    return Response.json({ error: "Only the project owner can rename this project" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const description = body?.description?.trim() || null;

  db.query(
    `
      UPDATE project
      SET name = ?, description = ?, updated_at = ?
      WHERE id = ?
    `,
  ).run(name, description, now, projectId);

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

  const existingProject = getProjectAccessForUser(session.user.id, projectId);
  if (!existingProject) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }
  if (!existingProject.canDelete) {
    return Response.json({ error: "Only the project owner can delete this project" }, { status: 403 });
  }

  db.query("DELETE FROM project WHERE id = ?").run(projectId);

  return Response.json({
    id: projectId,
    deleted: true,
  });
}
