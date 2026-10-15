import { expect, test } from "bun:test";
import { productInputError, snapshotServiceCode } from "./product-input";

test("malformed product identities, configs and quantities are rejected before route access", () => {
  for (const value of [null, false, [], "product", { serviceCode: 42 }, { serviceName: {} },
    { productType: false }, { title: [] }, { config: null }, { config: [] },
    { quantity: 0 }, { quantity: 1.5 }, { quantity: 10000 }, { quantity: "2" }, { quantity: NaN }])
    expect(productInputError(value)).not.toBeNull();
  expect(productInputError({ serviceCode: "HUAWEI:ecs", config: {}, quantity: 9999 })).toBeNull();
  expect(productInputError({ pricing: { amount: 0, currency: "JPY" } })).toBeNull();
});
test("snapshot configurations cannot fall through to legacy pricing when a service alias is used", () => {
  const config = { local: {}, selection: { service: "redis" } };
  expect(snapshotServiceCode("dcs", config)).toBe("HUAWEI:redis");
  expect(snapshotServiceCode("ECS", config)).toBe("HUAWEI:ecs");
  expect(snapshotServiceCode("ECS", {})).toBe("ECS");
  expect(snapshotServiceCode("HUAWEI:RABBITMQ", { local: {}, selection: { service: "rabbitMQ" } })).toBe("HUAWEI:rabbitMQ");
});
