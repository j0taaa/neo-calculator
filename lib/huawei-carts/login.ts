import { isRecord } from "../product-input";
import { withHuaweiHttp, type HuaweiHttp, type HuaweiResponse } from "./http";

export class HuaweiConnectionError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly verificationRequired = false,
  ) {
    super(message);
  }
}
export type HuaweiCredentials = {
  account: string;
  username?: string;
  password: string;
  verificationCode?: string;
  userId?: string;
};
const json = (response: HuaweiResponse) => {
  try {
    return JSON.parse(response.body);
  } catch {
    throw new HuaweiConnectionError(
      "Huawei returned an unexpected response. Please try again.",
      502,
    );
  }
};
const iam = "https://iam.myhuaweicloud.com";

/** The website session is separate from an IAM token. Neither needs a browser. */
export async function establishHuaweiSession(
  input: HuaweiCredentials,
  http: HuaweiHttp,
) {
  const account = input.account?.trim(),
    username = input.username?.trim() || account;
  if (
    !account ||
    account.length > 200 ||
    !username ||
    username.length > 200 ||
    typeof input.password !== "string" ||
    !input.password ||
    input.password.length > 1000
  )
    throw new HuaweiConnectionError("Enter your Huawei account and password.");
  if (
    input.verificationCode &&
    (!/^\d{6}$/.test(input.verificationCode) || !input.userId?.trim())
  )
    throw new HuaweiConnectionError(
      "Enter your IAM user ID and six-digit authenticator code.",
      400,
      true,
    );
  const response = await http.request(iam + "/v3/auth/tokens?nocatalog=true", {
    body: {
      auth: {
        identity: {
          methods: input.verificationCode ? ["password", "totp"] : ["password"],
          password: {
            user: {
              domain: { name: account },
              name: username,
              password: input.password,
            },
          },
          ...(input.verificationCode
            ? {
                totp: {
                  user: { id: input.userId, passcode: input.verificationCode },
                },
              }
            : {}),
        },
        scope: { domain: { name: account } },
      },
    },
  });
  const token = response.headers["x-subject-token"];
  if (response.status !== 201 || !token) {
    const detail = json(response);
    const verification = /mfa|totp|passcode|multi.factor/i.test(
      String(detail?.error?.message),
    );
    throw new HuaweiConnectionError(
      verification
        ? "Huawei requires an authenticator code. Enter the verification details below."
        : "Huawei could not sign you in. Check your account, password and programmatic access permissions.",
      401,
      verification,
    );
  }
  const identity = json(response).token?.user;
  const security = await http.request(
    iam + "/v3.0/OS-CREDENTIAL/securitytokens",
    {
      headers: { "X-Auth-Token": token },
      body: {
        auth: {
          identity: { methods: ["token"], token: { duration_seconds: 900 } },
        },
      },
    },
  );
  const credential = security.status === 201 ? json(security).credential : null;
  if (!credential?.access || !credential?.secret || !credential?.securitytoken)
    throw new HuaweiConnectionError(
      "Huawei authenticated you but could not create a website login. Check your account permissions.",
      403,
    );
  const login = await http.request(
    iam + "/v3.0/OS-AUTH/securitytoken/logintokens",
    {
      body: {
        auth: {
          securitytoken: {
            access: credential.access,
            secret: credential.secret,
            id: credential.securitytoken,
            duration_seconds: 600,
          },
        },
      },
    },
  );
  const loginToken = login.headers["x-subject-logintoken"];
  if (login.status !== 201 || !loginToken)
    throw new HuaweiConnectionError(
      "Huawei could not create a website login. Please try again.",
      502,
    );
  const portal =
    "https://portal-intl.huaweicloud.com/index/islogin?callback=loginCallback";
  let url =
    "https://auth.huaweicloud.com/authui/federation/login?" +
    new URLSearchParams({
      idp_login_url: "https://auth.huaweicloud.com/authui/login",
      service: portal,
      logintoken: loginToken,
    });
  let authenticated = false;
  for (let hop = 0; hop < 10; hop++) {
    const target = new URL(url);
    if (
      target.protocol !== "https:" ||
      !["auth.huaweicloud.com", "portal-intl.huaweicloud.com"].includes(
        target.hostname,
      )
    )
      throw new HuaweiConnectionError(
        "Huawei returned an unexpected login redirect.",
        502,
      );
    const result = await http.request(url);
    if (
      [301, 302, 303, 307, 308].includes(result.status) &&
      result.headers.location
    ) {
      url = new URL(result.headers.location, url).href;
      continue;
    }
    authenticated =
      result.status === 200 &&
      target.hostname === "portal-intl.huaweicloud.com" &&
      /["']?flag["']?\s*:\s*1\b/.test(result.body);
    break;
  }
  const cookie = await http.cookies();
  if (!authenticated || !/(?:^|;\s*)HWS_INTL_ID=/.test(cookie))
    throw new HuaweiConnectionError(
      "Huawei requires an additional website verification that this connection cannot complete yet.",
      401,
    );
  return {
    cookie,
    account,
    username:
      isRecord(identity) && typeof identity.name === "string"
        ? identity.name
        : username,
  };
}
export const loginHuawei = (input: HuaweiCredentials) =>
  withHuaweiHttp((http) => establishHuaweiSession(input, http));
