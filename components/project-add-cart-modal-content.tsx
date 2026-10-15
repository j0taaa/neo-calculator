"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function ProjectAddCartModalContent({ projectId, listName, onListNameChange, pending, onSubmit, submitLabel = "Add Cart" }: {
  projectId: string; listName: string; onListNameChange: (value: string) => void; pending: boolean; onSubmit: () => void; submitLabel?: string;
}) {
  return <><Input value={listName} onChange={event => onListNameChange(event.target.value)} placeholder="New cart name" autoFocus onKeyDown={event => { if (event.key === "Enter" && listName.trim() && !pending) onSubmit(); }} /><p className="text-sm text-zinc-500">To import a saved Huawei cart, open <Link className="underline underline-offset-4" href="/huawei-carts">Huawei Carts</Link>.</p><div className="flex justify-end"><Button variant="outline" onClick={onSubmit} disabled={pending || !listName.trim()} data-project-id={projectId}>{pending ? "Adding…" : submitLabel}</Button></div></>;
}
