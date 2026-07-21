import { describe, test, expect } from "bun:test";
import { scenario } from "../harness/builder";
import { validateAndRun, setValues, imageValue } from "../harness/run";
import type { BuiltScenario } from "../harness/builder";

/**
 * End-to-end: stale config → validation → transform → assemble → runtime.
 * These tests prove that the full production pipeline (with validation as the
 * first stage) still produces correct output for surviving mappings.
 */
describe("validation → runtime end-to-end", () => {
  test("deleted dependent variable: validation cleans it, surviving groups still fire", () => {
    const b = scenario();
    const size = b.listVar("Size", ["S", "M", "L"]);
    const color = b.listVar("Color", ["Red", "Blue"]);
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [
      b.group({ [size]: ["M"], [color]: ["Red"] }, "m_red.png"),
      b.group({ [size]: ["L"] }, "large.png"),
    ]);
    b.state({ Size: "L", Color: "Red" }, "L1");

    const sc = b.build();

    // Delete Color from the doc — simulates the variable being removed from the template.
    sc.doc.variables = sc.doc.variables.filter((v) => v.name !== "Color");

    const result = validateAndRun(sc);
    // The 2-dep group loses its Color dependent → collapses to a 1-dep group
    // keyed by Size alone. Size=L doesn't match ["M"], but the second group
    // (Size=L) is unaffected and should fire.
    expect(setValues(result)).toEqual({ Hero: imageValue("large.png") });
  });

  test("deleted target variable: validation removes it, other targets still fire", () => {
    const b = scenario();
    const size = b.listVar("Size", ["M"]);
    const hero = b.imageVar("Hero");
    const logo = b.imageVar("Logo");
    b.map("L1", hero, [b.group({ [size]: ["M"] }, "hero.png")]);
    b.map("L1", logo, [b.alwaysRun("logo.png")]);
    b.state({ Size: "M" }, "L1");

    const sc = b.build();

    // Delete Hero from the doc.
    sc.doc.variables = sc.doc.variables.filter((v) => v.name !== "Hero");

    const result = validateAndRun(sc);
    expect(setValues(result)).toEqual({ Logo: imageValue("logo.png") });
    // Hero should not appear in calls at all.
    expect(result.calls.find(([name]) => name === "Hero")).toBeUndefined();
  });

  test("deleted value-ref variable: validation removes the ref, remaining value parts compose", () => {
    const b = scenario();
    const size = b.listVar("Size", ["M"]);
    const region = b.shortTextVar("Region", "EU");
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [
      b.group({ [size]: ["M"] }, ["banner_", { ref: region }, ".png"]),
    ]);
    b.state({ Size: "M", Region: "EU" }, "L1");

    const sc = b.build();

    // Delete Region from the doc.
    sc.doc.variables = sc.doc.variables.filter((v) => v.name !== "Region");

    const result = validateAndRun(sc);
    // The ${Region} ref is removed by validation, leaving "banner_" + ".png".
    expect(setValues(result)).toEqual({ Hero: imageValue("banner_.png") });
  });
});
