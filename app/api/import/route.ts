import { getSessionFromHeaders, jsonError, readJsonBody } from "@/lib/api-route";
import { getProjectAccessForUser } from "@/lib/resource-access";
import { importCartPayload, importProjectPayload, parseImportedResourcePayload } from "@/lib/resource-import";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSessionFromHeaders(request.headers);

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const body = await readJsonBody<{ payload?: unknown; targetProjectId?: string }>(request);

  if (!body || body.payload === undefined) {
    return jsonError("Import payload is required");
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
      return jsonError("targetProjectId is required when importing a cart");
    }

    const project = getProjectAccessForUser(session.user.id, targetProjectId);
    if (!project) {
      return jsonError("Project not found", 404);
    }
    if (!project.canCreateLists) {
      return jsonError("You do not have permission to import carts into this project", 403);
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
