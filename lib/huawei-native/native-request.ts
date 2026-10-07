import {
  localRequest,
  closeLocalSession,
  cancelLocalOperation,
} from "../huawei-snapshot/client";

export async function nativeRequest(body?: unknown, signal?: AbortSignal) {
  if (body) return localRequest(body as Record<string, unknown>, signal);
  const response = await fetch("/api/calculator/native", { signal });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.error || "The daily calculator snapshot is unavailable",
    );
  return data;
}
export const closeNativeSession = closeLocalSession;
export const cancelNativeOperation = cancelLocalOperation;
