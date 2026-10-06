import { expect, test } from "bun:test";
import { NativeOperations, isNativeOperationId } from "./native-operations";

test("cancel before initialization creates no renderer", async () => {
  const released: string[] = [];
  const operations = new NativeOperations(async session => { released.push(session); });
  let initialized = false;
  await operations.cancel("operation");
  await expect(operations.run("operation", async () => { initialized = true; return { session: "session" }; })).rejects.toThrow("cancelled");
  expect(initialized).toBe(false);
  expect(released).toEqual([]);
});
test("cancel during initialization releases its eventual renderer", async () => {
  const released: string[] = [];
  const operations = new NativeOperations(async session => { released.push(session); });
  let finish!: (result: { session: string }) => void;
  const pending = operations.run("operation", () => new Promise<{ session: string }>(resolve => { finish = resolve; }));
  await operations.cancel("operation");
  finish({ session: "created-later" });
  await expect(pending).rejects.toThrow("cancelled");
  expect(released).toEqual(["created-later"]);
});
test("late cancellation releases only its own renderer once", async () => {
  const released: string[] = [];
  const operations = new NativeOperations(async session => { released.push(session); });
  await operations.run("first", async () => ({ session: "first-session" }));
  await operations.run("second", async () => ({ session: "second-session" }));
  await operations.cancel("first"); await operations.cancel("first");
  expect(released).toEqual(["first-session"]);
  await expect(operations.run("second", async () => ({ session: "replacement" }))).rejects.toThrow("already used");
});
test("expired history clears without dropping active initializations", async () => {
  const operations = new NativeOperations(async () => {});
  await operations.cancel("expired");
  let finish!: (result: { session: string }) => void;
  const running = operations.run("active", () => new Promise<{ session: string }>(resolve => { finish = resolve; }));
  operations.sweep(Date.now() + 600001);
  await expect(operations.run("expired", async () => ({ session: "fresh" }))).resolves.toEqual({ session: "fresh" });
  await expect(operations.run("active", async () => ({ session: "duplicate" }))).rejects.toThrow("already used");
  finish({ session: "original" }); await running;
});
test("initialization IDs accept opaque UUIDs and reject malformed cleanup requests", () => {
  expect(isNativeOperationId(crypto.randomUUID())).toBe(true);
  for (const invalid of [undefined, "", "arbitrary", "x".repeat(36), 42]) expect(isNativeOperationId(invalid)).toBe(false);
});
