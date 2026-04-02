"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type BaseCartOption = {
  key: string;
  name: string;
  associatedListId: string | null;
};

type ProjectAddCartModalContentProps = {
  projectId: string;
  listName: string;
  onListNameChange: (value: string) => void;
  baseCartKey: string;
  onBaseCartKeyChange: (value: string) => void;
  huaweiCarts: BaseCartOption[];
  cookieValue: string;
  pending: boolean;
  onSubmit: () => void;
  submitLabel?: string;
};

export function ProjectAddCartModalContent({
  projectId,
  listName,
  onListNameChange,
  baseCartKey,
  onBaseCartKeyChange,
  huaweiCarts,
  cookieValue,
  pending,
  onSubmit,
  submitLabel = "Add Cart",
}: ProjectAddCartModalContentProps) {
  return (
    <>
      <Input
        value={listName}
        onChange={(event) => onListNameChange(event.target.value)}
        placeholder="New cart name"
        autoFocus
      />
      <Select
        value={baseCartKey || "__blank"}
        onValueChange={(value) => onBaseCartKeyChange(value && value !== "__blank" ? value : "")}
      >
        <SelectTrigger className="bg-white">
          <SelectValue>
            {baseCartKey
              ? `Base: ${huaweiCarts.find((cart) => cart.key === baseCartKey)?.name ?? "Huawei cart"}`
              : "Base: Blank Neo cart"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__blank">Blank Neo cart</SelectItem>
          {huaweiCarts.map((cart) => (
            <SelectItem key={cart.key} value={cart.key} disabled={Boolean(cart.associatedListId)}>
              {cart.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!cookieValue.trim() && baseCartKey ? (
        <p className="text-sm text-zinc-500">Save a Huawei Cloud cookie on the dashboard before using a Huawei cart as the base.</p>
      ) : null}
      <div className="flex justify-end">
        <Button variant="outline" onClick={onSubmit} disabled={pending} data-project-id={projectId}>
          {pending ? "Adding..." : submitLabel}
        </Button>
      </div>
    </>
  );
}
