import { test, expect } from "bun:test";
import { createEmissionQueue } from "./emissions";

const turn = () => new Promise<void>(resolve => setTimeout(resolve, 0));

test("coalesces synchronous and render-microtask changes using the latest component state", async () => {
  const queue = createEmissionQueue();
  let value = 1;
  const observed: number[] = [];
  const emit = queue.debounce(() => observed.push(value));
  emit();
  value = 2;
  emit();
  await Promise.resolve();
  value = 3;
  emit();
  expect(observed).toEqual([]);
  expect(queue.pending).toBe(1);
  expect(queue.version).toBe(3);
  await turn();
  expect(observed).toEqual([3]);
  expect(queue.pending).toBe(0);
});

test("nested conditional updates remain pending until every component emission finishes", async () => {
  const queue = createEmissionQueue();
  const observed: string[] = [];
  const parent = queue.debounce(() => observed.push("parent"));
  const child = queue.debounce(() => {
    observed.push("child");
    parent();
  });
  child();
  await turn();
  expect(observed).toEqual(["child"]);
  expect(queue.pending).toBe(1);
  const intermediateVersion = queue.version;
  await turn();
  expect(observed).toEqual(["child", "parent"]);
  expect(queue.pending).toBe(0);
  expect(queue.version).toBeGreaterThan(intermediateVersion);
});
