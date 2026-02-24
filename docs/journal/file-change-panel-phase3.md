# File Change Panel - Phase 3: Backend Message Handler

**Date:** 2026-02-24

## Overview

This document describes the backend message handling implementation for the file change panel feature (Phase 3). This phase focuses on collecting file change records from tool responses and handling webview requests for file change data.

## Files Modified/Created

### 1. `packages/types/src/vscode-extension-host.ts`

**Changes:**

- Added `"getFileChanges"` to the `WebviewMessage` type union (line 534)
- The `FileChange` and `DiffStats` interfaces were already defined (lines 804-841)
- The `ExtensionMessage` type already included `fileChanges` property (lines 110, 214)

### 2. `src/core/task/Task.ts`

**Changes:**

- Added import for `FileChange` type from `@roo-code/types`
- Added `fileChanges: Map<string, FileChange> = new Map()` property to track modified files (line 322)
- Added `updateFileChange()` method to update or add file change records
- Added `removeFileChange()` method to remove file change records
- Added `getFileChanges()` method to get all file changes as an array
- Added `clearFileChanges()` method to clear all file changes
- Added `notifyFileChangesChanged()` private method to notify webview of updates

### 3. `src/core/webview/webviewMessageHandler.ts`

**Changes:**

- Added handler for `"getFileChanges"` message type (after `readFileContent` handler)
- Handler retrieves file changes from current task and sends to webview via `ExtensionMessage` with type `"fileChanges"`

## Message Handlers Added

### `getFileChanges`

**Request (Webview -> Extension):**

```typescript
{
	type: "getFileChanges"
}
```

**Response (Extension -> Webview):**

```typescript
{
  type: "fileChanges",
  fileChanges: FileChange[]
}
```

Where `FileChange` is:

```typescript
interface FileChange {
	path: string
	originalContent?: string
	updatedContent?: string
	diff?: string
	diffStats?: { added: number; removed: number }
	isOutsideWorkspace?: boolean
	isProtected?: boolean
	timestamp?: number
}
```

## How File Changes Are Collected

1. **Tool Execution**: When file-modifying tools execute (e.g., `WriteToFileTool`, `ApplyDiffTool`, `EditFileTool`, etc.), they already capture:

    - `originalContent`: The file content before modification
    - `updatedContent`: The file content after modification
    - `diff`: Unified diff string showing changes
    - `diffStats`: Statistics about lines added/removed

2. **Collection Mechanism**: The `Task.updateFileChange()` method is called by tools when they modify files. This method:

    - Stores the file change in a `Map` keyed by file path
    - Preserves `originalContent` from the first modification
    - Updates `updatedContent`, `diff`, and `diffStats` with latest changes
    - Automatically notifies the webview via `notifyFileChangesChanged()`

3. **Automatic Notifications**: Whenever file changes are updated, added, or cleared, the webview is automatically notified via `postMessageToWebview()` with the current list of file changes.

## How File Changes Are Sent to Webview

File changes are sent to the webview in two ways:

### 1. Automatic Updates (Push)

When tools modify files, the `Task.updateFileChange()` method automatically calls `notifyFileChangesChanged()`, which sends:

```typescript
{
  type: "fileChanges",
  fileChanges: FileChange[]
}
```

### 2. On-Demand Requests (Pull)

When the webview explicitly requests file changes via `"getFileChanges"` message, the handler:

1. Gets the current task via `provider.getCurrentTask()`
2. Calls `task.getFileChanges()` to retrieve all file changes
3. Sends the response via `provider.postMessageToWebview()`

If no active task exists, an empty array is returned.

## Integration Points

### Tool Integration

Tools that modify files should call `task.updateFileChange()` after successfully modifying a file. Example:

```typescript
// In a file-modifying tool
await this.task.updateFileChange({
	path: relativePath,
	originalContent: originalContent,
	updatedContent: newContent,
	diff: unifiedDiff,
	diffStats: { added: 5, removed: 2 },
	isOutsideWorkspace: isOutside,
	isProtected: isProtected,
})
```

### Webview Integration

The frontend (Phase 4+) will:

1. Listen for `"fileChanges"` messages to update the file change panel
2. Send `"getFileChanges"` requests when the panel is opened or refreshed
3. Display file change summaries using the `path`, `diffStats`, and `diff` properties

## Testing Notes

- TypeScript compilation passes with `npm run check-types`
- No runtime tests added yet (to be added in future phases)
- The implementation follows the existing pattern used for other message handlers

## Next Steps (Phase 4+)

- Frontend implementation to display file changes
- Integration with tool execution to call `updateFileChange()`
- UI components for showing diff stats and file change summaries
- Tests for the file change collection and retrieval logic
