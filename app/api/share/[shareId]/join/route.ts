import { auth } from "@/lib/auth";
import { joinCollaborativeShare } from "@/lib/share-links";

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
    const joined = joinCollaborativeShare(shareId, session.user.id);
    return Response.json(joined, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to join collaborative share" }, { status: 400 });
  }
}
