import { getSessionFromHeaders, jsonError } from "@/lib/api-route";
import { createApiKeyForUser, deleteApiKeyForUser, getApiKeyForUser } from "@/lib/api-keys";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSessionFromHeaders(request.headers);

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const apiKey = getApiKeyForUser(session.user.id);
  return Response.json({ key: apiKey });
}

export async function POST(request: Request) {
  const session = await getSessionFromHeaders(request.headers);

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  // Delete existing key if any (regenerate)
  deleteApiKeyForUser(session.user.id);

  const { key, id } = createApiKeyForUser(session.user.id);
  const now = new Date().toISOString();

  return Response.json(
    {
      key,
      id,
      createdAt: now,
      message: "Save this key securely. It will not be shown again.",
    },
    { status: 201 },
  );
}

export async function DELETE(request: Request) {
  const session = await getSessionFromHeaders(request.headers);

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  deleteApiKeyForUser(session.user.id);
  return Response.json({ deleted: true });
}