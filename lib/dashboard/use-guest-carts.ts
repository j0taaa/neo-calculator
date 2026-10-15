import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProductMutationBody } from "../calculator-types";
import { getResponseError } from "../calculator-page-helpers";
import { GuestCartStore, guestCartList, guestCartDocument, guestCartStorageKey, guestCartMaxBytes } from "../guest-carts/store";
import { priceGuestProduct } from "../guest-carts/pricing";
import { decodeGuestShare, encodeGuestShare, guestShareUrl } from "../guest-carts/share";
import type { ImportedList } from "../cart-json/types";

async function validateDocument(document: unknown) {
  const response = await fetch("/api/v1/cart/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(document) });
  const body = await response.json();
  if (!response.ok || !body.valid) throw new Error(getResponseError(body, "Unable to validate this cart."));
  return body.normalized as { resourceType: "cart"; cart: ImportedList } | { resourceType: "project"; project: { lists: ImportedList[] } };
}

export function useGuestCarts(enabled: boolean) {
  const store = useRef<GuestCartStore | null>(null);
  const [snapshot, setSnapshot] = useState({ version: 1 as const, selectedId: "", carts: [] as GuestCartStore["snapshot"]["carts"] });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [shareDialog, setShareDialog] = useState<{ name: string; url: string } | null>(null);
  const shared = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setReady(false); setError("");
    void (async () => {
      try {
        const local = new GuestCartStore(window.localStorage);
        store.current = local;
        const saved = local.load();
        const carts = [];
        for (const cart of saved.carts) {
          const products = [];
          for (const product of cart.products) {
            const repriced = await priceGuestProduct(product);
            if (repriced.quantity !== product.quantity) throw new Error(`The saved quantity in ${cart.name} no longer matches its configuration.`);
            products.push({ ...repriced, id: product.id, createdAt: product.createdAt, updatedAt: product.updatedAt });
          }
          carts.push({ ...cart, products });
        }
        if (cancelled) return;
        if (carts.length) local.reprice(carts);
        else local.import([{ name: "My Cart", products: [] }]);
        setSnapshot(local.snapshot); setReady(true);
      } catch (error) { if (!cancelled) setError(error instanceof Error ? error.message : "Unable to load local carts."); }
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  const lists = useMemo(() => snapshot.carts.map(guestCartList), [snapshot.carts]);
  const selectedList = lists.find(cart => cart.id === snapshot.selectedId) ?? null;
  const run = useCallback((action: (local: GuestCartStore) => void) => {
    try {
      if (!store.current || !ready) throw new Error("Wait for local carts to finish loading.");
      action(store.current); setSnapshot(store.current.snapshot); setError(""); setMessage("");
      return true;
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to save local carts."); return false; }
  }, [ready]);
  const select = useCallback((value: string | ((current: string) => string)) => run(local => local.select(typeof value === "function" ? value(local.snapshot.selectedId) : value)), [run]);

  const importDocument = useCallback(async (input: unknown) => {
    if (!store.current || !ready) throw new Error("Wait for local carts to finish loading.");
    const document = await validateDocument(input);
    const carts = document.resourceType === "cart" ? [document.cart] : document.project.lists;
    store.current.import(carts);
    setSnapshot(store.current.snapshot); setError("");
    setMessage(`Imported ${carts.length} local cart${carts.length === 1 ? "" : "s"}.`);
  }, [ready]);

  const importFile = async (file: File) => {
    setBusy(true); setMessage(""); setError("");
    try {
      if (file.size > guestCartMaxBytes) throw new Error("The JSON document exceeds 2 MB.");
      let input: unknown;
      try { input = JSON.parse(await file.text()); } catch { throw new Error("Import file is not valid JSON."); }
      await importDocument(input);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to import local carts."); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!enabled || !ready) return;
    const payload = new URLSearchParams(window.location.hash.slice(1)).get("cart");
    if (!payload || shared.current === payload) return;
    shared.current = payload;
    setBusy(true);
    void decodeGuestShare(payload).then(input => importDocument(input)).then(() => {
      setMessage("Shared cart opened as a local copy. Your changes stay in this browser.");
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    }).catch(error => setError(error instanceof Error ? error.message : "Unable to open shared cart.")).finally(() => setBusy(false));
  }, [enabled, ready, importDocument]);

  const mutate = useCallback(async (url: string, method: "POST" | "PATCH", product: ProductMutationBody) => {
    if (!store.current || !ready || !enabled) throw new Error("Select a local cart first.");
    const match = /^\/api\/lists\/([^/]+)\/products(?:\/([^/]+))?$/.exec(url);
    if (!match || (method === "PATCH" && !match[2])) throw new Error("Invalid local cart operation.");
    const priced = await priceGuestProduct(product);
    const saved = store.current.put(match[1], priced, method === "PATCH" ? match[2] : undefined);
    setSnapshot(store.current.snapshot);
    return { ...saved, listId: match[1], projectId: "" };
  }, [enabled, ready]);
  const deleteProducts = useCallback(async (cartId: string, ids: string[]) => {
    if (!store.current || !ready) throw new Error("Select a local cart first.");
    store.current.deleteProducts(cartId, ids); setSnapshot(store.current.snapshot);
  }, [ready]);
  const validateProducts = useCallback(async (products: ProductMutationBody[]) => {
    const document = await validateDocument({ schemaVersion: 1, resourceType: "cart", cart: { name: "Pasted items", products } });
    if (document.resourceType !== "cart") throw new Error("Invalid cart items.");
    return document.cart.products;
  }, []);

  return {
    shareDialog, setShareDialog,
    enabled, ready, busy, error, message, lists, selectedList, selectedListId: snapshot.selectedId, select,
    create: (name: string) => {
      if (!store.current || !ready) throw new Error("Wait for local carts to finish loading.");
      // Creation errors belong to its dialog; preserve the specific storage or tab-conflict message.
      store.current.import([{ name, products: [] }]);
      setSnapshot(store.current.snapshot);
      setError("");
      setMessage("");
    },
    rename: (id: string, name: string) => run(local => local.rename(id, name)),
    remove: (id: string) => run(local => local.remove(id)),
    clone: (id: string) => run(local => { const cart = local.snapshot.carts.find(cart => cart.id === id); if (cart) local.import([{ name: `${cart.name.slice(0, 295)} copy`, products: cart.products }]); }),
    mutate, deleteProducts, validateProducts, importFile,
    openShare: async (id: string) => {
      const cart = snapshot.carts.find(cart => cart.id === id);
      if (!cart) return;
      setBusy(true); setError("");
      try { setShareDialog({ name: cart.name, url: guestShareUrl(window.location.origin, await encodeGuestShare(guestCartDocument(cart))) }); }
      catch (error) { setError(error instanceof Error ? error.message : "Unable to share this cart."); }
      finally { setBusy(false); }
    },
    backup: () => { try { return window.localStorage.getItem(guestCartStorageKey) ?? ""; } catch { return ""; } },
  };
}
