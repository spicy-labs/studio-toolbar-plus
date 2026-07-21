import { describe, test, expect } from "bun:test";
import { run, setValues } from "../harness/run";
import { runtimeCasesByGroup } from "../harness/cases/runtime";

/**
 * $-replacement patterns in transform strings. `String.prototype.replace` /
 * `replaceAll` interpret special sequences in the replacement string ($$, $&,
 * …). This pins the current (potentially surprising) behavior.
 *
 * Shared with the real-engine integration suite (test/harness/cases/runtime.ts)
 * — these are a prime candidate for V8↔QuickJS divergence, so both engines are
 * asserted against the same expectations.
 */
describe("$-replacement patterns in transforms", () => {
  for (const c of runtimeCasesByGroup().get("replacement-patterns") ?? []) {
    test(c.name, () => expect(setValues(run(c.build()))).toEqual(c.expected));
  }
});
