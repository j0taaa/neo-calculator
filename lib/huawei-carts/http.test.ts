import { expect, test } from "bun:test";
import { portalCookieHeader } from "./http";
test("portal cookies respect domains, HttpOnly, session expiry and scope without retaining SSO credentials", () => {
  const raw = [
    "# Netscape HTTP Cookie File",
    "#HttpOnly_.huaweicloud.com\tTRUE\t/\tTRUE\t0\tHWS_INTL_ID\tparent-session",
    "portal-intl.huaweicloud.com\tFALSE\t/\tTRUE\t0\tHWS_INTL_ID\tportal-session",
    "portal-intl.huaweicloud.com\tFALSE\t/\tTRUE\t0\tportal_csrf\tcsrf",
    "auth.huaweicloud.com\tFALSE\t/\tTRUE\t0\tSSOTGC\tprivate-sso",
    "example.com\tFALSE\t/\tTRUE\t0\tHWS_INTL_ID\tother-site",
    "portal-intl.huaweicloud.com\tFALSE\t/\tTRUE\t1\tHWS_INTL_ID\texpired",
  ].join("\n");
  expect(portalCookieHeader(raw)).toBe(
    "HWS_INTL_ID=portal-session; portal_csrf=csrf",
  );
  expect(
    portalCookieHeader(
      "#HttpOnly_.huaweicloud.com\tTRUE\t/\tTRUE\t0\tHWS_INTL_ID\tparent-session",
    ),
  ).toBe("HWS_INTL_ID=parent-session");
});
