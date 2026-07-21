import { describe, test, expect } from "bun:test";
import { buildActionScript } from "../harness/buildActionScript";

const matcherSrc = 'const data = "%DATA%";';

describe("buildActionScript", () => {
  test("empty action map", () => {
    expect(buildActionScript({}, matcherSrc)).toBe("\nconst data = {};");
  });

  test("single layout", () => {
    expect(buildActionScript({ Main: { Hero: "x.png" } }, matcherSrc)).toBe(
      'var _shared_0 = {"Hero":"x.png"};\nconst data = {"Main":_shared_0};',
    );
  });

  test("duplicate layouts share a declaration", () => {
    expect(
      buildActionScript(
        { First: { Hero: "x.png" }, Second: { Hero: "x.png" } },
        matcherSrc,
      ),
    ).toBe(
      'var _shared_0 = {"Hero":"x.png"};\nconst data = {"First":_shared_0,"Second":_shared_0};',
    );
  });

  test("distinct layouts get distinct declarations", () => {
    expect(
      buildActionScript(
        { First: { Hero: "one.png" }, Second: { Hero: "two.png" } },
        matcherSrc,
      ),
    ).toBe(
      'var _shared_0 = {"Hero":"one.png"};\nvar _shared_1 = {"Hero":"two.png"};\nconst data = {"First":_shared_0,"Second":_shared_1};',
    );
  });

  test("layout names preserve dollar characters", () => {
    expect(buildActionScript({ "Price$100": {} }, matcherSrc)).toContain(
      'const data = {"Price$100":_shared_0};',
    );
  });

  test("layout names preserve the $& pattern", () => {
    const output = buildActionScript({ "L$&test": {} }, matcherSrc);
    expect(output).toContain('const data = {"L$&test":_shared_0};');
    expect(output).not.toContain("%DATA%");
  });

  test("__proto__ is retained as a layout name", () => {
    const actionMap = Object.create(null) as Record<string, Record<string, any>>;
    actionMap.__proto__ = { Hero: "x.png" };

    expect(buildActionScript(actionMap, matcherSrc)).toContain(
      'const data = {"__proto__":_shared_0};',
    );
  });

  test("constructor works as a layout name", () => {
    expect(buildActionScript({ constructor: {} }, matcherSrc)).toContain(
      'const data = {"constructor":_shared_0};',
    );
  });

  test("variable values preserve dollar characters", () => {
    expect(buildActionScript({ Main: { Price: "$100", Token: "$&" } }, matcherSrc)).toBe(
      'var _shared_0 = {"Price":"$100","Token":"$&"};\nconst data = {"Main":_shared_0};',
    );
  });
});
