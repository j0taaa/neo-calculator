import { getApiKeyUser, jsonError, readJsonBody } from "@/lib/api-route";
import { db } from "@/lib/db";
import { getListAccessForUser } from "@/lib/resource-access";
import { touchProject } from "@/lib/resource-persistence";
import { computeServerPricing } from "@/lib/server-pricing";

export const runtime = "nodejs";

type UpdateListProductBody = {
  serviceCode?: string;
  serviceName?: string;
  productType?: string;
  title?: string;
  quantity?: number;
  config?: Record<string, unknown>;
  pricing?: unknown;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ listId: string; productId: string }> },
) {
  const apiKeyUser = await getApiKeyUser(request.headers);

  if (!apiKeyUser) {
    return jsonError("Invalid or missing API key. Provide your key via the X-API-Key header.", 401);
  }

  const { listId, productId } = await context.params;
  const body = await readJsonBody<UpdateListProductBody>(request);
  const listAccess = getListAccessForUser(apiKeyUser.userId, listId);

  const serviceCode = body?.serviceCode?.trim();
  const serviceName = body?.serviceName?.trim();
  const productType = body?.productType?.trim();
  const title = body?.title?.trim();
  const quantity = Math.max(1, Math.floor(body?.quantity ?? 1));

  if (!serviceCode || !serviceName) {
    return jsonError("serviceCode and serviceName are required");
  }
  if (!listAccess) {
    return jsonError("List not found", 404);
  }
  if (!listAccess.canEditProducts) {
    return jsonError("You do not have permission to edit this list", 403);
  }

  const product = db
    .query(
      `
        SELECT list_id, project_id
        FROM list_product
        WHERE id = ? AND list_id = ?
      `,
    )
    .get(productId, listId) as { list_id: string; project_id: string } | null;

  if (!product) {
    return jsonError("Product not found", 404);
  }

  const config: Record<string, unknown> = body?.config ?? {};
  const pricingResult = await computeServerPricing(serviceCode, config);

  if (pricingResult.error) {
    return jsonError(pricingResult.error, 422);
  }

  const resolvedTitle = title || pricingResult.title || serviceName;
  const resolvedProductType = productType || pricingResult.productType || serviceCode.toLowerCase();
  const resolvedConfig = pricingResult.config;
  const resolvedPricing = pricingResult.pricing;

  const now = new Date().toISOString();

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
        WHERE id = ? AND list_id = ?
      `,
    ).run(
      serviceCode,
      serviceName,
      resolvedProductType,
      resolvedTitle,
      quantity,
      JSON.stringify(resolvedConfig),
      JSON.stringify(resolvedPricing),
      now,
      productId,
      listId,
    );

    db.query("UPDATE project_list SET updated_at = ? WHERE id = ?").run(now, listId);
    touchProject(product.project_id, now);
  })();

  return Response.json({
    id: productId,
    listId,
    projectId: product.project_id,
    serviceCode,
    serviceName,
    productType: resolvedProductType,
    title: resolvedTitle,
    quantity,
    config: resolvedConfig,
    pricing: resolvedPricing,
    updatedAt: now,
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ listId: string; productId: string }> },
) {
  const apiKeyUser = await getApiKeyUser(request.headers);

  if (!apiKeyUser) {
    return jsonError("Invalid or missing API key. Provide your key via the X-API-Key header.", 401);
  }

  const { listId, productId } = await context.params;
  const listAccess = getListAccessForUser(apiKeyUser.userId, listId);

  if (!listAccess) {
    return jsonError("List not found", 404);
  }
  if (!listAccess.canEditProducts) {
    return jsonError("You do not have permission to edit this list", 403);
  }

  const product = db
    .query(
      `
        SELECT id, project_id
        FROM list_product
        WHERE id = ? AND list_id = ?
      `,
    )
    .get(productId, listId) as { id: string; project_id: string } | null;

  if (!product) {
    return jsonError("Product not found", 404);
  }

  const now = new Date().toISOString();

  db.transaction(() => {
    db.query("DELETE FROM list_product WHERE id = ? AND list_id = ?").run(productId, listId);
    db.query("UPDATE project_list SET updated_at = ? WHERE id = ?").run(now, listId);
    touchProject(product.project_id, now);
  })();

  return Response.json({
    id: productId,
    listId,
    projectId: product.project_id,
    deleted: true,
    updatedAt: now,
  });
}
