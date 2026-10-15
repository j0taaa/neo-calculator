import { beforeAll, afterAll, expect, mock, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixture } from "../lib/calculator-rules/test-fixture";
import { SnapshotStore } from "../lib/huawei-snapshot/store";
import { ResourceCompiler } from "../lib/cart-json/compile";
import type { ProductMutationBody } from "../lib/calculator-types";

let directory: string,
  originalCwd: string,
  cookie: string,
  product: ProductMutationBody;
let database: typeof import("../lib/db").db;
let connectionRoutes: typeof import("../app/api/huawei/connection/route"),
  transfers: typeof import("../app/api/huawei/transfers/route");
const secretSession =
  "HWS_INTL_ID=private-session-a; portal_csrf=private-csrf-a";
let writes = 0,
  timeoutWrite = false,
  expired = false;
const remote = new Map<string, Record<string, unknown>>();
class ExpiredHuaweiSession extends Error {}
const origin = "http://localhost:3000";
function req(
  path: string,
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {},
) {
  return new Request(origin + path, {
    method,
    headers: { origin, cookie, "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const transfer = (
  body: Record<string, unknown>,
  headers?: Record<string, string>,
) =>
  transfers.POST(
    req(
      "/api/huawei/transfers",
      "POST",
      {
        connectionAccount: "account-a",
        connectionUsername: "account-a",
        ...body,
      },
      headers,
    ),
  );
const source = () => ({
  schemaVersion: 1,
  resourceType: "cart",
  cart: { name: "Neo export", products: [product] },
});
async function preview(key?: string) {
  const r = await transfer({ action: "preview", document: source(), key });
  expect(r.status, await r.clone().text()).toBe(200);
  return await r.json();
}

beforeAll(async () => {
  const { scope, release } = fixture();
  originalCwd = process.cwd();
  directory = await mkdtemp(join(tmpdir(), "neo-huawei-routes-"));
  process.chdir(directory);
  process.env.BETTER_AUTH_SECRET =
    "dedicated-huawei-route-test-secret-123456789";
  const root = join(directory, "catalog");
  process.env.HUAWEI_SNAPSHOT_DIR = root;
  const store = new SnapshotStore(root);
  release.directory = {
    services: [
      { id: "ecs", name: "ECS", category: "Compute", available: true },
    ],
    regions: [{ id: "region", name: "Region" }],
    billingModes: { ecs: { region: ["ONDEMAND", "PERIOD"] } },
  };
  release.scopes = { "ecs/region": await store.writeScope(scope) };
  await store.publish(release);
  product = await new ResourceCompiler(
    await store.active(),
    store,
  ).intentProduct(
    {
      serviceCode: "HUAWEI:ecs",
      region: "region",
      billingMode: "ONDEMAND",
      choices: [{ field: "global_ONDEMANDTIME:0", value: 13 }],
    },
    "/",
  );
  const login = await import("../lib/huawei-carts/login");
  mock.module("../lib/huawei-carts/login", () => ({
    ...login,
    loginHuawei: async (input: {
      password: string;
      account: string;
      username?: string;
    }) => {
      if (input.password !== "correct")
        throw new login.HuaweiConnectionError(
          "Huawei could not sign you in.",
          401,
        );
      return {
        cookie: secretSession,
        account: input.account,
        username: input.username || input.account,
      };
    },
  }));
  mock.module("../lib/api-route", () => ({
    getSessionFromHeaders: async (headers: Headers) =>
      headers.get("cookie")?.includes("neo-user=user-a")
        ? { user: { id: "user-a" } }
        : null,
  }));
  mock.module("../lib/huawei-calculator", () => ({
    HuaweiSessionError: ExpiredHuaweiSession,
    listHuaweiCarts: async () => {
      if (expired) throw new ExpiredHuaweiSession();
      return [...remote].map(([key, cart]) => ({
        key,
        name: cart.name,
        updateTime: 1,
        totalAmount: 1,
      }));
    },
    getHuaweiCartDetail: async (key: string) =>
      structuredClone(remote.get(key)),
    writeHuaweiCart: async (
      payload: Record<string, unknown>,
      _cookie: string,
      key?: string,
    ) => {
      writes++;
      if (timeoutWrite)
        throw new Error("Huawei could not be reached. Please try again.");
      const id = key || crypto.randomUUID();
      remote.set(id, structuredClone(payload));
      return id;
    },
  }));
  database = (await import("../lib/db")).db;
  for (const id of ["user-a", "user-b"])
    database
      .query(
        "INSERT INTO user (id,name,email,emailVerified,createdAt,updatedAt) VALUES (?,?,?,1,?,?)",
      )
      .run(
        id,
        id,
        id + "@example.test",
        new Date().toISOString(),
        new Date().toISOString(),
      );
  for (const [id, user] of [
    ["project-a", "user-a"],
    ["project-b", "user-b"],
  ])
    database
      .query(
        "INSERT INTO project (id,user_id,name,created_at,updated_at) VALUES (?,?,?,?,?)",
      )
      .run(id, user, id, new Date().toISOString(), new Date().toISOString());
  remote.set("owned-cart", {
    name: "Existing Huawei cart",
    cartListData: [
      {
        selectedProduct: {
          serviceCode: "future",
          region: "future-region",
          amount: 9,
          purchaseNum: { measureValue: 1 },
        },
        rewriteValue: { custom: [1, 2, 3] },
      },
    ],
  });
  connectionRoutes = await import("../app/api/huawei/connection/route");
  transfers = await import("../app/api/huawei/transfers/route");
  const loginResponse = await connectionRoutes.POST(
    req("/api/huawei/connection", "POST", {
      account: "account-a",
      password: "correct",
    }),
  );
  expect(loginResponse.status).toBe(200);
  cookie = loginResponse.headers.get("set-cookie")!.split(";")[0];
});
afterAll(async () => {
  mock.restore();
  database?.close();
  process.chdir(originalCwd);
  await rm(directory, { recursive: true, force: true });
});

test("anonymous Huawei connection uses an opaque HttpOnly cookie and encrypted server storage", async () => {
  const r = await connectionRoutes.GET(req("/api/huawei/connection"));
  const value = await r.json();
  expect(value.connected).toBe(true);
  expect(value.account).toBe("account-a");
  expect(JSON.stringify(value)).not.toContain("private-session");
  expect(JSON.stringify(value)).not.toContain("correct");
  expect(cookie).not.toContain("private-session");
  const rows = database.query("SELECT * FROM huawei_connection").all();
  expect(JSON.stringify(rows)).not.toContain("private-session");
  expect(JSON.stringify(rows)).not.toContain("correct");
});
test("cross-origin login, export and disconnect are rejected without changing the connection", async () => {
  const headers = { origin: "https://attacker.example" };
  expect(
    (
      await connectionRoutes.POST(
        req(
          "/api/huawei/connection",
          "POST",
          { account: "evil", password: "correct" },
          headers,
        ),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await connectionRoutes.DELETE(
        req("/api/huawei/connection", "DELETE", undefined, headers),
      )
    ).status,
  ).toBe(403);
  expect(
    (await transfer({ action: "preview", document: source() }, headers)).status,
  ).toBe(403);
  expect(
    (await (await connectionRoutes.GET(req("/api/huawei/connection"))).json())
      .account,
  ).toBe("account-a");
});
test("missing and forged connection cookies cannot access carts", async () => {
  for (const cookie of ["", "neo_huawei_connection=forged"])
    expect(
      (
        await transfers.GET(
          req("/api/huawei/transfers", "GET", undefined, { cookie }),
        )
      ).status,
    ).toBe(401);
});
test("list and detail work anonymously, preserve unknown resources, and reject foreign share keys", async () => {
  expect(
    (await (await transfers.GET(req("/api/huawei/transfers"))).json()).carts,
  ).toHaveLength(1);
  const detail = await transfers.GET(
    req("/api/huawei/transfers?key=owned-cart"),
  );
  const value = await detail.json();
  expect(detail.status).toBe(200);
  expect(value.preserved).toBe(1);
  expect(value.cart.products).toHaveLength(1);
  expect(
    (await transfers.GET(req("/api/huawei/transfers?key=foreign-share-key")))
      .status,
  ).toBe(404);
});
test("project imports enforce Neo authentication and destination ownership", async () => {
  const before = database
    .query("SELECT count(*) AS n FROM project_list")
    .get() as { n: number };
  expect(
    (
      await transfer({
        action: "import",
        key: "owned-cart",
        projectId: "project-a",
      })
    ).status,
  ).toBe(401);
  expect(
    (
      await transfer(
        { action: "import", key: "owned-cart", projectId: "project-b" },
        { cookie: cookie + "; neo-user=user-a" },
      )
    ).status,
  ).toBe(403);
  const r = await transfer(
    { action: "import", key: "owned-cart", projectId: "project-a" },
    { cookie: cookie + "; neo-user=user-a" },
  );
  expect(r.status, await r.clone().text()).toBe(201);
  expect((await r.json()).importedProductCount).toBe(1);
  expect(
    (
      database.query("SELECT count(*) AS n FROM project_list").get() as {
        n: number;
      }
    ).n,
  ).toBe(before.n + 1);
});
test("preview is read-only and unreviewed exports cannot write", async () => {
  const before = writes;
  const p = await preview();
  expect(p.productCount).toBe(1);
  expect(p.existing).toBeNull();
  expect(writes).toBe(before);
  expect(
    (await transfer({ action: "export", document: source() })).status,
  ).toBe(409);
  expect(writes).toBe(before);
});
test("new-cart exports write the entire payload once and repeated confirmation is idempotent", async () => {
  const p = await preview(),
    before = writes;
  const body = {
    action: "export",
    document: source(),
    confirmation: p.confirmation,
  };
  const first = await transfer(body);
  expect(first.status, await first.clone().text()).toBe(201);
  const saved = await first.json();
  expect(remote.get(saved.key)?.cartListData).toHaveLength(1);
  expect(writes).toBe(before + 1);
  const second = await transfer(body);
  expect(second.status).toBe(200);
  expect((await second.json()).key).toBe(saved.key);
  expect(writes).toBe(before + 1);
});
test("parallel confirmations cannot create duplicate remote carts", async () => {
  const p = await preview(),
    before = writes,
    body = {
      action: "export",
      document: source(),
      confirmation: p.confirmation,
    };
  const responses = await Promise.all([transfer(body), transfer(body)]);
  expect(responses.some((response) => response.status === 201)).toBe(true);
  expect(
    responses.every((response) => [200, 201, 409].includes(response.status)),
  ).toBe(true);
  expect(writes).toBe(before + 1);
});
test("Huawei's 50-character name limit is validated before writes, with a separate export name", async () => {
  const doc = source();
  doc.cart.name = "N".repeat(80);
  const before = writes;
  const rejected = await transfer({ action: "preview", document: doc });
  expect(rejected.status).toBe(400);
  expect(await rejected.text()).toContain("1–50");
  const accepted = await transfer({
    action: "preview",
    document: doc,
    exportName: "Huawei copy",
  });
  expect(accepted.status).toBe(200);
  expect((await accepted.json()).name).toBe("Huawei copy");
  expect(writes).toBe(before);
});
test("account changes, payload tampering, target changes and forged confirmations reject writes", async () => {
  const p = await preview(),
    before = writes;
  const changedSource = source();
  changedSource.cart.name = "Changed after preview";
  for (const body of [
    { document: changedSource, confirmation: p.confirmation },
    {
      document: source(),
      confirmation: { ...p.confirmation, signature: "f".repeat(64) },
    },
    {
      document: source(),
      confirmation: p.confirmation,
      connectionAccount: "different-account",
    },
    { document: source(), confirmation: p.confirmation, key: "owned-cart" },
  ])
    expect((await transfer({ action: "export", ...body })).status).toBe(409);
  expect(writes).toBe(before);
});
test("remote edits between replacement review and confirmation are protected", async () => {
  const p = await preview("owned-cart"),
    before = writes;
  remote.get("owned-cart")!.name = "Changed in Huawei";
  const r = await transfer({
    action: "export",
    document: source(),
    key: "owned-cart",
    confirmation: p.confirmation,
  });
  expect(r.status).toBe(409);
  expect(writes).toBe(before);
  const revised = await preview("owned-cart");
  const success = await transfer({
    action: "export",
    document: source(),
    key: "owned-cart",
    confirmation: revised.confirmation,
  });
  expect(success.status, await success.clone().text()).toBe(201);
  expect(writes).toBe(before + 1);
  expect(remote.get("owned-cart")?.name).toBe("Changed in Huawei");
});
test("ambiguous network failures are not automatically retried into duplicate Huawei carts", async () => {
  const p = await preview(),
    before = writes;
  timeoutWrite = true;
  const body = {
    action: "export",
    document: source(),
    confirmation: p.confirmation,
  };
  expect((await transfer(body)).status).toBe(400);
  timeoutWrite = false;
  expect((await transfer(body)).status).toBe(409);
  expect(writes).toBe(before + 1);
});
test("expired upstream sessions invalidate only the current connection", async () => {
  expired = true;
  const r = await transfers.GET(req("/api/huawei/transfers"));
  expect(r.status).toBe(401);
  expect(r.headers.get("set-cookie")).toContain("Max-Age=0");
  expect(
    (await (await connectionRoutes.GET(req("/api/huawei/connection"))).json())
      .connected,
  ).toBe(false);
  expired = false;
});
test("bad credentials are rate-limited without retaining passwords", async () => {
  for (let i = 0; i < 5; i++)
    expect(
      (
        await connectionRoutes.POST(
          req("/api/huawei/connection", "POST", {
            account: "rate-limited",
            password: "never-save-this",
          }),
        )
      ).status,
    ).toBe(401);
  const limited = await connectionRoutes.POST(
    req("/api/huawei/connection", "POST", {
      account: "rate-limited",
      password: "never-save-this",
    }),
  );
  expect(limited.status).toBe(429);
  expect(await limited.text()).not.toContain("never-save-this");
});
