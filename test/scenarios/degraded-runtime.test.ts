import { describe, test, expect } from "bun:test";
import { scenario } from "../harness/builder";
import { run, setValues, actionMapOf } from "../harness/run";

/**
 * Runtime-side degradation paths the prior suite left uncovered:
 *   - a mapping whose TARGET image variable id no longer resolves,
 *   - the runtime "no dependancies" error branch (target present but `{}`),
 *   - the single try/catch: one throwing variable aborts ALL remaining ones.
 */
describe("degraded runtime paths", () => {
  test("deleted target-variable id: whole mapping silently produces nothing", () => {
    const b = scenario();
    const hero = b.imageVar("Hero"); // still iterated at runtime
    // The mapping targets an id that isn't in the doc (target deleted post-auth).
    b.map("L1", "DELETED-TARGET-ID", [b.alwaysRun("wanted.png")]);

    const map = actionMapOf(b.build());
    expect(map["L1"]).toEqual({}); // producer dropped the target entirely

    const r = run(b.state({}, "L1").build());
    expect(r.calls).toEqual([]); // nothing set
    // Hero exists but has no mapping of its own -> benign "no dependent groups".
    expect(r.errors.join(" ")).toContain("Hero");
  });

  test('"no dependancies" branch: a target that degraded to `{}` errors distinctly', () => {
    const b = scenario();
    const hero = b.imageVar("Hero");
    // Fully-unresolved conditional group -> producer emits Hero: {}.
    b.map("L1", hero, [
      b.group(
        { [b.deletedRef("GONE-1")]: ["x"], [b.deletedRef("GONE-2")]: ["y"] },
        "z.png",
      ),
    ]);

    const map = actionMapOf(b.build());
    expect(map["L1"]["Hero"]).toEqual({}); // present-but-empty

    const r = run(b.state({}, "L1").build());
    expect(r.calls).toEqual([]);
    // Distinct from "no dependent groups" (which is the undefined-key case).
    expect(r.errors.join(" ")).toContain("no dependancies for: Hero");
  });

  test("misaligned degraded slot never matches — not even against a literal 'undefined' allowed value", () => {
    // Reinforces degraded-group.test.ts's "dead, not wrong": the extra deps slot
    // compares against JS `undefined` (currentValues has fewer entries than
    // deps), and ["undefined"].includes(undefined) is false, so no false match.
    const b = scenario();
    const size = b.listVar("Size", ["M"]);
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [
      b.group({ [size]: ["M"], [b.deletedRef()]: ["undefined"] }, "degraded.png"),
    ]);

    const r = run(b.state({ Size: "M" }, "L1").build());
    expect(r.calls).toEqual([]);
    expect(r.errors.join(" ")).toContain("no match found");
  });

  test("one throwing variable aborts processing of all remaining variables (single try/catch)", () => {
    // Models a stale deployed action: a value references a variable that was
    // deleted from the live document. getVariableValue returns undefined and the
    // transform's `undefined.replaceAll(...)` throws — caught by the ONE outer
    // try/catch, aborting the whole loop so later variables are never set.
    const b = scenario();
    const ghost = b.shortTextVar("Ghost", "x-x");
    const size = b.listVar("Size", ["M"]);
    const hero = b.imageVar("Hero"); // processed before Logo (declaration order)
    const logo = b.imageVar("Logo");
    b.map("L1", hero, [
      b.group({ [size]: ["M"] }, [{ ref: ghost, transform: [{ find: "x", replace: "Y", replaceAll: true, regex: false }] }]),
    ]);
    b.map("L1", logo, [b.alwaysRun("logo.png")]);

    // Simulate Ghost having been deleted from the live variable state.
    const built = b.state({ Size: "M" }, "L1").build();
    delete built.state.Ghost;

    const r = run(built);
    // Logo would have been set unconditionally, but the throw on Hero aborts it.
    expect(setValues(r)).toEqual({});
    expect(r.errors.length).toBeGreaterThan(0);
  });
});
