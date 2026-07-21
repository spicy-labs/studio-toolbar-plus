/**
 * Loads an anonymized `{ doc, layoutMaps }` fixture (produced by
 * scripts/anonymize-template.ts) and drives it through the current pipeline.
 *
 * No runtime state is stored in the fixture — the sweep DERIVES states from the
 * groups themselves: for every (layout, imageVariable, group) it constructs one
 * deterministic "should-select-this-group" state. That guarantees every group is
 * exercised at least once, stays bounded (one state per group, not the full
 * cartesian blow-up), and is stable enough to snapshot.
 */

import type { Doc } from "../../src/types/docStateTypes";
import type { LayoutMap } from "../../src/types/layoutConfigTypes";
import type { BuiltScenario } from "./builder";
import { run } from "./run";

export interface Fixture {
  doc: Doc;
  layoutMaps: LayoutMap[];
}

export function loadFixture(path: string): Fixture {
  // Bun can import JSON synchronously via require.
  const raw = require(path) as any;
  return { doc: raw.doc, layoutMaps: raw.layoutMaps };
}

interface SweepCase {
  label: string;
  selectedLayout: string;
  state: Record<string, any>;
}

/** Derive one targeted state per (layout, variable, group). */
export function enumerateStates(fx: Fixture): SweepCase[] {
  const { doc, layoutMaps } = fx;
  const varById = new Map(doc.variables.map((v) => [v.id, v]));
  const layoutById = new Map(doc.layouts.map((l) => [l.id, l]));

  // Baseline value per variable NAME: first list item, else "".
  const baseState: Record<string, any> = {};
  for (const v of doc.variables) {
    baseState[v.name] =
      v.type === "list" && (v as any).items?.length ? (v as any).items[0].value : v.value ?? "";
  }

  const cases: SweepCase[] = [];
  for (const lm of layoutMaps) {
    const layoutName = lm.layoutIds.map((id) => layoutById.get(id)?.name).find(Boolean);
    if (!layoutName) continue;

    for (const tv of lm.variables) {
      const targetName = varById.get(tv.id)?.name ?? tv.id;
      tv.dependentGroup.forEach((g, gi) => {
        const state = { ...baseState };
        if (!g.alwaysRun) {
          for (const dep of g.dependents) {
            const depVar = varById.get(dep.variableId);
            if (depVar && dep.values.length) state[depVar.name] = dep.values[0];
          }
        }
        cases.push({
          label: `${layoutName} :: ${targetName} :: group[${gi}]${g.alwaysRun ? " (always)" : ""}`,
          selectedLayout: layoutName,
          state,
        });
      });
    }
  }
  return cases;
}

/** Run every derived state; return an ordered { label -> setValue calls } map. */
export function sweep(fx: Fixture): Record<string, [string, any][]> {
  const out: Record<string, [string, any][]> = {};
  for (const c of enumerateStates(fx)) {
    const built: BuiltScenario = {
      doc: fx.doc,
      layoutMaps: fx.layoutMaps,
      state: c.state,
      selectedLayout: c.selectedLayout,
    };
    out[c.label] = run(built).calls;
  }
  return out;
}
