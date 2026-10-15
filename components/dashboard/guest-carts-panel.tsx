"use client";

import { useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Copy, Download, Pencil, Plus, Share2, Trash2, Upload, X } from "lucide-react";
import { ActionMenu } from "../home-page-shell-parts";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { ResourceImportDialog } from "./resource-import-dialog";
import type { DashboardModel } from "@/lib/dashboard/use-dashboard";
import { copyText } from "@/lib/calculator-page-helpers";
import { downloadTextFile } from "@/lib/resource-export";

export function GuestCartsPanel({ guest, transfer }: { guest: DashboardModel["guest"]; transfer: DashboardModel["imports"]["transfer"] }) {
  const [name, setName] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [importKind, setImportKind] = useState<"cart" | "project" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rename, setRename] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const create = () => { if (guest.create(name || `Cart ${guest.lists.length + 1}`)) setName(""); };
  return <>
    <Card className="min-w-0 overflow-hidden shadow-sm">
      <CardHeader>
        <CardTitle>Local Carts</CardTitle>
        <p className="text-sm text-zinc-500">Saved in this browser, without a project or account. Export or share to keep a copy.</p>
        <div className="flex flex-wrap gap-2">
          <Input aria-label="New local cart name" placeholder="New cart name" value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && guest.ready && !guest.busy) create(); }} disabled={!guest.ready || guest.busy} />
          <Button onClick={create} disabled={!guest.ready || guest.busy}><Plus />New Cart</Button>
          <ActionMenu label="Open local cart actions" open={menuId === "import"} onOpenChange={open => setMenuId(open ? "import" : null)} items={[
            { label: "Import from Huawei Cloud", icon: <Download />, onSelect: () => { window.location.href = "/huawei-carts"; } },
            { label: "Import Cart", icon: <Upload />, onSelect: () => setImportKind("cart"), disabled: !guest.ready || guest.busy },
            { label: "Import Project", icon: <Upload />, onSelect: () => setImportKind("project"), disabled: !guest.ready || guest.busy },
          ]} />
        </div>
        {!guest.ready && !guest.error && <p role="status" className="text-sm text-zinc-500">Loading local carts…</p>}
        {guest.busy && <p role="status" className="text-sm text-zinc-500">Preparing carts…</p>}
        {guest.error && <p role="alert" className="text-sm text-red-700">{guest.error}</p>}
        {guest.message && <p role="status" className="text-sm text-zinc-600">{guest.message}</p>}
        {guest.error && !guest.ready && <Button variant="outline" onClick={() => downloadTextFile("neocalculator-local-carts-backup.json", guest.backup(), "application/json")}>Download stored data</Button>}
      </CardHeader>
      <CardContent>
        <ScrollArea className="[&>[data-slot=scroll-area-viewport]]:max-h-80">
          <div className="space-y-2 py-1">
            {guest.lists.map(cart => <div key={cart.id} className={`rounded-lg border p-3 ${guest.selectedListId === cart.id ? "border-zinc-900 bg-zinc-50" : "bg-white"}`}>
              {editingId === cart.id ? <div className="flex flex-col gap-2">
                <Input autoFocus aria-label="Local cart name" value={rename} onChange={event => setRename(event.target.value)} onKeyDown={event => {
                  if (event.key === "Enter" && rename.trim() && guest.rename(cart.id, rename)) setEditingId(null);
                  if (event.key === "Escape") setEditingId(null);
                }} />
                <div className="flex gap-2"><Button disabled={!rename.trim() || rename.length > 300} onClick={() => { if (guest.rename(cart.id, rename)) setEditingId(null); }}>Save name</Button><Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button></div>
              </div> : <div className="flex items-center gap-2">
                <button className="min-w-0 flex-1 cursor-pointer text-left" aria-label={`Select local cart ${cart.name}`} aria-pressed={guest.selectedListId === cart.id} onClick={() => guest.select(cart.id)} disabled={!guest.ready || guest.busy}>
                  <p className="truncate text-sm font-medium">{cart.name}</p><p className="text-xs text-zinc-500">{cart.productCount} items</p>
                </button>
                <ActionMenu label={`Open local actions for ${cart.name}`} open={menuId === cart.id} onOpenChange={open => setMenuId(open ? cart.id : null)} items={[
                  { label: "Rename Cart", icon: <Pencil />, onSelect: () => { setRename(cart.name); setEditingId(cart.id); } },
                  { label: "Export to Huawei Cloud", icon: <Upload />, onSelect: () => { window.location.href = `/huawei-carts?exportLocal=${encodeURIComponent(cart.id)}`; } },
                  { label: "Export Cart JSON", icon: <Download />, onSelect: () => transfer.handleOpenStandaloneCartExport(cart) },
                  { label: "Share Cart", icon: <Share2 />, onSelect: () => { setCopyMessage(""); void guest.openShare(cart.id); }, disabled: guest.busy },
                  { label: "Duplicate Cart", icon: <Copy />, onSelect: () => guest.clone(cart.id), disabled: guest.busy },
                  { label: "Delete Cart", icon: <Trash2 />, onSelect: () => { if (window.confirm(`Delete local cart ${cart.name}?`)) guest.remove(cart.id); }, disabled: guest.busy },
                ]} />
              </div>}
            </div>)}
            {!guest.lists.length && guest.ready && <p className="text-sm text-zinc-500">Create a cart to start a quotation.</p>}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
    {importKind && <ResourceImportDialog kind={importKind} onClose={() => setImportKind(null)} onChooseFile={() => { if (file.current) { file.current.value = ""; file.current.click(); } }}>
      {importKind === "project" && <p className="mb-4 text-sm text-zinc-600">Each cart in the project will become a separate local cart. No project is created.</p>}
      <input ref={file} type="file" className="hidden" accept="application/json,.json" onChange={event => {
        const chosen = event.target.files?.[0];
        if (chosen) { setImportKind(null); void guest.importFile(chosen); }
      }} />
    </ResourceImportDialog>}
    <Dialog.Root open={!!guest.shareDialog} onOpenChange={open => { if (!open) { guest.setShareDialog(null); setCopyMessage(""); } }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-zinc-950/40" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-white p-5 text-zinc-900 shadow-xl outline-none">
          <div className="flex items-center justify-between gap-3"><Dialog.Title className="font-semibold">Share Cart</Dialog.Title><Dialog.Close render={<Button size="icon" variant="ghost" />} aria-label="Close Share Cart"><X /></Dialog.Close></div>
          <Dialog.Description className="my-3 text-sm text-zinc-600">Anyone with this link can open a copy of {guest.shareDialog?.name}. Changes to a copy do not update other carts.</Dialog.Description>
          <textarea aria-label="Cart share link" readOnly value={guest.shareDialog?.url ?? ""} className="mb-3 h-28 w-full resize-none rounded-lg border p-3 font-mono text-xs" onFocus={event => event.target.select()} />
          <Button onClick={async () => {
            try { setCopyMessage(await copyText(guest.shareDialog?.url ?? "") ? "Share link copied." : "Select and copy the link above."); }
            catch { setCopyMessage("Select and copy the link above."); }
          }}><Copy />Copy link</Button>
          {copyMessage && <p role="status" className="mt-3 text-sm">{copyMessage}</p>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </>;
}
