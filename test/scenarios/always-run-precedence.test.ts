import { describe, test, expect } from "bun:test";
import { scenario } from "../harness/builder";
import { run, setValues, imageValue } from "../harness/run";

/**
 * Interaction between an always-run group and conditional groups on the SAME
 * image variable. The prior suite only ever exercised always-run in isolation;
 * these pin what happens when a user authors both (a UI-reachable config — the
 * "Run Always" checkbox in AddDependentModal, and groups are not reorderable).
 *
 * Current behavior (characterization — includes the surprising parts):
 *   - The runtime checks `_always_run` FIRST and `continue`s
 *     (imageSelection.js:46), so an always-run group SILENTLY PREEMPTS every
 *     conditional group on that variable, regardless of authored order or
 *     whether a condition would have matched.
 *   - The producer writes `_always_run` per group with plain assignment
 *     (layoutMappingToActionMap.ts:79), so MULTIPLE always-run groups collapse
 *     to the LAST one (silent last-wins).
 */
describe("always-run vs conditional precedence", () => {
  test("always-run preempts a conditional group that WOULD have matched", () => {
    const b = scenario();
    const size = b.listVar("Size", ["S", "M"]);
    const hero = b.imageVar("Hero");
    // A specific condition authored first, an always-run fallback second.
    b.map("L1", hero, [
      b.group({ [size]: ["M"] }, "specific_M.png"),
      b.alwaysRun("fallback.png"),
    ]);

    // Size=M matches the specific group, yet always-run wins.
    expect(setValues(run(b.state({ Size: "M" }, "L1").build()))).toEqual({
      Hero: imageValue("fallback.png"),
    });
  });

  test("always-run authored FIRST also preempts (order does not matter)", () => {
    const b = scenario();
    const size = b.listVar("Size", ["S", "M"]);
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [
      b.alwaysRun("fallback.png"),
      b.group({ [size]: ["M"] }, "specific_M.png"),
    ]);

    expect(setValues(run(b.state({ Size: "M" }, "L1").build()))).toEqual({
      Hero: imageValue("fallback.png"),
    });
  });

  test("multiple always-run groups collapse to the LAST (silent last-wins)", () => {
    const b = scenario();
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [
      b.alwaysRun("first.png"),
      b.alwaysRun("second.png"),
    ]);

    expect(setValues(run(b.state({}, "L1").build()))).toEqual({
      Hero: imageValue("second.png"),
    });
  });
});
