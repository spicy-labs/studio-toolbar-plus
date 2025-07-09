# React Error #185: Maximum Update Depth Exceeded - Analysis and Fix

## Root Cause Analysis

The infinite update loop is caused by a circular dependency in the `ManualCropManagerModal.tsx` component's useEffect hooks. The problem stems from including `selectedLayoutIds` in the dependency array of an effect that also modifies `selectedLayoutIds`.

### Problematic Code Pattern

```typescript
// ManualCropManagerModal.tsx - Lines 94-118
useEffect(() => {
  if (opened) {
    // Load selected layouts from sessionStorage
    const storedSelected = sessionStorage.getItem(
      "tempManualCropManager_layoutsSelected"
    );
    if (storedSelected) {
      try {
        const selectedIds = JSON.parse(storedSelected) as string[];
        setSelectedLayoutIds(selectedIds); // ← This triggers the effect again!
      } catch (error) {
        setSelectedLayoutIds([]);
      }
    } else {
      setSelectedLayoutIds([]);
    }
    // ... other initialization code
  } else {
    enableToolbar();
  }
}, [opened, selectedLayoutIds]); // ← selectedLayoutIds in dependency causes infinite loop!

// Lines 120-126 - Compounds the problem
useEffect(() => {
  sessionStorage.setItem(
    "tempManualCropManager_layoutsSelected",
    JSON.stringify(selectedLayoutIds)
  );
}, [selectedLayoutIds]);
```

### The Infinite Loop Sequence

1. **Initial Trigger**: Modal opens (`opened` becomes `true`)
2. **Effect Execution**: First useEffect runs due to `opened` change
3. **State Update**: `setSelectedLayoutIds(selectedIds)` is called
4. **Dependency Change**: `selectedLayoutIds` changes, triggering the effect again
5. **Loop**: Effect runs again because `selectedLayoutIds` is in the dependency array
6. **Infinite Recursion**: Steps 3-5 repeat indefinitely

### Why This Happens

The fundamental issue is **violating the React useEffect rule**: an effect should not modify state variables that are listed in its dependency array, unless there's proper conditional logic to prevent infinite updates.

## Technical Explanation

### React's Reconciliation Process

- React compares dependency arrays between renders using `Object.is()`
- When `selectedLayoutIds` changes, React schedules a re-render
- During re-render, the useEffect with `selectedLayoutIds` in dependencies runs again
- This creates an endless cycle of state updates → re-renders → effect execution

### Memory and Performance Impact

- Each iteration creates new objects and function calls
- React's internal reconciliation becomes overwhelmed
- Browser eventually throws "Maximum update depth exceeded" to prevent stack overflow

## Solution Strategy

The fix involves **separating concerns** and **removing circular dependencies**:

1. **Initialization Effect**: Only run when modal opens (depend only on `opened`)
2. **Persistence Effect**: Save to sessionStorage when selections change
3. **Remove Circular Dependency**: Don't include `selectedLayoutIds` in the initialization effect's dependencies

## Implementation Fix

### Step 1: Fix the Initialization Effect

Remove `selectedLayoutIds` from the dependency array and ensure the effect only runs for modal state changes:

```typescript
// Fixed version - only depends on 'opened'
useEffect(() => {
  if (opened) {
    // Load selected layouts from sessionStorage
    const storedSelected = sessionStorage.getItem(
      "tempManualCropManager_layoutsSelected"
    );
    if (storedSelected) {
      try {
        const selectedIds = JSON.parse(storedSelected) as string[];
        setSelectedLayoutIds(selectedIds);
      } catch (error) {
        setSelectedLayoutIds([]);
      }
    } else {
      setSelectedLayoutIds([]);
    }

    setSelectedConnectorId("");
    disableToolbar();
    loadConnectors();
  } else {
    enableToolbar();
  }
}, [opened]); // ← Only 'opened' in dependency array
```

### Step 2: Keep Persistence Effect Separate

The persistence effect remains unchanged as it serves a different purpose:

```typescript
// This effect is correct - saves state changes to sessionStorage
useEffect(() => {
  sessionStorage.setItem(
    "tempManualCropManager_layoutsSelected",
    JSON.stringify(selectedLayoutIds)
  );
}, [selectedLayoutIds]);
```

### Step 3: Optimize LayoutViewer sessionStorage

Add a flag to prevent saving during initial load in LayoutViewer:

```typescript
// Add initialization flag to prevent saving during load
const [isInitialized, setIsInitialized] = useState(false);

// Load from sessionStorage only once
useEffect(() => {
  const storedExpanded = sessionStorage.getItem(
    "tempManualCropManager_layoutsExpanded"
  );
  if (storedExpanded) {
    try {
      const expandedIds = JSON.parse(storedExpanded) as string[];
      setExpandedLayouts(new Set(expandedIds));
    } catch (error) {
      setExpandedLayouts(new Set());
    }
  }
  setIsInitialized(true);
}, []);

// Save to sessionStorage only after initialization
useEffect(() => {
  if (isInitialized) {
    const expandedIds = Array.from(expandedLayouts);
    sessionStorage.setItem(
      "tempManualCropManager_layoutsExpanded",
      JSON.stringify(expandedIds)
    );
  }
}, [expandedLayouts, isInitialized]);
```

## Key Principles Applied

1. **Single Responsibility**: Each useEffect has one clear purpose
2. **Avoid Circular Dependencies**: Effects don't modify their own dependencies
3. **Proper Initialization**: Separate initialization from ongoing state management
4. **Performance Optimization**: Prevent unnecessary sessionStorage writes during initialization

## Verification Steps

After implementing the fix:

1. Modal should open without infinite loops
2. Selected layouts should be restored from sessionStorage
3. Expanded layouts should be restored from sessionStorage
4. Changes should be persisted correctly
5. No React warnings or errors in console
