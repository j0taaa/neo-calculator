export async function nativeRequest<T>(body?: unknown, timeoutMs = 300000): Promise<T> {
  const base = process.env.HUAWEI_NATIVE_URL,
    token = process.env.HUAWEI_NATIVE_TOKEN;
  if (!base || !token) throw new Error("The Huawei live calculator is not enabled");
  const response = await fetch(`${base}/${body ? "session" : "directory"}`, {
    method: body ? "POST" : "GET",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Huawei could not complete this request");
  return data as T;
}
