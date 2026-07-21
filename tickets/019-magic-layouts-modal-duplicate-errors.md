# Ticket 019: MagicLayoutsModal fires errors twice + fire-and-forget SDK calls

**File:** `src/components/MagicLayoutsModal.tsx`, lines 147–148, 228

## Description

Two issues:

1. **Duplicate error display:** After calling `raiseError(message)`, the code immediately `throw new Error(message)` with the same text. The error surfaces in the UI twice — once via the error handler and once when the catch block at line 651 handles the unhandled rejection.

2. **Fire-and-forget:** `setLayoutAvailable(window.SDK, id, false)` is called inside a `forEach` without `await`. If any call fails, the error is silently swallowed.

## Suggested fix

1. Throw a sentinel error (e.g. `throw new Error("ABORT")`) after `raiseError()` so the catch block can distinguish abort throws from real errors and avoid displaying the message a second time.

2. Replace the `forEach` with `await Promise.all(layoutIds.map(id => setLayoutAvailable(window.SDK, id, false)))`.
