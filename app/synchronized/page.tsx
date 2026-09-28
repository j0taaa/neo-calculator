"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { FormState, Quote, Values } from "@/lib/huawei-sync/types";

type Scope = { region: string; releaseId: string; verifiedAt: string; cases: number; available: boolean };
type Service = { id: string; name: string; category: string; available: boolean; scopes: Scope[]; diagnostics: string[] };
type Cart = { id: string; name: string; project: string };
const selectClass = "h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm";

export default function SynchronizedCalculator() {
  const [services, setServices] = useState<Service[]>([]);
  const [service, setService] = useState("");
  const [region, setRegion] = useState("");
  const [values, setValues] = useState<Values>({});
  const [duration, setDuration] = useState<number | undefined>();
  const [form, setForm] = useState<FormState | null>(null);
  const [releaseId, setReleaseId] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [carts, setCarts] = useState<Cart[]>([]);
  const [cart, setCart] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [productId, setProductId] = useState("");
  const [evaluatedFor, setEvaluatedFor] = useState("");
  const inputKey = JSON.stringify([service, region, values, duration]);
  const ready = evaluatedFor === inputKey && !loading;
  const revision = useRef(0);
  const selected = services.find(s => s.id === service);
  const scopes = selected?.scopes.filter(scope => scope.available) ?? [];
  const active = scopes.find(scope => scope.region === region);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/huawei-sync", { signal: controller.signal }).then(r => r.json()).then(async data => {
      setServices(data.services);
      const params = new URLSearchParams(window.location.search);
      if (params.get("edit") && params.get("service")) {
        const response = await fetch(`/api/huawei-sync/${encodeURIComponent(params.get("service")!)}?productId=${encodeURIComponent(params.get("edit")!)}`, { signal: controller.signal });
        const item = await response.json();
        if (!response.ok) throw new Error(item.error);
        const saved = item.config.huaweiSync;
        setProductId(item.id); setCart(item.listId); setService(saved.service); setRegion(saved.input.region); setValues(saved.input.values); setDuration(saved.input.duration);
        return;
      }
      const first = data.services.find((s: Service) => s.available && s.scopes.some(scope => scope.available));
      if (first) { setService(first.id); setRegion(first.scopes.find((s: Scope) => s.available).region); }
    }).catch(e => { if (e.name !== "AbortError") setError("Could not load synchronized services"); });
    fetch("/api/projects", { signal: controller.signal }).then(async r => {
      if (!r.ok) return;
      const projects = await r.json();
      const list = projects.flatMap((project: { name: string; lists: { id: string; name: string; canEditProducts: boolean }[] }) => project.lists.filter(l => l.canEditProducts).map(l => ({ id: l.id, name: l.name, project: project.name })));
      setCarts(list);
      if (list.length && !new URLSearchParams(window.location.search).has("edit")) setCart(list[0].id);
    }).catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    revision.current++;
    const controller = new AbortController();
    if (!service || !region) return;
    const timer = setTimeout(async () => {
      setLoading(true); setError(""); setQuote(null); setMessage("");
      try {
        const response = await fetch(`/api/huawei-sync/${encodeURIComponent(service)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "form", region, values, duration }), signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setForm(data.form); setReleaseId(data.releaseId);
        setEvaluatedFor(JSON.stringify([service, region, values, duration]));
      } catch (e) { if (e instanceof Error && e.name !== "AbortError") { setError(e.message); setForm(null); } }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [service, region, values, duration]);

  async function calculate(action: "quote" | "save") {
    if (!form || !ready) return;
    const current = revision.current;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/huawei-sync/${encodeURIComponent(service)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, region, values: form.values, duration: form.duration.value, releaseId, listId: cart, ...(action === "save" && productId ? { productId } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (current === revision.current) { setQuote(data.quote); if (action === "save") setMessage("Saved to your cart with a freshly checked price."); }
    } catch (e) { if (current === revision.current) setError(e instanceof Error ? e.message : "Price unavailable"); }
    finally { setBusy(false); }
  }

  function changeService(id: string) {
    setService(id); setValues({}); setDuration(undefined); setForm(null); setQuote(null); setProductId("");
    setRegion(services.find(s => s.id === id)?.scopes.find(scope => scope.available)?.region ?? "");
  }

  return <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
    <div><h1 className="text-2xl font-semibold">Synchronized Huawei calculator</h1><p className="mt-2 text-sm text-zinc-600">Pay-per-use configurations checked against Huawei’s calculator. Final prices come from Huawei.</p></div>
    <Card><CardHeader><CardTitle>Choose a service</CardTitle></CardHeader><CardContent className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">Service<select aria-label="Service" className={selectClass} value={service} onChange={e => changeService(e.target.value)}><option value="" disabled>Select a verified service</option>{services.filter(s => s.available && s.scopes.some(scope => scope.available)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="space-y-2 text-sm font-medium">Region<select aria-label="Region" className={selectClass} value={region} onChange={e => { setRegion(e.target.value); setValues({}); setDuration(undefined); setQuote(null); }}><option value="" disabled>Select a region</option>{scopes.map(scope => <option key={scope.region} value={scope.region}>{scope.region}</option>)}</select></label>
      </div>
      {!service && <p className="text-sm text-zinc-600">The synchronization worker is checking services. Verified configurations appear here automatically. The <Link href="/" className="underline">dashboard calculators</Link> remain available.</p>}
      {active && <p className="text-xs text-zinc-500">Last checked: {new Date(active.verifiedAt).toLocaleString()} · {active.cases} comparisons passed</p>}
      <fieldset disabled={busy || loading} className="space-y-5">
        {form?.fields.map(field => <label key={field.id} className="block space-y-2 text-sm font-medium">{field.label}{field.type === "select" ? <select aria-label={field.label} className={selectClass} value={String(field.value)} onChange={e => { setQuote(null); setValues({ ...form.values, [field.id]: e.target.value }); }}>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <Input aria-label={field.label} type="number" min={field.min} max={field.max} step={field.step} value={field.value} onChange={e => { setQuote(null); setValues({ ...form.values, [field.id]: Number(e.target.value) }); }} />}</label>)}
        {form && <label className="block space-y-2 text-sm font-medium">Duration ({form.duration.measureId === 0 ? "days" : "hours"})<Input aria-label="Duration" type="number" min={form.duration.min} max={form.duration.max} step={1} value={duration ?? form.duration.value} onChange={e => { setQuote(null); setDuration(Number(e.target.value)); }} /></label>}
      </fieldset>
      {loading && <p role="status" className="text-sm text-zinc-500">Updating choices…</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {form && <Button disabled={busy || !ready} onClick={() => calculate("quote")}>{busy ? "Checking price…" : "Get current price"}</Button>}
      {quote && <div className="rounded-lg bg-zinc-50 p-4"><p className="text-2xl font-semibold" data-testid="synced-price">{quote.currency} {quote.amount.toFixed(2)}</p><p className="mt-1 text-xs text-zinc-500">Checked {new Date(quote.quotedAt).toLocaleTimeString()} for the selected duration.</p></div>}
      {form && <div className="flex flex-wrap items-end gap-3"><label className="min-w-64 flex-1 space-y-2 text-sm font-medium">Cart<select aria-label="Cart" className={selectClass} value={cart} disabled={Boolean(productId)} onChange={e => setCart(e.target.value)}><option value="" disabled>Select a cart</option>{carts.map(c => <option key={c.id} value={c.id}>{c.project} / {c.name}</option>)}</select></label><Button variant="outline" disabled={busy || !ready || !cart} onClick={() => calculate("save")}>{productId ? "Save changes" : "Save to cart"}</Button>{!carts.length && <p className="text-sm text-zinc-500"><Link href="/projects" className="underline">Sign in and create a cart</Link> to save estimates.</p>}</div>}
      {message && <p role="status" className="text-sm text-green-700">{message} <Link href="/" className="underline">Open dashboard</Link></p>}
    </CardContent></Card>
    <details className="text-sm text-zinc-600"><summary className="cursor-pointer">Synchronization coverage ({services.length} discovered services)</summary><p className="my-3">A service is published only after its supported configurations pass independent checks. Additional billing modes and unsupported controls continue to use the existing dashboard.</p><ul className="grid gap-2 sm:grid-cols-2">{services.map(s => <li key={s.id}>{s.name}: {s.scopes.some(scope => scope.available) ? "verified scopes available" : s.available ? "awaiting verification" : "not offered by the official calculator"}</li>)}</ul></details>
  </main>;
}
