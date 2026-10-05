import { isLegacyHuaweiProduct, LEGACY_RECONFIGURE_MESSAGE } from "@/lib/huawei-native/legacy-product";
import { isNativeProduct, verifyNativeProduct } from "@/lib/huawei-native/native-product";
import type { ProductMutationBody } from "@/lib/calculator-types";
import { getSessionFromHeaders, jsonError, readJsonBody } from "@/lib/api-route";
import { db } from "@/lib/db";
import { getListAccessForUser } from "@/lib/resource-access";
import {
  insertListProducts,
  mapStoredProductRow,
  touchProject,
  type StoredProductRow,
} from "@/lib/resource-persistence";

export const runtime = "nodejs";

type CreateListProductBody = Partial<ProductMutationBody>;

export async function GET(request: Request, context: { params: Promise<{ listId: string }> }) {
  const session = await getSessionFromHeaders(request.headers);

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const { listId } = await context.params;
  const list = getListAccessForUser(session.user.id, listId);

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

export async function POST(request: Request, context: { params: Promise<{ listId: string }> }) {
  const session = await getSessionFromHeaders(request.headers);

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const { listId } = await context.params;
  let body = await readJsonBody<CreateListProductBody>(request);

  const serviceCode = body?.serviceCode?.trim();
  const serviceName = body?.serviceName?.trim();
  let productType = body?.productType?.trim();
  const title = body?.title?.trim();
  let quantity = Math.max(1, Math.floor(body?.quantity ?? 1));

  if (!serviceCode || !serviceName || !productType || !title) {
    return jsonError("serviceCode, serviceName, productType, and title are required");
  }

  const list = getListAccessForUser(session.user.id, listId);

  if (!list) {
    return jsonError("List not found", 404);
  }
  if (!list.canEditProducts) {
    return jsonError("You do not have permission to edit this cart", 403);
  }

  if (isLegacyHuaweiProduct({ serviceCode, productType })) return jsonError(LEGACY_RECONFIGURE_MESSAGE, 422);

  if (isNativeProduct({ serviceCode, productType })) {
    try {
      body = await verifyNativeProduct(body as ProductMutationBody);
      quantity = body.quantity!;
      productType = body.productType!;
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Huawei verification failed", 422);
    }
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
      userId: session.user.id,
      now,
      products: [
        { serviceCode, serviceName, productType, title, quantity, config: body?.config, pricing: body?.pricing },
      ],
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
