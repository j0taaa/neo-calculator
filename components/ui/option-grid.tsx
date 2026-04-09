"use client";

import { useMemo } from "react";

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getAccentHue(name: string): number {
  const hash = hashString(name);
  return hash % 24;
}

const HUE_MAP: Record<number, { bg: string; bgHover: string; bgSelected: string; textSelected: string; borderSelected: string }> = {
  0:  { bg: "bg-blue-50",        bgHover: "hover:bg-blue-100",        bgSelected: "bg-blue-600",        textSelected: "text-white", borderSelected: "border-blue-600" },
  1:  { bg: "bg-violet-50",      bgHover: "hover:bg-violet-100",      bgSelected: "bg-violet-600",      textSelected: "text-white", borderSelected: "border-violet-600" },
  2:  { bg: "bg-fuchsia-50",     bgHover: "hover:bg-fuchsia-100",     bgSelected: "bg-fuchsia-600",     textSelected: "text-white", borderSelected: "border-fuchsia-600" },
  3:  { bg: "bg-pink-50",        bgHover: "hover:bg-pink-100",        bgSelected: "bg-pink-600",        textSelected: "text-white", borderSelected: "border-pink-600" },
  4:  { bg: "bg-rose-50",        bgHover: "hover:bg-rose-100",        bgSelected: "bg-rose-600",        textSelected: "text-white", borderSelected: "border-rose-600" },
  5:  { bg: "bg-orange-50",      bgHover: "hover:bg-orange-100",      bgSelected: "bg-orange-600",      textSelected: "text-white", borderSelected: "border-orange-600" },
  6:  { bg: "bg-amber-50",       bgHover: "hover:bg-amber-100",       bgSelected: "bg-amber-600",       textSelected: "text-white", borderSelected: "border-amber-600" },
  7:  { bg: "bg-yellow-50",      bgHover: "hover:bg-yellow-100",      bgSelected: "bg-yellow-600",      textSelected: "text-white", borderSelected: "border-yellow-600" },
  8:  { bg: "bg-lime-50",        bgHover: "hover:bg-lime-100",        bgSelected: "bg-lime-600",        textSelected: "text-white", borderSelected: "border-lime-600" },
  9:  { bg: "bg-green-50",       bgHover: "hover:bg-green-100",       bgSelected: "bg-green-600",       textSelected: "text-white", borderSelected: "border-green-600" },
  10: { bg: "bg-emerald-50",     bgHover: "hover:bg-emerald-100",     bgSelected: "bg-emerald-600",     textSelected: "text-white", borderSelected: "border-emerald-600" },
  11: { bg: "bg-teal-50",        bgHover: "hover:bg-teal-100",        bgSelected: "bg-teal-600",        textSelected: "text-white", borderSelected: "border-teal-600" },
  12: { bg: "bg-cyan-50",        bgHover: "hover:bg-cyan-100",        bgSelected: "bg-cyan-600",        textSelected: "text-white", borderSelected: "border-cyan-600" },
  13: { bg: "bg-sky-50",         bgHover: "hover:bg-sky-100",         bgSelected: "bg-sky-600",         textSelected: "text-white", borderSelected: "border-sky-600" },
  14: { bg: "bg-indigo-50",      bgHover: "hover:bg-indigo-100",      bgSelected: "bg-indigo-600",      textSelected: "text-white", borderSelected: "border-indigo-600" },
  15: { bg: "bg-purple-50",      bgHover: "hover:bg-purple-100",      bgSelected: "bg-purple-600",      textSelected: "text-white", borderSelected: "border-purple-600" },
  16: { bg: "bg-stone-50",       bgHover: "hover:bg-stone-100",       bgSelected: "bg-stone-700",       textSelected: "text-white", borderSelected: "border-stone-700" },
  17: { bg: "bg-zinc-50",        bgHover: "hover:bg-zinc-100",        bgSelected: "bg-zinc-800",        textSelected: "text-white", borderSelected: "border-zinc-800" },
  18: { bg: "bg-slate-50",       bgHover: "hover:bg-slate-100",       bgSelected: "bg-slate-700",       textSelected: "text-white", borderSelected: "border-slate-700" },
  19: { bg: "bg-gray-50",        bgHover: "hover:bg-gray-100",        bgSelected: "bg-gray-700",        textSelected: "text-white", borderSelected: "border-gray-700" },
  20: { bg: "bg-red-50",         bgHover: "hover:bg-red-100",         bgSelected: "bg-red-700",         textSelected: "text-white", borderSelected: "border-red-700" },
  21: { bg: "bg-sky-50",         bgHover: "hover:bg-sky-100",         bgSelected: "bg-sky-700",         textSelected: "text-white", borderSelected: "border-sky-700" },
  22: { bg: "bg-teal-50",        bgHover: "hover:bg-teal-100",        bgSelected: "bg-teal-700",        textSelected: "text-white", borderSelected: "border-teal-700" },
  23: { bg: "bg-orange-50",      bgHover: "hover:bg-orange-100",      bgSelected: "bg-orange-700",      textSelected: "text-white", borderSelected: "border-orange-700" },
};

type OptionGridItem = {
  value: string;
  label: string;
};

type OptionGridProps = {
  items: OptionGridItem[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  cols?: 2 | 3 | 4;
  name: string;
};

export function OptionGrid({ items, value, onChange, disabled, cols, name }: OptionGridProps) {
  const color = useMemo(() => HUE_MAP[getAccentHue(name)], [name]);

  const minWClass = cols === 4
    ? "min-w-20"
    : cols === 3
      ? "min-w-24"
      : "min-w-28";

  return (
    <div data-option-grid className={`flex flex-wrap gap-2`}>
      {items.map((item) => {
        const isSelected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            disabled={disabled}
            data-calculator-focus-target={isSelected ? "" : undefined}
            aria-pressed={isSelected}
            onClick={() => onChange(item.value)}
            className={`h-11 cursor-pointer rounded-md border px-3 text-sm font-medium transition-all duration-150 ${minWClass} ${
              isSelected
                ? `${color.bgSelected} ${color.textSelected} border-transparent shadow-sm`
                : `${color.bg} border-zinc-200 ${color.bgHover} text-zinc-700`
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
