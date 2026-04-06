"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, useState, useRef, useEffect } from "react";
import { Search, RefreshCw, UserCircle2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useSessionContext } from "@/components/session-provider";
import { useNavbar } from "@/components/navbar-context";
import { Button } from "@/components/ui/button";

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNavbar() {
  const pathname = usePathname();
  const { session, isPending } = useSessionContext();
  const { config } = useNavbar();
  const hasMounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const showSessionUi = hasMounted && !isPending;
  const isSignedIn = !!session;

  // Cookie dropdown state (only used when config has cookie handlers)
  const [isCookieOpen, setIsCookieOpen] = useState(false);
  const [cookieDraft, setCookieDraft] = useState(() => config.cookieValue || "");
  const cookieRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (cookieRef.current && !cookieRef.current.contains(event.target as Node)) {
        setIsCookieOpen(false);
      }
    }
    if (isCookieOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isCookieOpen]);

  const isDashboard = pathname === "/";
  const isProjects = pathname === "/projects";
  const showSearch = isDashboard || isProjects;
  const showDashboardExtras = isDashboard && config.showHuaweiCarts !== false;

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto grid max-w-[1600px] grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3 lg:px-6">
        {/* Left: Branding + Nav */}
        <div className="flex items-center gap-4">
          <Link href="/" className="block shrink-0">
            <p className="text-xs font-medium tracking-[0.22em] text-zinc-500 uppercase">NeoCalculator</p>
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              href="/projects"
              className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                isActive(pathname, "/projects")
                  ? "bg-zinc-950 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
              }`}
            >
              Projects
            </Link>
            <Link
              href="/"
              className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                isActive(pathname, "/")
                  ? "bg-zinc-950 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
              }`}
            >
              Dashboard
            </Link>
          </nav>
        </div>

        {/* Center: Search */}
        {showSearch ? (
          <div className="flex justify-center">
            {isDashboard && config.onSearchClick ? (
              <button
                type="button"
                className="flex h-10 w-full max-w-md items-center justify-between rounded-full border border-zinc-200 bg-white px-4 text-left shadow-sm transition hover:border-zinc-300"
                onClick={config.onSearchClick}
                aria-label="Open service search"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Search className="size-4 text-zinc-400" />
                  <span className={`truncate text-sm ${config.searchQuery ? "text-zinc-900" : "text-zinc-500"}`}>
                    {config.searchQuery || "Search service name"}
                  </span>
                </span>
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-500">
                  Ctrl K
                </span>
              </button>
            ) : (
              <Link
                href="/"
                className="flex h-10 w-full max-w-md items-center justify-between rounded-full border border-zinc-200 bg-white px-4 text-left shadow-sm transition hover:border-zinc-300"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Search className="size-4 text-zinc-400" />
                  <span className="truncate text-sm text-zinc-500">Search service name</span>
                </span>
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-500">
                  Ctrl K
                </span>
              </Link>
            )}
          </div>
        ) : (
          <div />
        )}

        {/* Right: Docs + User Actions */}
        <div className="flex items-center justify-end gap-2">
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
              <div className="hidden text-right lg:block">
                <p className="text-sm font-medium text-zinc-900">{session.user.name || session.user.email}</p>
                <p className="text-xs text-zinc-500">{session.user.email}</p>
              </div>

              {/* Dashboard-specific buttons */}
              {showDashboardExtras && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9"
                    aria-label="Reload Huawei carts"
                    onClick={() => config.loadHuaweiCarts?.()}
                    disabled={config.huaweiCartsLoading || !config.cookieValueSaved}
                  >
                    <RefreshCw className={`size-4 ${config.huaweiCartsLoading ? "animate-spin" : ""}`} />
                  </Button>

                  <div ref={cookieRef} className="relative">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-full border border-zinc-200"
                      aria-label="Open Huawei cookie settings"
                      onClick={() => setIsCookieOpen((current) => !current)}
                    >
                      <UserCircle2 className="size-5" />
                    </Button>

                    {isCookieOpen && (
                      <div className="absolute top-full right-0 z-50 mt-3 w-[min(92vw,380px)] rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.45)]">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-zinc-950">Huawei Cloud Cookie</p>
                          <p className="text-sm text-zinc-500">
                            Paste your website cookie string. It will be saved locally in this browser.
                          </p>
                        </div>
                        <div className="mt-4 space-y-3">
                          <textarea
                            value={cookieDraft}
                            onChange={(event) => setCookieDraft(event.target.value)}
                            className="min-h-32 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-3 focus:ring-zinc-200"
                            placeholder="cookie_name=value; other_cookie=value;"
                          />
                          <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
                            <span>{config.cookieValueSaved ? "Cookie saved locally" : "No cookie saved yet"}</span>
                            <span>{cookieDraft.length} chars</span>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setCookieDraft(config.cookieValue || "");
                                setIsCookieOpen(false);
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              onClick={() => {
                                config.onCookieChange?.(cookieDraft);
                                config.onSaveCookie?.();
                                setIsCookieOpen(false);
                              }}
                            >
                              Save Cookie
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              <Button type="button" variant="outline" size="sm" onClick={() => authClient.signOut()}>
                Sign Out
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
              <Link
                href="/sign-up"
                className="rounded-full bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
              >
                Create Account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}