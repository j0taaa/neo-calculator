import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type HuaweiResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
};
export type HuaweiHttp = {
  request(
    url: string,
    options?: { body?: unknown; headers?: Record<string, string> },
  ): Promise<HuaweiResponse>;
  cookies(): Promise<string>;
};
const quoted = (value: string) => JSON.stringify(value).replace(/\\u0000/g, "");
export function portalCookieHeader(raw: string, now = Date.now()) {
  const values = raw
    .split("\n")
    .map((line) => line.replace(/^#HttpOnly_/, ""))
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.trimEnd().split("\t"));
  const host = "portal-intl.huaweicloud.com";
  return [
    ...new Map(
      values
        .filter(([domain, subdomains, path, , expiry, name]) => {
          const base = domain?.replace(/^\./, "");
          return (
            (host === base ||
              (subdomains === "TRUE" && host.endsWith("." + base))) &&
            path === "/" &&
            (expiry === "0" || Number(expiry) * 1000 > now) &&
            ["HWS_INTL_ID", "portal_csrf"].includes(name)
          );
        })
        .sort((a, b) => a[0].length - b[0].length)
        .map(([, , , , , name, value]) => [name, value]),
    ),
  ]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

/** Credentials travel through stdin, never process arguments, shell interpolation or logs. */
export async function withHuaweiHttp<T>(
  operation: (http: HuaweiHttp) => Promise<T>,
): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "neo-huawei-login-"));
  const jar = join(directory, "cookies");
  let sequence = 0;
  try {
    return await operation({
      async request(url, options = {}) {
        const target = new URL(url);
        if (
          target.protocol !== "https:" ||
          ![
            "iam.myhuaweicloud.com",
            "auth.huaweicloud.com",
            "portal-intl.huaweicloud.com",
          ].includes(target.hostname)
        )
          throw new Error("Unexpected Huawei login redirect.");
        const number = sequence++,
          headersFile = join(directory, `headers-${number}`),
          bodyFile = join(directory, `body-${number}`);
        const proxy =
          process.env.HWC_DISABLE_PROXY === "1"
            ? ""
            : process.env.HWC_SOCKS5_PROXY?.trim() ||
              "socks5h://127.0.0.1:40000";
        const settings: Record<string, string> = {
          url,
          "cookie-jar": jar,
          cookie: jar,
          "dump-header": headersFile,
          output: bodyFile,
          "max-time": "30",
          "connect-timeout": "15",
          "max-filesize": "2000000",
          "user-agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
        };
        if (proxy) settings.proxy = proxy;
        let config =
          Object.entries(settings)
            .map(([key, value]) => `${key} = ${quoted(value)}`)
            .join("\n") + "\n";
        if (target.hostname === "portal-intl.huaweicloud.com")
          config +=
            'header = "Referer: https://www.huaweicloud.com/intl/en-us/pricing/calculator.html?tempShareList=true"\nheader = "Origin: https://www.huaweicloud.com"\n';
        for (const [key, value] of Object.entries(options.headers ?? {}))
          config += `header = ${quoted(`${key}: ${value}`)}\n`;
        if (options.body !== undefined)
          config += `header = "Content-Type: application/json"\ndata = ${quoted(JSON.stringify(options.body))}\n`;
        try {
          // execFile has no stdin option: write through the child pipe explicitly.
          await new Promise<void>((resolve, reject) => {
            const child = execFile(
              "curl",
              ["--silent", "--compressed", "--config", "-"],
              { maxBuffer: 100000, timeout: 35000 },
              (error) =>
                error
                  ? reject(
                      new Error(
                        "Huawei could not be reached. Please try again.",
                      ),
                    )
                  : resolve(),
            );
            child.stdin?.on("error", () => {});
            child.stdin?.end(config);
          });
          const raw = await readFile(headersFile, "utf8");
          const block =
            raw
              .trim()
              .split(/\r?\n\r?\n/)
              .filter((block) => block.startsWith("HTTP/"))
              .at(-1) ?? "";
          const [line, ...lines] = block.split(/\r?\n/);
          return {
            status: Number(line.split(" ")[1]),
            headers: Object.fromEntries(
              lines
                .filter((line) => line.includes(":"))
                .map((line) => [
                  line.slice(0, line.indexOf(":")).toLowerCase(),
                  line.slice(line.indexOf(":") + 1).trim(),
                ]),
            ),
            body: await readFile(bodyFile, "utf8"),
          };
        } catch {
          throw new Error("Huawei could not be reached. Please try again.");
        }
      },
      async cookies() {
        return portalCookieHeader(await readFile(jar, "utf8"));
      },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
