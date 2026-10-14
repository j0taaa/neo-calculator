"use client";

import { useRef, type ReactNode } from "react";
import { Menu } from "@base-ui/react/menu";

import Link from "next/link";
import { MoreHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export type ActionMenuItem = {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
};

export function ActionMenu({
  open,
  onOpenChange,
  label,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  items: ActionMenuItem[];
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const actionSelected = useRef(false);
  return (
    <Menu.Root open={open} onOpenChange={(nextOpen) => {
      if (nextOpen) actionSelected.current = false;
      onOpenChange(nextOpen);
    }} modal={false}>
      <Menu.Trigger
        data-action-menu-root
        render={<Button ref={trigger} type="button" variant="ghost" size="icon" />}
        aria-label={label}
      >
        <MoreHorizontal className="size-4" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={8} collisionPadding={8} className="z-50">
          <Menu.Popup
            data-action-menu-root
            aria-label={label}
            finalFocus={() => {
              if (!actionSelected.current) return true;
              // Let the selected action mount and focus its editor/dialog first.
              requestAnimationFrame(() => {
                if (document.activeElement === document.body) trigger.current?.focus({ preventScroll: true });
              });
              return false;
            }}
            className="max-h-[var(--available-height)] w-52 max-w-[calc(100vw_-_1rem)] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.45)] outline-none"
          >
            {items.map((item) => (
              <Menu.Item
                key={item.label}
                render={<button type="button" />}
                nativeButton
                disabled={item.disabled}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-700 outline-none transition data-highlighted:bg-zinc-100 data-disabled:cursor-not-allowed data-disabled:opacity-50"
                onClick={() => { actionSelected.current = true; item.onSelect(); }}
              >
                <span className="text-zinc-500">{item.icon}</span>
                <span>{item.label}</span>
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function ActionModal({
  title,
  description,
  onClose,
  children,
  panelClassName,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full rounded-2xl border border-zinc-200 bg-white shadow-[0_32px_100px_-40px_rgba(15,23,42,0.55)] ${panelClassName ?? "max-w-lg"}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
            <p className="mt-1 text-sm text-zinc-500">{description}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label={`Close ${title}`} onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="space-y-4 px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

export function HomeNavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active ? "bg-zinc-950 text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
      }`}
    >
      {children}
    </Link>
  );
}
