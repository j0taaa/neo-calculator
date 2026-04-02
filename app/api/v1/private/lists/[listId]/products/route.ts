import { getApiKeyUser, jsonError, readJsonBody } from "@/lib/api-route";
import { db } from "@/lib/db";
import { getListAccessForUser } from "@/lib/resource-access";
import { insertListProducts, mapStoredProductRow, touchProject, type StoredProductRow } from "@/lib/resource-persistence";

export const runtime = "nodejs";

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
  const apiKeyUser = await getApiKeyUser(request.headers);

  if (!apiKeyUser) {
    return jsonError("Invalid or missing API key. Provide your key via the X-API-Key header.", 401);
  }

  const { listId } = await context.params;
  const list = getListAccessForUser(apiKeyUser.userId, listId);

  if (!list) {
    return jsonError("List not found", 404);
  }

  const products = db
    .query(
      `
        SELECT id, service_code, service_name, product_type, title, quantity, config_json, pricing_json, created_at, updated_at
        FROM list_product
        WHERE list_id = ?
        ORDER BY updated_at DESC
      `,
    )
    .all(listId) as StoredProductRow[];

  return Response.json(products.map(mapStoredProductRow));
}

export async function POST(
  request: Request,
  context: { params: Promise<{ listId: string }> },
) {
  const apiKeyUser = await getApiKeyUser(request.headers);

  if (!apiKeyUser) {
    return jsonError("Invalid or missing API key. Provide your key via the X-API-Key header.", 401);
  }

  const { listId } = await context.params;
  const body = await readJsonBody<CreateListProductBody>(request);

  const serviceCode = body?.serviceCode?.trim();
  const serviceName = body?.serviceName?.trim();
  const productType = body?.productType?.trim();
  const title = body?.title?.trim();
  const quantity = Math.max(1, Math.floor(body?.quantity ?? 1));

  if (!serviceCode || !serviceName || !productType || !title) {
    return jsonError("serviceCode, serviceName, productType, and title are required");
  }

  const list = getListAccessForUser(apiKeyUser.userId, listId);

  if (!list) {
    return jsonError("List not found", 404);
  }
  if (!list.canEditProducts) {
    return jsonError("You do not have permission to edit this cart", 403);
  }

  const now = new Date().toISOString();
  let createdProduct = {
    id: crypto.randomUUID(),
    serviceCode,
    serviceName,
    productType,
    title,
    quantity,
    config: body?.config ?? {},
    pricing: body?.pricing ?? null,
    createdAt: now,
    updatedAt: now,
  };

  db.transaction(() => {
    [createdProduct] = insertListProducts({
      listId,
      projectId: list.projectId,
      userId: apiKeyUser.userId,
      now,
      products: [{ serviceCode, serviceName, productType, title, quantity, config: body?.config, pricing: body?.pricing }],
    });

    db.query("UPDATE project_list SET updated_at = ? WHERE id = ?").run(now, listId);
    touchProject(list.projectId, now);
  })();

  return Response.json(
    {
      id: createdProduct.id,
      listId,
      projectId: list.projectId,
      serviceCode,
      serviceName,
      productType,
      title,
      quantity: createdProduct.quantity,
      config: createdProduct.config,
      pricing: createdProduct.pricing,
      createdAt: createdProduct.createdAt,
      updatedAt: createdProduct.updatedAt,
    },
    { status: 201 },
  );
}