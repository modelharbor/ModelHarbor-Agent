# Super Yolo Mode Completion Loop Fix

**Date:** 2026-02-16
**Author:** ModelHarbor Agent

## Summary

Fixed a bug where Super Yolo Mode would enter an infinite loop after task completion (`attempt_completion`), sending repeated requests that the user did not initiate.

## Problem

When Super Yolo Mode was enabled, after a task completed via `attempt_completion`, the system would automatically send repeated requests without user input, creating an infinite loop.

## Root Cause Analysis

`startSuperYoloStuckTimer()` in `src/core/task/Task.ts` did not exclude `completion_result` ask type, causing a recursive loop:

```
1. LLM calls attempt_completion
   → task.ask("completion_result", ...)

2. checkAutoApproval() does not auto-approve "completion_result"
   → returns { decision: "ask" }
   → task blocks waiting for user input

3. "completion_result" is treated as an idle ask
   → stuck timer starts counting down

4. Stuck timer fires
   → calls handleWebviewAskResponse("yesButtonClicked")

5. AttemptCompletionTool.execute() returns early (does not call pushToolResult)

6. initiateTaskLoop interprets this as incomplete
   → sends "no tools used" message
   → LLM responds
   → loop repeats from step 1
```

## Solution

Added a guard clause in `startSuperYoloStuckTimer()` at lines 1445-1447 of `src/core/task/Task.ts` to exclude terminal ask types from triggering the stuck timer:

```typescript
if (askType === "completion_result" || askType === "resume_completed_task" || askType === "resume_task") {
	return
}
```

This prevents the stuck timer from firing on ask types that represent task completion or resumption states, which should always wait for explicit user action.

## Files Changed

| File                    | Change                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/task/Task.ts` | Added guard clause in `startSuperYoloStuckTimer()` to exclude `completion_result`, `resume_completed_task`, and `resume_task` ask types |

## Tests Added

| File                                                          | Tests | Description                                                                                             |
| ------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------- |
| `src/core/task/__tests__/Task.super-yolo-stuck-timer.spec.ts` | 17    | Validates that stuck timer does not fire for excluded ask types and correctly fires for other ask types |
