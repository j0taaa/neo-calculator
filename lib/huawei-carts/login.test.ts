import { expect, test } from "bun:test";
import { establishHuaweiSession, HuaweiConnectionError } from "./login";
import type { HuaweiHttp, HuaweiResponse } from "./http";

function fixture(responses?: HuaweiResponse[]) {
  const calls: { url: string; options: unknown }[] = [];
  const queue = responses ?? [
    {
      status: 201,
      headers: { "x-subject-token": "iam-secret" },
      body: JSON.stringify({ token: { user: { name: "account" } } }),
    },
    {
      status: 201,
      headers: {},
      body: JSON.stringify({
        credential: {
          access: "ak",
          secret: "sk",
          securitytoken: "temporary-secret",
        },
      }),
    },
    {
      status: 201,
      headers: { "x-subject-logintoken": "login-secret" },
      body: "{}",
    },
    {
      status: 302,
      headers: {
        location:
          "https://portal-intl.huaweicloud.com/index/islogin?ticket=secret",
      },
      body: "",
    },
    { status: 200, headers: {}, body: 'loginCallback({"flag":1})' },
  ];
  const http: HuaweiHttp = {
    request: async (url, options) => {
      calls.push({ url, options });
      return queue.shift()!;
    },
    cookies: async () => "HWS_INTL_ID=session-secret; portal_csrf=csrf-secret",
  };
  return { calls, http, queue };
}
const input = { account: "account", password: "special<>&$()password" };
test("account login repeats the account ID as username and establishes a portal session without a browser", async () => {
  const { calls, http } = fixture();
  const session = await establishHuaweiSession(input, http);
  expect(calls).toHaveLength(5);
  expect(calls[0].options).toEqual({
    body: {
      auth: {
        identity: {
          methods: ["password"],
          password: {
            user: {
              name: "account",
              password: input.password,
              domain: { name: "account" },
            },
          },
        },
        scope: { domain: { name: "account" } },
      },
    },
  });
  expect(new URL(calls[3].url).searchParams.get("service")).toBe(
    "https://portal-intl.huaweicloud.com/index/islogin?callback=loginCallback",
  );
  expect(session).toEqual({
    cookie: "HWS_INTL_ID=session-secret; portal_csrf=csrf-secret",
    account: "account",
    username: "account",
  });
  expect(JSON.stringify(session)).not.toContain(input.password);
  expect(
    calls.every((call) => !/pricing|inquiry|calculator\.html/.test(call.url)),
  ).toBe(true);
});
test("IAM users retain their separate username and virtual MFA payload", async () => {
  const { calls, http } = fixture();
  await establishHuaweiSession(
    {
      ...input,
      username: "iam-user",
      verificationCode: "123456",
      userId: "user-id",
    },
    http,
  );
  const body = calls[0].options as {
    body: {
      auth: {
        identity: {
          methods: string[];
          password: { user: { name: string } };
          totp: unknown;
        };
      };
    };
  };
  expect(body.body.auth.identity.methods).toEqual(["password", "totp"]);
  expect(body.body.auth.identity.password.user.name).toBe("iam-user");
  expect(body.body.auth.identity.totp).toEqual({
    user: { id: "user-id", passcode: "123456" },
  });
});
test("bad passwords stop after one request and never echo upstream credentials", async () => {
  const { http, calls } = fixture([
    {
      status: 401,
      headers: {},
      body: JSON.stringify({ error: { message: input.password } }),
    },
  ]);
  try {
    await establishHuaweiSession(input, http);
    throw new Error("Expected login failure");
  } catch (error) {
    expect(error).toBeInstanceOf(HuaweiConnectionError);
    expect(String(error)).not.toContain(input.password);
  }
  expect(calls).toHaveLength(1);
});
test("MFA challenges are actionable and do not trigger automatic password retries", async () => {
  const { http, calls } = fixture([
    {
      status: 401,
      headers: {},
      body: '{"error":{"message":"MFA code required"}}',
    },
  ]);
  try {
    await establishHuaweiSession(input, http);
  } catch (error) {
    expect((error as HuaweiConnectionError).verificationRequired).toBe(true);
  }
  expect(calls).toHaveLength(1);
});
test("login redirects cannot send tokens outside the Huawei auth and portal hosts", async () => {
  const { http, queue, calls } = fixture();
  queue[3].headers.location = "https://example.com/leak";
  await expect(establishHuaweiSession(input, http)).rejects.toThrow(
    "unexpected login redirect",
  );
  expect(calls).toHaveLength(4);
});
test("a false portal login or absent cookie cannot count as a successful connection", async () => {
  for (const missingCookie of [false, true]) {
    const { http, queue } = fixture();
    if (missingCookie)
      http.cookies = async () => "portal_csrf=not-authentication";
    else queue[4].body = 'loginCallback({"flag":0})';
    await expect(establishHuaweiSession(input, http)).rejects.toThrow(
      "additional website verification",
    );
  }
});
