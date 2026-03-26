import { getSessionFromHeaders, jsonError } from "@/lib/api-route";
import { joinCollaborativeShare } from "@/lib/share-links";

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
    const joined = joinCollaborativeShare(shareId, session.user.id);
    return Response.json(joined, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to join collaborative share");
  }
}
