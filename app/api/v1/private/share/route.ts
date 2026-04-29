import { getApiKeyUser, getTrimmedString, jsonError, readJsonBody } from "@/lib/api-route";
import { createShareLink, type ShareMode, type ShareResourceType } from "@/lib/share-links";

export const runtime = "nodejs";

type CreateShareBody = {
  resourceType?: ShareResourceType;
  resourceId?: string;
  mode?: ShareMode;
};

function isShareResourceType(value: unknown): value is ShareResourceType {
  return value === "project" || value === "list";
}

function isShareMode(value: unknown): value is ShareMode {
  return value === "copy" || value === "collaborate";
}

export async function POST(request: Request) {
  const apiKeyUser = await getApiKeyUser(request.headers);

  if (!apiKeyUser) {
    return jsonError("Invalid or missing API key. Provide your key via the X-API-Key header.", 401);
  }

  const body = await readJsonBody<CreateShareBody>(request);
  const resourceId = getTrimmedString(body?.resourceId);

  if (!body || !isShareResourceType(body.resourceType) || !resourceId || !isShareMode(body.mode)) {
    return jsonError("resourceType, resourceId, and mode are required");
  }

  try {
    const share = createShareLink({
      ownerUserId: apiKeyUser.userId,
      resourceType: body.resourceType,
      resourceId,
      mode: body.mode,
    });

    return Response.json({
      ...share,
      shareUrl: `/share/${share.id}`,
    }, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to create share link");
  }
}