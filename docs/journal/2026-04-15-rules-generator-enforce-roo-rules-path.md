# Rules Generator — Enforce `.roo/rules/` Output Path

**Date:** 2026-04-15

## Summary

Updated the Rules Generator mode's `customInstructions` prompt to explicitly forbid creating legacy `.clinerules` files or any non-standard rule files (`.cursorrules`, `.windsurfrules`, etc.), ensuring all generated rules are placed exclusively in the `.roo/rules/` directory.

## Problem

The Rules Generator mode was occasionally creating `.clinerules` files (legacy format) instead of placing rule files in the `.roo/rules/` directory, which is the current standard. In some cases, it could also generate files for other AI tools (`.cursorrules`, `.windsurfrules`) that are outside the scope of this extension.

While the `fileRegex` restriction (`(^\.roo/rules/.*\.md$|^\.roo/rules/$)`) already blocks writes to unauthorized paths at the system level, the LLM prompt itself did not contain clear instructions about which paths to use. This meant the model would attempt to create files at wrong paths, get blocked by the file restriction, and potentially confuse users or waste interaction cycles.

## Solution

Added two new sections to the `customInstructions` of the `rules-generator` mode definition in [`packages/types/src/mode.ts`](packages/types/src/mode.ts):

### 1. CRITICAL FILE RULES

Explicit instructions that:

- ALL rule files MUST be created inside `.roo/rules/` directory
- Files MUST use `.md` extension
- NEVER create `.clinerules` files (legacy format, deprecated)
- NEVER create files in the project root for rules

### 2. FILE OUTPUT RESTRICTIONS

A blocklist of specific files the mode must never create:

- `.clinerules`
- `.cursorrules`
- `.windsurfrules`
- `.github/copilot-instructions.md`
- Any other AI tool configuration files

## Files Modified

- [`packages/types/src/mode.ts`](packages/types/src/mode.ts) — added CRITICAL FILE RULES and FILE OUTPUT RESTRICTIONS sections to the `rules-generator` mode's `customInstructions`

## What Was NOT Changed

- **`fileRegex`** — the existing pattern `(^\.roo/rules/.*\.md$|^\.roo/rules/$)` was already correct and did not need modification. It serves as the enforcement backstop at the system level.
- **No other mode definitions** were affected.

## Verification

- **migrateSettings tests:** 24 passed — confirmed no regression in mode migration logic
- **TypeScript compilation:** passed — no type errors introduced
- **Manual review:** confirmed the prompt additions are clear and unambiguous for the LLM

## Design Decisions

1. **Defense in depth.** Even though `fileRegex` blocks unauthorized file writes, adding explicit prompt-level instructions prevents wasted tool-use cycles where the LLM attempts a write, gets rejected, and has to retry.
2. **Blocklist approach.** Rather than only specifying allowed paths (which the prompt already does), we also explicitly list forbidden file names. LLMs respond better to both positive ("do this") and negative ("never do that") constraints.
3. **Global impact.** This change is embedded in the extension source code, so every user who installs or updates the extension will get the improved prompt. No user-side configuration needed.

---

## Phase 2: Align with Official Documentation

After the initial prompt-level enforcement (Phase 1 above), the `fileRegex` and `customInstructions` were further updated to align with the [official Roo Code custom-instructions documentation](https://docs.roocode.com/features/custom-instructions), which defines additional valid rule file locations beyond `.roo/rules/`.

### 1. `fileRegex` Update

|            | Pattern                                                                  | Coverage                                                                |
| ---------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| **Before** | `(^\.roo/rules/.*\.md$\|^\.roo/rules/$)`                                 | Only `.roo/rules/` directory and `.md` files                            |
| **After**  | `(^\.roo/rules/\|^\.roo/rules-[^/]+/\|^\.roorules$\|^\.roorules-[^/]+$)` | Workspace-wide dirs, mode-specific dirs, fallback files, all extensions |

Key differences:

- **`.roo/rules/`** — workspace-wide rule directory (unchanged)
- **`.roo/rules-{modeSlug}/`** — mode-specific rule directories (NEW)
- **`.roorules`** — workspace-wide fallback file (NEW)
- **`.roorules-{modeSlug}`** — mode-specific fallback files (NEW)
- **All file extensions** — no longer restricted to `.md` only; `.txt` is also valid per the docs

### 2. `customInstructions` Update

The prompt was revised to reflect all valid locations:

- **Added valid locations:**
    - `.roo/rules-{modeSlug}/` — mode-specific rule directories (e.g., `.roo/rules-code/`, `.roo/rules-architect/`)
    - `.roorules` — workspace-wide fallback file
    - `.roorules-{modeSlug}` — mode-specific fallback files
- **Removed `.roorules` from banned list** — it is a valid fallback location per official docs
- **Supported extensions:** both `.md` and `.txt`
- **Added examples** of mode-specific paths for clarity

### 3. Files Modified

- [`packages/types/src/mode.ts`](packages/types/src/mode.ts) — updated `fileRegex` pattern and `customInstructions` for `rules-generator` mode

### 4. Design Decisions

1. **Docs as source of truth.** The `fileRegex` and prompt were aligned to match the official documentation rather than being overly restrictive. This prevents the mode from being unable to manage valid rule file locations.
2. **Extension-agnostic.** Removing the `.md`-only restriction from `fileRegex` allows `.txt` files, which the docs explicitly support.
3. **Fallback files included.** `.roorules` and `.roorules-{modeSlug}` are legitimate locations used when the `.roo/rules/` directory structure is not present, so the mode must be able to create/edit them.

## References

- [Journal: RooIgnore & Rules Generator modes](docs/journal/2026-03-27-rooignore-rules-generator-modes.md) — original mode creation
- [Roo Code docs: Custom Instructions / Rules](https://docs.roocode.com/features/custom-instructions)
