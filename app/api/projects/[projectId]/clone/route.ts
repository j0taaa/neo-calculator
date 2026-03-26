import { getSessionFromHeaders, jsonError, readJsonBody } from "@/lib/api-route";
import { cloneListProducts, type CloneableProduct, type NeoBillingOption, NEO_BILLING_OPTIONS } from "@/lib/cart-clone";
import { db } from "@/lib/db";
import { huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";
import { getProjectAccessForUser } from "@/lib/resource-access";
import { createListRecord, createProjectRecord, insertListProducts, mapStoredProductsByListId, type StoredProductRow } from "@/lib/resource-persistence";

export const runtime = "nodejs";

type SourceProjectRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
};

type SourceListRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type CloneProjectBody = {
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
  const session = await getSessionFromHeaders(request.headers);

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const { projectId } = await context.params;
  const body = await readJsonBody<CloneProjectBody>(request);
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

  const sourceProject = db
    .query(
      `
        SELECT id, user_id, name, description
        FROM project
        WHERE id = ?
      `,
    )
    .get(projectId) as SourceProjectRow | null;

  const access = getProjectAccessForUser(session.user.id, projectId);
  if (!sourceProject || !access) {
    return jsonError("Project not found", 404);
  }
  if (!access.canClone) {
    return jsonError("You do not have permission to clone this project", 403);
  }

  const sourceLists = db
    .query(
      `
        SELECT id, user_id, name, created_at, updated_at
        FROM project_list
        WHERE project_id = ?
        ORDER BY created_at ASC
      `,
    )
    .all(projectId) as SourceListRow[];

  const sourceProducts = db
    .query(
      `
        SELECT id, list_id, user_id, service_code, service_name, product_type, title, quantity, config_json, pricing_json, created_at, updated_at
        FROM list_product
        WHERE project_id = ?
        ORDER BY created_at ASC
      `,
    )
    .all(projectId) as StoredProductRow[];

  const sourceProductsByListId = mapStoredProductsByListId(sourceProducts);

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
      const listProducts = sourceProductsByListId.get(sourceList.id) ?? [];
      const cloneInputProducts: CloneableProduct[] = listProducts;

      const cloned = await cloneListProducts(sourceList.name, cloneInputProducts, {
        name: sourceList.name,
        targetRegion,
        targetBillingMode,
      });
      const newListId = crypto.randomUUID();
      const responseProducts = cloned.products.map((product) => ({
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
    createProjectRecord({
      id: newProjectId,
      userId: session.user.id,
      name: nextProjectName,
      description: sourceProject.description,
      now,
    });

    for (const list of clonedLists) {
      createListRecord({ id: list.id, projectId: newProjectId, userId: session.user.id, name: list.name, now });

      list.products = insertListProducts({
        listId: list.id,
        projectId: newProjectId,
        userId: session.user.id,
        now,
        products: list.products,
      });
    }
  })();

  return Response.json(
    {
      id: newProjectId,
      name: nextProjectName,
      description: sourceProject.description,
      createdAt: now,
      updatedAt: now,
      lists: clonedLists.map((list) => ({
        ...list,
        products: list.products.map((product) => ({
          ...product,
          listId: list.id,
          projectId: newProjectId,
        })),
      })),
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
