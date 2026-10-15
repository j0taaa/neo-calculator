import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/api-route";
import {
  getListAccessForUser,
  getProjectAccessForUser,
} from "@/lib/resource-access";
import {
  mapStoredProductRow,
  type StoredProductRow,
} from "@/lib/resource-persistence";
import { importCartPayload } from "@/lib/resource-import";
import {
  readResourceJson,
  resourceCompiler,
  resourceErrorResponse,
} from "@/lib/cart-json/http";
import { ResourceDocumentError } from "@/lib/cart-json/types";
import { isRecord } from "@/lib/product-input";
import {
  listHuaweiCarts,
  getHuaweiCartDetail,
  writeHuaweiCart,
  HuaweiSessionError,
} from "@/lib/huawei-calculator";
import {
  getConnection,
  assertSameOrigin,
  connectionId,
  forgetConnection,
  connectionCookie,
} from "@/lib/huawei-carts/connection";
import { HuaweiConnectionError } from "@/lib/huawei-carts/login";
import {
  importCart,
  exportCart,
  cartDigest,
  signTransfer,
  checkTransfer,
} from "@/lib/huawei-carts/transfer";

export const runtime = "nodejs";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
function failure(request: Request, error: unknown) {
  if (error instanceof ResourceDocumentError)
    return resourceErrorResponse(error);
  if (error instanceof HuaweiSessionError) {
    forgetConnection(request);
    return NextResponse.json(
      {
        error:
          "Your Huawei session expired. Reconnect to continue. Your Neo carts are safe.",
      },
      {
        status: 401,
        headers: {
          "Set-Cookie": connectionCookie(""),
          "Cache-Control": "no-store",
        },
      },
    );
  }
  return reply(
    {
      error:
        error instanceof Error
          ? error.message
          : "Unable to transfer this cart.",
    },
    error instanceof HuaweiConnectionError ? error.status : 400,
  );
}
async function remote(key: string, cookie: string) {
  // A share key by itself is not proof that the current Huawei account owns it.
  if (!(await listHuaweiCarts(cookie)).some((cart) => cart.key === key))
    throw new HuaweiConnectionError(
      "This cart is not in the connected Huawei account. Refresh the list.",
      404,
    );
  return (await getHuaweiCartDetail(key, cookie)) as Record<string, unknown>;
}
export async function GET(request: Request) {
  try {
    const connection = getConnection(request),
      key = new URL(request.url).searchParams.get("key");
    if (!key)
      return reply({
        carts: await listHuaweiCarts(connection.cookie),
        accountScope: cartDigest([connection.account, connection.username]),
        refreshedAt: new Date().toISOString(),
      });
    const detail = await remote(key, connection.cookie);
    return reply(await importCart(detail));
  } catch (error) {
    return failure(request, error);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const connection = getConnection(request),
      input = await readResourceJson(request);
    if (!isRecord(input)) throw new Error("A transfer request is required.");
    if (
      input.connectionAccount !== connection.account ||
      input.connectionUsername !== connection.username
    )
      throw new HuaweiConnectionError(
        "The connected Huawei account changed. Refresh Huawei Carts before continuing.",
        409,
      );
    if (input.action === "import") {
      if (typeof input.key !== "string" || typeof input.projectId !== "string")
        throw new Error("Choose a cart and destination project.");
      const session = await getSessionFromHeaders(request.headers);
      if (!session)
        throw new HuaweiConnectionError(
          "Sign in to NeoCalculator to import into a project, or choose Local Carts.",
          401,
        );
      const project = getProjectAccessForUser(session.user.id, input.projectId);
      if (!project?.canCreateLists)
        throw new HuaweiConnectionError(
          "You cannot add carts to this project.",
          403,
        );
      const document = await importCart(
        await remote(input.key, connection.cookie),
      );
      return reply(
        {
          ...importCartPayload(session.user.id, input.projectId, {
            resourceType: "cart",
            ...document.cart,
          }),
          preserved: document.preserved,
        },
        201,
      );
    }
    if (!["preview", "export"].includes(String(input.action)))
      throw new Error("Unknown cart transfer action.");
    let document = input.document;
    if (typeof input.listId === "string") {
      const session = await getSessionFromHeaders(request.headers);
      const list =
        session && getListAccessForUser(session.user.id, input.listId);
      if (!list)
        throw new HuaweiConnectionError(
          "This Neo cart is unavailable to your account.",
          404,
        );
      const rows = db
        .query(
          "SELECT * FROM list_product WHERE list_id = ? ORDER BY created_at, id",
        )
        .all(input.listId) as StoredProductRow[];
      document = {
        schemaVersion: 1,
        resourceType: "cart",
        cart: { name: list.name, products: rows.map(mapStoredProductRow) },
      };
    }
    const compiled = await (await resourceCompiler()).document(document);
    if (compiled.payload.resourceType !== "cart")
      throw new Error("Export one cart at a time.");
    const key = typeof input.key === "string" && input.key ? input.key : null;
    const existing = key ? await remote(key, connection.cookie) : null;
    if (input.exportName !== undefined && typeof input.exportName !== "string")
      throw new Error("Choose a name for the Huawei cart.");
    const name = (
      typeof input.exportName === "string"
        ? input.exportName
        : existing
          ? String(existing.name)
          : compiled.payload.name
    ).trim();
    const payload = await exportCart(name, compiled.payload.products);
    if (Buffer.byteLength(JSON.stringify(payload)) > 2000000)
      throw new Error("This cart exceeds Huawei's transfer size limit.");
    const basis = {
      session: cartDigest(connectionId(request)),
      payload: cartDigest(payload),
      key,
      revision: existing ? cartDigest(existing) : null,
    };
    if (input.action === "preview") {
      const confirmation = {
        ...basis,
        expiresAt: Date.now() + 10 * 60000,
        nonce: randomUUID(),
      };
      return reply({
        name: payload.name,
        productCount: payload.cartListData.length,
        total: payload.totalPrice.amount,
        preserved: compiled.payload.products.filter(
          (product) => product.productType === "huawei-saved",
        ).length,
        existing: existing
          ? {
              key,
              name: existing.name,
              productCount: Array.isArray(existing.cartListData)
                ? existing.cartListData.length
                : 0,
            }
          : null,
        confirmation: {
          ...confirmation,
          signature: signTransfer(confirmation),
        },
      });
    }
    const proof = input.confirmation;
    if (!isRecord(proof))
      throw new HuaweiConnectionError(
        "Review this export before continuing.",
        409,
      );
    const { signature, ...signed } = proof;
    if (
      !checkTransfer(signed, signature) ||
      typeof signed.expiresAt !== "number" ||
      signed.expiresAt < Date.now() ||
      typeof signed.nonce !== "string" ||
      Object.entries(basis).some(([field, value]) => signed[field] !== value)
    )
      throw new HuaweiConnectionError(
        "The cart, account or Huawei destination changed. Review the export again.",
        409,
      );
    db.exec(
      "CREATE TABLE IF NOT EXISTS huawei_export_receipt (id TEXT PRIMARY KEY, cart_key TEXT, expires_at INTEGER NOT NULL)",
    );
    db.query("DELETE FROM huawei_export_receipt WHERE expires_at < ?").run(
      Date.now(),
    );
    const id = signTransfer(signed);
    const previous = db
      .query("SELECT cart_key FROM huawei_export_receipt WHERE id = ?")
      .get(id) as { cart_key: string | null } | null;
    if (previous?.cart_key)
      return reply({ key: previous.cart_key, name: payload.name });
    if (previous)
      throw new HuaweiConnectionError(
        "The previous export may have completed. Refresh Huawei Carts before trying a new export.",
        409,
      );
    const reserved = db
      .query(
        "INSERT OR IGNORE INTO huawei_export_receipt (id, cart_key, expires_at) VALUES (?, NULL, ?)",
      )
      .run(id, Date.now() + 24 * 60 * 60000);
    if (!reserved.changes)
      throw new HuaweiConnectionError(
        "This export is already in progress. Refresh Huawei Carts before retrying.",
        409,
      );
    const savedKey = await writeHuaweiCart(
      payload,
      connection.cookie,
      key ?? undefined,
    );
    db.query("UPDATE huawei_export_receipt SET cart_key = ? WHERE id = ?").run(
      savedKey,
      id,
    );
    return reply({ key: savedKey, name: payload.name }, 201);
  } catch (error) {
    return failure(request, error);
  }
}
