# 2026-03-31: Orchestrator FileChanges Persistence

## Problem

Orchestrator mode ไม่แสดง fileChange ใน webview เพราะ 3 สาเหตุ:

1. `fileChanges` เป็น in-memory Map ไม่ persist ลง disk → หายเมื่อ Task ถูก dispose
2. Sequential subtasks สูญเสีย file changes ก่อนหน้า เพราะ parent ถูก dispose แล้วสร้างใหม่
3. Client-side fallback (`fileChangesFromMessages()`) scan เฉพาะ edit tools แต่ orchestrator ใช้ `newTask`

## Solution

Implement file changes persistence to disk เป็น `file_changes.json` ใน task directory

## Files Modified/Created

| File                                                         | Action   | Description                                                                                                                                                                        |
| ------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/globalFileNames.ts`                              | Modified | Added `fileChanges: "file_changes.json"`                                                                                                                                           |
| `src/core/task-persistence/fileChanges.ts`                   | Created  | `saveFileChanges()` / `readFileChanges()` persistence functions                                                                                                                    |
| `src/core/task-persistence/index.ts`                         | Modified | Exported new persistence functions                                                                                                                                                 |
| `src/core/task/Task.ts`                                      | Modified | Added `saveFileChangesToDisk()`, `loadFileChangesFromDisk()`; wired fire-and-forget saves into `updateFileChange()` and `mergeChildFileChanges()`                                  |
| `src/core/webview/ClineProvider.ts`                          | Modified | 3 changes: (1) `loadFileChangesFromDisk()` in `createTaskWithHistoryItem()`, (2) flush parent in `delegateParentAndOpenChild()`, (3) flush child in `reopenParentFromDelegation()` |
| `src/core/task-persistence/__tests__/fileChanges.spec.ts`    | Created  | Unit tests for persistence functions                                                                                                                                               |
| `src/core/task/__tests__/file-changes.spec.ts`               | Modified | Added tests for save/load methods on Task                                                                                                                                          |
| `src/__tests__/file-changes-persistence-integration.spec.ts` | Created  | Integration test for full delegation round-trip                                                                                                                                    |

## Data Flow

```
updateFileChange() → notifyFileChangesChanged() → webview update
                   → saveFileChangesToDisk()     → file_changes.json

delegateParentAndOpenChild():
  parent.saveFileChangesToDisk()    → file_changes.json (parent)
  removeClineFromStack()            // parent disposed
  createTask(child)                 // child runs

reopenParentFromDelegation():
  child.getFileChanges()            // extract from memory
  child.saveFileChangesToDisk()     → file_changes.json (child)
  removeClineFromStack()            // child disposed
  createTaskWithHistoryItem()       // parent restored
    → task.loadFileChangesFromDisk()  ← file_changes.json (parent)
  parent.mergeChildFileChanges()    // merge child changes
    → saveFileChangesToDisk()       → file_changes.json (parent, updated)
  parent.notifyFileChangesChanged() → webview sees all changes ✓
```

## Verification

- 49 tests passing across 3 test files (0 failures)
- Type check clean (`tsc --noEmit` exit code 0)

## Related

- Design doc: `docs/design-orchestrator-file-changes.md`
- Plan: `docs/plans/2026-03-31-orchestrator-file-changes-persistence.md`
- Previous journal: `docs/journal/2026-03-27-orchestrator-file-changes-propagation.md`
