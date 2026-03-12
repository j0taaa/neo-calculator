import { cloneListProducts, type CloneableProduct, type NeoBillingOption, NEO_BILLING_OPTIONS } from "@/lib/cart-clone";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";

export const runtime = "nodejs";

type SourceProjectRow = {
  id: string;
  name: string;
  description: string | null;
};

type SourceListRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type SourceProductRow = {
  id: string;
  list_id: string;
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

type CloneProjectBody = {
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

function buildClonedProjectName(
  sourceName: string,
  request: { name?: string | null; targetRegion?: HuaweiRegionKey | null; targetBillingMode?: NeoBillingOption | null },
) {
  const explicitName = request.name?.trim();
  if (explicitName) {
    return explicitName;
  }

  const base = sourceName.trim() || "NeoCalculator project";
  const suffixParts: string[] = [];
  if (request.targetRegion) {
    suffixParts.push(huaweiRegions[request.targetRegion].short);
  }
  if (request.targetBillingMode) {
    suffixParts.push(request.targetBillingMode);
  }

  return suffixParts.length ? `${base} ${suffixParts.join(" ")}` : `${base} (Copy)`;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const session = await getSession(request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await context.params;
  const body = (await request.json().catch(() => null)) as CloneProjectBody | null;
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

  const sourceProject = db
    .query(
      `
        SELECT id, name, description
        FROM project
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(projectId, session.user.id) as SourceProjectRow | null;

  if (!sourceProject) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const sourceLists = db
    .query(
      `
        SELECT id, name, created_at, updated_at
        FROM project_list
        WHERE project_id = ? AND user_id = ?
        ORDER BY created_at ASC
      `,
    )
    .all(projectId, session.user.id) as SourceListRow[];

  const sourceProducts = db
    .query(
      `
        SELECT id, list_id, service_code, service_name, product_type, title, quantity, config_json, pricing_json, created_at, updated_at
        FROM list_product
        WHERE project_id = ? AND user_id = ?
        ORDER BY created_at ASC
      `,
    )
    .all(projectId, session.user.id) as SourceProductRow[];

  const nextProjectName = buildClonedProjectName(sourceProject.name, {
    name: body?.name ?? null,
    targetRegion,
    targetBillingMode,
  });
  const now = new Date().toISOString();
  const newProjectId = crypto.randomUUID();
  let totalProducts = 0;
  let convertedEcsCount = 0;
  let copiedUnchangedCount = 0;
  let copiedUnsupportedCount = 0;

  const clonedLists = await Promise.all(
    sourceLists.map(async (sourceList) => {
      const listProducts = sourceProducts.filter((product) => product.list_id === sourceList.id);
      const cloneInputProducts: CloneableProduct[] = listProducts.map((product) => ({
        serviceCode: product.service_code,
        serviceName: product.service_name,
        productType: product.product_type,
        title: product.title,
        quantity: Math.max(1, Math.floor(product.quantity)),
        config: JSON.parse(product.config_json) as unknown,
        pricing: product.pricing_json ? (JSON.parse(product.pricing_json) as unknown) : null,
      }));

      const cloned = await cloneListProducts(sourceList.name, cloneInputProducts, {
        name: sourceList.name,
        targetRegion,
        targetBillingMode,
      });
      const newListId = crypto.randomUUID();
      const responseProducts = cloned.products.map((product) => ({
        id: crypto.randomUUID(),
        listId: newListId,
        projectId: newProjectId,
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

      totalProducts += responseProducts.length;
      convertedEcsCount += cloned.cloneSummary.convertedEcsCount;
      copiedUnchangedCount += cloned.cloneSummary.copiedUnchangedCount;
      copiedUnsupportedCount += cloned.cloneSummary.copiedUnsupportedCount;

      return {
        id: newListId,
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
      };
    }),
  );

  db.transaction(() => {
    db.query(
      `
        INSERT INTO project (id, user_id, name, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    ).run(newProjectId, session.user.id, nextProjectName, sourceProject.description, now, now);

    const insertList = db.query(
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
    );

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

    for (const list of clonedLists) {
      insertList.run(list.id, newProjectId, session.user.id, list.name, now, now);

      for (const product of list.products) {
        insertProduct.run(
          product.id,
          list.id,
          newProjectId,
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
    }
  })();

  return Response.json(
    {
      id: newProjectId,
      name: nextProjectName,
      description: sourceProject.description,
      createdAt: now,
      updatedAt: now,
      lists: clonedLists,
      cloneSummary: {
        totalLists: clonedLists.length,
        totalProducts,
        convertedEcsCount,
        copiedUnchangedCount,
        copiedUnsupportedCount,
      },
    },
    { status: 201 },
  );
}
