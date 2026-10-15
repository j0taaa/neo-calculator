"use client";
import type { ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { Button } from "../ui/button";
export function TransferModal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-zinc-950/40" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-white p-5 text-zinc-900 shadow-xl outline-none">
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-lg font-semibold">
              {title}
            </Dialog.Title>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Close ${title}`}
              onClick={onClose}
            >
              <X />
            </Button>
          </div>
          <Dialog.Description className="mt-1 mb-5 text-sm text-zinc-500">
            {description}
          </Dialog.Description>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
