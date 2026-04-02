import { createProjectRecord } from "@/lib/resource-persistence";
import { getApiKeyUser, getTrimmedString, jsonError, readJsonBody } from "@/lib/api-route";
import { buildAccessibleProjectsPayload } from "@/lib/resource-access";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const apiKeyUser = await getApiKeyUser(request.headers);

  if (!apiKeyUser) {
    return jsonError("Invalid or missing API key. Provide your key via the X-API-Key header.", 401);
  }

  return Response.json(buildAccessibleProjectsPayload(apiKeyUser.userId));
}

export async function POST(request: Request) {
  const apiKeyUser = await getApiKeyUser(request.headers);

  if (!apiKeyUser) {
    return jsonError("Invalid or missing API key. Provide your key via the X-API-Key header.", 401);
  }

  const body = await readJsonBody<{ name?: string; description?: string | null }>(request);
  const name = getTrimmedString(body?.name);

  if (!name) {
    return jsonError("Project name is required");
  }

  const now = new Date().toISOString();
  const description = getTrimmedString(body?.description) ?? null;
  const id = createProjectRecord({ userId: apiKeyUser.userId, name, description, now });

  return Response.json(
    {
      id,
      name,
      ownerUserId: apiKeyUser.userId,
      accessLevel: "owner",
      canShare: true,
      description,
      createdAt: now,
      updatedAt: now,
    },
    { status: 201 },
  );
}