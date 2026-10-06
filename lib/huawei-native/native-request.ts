export async function nativeRequest(body?: unknown, signal?: AbortSignal) {
  const response = await fetch("/api/calculator/native", body ? {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal,
  } : undefined);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Huawei is unavailable");
  return data;
}
export function closeNativeSession(session: string) {
  void fetch("/api/calculator/native", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "close", session }), keepalive: true,
  }).catch(() => {});
}

export function cancelNativeOperation(operationId: string) {
  void fetch("/api/calculator/native", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "cancel", operationId }), keepalive: true,
  }).catch(() => {});
}
