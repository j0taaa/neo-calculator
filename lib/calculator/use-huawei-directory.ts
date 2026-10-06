"use client";
import { useCallback, useEffect, useState } from "react";
import type { NativeDirectory } from "@/lib/huawei-native/native-types";
export function useHuaweiDirectory(enabled = true) {
  const [directory, setDirectory] = useState<NativeDirectory | null>(null);
  const [error, setError] = useState("");
  const [attempt, retry] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController();
    fetch("/api/calculator/native", { signal: abort.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load Huawei services");
      if (!Array.isArray(data.services) || !Array.isArray(data.regions) || !data.billingModes) throw new Error("Incomplete Huawei directory");
      if (!abort.signal.aborted) { setDirectory(data); setError(""); }
    }).catch(error => { if (!abort.signal.aborted) setError(error.message); });
    return () => abort.abort();
  }, [attempt, enabled]);
  return { directory, error, retry: useCallback(() => retry(value => value + 1), []) };
}
