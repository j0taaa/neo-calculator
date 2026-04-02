import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

export interface ApiKeyRecord {
  id: string;
  userId: string;
  createdAt: string;
  lastUsedAt: string | null;
}

function generateApiKey(): string {
  return `nck_${randomBytes(24).toString("base64url")}`;
}

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function createApiKeyForUser(userId: string): { key: string; id: string } {
  const key = generateApiKey();
  const keyHash = hashApiKey(key);
  const id = randomBytes(16).toString("hex");
  const now = new Date().toISOString();

  db.query(
    `INSERT INTO api_key (id, user_id, key_hash, created_at) VALUES (?, ?, ?, ?)`,
  ).run(id, userId, keyHash, now);

  return { key, id };
}

export function validateApiKey(key: string): { userId: string; keyId: string } | null {
  const keyHash = hashApiKey(key);
  const now = new Date().toISOString();

  const record = db
    .query<{ id: string; user_id: string }>(`SELECT id, user_id FROM api_key WHERE key_hash = ?`)
    .get(keyHash) as { id: string; user_id: string } | null;

  if (!record) {
    return null;
  }

  db.query(`UPDATE api_key SET last_used_at = ? WHERE id = ?`).run(now, record.id);

  return { userId: record.user_id, keyId: record.id };
}

export function getApiKeyForUser(userId: string): ApiKeyRecord | null {
  const record = db
    .query<{
      id: string;
      user_id: string;
      created_at: string;
      last_used_at: string | null;
    }>(`SELECT id, user_id, created_at, last_used_at FROM api_key WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`)
    .get(userId) as {
      id: string;
      user_id: string;
      created_at: string;
      last_used_at: string | null;
    } | null;

  if (!record) {
    return null;
  }

  return {
    id: record.id,
    userId: record.user_id,
    createdAt: record.created_at,
    lastUsedAt: record.last_used_at,
  };
}

export function deleteApiKeyForUser(userId: string): boolean {
  db.query(`DELETE FROM api_key WHERE user_id = ?`).run(userId);
  return true;
}

export function hasApiKey(userId: string): boolean {
  const result = db
    .query<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM api_key WHERE user_id = ?`)
    .get(userId) as { cnt: number } | null;
  return (result?.cnt ?? 0) > 0;
}