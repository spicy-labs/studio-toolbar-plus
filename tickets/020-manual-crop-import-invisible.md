# Ticket 020: Imported manual crops invisible until save

**File:** `src/components/ManualCropManager/ManualCropEditor.tsx`, line 712

## Description

When importing crops, new entries are added only to `changedRows` (the dirty-tracking state) but are never merged into the displayed `layoutCrops` array. The rendering loop at line 1993 iterates only `layoutCrop.crops`, so newly imported crops are staged but not visible or editable — especially confusing for a layout that initially contains no crops.

## Suggested fix

After building the new `changedRows` map with imports, also merge the new entries into the displayed `layoutCrops` state so they appear immediately.
