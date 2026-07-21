import { describe, test, expect } from "bun:test";
import { run, setValues } from "../harness/run";
import { runtimeCasesByGroup } from "../harness/cases/runtime";

/**
 * Value composition: how the producer + runtime assemble a group's output from
 * literals, `${ref}` references, and user-authored `TextareaValue` parts, and
 * how chained per-variable transforms are applied.
 *
 * All cases are shared with the real-engine integration suite
 * (test/harness/cases/runtime.ts) so the mock and engine are asserted against
 * the same expectations.
 */
describe("value composition", () => {
  for (const c of runtimeCasesByGroup().get("value-composition") ?? []) {
    test(c.name, () => expect(setValues(run(c.build()))).toEqual(c.expected));
  }
});
