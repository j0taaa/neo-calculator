import { describe, expect, test } from "bun:test";
import { addCalculatorBatch, applyProductMutation, saveCalculatorProducts, type CalculatorProductSource, type MutateListProduct, type SavedCartProduct } from "./calculator-cart";
import type { AppProject, ProductMutationBody } from "./calculator-types";

const product: ProductMutationBody = {
  serviceCode: "EVS", serviceName: "Elastic Volume Service", productType: "evs", title: "Volume", quantity: 2,
  config: { region: "cn-hong-kong", diskSizeGiB: 80 }, pricing: { total: "USD 18.40/mo" },
};
const source: CalculatorProductSource = { buildRequestBodies: () => product };

function recorder(failAt?: number) {
  const requests: Parameters<MutateListProduct>[] = [];
  const acknowledged: SavedCartProduct[] = [];
  return {
    requests, acknowledged,
    mutate: async (...args: Parameters<MutateListProduct>) => {
      requests.push(args);
      if (requests.length === failAt) throw new Error(args[3]);
      return { ...args[2], id: String(requests.length), listId: "list", projectId: "project", updatedAt: "new" };
    },
    onSaved: (saved: SavedCartProduct) => { acknowledged.push(saved); },
  };
}

describe("shared calculator cart workflow", () => {
  test("saves asynchronous calculator output without altering configuration or prices", async () => {
    const writer = recorder();
    const message = await saveCalculatorProducts({ buildRequestBodies: async () => product }, { listId: "list" }, writer);
    expect(message).toBe("Product added to list.");
    expect(writer.requests).toEqual([["/api/lists/list/products", "POST", product, "Unable to add product to list"]]);
    expect(writer.acknowledged[0].config).toBe(product.config);
    expect(writer.acknowledged[0].pricing).toBe(product.pricing);
  });

  test.each([{ empty: null }, { empty: [] }])("empty calculator output cannot write a cart (%j)", async ({ empty }) => {
    const writer = recorder();
    await expect(saveCalculatorProducts({ buildRequestBodies: () => empty }, { listId: "list" }, writer))
      .rejects.toThrow("Unable to build the selected product configuration.");
    expect(writer.requests).toHaveLength(0);
  });

  test("edits the original list item and saves split extras to the selected list", async () => {
    const writer = recorder();
    const message = await saveCalculatorProducts({
      buildRequestBodies: () => [product, { ...product, title: "Overflow" }],
      getUpdateSuccessMessage: ({ requestBodiesCount, extraRequestBodiesCount }) => `${requestBodiesCount} products, ${extraRequestBodiesCount} extra`,
    }, { listId: "destination", editing: { listId: "original", productId: "existing" } }, writer);
    expect(writer.requests.map(([url, method]) => [url, method])).toEqual([
      ["/api/lists/original/products/existing", "PATCH"], ["/api/lists/destination/products", "POST"],
    ]);
    expect(message).toBe("2 products, 1 extra");
  });

  test("stops on split save failure while retaining acknowledged writes", async () => {
    const writer = recorder(2);
    await expect(saveCalculatorProducts({ buildRequestBodies: () => [product, product, product] }, {
      listId: "list", editing: { listId: "list", productId: "existing" },
    }, writer)).rejects.toThrow("Unable to create one of the split products");
    expect(writer.requests).toHaveLength(2);
    expect(writer.acknowledged).toHaveLength(1);
  });

  test.each(["invalid", "null", "{}", "[]"])("rejects invalid batch input before any write: %s", async (json) => {
    const writer = recorder();
    await expect(addCalculatorBatch({ ...source, buildBatchRequestBodies: () => product }, "list", json, writer)).rejects.toThrow("Batch input must be");
    expect(writer.requests).toHaveLength(0);
  });

  test("a calculator without batch support cannot write batch items", async () => {
    const writer = recorder();
    await expect(addCalculatorBatch(source, "list", "[{}]", writer)).rejects.toThrow("does not support batch");
    expect(writer.requests).toHaveLength(0);
  });

  test("counts expanded products and preserves custom success messages", async () => {
    const writer = recorder();
    const message = await addCalculatorBatch({
      ...source,
      buildBatchRequestBodies: async (item) => item === 1 ? [product, product] : product,
      getBatchSuccessMessage: ({ createdCount, expandedCount }) => `${createdCount} saved, ${expandedCount} split`,
    }, "list", "[1,2]", writer);
    expect(message).toBe("3 saved, 1 split");
    expect(writer.acknowledged).toHaveLength(3);
  });

  test("batch failure identifies the chunk and reports partial success", async () => {
    const writer = recorder(3);
    await expect(addCalculatorBatch({ ...source, buildBatchRequestBodies: () => [product, product] }, "list", "[1,2,3]", writer))
      .rejects.toThrow("Unable to add item 2 chunk 1 to the list 2 items were added before the error.");
    expect(writer.requests).toHaveLength(3);
    expect(writer.acknowledged).toHaveLength(2);
  });

  test("batch conversion failure reports earlier saved products", async () => {
    const writer = recorder();
    await expect(addCalculatorBatch({ ...source, buildBatchRequestBodies: (item) => item === 1 ? product : null }, "list", "[1,2]", writer))
      .rejects.toThrow("Item 2 could not be converted into products. 1 item were added before the error.");
    expect(writer.acknowledged).toHaveLength(1);
  });
});

test("cart updates preserve ordering, counts, creation dates and unrelated references", () => {
  const original = { ...product, id: "existing", createdAt: "created", updatedAt: "old" };
  const list = {
    id: "list", name: "Cart", ownerUserId: "user", accessLevel: "owner" as const, canShare: true,
    huaweiCartKey: null, huaweiCartName: null, huaweiLastSyncedAt: null, huaweiLastError: null, huaweiLastRemoteUpdatedAt: null,
    createdAt: "created", updatedAt: "old", productCount: 1, products: [original],
  };
  const project: AppProject = {
    id: "project", name: "Project", ownerUserId: "user", accessLevel: "owner", canShare: true,
    description: null, createdAt: "created", updatedAt: "old", lists: [list, { ...list, id: "untouched" }],
  };
  const projects = [project, { ...project, id: "other" }];
  const saved = { ...product, id: "new", listId: "list", projectId: "project", updatedAt: "new" };
  const added = applyProductMutation(projects, saved, "POST");
  expect(added[0].lists[0].products.map((item) => item.id)).toEqual(["new", "existing"]);
  expect(added[0].lists[0].productCount).toBe(2);
  expect(added[0].updatedAt).toBe("new");
  expect(added[0].lists[0].updatedAt).toBe("new");
  expect(added[0].lists[1]).toBe(project.lists[1]);
  expect(added[1]).toBe(projects[1]);
  expect(projects[0].lists[0].productCount).toBe(1);
  expect(applyProductMutation(projects, saved, "POST", "end")[0].lists[0].products.map((item) => item.id)).toEqual(["existing", "new"]);
  const edited = applyProductMutation(projects, { ...saved, id: "existing", quantity: 3 }, "PATCH");
  expect(edited[0].lists[0].products[0]).toMatchObject({ createdAt: "created", updatedAt: "new", quantity: 3 });
  expect(edited[0].lists[0].productCount).toBe(1);
});
