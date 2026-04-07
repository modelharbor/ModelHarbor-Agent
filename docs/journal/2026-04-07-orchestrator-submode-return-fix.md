# Orchestrator Submode Return Bug Fix

**Date:** 2026-04-07

## Summary

Fixed a bug where the Orchestrator mode delegates a task to a submode via `new_task`, but the submode sometimes fails to return control back to the Orchestrator after calling `attempt_completion`.

## Root Cause

### Primary: Race Condition in Status Check (AttemptCompletionTool.ts)

When a child task calls `attempt_completion`, the tool checks the child task's `historyItem.status` before deciding whether to delegate back to the parent:

- `status === "completed"` → skip delegation (already done)
- `status === "active"` → normal delegation flow
- **Any other value (undefined, "delegated", etc.)** → **BUG: delegation was skipped** with only a `console.error`

The `else` branch for unexpected statuses would fall through to the normal completion flow, causing the child task to complete without returning control to the parent Orchestrator.

This could happen when:

- The task's `initialStatus` wasn't properly persisted before `attempt_completion` was called
- There was a timing issue between status persistence and the completion check

### Secondary: Silent Error Swallowing (ClineProvider.ts)

Multiple `try/catch` blocks in `reopenParentFromDelegation()` swallowed errors silently, making it impossible to diagnose failures in:

- Reading persisted UI/API history
- Emitting `TaskDelegationCompleted` events
- Overwriting parent messages after reopen
- Emitting `TaskDelegationResumed` events

## Fix Applied

### AttemptCompletionTool.ts

Changed the `else` branch (unexpected status) to still attempt delegation when `parentTaskId` exists, instead of silently falling through:

```typescript
// Before: silently skipped delegation
console.error(`[AttemptCompletionTool] Unexpected child task status "${status}"...`)

// After: attempts delegation with warning
console.warn(`[AttemptCompletionTool] Unexpected child task status "${status}" ... Attempting delegation anyway.`)
const delegated = await this.delegateToParent(...)
if (delegated) return
```

The key insight is that the presence of `parentTaskId` is a reliable indicator that this IS a subtask, regardless of what the persisted status says.

### ClineProvider.ts (reopenParentFromDelegation)

Added error logging to all silent `catch` blocks:

- Persisted UI history read failures
- Persisted API history read failures
- `TaskDelegationCompleted` event emit failures
- `overwriteClineMessages()` failures
- `overwriteApiConversationHistory()` failures
- `TaskDelegationResumed` event emit failures

## Files Changed

| File                                              | Change                                            |
| ------------------------------------------------- | ------------------------------------------------- |
| `src/core/tools/AttemptCompletionTool.ts`         | Fixed fallback delegation for unexpected statuses |
| `src/core/webview/ClineProvider.ts`               | Added error logging to silent catch blocks        |
| `src/__tests__/history-resume-delegation.spec.ts` | Added regression test for logging failures        |
| `src/__tests__/nested-delegation-resume.spec.ts`  | Added regression test for fallback delegation     |

## Test Coverage

- 22 tests pass across `history-resume-delegation.spec.ts`, `nested-delegation-resume.spec.ts`, and `attemptCompletionTool.spec.ts`
- New regression tests cover:
    - Fallback delegation when child status is unexpected
    - Error logging when delegation operations fail
- TypeScript typecheck passes
