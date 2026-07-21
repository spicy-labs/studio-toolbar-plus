import { describe, test, expect } from "bun:test";
import { scenario } from "../harness/builder";
import { actionMapOf, run, setValues, imageValue } from "../harness/run";

/**
 * Empty transform array guards. Two independent guards exist:
 * 1. Build-time: getTransforms requires length > 0, so transform: [] → no key.
 * 2. Runtime: currentTransforms.length === 0 → returns raw value.
 *
 * These tests exercise each guard so a regression in either is caught.
 */
describe("empty transform array guards", () => {
  test("build-time: transform: [] does not produce a transforms key", () => {
    const b = scenario();
    const size = b.listVar("Size", ["M"]);
    const caption = b.shortTextVar("Caption", "hello");
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [
      b.group({ [size]: ["M"] }, {
        ref: caption,
        transform: [], // explicitly empty
      }),
    ]);
    b.state({ Size: "M", Caption: "hello" }, "L1");

    const map = actionMapOf(b.build());
    const entry = map["L1"]["Hero"]["Size"][0];
    expect(entry.transforms).toBeUndefined();
    expect(entry.value).toBe("${Caption}");
  });

  test("runtime: empty transforms array still returns raw value", () => {
    const b = scenario();
    const size = b.listVar("Size", ["M"]);
    const caption = b.shortTextVar("Caption", "hello");
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [
      b.group({ [size]: ["M"] }, {
        ref: caption,
        transform: [],
      }),
    ]);
    b.state({ Size: "M", Caption: "hello" }, "L1");

    const result = run(b.build());
    expect(setValues(result)).toEqual({ Hero: imageValue("hello") });
  });
});
