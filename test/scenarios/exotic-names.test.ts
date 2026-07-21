import { describe, test, expect } from "bun:test";
import { scenario } from "../harness/builder";
import { actionMapOf, run, setValues, imageValue } from "../harness/run";

/**
 * Exotic variable/layout names — characterization tests for names that collide
 * with reserved keys or JS prototype properties. These pin the current (often
 * surprising) behavior. Ticket 014 tracks the fix.
 */
describe("exotic names", () => {
  test("dependent variable named _always_run: collision crashes the runtime", () => {
    const b = scenario();
    // A list variable literally named "_always_run".
    const alwaysRunVar = b.listVar("_always_run", ["yes", "no"]);
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [
      b.group({ [alwaysRunVar]: ["yes"] }, "matched.png"),
    ]);
    b.state({ _always_run: "yes" }, "L1");

    const map = actionMapOf(b.build());
    // The dependency key "_always_run" collides with the reserved key...
    expect(map["L1"]["Hero"]["_always_run"]).toBeDefined();

    // ...and the runtime misinterprets the conditional array as an always-run
    // object, tries to call replaceVariables(undefined, undefined), and throws.
    // This is worse than "unmatchable" — it aborts all remaining variables.
    const result = run(b.build());
    expect(result.calls).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("variable named constructor: runtime enters dependency path with inherited value", () => {
    const b = scenario();
    const size = b.listVar("Size", ["M"]);
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [b.group({ [size]: ["M"] }, "hero.png")]);
    b.state({ Size: "M" }, "L1");

    const sc = b.build();
    // Add a variable named "constructor" to the doc (not mapped).
    sc.doc.variables.push({
      id: "ctor-var",
      name: "constructor",
      isVisiblie: true,
      type: "shortText",
      value: "",
    } as any);
    sc.state["constructor"] = "";

    const result = run(sc);
    // The mapped variable should still work despite the constructor variable.
    expect(result.calls.find(([name]) => name === "Hero")).toBeDefined();
    // "constructor" triggers a benign error path because
    // layoutImageMapping["constructor"] is truthy (inherited from Object.prototype)
    // but is a function, not a mapping object.
    expect(result.errors.some((e) => e.includes("constructor"))).toBe(true);
  });

  test("null variable value coerces to string 'null' for matching", () => {
    const b = scenario();
    const size = b.listVar("Size", ["M"]);
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [b.group({ [size]: ["null"] }, "null_match.png")]);
    // Set Size to null at runtime — coerced to "null" by template literal.
    b.state({ Size: null }, "L1");

    const result = run(b.build());
    expect(setValues(result)).toEqual({ Hero: imageValue("null_match.png") });
  });

  test("empty-string dependent value matches allowed ['']", () => {
    const b = scenario();
    const size = b.listVar("Size", ["", "M"]);
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [b.group({ [size]: [""] }, "empty_match.png")]);
    b.state({ Size: "" }, "L1");

    const result = run(b.build());
    expect(setValues(result)).toEqual({ Hero: imageValue("empty_match.png") });
  });

  test("malformed ${} pattern: empty name resolves to undefined", () => {
    const b = scenario();
    const size = b.listVar("Size", ["M"]);
    const hero = b.imageVar("Hero");
    // Literal string containing ${} — the regex captures name = "".
    b.map("L1", hero, [b.group({ [size]: ["M"] }, "prefix_${}_suffix")]);
    b.state({ Size: "M" }, "L1");

    const result = run(b.build());
    // getVariableValue("") returns undefined → becomes "undefined" string.
    expect(setValues(result)).toEqual({ Hero: imageValue("prefix_undefined_suffix") });
  });
});
