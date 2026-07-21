# Image-selection logic tests

Characterization tests for the image-selection action pipeline on **this branch**
(`toolbar-optimizations`). They pin the observable behavior — *given a config
(`layoutMaps` + `doc`) and a runtime variable state, which value gets set on each
image variable* — so future changes (e.g. the planned P1/P2/P3 optimizations)
surface as reviewed diffs rather than silent behavior changes.

Run: `bun test` (or `bun test test/`).

## What's under test

The pipeline has three pure pieces, all exercised together end-to-end:

1. **Producer** — `src/studio/layoutMappingToActionMap.ts` turns the config into
   an `actionMap`.
2. **Assembly** — dedup into `_shared_N` vars + inline the matcher. This lives in
   `src/studio/buildActionScript.ts` and is imported by BOTH production
   (`studioAdapter`) and the harness (via `harness/buildActionScript.ts`), so it
   is a single source of truth rather than a copy, and no `window.SDK` is needed.
3. **Runtime matcher** — `src/studio/actions/imageSelection.js`, run against a
   mock `studio` in `harness/engine.ts`.

No client documents are used — every scenario is synthetic and readable, built
with the `harness/builder.ts` DSL. The scenarios were distilled from the
*structural shapes* of real templates (single- and multi-dependent groups,
always-run, transforms, dedup) plus adversarial corners real docs don't contain
(degraded groups, overlapping precedence, pipes in values).

## Layout

```
test/
  harness/
    buildActionScript.ts   re-exports src/studio/buildActionScript.ts (shared with production)
    engine.ts              mock `studio` runner → captures setVariableValue calls
    builder.ts             scenario DSL (scenario()… .build())
    run.ts                 wires current producer + assembly + engine
  scenarios/
    smoke.test.ts          harness sanity
    multi-dependent.test.ts positional membership matching (2- and 4-dep)
    transforms.test.ts     ${ref} substitution + replace/replaceAll
    precedence.test.ts     first-match ordering (DIV-1)
    degraded-group.test.ts deleted-dependent behavior (pins pre-P3 state)
    dedup.test.ts          _shared_N collapsing (+ pre-P2 order sensitivity)
    edge-cases.test.ts     unmapped layout/var, empty sets, booleans, pipes
```

## Writing a scenario

```ts
const b = scenario();
const size = b.listVar("Size", ["S", "M", "L"]);  // returns the variable id
const hero = b.imageVar("Hero");
b.map("L1", hero, [
  b.group({ [size]: ["S", "M"] }, "hero_SM.png"),
  b.group({ [size]: ["L"] }, "hero_L.png"),
]);
b.state({ Size: "M" }, "L1");

expect(setValues(run(b.build()))).toEqual({ Hero: "hero_SM.png" });
```

`run()` returns `{ calls, state, debugData, errors }`. Use `setValues()` for the
common one-set-per-variable case; assert on `.calls` directly when order or
repeat-sets matter.

## Real-template fixtures (anonymized)

Client documents can't be committed, so `scripts/anonymize-template.ts` extracts
their *logic structure* into synthetic fixtures. It reads only the fields the
pipeline consumes and rebuilds a fresh minimal `{ doc, layoutMaps }` (an
allowlist — nothing else can leak), mapping every string through a consistent
bijection so membership/dedup/precedence structure is preserved while all content
becomes meaningless tokens. It self-verifies (leak check + logic-parity check)
before writing.

```bash
# offline, local only — the client file never enters the repo
bun scripts/anonymize-template.ts test/_client-inputs/SomeClient.CHILI.json test/fixtures/some-client.json
```

- Kept dev tool, run manually — NOT part of `bun test` / CI.
- Inputs live under `test/_client-inputs/` (gitignored, alongside `*.CHILI.json`).
- Outputs (`test/fixtures/*.json`) are committed and consumed by the suite.

`harness/fixture.ts` — which derives one "should-select-this-group" runtime state
per group (bounded, deterministic) and records the resulting setValue calls. P1/P2
must leave that snapshot unchanged; update it with `bun test --update-snapshots`
only for a reviewed, intentional change.

## Extending toward a differential (main / planned)

The harness is written so the current-version wiring in `run.ts` can be
generalized to a `versions` registry (`main` from a committed snapshot, `planned`
from the branch once it lands). Several scenarios already carry PRE-P2/PRE-P3
notes marking the assertions expected to flip when those phases land — those are
the seams for the future cross-version comparison. This suite is the baseline it
would diff against.
```
