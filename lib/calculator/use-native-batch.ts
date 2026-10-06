"use client";
import { useRef, useState } from "react";
import type { ProductMutationBody } from "@/lib/calculator-types";

export function useNativeBatch(save: (product: ProductMutationBody) => Promise<void>) {
  const [items, setItems] = useState<{ id: string; product: ProductMutationBody }[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const working = useRef(false);
  function enqueue(product: ProductMutationBody) {
    if (working.current) return;
    setItems(current => [...current, { id: crypto.randomUUID(), product: structuredClone(product) }]);
    setMessage("Configuration queued. Each item receives a fresh Huawei price when saved.");
  }
  async function submit() {
    if (working.current || !items.length) return;
    working.current = true;
    setBusy(true);
    setMessage("");
    let saved = 0;
    try {
      for (const item of items) {
        await save(item.product);
        saved++;
        // Only acknowledged writes leave the queue. Retry cannot repeat completed items.
        setItems(current => current.filter(candidate => candidate.id !== item.id));
      }
      setMessage(`Added ${saved} configuration${saved === 1 ? "" : "s"} with fresh Huawei prices.`);
    } catch (error) {
      setMessage(`${saved} saved. ${error instanceof Error ? error.message : "Unable to save batch"} Remaining configurations stay queued.`);
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  return { items, busy, message, enqueue, submit,
    remove: (id: string) => { if (!working.current) setItems(current => current.filter(item => item.id !== id)); },
  };
}
