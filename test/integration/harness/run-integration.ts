import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { imageSelectionScript } from "../../../src/studio/actions/imageSelection.js";
import { buildActionScript } from "../../../src/studio/buildActionScript";
import { layoutMappingToActionMap } from "../../../src/studio/layoutMappingToActionMap";
import type { BuiltScenario } from "../../harness/builder";
import { EditorPage } from "./editor-page";

export interface IntegrationResult {
  values: Record<string, string>;
}

const baseTemplate = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, "../fixtures/base-template.json"),
    "utf-8",
  ),
);

// Load the template at its NATIVE version (engine 2.28 / model 0.25). The
// engine served by editor.html is pinned to match (?engine / editorLink). Do
// NOT fake the version fields down: an older engine tolerates the newer doc's
// GUID layout ids for read ops (rename/select) but its `addLayout` rejects them
// (FormatException), which breaks building layouts for fixtures with many
// layouts. Keep template and engine on the same version instead.
export const BASE_TEMPLATE = JSON.stringify(baseTemplate);

function generateScript(sc: BuiltScenario): string {
  const actionMap = layoutMappingToActionMap(sc.layoutMaps, sc.doc);
  return (
    buildActionScript(actionMap, imageSelectionScript.toString()) +
    "\nimageSelectionScript(false);"
  );
}

export interface PreparedScenario {
  /** Names of the variables the mapping can set (read-back targets). */
  targetNames: string[];
  /**
   * Apply one state and fire the action, returning the read-back of every
   * target. Cheap to call repeatedly — the document, variables, layouts, and
   * action are already in place, so this only sets variables and re-selects.
   */
  runState: (
    state: Record<string, unknown>,
    selectedLayout: string,
  ) => Promise<Record<string, unknown>>;
}

/**
 * Build a scenario's full engine state ONCE — load the template, create every
 * variable, materialize every layout, and deploy the action. Returns a
 * `runState` closure to drive many states without repeating this setup. This is
 * what lets the fixture suite exercise every mapping path (every layout gets
 * selected across the states) without a document reload per state.
 */
export async function prepareScenario(
  editor: EditorPage,
  doc: BuiltScenario["doc"],
  layoutMaps: BuiltScenario["layoutMaps"],
): Promise<PreparedScenario> {
  await editor.loadTemplate(BASE_TEMPLATE);
  await editor.disableActions();

  for (const variable of doc.variables) {
    // "number" isn't in the Doc type union but appears in real fixtures.
    if ((variable.type as string) === "number") {
      const v = variable as unknown as { name: string; value: unknown };
      await editor.createNumberVariable(v.name, v.value);
      continue;
    }
    switch (variable.type) {
      case "list":
        await editor.createListVariable(
          variable.name,
          variable.items.map((item) => item.value),
          variable.value,
        );
        break;
      case "shortText":
      case "longText":
        await editor.createShortTextVariable(variable.name, variable.value);
        break;
      case "image":
        await editor.createImageVariable(variable.name);
        break;
      case "boolean":
        await editor.createBooleanVariable(variable.name, variable.value);
        break;
    }
  }

  const numberVarNames = new Set(
    doc.variables
      .filter((v) => (v.type as string) === "number")
      .map((v) => v.name),
  );

  // Materialize every layout by name (the action resolves layouts by name, so
  // the tree structure is irrelevant — flat children under "A4" suffice).
  const templateChildLayouts = ["A4-A", "A4-B"];
  for (const [index, layout] of doc.layouts.entries()) {
    const templateLayout = templateChildLayouts[index];
    if (templateLayout) {
      await editor.renameLayout(templateLayout, layout.name);
    } else {
      await editor.createChildLayout("A4", layout.name);
    }
  }

  await editor.deployAction(generateScript({ doc, layoutMaps, state: {}, selectedLayout: "" }), [
    { event: "selectedLayoutChanged" },
  ]);
  await editor.enableActions();

  const targetNames = [
    ...new Set(
      doc.variables
        .filter((variable) =>
          layoutMaps.some((lm) => lm.variables.some((tv) => tv.id === variable.id)),
        )
        .map((variable) => variable.name),
    ),
  ];

  const layoutNames = (await editor.getLayouts()).map((l) => l.name);

  const runState = async (
    state: Record<string, unknown>,
    selectedLayout: string,
  ): Promise<Record<string, unknown>> => {
    // Setting the full state resets every input for this run; the only trigger
    // is selectedLayoutChanged, so these writes don't fire the action.
    for (const [name, value] of Object.entries(state)) {
      if (numberVarNames.has(name)) {
        // The engine rejects non-numeric strings for number vars; coerce
        // (e.g. "" -> 0, "5" -> 5). Non-coercible values are filtered upstream.
        await editor.setVariableValue(name, Number(value));
      } else {
        await editor.setVariableValue(name, value as string);
      }
    }

    // Park on another layout first so re-selecting the same layout across
    // consecutive states still fires selectedLayoutChanged.
    const parking = layoutNames.find(
      (name) => name !== selectedLayout && name !== "A4",
    );
    if (parking) await editor.selectLayout(parking);
    await editor.selectLayout(selectedLayout);

    const values: Record<string, unknown> = {};
    for (const name of targetNames) {
      values[name] = await editor.getVariableValue(name);
    }
    return values;
  };

  return { targetNames, runState };
}

/** Single-state convenience wrapper (used by the synthetic scenario suites). */
export async function runIntegration(
  editor: EditorPage,
  sc: BuiltScenario,
): Promise<IntegrationResult> {
  const prepared = await prepareScenario(editor, sc.doc, sc.layoutMaps);
  const values = await prepared.runState(sc.state, sc.selectedLayout);
  return { values: values as Record<string, string> };
}
