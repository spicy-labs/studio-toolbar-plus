/**
 * Scenario DSL — constructs the exact input shapes the pipeline consumes
 * (`Doc` + `LayoutMap[]`) plus a runtime variable state, without hand-writing
 * ids and nesting. NO client data: every scenario is synthetic and readable.
 *
 * A scenario is: some variables (list / image / short-text / boolean), one or
 * more layouts, a mapping of (layout, imageVariable) -> dependent groups, and a
 * runtime state (current variable values + selected layout).
 */

import type {
  Doc,
  Variable,
  ListVariable,
  TextImageVariable,
  BooleanVariable,
} from "../../src/types/docStateTypes";
import type {
  LayoutMap,
  TargetVariable,
  DependentGroup,
  VariableValue,
  TextareaValueType,
  TransformCommands,
} from "../../src/types/layoutConfigTypes";

/**
 * A piece of a group's output value: a literal, a `${var}` reference, or a
 * user-authored textarea value (a `TextareaValueType`, which carries no
 * transforms — the producer emits its `value` verbatim).
 */
export type ValuePart =
  | string
  | { ref: string; transform?: TransformCommands[] }
  | { textarea: string };

export interface BuiltScenario {
  doc: Doc;
  layoutMaps: LayoutMap[];
  /** Initial runtime variable values, keyed by variable NAME. */
  state: Record<string, any>;
  selectedLayout: string;
}

let counter = 0;
const uid = (prefix: string) => `${prefix}-${++counter}`;

export class ScenarioBuilder {
  private variables: Variable[] = [];
  private layouts: { id: string; name: string }[] = [];
  private maps: LayoutMap[] = [];
  private stateOverrides: Record<string, any> = {};
  private selected = "";
  private idByName = new Map<string, string>();
  private typeByName = new Map<string, Variable["type"]>();

  // --- variable declarations (return the variable id) ---

  listVar(name: string, items: string[], value = ""): string {
    const id = uid("var");
    const v: ListVariable = {
      id,
      name,
      isVisiblie: true,
      type: "list",
      value,
      items: items.map((value) => ({ value })),
    };
    this.register(v);
    return id;
  }

  imageVar(name: string, value = ""): string {
    return this.textLike(name, "image", value);
  }

  shortTextVar(name: string, value = ""): string {
    return this.textLike(name, "shortText", value);
  }

  boolVar(name: string, value = false): string {
    const id = uid("var");
    const v: BooleanVariable = { id, name, isVisiblie: true, type: "boolean", value };
    this.register(v);
    return id;
  }

  private textLike(
    name: string,
    type: "image" | "shortText" | "longText",
    value: string,
  ): string {
    const id = uid("var");
    const v: TextImageVariable = { id, name, isVisiblie: true, type, value };
    this.register(v);
    return id;
  }

  private register(v: Variable) {
    this.variables.push(v);
    this.idByName.set(v.name, v.id);
    this.typeByName.set(v.name, v.type);
  }

  /** Declare a layout (id auto-created). Idempotent by name. */
  layout(name: string): string {
    const existing = this.layouts.find((l) => l.name === name);
    if (existing) return existing.id;
    const id = uid("layout");
    this.layouts.push({ id, name });
    return id;
  }

  // --- group construction ---

  /**
   * A dependent group. `deps` maps a dependent variable id -> its allowed
   * values; insertion order is significant (it fixes the `deps`/`dependentKey`
   * slot order). `value` is the emitted output (literal(s) and/or `${ref}`).
   */
  group(deps: Record<string, string[]>, value: ValuePart | ValuePart[]): DependentGroup {
    return {
      dependents: Object.entries(deps).map(([variableId, values]) => ({
        variableId,
        values,
      })),
      variableValue: this.toVariableValue(value),
    };
  }

  /** An always-run group (no dependents). */
  alwaysRun(value: ValuePart | ValuePart[]): DependentGroup {
    return {
      alwaysRun: true,
      dependents: [],
      variableValue: this.toVariableValue(value),
    };
  }

  /** A group that references a dependent by a deliberately-unknown id (degraded). */
  deletedRef(id = "DELETED-VARIABLE-ID"): string {
    return id;
  }

  private toVariableValue(value: ValuePart | ValuePart[]) {
    const parts = Array.isArray(value) ? value : [value];
    return parts.map((p) => {
      if (typeof p === "string") return p;
      if ("textarea" in p) {
        const tv: TextareaValueType = { type: "TextareaValue", value: p.textarea };
        return tv;
      }
      const vv: VariableValue = {
        id: p.ref,
        type: "StudioText",
        transform: p.transform ?? [],
      };
      return vv;
    });
  }

  // --- mapping (layout, imageVar) -> groups ---

  map(layoutName: string, imageVarId: string, groups: DependentGroup[]): this {
    this.layout(layoutName);
    const layoutId = this.layouts.find((l) => l.name === layoutName)!.id;

    let lm = this.maps.find((m) => m.layoutIds.includes(layoutId));
    if (!lm) {
      lm = { id: uid("map"), name: layoutName, layoutIds: [layoutId], variables: [] };
      this.maps.push(lm);
    }

    let tv = lm.variables.find((v) => v.id === imageVarId);
    if (!tv) {
      tv = { id: imageVarId, type: "StudioImage", dependentGroup: [] };
      lm.variables.push(tv);
    }
    tv.dependentGroup.push(...groups);
    return this;
  }

  /**
   * Force a SEPARATE LayoutMap that also targets `layoutName`, even when one
   * already does. `map()` folds every target for a layout into a single
   * LayoutMap, so it cannot express the case where two independent maps point at
   * the same layout — the producer merges those with `Object.assign`
   * (layoutMappingToActionMap.ts), where a later map CLOBBERS an earlier map's
   * entry for the same image variable and UNIONS distinct ones. This primitive
   * makes that authorable (a real user can multi-select overlapping layouts
   * across two mappings).
   */
  newMap(layoutName: string, imageVarId: string, groups: DependentGroup[]): this {
    const layoutId = this.layout(layoutName);
    const lm: LayoutMap = {
      id: uid("map"),
      name: layoutName,
      layoutIds: [layoutId],
      variables: [
        { id: imageVarId, type: "StudioImage", dependentGroup: [...groups] },
      ],
    };
    this.maps.push(lm);
    return this;
  }

  /** Point an existing layoutMap at an additional layout id (dedup/merge tests). */
  alsoAppliesTo(existingLayout: string, newLayout: string): this {
    const srcId = this.layout(existingLayout);
    const dstId = this.layout(newLayout);
    const lm = this.maps.find((m) => m.layoutIds.includes(srcId));
    if (lm && !lm.layoutIds.includes(dstId)) lm.layoutIds.push(dstId);
    return this;
  }

  // --- runtime state ---

  state(values: Record<string, any>, selectedLayout: string): this {
    this.stateOverrides = { ...this.stateOverrides, ...values };
    this.selected = selectedLayout;
    return this;
  }

  build(): BuiltScenario {
    // Every declared variable starts at its default value; overrides win.
    const state: Record<string, any> = {};
    for (const v of this.variables) state[v.name] = v.value;
    Object.assign(state, this.stateOverrides);

    return {
      doc: { layouts: this.layouts, variables: this.variables },
      layoutMaps: this.maps,
      state,
      selectedLayout: this.selected,
    };
  }
}

export function scenario(): ScenarioBuilder {
  return new ScenarioBuilder();
}
