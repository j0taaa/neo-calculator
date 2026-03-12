import { auth } from "@/lib/auth";
import { cloneListProducts, type CloneableProduct, type NeoBillingOption, NEO_BILLING_OPTIONS } from "@/lib/cart-clone";
import { db } from "@/lib/db";
import { huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";

export const runtime = "nodejs";

type SourceListRow = {
  id: string;
  project_id: string;
  name: string;
};

type SourceProductRow = {
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
};

type CloneListBody = {
  name?: string | null;
  targetRegion?: string | null;
  targetBillingMode?: string | null;
};

async function getSession(headers: Headers) {
  return auth.api.getSession({
    headers,
  });
}

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
  const session = await getSession(request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listId } = await context.params;
  const body = (await request.json().catch(() => null)) as CloneListBody | null;
  const requestedTargetRegion = body?.targetRegion?.trim() ? body.targetRegion.trim() : null;
  const requestedTargetBillingMode = body?.targetBillingMode?.trim() ? body.targetBillingMode.trim() : null;

  if (requestedTargetRegion && !isTargetRegion(requestedTargetRegion)) {
    return Response.json({ error: "Invalid target region" }, { status: 400 });
  }

  if (requestedTargetBillingMode && !isNeoBillingOption(requestedTargetBillingMode)) {
    return Response.json({ error: "Invalid target billing mode" }, { status: 400 });
  }

  const targetRegion = requestedTargetRegion && isTargetRegion(requestedTargetRegion) ? requestedTargetRegion : null;
  const targetBillingMode = requestedTargetBillingMode && isNeoBillingOption(requestedTargetBillingMode)
    ? requestedTargetBillingMode
    : null;

  const sourceList = db
    .query(
      `
        SELECT id, project_id, name
        FROM project_list
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(listId, session.user.id) as SourceListRow | null;

  if (!sourceList) {
    return Response.json({ error: "List not found" }, { status: 404 });
  }

  const sourceProducts = db
    .query(
      `
        SELECT id, service_code, service_name, product_type, title, quantity, config_json, pricing_json, created_at, updated_at
        FROM list_product
        WHERE list_id = ? AND user_id = ?
        ORDER BY created_at ASC
      `,
    )
    .all(listId, session.user.id) as SourceProductRow[];

  const cloneInputProducts: CloneableProduct[] = sourceProducts.map((product) => ({
    serviceCode: product.service_code,
    serviceName: product.service_name,
    productType: product.product_type,
    title: product.title,
    quantity: Math.max(1, Math.floor(product.quantity)),
    config: JSON.parse(product.config_json) as unknown,
    pricing: product.pricing_json ? (JSON.parse(product.pricing_json) as unknown) : null,
  }));

  const cloned = await cloneListProducts(sourceList.name, cloneInputProducts, {
    name: body?.name ?? null,
    targetRegion,
    targetBillingMode,
  });

  const now = new Date().toISOString();
  const newListId = crypto.randomUUID();
  const responseProducts = cloned.products.map((product) => ({
    id: crypto.randomUUID(),
    listId: newListId,
    projectId: sourceList.project_id,
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
    db.query(
      `
        INSERT INTO project_list (
          id,
          project_id,
          user_id,
          name,
          huawei_cart_key,
          huawei_cart_name,
          huawei_last_synced_at,
          huawei_last_error,
          huawei_last_remote_updated_at,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, ?)
      `,
    ).run(newListId, sourceList.project_id, session.user.id, cloned.name, now, now);

    const insertProduct = db.query(
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
    );

    for (const product of responseProducts) {
      insertProduct.run(
        product.id,
        product.listId,
        product.projectId,
        session.user.id,
        product.serviceCode,
        product.serviceName,
        product.productType,
        product.title,
        product.quantity,
        JSON.stringify(product.config),
        product.pricing === undefined ? null : JSON.stringify(product.pricing),
        now,
        now,
      );
    }

    db.query("UPDATE project SET updated_at = ? WHERE id = ?").run(now, sourceList.project_id);
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
      products: responseProducts,
      cloneSummary: cloned.cloneSummary,
    },
    { status: 201 },
  );
}
