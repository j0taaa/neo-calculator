"use client";

type OptionGridItem = {
  value: string;
  label: string;
  disabled?: boolean;
};

type OptionGridProps = {
  items: OptionGridItem[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  cols?: 2 | 3 | 4;
  name: string;
  ariaLabel?: string;
};

export function OptionGrid({ items, value, onChange, disabled, cols, name, ariaLabel = name }: OptionGridProps) {
  const minWClass = cols === 4
    ? "min-w-20"
    : cols === 3
      ? "min-w-24"
      : "min-w-28";

  return (
    <div data-option-grid role="group" aria-label={ariaLabel} data-value={value} className={`flex flex-wrap gap-2`}>
      {items.map((item, index) => {
        const isSelected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            disabled={disabled || item.disabled}
            data-option-grid-button={index + 1}
            data-value={item.value}
            data-calculator-focus-target={isSelected ? "" : undefined}
            aria-pressed={isSelected}
            onClick={() => onChange(item.value)}
            className={`min-h-11 max-w-full break-words cursor-pointer rounded-md border px-3 text-sm font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${minWClass} ${
              isSelected
                ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
