import { db } from "@/lib/db";
import { sampleEcsCartItem } from "@/lib/huawei-calculator-template";
import { buildLocalProductsFromHuaweiCart, listHuaweiCarts, pushLocalProductsToHuaweiCart } from "@/lib/huawei-calculator";

const TEST_REGION_ID = "sa-brazil-1";
const TEST_FLAVOR_CODE = "neo.sync.2u.4g.linux";
const TEST_COOKIE = "HWS_INTL_ID=test-token; csrf=test-csrf";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function ensureTestFlavor() {
  const now = new Date().toISOString();
  db.query(
    `
      INSERT INTO ecs_catalog_region (region_id, name, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(region_id) DO UPDATE SET
        name = excluded.name,
        updated_at = excluded.updated_at
    `,
  ).run(TEST_REGION_ID, "Sao Paulo", now);

  const flavor = {
    resourceType: "hws.resource.type.vm",
    cloudServiceType: "hws.service.type.ec2",
    resourceSpecCode: TEST_FLAVOR_CODE,
    productSpecSysDesc: "Memory:4096MB;vCPUs:2CORE;CPU Architecture:x86;Type:General Computing;System Disk:40GB;Series:T6;Image:Linux",
    resourceSpecType: "t6",
    mem: "4BSSUNIT.pluralUnit.102",
    cpu: "2dataInfo_36_",
    performType: "General Computing",
    series: "T6",
    image: "Linux",
    spec: "neo.sync.2u.4g",
    arch: "dataInfo_32_",
    generation: "T6",
    vmType: "dataInfo_1_",
    productId: "vm-test-product",
    planList: [
      {
        productId: "vm-test-product",
        billingMode: "ONDEMAND",
        amount: 0.1,
      },
      {
        productId: "vm-test-product-monthly",
        billingMode: "MONTHLY",
        amount: 60,
      },
      {
        productId: "vm-test-product-yearly",
        billingMode: "YEARLY",
        amount: 600,
      },
      {
        productId: "vm-test-product-ri",
        billingMode: "RI",
        originType: "price",
        amount: 0,
        paymentType: "nodeData.NO_UPFRONT",
        paymentTypeKey: "NO_UPFRONT",
      },
      {
        productId: "vm-test-product-ri",
        billingMode: "RI",
        originType: "perEffectivePrice",
        amount: 5,
        paymentType: "nodeData.NO_UPFRONT",
        paymentTypeKey: "NO_UPFRONT",
      },
      {
        productId: "vm-test-product-ri",
        billingMode: "RI",
        originType: "perPrice",
        amount: 60,
        paymentType: "nodeData.NO_UPFRONT",
        paymentTypeKey: "NO_UPFRONT",
      },
    ],
    inquiryResult: {
      id: "vm-inquiry",
      productId: "vm-test-product",
      amount: 0.1,
      originalAmount: 0.1,
      discountAmount: 0,
    },
  };

  db.query(
    `
      INSERT INTO ecs_flavor (
        region_id,
        resource_spec_code,
        family,
        architecture,
        series,
        description,
        cpu,
        ram_gib,
        flavor_json,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(region_id, resource_spec_code) DO UPDATE SET
        flavor_json = excluded.flavor_json,
        updated_at = excluded.updated_at
    `,
  ).run(TEST_REGION_ID, TEST_FLAVOR_CODE, "neo", "x86", "T6", "Test flavor", 2, 4, JSON.stringify(flavor), now);

  for (const key of ["ecsCatalogLastCompletedAt", "ecsCatalogLastFullCompletedAt"]) {
    db.query(
      `
        INSERT INTO ecs_catalog_meta (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
    ).run(key, now);
  }
}

async function main() {
  ensureTestFlavor();

  const originalFetch = globalThis.fetch;
  const updateBodies: unknown[] = [];

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url.includes("/share/list")) {
      return new Response(
        JSON.stringify({
          lists: [
            { key: "remote-1", name: "Imported remote cart", updateTime: 1700000000000, totalPrice: { amount: 55.2, originalAmount: 55.2 } },
            { key: "remote-2", name: "Another cart", updateTime: 1690000000000, totalPrice: { amount: 0, originalAmount: 0 } },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    if (url.includes("/share/detail")) {
      const importedItem = structuredClone(sampleEcsCartItem) as Record<string, unknown>;
      const selectedProduct = importedItem.selectedProduct as Record<string, unknown>;
      const productAllInfos = selectedProduct.productAllInfos as Array<Record<string, unknown>>;
      selectedProduct.region = TEST_REGION_ID;
      selectedProduct.serviceCode = "ecs";
      selectedProduct.amount = 55.2;
      selectedProduct.originalAmount = 55.2;
      selectedProduct.purchaseTime = { measureValue: 744 };
      selectedProduct.purchaseNum = { measureValue: 1 };
      selectedProduct._customTitle = "Imported remote cart item";
      selectedProduct.description = "Elastic Cloud Server";
      productAllInfos[0].resourceSpecCode = TEST_FLAVOR_CODE;
      productAllInfos[2].resourceSpecCode = "SAS";
      productAllInfos[2].resourceSize = 40;

      return new Response(
        JSON.stringify({
          data: {
            name: "Imported remote cart",
            billingMode: "cart.shareList.billingModeTotal",
            cartListData: [importedItem],
            totalPrice: { amount: 55.2, originalAmount: 55.2, discountAmount: 0 },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    if (url.includes("/share/add")) {
      return new Response(JSON.stringify({ data: "created-huawei-cart" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.includes("/share/update")) {
      updateBodies.push(JSON.parse(String(init?.body ?? "{}")));
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.includes("/productInfo")) {
      return new Response(
        JSON.stringify({
          product: {
            ebs_volume: [
              {
                resourceSpecCode: "SAS",
                resourceSpecType: "SAS",
                resourceType: "hws.resource.type.volume",
                cloudServiceType: "hws.service.type.ebs",
                productSpecSysDesc: "Disk Specifications:High I/O",
                volumeType: "High I/O",
                productId: "disk-test-product",
                type: "dataInfo_24_",
                billingItem: "detail_42_",
                info: "dataInfo_26_",
                specifications: "dataInfo_27_",
                tableUnit: "detail_26_",
                planList: [
                  { productId: "disk-test-product", billingMode: "ONDEMAND", amount: 0.0002 },
                  { productId: "disk-test-product-monthly", billingMode: "MONTHLY", amount: 0.12 },
                  { productId: "disk-test-product-yearly", billingMode: "YEARLY", amount: 1.2 },
                ],
                inquiryResult: {
                  id: "disk-inquiry",
                  productId: "disk-test-product",
                  amount: 0.0002,
                  originalAmount: 0.0002,
                  discountAmount: 0,
                },
              },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    throw new Error(`Unhandled mocked fetch URL: ${url}`);
  }) as typeof fetch;

  try {
    const carts = await listHuaweiCarts(TEST_COOKIE);
    assert(carts.length === 2, "Expected two Huawei carts");
    assert(carts[0]?.key === "remote-1", "Expected remote carts to be sorted by update time");

    const imported = await buildLocalProductsFromHuaweiCart("remote-1", TEST_COOKIE);
    assert(imported.products.length === 1, "Expected one imported product");
    assert(imported.products[0]?.productType === "ecs", "Expected imported ECS product");
    assert((imported.products[0]?.config as { region?: string }).region === "la-sao-paulo1", "Expected imported region to map to UI region key");

    const pushed = await pushLocalProductsToHuaweiCart({
      listName: "Neo sync cart",
      products: [
        {
          serviceCode: "ECS",
          serviceName: "Elastic Cloud Server",
          productType: "ecs",
          title: "Elastic Cloud Server neo.sync.2u.4g.linux",
          quantity: 2,
          config: {
            region: "la-sao-paulo1",
            billingMode: "Pay-per-use",
            usageHours: 744,
            flavor: TEST_FLAVOR_CODE,
            systemDisk: {
              type: "High I/O",
              sizeGiB: 40,
            },
          },
          pricing: null,
        },
      ],
      cookie: TEST_COOKIE,
    });

    assert(pushed.key === "created-huawei-cart", "Expected sync to create a Huawei cart when one is not linked");
    assert(updateBodies.length === 1, "Expected one Huawei update request");

    const updatePayload = updateBodies[0] as {
      name?: string;
      cartListData?: Array<{ selectedProduct?: { serviceCode?: string; region?: string; purchaseNum?: { measureValue?: number } } }>;
    };
    assert(updatePayload.name === "Neo sync cart", "Expected pushed Huawei cart to keep the Neo list name");
    assert(updatePayload.cartListData?.length === 1, "Expected one item in the pushed Huawei cart");
    assert(updatePayload.cartListData?.[0]?.selectedProduct?.serviceCode === "ecs", "Expected pushed item to be ECS");
    assert(updatePayload.cartListData?.[0]?.selectedProduct?.region === TEST_REGION_ID, "Expected pushed item region to use Huawei region id");
    assert(updatePayload.cartListData?.[0]?.selectedProduct?.purchaseNum?.measureValue === 2, "Expected pushed quantity to match Neo quantity");

    console.log("Huawei cart sync helpers passed");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

await main();
