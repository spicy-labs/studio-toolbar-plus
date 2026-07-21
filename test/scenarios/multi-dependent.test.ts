import { describe, test, expect } from "bun:test";
import { scenario } from "../harness/builder";
import { run, setValues, imageValue } from "../harness/run";
import { runtimeCasesByGroup } from "../harness/cases/runtime";

/**
 * Multi-dependent groups: the runtime matches positionally — slot `i` of `deps`
 * is tested against the current value of the `i`th dependent, and ALL slots must
 * match (`deps.every`). This is the core of the "complex logic" the real
 * templates exercise (2- and 4-dependent groups).
 *
 * Positive-match cases are shared with the real-engine integration suite
 * (test/harness/cases/runtime.ts). The no-match cases below stay Bun-only —
 * they assert on `.calls`/`.errors`, which the read-back integration harness
 * cannot observe.
 */
describe("multi-dependent groups", () => {
  for (const c of runtimeCasesByGroup().get("multi-dependent") ?? []) {
    test(c.name, () => expect(setValues(run(c.build()))).toEqual(c.expected));
  }

  test("2-dependent: one slot outside its set → no match", () => {
    const b = scenario();
    const size = b.listVar("Size", ["S", "M", "L"]);
    const color = b.listVar("Color", ["Red", "Blue"]);
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [b.group({ [size]: ["S", "M"], [color]: ["Red"] }, "sm_red.png")]);

    const r = run(b.state({ Size: "M", Color: "Blue" }, "L1").build());
    expect(r.calls).toEqual([]);
    expect(r.errors.join(" ")).toContain("no match found");
  });

  test("slot order is significant (deps aligned to dependentKey order)", () => {
    // Declared order Size, Color -> key "Size|Color", currentValues [Size, Color].
    const b = scenario();
    const size = b.listVar("Size", ["S", "M"]);
    const color = b.listVar("Color", ["Red", "Blue"]);
    const hero = b.imageVar("Hero");
    // "Red" is allowed for Color (slot 1), "S" for Size (slot 0).
    b.map("L1", hero, [b.group({ [size]: ["S"], [color]: ["Red"] }, "s_red.png")]);

    // Swapped values would fail if slots were mis-aligned; they are aligned, so
    // only the correct assignment matches.
    expect(setValues(run(b.state({ Size: "S", Color: "Red" }, "L1").build()))).toEqual({
      Hero: imageValue("s_red.png"),
    });
    expect(run(b.state({ Size: "Red", Color: "S" }, "L1").build()).calls).toEqual([]);
  });
});
