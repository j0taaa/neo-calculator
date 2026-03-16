import { db } from "@/lib/db";

export type ProjectAccessLevel = "owner" | "project_collaborator" | "list_collaborator";
export type ListAccessLevel = "owner" | "project_collaborator" | "list_collaborator";

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
  huawei_last_synced_at: string | null;
  huawei_last_error: string | null;
  huawei_last_remote_updated_at: number | null;
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

export type ProjectAccess = {
  id: string;
  ownerUserId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  accessLevel: ProjectAccessLevel;
  canRename: boolean;
  canDelete: boolean;
  canCreateLists: boolean;
  canClone: boolean;
  canShare: boolean;
  canSyncHuawei: boolean;
};

export type ListAccess = {
  id: string;
  projectId: string;
  ownerUserId: string;
  name: string;
  huaweiCartKey: string | null;
  huaweiCartName: string | null;
  huaweiLastSyncedAt: string | null;
  huaweiLastError: string | null;
  huaweiLastRemoteUpdatedAt: number | null;
  createdAt: string;
  updatedAt: string;
  accessLevel: ListAccessLevel;
  canRename: boolean;
  canDelete: boolean;
  canMove: boolean;
  canEditProducts: boolean;
  canClone: boolean;
  canShare: boolean;
  canSyncHuawei: boolean;
};

export type AccessibleProductPayload = {
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

export type AccessibleListPayload = ListAccess & {
  productCount: number;
  products: AccessibleProductPayload[];
};

export type AccessibleProjectPayload = ProjectAccess & {
  lists: AccessibleListPayload[];
};

function mapProjectAccess(project: ProjectRow, userId: string, accessLevel: ProjectAccessLevel): ProjectAccess {
  const isOwner = project.user_id === userId;
  const canManageProject = isOwner;
  const hasFullProjectAccess = accessLevel !== "list_collaborator";

  return {
    id: project.id,
    ownerUserId: project.user_id,
    name: project.name,
    description: project.description,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    accessLevel,
    canRename: canManageProject,
    canDelete: canManageProject,
    canCreateLists: hasFullProjectAccess,
    canClone: hasFullProjectAccess,
    canShare: canManageProject,
    canSyncHuawei: hasFullProjectAccess,
  };
}

function mapListAccess(list: ListRow, userId: string, accessLevel: ListAccessLevel): ListAccess {
  const isOwner = list.user_id === userId;

  return {
    id: list.id,
    projectId: list.project_id,
    ownerUserId: list.user_id,
    name: list.name,
    huaweiCartKey: list.huawei_cart_key,
    huaweiCartName: list.huawei_cart_name,
    huaweiLastSyncedAt: list.huawei_last_synced_at,
    huaweiLastError: list.huawei_last_error,
    huaweiLastRemoteUpdatedAt: list.huawei_last_remote_updated_at,
    createdAt: list.created_at,
    updatedAt: list.updated_at,
    accessLevel,
    canRename: true,
    canDelete: isOwner,
    canMove: isOwner,
    canEditProducts: true,
    canClone: true,
    canShare: isOwner,
    canSyncHuawei: true,
  };
}

export function getProjectAccessForUser(userId: string, projectId: string): ProjectAccess | null {
  const row = db
    .query<ProjectRow & { is_project_collaborator: number }, string[]>(
      `
        SELECT
          p.id,
          p.user_id,
          p.name,
          p.description,
          p.created_at,
          p.updated_at,
          EXISTS(
            SELECT 1
            FROM project_collaborator pc
            WHERE pc.project_id = p.id AND pc.user_id = ?
          ) AS is_project_collaborator
        FROM project p
        WHERE p.id = ?
          AND (
            p.user_id = ?
            OR EXISTS(
              SELECT 1
              FROM project_collaborator pc
              WHERE pc.project_id = p.id AND pc.user_id = ?
            )
          )
      `,
    )
    .get(userId, projectId, userId, userId);

  if (!row) {
    return null;
  }

  return mapProjectAccess(row, userId, row.user_id === userId ? "owner" : "project_collaborator");
}

export function getListAccessForUser(userId: string, listId: string): ListAccess | null {
  const row = db
    .query<ListRow & { is_project_collaborator: number; is_list_collaborator: number }, string[]>(
      `
        SELECT
          pl.id,
          pl.project_id,
          pl.user_id,
          pl.name,
          pl.huawei_cart_key,
          pl.huawei_cart_name,
          pl.huawei_last_synced_at,
          pl.huawei_last_error,
          pl.huawei_last_remote_updated_at,
          pl.created_at,
          pl.updated_at,
          EXISTS(
            SELECT 1
            FROM project_collaborator pc
            WHERE pc.project_id = pl.project_id AND pc.user_id = ?
          ) AS is_project_collaborator,
          EXISTS(
            SELECT 1
            FROM project_list_collaborator plc
            WHERE plc.list_id = pl.id AND plc.user_id = ?
          ) AS is_list_collaborator
        FROM project_list pl
        WHERE pl.id = ?
          AND (
            pl.user_id = ?
            OR EXISTS(
              SELECT 1
              FROM project_collaborator pc
              WHERE pc.project_id = pl.project_id AND pc.user_id = ?
            )
            OR EXISTS(
              SELECT 1
              FROM project_list_collaborator plc
              WHERE plc.list_id = pl.id AND plc.user_id = ?
            )
          )
      `,
    )
    .get(userId, userId, listId, userId, userId, userId);

  if (!row) {
    return null;
  }

  const accessLevel: ListAccessLevel = row.user_id === userId
    ? "owner"
    : row.is_project_collaborator
    ? "project_collaborator"
    : "list_collaborator";

  return mapListAccess(row, userId, accessLevel);
}

export function buildAccessibleProjectsPayload(userId: string): AccessibleProjectPayload[] {
  const fullProjects = db
    .query<ProjectRow, [string, string]>(
      `
        SELECT DISTINCT
          p.id,
          p.user_id,
          p.name,
          p.description,
          p.created_at,
          p.updated_at
        FROM project p
        LEFT JOIN project_collaborator pc
          ON pc.project_id = p.id
        WHERE p.user_id = ? OR pc.user_id = ?
        ORDER BY p.updated_at DESC
      `,
    )
    .all(userId, userId);

  const fullProjectIds = new Set(fullProjects.map((project) => project.id));
  const listSharedProjects = db
    .query<ProjectRow, [string, string, string]>(
      `
        SELECT DISTINCT
          p.id,
          p.user_id,
          p.name,
          p.description,
          p.created_at,
          p.updated_at
        FROM project p
        INNER JOIN project_list pl
          ON pl.project_id = p.id
        INNER JOIN project_list_collaborator plc
          ON plc.list_id = pl.id
        WHERE plc.user_id = ?
          AND p.user_id != ?
          AND NOT EXISTS (
            SELECT 1
            FROM project_collaborator pc
            WHERE pc.project_id = p.id AND pc.user_id = ?
          )
        ORDER BY p.updated_at DESC
      `,
    )
    .all(userId, userId, userId)
    .filter((project) => !fullProjectIds.has(project.id));

  const projects = [...fullProjects, ...listSharedProjects];
  if (projects.length === 0) {
    return [];
  }

  const projectAccessById = new Map(
    projects.map((project) => [
      project.id,
      mapProjectAccess(project, userId, fullProjectIds.has(project.id) ? (project.user_id === userId ? "owner" : "project_collaborator") : "list_collaborator"),
    ]),
  );

  const accessibleLists = db
    .query<ListRow & { is_list_collaborator: number }, string[]>(
      `
        SELECT DISTINCT
          pl.id,
          pl.project_id,
          pl.user_id,
          pl.name,
          pl.huawei_cart_key,
          pl.huawei_cart_name,
          pl.huawei_last_synced_at,
          pl.huawei_last_error,
          pl.huawei_last_remote_updated_at,
          pl.created_at,
          pl.updated_at,
          EXISTS(
            SELECT 1
            FROM project_list_collaborator plc
            WHERE plc.list_id = pl.id AND plc.user_id = ?
          ) AS is_list_collaborator
        FROM project_list pl
        WHERE pl.project_id IN (
          SELECT DISTINCT p.id
          FROM project p
          LEFT JOIN project_collaborator pc
            ON pc.project_id = p.id
          WHERE p.user_id = ? OR pc.user_id = ?
        )
        OR pl.id IN (
          SELECT plc.list_id
          FROM project_list_collaborator plc
          WHERE plc.user_id = ?
        )
        ORDER BY pl.updated_at DESC
      `,
    )
    .all(userId, userId, userId, userId)
    .filter((list) => projectAccessById.has(list.project_id));

  const accessibleListIds = accessibleLists.map((list) => list.id);
  const products = accessibleListIds.length === 0
    ? []
    : db
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
            WHERE list_id IN (${accessibleListIds.map(() => "?").join(", ")})
            ORDER BY updated_at DESC
          `,
        )
        .all(...accessibleListIds);

  return projects.map((project) => {
    const projectAccess = projectAccessById.get(project.id)!;
    const lists = accessibleLists
      .filter((list) => list.project_id === project.id)
      .map((list) => {
        const accessLevel: ListAccessLevel = list.user_id === userId
          ? "owner"
          : projectAccess.accessLevel !== "list_collaborator"
          ? "project_collaborator"
          : list.is_list_collaborator
          ? "list_collaborator"
          : "project_collaborator";

        return {
          ...mapListAccess(list, userId, accessLevel),
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
        };
      });

    return {
      ...projectAccess,
      lists,
    };
  });
}
