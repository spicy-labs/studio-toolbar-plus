import { describe, test, expect } from "bun:test";
import { scenario } from "../harness/builder";
import { run, setValues, imageValue } from "../harness/run";
import type { TransformCommands } from "../../src/types/layoutConfigTypes";

const tf = (
  find: string,
  replace: string,
  replaceAll = false,
  regex = false,
): TransformCommands => ({ find, replace, replaceAll, regex });

/**
 * The value side of degradation and composition — the untested twin of the
 * (well-covered) dependent-side degradation. These characterize what a matched
 * group emits when its value is empty, references a deleted variable, references
 * the same variable twice, or contains raw `${...}` / an inert `regex` flag.
 * Several of these fail SILENTLY (wrong or blanked image, never an error).
 */
describe("malformed / edge value composition", () => {
  test("empty value group blanks the image variable on match (UI default value: [])", () => {
    // Every new group is born with `variableValue: []`. A matched empty group
    // sets the image variable to "" — it does not skip.
    const b = scenario();
    const size = b.listVar("Size", ["M"]);
    const hero = b.imageVar("Hero", "existing.png");
    b.map("L1", hero, [b.group({ [size]: ["M"] }, [])]);

    const r = run(b.state({ Size: "M", Hero: "existing.png" }, "L1").build());
    expect(r.calls).toEqual([["Hero", ""]]);
  });

  test("deleted ${ref} value-variable contributes an empty string", () => {
    // Producer's getValueString returns "" for an unresolved ref id, so the
    // surrounding literals still emit: banner_${GONE}.png -> banner_.png.
    const b = scenario();
    const size = b.listVar("Size", ["M"]);
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [
      b.group({ [size]: ["M"] }, ["banner_", { ref: "DELETED-VAR-ID" }, ".png"]),
    ]);

    expect(setValues(run(b.state({ Size: "M" }, "L1").build()))).toEqual({
      Hero: imageValue("banner_.png"),
    });
  });

  test("same variable referenced twice: transforms keyed by NAME → last ref's transform wins for BOTH occurrences", () => {
    // getTransforms keys by variable name, so the second ref's transform
    // overwrites the first's; at runtime that single transform is applied to
    // every `${Caption}` occurrence.
    const b = scenario();
    const size = b.listVar("Size", ["M"]);
    const caption = b.shortTextVar("Caption", "a-b");
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [
      b.group({ [size]: ["M"] }, [
        { ref: caption, transform: [tf("a", "X", true)] },
        { ref: caption, transform: [tf("b", "Y", true)] },
      ]),
    ]);

    // value string is "${Caption}${Caption}", surviving transform is b->Y,
    // applied to both: "a-Y" + "a-Y".
    expect(setValues(run(b.state({ Size: "M", Caption: "a-b" }, "L1").build()))).toEqual({
      Hero: imageValue("a-Ya-Y"),
    });
  });

  test("raw ${...} inside a literal string is substituted at runtime (undocumented pass-through)", () => {
    const b = scenario();
    const size = b.listVar("Size", ["M", "L"]);
    const hero = b.imageVar("Hero");
    // A hand-typed literal, NOT a ref part.
    b.map("L1", hero, [b.group({ [size]: ["M"] }, ["hero_${Size}.png"])]);

    expect(setValues(run(b.state({ Size: "M" }, "L1").build()))).toEqual({
      Hero: imageValue("hero_M.png"),
    });
  });

  test("raw ${Unknown} literal resolves to the string 'undefined'", () => {
    const b = scenario();
    const size = b.listVar("Size", ["M"]);
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [b.group({ [size]: ["M"] }, ["x_${Ghost}"])]);

    expect(setValues(run(b.state({ Size: "M" }, "L1").build()))).toEqual({
      Hero: imageValue("x_undefined"),
    });
  });

  test("regex:true on a transform is IGNORED — runtime does literal string replace", () => {
    // find="." with regex honored would match every char; literal replaceAll
    // only replaces the dots.
    const b = scenario();
    const size = b.listVar("Size", ["M"]);
    const caption = b.shortTextVar("Caption", "a.b.c");
    const hero = b.imageVar("Hero");
    b.map("L1", hero, [
      b.group({ [size]: ["M"] }, [
        { ref: caption, transform: [tf(".", "X", true, /* regex */ true)] },
      ]),
    ]);

    expect(setValues(run(b.state({ Size: "M", Caption: "a.b.c" }, "L1").build()))).toEqual({
      Hero: imageValue("aXbXc"),
    });
  });
});
