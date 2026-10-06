"use client";

import { Input } from "@/components/ui/input";
import type { DashboardModel } from "@/lib/dashboard/use-dashboard";
import { Search, X } from "lucide-react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export function ServiceSearch({
  isSearchOpen,
  searchAreaRef,
  searchInputRef,
  query,
  setIsSearchOpen,
  setQuery,
  setActiveSuggestionIndex,
  suggestions,
  activeSuggestionIndex,
  handleSelectService,
  listboxId,
  hasSuggestions,
  activeDescendant,
  normalizedQuery,
}: DashboardModel["serviceSearch"]) {
  return (
    <Dialog.Root open={isSearchOpen} onOpenChange={setIsSearchOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-zinc-950/10 backdrop-blur-sm" />
        <Dialog.Popup aria-label="Choose service" initialFocus={searchInputRef}
          finalFocus={() => document.querySelector<HTMLElement>('[aria-label="Service"]')}
          className="fixed top-6 left-1/2 z-[61] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 outline-none">
            <div ref={searchAreaRef} className="relative z-40 w-full max-w-3xl">
              <label htmlFor="service-search" className="sr-only">
                Search services
              </label>
              <Search className="pointer-events-none absolute top-1/2 left-5 z-10 h-5 w-5 -translate-y-1/2 text-zinc-400" />
              <Input
                id="service-search"
                ref={searchInputRef}
                value={query}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setIsSearchOpen(true);
                  setActiveSuggestionIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    if (suggestions.length === 0) {
                      return;
                    }

                    event.preventDefault();
                    setIsSearchOpen(true);
                    setActiveSuggestionIndex(
                      (current) => (current + 1) % suggestions.length,
                    );
                  }

                  if (event.key === "ArrowUp") {
                    if (suggestions.length === 0) {
                      return;
                    }

                    event.preventDefault();
                    setIsSearchOpen(true);
                    setActiveSuggestionIndex(
                      (current) =>
                        (current - 1 + suggestions.length) % suggestions.length,
                    );
                  }

                  if (
                    event.key === "Enter" &&
                    suggestions[activeSuggestionIndex]
                  ) {
                    event.preventDefault();
                    handleSelectService(
                      suggestions[activeSuggestionIndex].name,
                    );
                  }

                  if (event.key === "Escape") {
                    setIsSearchOpen(false);
                  }
                }}
                role="combobox"
                aria-autocomplete="list"
                aria-controls={listboxId}
                aria-expanded={hasSuggestions}
                aria-activedescendant={activeDescendant}
                className="h-14 rounded-full border-zinc-200 bg-white pr-12 pl-14 text-base shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)]"
                placeholder="Search by service name or code"
              />
              <Button variant="ghost" size="icon" aria-label="Close service search" onClick={() => setIsSearchOpen(false)}
                className="absolute top-2 right-2 rounded-full"><X className="size-4" /></Button>

              {suggestions.length > 0 ? (
                  <div
                    id={listboxId}
                    role="listbox"
                    className="absolute top-full right-0 left-0 z-50 mt-3 max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-[28px] border border-zinc-200 bg-white shadow-[0_28px_80px_-40px_rgba(15,23,42,0.45)]"
                  >
                    <div className="border-b border-zinc-100 px-5 py-3 text-xs font-medium tracking-[0.18em] text-zinc-500 uppercase">
                      {normalizedQuery ? "Matching services" : "Popular services"}
                    </div>
                    <div className="p-2">
                      {suggestions.map((service, index) => (
                        <button
                          key={service.name}
                          id={`${listboxId}-${index}`}
                          type="button"
                          role="option"
                          data-value={service.code}
                          aria-selected={index === activeSuggestionIndex}
                          className={`flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left transition ${
                            index === activeSuggestionIndex
                              ? "bg-zinc-950 text-white"
                              : "text-zinc-900 hover:bg-zinc-100"
                          }`}
                          onMouseEnter={() => setActiveSuggestionIndex(index)}
                          onClick={() => handleSelectService(service.name)}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <Image
                              src={service.icon}
                              alt=""
                              width={36}
                              height={36}
                              className="size-9 shrink-0 rounded-md object-contain"
                            />
                            <div className="min-w-0">
                              <p className="break-words font-medium">{service.name}</p>
                              <p
                                className={`text-sm ${
                                  index === activeSuggestionIndex
                                    ? "text-zinc-300"
                                    : "text-zinc-500"
                                }`}
                              >
                                {service.code}
                              </p>
                            </div>
                          </div>
                          <div className="hidden shrink-0 items-center gap-2 sm:flex">
                            <p
                              className={`rounded-full px-2 py-1 text-xs font-medium ${
                                index === activeSuggestionIndex
                                  ? "bg-white/10 text-zinc-200"
                                  : "bg-zinc-100 text-zinc-500"
                              }`}
                            >
                              {service.code}
                            </p>
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${
                                index === activeSuggestionIndex
                                  ? "bg-white/10 text-zinc-200"
                                  : "bg-zinc-100 text-zinc-500"
                              }`}
                            >
                              Enter
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="absolute top-full right-0 left-0 z-50 mt-3 rounded-[28px] border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-500 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.45)]">
                    No services matched your search.
                  </div>
                )}
            </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
