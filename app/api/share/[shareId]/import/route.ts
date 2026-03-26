import { getSessionFromHeaders, jsonError } from "@/lib/api-route";
import { importSharedCopyToUser } from "@/lib/share-links";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ shareId: string }> },
) {
  const session = await getSessionFromHeaders(request.headers);

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const { shareId } = await context.params;

  try {
    const imported = importSharedCopyToUser(shareId, session.user.id);
    return Response.json(imported, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to import shared resource");
  }
}
