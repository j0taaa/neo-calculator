const result = await Bun.build({
  entrypoints: ["lib/huawei-snapshot/frame.ts"],
  target: "browser",
  format: "iife",
  outdir: "public",
  naming: "calculator-snapshot-bridge.js",
  minify: true,
});
if (!result.success)
  throw new AggregateError(
    result.logs,
    "Local calculator bridge could not be built",
  );
export {};
