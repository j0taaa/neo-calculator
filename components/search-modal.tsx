"use client";

import { useCallback, useId, useRef, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ServiceEntry {
  code: string;
  name: string;
  category: string;
}

interface SearchModalProps {
  query: string;
  isOpen: boolean;
  suggestions: ServiceEntry[];
  activeSuggestionIndex: number;
  onQueryChange: (query: string) => void;
  onSelect: (serviceName: string) => void;
  onClose: () => void;
  onOpen: () => void;
  onSuggestionIndexChange: (index: number | ((prev: number) => number)) => void;
}

export function SearchModal({
  query,
  isOpen,
  suggestions,
  activeSuggestionIndex,
  onQueryChange,
  onSelect,
  onClose,
  onOpen,
  onSuggestionIndexChange,
}: SearchModalProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const hasSuggestions = isOpen && suggestions.length > 0;
  const activeDescendant = hasSuggestions && suggestions[activeSuggestionIndex]
    ? `${listboxId}-${activeSuggestionIndex}`
    : undefined;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown") {
        if (suggestions.length === 0) return;
        event.preventDefault();
        onOpen();
        onSuggestionIndexChange((current) => (current + 1) % suggestions.length);
      }

      if (event.key === "ArrowUp") {
        if (suggestions.length === 0) return;
        event.preventDefault();
        onOpen();
        onSuggestionIndexChange((current) => (current - 1 + suggestions.length) % suggestions.length);
      }

      if (event.key === "Enter" && suggestions[activeSuggestionIndex]) {
        event.preventDefault();
        onSelect(suggestions[activeSuggestionIndex].name);
      }

      if (event.key === "Escape") {
        onClose();
      }
    },
    [suggestions, activeSuggestionIndex, onOpen, onSuggestionIndexChange, onSelect, onClose]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-zinc-950/10 px-4 py-6 backdrop-blur-sm lg:px-6">
      <div className="mx-auto flex w-full max-w-[1680px] justify-center">
        <div className="relative z-40 w-full max-w-3xl">
          <label htmlFor="service-search" className="sr-only">
            Search services
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-5 z-10 h-5 w-5 -translate-y-1/2 text-zinc-400" />
          <Input
            id="service-search"
            ref={searchInputRef}
            value={query}
            onFocus={onOpen}
            onChange={(event) => {
              onQueryChange(event.target.value);
              onSuggestionIndexChange(0);
            }}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={hasSuggestions}
            aria-activedescendant={activeDescendant}
            className="h-16 rounded-full border-zinc-200 bg-white pr-26 pl-14 text-base shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)]"
            placeholder="Search service name"
          />
          <div className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-500">
            Ctrl K
          </div>
          {hasSuggestions && (
            <div className="mt-2 max-h-80 overflow-auto rounded-2xl border border-zinc-200 bg-white shadow-[0_28px_80px_-40px_rgba(15,23,42,0.45)]">
              <ul id={listboxId} role="listbox">
                {suggestions.map((suggestion, index) => (
                  <li
                    key={suggestion.code}
                    id={`${listboxId}-${index}`}
                    role="option"
                    aria-selected={index === activeSuggestionIndex}
                    className={`flex cursor-pointer items-center justify-between px-4 py-3 transition ${
                      index === activeSuggestionIndex ? "bg-zinc-100" : "hover:bg-zinc-50"
                    }`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onSelect(suggestion.name)}
                  >
                    <span className="text-sm font-medium text-zinc-900">{suggestion.name}</span>
                    <span className="text-xs text-zinc-500">{suggestion.category}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}