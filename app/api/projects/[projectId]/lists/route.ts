import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildLocalProductsFromHuaweiCart, HuaweiSessionError } from "@/lib/huawei-calculator";

export const runtime = "nodejs";

async function getSession(headers: Headers) {
  return auth.api.getSession({
    headers,
  });
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
  const body = (await request.json()) as { name?: string; huaweiCartKey?: string; cookie?: string };
  const remoteCartKey = body.huaweiCartKey?.trim() ?? "";
  let name = body.name?.trim() ?? "";
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
      const remoteCart = await buildLocalProductsFromHuaweiCart(remoteCartKey, body.cookie ?? "");
      remoteCartName = remoteCart.detail.name?.trim() || remoteCartKey;
      importedProducts = remoteCart.products;
      if (!name) {
        name = remoteCartName;
      }
    } catch (error) {
      if (error instanceof HuaweiSessionError) {
        return Response.json({ error: error.message }, { status: 401 });
      }

      return Response.json(
        { error: error instanceof Error ? error.message : "Unable to import Huawei cart" },
        { status: 400 },
      );
    }
  }

  if (!name) {
    return Response.json({ error: "List name is required" }, { status: 400 });
  }

  const existingProject = db
    .query("SELECT id FROM project WHERE id = ? AND user_id = ?")
    .get(projectId, session.user.id) as { id: string } | null;

  if (!existingProject) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

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
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      id,
      projectId,
      session.user.id,
      name,
      remoteCartKey || null,
      remoteCartName,
      remoteCartKey ? now : null,
      null,
      now,
      now,
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

    for (const product of importedProducts) {
      const productId = crypto.randomUUID();
      product.id = productId;
      insertProduct.run(
        productId,
        id,
        projectId,
        session.user.id,
        product.serviceCode,
        product.serviceName,
        product.productType,
        product.title,
        Math.max(1, Math.floor(product.quantity)),
        JSON.stringify(product.config ?? {}),
        product.pricing === undefined ? null : JSON.stringify(product.pricing),
        now,
        now,
      );
    }

    db.query("UPDATE project SET updated_at = ? WHERE id = ?").run(now, projectId);
  })();

  return Response.json(
    {
      id,
      projectId,
      name,
      huaweiCartKey: remoteCartKey || null,
      huaweiCartName: remoteCartName,
      huaweiLastSyncedAt: remoteCartKey ? now : null,
      huaweiLastError: null,
      huaweiLastRemoteUpdatedAt: null,
      createdAt: now,
      updatedAt: now,
      productCount: importedProducts.length,
      products: importedProducts.map((product, index) => ({
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
      })),
    },
    { status: 201 },
  );
}
