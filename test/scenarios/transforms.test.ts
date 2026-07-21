import { describe, test, expect } from "bun:test";
import { scenario } from "../harness/builder";
import { run, setValues, imageValue } from "../harness/run";
import { runtimeCasesByGroup } from "../harness/cases/runtime";

/**
 * Value strings can embed `${VarName}` references that are substituted at
 * runtime with the current value of that variable, then have per-variable
 * transform commands applied (`replace` / `replaceAll`).
 *
 * The positive-match cases are shared with the real-engine integration suite
 * (test/harness/cases/runtime.ts). The guarded no-transform case below stays
 * Bun-only — it asserts on the mock's `.errors` channel, which the read-back
 * integration harness cannot observe.
 */
describe("value substitution and transforms", () => {
  for (const c of runtimeCasesByGroup().get("transforms") ?? []) {
    test(c.name, () => expect(setValues(run(c.build()))).toEqual(c.expected));
  }

  test("`${ref}` with no transform entry returns the raw value (guarded)", () => {
    // Current runtime guards `allTransforms?.[name]`; this is the DIV-3 path
    // where the pre-optimization (main) matcher would throw instead.
    const b = scenario();
    const size = b.listVar("Size", ["M"]);
    const caption = b.shortTextVar("Caption", "untouched");
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [b.group({ [size]: ["M"] }, [{ ref: caption }])]);

    const r = run(b.state({ Size: "M", Caption: "untouched" }, "L1").build());
    expect(setValues(r)).toEqual({ Hero: imageValue("untouched") });
    // The image variable resolved cleanly — no throw from the substitution path
    // (main's unguarded `.reduce` would have errored here).
    expect(r.errors.some((e) => e.includes("Hero"))).toBe(false);
  });
});
