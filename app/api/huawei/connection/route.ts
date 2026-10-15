import { NextResponse } from "next/server";
import { readResourceJson } from "@/lib/cart-json/http";
import { ResourceDocumentError } from "@/lib/cart-json/types";
import { isRecord } from "@/lib/product-input";
import {
  loginHuawei,
  HuaweiConnectionError,
  type HuaweiCredentials,
} from "@/lib/huawei-carts/login";
import {
  assertSameOrigin,
  getConnection,
  saveConnection,
  forgetConnection,
  connectionCookie,
} from "@/lib/huawei-carts/connection";

export const runtime = "nodejs";
const attempts = new Map<string, { count: number; until: number }>();
export async function GET(request: Request) {
  try {
    const { account, username, expiresAt } = getConnection(request);
    return NextResponse.json(
      { connected: true, account, username, expiresAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { connected: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await readResourceJson(request);
    if (
      !isRecord(input) ||
      typeof input.account !== "string" ||
      typeof input.password !== "string" ||
      ["username", "verificationCode", "userId"].some(
        (key) => input[key] !== undefined && typeof input[key] !== "string",
      )
    )
      throw new HuaweiConnectionError(
        "Enter your Huawei account and password.",
      );
    const now = Date.now();
    for (const [key, value] of attempts)
      if (value.until < now) attempts.delete(key);
    const key = input.account.trim().toLowerCase(),
      limit = attempts.get(key) ?? { count: 0, until: now + 15 * 60000 };
    if (limit.count >= 5 || attempts.size > 10000)
      throw new HuaweiConnectionError(
        "Too many login attempts. Wait 15 minutes before trying again.",
        429,
      );
    limit.count++;
    attempts.set(key, limit);
    const session = await loginHuawei(input as unknown as HuaweiCredentials);
    const saved = saveConnection(request, session);
    attempts.delete(key);
    return NextResponse.json(
      {
        connected: true,
        account: session.account,
        username: session.username,
        expiresAt: saved.expiresAt,
      },
      {
        headers: {
          "Set-Cookie": connectionCookie(saved.token, saved.expiresAt),
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof ResourceDocumentError)
      return NextResponse.json(
        { error: "Send a valid login request smaller than 2 MB." },
        {
          status: error.issues.some(
            (issue) => issue.code === "document.tooLarge",
          )
            ? 413
            : 400,
          headers: { "Cache-Control": "no-store" },
        },
      );
    return NextResponse.json(
      {
        error:
          error instanceof HuaweiConnectionError
            ? error.message
            : "Huawei could not be reached. Please try again.",
        verificationRequired:
          error instanceof HuaweiConnectionError && error.verificationRequired,
      },
      {
        status: error instanceof HuaweiConnectionError ? error.status : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    forgetConnection(request);
    return NextResponse.json(
      { connected: false },
      {
        headers: {
          "Set-Cookie": connectionCookie(""),
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Open this action from NeoCalculator." },
      { status: 403 },
    );
  }
}
