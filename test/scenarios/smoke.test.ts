import { describe, test, expect } from "bun:test";
import { scenario } from "../harness/builder";
import { run, setValues, generateScript, imageValue } from "../harness/run";

describe("harness smoke", () => {
  test("single-dependent group: matching state selects the group's value", () => {
    const b = scenario();
    const size = b.listVar("Size", ["S", "M", "L"]);
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [
      b.group({ [size]: ["S", "M"] }, "hero_SM.png"),
      b.group({ [size]: ["L"] }, "hero_L.png"),
    ]);
    b.state({ Size: "M" }, "L1");

    const result = run(b.build());
    expect(setValues(result)).toEqual({ Hero: imageValue("hero_SM.png") });
  });

  test("no matching state sets nothing and records an error", () => {
    const b = scenario();
    const size = b.listVar("Size", ["S", "M", "L"]);
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [b.group({ [size]: ["S"] }, "hero_S.png")]);
    b.state({ Size: "L" }, "L1");

    const result = run(b.build());
    expect(result.calls).toEqual([]);
    expect(result.errors.join(" ")).toContain("no match found");
  });

  test("always-run sets its value regardless of dependent state", () => {
    const b = scenario();
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [b.alwaysRun("always.png")]);
    b.state({}, "L1");

    expect(setValues(run(b.build()))).toEqual({ Hero: imageValue("always.png") });
  });

  test("generateScript produces a runnable, deduped script", () => {
    const b = scenario();
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [b.alwaysRun("x.png")]);
    b.alsoAppliesTo("L1", "L2"); // identical content on two layouts -> one _shared_N
    const script = generateScript(b.build());
    expect(script).toContain("var _shared_0 =");
    expect(script).not.toContain("var _shared_1 ="); // deduped
    expect(script).toContain("imageSelectionScript");
  });
});
