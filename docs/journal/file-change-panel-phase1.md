# File Change Panel - Phase 1: Backend Type Definitions

**Date:** 2026-02-24  
**Author:** Roo  
**Phase:** 1 of 4+

## Overview

This document describes Phase 1 of the File Change Panel implementation. This phase focuses on establishing the type definitions and utility functions needed for tracking file changes with diff statistics.

## Files Created

### `src/utils/diffStats.ts`

A utility module providing functions to compute diff statistics from unified diff strings.

**Exports:**

- `DiffStats` interface - Type definition for diff statistics with `added`, `removed`, and optional `path` properties
- `computeDiffStats(diff: string): DiffStats` - Computes line counts from a unified diff string
- `computeBatchDiffStats(diffs: Array<{ path: string; content: string }>): Array<DiffStats & { path: string }>` - Computes stats for multiple file diffs
- `aggregateDiffStats(statsArray: DiffStats[]): DiffStats` - Aggregates multiple DiffStats into a total

**Example Usage:**

```typescript
import { computeDiffStats } from "../utils/diffStats"

const diff = `--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,4 @@
 line 1
+new line
 line 2
 line 3`

const stats = computeDiffStats(diff)
// stats: { added: 1, removed: 0 }
```

## Files Modified

### `packages/types/src/vscode-extension-host.ts`

**New Type Definitions:**

1. **`FileChange` interface** (lines 803-827)

    - Represents a file modified during a conversation
    - Used for the file change panel feature
    - Properties:
        - `path: string` - File path
        - `originalContent?: string` - Content before modification
        - `updatedContent?: string` - Content after modification
        - `diff?: string` - Unified diff string
        - `diffStats?: DiffStats` - Change statistics
        - `isOutsideWorkspace?: boolean` - Whether file is outside workspace
        - `isProtected?: boolean` - Whether file is protected
        - `timestamp?: number` - When file was first modified

2. **`DiffStats` interface** (lines 829-841)

    - Statistics about changes in a file diff
    - Properties:
        - `added: number` - Lines added
        - `removed: number` - Lines removed
        - `path?: string` - Optional file path for batch operations

3. **`ExtensionMessage` interface updates:**

    - Added `"fileChanges"` to the `type` union (line 110)
    - Added `fileChanges?: FileChange[]` property (line 214)

4. **`ClineSayTool` interface updates:**
    - Changed `diffStats` type from inline `{ added: number; removed: number }` to `DiffStats` (line 764)
    - Changed `batchDiffs[].diffStats` type to `DiffStats` (line 787)

## Key Types Summary

| Type                                    | Purpose                                          | Location                                                                   |
| --------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| `FileChange`                            | Tracks modified file metadata                    | `packages/types/src/vscode-extension-host.ts`                              |
| `DiffStats`                             | Diff line statistics                             | `packages/types/src/vscode-extension-host.ts` and `src/utils/diffStats.ts` |
| `ExtensionMessage.type = "fileChanges"` | Message type for sending file changes to webview | `packages/types/src/vscode-extension-host.ts`                              |

## TypeScript Verification

All new types compile without errors:

```bash
# Types package
cd packages/types && npm run check-types
# Result: ✓ Success

# Utility module
cd src && npx tsc --noEmit utils/diffStats.ts
# Result: ✓ Success
```

## Dependencies and Prerequisites for Next Phase

### Phase 2: Tool Implementation

The following will be needed:

1. **File tracking mechanism** - Need to implement logic to track file changes during conversation
2. **Integration with existing tools** - `apply_diff`, `write_to_file`, `editedExistingFile` tools should emit `FileChange` records
3. **Extension state management** - Store file changes in extension state for persistence

### Phase 3: Backend Message Handling

1. **Message handler** - Handle `"fileChanges"` message type in extension host
2. **WebSocket/IPC updates** - Send file change updates to webview when files are modified

### Phase 4: Frontend Implementation

1. **FileChangePanel component** - New React component to display file changes
2. **ChatView integration** - Position panel above chat input
3. **State management** - Subscribe to file change updates from extension

## Notes

- The `DiffStats` interface is defined in both `packages/types/src/vscode-extension-host.ts` (for type sharing with webview) and `src/utils/diffStats.ts` (for runtime utility functions)
- The utility functions use simple line counting based on unified diff format (`+` for additions, `-` for deletions)
- The `FileChange` type supports optional content fields to allow flexibility in how much data is transmitted

## Next Steps

Proceed to Phase 2: Implement tool modifications to track file changes and emit `FileChange` records when files are modified.
