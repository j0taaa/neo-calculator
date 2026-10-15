import { test, expect, type Page } from "@playwright/test";
import { calculatorApiKey } from "./calculator-api-fixture";
import { guestCartStorageKey } from "../lib/guest-carts/store";
import type { ProductMutationBody } from "../lib/calculator-types";

type Document = {
  schemaVersion: number;
  resourceType: string;
  cart: { name: string; products: ProductMutationBody[] };
};
const account = {
  connected: true,
  account: "demo-account",
  username: "demo-account",
  expiresAt: Date.now() + 3600000,
};
const rows = [
  {
    key: "cart-a",
    name: "Application servers",
    updateTime: Date.now(),
    totalAmount: 12.34,
  },
  {
    key: "cart-b",
    name: "Database estimate",
    updateTime: Date.now() - 86400000,
    totalAmount: 56.78,
  },
];
async function cartDocument(
  page: Page,
  title = "Imported ECS",
): Promise<Document> {
  const response = await page.request.post("/api/v1/cart/validate", {
    data: {
      schemaVersion: 2,
      resourceType: "cart",
      cart: {
        name: "Application servers",
        products: [
          {
            serviceCode: "HUAWEI:ecs",
            region: "ap-southeast-1",
            billingMode: "ONDEMAND",
            title,
            choices: [{ field: "global_ONDEMANDTIME:0", value: 37 }],
          },
        ],
      },
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()).normalized;
}
async function fakeHuawei(
  page: Page,
  doc: Document,
  initiallyConnected = true,
  extraRows = rows,
) {
  const state = {
    connected: initiallyConnected,
    badLogin: false,
    verification: false,
    failReading: new Set<string>(),
    failPreview: 0,
    conflict: false,
    writes: 0,
    previews: [] as Record<string, unknown>[],
    imports: [] as Record<string, unknown>[],
    loginBodies: [] as Record<string, unknown>[],
  };
  await page.route("**/api/huawei/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      body = request.method() === "POST" ? request.postDataJSON() : null;
    const reply = (status: number, json: unknown) =>
      route.fulfill({ status, json });
    if (url.pathname.endsWith("/connection")) {
      if (request.method() === "GET")
        return reply(200, state.connected ? account : { connected: false });
      if (request.method() === "DELETE") {
        state.connected = false;
        return reply(200, { connected: false });
      }
      state.loginBodies.push(body);
      if (state.badLogin) {
        state.badLogin = false;
        return reply(401, { error: "Check your account and password." });
      }
      if (state.verification && !body.verificationCode)
        return reply(401, {
          error: "Huawei requires an authenticator code.",
          verificationRequired: true,
        });
      state.connected = true;
      return reply(200, account);
    }
    if (!state.connected)
      return reply(401, {
        error:
          "Your Huawei session expired. Reconnect to continue. Your Neo carts are safe.",
      });
    if (request.method() === "GET") {
      const key = url.searchParams.get("key");
      if (!key)
        return reply(200, {
          carts: extraRows,
          accountScope: "demo-scope",
          refreshedAt: new Date().toISOString(),
        });
      if (state.failReading.has(key))
        return reply(503, {
          error: "Temporary read failure. Retry this cart.",
        });
      return reply(200, {
        ...doc,
        cart: {
          ...doc.cart,
          name: extraRows.find((row) => row.key === key)?.name ?? doc.cart.name,
        },
        preserved: doc.cart.products.filter(
          (product) => product.productType === "huawei-saved",
        ).length,
      });
    }
    if (body.action === "preview") {
      if (state.failPreview) {
        state.failPreview--;
        state.connected = false;
        return reply(401, {
          error: "Your Huawei session expired. Reconnect to continue.",
        });
      }
      state.previews.push(body);
      return reply(200, {
        name: doc.cart.name,
        productCount: doc.cart.products.length,
        preserved: 0,
        total: 12.345678,
        existing: body.key
          ? {
              name: extraRows.find((row) => row.key === body.key)?.name,
              productCount: 3,
            }
          : null,
        confirmation: { nonce: crypto.randomUUID(), signature: "test-only" },
      });
    }
    if (body.action === "export") {
      if (state.conflict) {
        state.conflict = false;
        return reply(409, {
          error: "The Huawei destination changed. Review the export again.",
        });
      }
      state.writes++;
      return reply(201, { key: "created-cart", name: doc.cart.name });
    }
    if (body.action === "import") {
      state.imports.push(body);
      const actual = await page.request.post("/api/import", {
        data: { payload: doc, targetProjectId: body.projectId },
      });
      return reply(actual.status(), await actual.json());
    }
    return reply(400, { error: "Unknown test action" });
  });
  return state;
}
async function localCart(page: Page, doc: Document) {
  const now = new Date().toISOString();
  await page.addInitScript(
    ({ doc, key, now }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(
          key,
          JSON.stringify({
            version: 1,
            selectedId: "local-export",
            carts: [
              {
                id: "local-export",
                name: "Local quotation",
                createdAt: now,
                updatedAt: now,
                products: doc.cart.products.map((product, index) => ({
                  ...product,
                  id: "product-" + index,
                  createdAt: now,
                  updatedAt: now,
                })),
              },
            ],
          }),
        );
    },
    { doc, key: guestCartStorageKey, now },
  );
}
const stored = async (page: Page) =>
  page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).carts,
    guestCartStorageKey,
  );

test.beforeEach(async ({ page, baseURL }) => {
  expect(["127.0.0.1", "localhost"]).toContain(new URL(baseURL!).hostname);
  await page.route("**/*", (route) =>
    /^https?:/.test(route.request().url()) &&
    new URL(route.request().url()).origin !== new URL(baseURL!).origin
      ? route.abort()
      : route.continue(),
  );
});

test("Huawei login is separate from Neo login, recovers errors, and never stores a password or cookie in localStorage", async ({
  page,
}) => {
  const doc = await cartDocument(page),
    state = await fakeHuawei(page, doc, false);
  state.badLogin = true;
  await page.goto("/huawei-carts");
  await expect(
    page.getByRole("link", { name: "Huawei Carts", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Huawei account ID", { exact: true })
    .fill("demo-account");
  await page.getByLabel("Password", { exact: true }).fill("test-only-password");
  await page
    .getByRole("button", { name: "Connect Huawei Cloud", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Check your account and password.",
  );
  await page
    .getByRole("button", { name: "Connect Huawei Cloud", exact: true })
    .click();
  await expect(
    page.getByText("Connected as demo-account", { exact: true }),
  ).toBeVisible();
  expect(state.loginBodies.at(-1)).toMatchObject({
    account: "demo-account",
    username: "demo-account",
    password: "test-only-password",
  });
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "test-only-password",
  );
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "HWS_INTL_ID",
  );
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(
    page.getByLabel("Huawei account ID", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Application servers", { exact: true }),
  ).toHaveCount(0);
});

test("IAM and MFA details appear only when needed", async ({ page }) => {
  const doc = await cartDocument(page),
    state = await fakeHuawei(page, doc, false);
  state.verification = true;
  await page.goto("/huawei-carts");
  await page.getByLabel("Sign in as an IAM user").check();
  await page.getByLabel("Huawei account name", { exact: true }).fill("tenant");
  await page.getByLabel("IAM username", { exact: true }).fill("iam-user");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page
    .getByRole("button", { name: "Connect Huawei Cloud", exact: true })
    .click();
  await expect(
    page.getByLabel("Authenticator code", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("IAM user ID", { exact: true }).fill("user-id");
  await page.getByLabel("Authenticator code", { exact: true }).fill("123456");
  await page
    .getByRole("button", { name: "Connect Huawei Cloud", exact: true })
    .click();
  await expect(
    page.getByText("Connected as demo-account", { exact: true }),
  ).toBeVisible();
  expect(state.loginBodies.at(-1)).toMatchObject({
    account: "tenant",
    username: "iam-user",
    verificationCode: "123456",
    userId: "user-id",
  });
});

test("large Huawei cart lists use search and pagination", async ({ page }) => {
  const doc = await cartDocument(page),
    many = Array.from({ length: 57 }, (_, index) => ({
      key: "cart-" + index,
      name: "Estimate " + String(index).padStart(3, "0"),
      updateTime: index + 1,
      totalAmount: 0,
    }));
  await fakeHuawei(page, doc, true, many);
  await page.goto("/huawei-carts");
  await expect(page.getByText("Page 1 of 3", { exact: true })).toBeVisible();
  expect(
    await page.getByRole("button", { name: "Import", exact: true }).count(),
  ).toBe(25);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 of 3", { exact: true })).toBeVisible();
  await page
    .getByLabel("Search Huawei carts", { exact: true })
    .fill("Estimate 009");
  await expect(page.getByText("Estimate 009", { exact: true })).toBeVisible();
  expect(
    await page.getByRole("button", { name: "Import", exact: true }).count(),
  ).toBe(1);
});

test("anonymous import creates and opens an editable standalone cart with exact local prices", async ({
  page,
}) => {
  const doc = await cartDocument(page);
  await fakeHuawei(page, doc);
  await page.goto("/huawei-carts");
  await page
    .getByRole("button", { name: "Import", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Import Huawei carts",
    exact: true,
  });
  await expect(
    dialog.getByText("1 carts · 1 resources", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText(/No Neo account is needed/)).toBeVisible();
  await dialog
    .getByRole("button", { name: "Import to NeoCalculator", exact: true })
    .click();
  await expect(page).toHaveURL(/\/cart\?.*list=/);
  await expect(
    page.getByRole("button", { name: "Edit Imported ECS", exact: true }),
  ).toBeEnabled();
  const carts = await stored(page);
  expect(carts).toHaveLength(1);
  expect(carts[0]).not.toHaveProperty("projectId");
  expect(carts[0].products[0].pricing.amount).toBeCloseTo(
    (doc.cart.products[0].pricing as { amount: number }).amount,
    6,
  );
  const id = carts[0].id;
  await page.reload();
  expect((await stored(page))[0].id).toBe(id);
  await expect(page.locator("iframe")).toHaveCount(0);
});

test("unknown services retain every original option and display read-only saved estimates", async ({
  page,
}) => {
  const item = {
    selectedProduct: {
      serviceCode: "future",
      amount: 42,
      region: "future-region",
    },
    rewriteValue: { unknown: { options: ["one", { nested: true }] } },
  };
  const doc: Document = {
    schemaVersion: 1,
    resourceType: "cart",
    cart: {
      name: "Preserved",
      products: [
        {
          serviceCode: "future",
          serviceName: "Future service",
          productType: "huawei-saved",
          title: "Preserved resource",
          quantity: 1,
          config: { huaweiCartItem: item, signature: "a".repeat(64) },
          pricing: {
            amount: 42,
            currency: "USD",
            source: "huawei-saved",
            total: "USD 42.000000 (saved Huawei estimate)",
          },
        },
      ],
    },
  };
  await fakeHuawei(page, doc);
  await page.goto("/huawei-carts");
  await page
    .getByRole("button", { name: "Import", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Import Huawei carts",
    exact: true,
  });
  await expect(dialog.getByText(/read-only Huawei copies/)).toBeVisible();
  await dialog
    .getByRole("button", { name: "Import to NeoCalculator", exact: true })
    .click();
  await expect(page).toHaveURL(/\/cart\?.*list=/);
  await expect(
    page.getByText("Saved Huawei copy · read-only", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit Preserved resource", exact: true }),
  ).toBeDisabled();
  expect((await stored(page))[0].products[0].config.huaweiCartItem).toEqual(
    item,
  );
  await page.reload();
  await expect(
    page.getByText("Preserved resource", { exact: true }),
  ).toBeVisible();
});

test("bulk imports retry failed reads, retain successful copies, and remember previous imports", async ({
  page,
}) => {
  const doc = await cartDocument(page),
    state = await fakeHuawei(page, doc);
  state.failReading.add("cart-b");
  await page.goto("/huawei-carts");
  await page
    .getByLabel("Select this page of Huawei carts", { exact: true })
    .check();
  await page
    .getByRole("button", { name: "Import selected (2)", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Import Huawei carts",
    exact: true,
  });
  await expect(
    dialog.getByText("Temporary read failure. Retry this cart.", {
      exact: true,
    }),
  ).toBeVisible();
  state.failReading.clear();
  await dialog
    .getByRole("button", { name: "Retry loading failed carts", exact: true })
    .click();
  await expect(
    dialog.getByText("2 carts · 2 resources", { exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Import to NeoCalculator", exact: true })
    .click();
  await expect(
    dialog.getByRole("link", { name: "Open Neo cart", exact: true }),
  ).toHaveCount(2);
  expect(await stored(page)).toHaveLength(2);
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Open Neo copy", exact: true }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Import another copy", exact: true })
    .first()
    .click();
  await expect(dialog.getByText(/creates additional copies/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(await stored(page)).toHaveLength(2);
});

test("signed-in imports can choose a project without establishing a Huawei sync link", async ({
  page,
}) => {
  await calculatorApiKey(page);
  const project = await (
    await page.request.post("/api/projects", {
      data: { name: "Huawei destination " + crypto.randomUUID() },
    })
  ).json();
  const doc = await cartDocument(page),
    state = await fakeHuawei(page, doc);
  await page.goto("/huawei-carts");
  await page
    .getByRole("button", { name: "Import", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Import Huawei carts",
    exact: true,
  });
  await dialog
    .getByRole("combobox", { name: "Import destination", exact: true })
    .click();
  await page.getByRole("option", { name: project.name, exact: true }).click();
  await dialog
    .getByRole("button", { name: "Import to NeoCalculator", exact: true })
    .click();
  await expect(page).toHaveURL(/\/\?.*list=/);
  expect(state.imports).toHaveLength(1);
  expect(state.imports[0].projectId).toBe(project.id);
  const saved = await (await page.request.get("/api/projects")).json();
  const cart = saved.find((item: { id: string }) => item.id === project.id)
    .lists[0];
  expect(cart.products).toHaveLength(1);
  expect(cart.huaweiCartKey).toBeNull();
});

test("local-cart export opens from its menu and waits for explicit review and confirmation", async ({
  page,
}) => {
  const doc = await cartDocument(page);
  await localCart(page, doc);
  const state = await fakeHuawei(page, doc);
  await page.goto("/cart");
  await page
    .getByRole("button", {
      name: "Open actions for Local quotation",
      exact: true,
    })
    .click();
  await page
    .getByRole("menuitem", { name: "Export to Huawei Cloud", exact: true })
    .click();
  await expect(page).toHaveURL(/\/huawei-carts\?exportLocal=local-export/);
  const dialog = page.getByRole("dialog", {
    name: "Export to Huawei Cloud",
    exact: true,
  });
  await expect(
    dialog.getByText("Local quotation", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toBe(0);
  await dialog
    .getByRole("button", { name: "Review export", exact: true })
    .click();
  await expect(
    dialog.getByText("1 resources · USD 12.345678", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toBe(0);
  expect(state.previews[0]).toMatchObject({
    connectionAccount: "demo-account",
    connectionUsername: "demo-account",
  });
  await dialog
    .getByRole("button", { name: "Create Huawei cart", exact: true })
    .click();
  await expect(
    dialog.getByText("Local quotation was exported to Huawei Cloud.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(state.writes).toBe(1);
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(await stored(page)).toHaveLength(1);
});

test("replacement destinations are searchable and conflicts require a fresh review", async ({
  page,
}) => {
  const doc = await cartDocument(page);
  await localCart(page, doc);
  const state = await fakeHuawei(page, doc);
  state.conflict = true;
  await page.goto("/huawei-carts?exportLocal=local-export");
  const dialog = page.getByRole("dialog", {
    name: "Export to Huawei Cloud",
    exact: true,
  });
  await dialog
    .getByLabel("Replace an existing Huawei cart", { exact: true })
    .check();
  await dialog
    .getByLabel("Search destination Huawei carts", { exact: true })
    .fill("Database");
  await dialog.getByLabel("Database estimate", { exact: true }).check();
  await dialog
    .getByRole("button", { name: "Review export", exact: true })
    .click();
  await expect(dialog.getByText(/replaces all 3 resources/)).toBeVisible();
  await dialog
    .getByRole("button", { name: "Replace Huawei cart", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "The Huawei destination changed. Review the export again.",
  );
  expect(state.writes).toBe(0);
  await dialog
    .getByRole("button", { name: "Review export", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Replace Huawei cart", exact: true })
    .click();
  await expect(dialog.getByText(/was exported to Huawei Cloud/)).toBeVisible();
  expect(state.writes).toBe(1);
  expect(state.previews.at(-1)?.key).toBe("cart-b");
});

test("expired sessions reconnect in the export dialog without losing the Neo cart", async ({
  page,
}) => {
  const doc = await cartDocument(page);
  await localCart(page, doc);
  const state = await fakeHuawei(page, doc);
  state.failPreview = 1;
  await page.goto("/huawei-carts?exportLocal=local-export");
  const dialog = page.getByRole("dialog", {
    name: "Export to Huawei Cloud",
    exact: true,
  });
  await dialog
    .getByRole("button", { name: "Review export", exact: true })
    .click();
  await expect(
    dialog.getByLabel("Huawei account ID", { exact: true }),
  ).toBeVisible();
  await dialog
    .getByLabel("Huawei account ID", { exact: true })
    .fill("demo-account");
  await dialog
    .getByLabel("Password", { exact: true })
    .fill("test-only-password");
  await dialog
    .getByRole("button", { name: "Connect Huawei Cloud", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Review export", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Create Huawei cart", exact: true })
    .click();
  await expect(dialog.getByText(/was exported to Huawei Cloud/)).toBeVisible();
  expect((await stored(page))[0].id).toBe("local-export");
  expect(state.writes).toBe(1);
});

for (const width of [280, 375, 1440])
  test(`Huawei Carts and its import dialog fit ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    const doc = await cartDocument(page);
    await fakeHuawei(page, doc, true, [
      { ...rows[0], name: "Long cart name " + "quotation ".repeat(20) },
    ]);
    await page.goto("/huawei-carts");
    await expect(
      page.getByRole("button", { name: "Import", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Import", exact: true }).click();
    const dialog = page.getByRole("dialog", {
      name: "Import Huawei carts",
      exact: true,
    });
    await expect(
      dialog.getByRole("button", {
        name: "Import to NeoCalculator",
        exact: true,
      }),
    ).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(8);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width - 8);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await page.screenshot({
      path: `/tmp/neo-huawei-carts-${width}.png`,
      fullPage: true,
    });
  });

test("changing a local cart in another tab prevents exporting a stale reviewed copy", async ({
  page,
}) => {
  const doc = await cartDocument(page);
  await localCart(page, doc);
  const state = await fakeHuawei(page, doc);
  await page.goto("/huawei-carts?exportLocal=local-export");
  const dialog = page.getByRole("dialog", {
    name: "Export to Huawei Cloud",
    exact: true,
  });
  await dialog
    .getByRole("button", { name: "Review export", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Create Huawei cart", exact: true }),
  ).toBeVisible();
  await page.evaluate((key) => {
    const value = JSON.parse(localStorage.getItem(key)!);
    value.carts[0].name = "Changed in another tab";
    localStorage.setItem(key, JSON.stringify(value));
  }, guestCartStorageKey);
  await dialog
    .getByRole("button", { name: "Create Huawei cart", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "This local cart changed in another tab. Reload Huawei Carts and review it again.",
  );
  expect(state.writes).toBe(0);
});

test("the Huawei copy has its own name with the official 50-character limit", async ({
  page,
}) => {
  const doc = await cartDocument(page);
  await localCart(page, doc);
  const state = await fakeHuawei(page, doc);
  await page.goto("/huawei-carts?exportLocal=local-export");
  const dialog = page.getByRole("dialog", {
    name: "Export to Huawei Cloud",
    exact: true,
  });
  const name = dialog.getByLabel("Name in Huawei Cloud");
  await expect(name).toHaveAttribute("maxlength", "50");
  await name.fill("Separate Huawei copy");
  await dialog
    .getByRole("button", { name: "Review export", exact: true })
    .click();
  expect(state.previews[0].exportName).toBe("Separate Huawei copy");
  expect((await stored(page))[0].name).toBe("Local quotation");
});
