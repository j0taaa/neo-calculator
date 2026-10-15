"use client";
import { useEffect, useRef, useState } from "react";
import type { AppProduct, CatalogFlavor } from "@/lib/calculator-types";
import type { CalculatorScope } from "@/lib/calculator/service-directory";
import { legacyHuaweiConfiguration, isLegacyHuaweiProduct } from "./legacy-product";
import { parseNativeSelection, selectionBillingMode } from "./native-selection";
import type { NativeField, NativeState } from "./native-types";
import { nativeRequest, closeNativeSession, cancelNativeOperation } from "./native-request";
import { configureNativeFlavor } from "./native-flavor";

export function useNativeSession(scope: CalculatorScope, editingProduct?: AppProduct | null,
  onRestoreScope?: (scope: CalculatorScope) => void, ready = true, autoOpen = false) {
  const [state, setState] = useState<NativeState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = useRef<NativeState | null>(null);
  const epoch = useRef(0);
  const working = useRef(false);
  const pending = useRef<{ controller: AbortController; operationId?: string } | null>(null);
  const restored = useRef<AppProduct | null>(null);
  const attempted = useRef("");
  const previousScope = useRef("");
  const hasOpened = useRef(false);
  const scopeCallback = useRef(onRestoreScope);
  scopeCallback.current = onRestoreScope;
  function reset() {
    epoch.current++;
    if (pending.current?.operationId) cancelNativeOperation(pending.current.operationId);
    pending.current?.controller.abort();
    pending.current = null;
    working.current = false;
    if (current.current) closeNativeSession(current.current.session);
    current.current = null;
    setState(null); setBusy(false); setError("");
  }
  useEffect(() => {
    const leave = () => {
      epoch.current++;
      if (pending.current?.operationId) cancelNativeOperation(pending.current.operationId);
      pending.current?.controller.abort();
      if (current.current) closeNativeSession(current.current.session);
      current.current = null;
    };
    window.addEventListener("pagehide", leave);
    return () => { leave(); window.removeEventListener("pagehide", leave); };
  }, []);
  useEffect(() => {
    const key = [scope.service, scope.region, scope.billingMode].join("|");
    if (previousScope.current !== key) {
      reset();
      previousScope.current = key;
      attempted.current = "";
    }
  }, [scope.service, scope.region, scope.billingMode]);
  async function run(request: (signal: AbortSignal, operationId?: string) => Promise<NativeState>, createsSession = false) {
    if (working.current) return;
    working.current = true;
    const generation = epoch.current;
    const controller = new AbortController();
    const operationId = createsSession ? crypto.randomUUID() : undefined;
    if (createsSession) hasOpened.current = true;
    pending.current = { controller, operationId };
    setBusy(createsSession); setError("");
    if (createsSession) setState(null);
    try {
      const next = await request(controller.signal, operationId);
      if (generation !== epoch.current) { closeNativeSession(next.session); return; }
      current.current = next;
      setState(next);
    } catch (error) {
      if (generation === epoch.current) {
        if (createsSession) {
          if (current.current) closeNativeSession(current.current.session);
          current.current = null;
        }
        setState(current.current); setError(error instanceof Error ? error.message : "Calculator unavailable");
      }
    } finally {
      if (generation === epoch.current) { pending.current = null; working.current = false; setBusy(false); }
    }
  }
  useEffect(() => {
    if (!editingProduct) { restored.current = null; return; }
    if (restored.current === editingProduct) return;
    reset();
    attempted.current = "";
    try {
      if (isLegacyHuaweiProduct(editingProduct)) {
        restored.current = editingProduct;
        const saved = legacyHuaweiConfiguration(editingProduct);
        scopeCallback.current?.({ service: saved.service, region: saved.region, billingMode: "ONDEMAND" });
        return;
      }
      const selection = parseNativeSelection((editingProduct.config as { selection?: unknown } | null)?.selection);
      const desired = { service: selection.service, region: selection.region, billingMode: selectionBillingMode(selection) };
      if (scope.service !== desired.service || scope.region !== desired.region || scope.billingMode !== desired.billingMode) {
        scopeCallback.current?.(desired); return;
      }
      restored.current = editingProduct;
      attempted.current = [scope.service, scope.region, scope.billingMode].join("|");
      void run((signal, operationId) => nativeRequest({ action: "restore", selection, operationId }, signal), true);
    } catch (error) { setError(error instanceof Error ? error.message : "Invalid saved Huawei configuration"); }
  }, [editingProduct, scope.service, scope.region, scope.billingMode]);
  useEffect(() => {
    const key = [scope.service, scope.region, scope.billingMode].join("|");
    const canOpen = !editingProduct || isLegacyHuaweiProduct(editingProduct) || restored.current === editingProduct;
    if (ready && canOpen && !working.current && !current.current &&
      autoOpen && attempted.current !== key) {
      // The caller gates initial opening on bookmark hydration. Start on the next
      // turn; retain the debounce for subsequent rapid service/region/mode changes.
      const timer = window.setTimeout(() => {
        attempted.current = key;
        void open();
      }, hasOpened.current ? 200 : 0);
      return () => window.clearTimeout(timer);
    }
  // Editing uses the guarded restore below; changing callbacks must not reopen sessions.
  }, [scope.service, scope.region, scope.billingMode, ready, autoOpen, editingProduct]); // eslint-disable-line react-hooks/exhaustive-deps
  async function open() {
    if (working.current) return;
    reset();
    if (editingProduct && !isLegacyHuaweiProduct(editingProduct)) {
      let selection;
      try { selection = parseNativeSelection((editingProduct.config as { selection?: unknown } | null)?.selection); }
      catch (error) { setError(error instanceof Error ? error.message : "Invalid saved Huawei configuration"); return; }
      if (selection.service === scope.service && selection.region === scope.region && selectionBillingMode(selection) === scope.billingMode) {
        await run((signal, operationId) => nativeRequest({ action: "restore", selection, operationId }, signal), true);
        return;
      }
    }
    await run((signal, operationId) => nativeRequest({ action: "open", ...scope, operationId }, signal), true);
  }
  async function refresh() {
    const previous = current.current;
    if (!previous || working.current) return;
    await run(signal => nativeRequest({ action: "refresh", session: previous.session, revision: previous.revision }, signal));
  }
  async function change(field: NativeField, value: string | number | boolean) {
    const previous = current.current;
    if (!previous || working.current) return;
    await run(signal => nativeRequest({ action: "change", session: previous.session, revision: previous.revision, field: field.id, value }, signal));
  }
  async function chooseFlavor(flavor: CatalogFlavor) {
    const previous = current.current;
    if (!previous || working.current) return;
    const generation = epoch.current;
    await run(signal => configureNativeFlavor(previous, flavor, async (state, field, value) => {
      if (epoch.current !== generation) throw new Error("The calculator selection changed.");
      const next: NativeState = await nativeRequest({ action: "change", session: state.session, revision: state.revision, field: field.id, value }, signal);
      if (epoch.current !== generation) { closeNativeSession(next.session); throw new Error("The calculator selection changed."); }
      current.current = next;
      return next;
    }));
  }
  return { state: state && state.service === scope.service && state.region === scope.region && state.billingMode === scope.billingMode ? state : null,
    busy, error, open, refresh, change, chooseFlavor, reset,
    invalidate: () => setState(previous => previous ? { ...previous, quote: null } : null),
  };
}
