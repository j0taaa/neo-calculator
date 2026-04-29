import { getApiKeyUser, jsonError } from "@/lib/api-route";
import { importSharedCopyToUser } from "@/lib/share-links";

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
    const imported = importSharedCopyToUser(shareId, apiKeyUser.userId);
    return Response.json(imported, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to import shared resource");
  }
}