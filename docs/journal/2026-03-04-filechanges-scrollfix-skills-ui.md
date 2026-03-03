## 2026-03-04

### FileChangesPanel Scrollability Fix

**Problem:** When many files were changed during a conversation, the expanded FileChangesPanel pushed the ChatTextArea (chat input) out of view. The file list had no height constraint, so it could grow indefinitely within the chat view layout.

**Fix:** Added `max-h-[40vh] overflow-y-auto` to the file list container inside `CollapsibleContent` in `webview-ui/src/components/chat/FileChangesPanel.tsx`. This caps the file list at 40% of the viewport height and makes it independently scrollable when there are too many entries.

**Files changed:**

- [`FileChangesPanel.tsx`](webview-ui/src/components/chat/FileChangesPanel.tsx) — Added scrollable classes to the file list container
- [`FileChangesPanel.spec.tsx`](webview-ui/src/__tests__/FileChangesPanel.spec.tsx) — Added test verifying scrollable classes are present

**Commit:** `fix: make FileChangesPanel scrollable when many files are changed`

---

### Skills Management UI Feature

A complete Skills Management UI was built to allow users to view, create, and delete skills (`SKILL.md` files) from the settings view. Skills are markdown-based instruction files that can be scoped to a project or applied globally.

#### Shared Types

- [`packages/types/src/skills.ts`](packages/types/src/skills.ts) — Added `SkillMetadata` and `SkillContent` types defining the shape of skill data
- [`packages/types/src/vscode-extension-host.ts`](packages/types/src/vscode-extension-host.ts) — Added 7 `WebviewMessage` types (`requestSkills`, `refreshSkills`, `getSkillContent`, `createSkill`, `deleteSkill`, `openSkillFile`, `openSkillsDirectory`) and 2 `ExtensionMessage` types (`skillsList`, `skillContent`) for the skills CRUD communication protocol

#### Backend

- [`src/services/skills/SkillsManager.ts`](src/services/skills/SkillsManager.ts) — Added `createSkill()`, `deleteSkill()`, and `openSkillFile()` methods to the existing SkillsManager. The SkillsManager instance is now cached in ClineProvider for reuse.
- [`src/services/skills/__tests__/SkillsManager.spec.ts`](src/services/skills/__tests__/SkillsManager.spec.ts) — Tests for the new CRUD operations

#### Message Handlers

- [`src/core/webview/webviewMessageHandler.ts`](src/core/webview/webviewMessageHandler.ts) — Added 6 message handlers: `requestSkills`, `refreshSkills`, `getSkillContent`, `createSkill`, `deleteSkill`, `openSkillFile`, and `openSkillsDirectory`

#### UI State

- [`webview-ui/src/context/ExtensionStateContext.tsx`](webview-ui/src/context/ExtensionStateContext.tsx) — Added `skills` and `skillContent` state fields with corresponding message handlers for `skillsList` and `skillContent` messages

#### UI Component

- [`webview-ui/src/components/skills/SkillsView.tsx`](webview-ui/src/components/skills/SkillsView.tsx) — Full skills management UI featuring:
    - Header with action buttons (Refresh, Open Folder, New Skill)
    - Skills list grouped by source (Project / Global)
    - Expandable rows showing skill content with markdown preview
    - Delete confirmation dialog
    - Create skill dialog with name input and project/global scope selection

#### Settings Integration

- [`webview-ui/src/components/settings/SettingsView.tsx`](webview-ui/src/components/settings/SettingsView.tsx) — Added "skills" tab with Sparkles icon, positioned after the "mcp" tab

#### Tests

- 26+ new tests across `ExtensionStateContext` and `SkillsView` covering state management, rendering, user interactions, and edge cases

**Commits:**

1. Shared types for skills CRUD
2. Backend skills CRUD + message handlers
3. Skills Management UI + settings integration

---
