# File Change Panel - Phase 2: Backend Tool Modifications

**Date:** 2026-02-24  
**Author:** Roo  
**Phase:** 2 of 4+

## Overview

This document describes Phase 2 of the File Change Panel implementation. This phase involved examining and verifying the backend tool implementations (`ApplyDiffTool` and `EditFileTool`) to ensure they capture file change data with diff statistics.

## Key Finding

**The local tool implementations already include the diff stats functionality.** No modifications were required. The tools were already updated to capture `originalContent` and compute `diffStats` using the `computeDiffStats` utility from `src/core/diff/stats.ts`.

## Files Examined

### 1. `src/core/tools/ApplyDiffTool.ts`

**Status:** Already implements file change tracking with diff stats.

**Key Implementation Details:**

1. **Imports** (line 13):

    ```typescript
    import { computeDiffStats, sanitizeUnifiedDiff } from "../diff/stats"
    ```

2. **Capturing Original Content** (line 77):

    ```typescript
    const originalContent: string = await fs.readFile(absolutePath, "utf-8")
    ```

3. **Computing Diff Stats** (lines 129-131):

    ```typescript
    const unifiedPatchRaw = formatResponse.createPrettyPatch(relPath, originalContent, diffResult.content)
    const unifiedPatch = sanitizeUnifiedDiff(unifiedPatchRaw)
    const diffStats = computeDiffStats(unifiedPatch) || undefined
    ```

4. **Including File Change Data in Response** (lines 154-161, 199-206):
    ```typescript
    const completeMessage = JSON.stringify({
    	...sharedMessageProps,
    	diff: diffContent,
    	content: unifiedPatch,
    	originalContent, // Captured original content
    	diffStats, // Computed diff statistics
    	isProtected: isWriteProtected,
    } satisfies ClineSayTool)
    ```

**Data Flow:**

1. Read original file content before applying diff
2. Apply the diff transformation
3. Generate unified diff patch from original and updated content
4. Compute diff stats (added/removed line counts) from the unified diff
5. Include `originalContent` and `diffStats` in the `ClineSayTool` message sent to the webview

### 2. `src/core/tools/EditFileTool.ts`

**Status:** Already implements file change tracking with diff stats.

**Key Implementation Details:**

1. **Imports** (line 13):

    ```typescript
    import { sanitizeUnifiedDiff, computeDiffStats } from "../diff/stats"
    ```

2. **Capturing Original Content** (lines 244-248):

    ```typescript
    currentContent = await fs.readFile(absolutePath, "utf8")
    originalEol = detectLineEnding(currentContent)
    currentContentLF = normalizeToLF(currentContent)
    ```

3. **Computing Diff Stats** (lines 391, 411-412):

    ```typescript
    const diff = formatResponse.createPrettyPatch(relPath, currentContent || "", newContent)
    const sanitizedDiff = sanitizeUnifiedDiff(diff || "")
    const diffStats = computeDiffStats(sanitizedDiff) || undefined
    ```

4. **Including File Change Data in Response** (lines 415-427):

    ```typescript
    const sharedMessageProps: ClineSayTool = {
    	tool: isNewFile ? "newFileCreated" : "appliedDiff",
    	path: getReadablePath(task.cwd, relPath),
    	diff: sanitizedDiff,
    	isOutsideWorkspace,
    }

    const completeMessage = JSON.stringify({
    	...sharedMessageProps,
    	content: sanitizedDiff,
    	isProtected: isWriteProtected,
    	diffStats, // Computed diff statistics
    } satisfies ClineSayTool)
    ```

**Data Flow:**

1. Read current file content before modification
2. Apply the string replacement operation
3. Generate unified diff patch from original and new content
4. Compute diff stats from the sanitized unified diff
5. Include `diffStats` in the `ClineSayTool` message sent to the webview

## Diff Stats Computation

The `computeDiffStats` utility function is located in `src/core/diff/stats.ts`:

```typescript
export function computeDiffStats(diff?: string): DiffStats | null {
	if (!diff) return null
	return computeUnifiedDiffStats(diff)
}

export function computeUnifiedDiffStats(diff?: string): DiffStats | null {
	if (!diff) return null

	try {
		const patches = parsePatch(diff)
		if (!patches || patches.length === 0) return null

		let added = 0
		let removed = 0

		for (const p of patches) {
			for (const h of (p as any).hunks ?? []) {
				for (const l of h.lines ?? []) {
					const ch = (l as string)[0]
					if (ch === "+") added++
					else if (ch === "-") removed++
				}
			}
		}

		if (added > 0 || removed > 0) return { added, removed }
		return { added: 0, removed: 0 }
	} catch {
		return null
	}
}
```

**How it works:**

1. Parses the unified diff string using the `diff` library's `parsePatch` function
2. Iterates through all hunks and lines in the patch
3. Counts lines starting with `+` (additions) and `-` (deletions)
4. Returns a `DiffStats` object with `{ added, removed }` counts
5. Returns `null` if parsing fails or the diff is empty

## TypeScript Verification

All code compiles without errors:

```bash
cd src && npx tsc --noEmit
# Result: ✓ Success (no errors)
```

## Summary of Findings

| Tool            | Captures `originalContent` | Computes `diffStats` | Includes in Response            |
| --------------- | -------------------------- | -------------------- | ------------------------------- |
| `ApplyDiffTool` | ✅ Yes (line 77)           | ✅ Yes (line 131)    | ✅ Yes (lines 158-159, 203-204) |
| `EditFileTool`  | ✅ Yes (line 245)          | ✅ Yes (line 412)    | ✅ Yes (line 426)               |

## No Modifications Required

Upon examination, the local ModelHarbor-Agent codebase already had the Phase 2 changes implemented. The tools were already modified to:

1. Import the `DiffStats` type and `computeDiffStats` utility
2. Capture `originalContent` before file modifications
3. Compute `diffStats` using the utility function
4. Include file change data in the tool response messages

## Prerequisites for Next Phase

### Phase 3: Backend Message Handling

The following will be needed:

1. **Message handler** - Handle `"fileChanges"` message type in extension host
2. **File change tracking** - Collect `FileChange` records from tool responses
3. **WebSocket/IPC updates** - Send file change updates to webview when files are modified
4. **State persistence** - Store file changes for the current conversation

### Phase 4: Frontend Implementation

1. **FileChangePanel component** - New React component to display file changes
2. **ChatView integration** - Position panel above chat input
3. **State management** - Subscribe to file change updates from extension

## Next Steps

Proceed to Phase 3: Implement backend message handling to collect file changes from tool responses and send them to the webview for display.
