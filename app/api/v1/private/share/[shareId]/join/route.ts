import { getApiKeyUser, jsonError } from "@/lib/api-route";
import { joinCollaborativeShare } from "@/lib/share-links";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ shareId: string }> },
) {
  const apiKeyUser = await getApiKeyUser(request.headers);

  if (!apiKeyUser) {
    return jsonError("Invalid or missing API key. Provide your key via the X-API-Key header.", 401);
  }

  const { shareId } = await context.params;

  try {
    const joined = joinCollaborativeShare(shareId, apiKeyUser.userId);
    return Response.json(joined, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to join collaborative share");
  }
}