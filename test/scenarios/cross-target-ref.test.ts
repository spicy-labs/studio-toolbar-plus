import { describe, test, expect } from "bun:test";
import { scenario } from "../harness/builder";
import { run, setValues, imageValue } from "../harness/run";

/**
 * Cross-target references — when one target variable's value contains ${ref} to
 * another variable that is ALSO a target being set in the same action run.
 *
 * The real engine defers setVariableValue writes until the action script
 * completes — getVariableValue reads from a snapshot of the pre-action state.
 * So B always gets A's ORIGINAL value regardless of declaration order.
 * Confirmed via Playwright integration tests against the real engine.
 */
describe("cross-target reference ordering", () => {
  test("target B referencing ${A}: A declared first (deferred writes)", () => {
    const b = scenario();
    // A is declared first → processed first in the loop.
    const a = b.imageVar("A", "original_A");
    const bVar = b.imageVar("B", "original_B");
    b.map("L1", a, [b.alwaysRun("new_A")]);
    b.map("L1", bVar, [b.alwaysRun({ ref: a })]);
    b.state({ A: "original_A", B: "original_B" }, "L1");

    const result = run(b.build());
    // Writes are deferred: B reads from the pre-action snapshot, not A's new value.
    expect(setValues(result)).toEqual({
      A: imageValue("new_A"),
      B: imageValue("original_A"),
    });
  });

  test("target B declared before A: B sees A's original value", () => {
    const b = scenario();
    // B is declared first → processed first in the loop.
    const bVar = b.imageVar("B", "original_B");
    const a = b.imageVar("A", "original_A");
    b.map("L1", bVar, [b.alwaysRun({ ref: a })]);
    b.map("L1", a, [b.alwaysRun("new_A")]);
    b.state({ A: "original_A", B: "original_B" }, "L1");

    const result = run(b.build());
    // B reads from the pre-action snapshot — same result regardless of order.
    expect(setValues(result)).toEqual({
      B: imageValue("original_A"),
      A: imageValue("new_A"),
    });
  });
});
