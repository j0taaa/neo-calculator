import { getSessionFromHeaders, getTrimmedString, jsonError, readJsonBody } from "@/lib/api-route";
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
  const session = await getSessionFromHeaders(request.headers);

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const body = await readJsonBody<CreateShareBody>(request);
  const resourceId = getTrimmedString(body?.resourceId);

  if (!body || !isShareResourceType(body.resourceType) || !resourceId || !isShareMode(body.mode)) {
    return jsonError("resourceType, resourceId, and mode are required");
  }

  try {
    const share = createShareLink({
      ownerUserId: session.user.id,
      resourceType: body.resourceType,
      resourceId,
      mode: body.mode,
    });

    return Response.json({
      ...share,
      shareUrl: `/share/${share.id}`,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to create share link");
  }
}
