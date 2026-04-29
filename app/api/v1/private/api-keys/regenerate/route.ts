import { getApiKeyUser, jsonError } from "@/lib/api-route";
import { createApiKeyForUser, deleteApiKeyForUser } from "@/lib/api-keys";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const apiKeyUser = await getApiKeyUser(request.headers);

  if (!apiKeyUser) {
    return jsonError("Invalid or missing API key. Provide your key via the X-API-Key header.", 401);
  }

  deleteApiKeyForUser(apiKeyUser.userId);
  const { key, id } = createApiKeyForUser(apiKeyUser.userId);

  return Response.json({
    id,
    key,
    message: "API key regenerated. Save this key now. It will not be shown again.",
  });
}