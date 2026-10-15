import { getApiKeyUser, jsonError } from "@/lib/api-route";
import { getProjectAccessForUser } from "@/lib/resource-access";
import { importCartPayload, importProjectPayload } from "@/lib/resource-import";
import { prepareResourceImport, readResourceJson, resourceErrorResponse } from "@/lib/cart-json/http";
import { isRecord } from "@/lib/product-input";
import { ResourceDocumentError } from "@/lib/cart-json/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const apiKeyUser = await getApiKeyUser(request.headers);

  if (!apiKeyUser) {
    return jsonError("Invalid or missing API key. Provide your key via the X-API-Key header.", 401);
  }

  try {
    const body = await readResourceJson(request);
    if (!isRecord(body) || body.payload === undefined) return jsonError("Import payload is required");
    if (body.targetProjectId !== undefined && typeof body.targetProjectId !== "string") return jsonError("targetProjectId must be a string");
    const payload = await prepareResourceImport(body.payload);

    if (payload.resourceType === "project") {
      const result = importProjectPayload(apiKeyUser.userId, payload);
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

    const project = getProjectAccessForUser(apiKeyUser.userId, targetProjectId);
    if (!project) {
      return jsonError("Project not found", 404);
    }
    if (!project.canCreateLists) {
      return jsonError("You do not have permission to import carts into this project", 403);
    }

    const result = importCartPayload(apiKeyUser.userId, targetProjectId, payload);
    return Response.json({
      resourceType: "cart",
      projectId: result.projectId,
      listId: result.listId,
      name: result.name,
      importedProductCount: result.importedProductCount,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof ResourceDocumentError) return resourceErrorResponse(error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to import file" },
      { status: 400 },
    );
  }
}
