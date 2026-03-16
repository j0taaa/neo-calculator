"use client";

import { CardContent } from "@/components/ui/card";

type UnsupportedServicePanelProps = {
  title: string;
  description: string;
};

export function UnsupportedServicePanel({ title, description }: UnsupportedServicePanelProps) {
  return (
    <CardContent className="py-8">
      <div className="rounded-2xl border border-dashed bg-zinc-50 p-6">
        <p className="text-lg font-semibold text-zinc-950">{title}</p>
        <p className="mt-2 text-sm text-zinc-500">{description}</p>
      </div>
    </CardContent>
  );
}
