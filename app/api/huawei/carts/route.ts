import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { HuaweiSessionError, listHuaweiCarts } from "@/lib/huawei-calculator";

export const runtime = "nodejs";

async function getSession(headers: Headers) {
  return auth.api.getSession({
    headers,
  });
}

export async function POST(request: Request) {
  const session = await getSession(request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { cookie?: string } | null;
  const cookie = body?.cookie?.trim() ?? "";

  if (!cookie) {
    return Response.json({ error: "Huawei Cloud cookie is required" }, { status: 400 });
  }

  try {
    const carts = await listHuaweiCarts(cookie);
    const linkedLists = db
      .query("SELECT id, huawei_cart_key FROM project_list WHERE user_id = ? AND huawei_cart_key IS NOT NULL")
      .all(session.user.id) as Array<{ id: string; huawei_cart_key: string }>;
    const linkedByKey = new Map(linkedLists.map((row) => [row.huawei_cart_key, row.id]));

    return Response.json({
      carts: carts.map((cart) => ({
        ...cart,
        associatedListId: linkedByKey.get(cart.key) ?? null,
      })),
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof HuaweiSessionError) {
      return Response.json({ error: error.message }, { status: 401 });
    }

    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load Huawei carts" },
      { status: 500 },
    );
  }
}
