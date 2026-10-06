"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OptionGrid } from "@/components/ui/option-grid";
import { NativeChoiceField } from "./native-choice-field";
import { NativeNumericField } from "./native-numeric-field";
import { NativeFlavorBrowser } from "./native-flavor-browser";
import type { AppProduct, ProductMutationBody } from "@/lib/calculator-types";
import { useHuaweiDirectory } from "@/lib/calculator/use-huawei-directory";
import { availableMode, type CalculatorScope } from "@/lib/calculator/service-directory";
import { nativeBillingModes, type NativeBillingMode } from "@/lib/huawei-native/native-billing";
import type { NativeDirectory } from "@/lib/huawei-native/native-types";
import { isLegacyHuaweiProduct } from "@/lib/huawei-native/legacy-product";
import { useNativeSession } from "@/lib/huawei-native/use-native-session";
import { nativeDraft } from "@/lib/huawei-native/native-draft";

const names: Record<string, string> = { ecs: "ECS · Elastic Cloud Server", elb: "ELB · Elastic Load Balance", redis: "DCS · Redis", nat: "NAT Gateway" };
export function NativeCalculatorPanel({ editingProduct, onSave, onCancelEdit, scope, onScopeChange,
  directory: suppliedDirectory, embedded = false, canSave = true, onQueue, autoOpen = true }: {
  editingProduct?: AppProduct | null;
  onSave?: (product: ProductMutationBody) => Promise<void>;
  onCancelEdit?: () => void;
  scope?: CalculatorScope;
  onScopeChange?: (scope: CalculatorScope) => void;
  directory?: NativeDirectory | null;
  embedded?: boolean;
  autoOpen?: boolean;
  canSave?: boolean;
  onQueue?: (product: ProductMutationBody) => void;
}) {
  const ownDirectory = useHuaweiDirectory(!embedded);
  const directory = embedded ? suppliedDirectory : ownDirectory.directory;
  const [localScope, setLocalScope] = useState<CalculatorScope>({ service: "ecs", region: "ap-southeast-1", billingMode: "ONDEMAND" });
  const activeScope = scope ?? localScope;
  const updateScope = onScopeChange ?? setLocalScope;
  const { service, region, billingMode } = activeScope;
  const modes = directory?.billingModes[service]?.[region] ?? [];
  useEffect(() => {
    if (directory) {
      const mode = availableMode(directory, activeScope);
      if (mode !== billingMode) updateScope({ ...activeScope, billingMode: mode });
    }
  }, [directory, service, region, billingMode]); // eslint-disable-line react-hooks/exhaustive-deps
  const { state, busy: loading, error: sessionError, open, refresh, change, chooseFlavor, invalidate } = useNativeSession(activeScope, editingProduct, updateScope, modes.includes(billingMode), autoOpen);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const currentScope = useRef(activeScope);
  currentScope.current = activeScope;
  const busy = loading || saving;
  const error = sessionError || (!embedded ? ownDirectory.error : "");
  const [saveMessage, setSaveMessage] = useState("");
  const [title, setTitle] = useState("");
  const legacy = !!editingProduct && isLegacyHuaweiProduct(editingProduct);
  const [legacyReviewed, setLegacyReviewed] = useState(false);
  useEffect(() => { setLegacyReviewed(false); setSaveMessage(""); }, [editingProduct, service, region, billingMode]);
  useEffect(() => { setTitle(editingProduct?.title ?? ""); }, [editingProduct, service]);
  const serviceName = directory?.services.find(s => s.id === service)?.name ?? service;
  async function save() {
    if (!state?.quote || busy || saveLock.current || !onSave || !canSave || (legacy && !legacyReviewed)) return;
    saveLock.current = true;
    const savedScope = JSON.stringify(activeScope);
    setSaving(true); setSaveMessage("");
    try {
      await onSave(nativeDraft(state, serviceName, title || serviceName));
      if (JSON.stringify(currentScope.current) === savedScope) setSaveMessage(editingProduct ? "Product updated with a fresh Huawei price." : "Product added with a fresh Huawei price.");
    } catch (error) {
      if (JSON.stringify(currentScope.current) === savedScope) { invalidate(); setSaveMessage(error instanceof Error ? error.message : "Unable to save product"); }
    } finally { saveLock.current = false; setSaving(false); }
  }
  const services = directory?.services
    .slice()
    .sort((a, b) => Number(!!names[b.id]) - Number(!!names[a.id]) || a.name.localeCompare(b.name));
  return (
    <section data-calculator-shortcut-root className="@container/native mx-auto min-w-0 space-y-5 px-4 py-4 pb-6">
      {!embedded && <div>
        <h1 className="text-xl font-semibold @min-[640px]/native:text-2xl">Huawei live calculator</h1>
        <p className="mt-3 max-w-3xl text-sm text-zinc-600">
          Configure services using Huawei’s current options and regional rules. Prices come directly from Huawei after
          each change. Billing modes, purchase terms and payment options follow the selected service and region.
        </p>
      </div>}
      {legacy && editingProduct && (
        <Card>
          <CardHeader><CardTitle>Review the original estimate</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">This estimate used the retired calculator. Reselect its options. Your saved estimate stays unchanged until you save.</p>
            <p className="text-sm font-medium">{editingProduct.title}</p>
            <details>
              <summary className="cursor-pointer text-sm">Original saved configuration</summary>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-zinc-50 p-3 text-xs">{JSON.stringify(editingProduct.config, null, 2)}</pre>
            </details>
            <Button variant="outline" onClick={onCancelEdit} disabled={busy}>Cancel editing</Button>
          </CardContent>
        </Card>
      )}
      <div className="space-y-5">
        <fieldset disabled={busy} className="grid min-w-0 gap-4 @min-[480px]/native:grid-cols-2">
          {onSave && <label className="space-y-2 text-sm font-medium">Description (Optional)
            <Input aria-label="Description" value={title} onChange={event => setTitle(event.target.value)} placeholder={serviceName} disabled={busy} />
          </label>}
          {!embedded && <label className="space-y-2 text-sm font-medium">Service
            <NativeChoiceField label="Huawei service" value={service} disabled={busy}
              onChange={service => updateScope({ ...activeScope, service })}
              options={(services ?? [{ id: service, name: names[service] ?? service }]).map(s => ({ value: s.id, label: names[s.id] ?? s.name }))} />
          </label>}
          <label className="space-y-2 text-sm font-medium">Region
            <NativeChoiceField label="Huawei region" value={region} disabled={busy}
              onChange={region => updateScope({ ...activeScope, region })}
              options={(directory?.regions ?? [{ id: region, name: region }]).map(r => ({ value: r.id, label: r.name }))} />
          </label>
        </fieldset>
        <div className="space-y-2 text-sm font-medium">
          <p>Billing Mode</p>
          <OptionGrid name="Billing Mode" ariaLabel="Huawei billing mode" value={billingMode} disabled={busy || !modes.length}
            onChange={mode => updateScope({ ...activeScope, billingMode: mode as NativeBillingMode })}
            items={modes.map(mode => ({ value: mode, label: nativeBillingModes[mode].label }))} />
        </div>
        {directory && !modes.length && <p role="status" className="text-sm text-zinc-600">Huawei has no calculator billing modes for this service in the selected region.</p>}
      </div>
      {busy && <p role="status" className="text-sm text-zinc-500">{state ? "Updating options and checking the Huawei price…" : "Loading the official calculator…"}</p>}
      {error && <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        <p>{error}</p>
        <Button variant="outline" className="mt-3" disabled={busy || !directory || !modes.length} onClick={() => void open()}>Retry calculator</Button>
      </div>}
      {state && (
        <div className="space-y-5">
          <div>
            {service === "ecs" && <NativeFlavorBrowser region={region} billingMode={billingMode} disabled={busy} onSelect={chooseFlavor} />}
              <fieldset disabled={busy} className="min-w-0 space-y-5">
                {state.fields.map((field) => (
                  <div data-calculator-focus-group key={`${state.revision}:${field.id}`}>
                    {field.type === "action" ? (
                      <Button
                        variant="outline"
                        data-calculator-focus-target data-field-id={field.id}
                        disabled={field.disabled}
                        onClick={() => change(field, true)}
                      >
                        {field.label}
                      </Button>
                    ) : field.type === "checkbox" ? (
                      <label className="flex items-center gap-3 text-sm">
                        <input
                          data-calculator-focus-target data-field-id={field.id}
                          type="checkbox"
                          disabled={field.disabled}
                          checked={!!field.value}
                          onChange={(e) => change(field, e.target.checked)}
                        />
                        {field.label}
                      </label>
                    ) : (
                      <div className="text-sm font-medium">
                        {field.label}
                        {field.unit && <span className="ml-1 font-normal text-zinc-500">({field.unit})</span>}
                        {field.type === "select" ? (
                          field.presentation === "options" ? <div className="mt-2" data-field-id={field.id}>
                            <OptionGrid name={field.label} value={String(field.value)} items={field.options ?? []}
                              disabled={busy || field.disabled} onChange={value => change(field, value)} />
                          </div> : <div className="mt-2">
                            <NativeChoiceField label={field.label} value={String(field.value)} options={field.options ?? []}
                              fieldId={field.id} disabled={busy || field.disabled} onChange={value => change(field, value)} />
                          </div>
                        ) : (
                          <NativeNumericField
                            field={field}
                            invalidate={invalidate}
                            change={(value) => change(field, value)}
                          />
                        )}
                        {field.hint && <span className="mt-2 block text-xs font-normal text-zinc-500">{field.hint}</span>}
                      </div>
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
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="space-y-4">
              <p className="text-sm font-medium text-zinc-500">Current estimate</p>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0 space-y-2">
              {state.quote && !busy ? (
                <>
                  <p data-testid="lab-price" className="text-3xl font-semibold tracking-tight">
                    {state.quote.currency}{" "}
                    {state.quote.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                  </p>
                  <p className="text-xs text-zinc-500">
                    For the selected duration, usage and quantity. Checked{" "}
                    {new Date(state.quote.quotedAt).toLocaleTimeString()}.
                  </p>
                  <p data-testid="scope-status" className="text-sm text-green-700">
                    Price checked with Huawei
                  </p>
                </>
              ) : (
                <p data-testid="scope-status" className="text-sm text-amber-800">
                  {busy ? "Waiting for the updated configuration" : "Price unavailable"}
                </p>
              )}
                </div>
              {onSave && (
                <div className="flex flex-wrap items-center gap-2">
                  {legacy && <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={legacyReviewed} disabled={busy}
                      onChange={event => setLegacyReviewed(event.target.checked)} />
                    I reviewed these selections against the original estimate.
                  </label>}
                  <Button data-calculator-add-button onClick={save} disabled={busy || !canSave || !state.quote || (legacy && !legacyReviewed)}>
                    {editingProduct ? "Save Changes" : "Add to List"}
                  </Button>
                  {!editingProduct && onQueue && <Button variant="outline" disabled={busy || !state.quote} onClick={() => {
                    onQueue(nativeDraft(state, serviceName, title || serviceName, true));
                    setSaveMessage("Configuration queued for batch.");
                  }}>Queue for batch</Button>}
                  {!canSave && <p className="text-sm text-zinc-500">Sign in and select a cart to save.</p>}
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
              </div>
              {state.priceError && (
                <div role="alert" className="space-y-2 text-sm text-red-700">
                  <p>{state.priceError}</p>
                  <Button variant="outline" disabled={busy} onClick={() => void refresh()}>Retry price</Button>
                </div>
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
              <a className="text-xs text-zinc-500 underline underline-offset-4"
                href={`https://www.huaweicloud.com/intl/en-us/pricing/calculator.html?region=${encodeURIComponent(region)}&inIframe=true#/${encodeURIComponent(service)}`}
                target="_blank" rel="noopener noreferrer">Compare with Huawei</a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
