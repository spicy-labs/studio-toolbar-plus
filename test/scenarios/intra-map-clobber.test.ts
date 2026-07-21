import { describe, test, expect } from "bun:test";
import { scenario } from "../harness/builder";
import { actionMapOf, run, setValues, imageValue } from "../harness/run";
import type { LayoutMap } from "../../src/types/layoutConfigTypes";

/**
 * Intra-map duplicate target variable — when the same target variable appears
 * twice in one LayoutMap.variables array. The current transformer re-initializes
 * `variableMap[name] = {}` unconditionally, so the second entry clobbers the
 * first. This test pins that behavior.
 *
 * Cross-map clobbering is tested in cross-map-merge.test.ts; this covers the
 * within-a-single-map case.
 */
describe("intra-map duplicate target clobber", () => {
  test("same target variable twice in one map: last entry wins", () => {
    const b = scenario();
    const size = b.listVar("Size", ["S", "M"]);
    const hero = b.imageVar("Hero");

    // Build a scenario normally with the first group.
    b.map("L1", hero, [b.group({ [size]: ["S"] }, "first_entry.png")]);
    b.state({ Size: "M" }, "L1");
    const sc = b.build();

    // Manually inject a duplicate target variable entry into the same LayoutMap.
    // The builder prevents this by design (it deduplicates by id), so we
    // construct it by hand.
    sc.layoutMaps[0].variables.push({
      id: hero,
      type: "StudioImage",
      dependentGroup: [
        {
          dependents: [{ variableId: size, values: ["M"] }],
          variableValue: ["second_entry.png"],
        },
      ],
    });

    const map = actionMapOf(sc);
    // The second entry's group is the only one present — first entry was clobbered.
    expect(map["L1"]["Hero"]["Size"]).toHaveLength(1);
    expect(map["L1"]["Hero"]["Size"][0].value).toBe("second_entry.png");

    const result = run(sc);
    expect(setValues(result)).toEqual({ Hero: imageValue("second_entry.png") });
  });
});
