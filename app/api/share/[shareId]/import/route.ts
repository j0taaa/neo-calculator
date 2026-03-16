import { auth } from "@/lib/auth";
import { importSharedCopyToUser } from "@/lib/share-links";

export const runtime = "nodejs";

async function getSession(headers: Headers) {
  return auth.api.getSession({
    headers,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ shareId: string }> },
) {
  const session = await getSession(request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { shareId } = await context.params;

  try {
    const imported = importSharedCopyToUser(shareId, session.user.id);
    return Response.json(imported, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to import shared resource" }, { status: 400 });
  }
}
