import { auth } from "@/lib/auth";
import { getProjectAccessForUser } from "@/lib/resource-access";
import { importCartPayload, importProjectPayload, parseImportedResourcePayload } from "@/lib/resource-import";

export const runtime = "nodejs";

async function getSession(headers: Headers) {
  return auth.api.getSession({
    headers,
  });
}

export async function POST(request: Request) {
  const session = await getSession(request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { payload?: unknown; targetProjectId?: string }
    | null;

  if (!body || body.payload === undefined) {
    return Response.json({ error: "Import payload is required" }, { status: 400 });
  }

  try {
    const payload = parseImportedResourcePayload(body.payload);

    if (payload.resourceType === "project") {
      const result = importProjectPayload(session.user.id, payload);
      return Response.json({
        resourceType: "project",
        projectId: result.projectId,
        firstListId: result.firstListId,
        name: result.name,
        importedListCount: result.importedListCount,
        importedProductCount: result.importedProductCount,
      }, { status: 201 });
    }

    const targetProjectId = body.targetProjectId?.trim();
    if (!targetProjectId) {
      return Response.json({ error: "targetProjectId is required when importing a cart" }, { status: 400 });
    }

    const project = getProjectAccessForUser(session.user.id, targetProjectId);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }
    if (!project.canCreateLists) {
      return Response.json({ error: "You do not have permission to import carts into this project" }, { status: 403 });
    }

    const result = importCartPayload(session.user.id, targetProjectId, payload);
    return Response.json({
      resourceType: "cart",
      projectId: result.projectId,
      listId: result.listId,
      name: result.name,
      importedProductCount: result.importedProductCount,
    }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to import file" },
      { status: 400 },
    );
  }
}
