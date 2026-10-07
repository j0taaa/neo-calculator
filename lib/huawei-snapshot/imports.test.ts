import { test, expect } from "bun:test";
import { assetImports } from "./imports";
test("dependency discovery ignores documentation imports and retains executable imports", () => {
  const body = `import {foo} from './a.js';\n/** @type {import('./types')} */\nconst x=()=>import('./b.js');`;
  const imports = assetImports(body, "https://example.com/code/main.js");
  expect(imports.map((i) => i.url)).toEqual([
    "https://example.com/code/a.js",
    "https://example.com/code/b.js",
  ]);
  for (const i of imports)
    expect(body.slice(i.start, i.end)).toMatch(/^\.\/.*\.js$/);
  expect(() =>
    assetImports("import(x)", "https://example.com/main.js"),
  ).toThrow("dynamic");
});
