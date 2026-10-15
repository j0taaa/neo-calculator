"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Loader2, Plus, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateResourceButton({ kind, defaultName = "", disabled, onCreate }: {
  kind: "project" | "cart";
  defaultName?: string;
  disabled?: boolean;
  onCreate: (name: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const selectName = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const title = `Create ${kind}`;
  const triggerLabel = kind === "project" ? "New Project" : "New Cart";

  return <Dialog.Root open={open} onOpenChange={next => {
    if (pending.current) return;
    if (next) { setName(defaultName); setError(""); selectName.current = true; }
    setOpen(next);
  }}>
    <Dialog.Trigger disabled={disabled} render={<Button type="button" variant="outline" size="icon" />} aria-label={triggerLabel} title={triggerLabel}>
      <Plus />
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-zinc-950/40" />
      <Dialog.Popup aria-modal="true" initialFocus={input} className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-white p-5 text-zinc-900 shadow-xl outline-none">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          <Dialog.Close render={<Button type="button" variant="ghost" size="icon" disabled={busy} />} aria-label={`Close ${title}`}><X /></Dialog.Close>
        </div>
        <form className="space-y-4" onSubmit={async event => {
          event.preventDefault();
          if (pending.current || !name.trim()) return;
          pending.current = true;
          setBusy(true);
          setError("");
          try {
            await onCreate(name.trim());
            setOpen(false);
          } catch (error) {
            setError(error instanceof Error ? error.message : `Unable to create ${kind}. Please try again.`);
          } finally {
            pending.current = false;
            setBusy(false);
          }
        }}>
          <label htmlFor={id} className="block space-y-2 text-sm font-medium">
            {kind === "project" ? "Project name" : "Cart name"}
            <Input ref={input} id={id} value={name} onChange={event => setName(event.target.value)} onFocus={event => {
              if (selectName.current) { event.target.select(); selectName.current = false; }
            }} required maxLength={300} disabled={busy} autoComplete="off" />
          </label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <Dialog.Close render={<Button type="button" variant="outline" disabled={busy} />}>Cancel</Dialog.Close>
            <Button type="submit" disabled={busy || !name.trim()}>{busy && <Loader2 className="animate-spin" />}{busy ? "Creating…" : title}</Button>
          </div>
        </form>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}
