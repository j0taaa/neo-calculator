"use client";
import { Button } from "@/components/ui/button";
import type { useNativeBatch } from "@/lib/calculator/use-native-batch";
export function NativeBatchPanel({ items, busy, message, submit, remove, canSave, onConfigure }:
  ReturnType<typeof useNativeBatch> & { canSave: boolean; onConfigure: () => void }) {
  return <section className="space-y-4 p-4" aria-label="Configured batch">
    <p className="text-sm text-zinc-600">Configure any service in the calculator, then choose “Queue for batch”. Services, regions and billing modes can be mixed in the same batch.</p>
    <Button variant="outline" onClick={onConfigure} disabled={busy}>Configure another item</Button>
    {items.length > 0 ? <ul className="space-y-3">{items.map(item => {
      const config = item.product.config as { region: string; billingMode: string };
      return <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
        <div className="min-w-0"><p className="break-words text-sm font-medium">{item.product.title}</p>
          <p className="text-xs text-zinc-500">{config.region} · {config.billingMode}</p></div>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => remove(item.id)}>Remove</Button>
      </li>;
    })}</ul> : <p className="text-sm text-zinc-500">No configurations queued yet.</p>}
    <Button onClick={submit} disabled={busy || !canSave || !items.length}>{busy ? "Checking and saving…" : "Save queued configurations"}</Button>
    {!canSave && <p className="text-sm text-zinc-500">Sign in and select a cart to save.</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
