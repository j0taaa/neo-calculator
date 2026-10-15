import type { AppList, AppProduct, ProductMutationBody } from "../calculator-types";
import { isRecord } from "../product-input";

export const guestCartStorageKey = "neoCalculator.localCarts.v1";
export const guestCartMaxBytes = 2_000_000;
export type GuestCart = { id: string; name: string; createdAt: string; updatedAt: string; products: AppProduct[] };
type Workspace = { version: 1; selectedId: string; carts: GuestCart[] };
type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
const empty = (): Workspace => ({ version: 1, selectedId: "", carts: [] });
const validName = (name: string) => {
  const result = name.trim();
  if (!result || result.length > 300) throw new Error("Cart names must contain 1–300 characters.");
  return result;
};

/** No accounts or projects. Writes commit to storage before they become visible. */
export class GuestCartStore {
  private value = empty();
  private blocked = false;
  private persisted: string | null = null;
  constructor(private storage: Storage) {}
  get snapshot() { return this.value; }
  load() {
    try {
      const raw = this.storage.getItem(guestCartStorageKey);
      this.persisted = raw;
      if (!raw) return this.value;
      if (new TextEncoder().encode(raw).length > guestCartMaxBytes) throw new Error("Saved local carts exceed the storage limit.");
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.carts) || typeof parsed.selectedId !== "string") throw new Error("Invalid local cart storage.");
      const ids = new Set<string>();
      const carts = parsed.carts.map(cart => {
        if (!isRecord(cart) || typeof cart.id !== "string" || ids.has(cart.id) || typeof cart.name !== "string" || typeof cart.createdAt !== "string" || typeof cart.updatedAt !== "string" || !Array.isArray(cart.products)) throw new Error("Invalid saved cart.");
        ids.add(cart.id); validName(cart.name);
        for (const product of cart.products) {
          if (!isRecord(product) || typeof product.id !== "string" || ids.has(product.id) || typeof product.serviceCode !== "string" || typeof product.serviceName !== "string" || typeof product.title !== "string" || typeof product.productType !== "string" || !Number.isInteger(product.quantity) || Number(product.quantity) < 1 || !isRecord(product.config)) throw new Error("Invalid saved cart product.");
          ids.add(product.id);
        }
        return cart as unknown as GuestCart;
      });
      this.checkLimits(carts);
      this.value = { version: 1, carts, selectedId: carts.some(cart => cart.id === parsed.selectedId) ? parsed.selectedId : carts[0]?.id ?? "" };
      return this.value;
    } catch (error) { this.blocked = true; throw error; }
  }
  private checkLimits(carts: GuestCart[]) {
    if (carts.length > 100 || carts.reduce((sum, cart) => sum + cart.products.length, 0) > 1000) throw new Error("Local carts support at most 100 carts and 1000 products. Export a copy before removing older carts.");
  }
  private commit(next: Workspace) {
    if (this.blocked) throw new Error("Local cart storage could not be loaded. Download the saved data to recover it.");
    this.checkLimits(next.carts);
    const json = JSON.stringify(next);
    if (new TextEncoder().encode(json).length > guestCartMaxBytes) throw new Error("Local cart storage is full. Export a copy before removing older carts.");
    if (this.storage.getItem(guestCartStorageKey) !== this.persisted) throw new Error("Local carts changed in another tab. Reload this page before making more changes.");
    try { this.storage.setItem(guestCartStorageKey, json); }
    catch { throw new Error("Unable to save carts in this browser. Check browser storage permissions or export your cart."); }
    this.value = next;
    this.persisted = json;
    return next;
  }
  select(id: string) {
    if (!this.value.carts.some(cart => cart.id === id)) return this.value;
    return this.commit({ ...this.value, selectedId: id });
  }
  import(carts: { name: string; products: ProductMutationBody[] }[]) {
    if (!carts.length) throw new Error("The document contains no carts.");
    const now = new Date().toISOString();
    const created = carts.map(cart => ({ id: crypto.randomUUID(), name: validName(cart.name), createdAt: now, updatedAt: now,
      products: cart.products.map(product => ({ ...product, id: crypto.randomUUID(), createdAt: now, updatedAt: now })) }));
    return this.commit({ version: 1, carts: [...this.value.carts, ...created], selectedId: created[0].id });
  }
  rename(id: string, name: string) { return this.update(id, cart => ({ ...cart, name: validName(name) })); }
  remove(id: string) {
    const carts = this.value.carts.filter(cart => cart.id !== id);
    return this.commit({ version: 1, carts, selectedId: this.value.selectedId === id ? carts[0]?.id ?? "" : this.value.selectedId });
  }
  private update(id: string, change: (cart: GuestCart) => GuestCart) {
    if (!this.value.carts.some(cart => cart.id === id)) throw new Error("This local cart no longer exists.");
    const now = new Date().toISOString();
    return this.commit({ ...this.value, carts: this.value.carts.map(cart => cart.id === id ? { ...change(cart), updatedAt: now } : cart) });
  }
  put(cartId: string, product: ProductMutationBody, productId?: string) {
    const cart = this.value.carts.find(cart => cart.id === cartId);
    const existing = cart?.products.find(item => item.id === productId);
    if (productId && !existing) throw new Error("This cart product no longer exists.");
    const now = new Date().toISOString();
    const saved = { ...product, id: existing?.id ?? crypto.randomUUID(), createdAt: existing?.createdAt ?? now, updatedAt: now };
    this.update(cartId, cart => ({ ...cart, products: existing ? cart.products.map(item => item.id === saved.id ? saved : item) : [...cart.products, saved] }));
    return saved;
  }
  deleteProducts(cartId: string, ids: string[]) { return this.update(cartId, cart => ({ ...cart, products: cart.products.filter(product => !ids.includes(product.id)) })); }
  reprice(carts: GuestCart[]) { return this.commit({ ...this.value, carts }); }
}

/** The shared cart view expects list metadata; this adapter adds no project. */
export function guestCartList(cart: GuestCart): AppList {
  return { ...cart, ownerUserId: "", accessLevel: "owner", canShare: false, productCount: cart.products.length,
    huaweiCartKey: null, huaweiCartName: null, huaweiLastSyncedAt: null, huaweiLastError: null, huaweiLastRemoteUpdatedAt: null };
}
export function guestCartDocument(cart: Pick<GuestCart, "name" | "products">) {
  return { schemaVersion: 1, resourceType: "cart", cart: { name: cart.name, products: cart.products.map(({ serviceCode, serviceName, productType, title, quantity, config, pricing }) => ({ serviceCode, serviceName, productType, title, quantity, config, pricing })) } };
}
