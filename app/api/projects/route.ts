import { createProjectRecord } from "@/lib/resource-persistence";
import { getSessionFromHeaders, getTrimmedString, jsonError, readJsonBody } from "@/lib/api-route";
import { buildAccessibleProjectsPayload } from "@/lib/resource-access";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSessionFromHeaders(request.headers);

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  return Response.json(buildAccessibleProjectsPayload(session.user.id));
}

export async function POST(request: Request) {
  const session = await getSessionFromHeaders(request.headers);

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const body = await readJsonBody<{ name?: string; description?: string | null }>(request);
  const name = getTrimmedString(body?.name);

  if (!name) {
    return jsonError("Project name is required");
  }

  const now = new Date().toISOString();
  const description = getTrimmedString(body?.description) ?? null;
  const id = createProjectRecord({ userId: session.user.id, name, description, now });

  return Response.json(
    {
      id,
      name,
      ownerUserId: session.user.id,
      accessLevel: "owner",
      canShare: true,
      description,
      createdAt: now,
      updatedAt: now,
    },
    { status: 201 },
  );
}
