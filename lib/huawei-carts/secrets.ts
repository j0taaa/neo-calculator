import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export function connectionKey() {
  const secret =
    process.env.HUAWEI_CARTS_SECRET ||
    process.env.BETTER_AUTH_SECRET ||
    (process.env.NODE_ENV !== "production"
      ? "neo-development-connection-secret"
      : "");
  if (!secret) throw new Error("Connection encryption is not configured.");
  return createHash("sha256")
    .update("neo-huawei-connection-v1\0" + secret)
    .digest();
}
export function seal(value: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", connectionKey(), iv);
  return Buffer.concat([
    iv,
    cipher.update(value, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64url");
}
export function unseal(value: string) {
  const bytes = Buffer.from(value, "base64url"),
    decipher = createDecipheriv(
      "aes-256-gcm",
      connectionKey(),
      bytes.subarray(0, 12),
    );
  decipher.setAuthTag(bytes.subarray(-16));
  return Buffer.concat([
    decipher.update(bytes.subarray(12, -16)),
    decipher.final(),
  ]).toString("utf8");
}
