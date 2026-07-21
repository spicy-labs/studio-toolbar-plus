import { describe, test, expect } from "bun:test";
import { scenario } from "../harness/builder";
import { actionMapOf, run, setValues, imageValue } from "../harness/run";
import type { VariableValue } from "../../src/types/layoutConfigTypes";

/**
 * VariableValue with null id — the "never-selected slot" that the UI produces
 * when a user adds a value reference but hasn't picked a variable yet.
 * Distinct from the "deleted ref" path (truthy id, not found in doc).
 */
describe("null-id VariableValue", () => {
  test("null-id ref contributes empty string in value composition", () => {
    const b = scenario();
    const size = b.listVar("Size", ["M"]);
    const hero = b.imageVar("Hero");

    // Build the scenario, then manually inject a null-id VariableValue.
    b.map("L1", hero, [b.group({ [size]: ["M"] }, "placeholder")]);
    b.state({ Size: "M" }, "L1");
    const sc = b.build();

    // Replace the group's variableValue with: "banner_" + nullRef + ".png"
    sc.layoutMaps[0].variables[0].dependentGroup[0].variableValue = [
      "banner_",
      { id: null, type: "StudioText", transform: [] } as unknown as VariableValue,
      ".png",
    ];

    const result = run(sc);
    expect(setValues(result)).toEqual({ Hero: imageValue("banner_.png") });
  });

  test("null-id ref does not produce a transforms key in the action map", () => {
    const b = scenario();
    const size = b.listVar("Size", ["M"]);
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [b.group({ [size]: ["M"] }, "placeholder")]);
    b.state({ Size: "M" }, "L1");
    const sc = b.build();

    // Inject a null-id ref with transforms — transforms should be ignored.
    sc.layoutMaps[0].variables[0].dependentGroup[0].variableValue = [
      {
        id: null,
        type: "StudioText",
        transform: [{ find: "a", replace: "b", replaceAll: true, regex: false }],
      } as unknown as VariableValue,
    ];

    const map = actionMapOf(sc);
    const entry = map["L1"]["Hero"]["Size"][0];
    expect(entry.transforms).toBeUndefined();
  });
});
