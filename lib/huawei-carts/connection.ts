import { createHash, randomBytes } from "node:crypto";
import { db } from "../db";
import { seal, unseal } from "./secrets";
import { HuaweiConnectionError } from "./login";

export const connectionCookieName =
  process.env.NODE_ENV === "production"
    ? "__Host-neo_huawei_connection"
    : "neo_huawei_connection";
const lifetime = 8 * 60 * 60 * 1000;
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
function table() {
  db.exec(
    "CREATE TABLE IF NOT EXISTS huawei_connection (id TEXT PRIMARY KEY, secret TEXT NOT NULL, account TEXT NOT NULL, username TEXT NOT NULL, expires_at INTEGER NOT NULL)",
  );
  db.query("DELETE FROM huawei_connection WHERE expires_at < ?").run(
    Date.now(),
  );
}
export function connectionId(request: Request) {
  return (
    request.headers
      .get("cookie")
      ?.split(";")
      .map((value) => value.trim())
      .find((value) => value.startsWith(connectionCookieName + "="))
      ?.slice(connectionCookieName.length + 1) ?? ""
  );
}
export function forgetConnection(request: Request) {
  table();
  const token = connectionId(request);
  if (token)
    db.query("DELETE FROM huawei_connection WHERE id = ?").run(hash(token));
}
export function saveConnection(
  request: Request,
  session: { cookie: string; account: string; username: string },
) {
  table();
  const token = randomBytes(32).toString("base64url"),
    expiresAt = Date.now() + lifetime;
  db.transaction(() => {
    forgetConnection(request);
    db.query(
      "INSERT INTO huawei_connection (id, secret, account, username, expires_at) VALUES (?, ?, ?, ?, ?)",
    ).run(
      hash(token),
      seal(session.cookie),
      session.account,
      session.username,
      expiresAt,
    );
  })();
  return { token, expiresAt };
}
export function getConnection(request: Request) {
  table();
  const token = connectionId(request);
  const row =
    token && /^[\w-]{43}$/.test(token)
      ? (db
          .query(
            "SELECT * FROM huawei_connection WHERE id = ? AND expires_at > ?",
          )
          .get(hash(token), Date.now()) as {
          secret: string;
          account: string;
          username: string;
          expires_at: number;
        } | null)
      : null;
  if (!row)
    throw new HuaweiConnectionError(
      "Connect your Huawei Cloud account to continue.",
      401,
    );
  try {
    return {
      cookie: unseal(row.secret),
      account: row.account,
      username: row.username,
      expiresAt: row.expires_at,
    };
  } catch {
    forgetConnection(request);
    throw new HuaweiConnectionError(
      "Reconnect your Huawei Cloud account to continue.",
      401,
    );
  }
}
export function connectionCookie(token: string, expiresAt = 0) {
  return `${connectionCookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)) : 0}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? new URL(request.url).host;
  let matches = false;
  try {
    matches = !!origin && new URL(origin).host === host;
  } catch {
    /* Invalid origins are rejected. */
  }
  if (!matches || request.headers.get("sec-fetch-site") === "cross-site")
    throw new HuaweiConnectionError(
      "Open this action from NeoCalculator.",
      403,
    );
}
