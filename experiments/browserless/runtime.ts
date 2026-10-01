import {
  spawn,
  execFile,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { createInterface } from "node:readline";
import { promisify } from "node:util";
import type { Page } from "playwright";
import {
  readNativeForm,
  validateNativeValue,
} from "../../lib/huawei-sync/native-dom";
import {
  buildNativeQuote,
  readNativePricing,
  type NativeInquiryQuote,
} from "../../lib/huawei-sync/native-pricing";
import { QuoteGateway } from "../../lib/huawei-sync/quotes";
import { canonical, hash } from "../../lib/huawei-sync/store";
import type { Inquiry, Quote } from "../../lib/huawei-sync/types";
import type { NativeForm } from "../../lib/huawei-sync/native-types";
import { DemoSources, type Scope } from "./sources";
const execFileAsync = promisify(execFile);
export type DemoState = NativeForm &
  Scope & {
    quote: Quote | null;
    inquiries: Inquiry[];
    priceError?: string;
    source: Awaited<ReturnType<DemoSources["forScope"]>>["source"];
    logs: string;
    metrics: { rssMiB: number; uptimeSeconds: number };
  };

/** Experimental HTTP + DOM-emulator adapter. Upstream code runs only inside a jailed Node container. */
export class BrowserlessSession {
  private child: ChildProcessWithoutNullStreams;
  private jobs = new Map<
    number,
    {
      resolve: (result: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private next = 0;
  private quotes = new Map<string, NativeInquiryQuote>();
  private gateway = new QuoteGateway();
  private form?: NativeForm;
  private errors: string[] = [];
  private sourceErrors: string[] = [];
  private name = `neo-browserless-${crypto.randomUUID()}`;
  private constructor(
    readonly sources: DemoSources,
    readonly scope: Scope,
    readonly source: DemoState["source"],
  ) {
    this.child = spawn(
      "docker",
      [
        "run",
        "--name",
        this.name,
        "--rm",
        "-i",
        "--network",
        "none",
        "--read-only",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--memory",
        "1536m",
        "--pids-limit",
        "64",
        "--tmpfs",
        "/tmp:rw,noexec,nosuid,size=16m",
        process.env.BROWSERLESS_IMAGE || "neo-browserless-runtime:demo",
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    this.child.stderr.on("data", (chunk) =>
      this.errors.push(String(chunk).slice(0, 5000)),
    );
    this.child.on("error", (error) => this.fail(error));
    this.child.on("exit", (code) =>
      this.fail(
        Error(
          `Emulator exited (${code}): ${this.errors.join("").slice(-1200)}`,
        ),
      ),
    );
    createInterface({ input: this.child.stdout }).on("line", (line) => {
      void this.receive(line);
    });
  }
  private fail(error: Error) {
    for (const job of this.jobs.values()) {
      clearTimeout(job.timer);
      job.reject(error);
    }
    this.jobs.clear();
  }
  private send(message: unknown) {
    if (this.child.stdin.destroyed) throw Error("Emulator closed");
    this.child.stdin.write(JSON.stringify(message) + "\n");
  }
  private async receive(line: string) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      this.fail(Error("Invalid emulator response"));
      return;
    }
    if (message.rpc) {
      try {
        const { url, method, body } = message.request;
        const target = new URL(url);
        let response;
        if (
          target.protocol !== "https:" ||
          !["huaweicloud.com", "hc-cdn.com", "hc-cdn.cn"].some(
            (d) => target.hostname === d || target.hostname.endsWith("." + d),
          )
        )
          throw Error("Blocked request");
        if (
          method === "POST" &&
          target.pathname.endsWith("/inquiry/resource")
        ) {
          const inquiry = JSON.parse(body) as Inquiry;
          if (
            inquiry.regionId !== this.scope.region ||
            inquiry.siteCode !== "HWC" ||
            ![0, 1, 2, 10].includes(inquiry.chargingMode)
          )
            throw Error("Unexpected pricing scope");
          const result = await this.gateway.inquire(inquiry);
          this.quotes.set(hash(canonical(inquiry)), {
            inquiry,
            response: result,
          });
          response = {
            status: 200,
            body: JSON.stringify(result),
            contentType: "application/json",
          };
        } else if (
          method === "GET" &&
          (target.pathname ===
            "/api/cbc/global/rest/cbc/csbpaymentservice/v1/exchange-rate" ||
            url ===
              "https://res-static.hc-cdn.cn/aem/program/prod/common/china/zh-cn/featured/featuredProducts.json" ||
            url.startsWith(
              (await this.sources.getShared()).frameworkUrl.replace(
                /framework\.js$/,
                "",
              ),
            ))
        ) {
          const snapshot = await this.sources.collector.fetch(url, 60 * 60_000);
          response = {
            status: 200,
            body: snapshot.body,
            contentType: target.pathname.endsWith(".js")
              ? "application/javascript"
              : "application/json",
          };
        } else throw Error("Blocked request method");
        this.send({ reply: message.rpc, response });
      } catch (error) {
        this.sourceErrors.push(String(error));
        try {
          this.send({ reply: message.rpc, error: String(error) });
        } catch {}
      }
      return;
    }
    const job = this.jobs.get(message.id);
    if (!job) return;
    clearTimeout(job.timer);
    this.jobs.delete(message.id);
    if (message.error) job.reject(Error(message.error));
    else job.resolve(message.result);
  }
  private call<T>(
    action: string,
    properties: Record<string, unknown> = {},
    timeout = 45000,
  ): Promise<T> {
    const id = ++this.next;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.jobs.delete(id);
        reject(Error(`Emulator ${action} timed out`));
      }, timeout);
      this.jobs.set(id, {
        resolve: (result) => resolve(result as T),
        reject,
        timer,
      });
      this.send({ id, action, ...properties });
    });
  }
  static async open(sources: DemoSources, scope: Scope) {
    const payload = await sources.forScope(scope);
    if (payload.unsupported.length)
      throw Error(
        `This experiment cannot map all inputs for: ${payload.unsupported.join(", ")}. No price is offered.`,
      );
    const session = new BrowserlessSession(sources, scope, payload.source);
    try {
      await session.call("open", { input: payload.input });
      return session;
    } catch (error) {
      await session.close();
      throw error;
    }
  }
  // The same mapper reads both executions; only visibility differs because the emulator has no layout engine.
  private page = {
    evaluate: async <T>(callback: () => T) => {
      let source = callback.toString();
      source = source
        .replace(
          '!!el.getClientRects().length && getComputedStyle(el).visibility !== "hidden"',
          "window.__neoVisible(el)",
        )
        .replace(
          "root.getBoundingClientRect().height > 0",
          "window.__neoVisible(root)",
        );
      return this.call<T>("evaluate", {
        source: `window.__neoVisibilityCache=new WeakMap(); (${source})()`,
      });
    },
  } as unknown as Page;
  async state(): Promise<DemoState> {
    const deadline = Date.now() + 20000;
    let last = "",
      stableAt = Date.now();
    while (Date.now() < deadline) {
      const form = await readNativeForm(this.page);
      form.diagnostics.push(...new Set(this.sourceErrors));
      const pricing = await readNativePricing(this.page);
      const fingerprint = canonical({
        form,
        epoch: pricing?.epoch,
        pending: pricing?.pending,
      });
      if (last !== fingerprint) {
        last = fingerprint;
        stableAt = Date.now();
      }
      if (Date.now() - stableAt >= 1500 && pricing && !pricing.pending) {
        this.form = form;
        let quote: Quote | null = null,
          inquiries: Inquiry[] = [],
          priceError;
        try {
          if (form.diagnostics.length) throw Error(form.diagnostics.join("; "));
          ({ quote, inquiries } = buildNativeQuote(
            pricing,
            [...this.quotes.values()],
            { ...this.scope, releaseId: hash(canonical(this.source)) },
          ));
          const current = await readNativeForm(this.page);
          current.diagnostics.push(...new Set(this.sourceErrors));
          const latest = await readNativePricing(this.page);
          if (
            canonical(current) !== canonical(form) ||
            latest?.epoch !== pricing.epoch ||
            latest?.pending
          )
            throw Error(
              "Huawei changed the configuration while pricing. Reopen to retry.",
            );
          for (const [key, entry] of this.quotes)
            if (!inquiries.includes(entry.inquiry)) this.quotes.delete(key);
        } catch (error) {
          quote = null;
          inquiries = [];
          priceError = String(error);
        }
        return {
          ...form,
          ...this.scope,
          source: this.source,
          quote,
          inquiries,
          priceError,
          ...(await this.call<{ logs: string; metrics: DemoState["metrics"] }>(
            "status",
          )),
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw Error("Emulator form/pricing did not settle");
  }
  async change(fieldId: string, value: string | number | boolean) {
    const field = this.form?.fields.find((f) => f.id === fieldId);
    if (!field) throw Error("Unknown control");
    validateNativeValue(field, value);
    await this.call("act", { field, value });
    const state = await this.state();
    const current = state.fields.find((f) => f.id === fieldId);
    if (current && current.type !== "action" && current.value !== value)
      throw Error(
        "Huawei did not apply the requested input. No price is offered.",
      );
    return state;
  }
  async close() {
    try {
      await this.call("close", {}, 5000);
    } catch {}
    this.child.stdin.end();
    await execFileAsync("docker", ["stop", "--time", "1", this.name]).catch(
      () => {},
    );
    this.fail(Error("Emulator closed"));
  }
}
