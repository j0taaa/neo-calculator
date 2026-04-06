import { getSessionFromHeaders, jsonError } from "@/lib/api-route";
import { createApiKeyForUser, deleteApiKeyForUser } from "@/lib/api-keys";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSessionFromHeaders(request.headers);

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  deleteApiKeyForUser(session.user.id);
  const { key, id } = createApiKeyForUser(session.user.id);

  return Response.json({
    id,
    key,
    message: "API key regenerated. Save this key now. It will not be shown again.",
  });
}