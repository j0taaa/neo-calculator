"use client";
import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { TransferModal } from "./transfer-modal";
import { GuestCartStore, guestCartDocument } from "@/lib/guest-carts/store";
import { canonical } from "@/lib/huawei-carts/value";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { HuaweiConnectionForm } from "./connection-form";
import {
  huaweiRequest,
  HuaweiRequestError,
  useHuaweiConnection,
} from "@/lib/huawei-carts/client";

export type HuaweiExportSource = { name: string } & (
  | { listId: string; document?: never }
  | { document: unknown; listId?: never; localId?: string }
);
type Cart = { key: string; name: string };
type Preview = {
  name: string;
  productCount: number;
  preserved: number;
  total: number;
  existing: { name: string; productCount: number } | null;
  confirmation: unknown;
};
export function HuaweiExportDialog({
  source,
  onClose,
  onExported,
}: {
  source: HuaweiExportSource;
  onClose: () => void;
  onExported?: () => void;
}) {
  const {
    connection,
    setConnection,
    error: connectionError,
    refresh,
  } = useHuaweiConnection();
  const [carts, setCarts] = useState<Cart[]>([]),
    [key, setKey] = useState(""),
    [query, setQuery] = useState("");
  const [replace, setReplace] = useState(false),
    [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  const [exportName, setExportName] = useState(source.name.slice(0, 50));
  useEffect(() => {
    if (connection?.connected && replace)
      void huaweiRequest<{ carts: Cart[] }>("transfers")
        .then((result) => setCarts(result.carts))
        .catch((error) => {
          setError(error.message);
          if (error instanceof HuaweiRequestError && error.status === 401)
            setConnection({ connected: false });
        });
  }, [connection?.connected, replace, setConnection]);
  const act = async () => {
    setBusy(true);
    setError("");
    try {
      if ("localId" in source && source.localId) {
        const store = new GuestCartStore(window.localStorage);
        const latest = store
          .load()
          .carts.find((cart) => cart.id === source.localId);
        if (
          !latest ||
          canonical(guestCartDocument(latest)) !== canonical(source.document)
        )
          throw new Error(
            "This local cart changed in another tab. Reload Huawei Carts and review it again.",
          );
      }
      const body = {
        ...source,
        exportName,
        connectionAccount: connection?.account,
        connectionUsername: connection?.username,
        key: replace ? key : undefined,
      };
      if (!preview)
        setPreview(
          await huaweiRequest("transfers", { ...body, action: "preview" }),
        );
      else {
        await huaweiRequest("transfers", {
          ...body,
          action: "export",
          confirmation: preview.confirmation,
        });
        setDone(true);
        onExported?.();
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to export cart.",
      );
      if (error instanceof HuaweiRequestError && error.status === 401) {
        setConnection({ connected: false });
        setPreview(null);
      } else if (error instanceof HuaweiRequestError && error.status === 409)
        setPreview(null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <TransferModal
      title="Export to Huawei Cloud"
      description="Transfer a copy. Later edits in Neo and Huawei stay separate."
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      {!connection ? (
        <div role="status" className="text-sm text-zinc-500">
          {connectionError || "Checking Huawei connection…"}
          {connectionError && (
            <Button variant="outline" onClick={() => void refresh()}>
              Retry
            </Button>
          )}
        </div>
      ) : !connection.connected ? (
        <HuaweiConnectionForm onConnected={setConnection} />
      ) : done ? (
        <div className="space-y-4">
          <p role="status" className="text-sm text-emerald-700">
            {source.name} was exported to Huawei Cloud.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                window.location.href = "/huawei-carts";
              }}
            >
              View Huawei Carts
            </Button>
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-zinc-500">
            Connected as {connection.username} · {connection.account}
          </p>
          {!preview ? (
            <>
              <p className="text-sm font-medium">{source.name}</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={!replace}
                    disabled={busy}
                    onChange={() => {
                      setReplace(false);
                      setKey("");
                      setExportName(source.name.slice(0, 50));
                    }}
                  />
                  Create a new Huawei cart
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={replace}
                    disabled={busy}
                    onChange={() => setReplace(true)}
                  />
                  Replace an existing Huawei cart
                </label>
              </div>
              {replace && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute top-3 left-3 size-4 text-zinc-400" />
                    <Input
                      aria-label="Search destination Huawei carts"
                      className="pl-9"
                      placeholder="Search Huawei carts"
                      value={query}
                      disabled={busy}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </div>
                  <div
                    className="max-h-56 space-y-1 overflow-y-auto rounded-xl border p-2"
                    role="radiogroup"
                    aria-label="Huawei destination"
                  >
                    {carts
                      .filter((cart) =>
                        cart.name.toLowerCase().includes(query.toLowerCase()),
                      )
                      .map((cart) => (
                        <label
                          key={cart.key}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg p-2 text-sm ${key === cart.key ? "bg-zinc-100" : "hover:bg-zinc-50"}`}
                        >
                          <input
                            type="radio"
                            name="huawei-destination"
                            checked={key === cart.key}
                            disabled={busy}
                            onChange={() => {
                              setKey(cart.key);
                              setExportName(cart.name.slice(0, 50));
                            }}
                          />
                          <span className="min-w-0 break-words">
                            {cart.name}
                          </span>
                        </label>
                      ))}
                    {!carts.length && (
                      <p className="p-2 text-sm text-zinc-500">
                        No Huawei carts available.
                      </p>
                    )}
                  </div>
                </div>
              )}
              <label className="block space-y-1.5 text-sm font-medium">
                Name in Huawei Cloud
                <Input
                  value={exportName}
                  onChange={(event) => setExportName(event.target.value)}
                  maxLength={50}
                  disabled={busy}
                />
                <span className="text-xs font-normal text-zinc-500">
                  Huawei cart names allow up to 50 characters.
                </span>
              </label>
            </>
          ) : (
            <div className="space-y-3 rounded-xl border bg-zinc-50 p-4">
              <p className="font-medium">
                {preview.existing
                  ? `Replace “${preview.existing.name}”`
                  : `Create “${preview.name}”`}
              </p>
              <p className="text-sm">
                {preview.productCount} resources · USD{" "}
                {preview.total.toFixed(6)}
              </p>
              {preview.existing && (
                <p className="text-sm text-amber-800">
                  This replaces all {preview.existing.productCount} resources in
                  the Huawei cart with this Neo copy.
                </p>
              )}
              {preview.preserved > 0 && (
                <p className="text-sm text-zinc-600">
                  {preview.preserved} preserved Huawei resources will be copied
                  unchanged with their saved estimates.
                </p>
              )}
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => (preview ? setPreview(null) : onClose())}
            >
              {preview ? "Back" : "Cancel"}
            </Button>
            <Button
              disabled={busy || !exportName.trim() || (replace && !key)}
              onClick={() => void act()}
            >
              {busy && <Loader2 className="animate-spin" />}
              {busy
                ? "Please wait…"
                : !preview
                  ? "Review export"
                  : preview.existing
                    ? "Replace Huawei cart"
                    : "Create Huawei cart"}
            </Button>
          </div>
        </div>
      )}
    </TransferModal>
  );
}
