"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, useState, useRef, useEffect } from "react";
import { Key, RefreshCw, Copy, Check, Settings, Download, Loader2, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useSessionContext } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface ApiKeyData {
  id: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export function TopNavbar() {
  useEffect(() => { try { window.localStorage.removeItem("neoCalculator.huaweiCookie"); } catch { /* Storage can be unavailable in private browsers. */ } }, []);
  const pathname = usePathname();
  const { session, isPending } = useSessionContext();
  const hasMounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const showSessionUi = hasMounted && !isPending;
  const isSignedIn = !!session;

  // Settings dropdown state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"apikey" | "export">("apikey");
  const settingsRef = useRef<HTMLDivElement>(null);

  // API key state
  const [apiKey, setApiKey] = useState<ApiKeyData | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Export state
  const [selectedRegions, setSelectedRegions] = useState<Set<HuaweiRegionKey>>(new Set(["la-sao-paulo1"]));
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const fetchApiKey = async () => {
    setApiKeyLoading(true);
    try {
      const response = await fetch("/api/api-keys");
      if (response.ok) {
        const data = await response.json();
        setApiKey(data.key || null);
      }
    } catch (error) {
      console.error("Failed to fetch API key:", error);
    } finally {
      setApiKeyLoading(false);
    }
  };

  const generateApiKey = async () => {
    setApiKeyLoading(true);
    setNewKey(null);
    try {
      const response = await fetch("/api/api-keys", { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        setNewKey(data.key);
        setApiKey({
          id: data.id,
          createdAt: data.createdAt,
          lastUsedAt: null,
        });
      }
    } catch (error) {
      console.error("Failed to generate API key:", error);
    } finally {
      setApiKeyLoading(false);
    }
  };

  const revokeApiKey = async () => {
    if (!confirm("Are you sure you want to revoke your API key? This cannot be undone.")) {
      return;
    }
    setApiKeyLoading(true);
    try {
      const response = await fetch("/api/api-keys", { method: "DELETE" });
      if (response.ok) {
        setApiKey(null);
        setNewKey(null);
      }
    } catch (error) {
      console.error("Failed to revoke API key:", error);
    } finally {
      setApiKeyLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleRegion = (region: HuaweiRegionKey) => {
    setSelectedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(region)) {
        next.delete(region);
      } else {
        next.add(region);
      }
      return next;
    });
  };

  const handleExportCatalog = async () => {
    if (selectedRegions.size === 0) {
      setExportError("Please select at least one region");
      return;
    }

    setExportLoading(true);
    setExportError(null);

    try {
      const regionsParam = Array.from(selectedRegions).join(",");
      const response = await fetch(`/api/catalog/full-export?regions=${encodeURIComponent(regionsParam)}`);

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || "Failed to fetch catalog data");
      }

      const data = await response.json();

      // Dynamically import the Excel generation function
      const { downloadFullCatalogExcel } = await import("@/lib/resource-export");
      await downloadFullCatalogExcel(data);

      setIsSettingsOpen(false);
    } catch (error) {
      console.error("Export failed:", error);
      setExportError(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExportLoading(false);
    }
  };

  // Load API key when settings opens
  useEffect(() => {
    if (isSettingsOpen && isSignedIn) {
      fetchApiKey();
    }
  }, [isSettingsOpen, isSignedIn]);

  // Handle click outside settings
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    }
    if (isSettingsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSettingsOpen]);

  if (pathname === "/sync-lab") return null;

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto grid max-w-[1808px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-3 py-2.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-4 lg:px-6">
        <Link href="/" className="min-w-0 text-[10px] font-medium tracking-[0.14em] text-zinc-500 uppercase min-[360px]:text-xs min-[360px]:tracking-[0.22em]">NeoCalculator</Link>
        <nav aria-label="Main navigation" className="order-3 col-span-2 flex min-w-0 flex-wrap items-center gap-1 sm:order-none sm:col-span-1">
          {[{ href: "/", label: "Calculator" }, { href: "/projects", label: "Projects" }, { href: "/huawei-carts", label: "Huawei Carts" }].map(({ href, label }) => (
            <Link key={href} href={href} aria-current={isActive(pathname, href) || (href === "/" && pathname === "/cart") ? "page" : undefined}
              className={`rounded-full px-2 py-1.5 text-[11px] font-medium transition min-[360px]:px-2.5 min-[360px]:text-xs sm:py-2 sm:text-sm ${isActive(pathname, href) || (href === "/" && pathname === "/cart") ? "bg-zinc-950 text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"}`}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center justify-end gap-1 xl:gap-2">
          <Link
            href="/docs"
            className="rounded-full px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
          >
            Docs
          </Link>

          {!showSessionUi ? (
            <div className="h-9 w-32" aria-hidden="true" />
          ) : isSignedIn ? (
            <>
              {/* User Info */}
              <div className="hidden max-w-40 truncate text-right 2xl:block">
                <p className="truncate text-sm font-medium text-zinc-900">{session.user.name || session.user.email}</p>
              </div>

              {/* Settings Dropdown */}
              <div ref={settingsRef} className="relative">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-full border border-zinc-200"
                  aria-label="Open settings"
                  onClick={() => setIsSettingsOpen((current) => !current)}
                >
                  <Settings className="size-4" />
                </Button>

                {isSettingsOpen && (
                  <div className="fixed inset-x-3 top-20 z-50 mt-3 max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-[0_28px_80px_-40px_rgba(15,23,42,0.45)] sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:w-[min(92vw,420px)]">
                    {/* Tabs */}
                    <div className="flex border-b border-zinc-100">

                      <button
                        type="button"
                        onClick={() => setSettingsTab("apikey")}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition ${
                          settingsTab === "apikey"
                            ? "border-b-2 border-zinc-900 text-zinc-900"
                            : "text-zinc-500 hover:text-zinc-700"
                        }`}
                      >
                        API Key
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettingsTab("export")}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition ${
                          settingsTab === "export"
                            ? "border-b-2 border-zinc-900 text-zinc-900"
                            : "text-zinc-500 hover:text-zinc-700"
                        }`}
                      >
                        Export
                      </button>
                    </div>

                    {/* Tab Content */}
                    <div className="p-4">

                      {settingsTab === "apikey" && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <Key className="size-4 text-zinc-500" />
                            <p className="text-sm font-semibold text-zinc-950">API Key</p>
                          </div>
                          <p className="text-xs text-zinc-500">
                            Use your API key to access NeoCalculator programmatically via the API.
                          </p>

                          {apiKeyLoading ? (
                            <div className="flex items-center justify-center py-4">
                              <RefreshCw className="size-4 animate-spin text-zinc-400" />
                            </div>
                          ) : newKey ? (
                            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                              <p className="text-xs font-medium text-amber-800">
                                Save this key now! It won&apos;t be shown again.
                              </p>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 rounded bg-white px-2 py-1 font-mono text-xs text-zinc-900 break-all">
                                  {newKey}
                                </code>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="size-7 shrink-0"
                                  onClick={() => copyToClipboard(newKey)}
                                >
                                  {copied ? <Check className="size-3 text-green-600" /> : <Copy className="size-3" />}
                                </Button>
                              </div>
                              {copied && <p className="text-xs text-green-600">Copied to clipboard!</p>}
                            </div>
                          ) : apiKey ? (
                            <div className="space-y-3">
                              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                                <div className="space-y-1">
                                  <p className="text-xs text-zinc-500">Key ID</p>
                                  <p className="font-mono text-sm text-zinc-900">{apiKey.id}</p>
                                </div>
                                <div className="mt-2 flex items-center gap-4 text-xs text-zinc-500">
                                  <span>Created: {new Date(apiKey.createdAt).toLocaleDateString()}</span>
                                  {apiKey.lastUsedAt && (
                                    <span>Last used: {new Date(apiKey.lastUsedAt).toLocaleDateString()}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={generateApiKey}
                                  disabled={apiKeyLoading}
                                >
                                  <RefreshCw className="mr-1 size-3" />
                                  Regenerate
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={revokeApiKey}
                                  disabled={apiKeyLoading}
                                  className="text-red-600 hover:bg-red-50"
                                >
                                  Revoke
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button type="button" onClick={generateApiKey} disabled={apiKeyLoading}>
                              <Key className="mr-2 size-4" />
                              Generate API Key
                            </Button>
                          )}

                          <div className="border-t border-zinc-100 pt-3">
                            <p className="text-xs text-zinc-500">
                              Use the key in the <code className="rounded bg-zinc-100 px-1">X-API-Key</code> header
                              when making requests to private API endpoints.
                            </p>
                          </div>
                        </div>
                      )}

                      {settingsTab === "export" && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <Download className="size-4 text-zinc-500" />
                            <p className="text-sm font-semibold text-zinc-950">Download Price Catalog</p>
                          </div>
                          <p className="text-xs text-zinc-500">
                            Export the complete Huawei Cloud pricing catalog as an Excel file.
                            One sheet per service with pricing for each region.
                          </p>

                          <div className="space-y-2">
                            <p className="text-xs font-medium text-zinc-700">Select Regions:</p>
                            <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-200 p-2">
                              {Object.entries(huaweiRegions).map(([key, region]) => (
                                <label
                                  key={key}
                                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-50"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedRegions.has(key as HuaweiRegionKey)}
                                    onChange={() => toggleRegion(key as HuaweiRegionKey)}
                                    className="size-3.5 rounded border-zinc-300"
                                  />
                                  <span className="text-xs text-zinc-700">{region.short}</span>
                                </label>
                              ))}
                            </div>
                            <p className="text-xs text-zinc-500">
                              {selectedRegions.size} region{selectedRegions.size !== 1 ? "s" : ""} selected
                            </p>
                          </div>

                          {exportError && (
                            <div className="rounded-lg border border-red-200 bg-red-50 p-2">
                              <p className="text-xs text-red-600">{exportError}</p>
                            </div>
                          )}

                          <Button
                            type="button"
                            onClick={handleExportCatalog}
                            disabled={exportLoading || selectedRegions.size === 0}
                            className="w-full"
                          >
                            {exportLoading ? (
                              <>
                                <Loader2 className="mr-2 size-4 animate-spin" />
                                Generating Excel...
                              </>
                            ) : (
                              <>
                                <Download className="mr-2 size-4" />
                                Download Catalog
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <Button type="button" variant="ghost" size="sm" aria-label="Sign Out" onClick={() => authClient.signOut()}>
                <LogOut className="size-4 min-[360px]:hidden" /><span className="hidden min-[360px]:inline">Sign Out</span>
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="rounded-full px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
              >
                Sign In
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
