import { getSessionFromHeaders, getTrimmedString, jsonError, readJsonBody } from "@/lib/api-route";
import { db } from "@/lib/db";
import { getProjectAccessForUser } from "@/lib/resource-access";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const session = await getSessionFromHeaders(request.headers);

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const { projectId } = await context.params;
  const body = await readJsonBody<{ name?: string; description?: string | null }>(request);
  const name = getTrimmedString(body?.name);

  if (!body || !name) {
    return jsonError("Project name is required");
  }

  const existingProject = getProjectAccessForUser(session.user.id, projectId);
  if (!existingProject) {
    return jsonError("Project not found", 404);
  }
  if (!existingProject.canRename) {
    return jsonError("Only the project owner can rename this project", 403);
  }

  const now = new Date().toISOString();
  const description = getTrimmedString(body.description) ?? null;

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
  const session = await getSessionFromHeaders(request.headers);

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const { projectId } = await context.params;

  const existingProject = getProjectAccessForUser(session.user.id, projectId);
  if (!existingProject) {
    return jsonError("Project not found", 404);
  }
  if (!existingProject.canDelete) {
    return jsonError("Only the project owner can delete this project", 403);
  }

  db.query("DELETE FROM project WHERE id = ?").run(projectId);

  return Response.json({
    id: projectId,
    deleted: true,
  });
}
