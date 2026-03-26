import { db } from "@/lib/db";
import { createListRecord, createProjectRecord, insertListProducts, mapStoredProductRow, type StoredProductRow } from "@/lib/resource-persistence";

export type ShareResourceType = "project" | "list";
export type ShareMode = "copy" | "collaborate";

type ShareLinkRow = {
  id: string;
  owner_user_id: string;
  resource_type: ShareResourceType;
  resource_id: string;
  mode: ShareMode;
  created_at: string;
  updated_at: string;
};

type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type ListRow = {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  huawei_cart_key: string | null;
  huawei_cart_name: string | null;
  created_at: string;
  updated_at: string;
};

type ProductRow = {
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

export type SharedProductSnapshot = {
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

export type SharedListSnapshot = {
  id: string;
  projectId: string;
  name: string;
  huaweiCartKey: string | null;
  huaweiCartName: string | null;
  createdAt: string;
  updatedAt: string;
  products: SharedProductSnapshot[];
};

export type SharedProjectSnapshot = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  lists: SharedListSnapshot[];
};

export type SharedResourceSnapshot =
  | {
      shareId: string;
      ownerUserId: string;
      resourceType: "project";
      mode: ShareMode;
      createdAt: string;
      updatedAt: string;
      project: SharedProjectSnapshot;
    }
  | {
      shareId: string;
      ownerUserId: string;
      resourceType: "list";
      mode: ShareMode;
      createdAt: string;
      updatedAt: string;
      list: SharedListSnapshot & { projectName: string };
    };

function mapProduct(product: ProductRow): SharedProductSnapshot {
  return mapStoredProductRow(product as StoredProductRow);
}

function getOwnedProject(ownerUserId: string, projectId: string) {
  return db
    .query<ProjectRow, [string, string]>(
      `
        SELECT id, user_id, name, description, created_at, updated_at
        FROM project
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(projectId, ownerUserId);
}

function getOwnedList(ownerUserId: string, listId: string) {
  return db
    .query<ListRow, [string, string]>(
      `
        SELECT id, project_id, user_id, name, huawei_cart_key, huawei_cart_name, created_at, updated_at
        FROM project_list
        WHERE id = ? AND user_id = ?
      `,
    )
    .get(listId, ownerUserId);
}

function getProjectLists(projectId: string) {
  return db
    .query<ListRow, [string]>(
      `
        SELECT id, project_id, user_id, name, huawei_cart_key, huawei_cart_name, created_at, updated_at
        FROM project_list
        WHERE project_id = ?
        ORDER BY created_at ASC
      `,
    )
    .all(projectId);
}

function getListProducts(listIds: string[]) {
  if (listIds.length === 0) {
    return [] as ProductRow[];
  }

  return db
    .query<ProductRow, string[]>(
      `
        SELECT
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
        FROM list_product
        WHERE list_id IN (${listIds.map(() => "?").join(", ")})
        ORDER BY created_at ASC
      `,
    )
    .all(...listIds);
}

function getShareLink(shareId: string) {
  return db
    .query<ShareLinkRow, [string]>(
      `
        SELECT id, owner_user_id, resource_type, resource_id, mode, created_at, updated_at
        FROM share_link
        WHERE id = ?
      `,
    )
    .get(shareId);
}

export function createShareLink(input: {
  ownerUserId: string;
  resourceType: ShareResourceType;
  resourceId: string;
  mode: ShareMode;
}) {
  if (input.resourceType === "project" && !getOwnedProject(input.ownerUserId, input.resourceId)) {
    throw new Error("Project not found");
  }

  if (input.resourceType === "list" && !getOwnedList(input.ownerUserId, input.resourceId)) {
    throw new Error("Cart not found");
  }

  const existing = db
    .query<ShareLinkRow, [string, ShareResourceType, string, ShareMode]>(
      `
        SELECT id, owner_user_id, resource_type, resource_id, mode, created_at, updated_at
        FROM share_link
        WHERE owner_user_id = ? AND resource_type = ? AND resource_id = ? AND mode = ?
      `,
    )
    .get(input.ownerUserId, input.resourceType, input.resourceId, input.mode);

  if (existing) {
    return {
      id: existing.id,
      mode: existing.mode,
      resourceType: existing.resource_type,
      createdAt: existing.created_at,
      updatedAt: existing.updated_at,
    };
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.query(
    `
      INSERT INTO share_link (id, owner_user_id, resource_type, resource_id, mode, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(id, input.ownerUserId, input.resourceType, input.resourceId, input.mode, now, now);

  return {
    id,
    mode: input.mode,
    resourceType: input.resourceType,
    createdAt: now,
    updatedAt: now,
  };
}

export function getSharedResourceSnapshot(shareId: string): SharedResourceSnapshot | null {
  const share = getShareLink(shareId);
  if (!share) {
    return null;
  }

  if (share.resource_type === "project") {
    const project = getOwnedProject(share.owner_user_id, share.resource_id);
    if (!project) {
      return null;
    }

    const lists = getProjectLists(project.id);
    const products = getListProducts(lists.map((list) => list.id));

    return {
      shareId: share.id,
      ownerUserId: share.owner_user_id,
      resourceType: "project",
      mode: share.mode,
      createdAt: share.created_at,
      updatedAt: share.updated_at,
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        lists: lists.map((list) => ({
          id: list.id,
          projectId: list.project_id,
          name: list.name,
          huaweiCartKey: list.huawei_cart_key,
          huaweiCartName: list.huawei_cart_name,
          createdAt: list.created_at,
          updatedAt: list.updated_at,
          products: products.filter((product) => product.list_id === list.id).map(mapProduct),
        })),
      },
    };
  }

  const list = getOwnedList(share.owner_user_id, share.resource_id);
  if (!list) {
    return null;
  }

  const project = db
    .query<ProjectRow, [string]>(
      `
        SELECT id, user_id, name, description, created_at, updated_at
        FROM project
        WHERE id = ?
      `,
    )
    .get(list.project_id);
  const products = getListProducts([list.id]);

  return {
    shareId: share.id,
    ownerUserId: share.owner_user_id,
    resourceType: "list",
    mode: share.mode,
    createdAt: share.created_at,
    updatedAt: share.updated_at,
    list: {
      id: list.id,
      projectId: list.project_id,
      projectName: project?.name ?? "Shared Project",
      name: list.name,
      huaweiCartKey: list.huawei_cart_key,
      huaweiCartName: list.huawei_cart_name,
      createdAt: list.created_at,
      updatedAt: list.updated_at,
      products: products.map(mapProduct),
    },
  };
}

export function importSharedCopyToUser(shareId: string, userId: string) {
  const snapshot = getSharedResourceSnapshot(shareId);
  if (!snapshot) {
    throw new Error("Share not found");
  }

  if (snapshot.mode !== "copy") {
    throw new Error("This share link is collaborative and cannot be imported as a detached copy.");
  }

  const now = new Date().toISOString();

  if (snapshot.resourceType === "project") {
    const newProjectId = crypto.randomUUID();
    const newProjectName = `${snapshot.project.name} (Copy)`;

    db.transaction(() => {
      createProjectRecord({ id: newProjectId, userId, name: newProjectName, description: snapshot.project.description, now });

      for (const list of snapshot.project.lists) {
        const newListId = createListRecord({ projectId: newProjectId, userId, name: list.name, now });
        insertListProducts({ listId: newListId, projectId: newProjectId, userId, now, products: list.products });
      }
    })();

    return {
      resourceType: "project" as const,
      projectId: newProjectId,
      name: newProjectName,
    };
  }

  const newProjectId = crypto.randomUUID();
  const newListId = crypto.randomUUID();
  const projectName = `${snapshot.list.projectName} (Shared Copy)`;

  db.transaction(() => {
    createProjectRecord({ id: newProjectId, userId, name: projectName, description: null, now });
    createListRecord({ id: newListId, projectId: newProjectId, userId, name: `${snapshot.list.name} (Copy)`, now });
    insertListProducts({ listId: newListId, projectId: newProjectId, userId, now, products: snapshot.list.products });
  })();

  return {
    resourceType: "list" as const,
    projectId: newProjectId,
    listId: newListId,
    name: snapshot.list.name,
  };
}

export function joinCollaborativeShare(shareId: string, userId: string) {
  const share = getShareLink(shareId);
  if (!share) {
    throw new Error("Share not found");
  }

  if (share.mode !== "collaborate") {
    throw new Error("This share link creates detached copies instead of collaborative access.");
  }

  if (share.owner_user_id === userId) {
    return {
      resourceType: share.resource_type,
      resourceId: share.resource_id,
      alreadyHadAccess: true,
    };
  }

  const now = new Date().toISOString();

  if (share.resource_type === "project") {
    db.query(
      `
        INSERT OR IGNORE INTO project_collaborator (project_id, user_id, granted_by_user_id, created_at)
        VALUES (?, ?, ?, ?)
      `,
    ).run(share.resource_id, userId, share.owner_user_id, now);
  } else {
    db.query(
      `
        INSERT OR IGNORE INTO project_list_collaborator (list_id, user_id, granted_by_user_id, created_at)
        VALUES (?, ?, ?, ?)
      `,
    ).run(share.resource_id, userId, share.owner_user_id, now);
  }

  return {
    resourceType: share.resource_type,
    resourceId: share.resource_id,
    alreadyHadAccess: false,
  };
}
