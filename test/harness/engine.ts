/**
 * A minimal, faithful stand-in for the CHILI engine's JS host, enough to run a
 * generated image-selection action script and observe what it does.
 *
 * The generated script is self-contained plain ES that the engine executes with
 * a set of globals defined in the engine's `action_helper_functions.js`
 * (studio-engine repo). This harness supplies the exact subset the image
 * selection script touches:
 *   - `studio.variables.all()`            → list of `{ name }`
 *   - `getVariableValue(name)`            → `studio.variables.getValue(name)`
 *   - `setVariableValue(name, value)`     → `studio.variables.setValue(...)`  ← the observable
 *   - `getSelectedLayoutName()`           → `studio.layouts.getSelected().name`
 *
 * Fidelity notes: the script is plain ES, so Bun reproduces its JS semantics
 * (including the unguarded-`.reduce` throw path) exactly as qjs would.
 *
 * Write semantics: the real engine defers setVariableValue writes until the
 * action script completes — getVariableValue reads from a snapshot of the
 * pre-action state, not from values set during the current run. This harness
 * mirrors that by reading from a frozen snapshot and applying writes only after
 * the script returns. Confirmed via Playwright integration tests against the
 * real engine (test/integration/scenarios/cross-target-ref.integration.ts).
 *
 * Per-type value semantics: the engine wraps a value written to an IMAGE
 * variable into a `ConnectorImageVariableSource` object on storage — a bare
 * string `"hero.png"` is read back as `{ connectorId: "", assetId: "hero.png",
 * context: {} }`. This harness mirrors that: `.calls` keeps the raw string the
 * script actually passed, while the stored `.state` (the read-back) holds the
 * wrapped shape for image variables. Confirmed against the real engine — see
 * test/integration/scenarios/image-write.gate.ts. All other types are stored
 * as-is and stringified via the script's own `` `${...}` `` coercion.
 */

export type SetCall = [name: string, value: any];

/** The engine's stored shape for an image variable value (see gate test). */
export interface ImageVariableValue {
  connectorId: string;
  assetId: string;
  context: Record<string, never>;
}

/** Wrap a bare value the way the engine wraps writes to an image variable. */
export function imageValue(assetId: any): ImageVariableValue {
  return { connectorId: "", assetId: String(assetId), context: {} };
}

export interface RunResult {
  /** Ordered `setVariableValue` calls — the observable behavior. */
  calls: SetCall[];
  /** Variable state after the run (initial state mutated by set calls). */
  state: Record<string, any>;
  /** `debugData` returned by the script when run with debug=true. */
  debugData: Record<string, any>;
  /** `errorCollection` messages the script accumulated. */
  errors: string[];
}

export function runScript(
  script: string,
  initialState: Record<string, any>,
  selectedLayout: string,
  imageVariableNames: Set<string> = new Set(),
): RunResult {
  const state: Record<string, any> = { ...initialState };
  const snapshot: Record<string, any> = { ...initialState };
  const calls: SetCall[] = [];

  const studio = {
    variables: {
      all: () => Object.keys(state).map((name) => ({ name })),
      getValue: (name: string) => snapshot[name],
      setValue: (name: string, value: any) => {
        // `.calls` records the raw argument the script passed; `.state` holds
        // the read-back, which the engine wraps for image variables.
        calls.push([name, value]);
        state[name] = imageVariableNames.has(name) ? imageValue(value) : value;
      },
    },
    layouts: {
      getSelected: () => ({ name: selectedLayout }),
    },
  };

  const getVariableValue = (name: string) => studio.variables.getValue(name);
  const setVariableValue = (name: string, value: any) =>
    studio.variables.setValue(name, value);
  const getSelectedLayoutName = () => studio.layouts.getSelected().name;

  // Silence the script's trailing/debug console noise but keep it callable.
  const quietConsole = { log: () => {}, error: () => {}, warn: () => {} };

  // The script defines `imageSelectionScript(debug)` and (in production) trails
  // with `console.log(imageSelectionScript(false))`. buildActionScript strips
  // that trailing call, so we invoke it ourselves with debug=true to capture
  // debugData + errorCollection in one run.
  const fn = new Function(
    "studio",
    "getVariableValue",
    "setVariableValue",
    "getSelectedLayoutName",
    "console",
    `${script}\nreturn imageSelectionScript(true);`,
  );

  const result = fn(
    studio,
    getVariableValue,
    setVariableValue,
    getSelectedLayoutName,
    quietConsole,
  ) as { debugData: Record<string, any>; errorCollection: Error[] };

  return {
    calls,
    state,
    debugData: result?.debugData ?? {},
    errors: (result?.errorCollection ?? []).map((e) => e?.message ?? String(e)),
  };
}
