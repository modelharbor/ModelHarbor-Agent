# Orchestrator File Changes Propagation — Subtask File Changes Visible in Parent Task

**Date:** 2026-03-27

## Summary

When an Orchestrator delegates work to a subtask (Code, Debug, etc.) and the subtask modifies files, the file changes are now propagated back up to the parent Orchestrator task's File Changes Panel. This gives users full visibility of all changes made across subtasks without leaving the Orchestrator context.

## Problem

- Orchestrator mode has `groups: []` — it has no edit tools and cannot directly modify files.
- When a subtask edits files, those file changes live only in the subtask's context.
- Upon completion, the parent Orchestrator only receives the `completion_result` text back — it never sees the file changes.
- The `FileChangesPanel` returns `null` in the parent task because there is no file change data to display.

## Solution: Backend In-Memory Propagation

### 1. `Task.ts` — Added `mergeChildFileChanges(childFileChanges: FileChange[])` Method

- Accepts an array of `FileChange` objects from a completed child task
- Deduplicates by file path: keeps the earliest `originalContent` and `timestamp` from the parent (if the file was already tracked), and updates `updatedContent`, `diff`, and `diffStats` from the child's latest version
- Sends a single notification to the webview after the entire merge is complete, avoiding redundant UI updates

### 2. `ClineProvider.ts` — Modified `reopenParentFromDelegation()`

- Before closing the child task: extracts `childFileChanges` via `getFileChanges()`
- After reopening the parent task: calls `mergeChildFileChanges(childFileChanges)` to propagate the child's file changes into the parent's state

## Key Design Decisions

1. **No changes to Orchestrator groups.** The Orchestrator retains `groups: []` — it remains a delegate-only mode. File changes are propagated at the task lifecycle level, not by granting edit tools.
2. **No frontend changes.** The existing `backendFileChanges` → `FileChangesPanel` rendering path handles the merged data without modification.
3. **Natural support for nested subtasks.** Each level of delegation propagates changes upward when it completes. A deeply nested subtask's changes will bubble up through each parent.
4. **Dedup by path.** If multiple subtasks modify the same file, the earliest `originalContent` is preserved (representing the true "before" state) while `updatedContent` reflects the latest version.

## Files Modified

- [`src/core/task/Task.ts`](src/core/task/Task.ts) — added `mergeChildFileChanges()` method
- [`src/core/webview/ClineProvider.ts`](src/core/webview/ClineProvider.ts) — added propagation logic in `reopenParentFromDelegation()`
- [`src/core/task/__tests__/file-changes.spec.ts`](src/core/task/__tests__/file-changes.spec.ts) — added 8 test cases covering merge, dedup, and notification behavior

## Verification

- **TypeScript type check:** passed
- **31 tests passed** (including 8 new tests for the propagation logic)

## References

- Design document: [`docs/design-orchestrator-file-changes.md`](docs/design-orchestrator-file-changes.md)
- File Changes Panel feature: [`docs/journal/2026-02-24-file-changes-panel-feature.md`](docs/journal/2026-02-24-file-changes-panel-feature.md)
