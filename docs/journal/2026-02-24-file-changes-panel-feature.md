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
