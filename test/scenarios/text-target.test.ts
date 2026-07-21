import { describe, test, expect } from "bun:test";
import { scenario } from "../harness/builder";
import { run, setValues } from "../harness/run";

/**
 * Non-image target variable types. All existing tests use imageVar() as the
 * mapping target. This smoke test confirms shortText targets work through the
 * full pipeline. The runtime doesn't differentiate by type, but this pins the
 * path in case the transformer or builder ever introduces type-aware logic.
 */
describe("non-image target variable types", () => {
  test("shortTextVar as mapping target: conditional group fires correctly", () => {
    const b = scenario();
    const size = b.listVar("Size", ["S", "M", "L"]);
    const headline = b.shortTextVar("Headline");

    // Use shortTextVar id directly — builder hardcodes type as StudioImage
    // in map(), but the transformer looks up by id, so the type field in
    // LayoutMap.variables doesn't affect the transform or runtime.
    b.map("L1", headline, [
      b.group({ [size]: ["S", "M"] }, "Small or Medium"),
      b.group({ [size]: ["L"] }, "Large"),
    ]);
    b.state({ Size: "M" }, "L1");

    const result = run(b.build());
    expect(setValues(result)).toEqual({ Headline: "Small or Medium" });
  });

  test("shortTextVar as target with ${ref} substitution and transform", () => {
    const b = scenario();
    const size = b.listVar("Size", ["M"]);
    const region = b.shortTextVar("Region", "north-america");
    const headline = b.shortTextVar("Headline");
    b.map("L1", headline, [
      b.group({ [size]: ["M"] }, [
        "Welcome to ",
        {
          ref: region,
          transform: [{ find: "-", replace: " ", replaceAll: true, regex: false }],
        },
      ]),
    ]);
    b.state({ Size: "M", Region: "north-america" }, "L1");

    const result = run(b.build());
    expect(setValues(result)).toEqual({ Headline: "Welcome to north america" });
  });
});
