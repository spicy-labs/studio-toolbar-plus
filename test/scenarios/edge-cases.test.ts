import { describe, test, expect } from "bun:test";
import { scenario } from "../harness/builder";
import { run, setValues, imageValue } from "../harness/run";

/**
 * Boundary conditions and value shapes that a real doc rarely surfaces but the
 * logic must handle deterministically.
 */
describe("edge cases", () => {
  test("selected layout has no mapping → error, nothing set", () => {
    const b = scenario();
    const size = b.listVar("Size", ["M"]);
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [b.group({ [size]: ["M"] }, "x.png")]);

    const r = run(b.state({ Size: "M" }, "SOME-OTHER-LAYOUT").build());
    expect(r.calls).toEqual([]);
    expect(r.errors.join(" ")).toContain("No image mapping found");
  });

  test("mapped and unmapped variables coexist: mapped one is still set", () => {
    const b = scenario();
    const size = b.listVar("Size", ["M"]); // iterated by all(), unmapped
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [b.group({ [size]: ["M"] }, "x.png")]);

    const r = run(b.state({ Size: "M" }, "L1").build());
    expect(setValues(r)).toEqual({ Hero: imageValue("x.png") });
    // Size has no mapping of its own -> a "no dependent groups" error, harmless.
    expect(r.errors.join(" ")).toContain("Size");
  });

  test("empty allowed set matches nothing", () => {
    const b = scenario();
    const size = b.listVar("Size", ["M"]);
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [b.group({ [size]: [] }, "never.png")]);

    expect(run(b.state({ Size: "M" }, "L1").build()).calls).toEqual([]);
  });

  // Dependents are restricted to `list` variables by AddDependentModal.tsx
  // (the picker filters `variable.type === "list"`, ~line 140), so a boolean
  // condition can't be produced by the UI today. This test only characterizes
  // the runtime's stringify-and-compare behavior IF such an input ever existed
  // (e.g. if the modal later allowed boolean conditions).
  test("boolean dependent: runtime coerces to string (NOT modal-producible — dependents are list-only)", () => {
    const b = scenario();
    const flag = b.boolVar("Flag", false);
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [
      b.group({ [flag]: ["true"] }, "on.png"),
      b.group({ [flag]: ["false"] }, "off.png"),
    ]);

    expect(setValues(run(b.state({ Flag: true }, "L1").build()))).toEqual({ Hero: imageValue("on.png") });
    expect(setValues(run(b.state({ Flag: false }, "L1").build()))).toEqual({ Hero: imageValue("off.png") });
  });

  test("allowed value containing a pipe matches correctly (array-match, DIV-2)", () => {
    const b = scenario();
    const code = b.listVar("Code", ["a|b", "c"]);
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [b.group({ [code]: ["a|b"] }, "piped.png")]);

    expect(setValues(run(b.state({ Code: "a|b" }, "L1").build()))).toEqual({
      Hero: imageValue("piped.png"),
    });
  });

  test("multiple image variables in one layout are each resolved", () => {
    const b = scenario();
    const size = b.listVar("Size", ["M"]);
    const hero = b.imageVar("Hero");
    const logo = b.imageVar("Logo");
    b.map("L1", hero, [b.group({ [size]: ["M"] }, "hero.png")]);
    b.map("L1", logo, [b.alwaysRun("logo.png")]);

    expect(setValues(run(b.state({ Size: "M" }, "L1").build()))).toEqual({
      Hero: imageValue("hero.png"),
      Logo: imageValue("logo.png"),
    });
  });
});
