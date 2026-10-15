/** The published rule format contains data and bounded operations, never JavaScript source. */
export type Operation = [string, ...unknown[]];
export type RuleFunction = { $rule: { parameters: Operation[]; body: Operation; name?: string; closure?: Record<string, unknown> } };
export type RuleRegex = { $regex: string; flags: string };
export type CompiledRules = {
  version: 1;
  components: Record<string, unknown>[];
  sources: Record<string, unknown>[];
  visibility: Record<string, unknown>[];
  transforms: Record<string, unknown>[];
  globals: Record<string, unknown>;
  language: Record<string, unknown>;
  fingerprint: string;
};
