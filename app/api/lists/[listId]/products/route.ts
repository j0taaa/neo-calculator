import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

async function getSession(headers: Headers) {
  return auth.api.getSession({
    headers,
  });
}

type CreateListProductBody = {
  serviceCode?: string;
  serviceName?: string;
  productType?: string;
  title?: string;
  quantity?: number;
  config?: unknown;
  pricing?: unknown;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ listId: string }> },
) {
  const session = await getSession(request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listId } = await context.params;
  const list = db
    .query("SELECT id FROM project_list WHERE id = ? AND user_id = ?")
    .get(listId, session.user.id) as { id: string } | null;

  if (!list) {
    return Response.json({ error: "List not found" }, { status: 404 });
  }

  const products = db
    .query(
      `
        SELECT id, service_code, service_name, product_type, title, quantity, config_json, pricing_json, created_at, updated_at
        FROM list_product
        WHERE list_id = ? AND user_id = ?
        ORDER BY updated_at DESC
      `,
    )
    .all(listId, session.user.id) as Array<{
      id: string;
      service_code: string;
      service_name: string;
      product_type: string;
      title: string;
      quantity: number;
      config_json: string;
      pricing_json: string | null;
      created_at: string;
      updated_at: string;
    }>;

  return Response.json(
    products.map((product) => ({
      id: product.id,
      serviceCode: product.service_code,
      serviceName: product.service_name,
      productType: product.product_type,
      title: product.title,
      quantity: product.quantity,
      config: JSON.parse(product.config_json) as unknown,
      pricing: product.pricing_json ? (JSON.parse(product.pricing_json) as unknown) : null,
      createdAt: product.created_at,
      updatedAt: product.updated_at,
    })),
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ listId: string }> },
) {
  const session = await getSession(request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listId } = await context.params;
  const body = (await request.json()) as CreateListProductBody;

  const serviceCode = body.serviceCode?.trim();
  const serviceName = body.serviceName?.trim();
  const productType = body.productType?.trim();
  const title = body.title?.trim();
  const quantity = Math.max(1, Math.floor(body.quantity ?? 1));

  if (!serviceCode || !serviceName || !productType || !title) {
    return Response.json({ error: "serviceCode, serviceName, productType, and title are required" }, { status: 400 });
  }

  const list = db
    .query("SELECT id, project_id FROM project_list WHERE id = ? AND user_id = ?")
    .get(listId, session.user.id) as { id: string; project_id: string } | null;

  if (!list) {
    return Response.json({ error: "List not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const configJson = JSON.stringify(body.config ?? {});
  const pricingJson = body.pricing === undefined ? null : JSON.stringify(body.pricing);

  db.transaction(() => {
    db.query(
      `
        INSERT INTO list_product (
          id,
          list_id,
          project_id,
          user_id,
          service_code,
          service_name,
          product_type,
          title,
          quantity,
          config_json,
          pricing_json,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      id,
      listId,
      list.project_id,
      session.user.id,
      serviceCode,
      serviceName,
      productType,
      title,
      quantity,
      configJson,
      pricingJson,
      now,
      now,
    );

    db.query("UPDATE project_list SET updated_at = ? WHERE id = ?").run(now, listId);
    db.query("UPDATE project SET updated_at = ? WHERE id = ?").run(now, list.project_id);
  })();

  return Response.json(
    {
      id,
      listId,
      projectId: list.project_id,
      serviceCode,
      serviceName,
      productType,
      title,
      quantity,
      config: body.config ?? {},
      pricing: body.pricing ?? null,
      createdAt: now,
      updatedAt: now,
    },
    { status: 201 },
  );
}
