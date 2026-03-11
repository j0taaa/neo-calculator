import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

async function getSession(headers: Headers) {
  return auth.api.getSession({
    headers,
  });
}

type UpdateListProductBody = {
  serviceCode?: string;
  serviceName?: string;
  productType?: string;
  title?: string;
  quantity?: number;
  config?: unknown;
  pricing?: unknown;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ listId: string; productId: string }> },
) {
  const session = await getSession(request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listId, productId } = await context.params;
  const body = (await request.json()) as UpdateListProductBody;

  const serviceCode = body.serviceCode?.trim();
  const serviceName = body.serviceName?.trim();
  const productType = body.productType?.trim();
  const title = body.title?.trim();
  const quantity = Math.max(1, Math.floor(body.quantity ?? 1));

  if (!serviceCode || !serviceName || !productType || !title) {
    return Response.json({ error: "serviceCode, serviceName, productType, and title are required" }, { status: 400 });
  }

  const product = db
    .query(
      `
        SELECT list_id, project_id
        FROM list_product
        WHERE id = ? AND list_id = ? AND user_id = ?
      `,
    )
    .get(productId, listId, session.user.id) as { list_id: string; project_id: string } | null;

  if (!product) {
    return Response.json({ error: "Product not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const configJson = JSON.stringify(body.config ?? {});
  const pricingJson = body.pricing === undefined ? null : JSON.stringify(body.pricing);

  db.transaction(() => {
    db.query(
      `
        UPDATE list_product
        SET
          service_code = ?,
          service_name = ?,
          product_type = ?,
          title = ?,
          quantity = ?,
          config_json = ?,
          pricing_json = ?,
          updated_at = ?
        WHERE id = ? AND list_id = ? AND user_id = ?
      `,
    ).run(
      serviceCode,
      serviceName,
      productType,
      title,
      quantity,
      configJson,
      pricingJson,
      now,
      productId,
      listId,
      session.user.id,
    );

    db.query("UPDATE project_list SET updated_at = ? WHERE id = ?").run(now, listId);
    db.query("UPDATE project SET updated_at = ? WHERE id = ?").run(now, product.project_id);
  })();

  return Response.json({
    id: productId,
    listId,
    projectId: product.project_id,
    serviceCode,
    serviceName,
    productType,
    title,
    quantity,
    config: body.config ?? {},
    pricing: body.pricing ?? null,
    updatedAt: now,
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ listId: string; productId: string }> },
) {
  const session = await getSession(request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listId, productId } = await context.params;
  const product = db
    .query(
      `
        SELECT id, project_id
        FROM list_product
        WHERE id = ? AND list_id = ? AND user_id = ?
      `,
    )
    .get(productId, listId, session.user.id) as { id: string; project_id: string } | null;

  if (!product) {
    return Response.json({ error: "Product not found" }, { status: 404 });
  }

  const now = new Date().toISOString();

  db.transaction(() => {
    db.query("DELETE FROM list_product WHERE id = ? AND list_id = ? AND user_id = ?").run(productId, listId, session.user.id);
    db.query("UPDATE project_list SET updated_at = ? WHERE id = ?").run(now, listId);
    db.query("UPDATE project SET updated_at = ? WHERE id = ?").run(now, product.project_id);
  })();

  return Response.json({
    id: productId,
    listId,
    projectId: product.project_id,
    deleted: true,
    updatedAt: now,
  });
}
