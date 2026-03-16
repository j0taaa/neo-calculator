import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildAccessibleProjectsPayload } from "@/lib/resource-access";

export const runtime = "nodejs";

async function getSession(headers: Headers) {
  return auth.api.getSession({
    headers,
  });
}

export async function GET(request: Request) {
  const session = await getSession(request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json(buildAccessibleProjectsPayload(session.user.id));
}

export async function POST(request: Request) {
  const session = await getSession(request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { name?: string; description?: string };
  const name = body.name?.trim();

  if (!name) {
    return Response.json({ error: "Project name is required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  db.query(
    `
      INSERT INTO project (id, user_id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
  ).run(id, session.user.id, name, body.description?.trim() || null, now, now);

  return Response.json(
    {
      id,
      name,
      ownerUserId: session.user.id,
      accessLevel: "owner",
      canShare: true,
      description: body.description?.trim() || null,
      createdAt: now,
      updatedAt: now,
    },
    { status: 201 },
  );
}
