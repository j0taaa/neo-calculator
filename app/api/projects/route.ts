import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type ListRow = {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type ProductRow = {
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

async function getSession(headers: Headers) {
  return auth.api.getSession({
    headers,
  });
}

export async function GET(request: Request) {
  const session = await getSession(request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = db
    .query(
      `
        SELECT id, name, description, created_at, updated_at
        FROM project
        WHERE user_id = ?
        ORDER BY updated_at DESC
      `,
    )
    .all(session.user.id) as ProjectRow[];

  const lists = db
    .query(
      `
        SELECT id, project_id, name, created_at, updated_at
        FROM project_list
        WHERE user_id = ?
        ORDER BY updated_at DESC
      `,
    )
    .all(session.user.id) as ListRow[];

  const products = db
    .query(
      `
        SELECT id, list_id, service_code, service_name, product_type, title, quantity, config_json, pricing_json, created_at, updated_at
        FROM list_product
        WHERE user_id = ?
        ORDER BY updated_at DESC
      `,
    )
    .all(session.user.id) as ProductRow[];

  const payload = projects.map((project) => ({
    id: project.id,
    name: project.name,
    description: project.description,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    lists: lists
      .filter((list) => list.project_id === project.id)
      .map((list) => ({
        id: list.id,
        name: list.name,
        createdAt: list.created_at,
        updatedAt: list.updated_at,
        productCount: products.filter((product) => product.list_id === list.id).length,
        products: products
          .filter((product) => product.list_id === list.id)
          .map((product) => ({
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
      })),
  }));

  return Response.json(payload);
}

export async function POST(request: Request) {
  const session = await getSession(request.headers);

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { name?: string; description?: string };
  const name = body.name?.trim();

  if (!name) {
    return Response.json({ error: "Project name is required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  db.query(
    `
      INSERT INTO project (id, user_id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
  ).run(id, session.user.id, name, body.description?.trim() || null, now, now);

  return Response.json({ id, name, description: body.description?.trim() || null, createdAt: now, updatedAt: now }, { status: 201 });
}
