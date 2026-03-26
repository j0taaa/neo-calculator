import { getSessionFromHeaders, jsonError, readJsonBody } from "@/lib/api-route";
import { cloneListProducts, type CloneableProduct, type NeoBillingOption, NEO_BILLING_OPTIONS } from "@/lib/cart-clone";
import { db } from "@/lib/db";
import { huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";
import { getListAccessForUser } from "@/lib/resource-access";
import { createListRecord, insertListProducts, mapStoredProductRow, touchProject, type StoredProductRow } from "@/lib/resource-persistence";

export const runtime = "nodejs";

type SourceListRow = {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
};

type CloneListBody = {
  name?: string | null;
  targetRegion?: string | null;
  targetBillingMode?: string | null;
};

function isTargetRegion(value: unknown): value is HuaweiRegionKey {
  return typeof value === "string" && value in huaweiRegions;
}

function isNeoBillingOption(value: unknown): value is NeoBillingOption {
  return typeof value === "string" && NEO_BILLING_OPTIONS.includes(value as NeoBillingOption);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ listId: string }> },
) {
  const session = await getSessionFromHeaders(request.headers);

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const { listId } = await context.params;
  const body = await readJsonBody<CloneListBody>(request);
  const requestedTargetRegion = body?.targetRegion?.trim() ? body.targetRegion.trim() : null;
  const requestedTargetBillingMode = body?.targetBillingMode?.trim() ? body.targetBillingMode.trim() : null;

  if (requestedTargetRegion && !isTargetRegion(requestedTargetRegion)) {
    return jsonError("Invalid target region");
  }

  if (requestedTargetBillingMode && !isNeoBillingOption(requestedTargetBillingMode)) {
    return jsonError("Invalid target billing mode");
  }

  const targetRegion = requestedTargetRegion && isTargetRegion(requestedTargetRegion) ? requestedTargetRegion : null;
  const targetBillingMode = requestedTargetBillingMode && isNeoBillingOption(requestedTargetBillingMode)
    ? requestedTargetBillingMode
    : null;

  const access = getListAccessForUser(session.user.id, listId);
  const sourceList = db
    .query(
      `
        SELECT id, project_id, user_id, name
        FROM project_list
        WHERE id = ?
      `,
    )
    .get(listId) as SourceListRow | null;

  if (!sourceList || !access) {
    return jsonError("List not found", 404);
  }
  if (!access.canClone) {
    return jsonError("You do not have permission to clone this cart", 403);
  }

  const sourceProducts = db
    .query(
      `
        SELECT id, user_id, service_code, service_name, product_type, title, quantity, config_json, pricing_json, created_at, updated_at
        FROM list_product
        WHERE list_id = ?
        ORDER BY created_at ASC
      `,
    )
    .all(listId) as StoredProductRow[];

  const cloneInputProducts: CloneableProduct[] = sourceProducts.map(mapStoredProductRow);

  const cloned = await cloneListProducts(sourceList.name, cloneInputProducts, {
    name: body?.name ?? null,
    targetRegion,
    targetBillingMode,
  });

  const now = new Date().toISOString();
  const newListId = crypto.randomUUID();
  let responseProducts = cloned.products.map((product) => ({
    id: crypto.randomUUID(),
    serviceCode: product.serviceCode,
    serviceName: product.serviceName,
    productType: product.productType,
    title: product.title,
    quantity: Math.max(1, Math.floor(product.quantity)),
    config: product.config ?? {},
    pricing: product.pricing ?? null,
    createdAt: now,
    updatedAt: now,
  }));

  db.transaction(() => {
    createListRecord({
      id: newListId,
      projectId: sourceList.project_id,
      userId: session.user.id,
      name: cloned.name,
      now,
    });

    responseProducts = insertListProducts({
      listId: newListId,
      projectId: sourceList.project_id,
      userId: session.user.id,
      now,
      products: cloned.products,
    });

    touchProject(sourceList.project_id, now);
  })();

  return Response.json(
    {
      id: newListId,
      projectId: sourceList.project_id,
      name: cloned.name,
      huaweiCartKey: null,
      huaweiCartName: null,
      huaweiLastSyncedAt: null,
      huaweiLastError: null,
      huaweiLastRemoteUpdatedAt: null,
      createdAt: now,
      updatedAt: now,
      productCount: responseProducts.length,
      products: responseProducts.map((product) => ({
        ...product,
        listId: newListId,
        projectId: sourceList.project_id,
      })),
      cloneSummary: cloned.cloneSummary,
    },
    { status: 201 },
  );
}
