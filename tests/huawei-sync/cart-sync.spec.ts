import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";

const SOCKS_PROXY = process.env.HWC_SOCKS5_PROXY || "socks5://127.0.0.1:40001";
const NEO_CALCULATOR_URL = process.env.NEO_CALCULATOR_URL || "http://localhost:3000";

const HUAWEI_BASE = "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api";
const HUAWEI_REFERER = "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html";

function parseCookie(cookieStr: string): Array<{ name: string; value: string }> {
  return cookieStr
    .split("; ")
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf("=");
      return { name: pair.slice(0, idx).trim(), value: pair.slice(idx + 1).trim() };
    });
}

function getCsrf(cookieStr: string): string {
  return parseCookie(cookieStr).find((c) => c.name === "csrf")?.value ?? "";
}

function huaweiCurl(method: string, path: string, cookie: string, body?: string, retries = 3): { status: number; data: unknown } {
  const csrf = getCsrf(cookie);
  const baseArgs = [
    "--silent", "--show-error",
    "--proxy", SOCKS_PROXY,
    "--request", method,
    "--url", `${HUAWEI_BASE}${path}`,
    "--header", "accept: application/json",
    "--header", "content-type: application/json",
    "--header", `cookie: ${cookie}`,
    "--header", `csrf: ${csrf}`,
    "--header", `origin: https://www.huaweicloud.com`,
    "--header", `referer: ${HUAWEI_REFERER}`,
    "--header", "user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
    "--max-time", "30",
  ];
  if (body) {
    baseArgs.push("--data-raw", body);
  }

  let lastError = "";
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const raw = execSync("curl " + baseArgs.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(" "), {
        encoding: "utf-8",
        timeout: 35000,
      });
      return { status: 200, data: JSON.parse(raw) };
    } catch (e: unknown) {
      const err = e as { stderr?: string; message?: string };
      lastError = err.stderr ?? err.message ?? "unknown";
      if (attempt < retries) {
        console.log(`  Retry ${attempt}/${retries} for ${method} ${path}...`);
      }
    }
  }
  throw new Error(`Huawei API ${method} ${path} failed after ${retries} retries: ${lastError}`);
}

async function huaweiListCarts(cookie: string) {
  const resp = huaweiCurl("GET", "/share/list", cookie);
  const body = resp.data as { lists?: Array<{ key: string; name: string; updateTime: number; totalPrice: { amount: number; originalAmount: number } }> };
  return body.lists ?? [];
}

async function huaweiGetCartDetail(key: string, cookie: string) {
  const resp = huaweiCurl("GET", `/share/detail?key=${encodeURIComponent(key)}&language=en-us`, cookie);
  const body = resp.data as { data: { name: string; cartListData: Array<{ selectedProduct?: Record<string, unknown> }> } };
  return body.data;
}

async function huaweiCreateCart(name: string, cookie: string): Promise<string> {
  const resp = huaweiCurl("POST", "/share/add", cookie, JSON.stringify({
    billingMode: "cart.shareList.billingModeTotal",
    cartListData: [],
    name,
    totalPrice: { amount: 0, discountAmount: 0, originalAmount: 0 },
  }));
  const body = resp.data as { data: string };
  if (!body.data) throw new Error("Huawei create cart did not return a key");
  return body.data;
}

async function huaweiUpdateCart(key: string, payload: unknown, cookie: string) {
  huaweiCurl("POST", `/share/update?key=${encodeURIComponent(key)}`, cookie, JSON.stringify(payload));
}

function extractCartSummaryItems(detail: { cartListData: Array<{ selectedProduct?: Record<string, unknown> }> }) {
  return (detail.cartListData ?? []).map((item, i) => {
    const sp = item.selectedProduct ?? {};
    return {
      index: i,
      serviceCode: sp.serviceCode ?? "?",
      region: sp.region ?? "?",
      chargeMode: sp.chargeMode ?? "?",
      quantity: typeof (sp.purchaseNum as Record<string, unknown>)?.measureValue === "number"
        ? (sp.purchaseNum as Record<string, number>).measureValue
        : typeof (sp.subscriptionNum as number) === "number" ? sp.subscriptionNum : 1,
      amount: typeof sp.amount === "number" ? sp.amount : 0,
    };
  });
}

test.describe.configure({ mode: "serial" });

test.describe("NeoCalculator <-> Huawei Cloud Cart Sync", () => {
  let cookie: string;

  test("validate Huawei session cookie", () => {
    cookie = process.env.HUAWEI_COOKIE ?? "";
    if (!cookie.trim()) {
      throw new Error(
        "HUAWEI_COOKIE env var is required.\n" +
        "Usage: HUAWEI_COOKIE='...' npx playwright test tests/huawei-sync/cart-sync.spec.ts",
      );
    }
    console.log("Cookie extracted. CSRF:", getCsrf(cookie) ? "found" : "missing");
    expect(getCsrf(cookie)).toBeTruthy();
  });

  test("can list Huawei carts", async () => {
    const carts = await huaweiListCarts(cookie);
    console.log(`Found ${carts.length} Huawei carts. Most recent: "${carts[0]?.name}" (USD ${carts[0]?.totalPrice?.amount})`);
    expect(carts.length).toBeGreaterThan(0);
  });

  test("create a test cart on Huawei with sample ECS items", async () => {
    const cartName = `NeoSync Test ${new Date().toISOString().slice(0, 19)}`;
    const key = await huaweiCreateCart(cartName, cookie);
    console.log(`Created test cart: "${cartName}" key=${key}`);
    expect(key).toBeTruthy();

    const samplePayload = {
      billingMode: "cart.shareList.billingModeTotal",
      cartListData: [
        {
          buyUrl: "https://console-intl.huaweicloud.com/ecm/?region=sa-brazil-1&locale=en-us#/ecs/createVm",
          rewriteValue: {
            global_TITLE: { tag: "general.online.portal" },
            global_DESCRIPTION: "Elastic Cloud Server",
            global_REGIONINFO: {
              region: "sa-brazil-1",
              locationType: "commonAZ",
              chargeMode: "ONDEMAND",
            },
            template_RENDER: {
              calculator_ecs_radio: {
                arch: "dataInfo_32_",
                vmType: "dataInfo_1_",
                generation: "X1",
                cpu: "2dataInfo_36_",
                mem: "4BSSUNIT.pluralUnit.102",
              },
              calculator_evs_stepper: {
                calculator_evs_stepper_main: {
                  type: "dataInfo_24_",
                  UNSET_Stepper_0: {
                    measureId: 17,
                    measureValue: 40,
                  },
                },
              },
            },
            global_ONDEMANDTIME: {
              UNSET_Stepper_0: {
                measureId: 4,
                measureValue: 744,
              },
            },
            global_QUANTITY: {
              UNSET_Stepper_0: {
                measureId: 41,
                measureValue: 1,
              },
            },
          },
          selectedProduct: {
            region: "sa-brazil-1",
            locationType: "commonAZ",
            chargeMode: "ONDEMAND",
            tag: "general.online.portal",
            serviceCode: "ecs",
            timeTag: Date.now(),
            chargeModeName: "ONDEMAND",
            periodType: 4,
            periodNum: 1,
            subscriptionNum: 1,
            purchaseTime: { measureValue: 744, measureId: 4 },
            purchaseNum: { measureValue: 1, measureId: 41 },
            description: "Elastic Cloud Server",
            amount: 0,
            discountAmount: 0,
            originalAmount: 0,
            _customTitle: "Elastic Cloud Server",
            productAllInfos: [
              {
                resourceType: "hws.resource.type.vm",
                cloudServiceType: "hws.service.type.ec2",
                resourceSpecCode: "x1.2u.4g.linux",
                productId: "OFFI1012619014602915849",
                billingMode: "ONDEMAND",
                productNum: 1,
                usageValue: 744,
                usageMeasureId: 4,
                inquiryTag: "normal",
                inquiryResult: {
                  id: "sync-test-vm",
                  productId: "OFFI1012619014602915849",
                  amount: 0,
                  originalAmount: 0,
                  discountAmount: 0,
                },
              },
              {
                id: "5e98a4a3-0d2e-4003-88ae-0a5619cce96a",
                __os_type: "Linux",
                __platform: "AlmaLinux",
                name: "AlmaLinux 9.4 64bit",
                type: ["x1"],
                productNum: 1,
                durationNum: 744,
                inquiryTag: "localImage",
                selfProductNum: 1,
                inquiryResult: { amount: 0, originalAmount: 0, discountAmount: 0 },
              },
              {
                resourceType: "hws.resource.type.volume",
                cloudServiceType: "hws.service.type.ebs",
                resourceSpecCode: "SAS",
                productSpecSysDesc: "Disk Specifications:High I/O",
                volumeType: "High I/O",
                resourceSize: 40,
                billingMode: "ONDEMAND",
                productNum: 1,
                usageValue: 744,
                usageMeasureId: 4,
                inquiryResult: { amount: 0, originalAmount: 0, discountAmount: 0 },
              },
            ],
          },
        },
      ],
      name: cartName,
      totalPrice: { amount: 0, discountAmount: 0, originalAmount: 0 },
    };

    huaweiUpdateCart(key, samplePayload, cookie);

    const detail = await huaweiGetCartDetail(key, cookie);
    const items = extractCartSummaryItems(detail);
    console.log(`Cart "${detail.name}" has ${items.length} items:`);
    for (const item of items) {
      console.log(`  ${item.serviceCode} | ${item.region} | ${item.chargeMode} | qty=${item.quantity} | USD ${item.amount}`);
    }

    expect(items.length).toBe(1);
    expect(items[0].serviceCode).toBe("ecs");
    expect(items[0].region).toBe("sa-brazil-1");
    expect(items[0].chargeMode).toBe("ONDEMAND");
    expect(items[0].quantity).toBe(1);
  });

  test("read back the test cart and verify data integrity", async () => {
    const carts = await huaweiListCarts(cookie);
    const testCart = carts.find((c) => c.name.startsWith("NeoSync Test"));
    if (!testCart) {
      throw new Error("Test cart not found in Huawei cart list");
    }

    const detail = await huaweiGetCartDetail(testCart.key, cookie);
    expect(detail.name).toContain("NeoSync Test");
    expect(detail.cartListData.length).toBe(1);

    const sp = detail.cartListData[0].selectedProduct!;
    expect(sp.serviceCode).toBe("ecs");
    expect(sp.region).toBe("sa-brazil-1");
    expect(sp.chargeMode).toBe("ONDEMAND");
    expect((sp.purchaseNum as Record<string, number>).measureValue).toBe(1);
    expect((sp.purchaseTime as Record<string, number>).measureValue).toBe(744);

    const vmInfo = (sp.productAllInfos as Array<Record<string, unknown>>).find(
      (i) => (i.resourceType as string)?.includes(".vm"),
    )!;
    expect(vmInfo.resourceSpecCode).toBe("x1.2u.4g.linux");

    const diskInfo = (sp.productAllInfos as Array<Record<string, unknown>>).find(
      (i) => (i.resourceType as string)?.includes(".volume"),
    )!;
    expect(diskInfo.resourceSpecCode).toBe("SAS");
    expect(diskInfo.resourceSize).toBe(40);

    console.log("All data integrity checks passed for the synced test cart.");
  });
});
