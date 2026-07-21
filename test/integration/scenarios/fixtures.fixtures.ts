/**
 * DIFFERENTIAL fixture suite (opt-in — `bun run test:integration:full`).
 *
 * Runs the real production documents in test/fixtures/ through BOTH harnesses
 * and asserts they agree: the Bun mock (`run` + `setValues`) vs the real engine
 * (`prepareScenario` + `runState`). Any mismatch is a harness-fidelity finding
 * on a real doc shape — the gap the synthetic runtime-fidelity suite can't cover.
 *
 * Coverage: EVERY engine-reachable state of each fixture — one per
 * (layout, target, group). Across those states every mapped layout is selected,
 * so all mapping paths are exercised on the real engine. The scenario is built
 * on the engine ONCE per fixture (`prepareScenario`); each state then only
 * writes the variables that changed and re-selects, so there is no per-state
 * document reload.
 *
 * This file is `.fixtures.ts`, so the default `integration` project skips it; it
 * runs only under the `fixtures` project. Expect it to take many minutes.
 *
 * Env knobs: FIXTURE_LIMIT caps the number of fixtures; STATES_PER_FIXTURE caps
 * states per fixture (default: all reachable).
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { enumerateStates, type Fixture } from "../../harness/fixture";
import { run, setValues } from "../../harness/run";
import type { BuiltScenario } from "../../harness/builder";
import { EditorPage } from "../harness/editor-page";
import { prepareScenario } from "../harness/run-integration";

const FIXTURES_DIR = join(import.meta.dirname, "../../fixtures");
const STATES_PER_FIXTURE = Number(process.env.STATES_PER_FIXTURE ?? Infinity);
const FIXTURE_LIMIT = Number(process.env.FIXTURE_LIMIT ?? Infinity);
// Restart the engine session every N prepared fixtures. One long-lived page
// accumulates state across thousands of variable/layout creates and slowly
// degrades (read-back settle misses late in the run); recycling bounds that.
const RECYCLE_EVERY = Number(process.env.RECYCLE_EVERY ?? 20);

const fixtureFiles = readdirSync(FIXTURES_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .slice(0, FIXTURE_LIMIT);

/** Node-friendly fixture load (loadFixture uses Bun's require(json)). */
function readFixture(path: string): Fixture {
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  return { doc: raw.doc, layoutMaps: raw.layoutMaps };
}

/** Keep only the keys present in `ref` — the mock reports set targets only. */
function pick(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = obj[k];
  return out;
}

/** Variables whose value changed between two states (what to re-set). */
function changedEntries(
  next: Record<string, unknown>,
  prev: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(next)) {
    if (prev[k] !== v) out[k] = v;
  }
  return out;
}

const BOOLEAN_LITERALS = new Set(["true", "false", "1", "0"]);

/**
 * A state is only reachable on the real engine if every typed value it sets is
 * one the engine accepts — the mock accepts anything, but the engine enforces:
 *   - list vars: the value must be one of the declared items (an empty-items
 *     list can hold nothing, not even "").
 *   - boolean vars: only "true"/"false"/"1"/"0".
 * `enumerateStates` can derive states that violate these — from degraded groups
 * (a value the dependent can no longer hold) or from anonymization rewriting a
 * boolean's group values to generic `val_N` tokens. Those states are dead
 * branches in production, so they're skipped rather than flagged as fidelity
 * divergences.
 */
function isEngineReachable(
  state: Record<string, unknown>,
  listItems: Map<string, Set<string>>,
  booleanVars: Set<string>,
  numberVars: Set<string>,
): boolean {
  for (const [name, value] of Object.entries(state)) {
    const items = listItems.get(name);
    if (items && !items.has(value as string)) return false;
    if (booleanVars.has(name) && !BOOLEAN_LITERALS.has(String(value))) return false;
    // Number vars must be coercible to a finite number ("" -> 0 is fine; an
    // anonymized "val_N" token is not).
    if (numberVars.has(name) && !Number.isFinite(Number(value))) return false;
  }
  return true;
}

/** Variable types prepareScenario knows how to create on the engine. */
const SUPPORTED_TYPES = new Set([
  "list",
  "shortText",
  "longText",
  "image",
  "boolean",
  "number",
]);

let page: Page;
let editor: EditorPage;
let sinceRecycle = 0;

async function openEnginePage(browser: import("@playwright/test").Browser) {
  page = await browser.newPage();
  await page.goto("/");
  editor = new EditorPage(page);
  await editor.waitForEngine();
}

test.beforeAll(async ({ browser }) => {
  await openEnginePage(browser);
});

test.afterAll(async () => {
  await page?.close();
});

for (const file of fixtureFiles) {
  test(file.replace(/\.json$/, ""), async ({ browser }) => {
    const fx = readFixture(join(FIXTURES_DIR, file));

    const unsupported = [
      ...new Set(
        fx.doc.variables
          .map((v) => v.type)
          .filter((t) => !SUPPORTED_TYPES.has(t)),
      ),
    ];
    test.skip(
      unsupported.length > 0,
      `unsupported variable type(s): ${unsupported.join(", ")}`,
    );

    const listItems = new Map<string, Set<string>>();
    const booleanVars = new Set<string>();
    const numberVars = new Set<string>();
    for (const v of fx.doc.variables) {
      if (v.type === "list") {
        const items = ((v as any).items ?? []) as Array<{ value: string }>;
        listItems.set(v.name, new Set(items.map((i) => i.value)));
      } else if (v.type === "boolean") {
        booleanVars.add(v.name);
      } else if ((v.type as string) === "number") {
        numberVars.add(v.name);
      }
    }

    const states = enumerateStates(fx)
      .filter((c) => isEngineReachable(c.state, listItems, booleanVars, numberVars))
      .slice(0, STATES_PER_FIXTURE);
    test.skip(states.length === 0, "no engine-reachable states");

    // Recycle the engine session periodically (skipped fixtures don't count,
    // since this runs only after the skip guards above).
    if (sinceRecycle >= RECYCLE_EVERY) {
      await page.close();
      await openEnginePage(browser);
      sinceRecycle = 0;
    }
    sinceRecycle++;

    // Build the whole document on the engine once, then drive every state.
    const prepared = await prepareScenario(editor, fx.doc, fx.layoutMaps);

    let applied: Record<string, unknown> = {};
    for (const c of states) {
      const sc: BuiltScenario = {
        doc: fx.doc,
        layoutMaps: fx.layoutMaps,
        state: c.state,
        selectedLayout: c.selectedLayout,
      };

      const mock = setValues(run(sc));
      // Only write the variables that changed since the previous state.
      const engine = await prepared.runState(
        changedEntries(c.state, applied),
        c.selectedLayout,
      );
      applied = c.state;

      // Everything the mock set, the engine must have set to the same value.
      expect(pick(engine, Object.keys(mock)), `${file} :: ${c.label}`).toEqual(mock);
    }
  });
}
