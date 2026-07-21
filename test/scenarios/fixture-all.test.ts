import { describe, test, expect } from "bun:test";
import { join } from "path";
import { readdirSync } from "fs";
import { loadFixture, sweep } from "../harness/fixture";
import { generateScript } from "../harness/run";

const FIXTURES_DIR = join(import.meta.dir, "../fixtures");

const fixtureFiles = readdirSync(FIXTURES_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort();

describe("all fixtures", () => {
  for (const file of fixtureFiles) {
    describe(file.replace(/\.json$/, ""), () => {
      const fx = loadFixture(join(FIXTURES_DIR, file));

      test("pipeline produces a script without errors", () => {
        const script = generateScript({
          doc: fx.doc,
          layoutMaps: fx.layoutMaps,
          state: {},
          selectedLayout: "",
        });
        expect(typeof script).toBe("string");
        expect(script.length).toBeGreaterThan(0);
      });

      test("full behavior snapshot is stable", () => {
        expect(sweep(fx)).toMatchSnapshot();
      });
    });
  }
});
