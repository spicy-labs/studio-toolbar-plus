import { describe, test, expect } from "bun:test";
import { run, setValues } from "../harness/run";
import { runtimeCasesByGroup } from "../harness/cases/runtime";

/**
 * No re-expansion — when a referenced variable's current value itself contains
 * ${...} syntax, it must NOT be substituted again. Single-pass substitution,
 * no recursion — a correctness and safety invariant.
 *
 * Shared with the real-engine integration suite (test/harness/cases/runtime.ts).
 */
describe("no re-expansion of substituted values", () => {
  for (const c of runtimeCasesByGroup().get("no-reexpansion") ?? []) {
    test(c.name, () => expect(setValues(run(c.build()))).toEqual(c.expected));
  }
});
