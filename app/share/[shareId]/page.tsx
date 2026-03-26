"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSessionContext } from "@/components/session-provider";

type SharedProduct = {
  id: string;
  title: string;
  serviceName: string;
  quantity: number;
};

type SharedList = {
  id: string;
  name: string;
  products: SharedProduct[];
};

type SharePayload =
  | {
      shareId: string;
      resourceType: "project";
      mode: "copy" | "collaborate";
      project: {
        id: string;
        name: string;
        description: string | null;
        lists: SharedList[];
      };
    }
  | {
      shareId: string;
      resourceType: "list";
      mode: "copy" | "collaborate";
      list: SharedList & { projectName: string };
    };

function getResponseError(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
    return payload.error;
  }

  return fallback;
}

export default function SharePage({ params }: { params: Promise<{ shareId: string }> }) {
  const { session, isPending: isSessionPending } = useSessionContext();
  const [shareId, setShareId] = useState("");
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [actionPending, setActionPending] = useState(false);

  useEffect(() => {
    void params.then((resolved) => setShareId(resolved.shareId));
  }, [params]);

  useEffect(() => {
    if (!shareId) {
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setMessage("");

      try {
        const response = await fetch(`/api/share/${shareId}`, { cache: "no-store" });
        const nextPayload = (await response.json().catch(() => null)) as SharePayload | { error?: string } | null;

        if (!response.ok || !nextPayload || !("shareId" in nextPayload)) {
          throw new Error(getResponseError(nextPayload, "Unable to load share"));
        }

        if (!cancelled) {
          setPayload(nextPayload);
        }
      } catch (error) {
        if (!cancelled) {
          setPayload(null);
          setMessage(error instanceof Error ? error.message : "Unable to load share");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  const handleAction = async () => {
    if (!payload) {
      return;
    }

    if (!session) {
      setMessage(payload.mode === "copy" ? "Sign in to save a copy of this share." : "Sign in to join this collaborative share.");
      return;
    }

    setActionPending(true);
    setMessage("");

    try {
      const path = payload.mode === "copy" ? "import" : "join";
      const response = await fetch(`/api/share/${payload.shareId}/${path}`, {
        method: "POST",
      });
      const actionPayload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(getResponseError(actionPayload, `Unable to ${path} shared resource`));
      }

      setMessage(payload.mode === "copy" ? "Copy saved to your account. Open Projects to continue." : "Collaborative access granted. Open Projects to continue.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to continue");
    } finally {
      setActionPending(false);
    }
  };

  const lists = payload?.resourceType === "project" ? payload.project.lists : payload?.list ? [payload.list] : [];
  const title = payload?.resourceType === "project" ? payload.project.name : payload?.list?.name ?? "Shared Resource";
  const subtitle = payload?.resourceType === "project" ? `${payload.project.lists.length} carts` : payload?.list?.projectName ?? "";

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-[0.22em] text-zinc-500 uppercase">Shared Resource</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm text-zinc-500">{subtitle}</p> : null}
          </div>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Open Calculator
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>{payload?.mode === "collaborate" ? "Collaborative Share" : "Copy Share"}</CardTitle>
              {payload ? <Badge variant="secondary">{payload.resourceType === "project" ? "Project" : "Cart"}</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading || isSessionPending ? <p className="text-sm text-zinc-500">Loading share...</p> : null}
            {message ? <p className="text-sm text-zinc-500">{message}</p> : null}
            {!loading && payload ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={handleAction} disabled={actionPending}>
                  {actionPending
                    ? payload.mode === "copy"
                      ? "Saving..."
                      : "Joining..."
                    : payload.mode === "copy"
                    ? "Save Copy To My Account"
                    : "Join Collaboration"}
                </Button>
                <Link href="/projects" className={buttonVariants({ variant: "outline" })}>
                  Open Projects
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {lists.map((list) => (
          <Card key={list.id}>
            <CardHeader>
              <CardTitle>{list.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {list.products.length === 0 ? (
                <p className="text-sm text-zinc-500">This cart does not have products yet.</p>
              ) : (
                list.products.map((product) => (
                  <div key={product.id} className="rounded-lg border bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-950">{product.title}</p>
                        <p className="mt-1 text-sm text-zinc-500">{product.serviceName}</p>
                      </div>
                      <Badge variant="outline">Qty {product.quantity}</Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
