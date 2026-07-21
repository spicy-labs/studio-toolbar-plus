import { describe, test, expect } from "bun:test";
import { scenario } from "../harness/builder";
import { run, setValues, actionMapOf, imageValue } from "../harness/run";

/**
 * Multiple independent LayoutMaps targeting the SAME layout. The producer folds
 * them with `Object.assign(actionMap[layout.name], variableMap)`
 * (layoutMappingToActionMap.ts:132), iterating layoutMaps in array order. This
 * class was previously both untested AND inexpressible in the DSL — `newMap()`
 * makes it authorable (a user multi-selecting overlapping layouts across two
 * mappings).
 *
 * Current behavior:
 *   - Distinct image variables from each map are UNIONED onto the layout.
 *   - The SAME image variable in a later map CLOBBERS the earlier map's entry
 *     entirely (last map in array order wins) — a silent loss of the first
 *     map's whole group set for that variable.
 */
describe("cross-map merge on a shared layout", () => {
  test("distinct image variables from two maps are unioned", () => {
    const b = scenario();
    const hero = b.imageVar("Hero");
    const logo = b.imageVar("Logo");
    b.newMap("L1", hero, [b.alwaysRun("hero.png")]);
    b.newMap("L1", logo, [b.alwaysRun("logo.png")]);

    expect(setValues(run(b.state({}, "L1").build()))).toEqual({
      Hero: imageValue("hero.png"),
      Logo: imageValue("logo.png"),
    });
  });

  test("same image variable across two maps: the LATER map clobbers the earlier", () => {
    const b = scenario();
    const hero = b.imageVar("Hero");
    b.newMap("L1", hero, [b.alwaysRun("from_map_1.png")]);
    b.newMap("L1", hero, [b.alwaysRun("from_map_2.png")]);

    // Object.assign overwrites Hero's entry — map 1's group set is gone.
    expect(setValues(run(b.state({}, "L1").build()))).toEqual({
      Hero: imageValue("from_map_2.png"),
    });

    // At the data level: only the second map's value survives.
    const map = actionMapOf(b.build());
    expect(map["L1"]["Hero"]["_always_run"].value).toBe("from_map_2.png");
  });

  test("clobber discards conditional logic authored in the first map", () => {
    const b = scenario();
    const size = b.listVar("Size", ["S", "M"]);
    const hero = b.imageVar("Hero");
    // Map 1: rich conditional logic. Map 2: a single always-run.
    b.newMap("L1", hero, [
      b.group({ [size]: ["S"] }, "small.png"),
      b.group({ [size]: ["M"] }, "medium.png"),
    ]);
    b.newMap("L1", hero, [b.alwaysRun("override.png")]);

    // Even with Size=M matching map 1's conditional, map 2 wins wholesale.
    expect(setValues(run(b.state({ Size: "M" }, "L1").build()))).toEqual({
      Hero: imageValue("override.png"),
    });
  });
});
