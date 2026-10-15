"use client";
import { useCallback, useEffect, useState } from "react";
export class HuaweiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly verificationRequired = false,
  ) {
    super(message);
  }
}
export async function huaweiRequest<T>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const response = await fetch(`/api/huawei/${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    cache: "no-store",
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const result = await response.json();
  if (
    typeof window !== "undefined" &&
    ((response.ok &&
      path === "connection" &&
      (body !== undefined || method === "DELETE")) ||
      (response.status === 401 && path !== "connection"))
  )
    window.dispatchEvent(new Event("neo-huawei-connection"));
  if (!response.ok)
    throw new HuaweiRequestError(
      result.error ?? "Huawei could not be reached. Please try again.",
      response.status,
      result.verificationRequired,
    );
  return result;
}
export type HuaweiConnection = {
  connected: boolean;
  account?: string;
  username?: string;
  expiresAt?: number;
};
export function useHuaweiConnection() {
  const [connection, setConnection] = useState<HuaweiConnection | null>(null);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      setConnection(await huaweiRequest("connection"));
      setError("");
    } catch {
      setError("Unable to check your Huawei connection. Please retry.");
    }
  }, []);
  useEffect(() => {
    let active = true;
    void huaweiRequest<HuaweiConnection>("connection")
      .then((value) => {
        if (active) setConnection(value);
      })
      .catch(() => {
        if (active)
          setError("Unable to check your Huawei connection. Please retry.");
      });
    const changed = () => {
      void refresh();
    };
    window.addEventListener("neo-huawei-connection", changed);
    window.addEventListener("focus", changed);
    return () => {
      active = false;
      window.removeEventListener("neo-huawei-connection", changed);
      window.removeEventListener("focus", changed);
    };
  }, [refresh]);
  return { connection, setConnection, refresh, error };
}
