"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { authClient } from "@/lib/auth-client";
import { useSessionContext } from "@/components/session-provider";

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNavbar() {
  const pathname = usePathname();
  const { session, isPending } = useSessionContext();
  const hasMounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const showSessionUi = hasMounted && !isPending;

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto grid max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center px-4 py-3 lg:px-6">
        <div className="justify-self-start">
          <Link href="/" className="block">
            <p className="text-xs font-medium tracking-[0.22em] text-zinc-500 uppercase">NeoCalculator</p>
          </Link>
        </div>
        <nav className="justify-self-center flex items-center gap-2">
          <Link
            href="/projects"
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              isActive(pathname, "/projects")
                ? "bg-zinc-950 text-white"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
            }`}
          >
            Projects
          </Link>
          <Link
            href="/"
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              isActive(pathname, "/")
                ? "bg-zinc-950 text-white"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
            }`}
          >
            Dashboard
          </Link>
        </nav>
        <div className="justify-self-end flex items-center gap-2">
          <Link
            href="/docs"
            className="rounded-full px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
          >
            Docs
          </Link>
          {!showSessionUi ? (
            <div className="h-9 w-52" aria-hidden="true" />
          ) : session ? (
            <button
              onClick={() => authClient.signOut()}
              className="rounded-full px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
            >
              Sign Out
            </button>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="rounded-full px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
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
