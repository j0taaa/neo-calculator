import { db } from "@/lib/db";

export type StoredProductRow = {
  id: string;
  list_id: string;
  project_id: string;
  user_id: string;
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

export type PersistedProductInput = {
  id?: string;
  serviceCode: string;
  serviceName: string;
  productType: string;
  title: string;
  quantity: number;
  config: unknown;
  pricing: unknown;
};

export type PersistedProductPayload = {
  id: string;
  serviceCode: string;
  serviceName: string;
  productType: string;
  title: string;
  quantity: number;
  config: unknown;
  pricing: unknown;
  createdAt: string;
  updatedAt: string;
};

type CreateProjectInput = {
  id?: string;
  userId: string;
  name: string;
  description: string | null;
  now: string;
};

type CreateListInput = {
  id?: string;
  projectId: string;
  userId: string;
  name: string;
  now: string;
  huaweiCartKey?: string | null;
  huaweiCartName?: string | null;
  huaweiLastSyncedAt?: string | null;
  huaweiLastError?: string | null;
  huaweiLastRemoteUpdatedAt?: number | null;
};

function normalizeQuantity(quantity: number) {
  return Math.max(1, Math.floor(quantity));
}

export function parseStoredJson<T>(value: string | null | undefined, fallback: T): T {
  if (typeof value !== "string") {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function mapStoredProductRow(row: StoredProductRow): PersistedProductPayload {
  return {
    id: row.id,
    serviceCode: row.service_code,
    serviceName: row.service_name,
    productType: row.product_type,
    title: row.title,
    quantity: row.quantity,
    config: parseStoredJson(row.config_json, {}),
    pricing: row.pricing_json ? parseStoredJson(row.pricing_json, null) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapStoredProductsByListId(rows: StoredProductRow[]) {
  const grouped = new Map<string, PersistedProductPayload[]>();

  for (const row of rows) {
    const current = grouped.get(row.list_id) ?? [];
    current.push(mapStoredProductRow(row));
    grouped.set(row.list_id, current);
  }

  return grouped;
}

export function createProjectRecord(input: CreateProjectInput) {
  const id = input.id ?? crypto.randomUUID();
  db.query(
    `
      INSERT INTO project (id, user_id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
  ).run(id, input.userId, input.name, input.description, input.now, input.now);

  return id;
}

export function createListRecord(input: CreateListInput) {
  const id = input.id ?? crypto.randomUUID();
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    id,
    input.projectId,
    input.userId,
    input.name,
    input.huaweiCartKey ?? null,
    input.huaweiCartName ?? null,
    input.huaweiLastSyncedAt ?? null,
    input.huaweiLastError ?? null,
    input.huaweiLastRemoteUpdatedAt ?? null,
    input.now,
    input.now,
  );

  return id;
}

export function insertListProducts(input: {
  listId: string;
  projectId: string;
  userId: string;
  now: string;
  products: PersistedProductInput[];
}) {
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

  return input.products.map((product) => {
    const id = product.id ?? crypto.randomUUID();
    const quantity = normalizeQuantity(product.quantity);
    const config = product.config ?? {};
    const pricing = product.pricing ?? null;

    insertProduct.run(
      id,
      input.listId,
      input.projectId,
      input.userId,
      product.serviceCode,
      product.serviceName,
      product.productType,
      product.title,
      quantity,
      JSON.stringify(config),
      product.pricing == null ? null : JSON.stringify(product.pricing),
      input.now,
      input.now,
    );

    return {
      id,
      serviceCode: product.serviceCode,
      serviceName: product.serviceName,
      productType: product.productType,
      title: product.title,
      quantity,
      config,
      pricing,
      createdAt: input.now,
      updatedAt: input.now,
    } satisfies PersistedProductPayload;
  });
}

export function touchProject(projectId: string, now: string) {
  db.query("UPDATE project SET updated_at = ? WHERE id = ?").run(now, projectId);
}
