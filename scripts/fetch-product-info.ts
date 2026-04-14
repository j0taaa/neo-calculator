import { chromium } from "playwright";

const SERVICES = [
  "gaussdb",
  "gaussdb-mysql",
  "geminidb",
  "geminimongo",
  "drs",
  "cdn",
  "ddos",
  "anti-ddos",
  "mrs",
];

const BASE_URL =
  "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
  });

  // Navigate to pricing page first to get cookies
  const page = await context.newPage();
  console.log("Navigating to pricing page...");
  await page.goto(
    "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html",
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );
  await page.waitForTimeout(5000);

  for (const service of SERVICES) {
    const url = `${BASE_URL}?urlPath=${service}&tag=general.online.portal&region=ap-southeast-1&tab=calc&sign=common`;
    console.log(`\n=== ${service} ===`);
    try {
      const resp = await page.evaluate(async (fetchUrl: string) => {
        const r = await fetch(fetchUrl, {
          headers: {
            accept: "application/json, text/plain, */*",
            referer:
              "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html",
          },
          credentials: "include",
        });
        if (!r.ok) return { status: r.status, body: await r.text() };
        try {
          return { status: r.status, body: await r.json() };
        } catch {
          return { status: r.status, body: await r.text() };
        }
      }, url);

      if (typeof resp.body === "string") {
        console.log(`Status: ${resp.status}, Body: ${resp.body.substring(0, 500)}`);
        continue;
      }

      const data = resp.body as Record<string, unknown>;
      console.log(`Status: ${resp.status}`);

      if (data.errorCode || data.errorMsg || data.code) {
        console.log(`Error: ${JSON.stringify(data).substring(0, 300)}`);
        continue;
      }

      // Check for product data
      const product = data.product as Record<string, unknown> | undefined;
      if (!product) {
        console.log("No 'product' key. Top-level keys:", Object.keys(data));
        continue;
      }

      console.log("Product top-level keys:", Object.keys(product));

      // Get productAllInfos
      const allInfos = product.productAllInfos as Array<Record<string, unknown>> | undefined;
      if (allInfos && allInfos.length > 0) {
        const sampleSpecs = allInfos.slice(0, 3).map((info) => ({
          resourceSpecCode: info.resourceSpecCode,
          cloudServiceType: info.cloudServiceType,
          resourceType: info.resourceType,
          productSpecSysDesc: info.productSpecSysDesc,
        }));
        console.log(`Total productAllInfos count: ${allInfos.length}`);
        console.log("Sample specs:", JSON.stringify(sampleSpecs, null, 2));

        // Check for prices
        const hasPrice = allInfos.some(
          (info) =>
            info.price !== undefined &&
            info.price !== null &&
            info.price !== "" &&
            (typeof info.price === "number" ? info.price > 0 : true)
        );
        console.log("Has meaningful prices:", hasPrice);
        if (allInfos[0]?.price !== undefined) {
          console.log("Sample price value:", allInfos[0].price);
        }
      } else {
        console.log("No productAllInfos found");
      }
    } catch (e) {
      console.log(`Error: ${e}`);
    }
  }

  await browser.close();
}

main().catch(console.error);
