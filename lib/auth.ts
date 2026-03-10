import { betterAuth } from "better-auth";

import { db } from "@/lib/db";

const authUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const authSecret =
  process.env.BETTER_AUTH_SECRET ?? "dev-only-better-auth-secret-change-me-1234567890";

export const auth = betterAuth({
  database: db,
  baseURL: authUrl,
  secret: authSecret,
  emailAndPassword: {
    enabled: true,
  },
});
