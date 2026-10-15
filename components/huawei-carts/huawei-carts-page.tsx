"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Cloud,
  Download,
  Loader2,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import { useSessionContext } from "../session-provider";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardHeader, CardContent, CardTitle } from "../ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  huaweiRequest,
  HuaweiRequestError,
  useHuaweiConnection,
} from "@/lib/huawei-carts/client";
import {
  GuestCartStore,
  guestCartDocument,
  type GuestCart,
} from "@/lib/guest-carts/store";
import type { AppProject, ProductMutationBody } from "@/lib/calculator-types";
import { HuaweiConnectionForm } from "./connection-form";
import { HuaweiExportDialog, type HuaweiExportSource } from "./export-dialog";
import { TransferModal } from "./transfer-modal";

type HuaweiCart = {
  key: string;
  name: string;
  updateTime: number;
  totalAmount: number | null;
};
type ImportDocument = {
  cart: { name: string; products: ProductMutationBody[] };
  preserved: number;
};
type Copy = { id: string; destination: "local" | "project"; name: string };
type Result = { key: string; name: string; copy?: Copy; error?: string };
const historyKey = "neoCalculator.huaweiImports.v1";
const copyUrl = (copy: Copy) =>
  `${copy.destination === "local" ? "/cart" : "/"}?list=${encodeURIComponent(copy.id)}`;

export function HuaweiCartsPage() {
  const { session } = useSessionContext(),
    params = useSearchParams();
  const {
    connection,
    setConnection,
    refresh,
    error: connectionError,
  } = useHuaweiConnection();
  const [switching, setSwitching] = useState(false),
    [carts, setCarts] = useState<HuaweiCart[]>([]),
    [scope, setScope] = useState("");
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [refreshed, setRefreshed] = useState("");
  const [query, setQuery] = useState(""),
    [sort, setSort] = useState("updated"),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<Set<string>>(new Set());
  const [projects, setProjects] = useState<AppProject[]>([]),
    [locals, setLocals] = useState<GuestCart[]>([]),
    [history, setHistory] = useState<Record<string, Copy>>({});
  const historyRef = useRef<Record<string, Copy>>({});
  const [importing, setImporting] = useState<HuaweiCart[] | null>(null),
    [documents, setDocuments] = useState<Record<string, ImportDocument>>({}),
    [destination, setDestination] = useState("local"),
    [importBusy, setImportBusy] = useState(false),
    [results, setResults] = useState<Result[]>([]);
  const [exportSource, setExportSource] = useState<HuaweiExportSource | null>(
      null,
    ),
    [pickExport, setPickExport] = useState(false),
    [exportQuery, setExportQuery] = useState("");
  const clearAccount = () => {
    setCarts([]);
    setSelected(new Set());
    setImporting(null);
    setDocuments({});
    setResults([]);
    setScope("");
    setRefreshed("");
  };
  const loadCarts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await huaweiRequest<{
        carts: HuaweiCart[];
        accountScope: string;
        refreshedAt: string;
      }>("transfers");
      setCarts(result.carts);
      setScope(result.accountScope);
      setRefreshed(result.refreshedAt);
      setSelected(new Set());
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to load Huawei carts.",
      );
      if (error instanceof HuaweiRequestError && error.status === 401) {
        setConnection({ connected: false });
        clearAccount();
      }
    } finally {
      setLoading(false);
    }
  }, [setConnection]);
  useEffect(() => {
    if (connection?.connected) void loadCarts();
  }, [
    connection?.connected,
    connection?.account,
    connection?.username,
    loadCarts,
  ]);
  useEffect(() => {
    try {
      const local = new GuestCartStore(window.localStorage);
      setLocals(local.load().carts);
      const saved = JSON.parse(window.localStorage.getItem(historyKey) || "{}");
      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        historyRef.current = saved;
        setHistory(saved);
      }
    } catch {
      setError(
        "Local carts or transfer history could not be loaded. Existing browser data has been kept.",
      );
    }
  }, []);
  useEffect(() => {
    if (!session) {
      setProjects([]);
      return;
    }
    void fetch("/api/projects")
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setProjects(await response.json());
      })
      .catch(() =>
        setError(
          "Unable to load Neo projects. You can still import into Local Carts.",
        ),
      );
  }, [session]);
  useEffect(() => {
    const localId = params.get("exportLocal"),
      listId = params.get("exportCart");
    if (localId) {
      const cart = locals.find((cart) => cart.id === localId);
      if (cart)
        setExportSource({
          name: cart.name,
          localId: cart.id,
          document: guestCartDocument(cart),
        });
    }
    if (listId)
      setExportSource({
        name:
          projects
            .flatMap((project) => project.lists)
            .find((cart) => cart.id === listId)?.name ?? "Neo cart",
        listId,
      });
  }, [params, locals, projects]);
  const closeExport = () => {
    setExportSource(null);
    if (params.get("exportLocal") || params.get("exportCart"))
      window.history.replaceState(null, "", "/huawei-carts");
  };
  const filtered = useMemo(
    () =>
      carts
        .filter((cart) => cart.name.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) =>
          sort === "name"
            ? a.name.localeCompare(b.name)
            : b.updateTime - a.updateTime,
        ),
    [carts, query, sort],
  );
  const shown = filtered.slice(page * 25, page * 25 + 25);
  const remember = (key: string, copy: Copy) => {
    const next = { ...historyRef.current, [`${scope}/${key}`]: copy };
    try {
      window.localStorage.setItem(historyKey, JSON.stringify(next));
    } catch {
      /* The created cart is already saved. */
    }
    historyRef.current = next;
    setHistory(next);
  };
  const review = async (items: HuaweiCart[]) => {
    setImporting(items);
    setDocuments({});
    setResults([]);
    setDestination("local");
    setImportBusy(true);
    const next: Record<string, ImportDocument> = {},
      failures: Result[] = [];
    for (const cart of items) {
      try {
        next[cart.key] = await huaweiRequest<ImportDocument>(
          `transfers?key=${encodeURIComponent(cart.key)}`,
        );
      } catch (error) {
        failures.push({
          key: cart.key,
          name: cart.name,
          error:
            error instanceof Error ? error.message : "Unable to read cart.",
        });
        if (error instanceof HuaweiRequestError && error.status === 401) {
          setConnection({ connected: false });
          break;
        }
      }
    }
    setDocuments(next);
    setResults(failures);
    setImportBusy(false);
  };
  const importSelected = async () => {
    if (!importing || importBusy) return;
    setImportBusy(true);
    const next: Result[] = [];
    for (const cart of importing) {
      if (!documents[cart.key]) {
        next.push(
          results.find((result) => result.key === cart.key) ?? {
            key: cart.key,
            name: cart.name,
            error: "Unable to read cart.",
          },
        );
        continue;
      }
      const already = results.find(
        (result) => result.key === cart.key && result.copy,
      );
      if (already) {
        next.push(already);
        continue;
      }
      try {
        let copy: Copy;
        if (destination === "local") {
          const store = new GuestCartStore(window.localStorage);
          store.load();
          const value = store.import([documents[cart.key].cart]);
          setLocals(value.carts);
          copy = {
            id: value.selectedId,
            destination: "local",
            name: cart.name,
          };
        } else {
          const result = await huaweiRequest<{ listId: string }>("transfers", {
            action: "import",
            key: cart.key,
            projectId: destination,
            connectionAccount: connection?.account,
            connectionUsername: connection?.username,
          });
          copy = { id: result.listId, destination: "project", name: cart.name };
        }
        remember(cart.key, copy);
        next.push({ key: cart.key, name: cart.name, copy });
      } catch (error) {
        next.push({
          key: cart.key,
          name: cart.name,
          error:
            error instanceof Error
              ? error.message
              : "Unable to import this cart.",
        });
      }
      setResults([...next]);
    }
    setResults(next);
    setImportBusy(false);
    if (next.length === 1 && next[0].copy)
      window.location.href = copyUrl(next[0].copy);
  };
  const retryReading = async () => {
    if (!importing || importBusy) return;
    setImportBusy(true);
    for (const cart of importing.filter((cart) => !documents[cart.key])) {
      try {
        const document = await huaweiRequest<ImportDocument>(
          `transfers?key=${encodeURIComponent(cart.key)}`,
        );
        setDocuments((current) => ({ ...current, [cart.key]: document }));
        setResults((current) =>
          current.filter((result) => result.key !== cart.key),
        );
      } catch (error) {
        setResults((current) => [
          ...current.filter((result) => result.key !== cart.key),
          {
            key: cart.key,
            name: cart.name,
            error:
              error instanceof Error
                ? error.message
                : "Unable to read this cart.",
          },
        ]);
      }
    }
    setImportBusy(false);
  };
  const exportOptions = [
    ...locals.map((cart) => ({
      id: `local/${cart.id}`,
      name: cart.name,
      location: "Local Carts",
      source: {
        name: cart.name,
        localId: cart.id,
        document: guestCartDocument(cart),
      } as HuaweiExportSource,
    })),
    ...projects.flatMap((project) =>
      project.lists.map((cart) => ({
        id: cart.id,
        name: cart.name,
        location: project.name,
        source: { name: cart.name, listId: cart.id } as HuaweiExportSource,
      })),
    ),
  ].filter((cart) =>
    `${cart.name} ${cart.location}`
      .toLowerCase()
      .includes(exportQuery.toLowerCase()),
  );
  const successes = results.filter((result) => result.copy),
    docs = Object.values(documents);
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
            <Cloud className="size-7 text-zinc-500" />
            Huawei Carts
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">
            Bring saved Huawei carts into NeoCalculator, or export a Neo cart to
            Huawei Cloud. Transfers create separate copies.
          </p>
        </div>
        <Button variant="outline" onClick={() => setPickExport(true)}>
          <Upload />
          Export a Neo cart
        </Button>
      </div>
      {!connection ? (
        <Card>
          <CardContent className="py-6 text-sm text-zinc-500" role="status">
            {connectionError || "Checking Huawei connection…"}
            {connectionError && (
              <Button variant="outline" onClick={() => void refresh()}>
                Retry
              </Button>
            )}
          </CardContent>
        </Card>
      ) : !connection.connected || switching ? (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>
              {switching ? "Switch Huawei account" : "Connect Huawei Cloud"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HuaweiConnectionForm
              onConnected={(value) => {
                clearAccount();
                setConnection(value);
                setSwitching(false);
              }}
              onCancel={switching ? () => setSwitching(false) : undefined}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3 shadow-sm">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                <span className="mr-2 inline-block size-2 rounded-full bg-emerald-500" />
                Connected as {connection.username}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {connection.account}
                {refreshed
                  ? ` · Refreshed ${new Date(refreshed).toLocaleTimeString()}`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void loadCarts()}
                disabled={loading}
              >
                <RefreshCw className={loading ? "animate-spin" : ""} />
                Refresh
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={loading}
                onClick={() => setSwitching(true)}
              >
                Switch account
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={loading}
                onClick={async () => {
                  try {
                    await huaweiRequest("connection", undefined, "DELETE");
                    clearAccount();
                    setConnection({ connected: false });
                  } catch {
                    setError("Unable to disconnect. Please try again.");
                  }
                }}
              >
                Disconnect
              </Button>
            </div>
          </div>
          <Card>
            <CardHeader className="gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>
                  Saved Huawei carts{" "}
                  <span className="ml-2 text-sm font-normal text-zinc-400">
                    {carts.length}
                  </span>
                </CardTitle>
                <Button
                  disabled={!selected.size || loading}
                  onClick={() =>
                    void review(carts.filter((cart) => selected.has(cart.key)))
                  }
                >
                  <Download />
                  Import selected{selected.size ? ` (${selected.size})` : ""}
                </Button>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="relative min-w-40 flex-1">
                  <Search className="absolute top-3 left-3 size-4 text-zinc-400" />
                  <Input
                    aria-label="Search Huawei carts"
                    placeholder="Search cart names"
                    className="pl-9"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setPage(0);
                    }}
                  />
                </div>
                <Select
                  value={sort}
                  onValueChange={(value) => {
                    setSort(value ?? "updated");
                    setPage(0);
                  }}
                >
                  <SelectTrigger
                    className="w-44"
                    aria-label="Sort Huawei carts"
                  >
                    <SelectValue>
                      {sort === "updated" ? "Newest first" : "Name A–Z"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="updated">Newest first</SelectItem>
                    <SelectItem value="name">Name A–Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loading && (
                <p
                  role="status"
                  className="mb-4 flex items-center gap-2 text-sm text-zinc-500"
                >
                  <Loader2 className="size-4 animate-spin" />
                  Loading Huawei carts…
                </p>
              )}
              {!!shown.length && (
                <label className="mb-3 flex items-center gap-2 text-xs text-zinc-500">
                  <input
                    type="checkbox"
                    aria-label="Select this page of Huawei carts"
                    checked={shown.every((cart) => selected.has(cart.key))}
                    onChange={(event) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        for (const cart of shown)
                          if (event.target.checked) next.add(cart.key);
                          else next.delete(cart.key);
                        return next;
                      })
                    }
                  />
                  Select this page
                </label>
              )}
              <div className="divide-y">
                {shown.map((cart) => {
                  const previous = history[`${scope}/${cart.key}`];
                  const existingCopy =
                    previous &&
                    (previous.destination === "local"
                      ? locals.some((local) => local.id === previous.id)
                      : projects.some((project) =>
                          project.lists.some((list) => list.id === previous.id),
                        ))
                      ? previous
                      : null;
                  return (
                    <div key={cart.key} className="flex items-start gap-3 py-4">
                      <input
                        className="mt-1.5"
                        type="checkbox"
                        aria-label={`Select ${cart.name}`}
                        checked={selected.has(cart.key)}
                        onChange={(event) =>
                          setSelected((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(cart.key);
                            else next.delete(cart.key);
                            return next;
                          })
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          title={cart.name}
                          className="line-clamp-2 break-words text-sm font-medium"
                        >
                          {cart.name}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {cart.updateTime
                            ? new Date(cart.updateTime).toLocaleDateString()
                            : "No update date"}
                          {cart.totalAmount !== null
                            ? ` · USD ${cart.totalAmount.toFixed(2)} saved estimate`
                            : ""}
                        </p>
                        {existingCopy && (
                          <Link
                            className="mt-2 inline-block text-xs font-medium text-zinc-700 underline underline-offset-4"
                            href={copyUrl(existingCopy)}
                          >
                            Open Neo copy
                          </Link>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={loading}
                        onClick={() => void review([cart])}
                      >
                        {existingCopy ? "Import another copy" : "Import"}
                      </Button>
                    </div>
                  );
                })}
              </div>
              {!shown.length && !loading && (
                <p className="py-10 text-center text-sm text-zinc-500">
                  {query
                    ? "No carts match your search."
                    : "No saved carts in this Huawei account yet."}
                </p>
              )}
              {filtered.length > 25 && (
                <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <p className="text-xs text-zinc-500">
                    Page {page + 1} of {Math.ceil(filtered.length / 25)}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={(page + 1) * 25 >= filtered.length}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {importing && (
        <TransferModal
          title="Import Huawei carts"
          description="Create Neo copies. Your original Huawei carts stay unchanged."
          onClose={() => {
            if (!importBusy) setImporting(null);
          }}
        >
          <div className="space-y-4">
            {importBusy && (
              <p
                role="status"
                className="flex items-center gap-2 text-sm text-zinc-500"
              >
                <Loader2 className="size-4 animate-spin" />
                {docs.length
                  ? `Importing ${successes.length} of ${importing.length}…`
                  : "Reading the selected carts…"}
              </p>
            )}
            {!importBusy && (
              <>
                <p className="text-sm">
                  {docs.length} carts ·{" "}
                  {docs.reduce((sum, doc) => sum + doc.cart.products.length, 0)}{" "}
                  resources
                </p>
                {docs.some((doc) => doc.preserved > 0) && (
                  <p className="rounded-xl border bg-zinc-50 p-3 text-sm text-zinc-600">
                    {docs.reduce((sum, doc) => sum + doc.preserved, 0)}{" "}
                    resources will be kept as read-only Huawei copies with their
                    saved estimates and all original options. They can be
                    exported back unchanged.
                  </p>
                )}
                {importing.some((cart) => history[`${scope}/${cart.key}`]) && (
                  <p className="text-sm text-amber-800">
                    You have imported one or more of these carts before. This
                    creates additional copies.
                  </p>
                )}
                {docs.some((doc) =>
                  doc.cart.products.some(
                    (product) => product.productType === "huawei-native",
                  ),
                ) && (
                  <p className="text-xs text-zinc-500">
                    Editable resources use Neo’s published catalog prices.
                    Preserved Huawei resources keep their saved estimates.
                  </p>
                )}
                <label className="block space-y-2 text-sm font-medium">
                  Destination
                  <Select
                    value={destination}
                    onValueChange={(value) => setDestination(value ?? "local")}
                    disabled={!!successes.length}
                  >
                    <SelectTrigger aria-label="Import destination">
                      <SelectValue>
                        {destination === "local"
                          ? "Local Carts · this browser"
                          : projects.find(
                              (project) => project.id === destination,
                            )?.name}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">
                        Local Carts · this browser
                      </SelectItem>
                      {projects
                        .filter(
                          (project) =>
                            project.accessLevel !== "list_collaborator",
                        )
                        .map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </label>
                {!session && (
                  <p className="text-xs text-zinc-500">
                    No Neo account is needed for Local Carts. Sign in to
                    NeoCalculator to choose a project.
                  </p>
                )}
              </>
            )}
            {!!results.length && (
              <div
                className="max-h-48 space-y-2 overflow-auto"
                aria-live="polite"
              >
                {results.map((result) => (
                  <div
                    key={result.key}
                    className={`rounded-lg border p-3 text-sm ${result.error ? "border-red-200 text-red-700" : "text-emerald-700"}`}
                  >
                    <p className="font-medium break-words">{result.name}</p>
                    {result.copy ? (
                      <Link className="underline" href={copyUrl(result.copy)}>
                        Open Neo cart
                      </Link>
                    ) : (
                      <p>{result.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                disabled={importBusy}
                onClick={() => setImporting(null)}
              >
                {successes.length ? "Done" : "Cancel"}
              </Button>
              {importing.some((cart) => !documents[cart.key]) && (
                <Button
                  variant="outline"
                  disabled={importBusy}
                  onClick={() => void retryReading()}
                >
                  Retry loading failed carts
                </Button>
              )}
              {successes.length < docs.length && (
                <Button
                  disabled={importBusy || !docs.length}
                  onClick={() => void importSelected()}
                >
                  {successes.length
                    ? "Retry failed imports"
                    : "Import to NeoCalculator"}
                </Button>
              )}
            </div>
          </div>
        </TransferModal>
      )}
      {pickExport && (
        <TransferModal
          title="Choose a Neo cart"
          description="Choose a local cart or a cart from one of your Neo projects."
          onClose={() => setPickExport(false)}
        >
          <div className="space-y-3">
            <Input
              aria-label="Search Neo carts to export"
              placeholder="Search carts or projects"
              value={exportQuery}
              onChange={(event) => setExportQuery(event.target.value)}
            />
            <div className="max-h-80 space-y-1 overflow-auto">
              {exportOptions.map((cart) => (
                <button
                  key={cart.id}
                  className="w-full rounded-xl border p-3 text-left hover:bg-zinc-50"
                  onClick={() => {
                    setPickExport(false);
                    setExportSource(cart.source);
                  }}
                >
                  <p
                    title={cart.name}
                    className="line-clamp-2 break-words text-sm font-medium"
                  >
                    {cart.name}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">{cart.location}</p>
                </button>
              ))}
              {!exportOptions.length && (
                <p className="py-4 text-sm text-zinc-500">
                  No matching Neo carts.{" "}
                  <Link className="underline" href="/cart">
                    Create a local cart
                  </Link>{" "}
                  to start.
                </p>
              )}
            </div>
          </div>
        </TransferModal>
      )}
      {exportSource && (
        <HuaweiExportDialog
          source={exportSource}
          onClose={closeExport}
          onExported={() => {
            if (connection?.connected) void loadCarts();
            else void refresh();
          }}
        />
      )}
    </main>
  );
}
