"use client";
import { useEffect, useRef, useState } from "react";
import type { AppProduct, CatalogFlavor } from "@/lib/calculator-types";
import type { CalculatorScope } from "@/lib/calculator/service-directory";
import { legacyHuaweiConfiguration, isLegacyHuaweiProduct } from "./legacy-product";
import { parseNativeSelection, selectionBillingMode } from "./native-selection";
import type { NativeField, NativeState } from "./native-types";
import { nativeRequest, closeNativeSession } from "./native-request";
import { configureNativeFlavor } from "./native-flavor";

export function useNativeSession(scope: CalculatorScope, editingProduct?: AppProduct | null,
  onRestoreScope?: (scope: CalculatorScope) => void, ready = true) {
  const [state, setState] = useState<NativeState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = useRef<NativeState | null>(null);
  const epoch = useRef(0);
  const working = useRef(false);
  const restored = useRef<AppProduct | null>(null);
  const reopen = useRef(false);
  const previousScope = useRef("");
  const scopeCallback = useRef(onRestoreScope);
  scopeCallback.current = onRestoreScope;
  function reset() {
    epoch.current++;
    working.current = false;
    if (current.current) closeNativeSession(current.current.session);
    current.current = null;
    setState(null); setBusy(false); setError("");
  }
  useEffect(() => {
    const leave = () => {
      epoch.current++;
      if (current.current) closeNativeSession(current.current.session);
      current.current = null;
    };
    window.addEventListener("pagehide", leave);
    return () => { leave(); window.removeEventListener("pagehide", leave); };
  }, []);
  useEffect(() => {
    const key = [scope.service, scope.region, scope.billingMode].join("|");
    if (previousScope.current !== key) {
      reopen.current ||= !!current.current;
      reset();
      previousScope.current = key;
    }
    if (reopen.current && ready && (!editingProduct || restored.current === editingProduct)) {
      reopen.current = false;
      void open();
    }
  // Editing uses the guarded restore below; changing callbacks must not reopen sessions.
  }, [scope.service, scope.region, scope.billingMode, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  async function run(request: () => Promise<NativeState>) {
    if (working.current) return;
    working.current = true;
    const generation = epoch.current;
    setBusy(true); setError("");
    setState(previous => previous ? { ...previous, quote: null } : null);
    try {
      const next = await request();
      if (generation !== epoch.current) { closeNativeSession(next.session); return; }
      current.current = next;
      setState(next);
    } catch (error) {
      if (generation === epoch.current) {
        if (current.current) closeNativeSession(current.current.session);
        current.current = null;
        setState(null); setError(error instanceof Error ? error.message : "Huawei is unavailable");
      }
    } finally {
      if (generation === epoch.current) { working.current = false; setBusy(false); }
    }
  }
  useEffect(() => {
    if (!editingProduct) { restored.current = null; return; }
    if (restored.current === editingProduct) return;
    reset();
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
      void run(() => nativeRequest({ action: "restore", selection }));
    } catch (error) { setError(error instanceof Error ? error.message : "Invalid saved Huawei configuration"); }
  }, [editingProduct, scope.service, scope.region, scope.billingMode]);
  async function open() {
    if (working.current) return;
    reset();
    await run(() => nativeRequest({ action: "open", ...scope }));
  }
  async function change(field: NativeField, value: string | number | boolean) {
    const previous = current.current;
    if (!previous || working.current) return;
    await run(() => nativeRequest({ action: "change", session: previous.session, revision: previous.revision, field: field.id, value }));
  }
  async function chooseFlavor(flavor: CatalogFlavor) {
    const previous = current.current;
    if (!previous || working.current) return;
    const generation = epoch.current;
    await run(() => configureNativeFlavor(previous, flavor, async (state, field, value) => {
      if (epoch.current !== generation) throw new Error("The calculator selection changed.");
      const next: NativeState = await nativeRequest({ action: "change", session: state.session, revision: state.revision, field: field.id, value });
      if (epoch.current !== generation) { closeNativeSession(next.session); throw new Error("The calculator selection changed."); }
      current.current = next;
      return next;
    }));
  }
  return { state: state && state.service === scope.service && state.region === scope.region && state.billingMode === scope.billingMode ? state : null,
    busy, error, open, change, chooseFlavor, reset,
    invalidate: () => setState(previous => previous ? { ...previous, quote: null } : null),
  };
}
