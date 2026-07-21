/**
 * Shared runtime scenario cases — the single source of truth for behaviors that
 * both harnesses must agree on:
 *
 *   - the Bun mock  (test/scenarios/*.test.ts, via `run` + `setValues`)
 *   - the real engine (test/integration/scenarios/runtime-fidelity.integration.ts,
 *     via `runIntegration`)
 *
 * Each case builds a fresh scenario and states the expected target read-back.
 * Every target is an image variable, so expected values use `imageValue(...)`
 * (the engine's wrapped storage shape — see image-write.gate.ts).
 *
 * Only positive-match, read-back-observable behaviors live here — those are the
 * ones portable to the read-back-only integration harness. No-match /
 * error-collection / build-time assertions stay in their dedicated Bun files.
 */

import { scenario } from "../builder";
import { imageValue } from "../engine";
import type { BuiltScenario } from "../builder";
import type { TransformCommands } from "../../../src/types/layoutConfigTypes";

const tf = (
  find: string,
  replace: string,
  replaceAll = false,
): TransformCommands => ({ find, replace, replaceAll, regex: false });

export interface RuntimeCase {
  /** Topic group — mirrors the original Bun test file / describe block. */
  group: string;
  /** Test title. */
  name: string;
  /** Builds a fresh scenario (fresh variable ids each call). */
  build: () => BuiltScenario;
  /** Expected `{ targetName: storedValue }` after the action runs. */
  expected: Record<string, unknown>;
}

export const RUNTIME_CASES: RuntimeCase[] = [
  // --- value substitution and transforms ------------------------------------
  {
    group: "transforms",
    name: "`${ref}` substitutes the referenced variable's current value",
    build: () => {
      const b = scenario();
      const size = b.listVar("Size", ["S", "M"]);
      const caption = b.shortTextVar("Caption", "hello world");
      const hero = b.imageVar("Hero");
      b.map("L1", hero, [b.group({ [size]: ["M"] }, [{ ref: caption }])]);
      return b.state({ Size: "M", Caption: "hello world" }, "L1").build();
    },
    expected: { Hero: imageValue("hello world") },
  },
  {
    group: "transforms",
    name: "transform: first-occurrence replace",
    build: () => {
      const b = scenario();
      const size = b.listVar("Size", ["M"]);
      const caption = b.shortTextVar("Caption", "a-a-a");
      const hero = b.imageVar("Hero");
      b.map("L1", hero, [
        b.group({ [size]: ["M"] }, [{ ref: caption, transform: [tf("a", "X")] }]),
      ]);
      return b.state({ Size: "M", Caption: "a-a-a" }, "L1").build();
    },
    expected: { Hero: imageValue("X-a-a") },
  },
  {
    group: "transforms",
    name: "transform: replaceAll",
    build: () => {
      const b = scenario();
      const size = b.listVar("Size", ["M"]);
      const caption = b.shortTextVar("Caption", "a-a-a");
      const hero = b.imageVar("Hero");
      b.map("L1", hero, [
        b.group({ [size]: ["M"] }, [
          { ref: caption, transform: [tf("a", "X", true)] },
        ]),
      ]);
      return b.state({ Size: "M", Caption: "a-a-a" }, "L1").build();
    },
    expected: { Hero: imageValue("X-X-X") },
  },
  {
    group: "transforms",
    name: "literal + `${ref}` concatenation",
    build: () => {
      const b = scenario();
      const size = b.listVar("Size", ["M"]);
      const region = b.shortTextVar("Region", "EU");
      const hero = b.imageVar("Hero");
      b.map("L1", hero, [
        b.group({ [size]: ["M"] }, ["banner_", { ref: region }, ".png"]),
      ]);
      return b.state({ Size: "M", Region: "EU" }, "L1").build();
    },
    expected: { Hero: imageValue("banner_EU.png") },
  },

  // --- value composition -----------------------------------------------------
  {
    group: "value-composition",
    name: "textarea value is set literally",
    build: () => {
      const b = scenario();
      const size = b.listVar("Size", ["M"]);
      const hero = b.imageVar("Hero");
      b.map("L1", hero, [
        b.group({ [size]: ["M"] }, [{ textarea: "multi\nline" }]),
      ]);
      return b.state({ Size: "M" }, "L1").build();
    },
    expected: { Hero: imageValue("multi\nline") },
  },
  {
    group: "value-composition",
    name: "textarea concatenated with a string literal and a `${ref}`",
    build: () => {
      const b = scenario();
      const size = b.listVar("Size", ["M"]);
      const region = b.shortTextVar("Region", "EU");
      const hero = b.imageVar("Hero");
      b.map("L1", hero, [
        b.group({ [size]: ["M"] }, ["prefix ", { textarea: "MID" }, { ref: region }]),
      ]);
      return b.state({ Size: "M", Region: "EU" }, "L1").build();
    },
    expected: { Hero: imageValue("prefix MIDEU") },
  },
  {
    group: "value-composition",
    name: "chained transforms apply in order (output of first feeds the second)",
    build: () => {
      const b = scenario();
      const size = b.listVar("Size", ["M"]);
      const caption = b.shortTextVar("Caption", "a-a");
      const hero = b.imageVar("Hero");
      b.map("L1", hero, [
        b.group({ [size]: ["M"] }, [
          { ref: caption, transform: [tf("a", "b", true), tf("b", "c", true)] },
        ]),
      ]);
      return b.state({ Size: "M", Caption: "a-a" }, "L1").build();
    },
    expected: { Hero: imageValue("c-c") },
  },
  {
    group: "value-composition",
    name: "always-run with a `${ref}` sets the referenced variable's current value",
    build: () => {
      const b = scenario();
      const caption = b.shortTextVar("Caption", "hello world");
      const hero = b.imageVar("Hero");
      b.map("L1", hero, [b.alwaysRun([{ ref: caption }])]);
      return b.state({ Caption: "hello world" }, "L1").build();
    },
    expected: { Hero: imageValue("hello world") },
  },
  {
    group: "value-composition",
    name: "always-run with a `${ref}` + transform applies the transform",
    build: () => {
      const b = scenario();
      const caption = b.shortTextVar("Caption", "a-a-a");
      const hero = b.imageVar("Hero");
      b.map("L1", hero, [
        b.alwaysRun([{ ref: caption, transform: [tf("a", "X", true)] }]),
      ]);
      return b.state({ Caption: "a-a-a" }, "L1").build();
    },
    expected: { Hero: imageValue("X-X-X") },
  },
  {
    group: "value-composition",
    name: "multiple refs, each with its own transform, applied independently",
    build: () => {
      const b = scenario();
      const size = b.listVar("Size", ["M"]);
      const first = b.shortTextVar("First", "a-a");
      const second = b.shortTextVar("Second", "b-b");
      const hero = b.imageVar("Hero");
      b.map("L1", hero, [
        b.group({ [size]: ["M"] }, [
          { ref: first, transform: [tf("a", "X", true)] },
          { ref: second, transform: [tf("b", "Y", true)] },
        ]),
      ]);
      return b.state({ Size: "M", First: "a-a", Second: "b-b" }, "L1").build();
    },
    expected: { Hero: imageValue("X-XY-Y") },
  },

  // --- $-replacement patterns (String.replace semantics) --------------------
  {
    group: "replacement-patterns",
    name: "$$ in replacement collapses to a single $",
    build: () => {
      const b = scenario();
      const size = b.listVar("Size", ["M"]);
      const caption = b.shortTextVar("Caption", "item");
      const hero = b.imageVar("Hero");
      b.map("L1", hero, [
        b.group(
          { [size]: ["M"] },
          {
            ref: caption,
            transform: [
              { find: "item", replace: "price: $$5", replaceAll: false, regex: false },
            ],
          },
        ),
      ]);
      return b.state({ Size: "M", Caption: "item" }, "L1").build();
    },
    expected: { Hero: imageValue("price: $5") },
  },
  {
    group: "replacement-patterns",
    name: "$& in replacement inserts the matched substring",
    build: () => {
      const b = scenario();
      const size = b.listVar("Size", ["M"]);
      const caption = b.shortTextVar("Caption", "hello");
      const hero = b.imageVar("Hero");
      b.map("L1", hero, [
        b.group(
          { [size]: ["M"] },
          {
            ref: caption,
            transform: [
              { find: "hello", replace: "[$&]", replaceAll: false, regex: false },
            ],
          },
        ),
      ]);
      return b.state({ Size: "M", Caption: "hello" }, "L1").build();
    },
    expected: { Hero: imageValue("[hello]") },
  },
  {
    group: "replacement-patterns",
    name: "$& with replaceAll behaves the same way",
    build: () => {
      const b = scenario();
      const size = b.listVar("Size", ["M"]);
      const caption = b.shortTextVar("Caption", "a-a");
      const hero = b.imageVar("Hero");
      b.map("L1", hero, [
        b.group(
          { [size]: ["M"] },
          {
            ref: caption,
            transform: [
              { find: "a", replace: "[$&]", replaceAll: true, regex: false },
            ],
          },
        ),
      ]);
      return b.state({ Size: "M", Caption: "a-a" }, "L1").build();
    },
    expected: { Hero: imageValue("[a]-[a]") },
  },

  // --- no re-expansion of substituted values --------------------------------
  {
    group: "no-reexpansion",
    name: "variable value containing ${Other} is NOT re-expanded",
    build: () => {
      const b = scenario();
      const size = b.listVar("Size", ["M"]);
      const payload = b.shortTextVar("Payload", "${Other}");
      b.shortTextVar("Other", "INJECTED");
      const hero = b.imageVar("Hero");
      b.map("L1", hero, [b.group({ [size]: ["M"] }, { ref: payload })]);
      return b
        .state({ Size: "M", Payload: "${Other}", Other: "INJECTED" }, "L1")
        .build();
    },
    expected: { Hero: imageValue("${Other}") },
  },
  {
    group: "no-reexpansion",
    name: "nested ${${X}} is not recursively resolved",
    build: () => {
      const b = scenario();
      const size = b.listVar("Size", ["M"]);
      const inner = b.shortTextVar("Inner", "Size");
      const hero = b.imageVar("Hero");
      b.map("L1", hero, [b.group({ [size]: ["M"] }, { ref: inner })]);
      return b.state({ Size: "M", Inner: "Size" }, "L1").build();
    },
    expected: { Hero: imageValue("Size") },
  },

  // --- multi-dependent positional matching ----------------------------------
  {
    group: "multi-dependent",
    name: "2-dependent: both slots must be in their allowed sets",
    build: () => {
      const b = scenario();
      const size = b.listVar("Size", ["S", "M", "L"]);
      const color = b.listVar("Color", ["Red", "Blue"]);
      const hero = b.imageVar("Hero");
      b.map("L1", hero, [
        b.group({ [size]: ["S", "M"], [color]: ["Red"] }, "sm_red.png"),
        b.group({ [size]: ["L"], [color]: ["Blue"] }, "l_blue.png"),
      ]);
      return b.state({ Size: "M", Color: "Red" }, "L1").build();
    },
    expected: { Hero: imageValue("sm_red.png") },
  },
  {
    group: "multi-dependent",
    name: "4-dependent: full positional match across all slots",
    build: () => {
      const b = scenario();
      const a = b.listVar("A", ["a1", "a2"]);
      const c = b.listVar("C", ["c1", "c2"]);
      const d = b.listVar("D", ["d1", "d2"]);
      const e = b.listVar("E", ["e1", "e2"]);
      const hero = b.imageVar("Hero");
      b.map("L1", hero, [
        b.group({ [a]: ["a1"], [c]: ["c1", "c2"], [d]: ["d2"], [e]: ["e1"] }, "match.png"),
        b.group({ [a]: ["a2"], [c]: ["c1"], [d]: ["d1"], [e]: ["e2"] }, "other.png"),
      ]);
      return b.state({ A: "a1", C: "c2", D: "d2", E: "e1" }, "L1").build();
    },
    expected: { Hero: imageValue("match.png") },
  },

  // --- match precedence ------------------------------------------------------
  {
    group: "precedence",
    name: "same dependentKey, overlapping sets → LAST group in array wins",
    build: () => {
      const b = scenario();
      const size = b.listVar("Size", ["S", "M", "L"]);
      const hero = b.imageVar("Hero");
      b.map("L1", hero, [
        b.group({ [size]: ["S", "M"] }, "first.png"),
        b.group({ [size]: ["M", "L"] }, "second.png"),
      ]);
      return b.state({ Size: "M" }, "L1").build();
    },
    expected: { Hero: imageValue("second.png") },
  },
  {
    group: "precedence",
    name: "different dependentKeys → first matching KEY (insertion order) wins",
    build: () => {
      const b = scenario();
      const size = b.listVar("Size", ["M"]);
      const color = b.listVar("Color", ["Red"]);
      const hero = b.imageVar("Hero");
      b.map("L1", hero, [
        b.group({ [size]: ["M"] }, "by_size.png"),
        b.group({ [color]: ["Red"] }, "by_color.png"),
      ]);
      return b.state({ Size: "M", Color: "Red" }, "L1").build();
    },
    expected: { Hero: imageValue("by_size.png") },
  },
  {
    group: "precedence",
    name: "falls through to a later group when the earlier one does not match",
    build: () => {
      const b = scenario();
      const size = b.listVar("Size", ["S", "M", "L"]);
      const hero = b.imageVar("Hero");
      b.map("L1", hero, [
        b.group({ [size]: ["S"] }, "small.png"),
        b.group({ [size]: ["M", "L"] }, "big.png"),
      ]);
      return b.state({ Size: "L" }, "L1").build();
    },
    expected: { Hero: imageValue("big.png") },
  },
];

/** Cases grouped by topic, preserving declaration order within each group. */
export function runtimeCasesByGroup(): Map<string, RuntimeCase[]> {
  const out = new Map<string, RuntimeCase[]>();
  for (const c of RUNTIME_CASES) {
    const list = out.get(c.group) ?? [];
    list.push(c);
    out.set(c.group, list);
  }
  return out;
}
