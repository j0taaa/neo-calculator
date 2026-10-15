import { describe, expect, test } from "bun:test";
import { GuestCartStore, guestCartDocument, guestCartList, guestCartStorageKey } from "./store";
import type { ProductMutationBody } from "../calculator-types";

const product: ProductMutationBody = { serviceCode: "HUAWEI:ecs", serviceName: "ECS", productType: "huawei-native", title: "Server", quantity: 1, config: { selection: {} }, pricing: { amount: 12, currency: "USD" } };
function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
describe("standalone cart storage", () => {
  test("cart lifecycle survives reload with fresh copy IDs and no project references", () => {
    const disk = storage(), store = new GuestCartStore(disk); store.load();
    store.import([{ name: "Main", products: [product] }, { name: "Extra", products: [] }]);
    const first = store.snapshot.carts[0], second = store.snapshot.carts[1];
    store.rename(first.id, "Quotation"); store.select(second.id);
    const reloaded = new GuestCartStore(disk); reloaded.load();
    expect(reloaded.snapshot.selectedId).toBe(second.id);
    const saved = reloaded.put(second.id, product);
    reloaded.put(second.id, { ...product, title: "Updated" }, saved.id);
    expect(reloaded.snapshot.carts[1].products[0].createdAt).toBe(saved.createdAt);
    reloaded.import([{ name: "Copy", products: first.products }]);
    expect(reloaded.snapshot.carts[2].products[0].id).not.toBe(first.products[0].id);
    expect(guestCartDocument(reloaded.snapshot.carts[0])).not.toHaveProperty("project");
    expect(guestCartDocument(reloaded.snapshot.carts[0]).cart.products[0]).not.toHaveProperty("id");
    expect(guestCartList(first).productCount).toBe(1);
    reloaded.deleteProducts(second.id, [saved.id]); reloaded.remove(first.id);
    expect(reloaded.snapshot.carts).toHaveLength(2);
    expect(reloaded.snapshot.carts[0].products).toHaveLength(0);
    expect(JSON.parse(disk.getItem(guestCartStorageKey)!)).not.toHaveProperty("projects");
  });
  test("failed persistence never acknowledges or exposes a lost product", () => {
    const disk = storage(), store = new GuestCartStore(disk); store.load(); store.import([{ name: "Cart", products: [] }]);
    const before = store.snapshot;
    disk.setItem = () => { throw new DOMException("Full", "QuotaExceededError"); };
    expect(() => store.put(before.selectedId, product)).toThrow("Unable to save carts");
    expect(store.snapshot).toBe(before);
    expect(store.snapshot.carts[0].products).toHaveLength(0);
  });
  test("invalid, oversized and over-limit batches leave the entire workspace intact", () => {
    const disk = storage(), store = new GuestCartStore(disk); store.load(); store.import([{ name: "Original", products: [] }]);
    const before = store.snapshot;
    expect(() => store.import([{ name: "Valid", products: [product] }, { name: " ", products: [] }])).toThrow("names");
    expect(() => store.import(Array.from({ length: 100 }, () => ({ name: "Overflow", products: [] })))).toThrow("100 carts");
    expect(() => store.put(before.selectedId, { ...product, config: { content: "x".repeat(2_000_001) } })).toThrow("storage is full");
    expect(store.snapshot).toBe(before);
    expect(() => store.put(before.selectedId, product, "missing-product")).toThrow("no longer exists");
  });
  test("corrupt storage is preserved, and writes cannot silently overwrite another tab", () => {
    const disk = storage(); disk.setItem(guestCartStorageKey, "broken-json");
    const broken = new GuestCartStore(disk);
    expect(() => broken.load()).toThrow(); expect(() => broken.import([{ name: "New", products: [] }])).toThrow("could not be loaded");
    expect(disk.getItem(guestCartStorageKey)).toBe("broken-json");
    const shared = storage(), first = new GuestCartStore(shared), second = new GuestCartStore(shared);
    first.load(); second.load(); first.import([{ name: "First tab", products: [] }]);
    expect(() => second.import([{ name: "Second tab", products: [] }])).toThrow("another tab");
    const reader = new GuestCartStore(shared); reader.load(); expect(reader.snapshot.carts.map(cart => cart.name)).toEqual(["First tab"]);
  });
});
