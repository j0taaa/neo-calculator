import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { sanitizeRedirectPath } from "@/lib/safe-navigation";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname !== "/sign-in" && pathname !== "/sign-up") {
    return NextResponse.next();
  }

  const requestedRedirect = request.nextUrl.searchParams.get("redirect");
  if (!requestedRedirect) {
    return NextResponse.next();
  }

  const safeRedirect = sanitizeRedirectPath(requestedRedirect, "/");
  if (safeRedirect === requestedRedirect) {
    return NextResponse.next();
  }

  const sanitizedUrl = request.nextUrl.clone();
  if (safeRedirect === "/") {
    sanitizedUrl.searchParams.delete("redirect");
  } else {
    sanitizedUrl.searchParams.set("redirect", safeRedirect);
  }

  return NextResponse.redirect(sanitizedUrl);
}

export const config = {
  matcher: ["/sign-in", "/sign-up"],
};
