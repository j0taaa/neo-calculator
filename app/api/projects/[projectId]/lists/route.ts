import { getSessionFromHeaders, jsonError, readJsonBody } from "@/lib/api-route";
import { db } from "@/lib/db";
import { buildLocalProductsFromHuaweiCart, HuaweiSessionError } from "@/lib/huawei-calculator";
import { getProjectAccessForUser } from "@/lib/resource-access";
import { createListRecord, insertListProducts, touchProject } from "@/lib/resource-persistence";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const session = await getSessionFromHeaders(request.headers);

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const { projectId } = await context.params;
  const body = await readJsonBody<{ name?: string; huaweiCartKey?: string; cookie?: string }>(request);
  const remoteCartKey = body?.huaweiCartKey?.trim() ?? "";
  let name = body?.name?.trim() ?? "";
  let remoteCartName: string | null = null;
  let importedProducts: Array<{
    id?: string;
    serviceCode: string;
    serviceName: string;
    productType: string;
    title: string;
    quantity: number;
    config: unknown;
    pricing: unknown;
  }> = [];

  if (remoteCartKey) {
    try {
      const remoteCart = await buildLocalProductsFromHuaweiCart(remoteCartKey, body?.cookie ?? "");
      remoteCartName = remoteCart.detail.name?.trim() || remoteCartKey;
      importedProducts = remoteCart.products;
      if (!name) {
        name = remoteCartName;
      }
    } catch (error) {
      if (error instanceof HuaweiSessionError) {
        return jsonError(error.message, 401);
      }

      return jsonError(error instanceof Error ? error.message : "Unable to import Huawei cart");
    }
  }

  if (!name) {
    return jsonError("List name is required");
  }

  const existingProject = getProjectAccessForUser(session.user.id, projectId);
  if (!existingProject) {
    return jsonError("Project not found", 404);
  }
  if (!existingProject.canCreateLists) {
    return jsonError("You do not have permission to create carts in this project", 403);
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  let persistedProducts = importedProducts.map((product, index) => ({
    id: product.id ?? `imported-${index}`,
    serviceCode: product.serviceCode,
    serviceName: product.serviceName,
    productType: product.productType,
    title: product.title,
    quantity: product.quantity,
    config: product.config,
    pricing: product.pricing ?? null,
    createdAt: now,
    updatedAt: now,
  }));

  db.transaction(() => {
    createListRecord({
      id,
      projectId,
      userId: session.user.id,
      name,
      now,
      huaweiCartKey: remoteCartKey || null,
      huaweiCartName: remoteCartName,
      huaweiLastSyncedAt: remoteCartKey ? now : null,
    });

    persistedProducts = insertListProducts({
      listId: id,
      projectId,
      userId: session.user.id,
      now,
      products: importedProducts,
    });

    touchProject(projectId, now);
  })();

  return Response.json(
    {
      id,
      projectId,
      name,
      ownerUserId: session.user.id,
      accessLevel: "owner",
      canShare: true,
      huaweiCartKey: remoteCartKey || null,
      huaweiCartName: remoteCartName,
      huaweiLastSyncedAt: remoteCartKey ? now : null,
      huaweiLastError: null,
      huaweiLastRemoteUpdatedAt: null,
      createdAt: now,
      updatedAt: now,
      productCount: persistedProducts.length,
      products: persistedProducts.map((product) => ({
        id: product.id,
        serviceCode: product.serviceCode,
        serviceName: product.serviceName,
        productType: product.productType,
        title: product.title,
        quantity: product.quantity,
        config: product.config,
        pricing: product.pricing,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      })),
    },
    { status: 201 },
  );
}
