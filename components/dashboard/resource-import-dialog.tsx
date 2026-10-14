"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Copy, Download, RefreshCw, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { copyText, getResponseError } from "@/lib/calculator-page-helpers";
import { downloadTextFile } from "@/lib/resource-export";
import { isRecord } from "@/lib/product-input";

type Schema = { json: string; services: number; regions: number; publishedAt: string };
export function ResourceImportDialog({ kind, onClose, onChooseFile, children }: {
  kind: "cart" | "project"; onClose: () => void; onChooseFile: () => void; children: ReactNode;
}) {
  const [schema, setSchema] = useState<Schema | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const fileButton = useRef<HTMLButtonElement>(null);
  const title = kind === "cart" ? "Import Cart JSON" : "Import Project JSON";

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/cart/schema", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data: unknown = await response.json();
        if (!response.ok) throw new Error(getResponseError(data, "Unable to load the current JSON schema."));
        if (!isRecord(data) || typeof data.$schema !== "string" || !isRecord(data["x-neo"]))
          throw new Error("The server returned an invalid JSON schema.");
        const metadata = data["x-neo"];
        if (!Array.isArray(metadata.services) || !Array.isArray(metadata.regions) || typeof metadata.publishedAt !== "string")
          throw new Error("The JSON schema is missing its catalog information.");
        if (!controller.signal.aborted) setSchema({ json: JSON.stringify(data, null, 2), services: metadata.services.length, regions: metadata.regions.length, publishedAt: metadata.publishedAt });
      })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Unable to load the current JSON schema."); });
    return () => controller.abort();
  }, [refresh]);

  const reload = () => { setSchema(null); setError(""); setMessage(""); setRefresh(current => current + 1); };
  const copy = async () => {
    if (!schema) return;
    try { setMessage(await copyText(schema.json) ? "JSON schema copied to clipboard." : "Clipboard access is unavailable. Download the schema instead."); }
    catch { setMessage("Clipboard access is unavailable. Download the schema instead."); }
  };
  const download = () => {
    if (!schema) return;
    try { setMessage(downloadTextFile("neocalculator-resource-schema.json", schema.json, "application/schema+json") ? "JSON schema download started." : "Unable to start the schema download."); }
    catch { setMessage("Unable to start the schema download."); }
  };
  const date = schema ? new Date(schema.publishedAt) : null;
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-zinc-950/40" />
      <Dialog.Popup initialFocus={fileButton} className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 text-zinc-900 shadow-xl outline-none">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-zinc-500">Choose your saved or generated JSON file to import.</Dialog.Description>
          </div>
          <Dialog.Close render={<Button variant="ghost" size="icon" />} aria-label={`Close ${title}`}><X /></Dialog.Close>
        </div>
        <section className="my-5 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4" aria-label="Current JSON schema">
          <h3 className="text-sm font-medium">Generate JSON with an AI agent</h3>
          <p className="text-sm text-zinc-600">Give your agent this schema and your requirements. It explains how to discover available options and validate the generated resources. The schema follows the current published catalog.</p>
          {!schema && !error && <p role="status" className="text-sm text-zinc-500">Loading the current JSON schema…</p>}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          {schema && <p className="text-xs text-zinc-500">{schema.services} services · {schema.regions} regions{date && !Number.isNaN(date.getTime()) ? ` · Published ${date.toLocaleDateString()}` : ""}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!schema} onClick={() => void copy()}><Copy />Copy JSON schema</Button>
            <Button variant="outline" disabled={!schema} onClick={download}><Download />Download JSON schema</Button>
            <Button variant="ghost" disabled={!schema && !error} onClick={reload}><RefreshCw />{error ? "Retry schema" : "Refresh schema"}</Button>
          </div>
          {message && <p role="status" className="text-sm text-zinc-600">{message}</p>}
          {schema && <details className="text-sm">
            <summary className="cursor-pointer text-zinc-600">Preview JSON schema</summary>
            <textarea aria-label="Current resource JSON schema" readOnly spellCheck={false} value={schema.json} className="mt-2 h-52 w-full resize-none rounded-lg border bg-white p-3 font-mono text-xs outline-none" />
          </details>}
        </section>
        {children}
        <div className="flex flex-wrap justify-end gap-2">
          <Dialog.Close render={<Button variant="outline" />}>Cancel</Dialog.Close>
          <Button ref={fileButton} onClick={onChooseFile}><Upload />Choose JSON file</Button>
        </div>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}
