import { describe, test, expect } from "bun:test";
import { scenario } from "../harness/builder";
import { actionMapOf, run } from "../harness/run";

/**
 * Missing layout ID in the transformer — when a LayoutMap references a layoutId
 * that doesn't exist in doc.layouts. The transformer silently skips it, producing
 * an empty action map if all layout IDs are stale.
 */
describe("missing layout ID in transformer", () => {
  test("map targeting only deleted layouts produces an empty action map", () => {
    const b = scenario();
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [b.alwaysRun("hero.png")]);
    b.state({}, "L1");
    const sc = b.build();

    // Remove all layouts from the doc — simulates deleted layouts.
    sc.doc.layouts = [];

    const map = actionMapOf(sc);
    expect(map).toEqual({});
  });

  test("empty action map: script runs safely with 'no mapping found' error", () => {
    const b = scenario();
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [b.alwaysRun("hero.png")]);
    b.state({}, "L1");
    const sc = b.build();

    sc.doc.layouts = [];

    const result = run(sc);
    expect(result.calls).toEqual([]);
    expect(result.errors.join(" ")).toContain("No image mapping found");
  });
});
