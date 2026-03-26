import { betterAuth } from "better-auth";

import { db } from "@/lib/db";

const authUrl = process.env.BETTER_AUTH_URL?.trim() || process.env.NEXT_PUBLIC_BETTER_AUTH_URL?.trim();

function resolveAuthSecret() {
  const configuredSecret = process.env.BETTER_AUTH_SECRET?.trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV !== "production") {
    return "dev-only-better-auth-secret-change-me-1234567890";
  }

  throw new Error("BETTER_AUTH_SECRET is required in production.");
}

const authSecret = resolveAuthSecret();

function splitEnvList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function expandHostToOrigins(hostOrOrigin: string) {
  if (hostOrOrigin.includes("://")) {
    return [hostOrOrigin];
  }

  const origins = [`https://${hostOrOrigin}`, `http://${hostOrOrigin}`];
  return [...new Set(origins)];
}

const defaultAllowedHosts = ["localhost:3000", "127.0.0.1:3000", "hwctools.site:3000", "hwctools.site"];
const configuredAllowedHosts = splitEnvList(process.env.BETTER_AUTH_ALLOWED_HOSTS);
const allowedHosts = [...new Set([...(configuredAllowedHosts.length ? configuredAllowedHosts : defaultAllowedHosts)])];
const configuredTrustedOrigins = splitEnvList(process.env.BETTER_AUTH_TRUSTED_ORIGINS);

const trustedOrigins = [
  ...configuredTrustedOrigins,
  ...allowedHosts.flatMap(expandHostToOrigins),
];

export const auth = betterAuth({
  baseURL: authUrl
    ? authUrl
    : {
        fallback: "http://localhost:3000",
        allowedHosts,
      },
  trustedOrigins,
  database: db,
  secret: authSecret,
  emailAndPassword: {
    enabled: true,
  },
});
