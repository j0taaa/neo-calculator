import type { AppProduct, AppProject, ProductMutationBody } from "@/lib/calculator-types";

type Products = ProductMutationBody | ProductMutationBody[] | null;
type MaybePromise<T> = T | Promise<T>;

/** Calculators produce saved products; they do not know about HTTP, projects or React. */
export type CalculatorProductSource = {
  buildRequestBodies: () => MaybePromise<Products>;
  buildBatchRequestBodies?: (item: unknown) => MaybePromise<Products>;
  getAddSuccessMessage?: (input: { requestBodiesCount: number }) => string | null;
  getUpdateSuccessMessage?: (input: { requestBodiesCount: number; extraRequestBodiesCount: number }) => string | null;
  getBatchSuccessMessage?: (input: { createdCount: number; expandedCount: number }) => string | null;
};

export type SavedCartProduct = AppProduct & { listId: string; projectId: string };
export type ProductMutationMethod = "POST" | "PATCH";
export type MutateListProduct = (
  url: string,
  method: ProductMutationMethod,
  body: ProductMutationBody,
  fallbackError: string,
) => Promise<SavedCartProduct>;

type CartWriter = {
  mutate: MutateListProduct;
  onSaved: (product: SavedCartProduct, method: ProductMutationMethod) => void;
};

type SaveTarget = {
  listId: string;
  editing?: { productId: string; listId: string };
};

function productsArray(products: Products): ProductMutationBody[] {
  return products == null ? [] : Array.isArray(products) ? products : [products];
}

/** Apply each acknowledged write immediately, so a later failure does not hide earlier saves. */
async function writeProduct(writer: CartWriter, url: string, method: ProductMutationMethod, body: ProductMutationBody, error: string) {
  const product = await writer.mutate(url, method, body, error);
  writer.onSaved(product, method);
}

export async function saveCalculatorProducts(source: CalculatorProductSource, target: SaveTarget, writer: CartWriter): Promise<string> {
  const products = productsArray(await source.buildRequestBodies());
  if (products.length === 0) throw new Error("Unable to build the selected product configuration.");

  const { editing, listId } = target;
  for (const [index, product] of products.entries()) {
    if (editing && index === 0) {
      await writeProduct(writer, `/api/lists/${editing.listId}/products/${editing.productId}`, "PATCH", product, "Unable to update product");
    } else {
      await writeProduct(writer, `/api/lists/${listId}/products`, "POST", product,
        editing ? "Unable to create one of the split products" : "Unable to add product to list");
    }
  }
  return editing
    ? source.getUpdateSuccessMessage?.({ requestBodiesCount: products.length, extraRequestBodiesCount: products.length - 1 }) ?? "Product updated."
    : source.getAddSuccessMessage?.({ requestBodiesCount: products.length }) ?? "Product added to list.";
}

export async function addCalculatorBatch(source: CalculatorProductSource, listId: string, json: string, writer: CartWriter): Promise<string> {
  let items: unknown;
  try {
    items = JSON.parse(json);
  } catch {
    throw new Error("Batch input must be valid JSON.");
  }
  if (!Array.isArray(items) || items.length === 0) throw new Error("Batch input must be a non-empty JSON array.");
  if (!source.buildBatchRequestBodies) throw new Error("This calculator does not support batch add yet.");

  let createdCount = 0;
  let expandedCount = 0;
  try {
    for (const [index, item] of items.entries()) {
      const products = productsArray(await source.buildBatchRequestBodies(item));
      if (products.length === 0) throw new Error(`Item ${index + 1} could not be converted into products.`);
      expandedCount += products.length - 1;
      for (const [chunkIndex, product] of products.entries()) {
        await writeProduct(writer, `/api/lists/${listId}/products`, "POST", product,
          `Unable to add item ${index + 1}${products.length > 1 ? ` chunk ${chunkIndex + 1}` : ""} to the list`);
        createdCount += 1;
      }
    }
    return source.getBatchSuccessMessage?.({ createdCount, expandedCount })
      ?? `Added ${createdCount} product${createdCount === 1 ? "" : "s"} to the list.`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Batch add failed.";
    throw new Error(createdCount > 0
      ? `${message} ${createdCount} item${createdCount === 1 ? "" : "s"} were added before the error.`
      : message, { cause: error });
  }
}

/** Preserve list ordering, creation timestamps on PATCH, and unaffected project references. */
export function applyProductMutation(
  projects: AppProject[],
  product: SavedCartProduct,
  method: ProductMutationMethod,
  insertAt: "start" | "end" = "start",
): AppProject[] {
  return projects.map((project) => project.id !== product.projectId ? project : {
    ...project,
    updatedAt: product.updatedAt,
    lists: project.lists.map((list) => list.id !== product.listId ? list : {
      ...list,
      updatedAt: product.updatedAt,
      productCount: list.productCount + (method === "POST" ? 1 : 0),
      products: method === "PATCH"
        ? list.products.map((item) => item.id === product.id ? { ...item, ...product } : item)
        : insertAt === "start" ? [product, ...list.products] : [...list.products, product],
    }),
  });
}
