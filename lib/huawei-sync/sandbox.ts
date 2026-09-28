import { getQuickJS } from "quickjs-emscripten";

/** No host functions, module loader, filesystem, networking, or application globals. */
export async function runIsolated<T>(source: string, expression: string, input: unknown, timeoutMs = 1500): Promise<T> {
  if (source.length > 4_000_000) throw new Error("Huawei program exceeds size limit");
  const quickjs = await getQuickJS();
  const runtime = quickjs.newRuntime();
  runtime.setMemoryLimit(64 * 1024 * 1024);
  runtime.setMaxStackSize(512 * 1024);
  const deadline = Date.now() + timeoutMs;
  runtime.setInterruptHandler(() => Date.now() > deadline);
  const context = runtime.newContext();
  try {
    const evaluate = (code: string) => {
      const result = context.evalCode(code);
      if (result.error) {
        const error = context.dump(result.error);
        result.error.dispose();
        throw new Error(`Huawei rule evaluation failed: ${error?.message ?? "unknown error"}`);
      }
      try { return context.dump(result.value); } finally { result.value.dispose(); }
    };
    // Freeze nondeterministic capabilities. Upstream functions receive all state explicitly.
    evaluate(`globalThis.Date = undefined; Math.random = undefined;`);
    evaluate(source);
    const inputHandle = context.newString(JSON.stringify(input));
    context.setProp(context.global, "__neoInputJSON", inputHandle);
    inputHandle.dispose();
    const output = evaluate(`JSON.stringify((${expression})(JSON.parse(__neoInputJSON)))`);
    if (typeof output !== "string" || output.length > 8_000_000) throw new Error("Invalid Huawei engine output");
    return JSON.parse(output) as T;
  } finally {
    context.dispose();
    runtime.dispose();
  }
}
