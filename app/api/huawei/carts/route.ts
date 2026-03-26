import { getSessionFromHeaders, jsonError, readJsonBody } from "@/lib/api-route";
import { db } from "@/lib/db";
import { HuaweiSessionError, listHuaweiCarts } from "@/lib/huawei-calculator";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSessionFromHeaders(request.headers);

  const body = await readJsonBody<{ cookie?: string }>(request);
  const cookie = body?.cookie?.trim() ?? "";

  if (!cookie) {
    return jsonError("Huawei Cloud cookie is required");
  }

  try {
    const carts = await listHuaweiCarts(cookie);
    const linkedByKey = session
      ? new Map(
          (
            db
              .query("SELECT id, huawei_cart_key FROM project_list WHERE user_id = ? AND huawei_cart_key IS NOT NULL")
              .all(session.user.id) as Array<{ id: string; huawei_cart_key: string }>
          ).map((row) => [row.huawei_cart_key, row.id]),
        )
      : new Map<string, string>();

    return Response.json({
      carts: carts.map((cart) => ({
        ...cart,
        associatedListId: linkedByKey.get(cart.key) ?? null,
      })),
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof HuaweiSessionError) {
      return jsonError(error.message, 401);
    }

    return jsonError(error instanceof Error ? error.message : "Unable to load Huawei carts", 500);
  }
}
