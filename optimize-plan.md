# Image Selection Action - Size Optimization Plan

The `imageSelectionScript` action injects a JSON lookup table (`imageSelectionData`) into a Studio action. For a recent document, this produced a **15 MB** action script. The data maps `layout -> variable -> dependency combination -> {value, transforms}`.

## Root Causes

### A. All 8 layouts are byte-for-byte identical (8x bloat)

`layoutMappingToActionMap` iterates `layoutMap.layoutIds` and copies the same variable/group/value data under each layout name. All 8 layouts produce identical ~2 MB objects. **~14 MB is pure duplication.**

**Fix:** Deduplicate layouts that share identical variable configs. Build the data once, then point all layout names at the same object.

**Impact:** 15 MB -> ~2 MB

**Caveat (implemented):** The current fix builds the variable data once per `LayoutMap` and assigns the same JS object reference to all layout names. However, `JSON.stringify` does not deduplicate shared references — it serializes the full object under every key. So the serialized action script is still ~8x larger than it needs to be.

To get actual JSON-level dedup, `saveLayoutMappingToAction` would need to serialize the action map differently. Instead of emitting the raw `JSON.stringify(actionMap)` where every layout key contains its own full copy of the data, the serialization step would:

1. Detect which layout names share the same underlying variable map (same JS reference or deep-equal)
2. Emit each unique variable map once as a standalone variable in the script (e.g. `const _shared_0 = { ... }`)
3. Build `imageSelectionData` as a thin mapping of layout names to those shared variables

The generated script would go from:
```js
const imageSelectionData = {
  "Print 1:4 Impulse": { /* 2 MB of variable data */ },
  "Print 1:2 Impulse": { /* same 2 MB again */ },
  "Print 2:3 Impulse": { /* same 2 MB again */ },
  // ... 5 more identical copies
};
```

To:
```js
const _shared_0 = { /* 2 MB of variable data, once */ };
const imageSelectionData = {
  "Print 1:4 Impulse": _shared_0,
  "Print 1:2 Impulse": _shared_0,
  "Print 2:3 Impulse": _shared_0,
  // ... 5 more references
};
```

This change lives entirely in `saveLayoutMappingToAction` (in `studioAdapter.ts`) where the script string is assembled — the builder output and `imageSelectionScript` runtime logic stay the same. The tradeoff is that the output is no longer a single `JSON.stringify` call; it becomes a custom code-gen step that emits JS variable declarations.

### B. 98.7% of transform arrays are empty

Out of 108,608 transform slots, 107,192 are `[]`. Every entry carries a transforms object keyed by variable name even when there are no transforms to apply.

**Fix:** Only emit non-empty transforms. Default to `[]` in the script when a key is missing.

**Impact:** ~30-50% reduction on top of A

### C. Cartesian explosion with identical values

For `Headline 1 (Impulse)`, there are only 13 unique values but the code generates all combinations of dependent variable values, producing 7,989 entries each carrying its own copy of the same `{value, transforms}`. Similarly `ZeroSugar (Impulse)` has 3 unique values but 289 entries (96x).

**Fix:** Store the value once per dependency group and let the script check membership rather than expanding every combination into its own entry.

**Impact:** Further reduction to ~100-200 KB total (combined with A + B)

## Estimated Combined Impact

| Change | Estimated Size |
|--------|---------------|
| Current | 15 MB |
| A only | ~2 MB |
| A + B | ~1.2 MB |
| A + B + C | ~100-200 KB |
