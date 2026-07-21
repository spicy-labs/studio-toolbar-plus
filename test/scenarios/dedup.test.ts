import { describe, test, expect } from "bun:test";
import { scenario } from "../harness/builder";
import { generateScript } from "../harness/run";

const sharedCount = (script: string) =>
  (script.match(/var _shared_\d+ =/g) ?? []).length;

/**
 * Dedup: identical per-layout variable maps collapse to a single `_shared_N`
 * variable in the emitted script. These tests pin the CURRENT dedup behavior,
 * including the insertion-order sensitivity that Phase 2 (canonicalization)
 * will fix.
 */
describe("shared-variable dedup", () => {
  test("two layouts, identical content → one shared var", () => {
    const b = scenario();
    const hero = b.imageVar("Hero");
    const size = b.listVar("Size", ["M"]);
    b.map("L1", hero, [b.group({ [size]: ["M"] }, "x.png")]);
    b.alsoAppliesTo("L1", "L2");

    expect(sharedCount(generateScript(b.build()))).toBe(1);
  });

  test("two layouts, different content → two shared vars", () => {
    const b = scenario();
    const hero = b.imageVar("Hero");
    const size = b.listVar("Size", ["M"]);
    b.map("L1", hero, [b.group({ [size]: ["M"] }, "one.png")]);
    b.map("L2", hero, [b.group({ [size]: ["M"] }, "two.png")]);

    expect(sharedCount(generateScript(b.build()))).toBe(2);
  });

  test("PRE-P2 characterization: identical content, different L1 key order does NOT dedup", () => {
    // Two layouts with the same two image variables but added in opposite order.
    // JSON.stringify key order differs -> the current dedup misses -> 2 shared.
    // Phase 2 (canonicalizeTopLevel) is expected to flip this to 1.
    const b = scenario();
    const a = b.imageVar("A");
    const z = b.imageVar("Z");
    const size = b.listVar("Size", ["M"]);
    const gA = () => b.group({ [size]: ["M"] }, "a.png");
    const gZ = () => b.group({ [size]: ["M"] }, "z.png");

    b.map("L1", a, [gA()]);
    b.map("L1", z, [gZ()]); // L1 order: A, Z
    b.map("L2", z, [gZ()]);
    b.map("L2", a, [gA()]); // L2 order: Z, A

    expect(sharedCount(generateScript(b.build()))).toBe(2);
  });
});
