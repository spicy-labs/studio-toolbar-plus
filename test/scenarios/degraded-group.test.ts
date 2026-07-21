import { describe, test, expect } from "bun:test";
import { scenario } from "../harness/builder";
import { run, setValues, actionMapOf, imageValue } from "../harness/run";

/**
 * Degraded groups — a group whose dependents reference a variable id that no
 * longer exists in the doc. This is the exact input class Phase 3 of the
 * optimization plan targets. These tests PIN the CURRENT (pre-P3) behavior so
 * that when P3 lands, its diff is visible and reviewed.
 *
 * Current behavior (the latent misalignment bug): the producer builds the
 * dependentKey from RESOLVED dependents only (N slots) but builds `deps` from
 * ALL dependents (M >= N slots). At runtime the extra slot(s) test against
 * `undefined`, so a partially-degraded multi-dependent entry can NEVER match —
 * it is dead weight, not a mis-selection.
 */
describe("degraded groups (deleted dependent variable)", () => {
  test("partially-degraded multi-dep entry never matches (dead, not wrong)", () => {
    const b = scenario();
    const size = b.listVar("Size", ["M"]);
    const hero = b.imageVar("Hero");
    // Second dependent points at a non-existent variable id.
    b.map("L1", hero, [
      b.group({ [size]: ["M"], [b.deletedRef()]: ["x"] }, "degraded.png"),
    ]);

    const r = run(b.state({ Size: "M" }, "L1").build());
    expect(r.calls).toEqual([]); // never selected
    expect(r.errors.join(" ")).toContain("no match found");
  });

  test("no preemption: a legitimate same-key group still wins", () => {
    const b = scenario();
    const size = b.listVar("Size", ["M"]);
    const hero = b.imageVar("Hero");
    // Degraded group is added FIRST (collapses to key "Size"), legit group second
    // (also key "Size"). Both live in the same array; degraded is skipped, legit
    // matches. This is the property P3 must preserve.
    b.map("L1", hero, [
      b.group({ [size]: ["M"], [b.deletedRef()]: ["x"] }, "degraded.png"),
      b.group({ [size]: ["M"] }, "legit.png"),
    ]);

    expect(setValues(run(b.state({ Size: "M" }, "L1").build()))).toEqual({
      Hero: imageValue("legit.png"),
    });
  });

  test("current producer emits the misaligned entry (deps longer than key)", () => {
    // Documents the bug at the data level: key has 1 slot, deps has 2.
    const b = scenario();
    const size = b.listVar("Size", ["M"]);
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [
      b.group({ [size]: ["M"], [b.deletedRef()]: ["x"] }, "degraded.png"),
    ]);

    const map = actionMapOf(b.build());
    const entry = map["L1"]["Hero"]["Size"][0];
    expect(entry.deps.length).toBe(2); // <-- M slots
    expect("Size".split("|").length).toBe(1); // <-- N slots (key)
    // When P3 lands, the group should not be emitted at all -> map["L1"]["Hero"]
    // will have no "Size" key from this group.
  });

  test("fully-unresolved group is not emitted at all", () => {
    const b = scenario();
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [
      b.group({ [b.deletedRef("GONE-1")]: ["x"], [b.deletedRef("GONE-2")]: ["y"] }, "z.png"),
    ]);

    const map = actionMapOf(b.build());
    expect(map["L1"]["Hero"]).toEqual({}); // no keys emitted
  });
});
