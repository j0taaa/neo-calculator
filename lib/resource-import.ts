import { db } from "@/lib/db";
import { createListRecord, createProjectRecord, insertListProducts, touchProject } from "@/lib/resource-persistence";
import type { ImportedResourcePayload } from "./cart-json/types";
export type { ImportedResourcePayload } from "./cart-json/types";
export type ImportedProjectPayload = Extract<ImportedResourcePayload, { resourceType: "project" }>;
export type ImportedCartPayload = Extract<ImportedResourcePayload, { resourceType: "cart" }>;

export type ImportedProjectResult = {
  projectId: string;
  firstListId: string | null;
  name: string;
  importedListCount: number;
  importedProductCount: number;
};

export type ImportedCartResult = {
  projectId: string;
  listId: string;
  name: string;
  importedProductCount: number;
};

export function importProjectPayload(userId: string, payload: ImportedProjectPayload): ImportedProjectResult {
  const now = new Date().toISOString();
  let projectId = crypto.randomUUID();
  const createdListIds: string[] = [];
  let importedProductCount = 0;

  db.transaction(() => {
    projectId = createProjectRecord({ id: projectId, userId, name: payload.name, description: payload.description, now });

    payload.lists.forEach((list) => {
      const listId = createListRecord({ projectId, userId, name: list.name, now });
      createdListIds.push(listId);

      importedProductCount += insertListProducts({
        listId,
        projectId,
        userId,
        now,
        products: list.products,
      }).length;
    });
  })();

  return {
    projectId,
    firstListId: createdListIds[0] ?? null,
    name: payload.name,
    importedListCount: payload.lists.length,
    importedProductCount,
  };
}

export function importCartPayload(userId: string, projectId: string, payload: ImportedCartPayload): ImportedCartResult {
  const now = new Date().toISOString();
  let listId = crypto.randomUUID();

  db.transaction(() => {
    listId = createListRecord({ id: listId, projectId, userId, name: payload.name, now });
    insertListProducts({ listId, projectId, userId, now, products: payload.products });
    touchProject(projectId, now);
  })();

  return {
    projectId,
    listId,
    name: payload.name,
    importedProductCount: payload.products.length,
  };
}
