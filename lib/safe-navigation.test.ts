import { expect, test } from "bun:test";

import { sanitizeRedirectPath } from "@/lib/safe-navigation";

test("sanitizeRedirectPath keeps same-origin relative paths", () => {
  expect(sanitizeRedirectPath("/projects?tab=shared#list-1")).toBe("/projects?tab=shared#list-1");
});

test("sanitizeRedirectPath falls back for external and protocol-relative values", () => {
  expect(sanitizeRedirectPath("https://example.com/pwn", "/")).toBe("/");
  expect(sanitizeRedirectPath("//example.com/pwn", "/projects")).toBe("/projects");
  expect(sanitizeRedirectPath("javascript:alert(1)", "/sign-in")).toBe("/sign-in");
});
