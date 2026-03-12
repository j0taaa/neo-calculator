import { betterAuth } from "better-auth";

import { db } from "@/lib/db";

const authUrl = process.env.BETTER_AUTH_URL?.trim() || process.env.NEXT_PUBLIC_BETTER_AUTH_URL?.trim();
const authSecret =
  process.env.BETTER_AUTH_SECRET ?? "dev-only-better-auth-secret-change-me-1234567890";

export const auth = betterAuth({
  ...(authUrl ? { baseURL: authUrl } : {}),
  database: db,
  secret: authSecret,
  emailAndPassword: {
    enabled: true,
  },
});
