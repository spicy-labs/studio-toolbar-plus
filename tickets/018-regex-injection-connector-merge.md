# Ticket 018: Regex injection risk in connector merge

**File:** `src/studio/studioAdapter.ts`, line 867

## Description

`new RegExp(connectorId, "g")` constructs a regex from a connector ID string. If a connector ID ever contained regex special characters (e.g. `.`, `+`, `(`), the replacement would break or match unintended content. In practice connector IDs are UUIDs so this is safe today, but `replaceAll` is clearer and more robust.

## Suggested fix

```typescript
// Before
const regex = new RegExp(connectorId, "g");
documentJson = documentJson.replace(regex, targetConnectorId);

// After
documentJson = documentJson.replaceAll(connectorId, targetConnectorId);
```
