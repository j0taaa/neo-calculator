import { auth } from "@/lib/auth";

export async function getSessionFromHeaders(headers: Headers) {
  return auth.api.getSession({ headers });
}

export async function readJsonBody<T>(request: Request): Promise<T | null> {
  return (await request.json().catch(() => null)) as T | null;
}

export function jsonError(error: string, status = 400) {
  return Response.json({ error }, { status });
}

export function getTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
