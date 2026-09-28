"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AuditReport, ObservedComponent } from "@/lib/huawei-sync/audit-types";
import type { FormState, Quote, Values } from "@/lib/huawei-sync/types";

const names: Record<string, string> = { ecs: "ECS · Elastic Cloud Server", elb: "ELB · Elastic Load Balance", redis: "DCS · Redis", nat: "NAT Gateway" };
const regions: Record<string, string> = { "ap-southeast-1": "Hong Kong", "sa-brazil-1": "São Paulo", "ap-southeast-3": "Singapore" };
const selectClass = "mt-2 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm";

function Reference({ components }: { components: ObservedComponent[] }) {
  return <div className="space-y-3">{components.filter(c => c.type !== "CommonTip").map(component => <div key={component.id} className="rounded-md border p-3">{component.fields.map((field, i) => <div key={i} className="mb-3 last:mb-0"><p className="text-sm font-medium">{field.label || "Dependent option"}: <span className="font-normal">{field.selected || "—"}</span></p>{field.options.length > 0 && <p className="mt-1 text-xs text-zinc-500">{field.options.join(" · ")}</p>}</div>)}</div>)}</div>;
}

export default function SyncLab() {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [service, setService] = useState("nat");
  const [region, setRegion] = useState("ap-southeast-1");
  const [values, setValues] = useState<Values>({});
  const [duration, setDuration] = useState<number | undefined>();
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [evaluated, setEvaluated] = useState("");
  const sequence = useRef(0);
  const key = JSON.stringify([service, region, values, duration]);
  const selected = report?.results.find(item => item.service === service && item.region === region);

  useEffect(() => {
    fetch("/api/sync-lab").then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setReport(data);
    }).catch(error => setError(error.message));
  }, []);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    sequence.current++;
    const timer = setTimeout(async () => {
      setBusy(true); setQuote(null); setError("");
      try {
        const response = await fetch("/api/sync-lab", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "form", service, region, values, duration }), signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setForm(data.form); setEvaluated(JSON.stringify([service, region, values, duration]));
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") { setError(error.message); setForm(null); }
      } finally { if (!controller.signal.aborted) setBusy(false); }
    }, 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [service, region, values, duration, selected]);

  async function getPrice() {
    if (!form || !selected?.verified || evaluated !== key) return;
    const revision = sequence.current;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/sync-lab", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "quote", service, region, releaseId: selected.releaseId, values: form.values, duration: form.duration.value }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (revision === sequence.current) setQuote(data.quote);
    } catch (error) { if (revision === sequence.current) setError(error instanceof Error ? error.message : "Price unavailable"); }
    finally { setBusy(false); }
  }

  function reset() { setValues({}); setDuration(undefined); setForm(null); setQuote(null); setError(""); }

  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
    <div><p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Isolated comparison preview</p><h1 className="mt-2 text-3xl font-semibold">Huawei sync lab</h1><p className="mt-3 max-w-3xl text-sm text-zinc-600">Try forms generated from captured Huawei configuration. Compare them with the official calculator in three regions. This preview shows gaps openly; only independently verified scopes can request a price.</p></div>
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Service<select aria-label="Test service" className={selectClass} value={service} onChange={e => { reset(); setService(e.target.value); }}>{(report?.services ?? ["nat"]).map(id => <option key={id} value={id}>{names[id] ?? id}</option>)}</select></label><label className="text-sm font-medium">Region<select aria-label="Test region" className={selectClass} value={region} onChange={e => { reset(); setRegion(e.target.value); }}>{(report?.regions ?? [region]).map(id => <option key={id} value={id}>{regions[id] ?? id} · {id}</option>)}</select></label></div>
    {selected && <Card><CardContent className="space-y-3 pt-5"><p data-testid="scope-status" className={`font-semibold ${selected.verified ? "text-green-700" : "text-amber-800"}`}>{selected.verified ? `Verified · ${selected.cases} independent comparisons passed` : "Not fully verified · this scope is not published"}</p><p className="text-sm">{selected.catalog?.productCount ?? 0} upstream product records · {selected.catalog?.specCodes.length ?? 0} distinct specification codes · Captured {new Date(selected.checkedAt).toLocaleString()}</p>{!selected.verified && <p className="text-sm text-amber-800">{selected.diagnostics?.join("; ") || selected.neoError || selected.neo?.diagnostics.join("; ") || selected.auditError || "Independent verification is incomplete."}</p>}{selected.defaultCheck && <p className="text-sm">{selected.defaultCheck.result === "passed-default-only" ? `Default configuration matched Huawei in ${selected.defaultCheck.cases} checks. Full configuration coverage remains unverified.` : `Default check failed: ${selected.defaultCheck.error}`}</p>}<a href={selected.officialUrl} target="_blank" rel="noreferrer" className="inline-block text-sm underline">Open the official calculator for this region ↗</a></CardContent></Card>}
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Generated Neo form</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-xs text-zinc-500">Pay-per-use · quantity one. Unsupported forms below are diagnostic previews, not accurate estimates.</p>{error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}<fieldset disabled={busy} className="space-y-4">{form?.fields.map(field => <label key={field.id} className="block text-sm font-medium">{field.label}{field.type === "select" ? <select aria-label={field.label} className={selectClass} value={String(field.value)} onChange={e => { setQuote(null); setValues({ ...form.values, [field.id]: e.target.value }); }}>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <Input aria-label={field.label} type="number" value={field.value} min={field.min} max={field.max} step={field.step} onChange={e => { setQuote(null); setValues({ ...form.values, [field.id]: Number(e.target.value) }); }} />}</label>)}{form && <label className="block text-sm font-medium">Duration ({form.duration.measureId === 0 ? "days" : "hours"})<Input aria-label="Duration" type="number" min={form.duration.min} max={form.duration.max} value={duration ?? form.duration.value} onChange={e => { setQuote(null); setDuration(Number(e.target.value)); }} /></label>}</fieldset>{form?.diagnostics.map(text => <p key={text} className="text-sm text-amber-800">{text}</p>)}<Button disabled={!selected?.verified || !form || !!form.diagnostics.length || busy || evaluated !== key} onClick={getPrice}>Get current Huawei price</Button>{busy && <p role="status" className="text-sm">Updating…</p>}{quote && <p data-testid="lab-price" className="text-2xl font-semibold">{quote.currency} {quote.amount.toFixed(2)}</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Huawei reference capture</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-xs text-zinc-500">Recorded default pay-per-use form, not a live mirrored selection. Options shown here were observed in Huawei’s own renderer.</p>{selected?.auditError && <p className="text-sm text-red-700">{selected.auditError}</p>}{selected?.official && <Reference components={selected.official} />}{selected?.variants?.map(variant => <details key={variant.name}><summary className="cursor-pointer text-sm font-medium">Observed transition: {variant.name}</summary><div className="mt-3"><Reference components={variant.components} /></div></details>)}{selected?.screenshot && <a href={`/api/sync-lab?image=${encodeURIComponent(selected.screenshot)}`} target="_blank" rel="noreferrer" className="inline-block text-sm underline">View full official screenshot ↗</a>}</CardContent></Card>
    </div>
    {report && <Card><CardHeader><CardTitle>Regional catalog comparison</CardTitle></CardHeader><CardContent><p className="mb-4 text-xs text-zinc-500">Counts describe captured catalog records, including resource types and billing variants. They are not a count of selectable ECS flavors or proof of complete behavioral coverage.</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Region</th><th className="p-2">Products</th><th className="p-2">Distinct specs</th><th className="p-2">Verification</th></tr></thead><tbody>{report.results.filter(item => item.service === service).map(item => <tr key={item.region} className="border-t"><td className="p-2">{regions[item.region] ?? item.region}</td><td className="p-2">{item.catalog?.productCount}</td><td className="p-2">{item.catalog?.specCodes.length}</td><td className="p-2">{item.verified ? "Passed" : "Held"}</td></tr>)}</tbody></table></div></CardContent></Card>}
    <p className="text-xs text-zinc-500">Sample: ECS, ELB, DCS and NAT in Hong Kong, São Paulo and Singapore. This is not a test of every region, flavor, billing mode or input combination.</p>
  </main>;
}
