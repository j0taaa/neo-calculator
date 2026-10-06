import { NativeOperations, isNativeOperationId } from "../lib/huawei-native/native-operations";
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { NativeCalculator, NativeError } from "../lib/huawei-native/native-session";
import { HuaweiCollector } from "../lib/huawei-native/collector";
import { SourceStore } from "../lib/huawei-native/store";
import { isNativeBillingMode } from "../lib/huawei-native/native-billing";

const token = process.env.HUAWEI_NATIVE_TOKEN;
if (!token || token.length < 32) throw new Error("Set a private HUAWEI_NATIVE_TOKEN (32+ characters)");
const store = new SourceStore(process.env.HUAWEI_SOURCE_DB ?? "/app/data/native.sqlite");
const calculator = new NativeCalculator(new HuaweiCollector(store), 6);
const operations = new NativeOperations(session => calculator.remove(session));
const server = createServer(async (request, response) => {
  response.setHeader("content-type", "application/json");
  response.setHeader("cache-control", "no-store");
  const auth = Buffer.from(request.headers.authorization ?? ""),
    expected = Buffer.from(`Bearer ${token}`);
  if (auth.length !== expected.length || !timingSafeEqual(auth, expected)) {
    response.writeHead(401).end("{}");
    return;
  }
  try {
    if (request.method === "GET" && request.url === "/health") {
      response.end(JSON.stringify({ ok: true }));
      return;
    }
    if (request.method === "GET" && request.url === "/directory") {
      response.end(JSON.stringify(await calculator.directory()));
      return;
    }
    if (request.method !== "POST" || request.url !== "/session") {
      response.writeHead(404).end("{}");
      return;
    }
    let raw = "";
    for await (const chunk of request) {
      raw += chunk;
      if (raw.length > 120000) throw new NativeError("Request too large", 413);
    }
    const body = JSON.parse(raw);
    if (body.operationId !== undefined && !isNativeOperationId(body.operationId)) throw new NativeError("Invalid initialization id");
    let result;
    if (body.action === "open" && typeof body.service === "string" && typeof body.region === "string" && (body.billingMode === undefined || isNativeBillingMode(body.billingMode)))
      result = await operations.run(body.operationId, () => calculator.open(body.service, body.region, body.billingMode));
    else if (
      body.action === "change" &&
      typeof body.session === "string" &&
      Number.isSafeInteger(body.revision) &&
      typeof body.field === "string"
    )
      result = await calculator.act(body);
    else if (body.action === "restore") result = await operations.run(body.operationId, () => calculator.restore(body.selection));
    else if (body.action === "refresh" && typeof body.session === "string" && Number.isSafeInteger(body.revision))
      result = await calculator.refresh(body.session, body.revision);
    else if (body.action === "cancel" && isNativeOperationId(body.operationId)) {
      await operations.cancel(body.operationId);
      result = { ok: true };
    }
    else if (body.action === "close" && typeof body.session === "string") {
      await calculator.remove(body.session);
      result = { ok: true };
    } else throw new NativeError("Invalid action");
    if (response.destroyed && result && "session" in result) await calculator.remove(result.session);
    else response.end(JSON.stringify(result));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Native calculator error");
    response
      .writeHead(error instanceof NativeError ? error.status : 502)
      .end(
        JSON.stringify({
          error:
            error instanceof NativeError
              ? error.message
              : "Huawei could not complete this request. Reopen the calculator to retry.",
        }),
      );
  }
});
server.requestTimeout = 120000;
server.listen(Number(process.env.PORT ?? 3001), process.env.HOST ?? "0.0.0.0");
const sweep = setInterval(() => { operations.sweep(); void calculator.sweep().catch(console.error); }, 30000);
async function stop() {
  clearInterval(sweep);
  server.close();
  await calculator.close();
  store.close();
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
