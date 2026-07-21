# Ticket 017: Typo in exported function name `removeFrameLayouyMap`

**File:** `src/studio/studioAdapter.ts`, line 522

## Description

The exported function is named `removeFrameLayouyMap` — "Layouy" should be "Layout". The parameter `imageName: String` on line 524 also uses the wrapper object type instead of the primitive `string`.

## Suggested fix

Rename to `removeFrameLayoutMap` and change `String` to `string`. Find and update all call sites.
