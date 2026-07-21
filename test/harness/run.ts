/**
 * Ties the current branch's pipeline together end-to-end for a scenario:
 *   config (layoutMaps + doc)  --producer-->  actionMap
 *   actionMap + matcher source --assemble-->  script string
 *   script + runtime state     --engine---->  setVariableValue calls
 *
 * This is the "current version" wiring. When the differential suite lands, a
 * `versions` registry will expose the same shape for `main` and `planned`.
 */

import { layoutMappingToActionMap } from "../../src/studio/layoutMappingToActionMap";
import { layoutMappingValidation } from "../../src/studio-adapter/layoutMapingValidation";
import { imageSelectionScript } from "../../src/studio/actions/imageSelection.js";
import { buildActionScript } from "./buildActionScript";
import { imageValue, runScript, type RunResult } from "./engine";
import type { BuiltScenario } from "./builder";

/** Re-exported so scenario tests can express expected image read-back shapes. */
export { imageValue } from "./engine";

/** Names of the scenario's image-typed variables (engine wraps their values). */
function imageVariableNames(sc: BuiltScenario): Set<string> {
  return new Set(
    sc.doc.variables.filter((v) => v.type === "image").map((v) => v.name),
  );
}

/** Produce the exact action script the toolbar would deploy for this config. */
export function generateScript(sc: BuiltScenario): string {
  const actionMap = layoutMappingToActionMap(sc.layoutMaps, sc.doc);
  return buildActionScript(actionMap, imageSelectionScript.toString());
}

/** Run a scenario through the full current pipeline. */
export function run(sc: BuiltScenario): RunResult {
  return runScript(
    generateScript(sc),
    sc.state,
    sc.selectedLayout,
    imageVariableNames(sc),
  );
}

/** Run a scenario through validation first, then the full pipeline. */
export function validateAndRun(sc: BuiltScenario): RunResult {
  const validatedMaps = sc.layoutMaps.map(
    (lm) => layoutMappingValidation(lm, sc.doc).cleanLayoutMap,
  );
  const actionMap = layoutMappingToActionMap(validatedMaps, sc.doc);
  const script = buildActionScript(actionMap, imageSelectionScript.toString());
  return runScript(script, sc.state, sc.selectedLayout, imageVariableNames(sc));
}

/** The actionMap only (for asserting emitted shape / dedup, no runtime). */
export function actionMapOf(sc: BuiltScenario): Record<string, Record<string, any>> {
  return layoutMappingToActionMap(sc.layoutMaps, sc.doc);
}

/**
 * Collapse the setValue calls to a `{ name: storedValue }` map for the common
 * case where each variable is set at most once. Values come from `.state`, so
 * image variables read back in their wrapped engine shape (see `imageValue`).
 * Throws if a variable is set twice (that's a real signal — assert on `.calls`
 * directly for those, which keep the raw string argument).
 */
export function setValues(result: RunResult): Record<string, any> {
  const seen = new Set<string>();
  const out: Record<string, any> = {};
  for (const [name] of result.calls) {
    if (seen.has(name)) {
      throw new Error(
        `Variable "${name}" was set more than once; assert on result.calls instead.`,
      );
    }
    seen.add(name);
    out[name] = result.state[name];
  }
  return out;
}
