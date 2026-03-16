import { getSharedResourceSnapshot } from "@/lib/share-links";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ shareId: string }> },
) {
  const { shareId } = await context.params;
  const snapshot = getSharedResourceSnapshot(shareId);

  if (!snapshot) {
    return Response.json({ error: "Share not found" }, { status: 404 });
  }

  return Response.json(snapshot);
}
