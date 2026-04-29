import { getApiKeyUser, jsonError } from "@/lib/api-route";
import { createApiKeyForUser, deleteApiKeyForUser, getApiKeyForUser } from "@/lib/api-keys";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const apiKeyUser = await getApiKeyUser(request.headers);

  if (!apiKeyUser) {
    return jsonError("Invalid or missing API key. Provide your key via the X-API-Key header.", 401);
  }

  const apiKey = getApiKeyForUser(apiKeyUser.userId);
  return Response.json({ key: apiKey });
}

export async function POST(request: Request) {
  const apiKeyUser = await getApiKeyUser(request.headers);

  if (!apiKeyUser) {
    return jsonError("Invalid or missing API key. Provide your key via the X-API-Key header.", 401);
  }

  deleteApiKeyForUser(apiKeyUser.userId);

  const { key, id } = createApiKeyForUser(apiKeyUser.userId);
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
  const apiKeyUser = await getApiKeyUser(request.headers);

  if (!apiKeyUser) {
    return jsonError("Invalid or missing API key. Provide your key via the X-API-Key header.", 401);
  }

  deleteApiKeyForUser(apiKeyUser.userId);
  return Response.json({ deleted: true });
}