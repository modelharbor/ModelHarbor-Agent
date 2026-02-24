## 2026-02-24

### Feature: "File(s) Changed in This Conversation" Panel (upstream v3.50.3 sync)

Implemented the missing backend support for the "file(s) changed in this conversation" feature from upstream v3.50.3. This feature shows a collapsible panel above the chat text input that displays how many files and how many lines (+added/-removed) have changed during a conversation.

**Changes:**

#### Type Definitions (`packages/types/src/vscode-extension-host.ts`)

- Added `originalContent?: string` to `ClineSayTool` interface — enables the UI to compute merged file change statistics
- Updated `ExtensionMessage.fileContent` type from `{ path: string; content?: string }` to `{ path: string; content: string | null; error?: string }` — matches upstream for proper error propagation

#### Backend (`src/core/tools/ApplyDiffTool.ts`)

- Added `originalContent` to the `completeMessage` JSON payload in both the `isPreventFocusDisruptionEnabled` branch and the standard diff view branch

#### Webview Message Handler (`src/core/webview/webviewMessageHandler.ts`)

- Hardened the `readFileContent` handler with workspace-boundary validation:
    - Empty path check
    - `getCurrentCwd()` null check
    - Workspace boundary validation via `isPathOutsideWorkspace()`
    - Sends `content: null` with `error` field on all error paths

#### Tests Added

- `webview-ui/src/__tests__/FileChangesPanel.spec.tsx` — 10 tests for the FileChangesPanel component
- `webview-ui/src/__tests__/fileChangesFromMessages.spec.ts` — 17 tests for the fileChangesFromMessages utility

**Pre-existing (no changes needed):**

- `webview-ui/src/components/chat/FileChangesPanel.tsx` — UI component already present
- `webview-ui/src/components/chat/utils/fileChangesFromMessages.ts` — Utility function already present
- `webview-ui/src/i18n/locales/en/chat.json` — i18n strings already present
- `webview-ui/src/components/chat/ChatView.tsx` — Already imports and renders `FileChangesPanel`

**Test Results:** All 27 new tests pass (0 failures)

---

## 2026-02-24 (Later): File Change Panel Visibility Fix

### Issue

The file change panel was not visible in ChatView. The worktree selection should always be visible, and the file change panel should show above it when files are modified.

### Fix

Updated the ChatView component to ensure proper visibility of both the worktree selection and the file change panel. The file change panel now correctly displays above the worktree selection when there are modified files in the conversation.

### Settings Sync Verification

Compared local settings with upstream v3.50.3 and confirmed they are in sync. No additional settings changes were required.

### Test Updates

Updated existing tests to reflect the visibility changes and ensure the file change panel renders correctly when files are modified.

---

## 2026-02-24 (Latest): File Change Panel Data Flow Fix

### Root Cause

The file change panel was not populating because **two independent data paths were broken**:

1. **Message fallback path blocked by `isAnswered` check** — `fileChangesFromMessages.ts` filters for `tool_use`/`ask` messages to extract file changes. However, the `isAnswered` guard rejected all `tool_ask` messages that hadn't been explicitly answered yet, which meant in-progress and recent tool calls never surfaced their file change data.

2. **Backend path never populated** — `Task.updateFileChange()` existed but was never called from any tool implementation. The backend was supposed to track file changes via this method, but none of the file-modifying tools (`write_to_file`, `apply_diff`, `search_and_replace`, etc.) invoked it.

### Fix 1: `fileChangesFromMessages.ts` — Relaxed `isAnswered` check

Changed the `isAnswered` logic so that only the **last message** in the conversation is treated as potentially unanswered. All prior messages are treated as answered (since a subsequent message implies the tool completed). This allows the message-based fallback path to correctly extract file change data from completed tool calls.

### Fix 2: Wired `updateFileChange()` into tool implementations

Called `Task.updateFileChange()` from six file-modifying tool implementations so the backend actively tracks file changes:

- `WriteToFileTool` — called after successful file write
- `ApplyDiffTool` — called after successful diff application
- `SearchAndReplaceTool` — called after successful search-and-replace
- `SearchReplaceTool` — called after successful search/replace operation
- `ApplyPatchTool` — called after successful patch application
- `MultiApplyDiffTool` — called after successful multi-file diff application

### Test Results

- **325 backend tests** passing (0 failures)
- **297 webview-ui tests** passing (0 failures)

---
