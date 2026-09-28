"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { NativeDirectory, NativeField, NativeState } from "@/lib/huawei-sync/native-types";

const selectClass = "mt-2 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm";
const names: Record<string, string> = { ecs: "ECS · Elastic Cloud Server", elb: "ELB · Elastic Load Balance", redis: "DCS · Redis", nat: "NAT Gateway" };
async function api(body?: unknown) {
  const response = await fetch("/api/sync-lab/live", body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Huawei is unavailable");
  return data;
}
function close(session: string) {
  void fetch("/api/sync-lab/live", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "close", session }), keepalive: true }).catch(() => {});
}
function Numeric({ field, change, invalidate }: { field: NativeField; change: (value: number) => void; invalidate: () => void }) {
  const [draft, setDraft] = useState(String(field.value));
  const [error, setError] = useState("");
  const dirty = useRef(false);
  const submit = () => {
    if (!dirty.current) return;
    const value = Number(draft);
    if (!draft.trim() || !Number.isFinite(value) || (field.min !== undefined && value < field.min) || (field.max !== undefined && value > field.max)) { setError(`Enter a value from ${field.min ?? "the minimum"} to ${field.max ?? "the maximum"}.`); return; }
    setError(""); change(value);
  };
  return <><Input aria-invalid={!!error} data-field-id={field.id} aria-label={field.label} type="number" disabled={field.disabled} min={field.min} max={field.max} step="any" value={draft} onChange={event => { dirty.current = true; setDraft(event.target.value); invalidate(); }} onBlur={submit} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} />{error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}</>;
}
export default function SyncLab() {
  const [directory, setDirectory] = useState<NativeDirectory | null>(null);
  const [service, setService] = useState("ecs"), [region, setRegion] = useState("ap-southeast-1");
  const [state, setState] = useState<NativeState | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const current = useRef<NativeState | null>(null), mounted = useRef(true), operation = useRef(false);
  useEffect(() => {
    mounted.current = true;
    api().then(data => { if (mounted.current) setDirectory(data); }).catch(error => { if (mounted.current) setError(error.message); });
    const leave = () => { if (current.current) { close(current.current.session); current.current = null; } };
    window.addEventListener("pagehide", leave);
    return () => { mounted.current = false; leave(); window.removeEventListener("pagehide", leave); };
  }, []);
  function reset() { if (current.current) close(current.current.session); current.current = null; setState(null); setError(""); }
  async function open() {
    if (operation.current) return;
    operation.current = true; reset(); setBusy(true);
    try {
      const next: NativeState = await api({ action: "open", service, region });
      if (!mounted.current) { close(next.session); return; }
      current.current = next; setState(next);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not open Huawei calculator"); }
    finally { operation.current = false; setBusy(false); }
  }
  async function change(field: NativeField, value: string | number | boolean) {
    const previous = current.current;
    if (!previous || operation.current) return;
    operation.current = true;
    setBusy(true); setError(""); setState({ ...previous, quote: null, fields: previous.fields.map(item => item.id === field.id ? { ...item, value } : item) });
    try {
      const next: NativeState = await api({ action: "change", session: previous.session, revision: previous.revision, field: field.id, value });
      if (!mounted.current) { close(next.session); return; }
      current.current = next; setState(next);
    } catch (error) {
      reset(); setError(error instanceof Error ? error.message : "Could not apply the change");
    } finally { operation.current = false; setBusy(false); }
  }
  const services = directory?.services.slice().sort((a, b) => Number(!!names[b.id]) - Number(!!names[a.id]) || a.name.localeCompare(b.name));
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
    <div><p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Isolated live preview</p><h1 className="mt-2 text-3xl font-semibold">Huawei sync lab</h1><p className="mt-3 max-w-3xl text-sm text-zinc-600">Configure services using Huawei’s current options and regional rules. Prices come directly from Huawei after each change. This preview supports pay-per-use billing.</p></div>
    <Card><CardContent className="space-y-4 pt-5"><fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Service<select aria-label="Test service" className={selectClass} value={service} onChange={e => { reset(); setService(e.target.value); }}>{(services ?? [{ id: "ecs", name: names.ecs }]).map(s => <option key={s.id} value={s.id}>{names[s.id] ?? s.name}</option>)}</select></label><label className="text-sm font-medium">Region<select aria-label="Test region" className={selectClass} value={region} onChange={e => { reset(); setRegion(e.target.value); }}>{(directory?.regions ?? [{ id: region, name: "Hong Kong" }]).map(r => <option key={r.id} value={r.id}>{r.name} · {r.id}</option>)}</select></label></fieldset><div className="flex flex-wrap items-center gap-4"><Button disabled={busy || !directory} onClick={open}>{state ? "Reload current Huawei data" : "Open calculator"}</Button><a className="text-sm underline" href={`https://www.huaweicloud.com/intl/en-us/pricing/calculator.html?region=${encodeURIComponent(region)}&inIframe=true#/${encodeURIComponent(service)}`} target="_blank" rel="noreferrer">Compare with Huawei ↗</a></div><p className="text-xs text-zinc-500">Services and regions are discovered automatically. Availability depends on the selected service. Unsupported controls or incomplete responses stop pricing.</p></CardContent></Card>
    {busy && <p role="status" className="text-sm">{state ? "Updating options and checking the Huawei price…" : "Loading the official calculator…"}</p>}
    {error && <p role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {state && <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]"><Card><CardHeader><CardTitle>{names[service] ?? services?.find(s => s.id === service)?.name}</CardTitle></CardHeader><CardContent><fieldset disabled={busy} className="space-y-5">{state.fields.map(field => <div key={`${state.revision}:${field.id}`}>
      {field.type === "action" ? <Button variant="outline" data-field-id={field.id} disabled={field.disabled} onClick={() => change(field, true)}>{field.label}</Button> : field.type === "checkbox" ? <label className="flex items-center gap-3 text-sm"><input data-field-id={field.id} type="checkbox" disabled={field.disabled} checked={!!field.value} onChange={e => change(field, e.target.checked)} />{field.label}</label> : <label className="block text-sm font-medium">{field.label}{field.unit && <span className="ml-1 font-normal text-zinc-500">({field.unit})</span>}{field.type === "select" ? <select data-field-id={field.id} aria-label={field.label} disabled={field.disabled} className={selectClass} value={String(field.value)} onChange={e => change(field, e.target.value)}>{field.options?.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}</select> : <Numeric field={field} invalidate={() => setState(previous => previous ? { ...previous, quote: null } : null)} change={value => change(field, value)} />}</label>}
    </div>)}</fieldset>{state.notes.length > 0 && <details className="mt-6 text-sm"><summary className="cursor-pointer">Huawei configuration notes</summary><div className="mt-3 space-y-3 text-zinc-600">{state.notes.map((note, i) => <p key={i}>{note}</p>)}</div></details>}</CardContent></Card>
      <Card className="lg:sticky lg:top-6"><CardHeader><CardTitle>Current estimate</CardTitle></CardHeader><CardContent className="space-y-4">{state.quote && !busy ? <><p data-testid="lab-price" className="text-3xl font-semibold">{state.quote.currency} {state.quote.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</p><p className="text-xs text-zinc-500">For the selected duration, usage and quantity. Checked {new Date(state.quote.quotedAt).toLocaleTimeString()}.</p><p data-testid="scope-status" className="text-sm text-green-700">Complete Huawei pricing response</p></> : <p data-testid="scope-status" className="text-sm text-amber-800">{busy ? "Waiting for the updated configuration" : "Price unavailable"}</p>}{state.priceError && <p role="alert" className="text-sm text-red-700">{state.priceError}</p>}{state.diagnostics.map(diagnostic => <p key={diagnostic} role="alert" className="text-sm text-amber-800">{diagnostic}</p>)}{state.quote && <details className="text-sm"><summary className="cursor-pointer">Price components</summary><ul className="mt-3 space-y-3">{state.inquiry?.productInfos.map(product => <li key={product.id}><p className="break-all">{product.resourceSpecCode}</p><p className="text-zinc-500">USD {state.quote?.breakdown.find(item => item.id === product.id)?.amount}</p></li>)}</ul></details>}<p className="text-xs text-zinc-500">Sessions close after 10 minutes of inactivity. Reopen to refresh the catalog.</p></CardContent></Card>
    </div>}
    <p className="text-xs text-zinc-500">The live preview uses Huawei’s renderer for dependencies and pricing requests. ECS, ELB, DCS and NAT are the focus of comparison tests; other discovered services may require additional control support. <a className="underline" href="/sync-lab/audit">Earlier captured audit</a></p>
  </main>;
}
