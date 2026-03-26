import { db } from "@/lib/db";
import { createListRecord, createProjectRecord, insertListProducts, touchProject } from "@/lib/resource-persistence";

type ImportedProduct = {
  serviceCode: string;
  serviceName: string;
  productType: string;
  title: string;
  quantity: number;
  config: unknown;
  pricing: unknown;
};

type ImportedList = {
  name: string;
  products: ImportedProduct[];
};

export type ImportedProjectPayload = {
  resourceType: "project";
  name: string;
  description: string | null;
  lists: ImportedList[];
};

export type ImportedCartPayload = {
  resourceType: "cart";
  name: string;
  products: ImportedProduct[];
};

export type ImportedResourcePayload = ImportedProjectPayload | ImportedCartPayload;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getTrimmedString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is required`);
  }

  return value.trim();
}

function getOptionalTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseImportedProduct(value: unknown, index: number): ImportedProduct {
  if (!isRecord(value)) {
    throw new Error(`Product ${index + 1} is invalid`);
  }

  const quantity = typeof value.quantity === "number" && Number.isFinite(value.quantity)
    ? Math.max(1, Math.floor(value.quantity))
    : 1;

  return {
    serviceCode: getTrimmedString(value.serviceCode, `Product ${index + 1} serviceCode`),
    serviceName: getTrimmedString(value.serviceName, `Product ${index + 1} serviceName`),
    productType: getTrimmedString(value.productType, `Product ${index + 1} productType`),
    title: getTrimmedString(value.title, `Product ${index + 1} title`),
    quantity,
    config: value.config ?? {},
    pricing: value.pricing ?? null,
  };
}

function parseImportedList(value: unknown, index: number): ImportedList {
  if (!isRecord(value)) {
    throw new Error(`Cart ${index + 1} is invalid`);
  }

  if (!Array.isArray(value.products)) {
    throw new Error(`Cart ${index + 1} products are required`);
  }

  return {
    name: getTrimmedString(value.name, `Cart ${index + 1} name`),
    products: value.products.map((product, productIndex) => parseImportedProduct(product, productIndex)),
  };
}

export function parseImportedResourcePayload(payload: unknown): ImportedResourcePayload {
  if (!isRecord(payload)) {
    throw new Error("Import file must be a JSON object");
  }

  if (payload.resourceType === "project") {
    if (!isRecord(payload.project)) {
      throw new Error("Project export is missing project data");
    }

    const project = payload.project;
    const lists = Array.isArray(project.lists) ? project.lists.map((list, index) => parseImportedList(list, index)) : null;
    if (!lists) {
      throw new Error("Project export is missing carts");
    }

    return {
      resourceType: "project",
      name: getTrimmedString(project.name, "Project name"),
      description: getOptionalTrimmedString(project.description),
      lists,
    };
  }

  if (payload.resourceType === "cart") {
    if (!isRecord(payload.cart)) {
      throw new Error("Cart export is missing cart data");
    }

    const cart = payload.cart;
    const products = Array.isArray(cart.products) ? cart.products.map((product, index) => parseImportedProduct(product, index)) : null;
    if (!products) {
      throw new Error("Cart export is missing products");
    }

    return {
      resourceType: "cart",
      name: getTrimmedString(cart.name, "Cart name"),
      products,
    };
  }

  throw new Error("Unsupported import file. Export a cart or project JSON file first.");
}

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
