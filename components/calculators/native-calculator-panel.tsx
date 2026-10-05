"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AppProduct, ProductMutationBody } from "@/lib/calculator-types";
import { parseNativeSelection, selectionBillingMode } from "@/lib/huawei-native/native-selection";
import { nativeBillingModes, type NativeBillingMode } from "@/lib/huawei-native/native-billing";
import type { NativeDirectory, NativeField, NativeState } from "@/lib/huawei-native/native-types";
import { isLegacyHuaweiProduct, legacyHuaweiConfiguration } from "@/lib/huawei-native/legacy-product";

const selectClass = "mt-2 h-10 w-full min-w-0 rounded-md border border-zinc-200 bg-white px-3 text-sm";
const names: Record<string, string> = {
  ecs: "ECS · Elastic Cloud Server",
  elb: "ELB · Elastic Load Balance",
  redis: "DCS · Redis",
  nat: "NAT Gateway",
};
async function api(body?: unknown) {
  const response = await fetch(
    "/api/calculator/native",
    body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined,
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Huawei is unavailable");
  return data;
}
function close(session: string) {
  void fetch("/api/calculator/native", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "close", session }),
    keepalive: true,
  }).catch(() => {});
}
function Numeric({
  field,
  change,
  invalidate,
}: {
  field: NativeField;
  change: (value: number) => void;
  invalidate: () => void;
}) {
  const [draft, setDraft] = useState(String(field.value));
  const [error, setError] = useState("");
  const dirty = useRef(false);
  const submit = () => {
    if (!dirty.current) return;
    const value = Number(draft);
    if (
      !draft.trim() ||
      !Number.isFinite(value) ||
      (field.min !== undefined && value < field.min) ||
      (field.max !== undefined && value > field.max)
    ) {
      setError(`Enter a value from ${field.min ?? "the minimum"} to ${field.max ?? "the maximum"}.`);
      return;
    }
    setError("");
    change(value);
  };
  return (
    <>
      <Input
        aria-invalid={!!error}
        data-field-id={field.id}
        aria-label={field.label}
        type="number"
        disabled={field.disabled}
        min={field.min}
        max={field.max}
        step="any"
        value={draft}
        onChange={(event) => {
          dirty.current = true;
          setDraft(event.target.value);
          invalidate();
        }}
        onBlur={submit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </>
  );
}
export function NativeCalculatorPanel({
  editingProduct,
  onSave,
  onCancelEdit,
}: {
  editingProduct?: AppProduct | null;
  onSave?: (product: ProductMutationBody) => Promise<void>;
  onCancelEdit?: () => void;
}) {
  const [directory, setDirectory] = useState<NativeDirectory | null>(null);
  const [service, setService] = useState("ecs"),
    [region, setRegion] = useState("ap-southeast-1");
  const [billingMode, setBillingMode] = useState<NativeBillingMode>("ONDEMAND");
  const modes = directory?.billingModes[service]?.[region] ?? [];
  useEffect(() => {
    const available = directory?.billingModes[service]?.[region] ?? [];
    if (available.length && !available.includes(billingMode)) setBillingMode(available.includes("ONDEMAND") ? "ONDEMAND" : available[0]);
  }, [directory, service, region, billingMode]);
  const [state, setState] = useState<NativeState | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const current = useRef<NativeState | null>(null),
    mounted = useRef(true),
    operation = useRef(false);
  useEffect(() => {
    mounted.current = true;
    api()
      .then((data) => {
        if (mounted.current) setDirectory(data);
      })
      .catch((error) => {
        if (mounted.current) setError(error.message);
      });
    const leave = () => {
      if (current.current) {
        close(current.current.session);
        current.current = null;
      }
    };
    window.addEventListener("pagehide", leave);
    return () => {
      mounted.current = false;
      leave();
      window.removeEventListener("pagehide", leave);
    };
  }, []);
  const [saveMessage, setSaveMessage] = useState("");
  const legacy = !!editingProduct && isLegacyHuaweiProduct(editingProduct);
  const [legacyReviewed, setLegacyReviewed] = useState(false);
  useEffect(() => {
    setLegacyReviewed(false);
    setSaveMessage("");
    if (!editingProduct) {
      setBusy(false);
      return;
    }
    let cancelled = false;
    if (current.current) close(current.current.session);
    current.current = null;
    setState(null);
    setError("");
    if (isLegacyHuaweiProduct(editingProduct)) {
      setBusy(false);
      try {
        const saved = legacyHuaweiConfiguration(editingProduct);
        setService(saved.service);
        setRegion(saved.region);
        setBillingMode("ONDEMAND");
      } catch (error) {
        setError(error instanceof Error ? error.message : "Invalid old Huawei configuration");
      }
      return;
    }
    let selection;
    try {
      selection = parseNativeSelection((editingProduct.config as { selection?: unknown } | null)?.selection);
    } catch (error) {
      setBusy(false);
      setError(error instanceof Error ? error.message : "Invalid saved Huawei configuration");
      return;
    }
    setBusy(true);
    setService(selection.service);
    setRegion(selection.region);
    setBillingMode(selectionBillingMode(selection));
    api({ action: "restore", selection })
      .then((next: NativeState) => {
        if (cancelled) {
          close(next.session);
          return;
        }
        current.current = next;
        setState(next);
      })
      .catch((error) => {
        if (!cancelled) setError(error.message);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editingProduct]);
  async function save() {
    if (!state?.quote || busy || !onSave || (legacy && !legacyReviewed)) return;
    setBusy(true);
    setSaveMessage("");
    try {
      await onSave({
        serviceCode: `HUAWEI:${state.service}`,
        serviceName: directory?.services.find((s) => s.id === state.service)?.name ?? state.service,
        productType: "huawei-native",
        title: editingProduct?.title ?? directory?.services.find((s) => s.id === state.service)?.name ?? state.service,
        quantity: 1,
        config: {
          runtime: "huawei-native",
          region: state.region,
          billingMode: nativeBillingModes[state.billingMode].label,
          selection: state.selection,
          session: state.session,
          revision: state.revision,
        },
        pricing: null,
      });
      setSaveMessage(
        editingProduct ? "Product updated with a fresh Huawei price." : "Product added with a fresh Huawei price.",
      );
    } catch (error) {
      setState((previous) => (previous ? { ...previous, quote: null } : null));
      setSaveMessage(error instanceof Error ? error.message : "Unable to save product");
    } finally {
      setBusy(false);
    }
  }
  function reset() {
    if (current.current) close(current.current.session);
    current.current = null;
    setState(null);
    setError("");
    setLegacyReviewed(false);
  }
  async function open(mode = billingMode) {
    if (operation.current) return;
    operation.current = true;
    reset();
    setBusy(true);
    try {
      const next: NativeState = await api({ action: "open", service, region, billingMode: mode });
      if (!mounted.current) {
        close(next.session);
        return;
      }
      current.current = next;
      setState(next);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not open Huawei calculator");
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  async function change(field: NativeField, value: string | number | boolean) {
    const previous = current.current;
    if (!previous || operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    setState({
      ...previous,
      quote: null,
      fields: previous.fields.map((item) => (item.id === field.id ? { ...item, value } : item)),
    });
    try {
      const next: NativeState = await api({
        action: "change",
        session: previous.session,
        revision: previous.revision,
        field: field.id,
        value,
      });
      if (!mounted.current) {
        close(next.session);
        return;
      }
      current.current = next;
      setState(next);
    } catch (error) {
      reset();
      setError(error instanceof Error ? error.message : "Could not apply the change");
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  const services = directory?.services
    .slice()
    .sort((a, b) => Number(!!names[b.id]) - Number(!!names[a.id]) || a.name.localeCompare(b.name));
  return (
    <section className="@container/native mx-auto min-w-0 max-w-5xl space-y-4 px-3 py-4 sm:px-4">
      <div>
        <h1 className="text-xl font-semibold @min-[640px]/native:text-2xl">Huawei live calculator</h1>
        <p className="mt-3 max-w-3xl text-sm text-zinc-600">
          Configure services using Huawei’s current options and regional rules. Prices come directly from Huawei after
          each change. Billing modes, purchase terms and payment options follow the selected service and region.
        </p>
      </div>
      {legacy && editingProduct && (
        <Card>
          <CardHeader><CardTitle>Review the original estimate</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">This estimate used the retired calculator. Open Huawei live below and reselect its options. Your saved estimate stays unchanged until you save.</p>
            <p className="text-sm font-medium">{editingProduct.title}</p>
            <details>
              <summary className="cursor-pointer text-sm">Original saved configuration</summary>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-zinc-50 p-3 text-xs">{JSON.stringify(editingProduct.config, null, 2)}</pre>
            </details>
            <Button variant="outline" onClick={onCancelEdit} disabled={busy}>Cancel editing</Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="space-y-4 pt-5">
          <fieldset disabled={busy} className="grid gap-4 @min-[480px]/native:grid-cols-2">
            <label className="text-sm font-medium">
              Service
              <select
                aria-label="Huawei service"
                className={selectClass}
                value={service}
                onChange={(e) => {
                  reset();
                  setService(e.target.value);
                }}
              >
                {(services ?? [{ id: service, name: names[service] ?? service }]).map((s) => (
                  <option key={s.id} value={s.id}>
                    {names[s.id] ?? s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Region
              <select
                aria-label="Huawei region"
                className={selectClass}
                value={region}
                onChange={(e) => {
                  reset();
                  setRegion(e.target.value);
                }}
              >
                {(directory?.regions ?? [{ id: region, name: "Hong Kong" }]).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {r.id}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
          <label className="block text-sm font-medium">
            Billing mode
            <select aria-label="Huawei billing mode" className={selectClass} value={billingMode} disabled={busy || !modes.length}
              onChange={event => {
                const mode = event.target.value as NativeBillingMode;
                setBillingMode(mode);
                if (state) void open(mode); else reset();
              }}>
              {modes.map(mode => <option key={mode} value={mode}>{nativeBillingModes[mode].label}</option>)}
            </select>
          </label>
          {directory && !modes.length && <p role="status" className="text-sm text-zinc-600">Huawei has no calculator billing modes for this service in the selected region.</p>}
          <div className="flex flex-wrap items-center gap-4">
            <Button disabled={busy || !directory || !modes.length} onClick={() => void open()}>
              {state ? "Reload current Huawei data" : "Open calculator"}
            </Button>
            <a
              className="text-sm underline"
              href={`https://www.huaweicloud.com/intl/en-us/pricing/calculator.html?region=${encodeURIComponent(region)}&inIframe=true#/${encodeURIComponent(service)}`}
              target="_blank"
              rel="noreferrer"
            >
              Compare with Huawei ↗
            </a>
          </div>
          <p className="text-xs text-zinc-500">
            Services and regions are discovered automatically. Availability depends on the selected service. Unsupported
            controls or incomplete responses stop pricing.
          </p>
        </CardContent>
      </Card>
      {busy && (
        <p role="status" className="text-sm">
          {state ? "Updating options and checking the Huawei price…" : "Loading the official calculator…"}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {state && (
        <div className="grid items-start gap-4 @min-[760px]/native:grid-cols-[minmax(0,1fr)_280px]">
          <Card>
            <CardHeader>
              <CardTitle>{names[service] ?? services?.find((s) => s.id === service)?.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <fieldset disabled={busy} className="space-y-5">
                {state.fields.map((field) => (
                  <div key={`${state.revision}:${field.id}`}>
                    {field.type === "action" ? (
                      <Button
                        variant="outline"
                        data-field-id={field.id}
                        disabled={field.disabled}
                        onClick={() => change(field, true)}
                      >
                        {field.label}
                      </Button>
                    ) : field.type === "checkbox" ? (
                      <label className="flex items-center gap-3 text-sm">
                        <input
                          data-field-id={field.id}
                          type="checkbox"
                          disabled={field.disabled}
                          checked={!!field.value}
                          onChange={(e) => change(field, e.target.checked)}
                        />
                        {field.label}
                      </label>
                    ) : (
                      <label className="block text-sm font-medium">
                        {field.label}
                        {field.unit && <span className="ml-1 font-normal text-zinc-500">({field.unit})</span>}
                        {field.type === "select" ? (
                          <select
                            data-field-id={field.id}
                            aria-label={field.label}
                            disabled={field.disabled}
                            className={selectClass}
                            value={String(field.value)}
                            onChange={(e) => change(field, e.target.value)}
                          >
                            {field.disabled && field.options?.length === 0 && (
                              <option value={String(field.value)}>Not available for this configuration</option>
                            )}
                            {field.options?.map((option) => (
                              <option key={option.value} value={option.value} disabled={option.disabled}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Numeric
                            field={field}
                            invalidate={() => setState((previous) => (previous ? { ...previous, quote: null } : null))}
                            change={(value) => change(field, value)}
                          />
                        )}
                      </label>
                    )}
                  </div>
                ))}
              </fieldset>
              {state.notes.length > 0 && (
                <details className="mt-6 text-sm">
                  <summary className="cursor-pointer">Huawei configuration notes</summary>
                  <div className="mt-3 space-y-3 text-zinc-600">
                    {state.notes.map((note, i) => (
                      <p key={i}>{note}</p>
                    ))}
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
          <Card className="min-w-0 @min-[760px]/native:sticky @min-[760px]/native:top-20">
            <CardHeader>
              <CardTitle>Current estimate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {state.quote && !busy ? (
                <>
                  <p data-testid="lab-price" className="text-3xl font-semibold">
                    {state.quote.currency}{" "}
                    {state.quote.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                  </p>
                  <p className="text-xs text-zinc-500">
                    For the selected duration, usage and quantity. Checked{" "}
                    {new Date(state.quote.quotedAt).toLocaleTimeString()}.
                  </p>
                  <p data-testid="scope-status" className="text-sm text-green-700">
                    Complete Huawei pricing response
                  </p>
                </>
              ) : (
                <p data-testid="scope-status" className="text-sm text-amber-800">
                  {busy ? "Waiting for the updated configuration" : "Price unavailable"}
                </p>
              )}
              {state.priceError && (
                <p role="alert" className="text-sm text-red-700">
                  {state.priceError}
                </p>
              )}
              {state.service === "ecs" && state.diagnostics.some(message => message.startsWith("No selected option for Image")) && (
                <p className="text-sm text-amber-800">Huawei has no image choices for this selection. Choose another generation or CPU architecture to check its available images.</p>
              )}
              {state.diagnostics.map((diagnostic) => (
                <p key={diagnostic} role="alert" className="text-sm text-amber-800">
                  {diagnostic}
                </p>
              ))}
              {state.quote && (
                <details className="text-sm">
                  <summary className="cursor-pointer">Price components</summary>
                  <ul className="mt-3 space-y-3">
                    {state.quote.breakdown.map((product) => (
                      <li key={product.id}>
                        <p className="break-all">{product.label ?? product.id}</p>
                        <p className="text-zinc-500">
                          USD {product.amount}
                        </p>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {state.quote?.payment && (
                <div className="space-y-1 text-sm" data-testid="native-payment">
                  <p>Upfront: USD {state.quote.payment.upfront.toLocaleString("en-US", {minimumFractionDigits:2,maximumFractionDigits:6})}</p>
                  <p>Installment: USD {state.quote.payment.recurring.toLocaleString("en-US", {minimumFractionDigits:2,maximumFractionDigits:6})} / {state.quote.payment.period} × {state.quote.payment.installments}</p>
                  {state.quote.payment.extras.map(extra => <p key={extra.mode}>{nativeBillingModes[extra.mode as NativeBillingMode]?.label ?? extra.mode} extras: USD {extra.recurring.toLocaleString("en-US", {minimumFractionDigits:2,maximumFractionDigits:6})} / {state.quote!.payment!.period} × {state.quote!.payment!.installments}</p>)}
                </div>
              )}
              {onSave && (
                <div className="space-y-2">
                  {legacy && <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={legacyReviewed} disabled={busy}
                      onChange={event => setLegacyReviewed(event.target.checked)} />
                    I reviewed these selections against the original estimate.
                  </label>}
                  <Button onClick={save} disabled={busy || !state.quote || (legacy && !legacyReviewed)}>
                    {editingProduct ? "Save Changes" : "Add to List"}
                  </Button>
                  {editingProduct && (
                    <Button variant="outline" onClick={onCancelEdit} disabled={busy}>
                      Cancel
                    </Button>
                  )}
                  {saveMessage && (
                    <p role="status" className="text-sm">
                      {saveMessage}
                    </p>
                  )}
                </div>
              )}
              <p className="text-xs text-zinc-500">
                Sessions close after 10 minutes of inactivity. Reopen to refresh the catalog.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
      <p className="text-xs text-zinc-500">
        Huawei supplies the available controls and pricing requests. ECS, ELB, DCS and NAT are the focus of comparison
        tests; other discovered services may require additional control support.
      </p>
    </section>
  );
}
