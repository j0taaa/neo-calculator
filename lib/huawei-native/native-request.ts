import {
  localRequest,
  closeLocalSession,
  cancelLocalOperation,
  setLocalDirectory,
} from "../huawei-snapshot/client";

export async function nativeRequest(body?: unknown, signal?: AbortSignal) {
  if (body) {
    const state = await localRequest(body as Record<string, unknown>, signal);
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("neo:calculator-state", { detail: state }));
    return state;
  }
  const response = await fetch("/api/calculator/native", { signal });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.error || "The daily calculator snapshot is unavailable",
    );
  setLocalDirectory(data);
  return data;
}
export const closeNativeSession = closeLocalSession;
export const cancelNativeOperation = cancelLocalOperation;
