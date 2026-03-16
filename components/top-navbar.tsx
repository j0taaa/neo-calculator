"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNavbar() {
  const pathname = usePathname();

  if (pathname === "/") {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto grid max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center px-4 py-3 lg:px-6">
        <div className="justify-self-start">
          <p className="text-xs font-medium tracking-[0.22em] text-zinc-500 uppercase">NeoCalculator</p>
          <p className="text-sm text-zinc-600">Calculator, carts, and projects.</p>
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
        <div aria-hidden="true" />
      </div>
    </header>
  );
}
