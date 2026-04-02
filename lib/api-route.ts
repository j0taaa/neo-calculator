import { auth } from "@/lib/auth";
import { validateApiKey } from "@/lib/api-keys";

export async function getSessionFromHeaders(headers: Headers) {
  return auth.api.getSession({ headers });
}

export async function getApiKeyUser(headers: Headers): Promise<{ userId: string; keyId: string } | null> {
  const apiKey = headers.get("X-API-Key");
  if (!apiKey) {
    return null;
  }
  return validateApiKey(apiKey);
}

export async function getUserFromRequest(request: Request): Promise<{ userId: string; source: "api-key" | "session" } | null> {
  const apiKeyUser = await getApiKeyUser(request.headers);
  if (apiKeyUser) {
    return { userId: apiKeyUser.userId, source: "api-key" };
  }
  const session = await getSessionFromHeaders(request.headers);
  if (session) {
    return { userId: session.user.id, source: "session" };
  }
  return null;
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
