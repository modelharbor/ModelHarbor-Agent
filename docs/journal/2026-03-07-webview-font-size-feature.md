## 2026-03-07

### Feature: Webview Font Size Adjustment

Added a new webview UI font size feature in ModelHarbor Agent so users can adjust text size for better readability.

**Feature summary:**

- Added configurable webview font size support in ModelHarbor Agent webview UI
- Users can increase/decrease font size from **8px to 28px** (**default: 13px**)
- Added **A-** (decrease), **A+** (increase), and **Reset** (restore default) controls
- Setting is available in **Settings > UI Settings**

### Backend Changes

- Added `webviewFontSize` to `globalSettingsSchema` in `packages/types/src/global-settings.ts`
    - Type: `number`
    - Min: `8`
    - Max: `28`
    - Default: `13`
- Updated `ExtensionState` type in `packages/types/src/vscode-extension-host.ts`
- Updated `ClineProvider.getStateToPostToWebview()` in `src/core/webview/ClineProvider.ts`
- Persistence is handled automatically via `ContextProxy` globalState
- Saving uses the existing `updateSettings` webview message handler

### Frontend Changes

- `webview-ui/src/App.tsx`
    - Applies `--webview-font-size` CSS custom property from extension state
- `webview-ui/src/index.css`
    - Uses `font-size: var(--webview-font-size, 13px)` at root/body level
- `webview-ui/src/components/settings/UISettings.tsx`
    - Added font size controls (**A- / A+ / Reset**) using cachedState pattern
- `webview-ui/src/components/settings/SettingsView.tsx`
    - Passes font size through the existing cached settings save flow
- `webview-ui/src/i18n/locales/en/settings.json`
    - Added English i18n keys for font size setting
- `webview-ui/src/i18n/locales/th/settings.json`
    - Added Thai i18n keys for font size setting

### Tests

- `packages/types/src/__tests__/index.test.ts`
    - Added schema validation tests for `webviewFontSize` boundaries/default
- `src/core/webview/__tests__/ClineProvider.spec.ts`
    - Added state management tests for webview font size propagation
- `webview-ui/src/components/settings/__tests__/UISettings.spec.tsx`
    - Added UI control tests:
        - increase
        - decrease
        - min guard
        - max guard
        - reset
        - value display
- `webview-ui/src/__tests__/App.spec.tsx`
    - Added test for CSS variable application in app root

### Architecture Notes

- Uses CSS custom property `--webview-font-size` applied at the root level
- Font size is persisted via VSCode globalState
- Settings UI follows the `cachedState` buffer pattern from AGENTS guidance
- New UI markup follows Tailwind CSS styling guidelines

---

## 2026-03-07 (Addendum)

### Fix: Runtime CSS Variable Binding

After the initial feature implementation, the font size setting was not actually taking effect in the webview. The controls worked and the value was persisted, but the visible text size never changed.

#### Root Cause

The feature had complete setting + persistence support, but was missing the **runtime binding** — the CSS variable `--webview-font-size` was declared in CSS but no JavaScript code was setting this variable on the DOM when the state changed. Additionally:

1. **No runtime CSS variable setter** — `--webview-font-size` was referenced in `index.css` but never written to `document.documentElement.style` from React when the user changed the setting.
2. **Tailwind text tokens referenced wrong variable** — The `--text-xs/sm/base/lg` tokens in `@theme` were originally computed from `--vscode-font-size` (the VS Code editor font size), which is not controlled by the user's webview font size setting.
3. **Hardcoded font sizes in components** — Several components used inline `style={{ fontSize: "..." }}` instead of Tailwind text classes, bypassing the CSS variable system entirely.

#### Files Modified

| File                                                                                              | Change                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`App.tsx`](webview-ui/src/App.tsx:197)                                                           | Added `useEffect` that sets `document.documentElement.style.setProperty('--webview-font-size', ...)` whenever `webviewFontSize` state changes. Falls back to `13px` when undefined.                             |
| [`BrowserSessionPanel.tsx`](webview-ui/src/components/browser-session/BrowserSessionPanel.tsx:24) | Added identical `useEffect` for the browser session panel (separate webview entry point with its own React tree).                                                                                               |
| [`index.css`](webview-ui/src/index.css:28)                                                        | Changed `--text-xs/sm/base/lg` theme tokens from `calc(var(--vscode-font-size) * ...)` to `calc(var(--webview-font-size, 13px) * ...)`, ensuring all Tailwind text classes respect the user-configurable value. |
| `webview-ui/src/components/skills/SkillsView.tsx`                                                 | Replaced inline `style={{ fontSize }}` with Tailwind `text-xs`/`text-sm` classes.                                                                                                                               |
| `webview-ui/src/components/mcp/McpView.tsx`                                                       | Replaced hardcoded font-size inline styles with Tailwind text classes.                                                                                                                                          |
| `webview-ui/src/components/mcp/McpResourceRow.tsx`                                                | Replaced hardcoded font-size inline styles with Tailwind text classes.                                                                                                                                          |
| `webview-ui/src/components/mcp/McpEnabledToggle.tsx`                                              | Replaced hardcoded font-size inline styles with Tailwind text classes.                                                                                                                                          |
| `webview-ui/src/components/chat/BrowserSessionRow.tsx`                                            | Replaced hardcoded font-size inline styles with Tailwind text classes.                                                                                                                                          |

#### Tests Added

Three new test cases in [`App.spec.tsx`](webview-ui/src/__tests__/App.spec.tsx:297) under `"Webview font size CSS variable binding"`:

1. **Sets `--webview-font-size` to the provided value** — Verifies that when `webviewFontSize` is `16`, the CSS variable is set to `"16px"`.
2. **Falls back to 13px when undefined** — Verifies default behavior when no font size is configured.
3. **Updates on state change** — Verifies that re-rendering with a new `webviewFontSize` value updates the CSS variable accordingly.

#### Test Results

All tests pass:

- `App.spec.tsx`: 12 passed, 1 skipped
- `UISettings.spec.tsx`: 9 passed
- `ClineProvider.spec.ts`: 88 passed, 6 skipped

#### Known Limitations

Some components still use hardcoded font sizes that were intentionally left unchanged because they already use relative units (`em`, `smaller`, percentage) or reference `--vscode-editor-font-family` for code blocks:

- `ChatRow.tsx` — uses relative `em`-based sizing
- `ContextMenu.tsx` — uses relative sizing
- `FollowUpSuggest.tsx` — uses relative sizing

These components will still scale proportionally with the base font size change and do not need conversion.

---

## 2026-03-07 (Phase 2)

### Fix: Chat Markdown Font Size Consistency

After Phase 1 (runtime CSS variable binding), users reported that **chat markdown content** — the main conversation area — was not respecting the webview font size setting. Headings, paragraphs, code blocks, and other markdown-rendered elements remained at the VS Code default size regardless of the user's configured font size.

#### Root Cause

The primary culprit was [`MarkdownBlock.tsx`](webview-ui/src/components/chat/markdown/MarkdownBlock.tsx:86), which applied an explicit `font-size: var(--vscode-font-size, 13px)` on its container `<div>`. This override prevented the `--webview-font-size` value set on `<body>` from cascading into markdown content. Several other components in [`ChatRow.tsx`](webview-ui/src/components/chat/ChatRow.tsx) and [`index.css`](webview-ui/src/index.css:371) had similar `--vscode-font-size` references that also bypassed the user-configurable variable.

#### Files Modified

| File                                                                                        | Change                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`MarkdownBlock.tsx`](webview-ui/src/components/chat/markdown/MarkdownBlock.tsx:86)         | Changed `font-size: var(--vscode-font-size, 13px)` → `var(--webview-font-size, 13px)` on the markdown container div. This was the **primary fix** — all markdown-rendered chat content now inherits the user's font size setting. |
| [`ChatRow.tsx`](webview-ui/src/components/chat/ChatRow.tsx)                                 | Replaced `var(--vscode-font-size)` → `var(--webview-font-size, 13px)` across **9 locations**: cost badge, slash command text, task description, context window badge, and other inline-styled elements.                           |
| [`UpdateTodoListToolBlock.tsx`](webview-ui/src/components/chat/UpdateTodoListToolBlock.tsx) | Converted hardcoded `fontSize` pixel values to Tailwind classes (`text-sm`, `text-lg`) or removed them entirely so elements inherit the base font size.                                                                           |
| [`index.css`](webview-ui/src/index.css:371)                                                 | Changed dropdown label rule from `var(--vscode-font-size)` → `var(--webview-font-size, 13px)`.                                                                                                                                    |

#### Key Distinction: `--vscode-font-size` vs `--webview-font-size`

- **`--vscode-font-size`** — Set by the VS Code host; reflects the _editor_ font size (`editor.fontSize`). Not controllable by the webview extension.
- **`--webview-font-size`** — Set by our `useEffect` in `App.tsx`; reflects the _user's webview font size setting_. This is the variable all webview components should reference.

Components that were using `--vscode-font-size` as an explicit override were effectively "pinning" their font size to the editor setting, ignoring the webview font size preference entirely.

#### Test Results

All existing tests continue to pass with no regressions:

- `App.spec.tsx`: 12 passed, 1 skipped
- `UISettings.spec.tsx`: 9 passed
- `ClineProvider.spec.ts`: 88 passed, 6 skipped

#### Known Remaining Hardcoded Font Sizes (Intentionally Unchanged)

| Pattern                                   | Reason                                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Icon sizes (`codicon` width/height in px) | Fixed-size icons should not scale with text font size                                                     |
| `ContextMenu.tsx` em-based units          | Already relative — scales proportionally with base font                                                   |
| `FollowUpSuggest.tsx` relative sizing     | Already relative — scales proportionally with base font                                                   |
| `ChatRow.tsx` em-based cost/token badges  | Already converted to `--webview-font-size` in this phase; remaining `em` units are intentionally relative |
