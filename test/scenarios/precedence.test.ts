import { describe, test, expect } from "bun:test";
import { run, setValues } from "../harness/run";
import { runtimeCasesByGroup } from "../harness/cases/runtime";

/**
 * When more than one group could match, which one wins? The runtime uses
 * `groups.find(...)` within a dependentKey (first array entry wins) and a
 * `reduce` that returns the first matching dependentKey across keys.
 *
 * Shared with the real-engine integration suite (test/harness/cases/runtime.ts).
 */
describe("match precedence", () => {
  for (const c of runtimeCasesByGroup().get("precedence") ?? []) {
    test(c.name, () => expect(setValues(run(c.build()))).toEqual(c.expected));
  }
});
