import { auth } from "@/lib/auth";
import { createShareLink, type ShareMode, type ShareResourceType } from "@/lib/share-links";

export const runtime = "nodejs";

type CreateShareBody = {
  resourceType?: ShareResourceType;
  resourceId?: string;
  mode?: ShareMode;
};

async function getSession(headers: Headers) {
  return auth.api.getSession({
    headers,
  });
}

function isShareResourceType(value: unknown): value is ShareResourceType {
  return value === "project" || value === "list";
}

function isShareMode(value: unknown): value is ShareMode {
  return value === "copy" || value === "collaborate";
}

export async function POST(request: Request) {
  const session = await getSession(request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as CreateShareBody | null;
  if (!body || !isShareResourceType(body.resourceType) || typeof body.resourceId !== "string" || !isShareMode(body.mode)) {
    return Response.json({ error: "resourceType, resourceId, and mode are required" }, { status: 400 });
  }

  try {
    const share = createShareLink({
      ownerUserId: session.user.id,
      resourceType: body.resourceType,
      resourceId: body.resourceId.trim(),
      mode: body.mode,
    });

    return Response.json({
      ...share,
      shareUrl: `/share/${share.id}`,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to create share link" }, { status: 400 });
  }
}
