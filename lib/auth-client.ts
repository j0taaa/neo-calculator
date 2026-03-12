"use client";

import { createAuthClient } from "better-auth/react";

const authBaseUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL?.trim() || process.env.NEXT_PUBLIC_AUTH_URL?.trim();

export const authClient = createAuthClient(authBaseUrl ? { baseURL: authBaseUrl } : {});
