# SuperRoo Skill Modes Removal & Auto-Cleanup Migration

**Date:** 2026-04-05

## Summary

SuperRoo skill modes (21 modes) were removed from the extension defaults because they did not work well for general users. This change also adds an automatic cleanup migration so existing users who previously received the bundled SuperRoo modes are cleaned up on extension activation.

## Background

In version 3.50.16-17, 21 SuperRoo skill modes were baked directly into `DEFAULT_MODES` in `packages/types/src/mode.ts`.

At the same time, system prompt injection was being applied across every workspace through `src/core/prompts/sections/custom-instructions.ts`, including `SUPERROO_WORKSPACE_RULES` and `CONFIDENCE_ASSESSMENT_PROMPT`.

After real-world use, it became clear that this default SuperRoo experience did not work well for general users. The extension has therefore been moved back to a smaller default mode surface, while adding migration logic to automatically clean up stale SuperRoo settings for existing users.

## Changes Made

### 1. Removed 21 SuperRoo skill modes from DEFAULT_MODES (`packages/types/src/mode.ts`)

The following 21 SuperRoo skill modes were removed from `DEFAULT_MODES`:

1. `using-superpowers`
2. `test-driven-development`
3. `testing-anti-patterns`
4. `verification-before-completion`
5. `condition-based-waiting`
6. `defense-in-depth`
7. `receiving-code-review`
8. `requesting-code-review`
9. `systematic-debugging`
10. `root-cause-tracing`
11. `dispatching-parallel-agents`
12. `brainstorming`
13. `writing-plans`
14. `executing-plans`
15. `subagent-driven-development`
16. `using-git-worktrees`
17. `finishing-a-development-branch`
18. `writing-skills`
19. `testing-skills-with-subagents`
20. `sharing-skills`
21. `code-reviewer`

After the removal, 14 modes remain in `DEFAULT_MODES`:

- **5 original modes:** `architect`, `code`, `ask`, `debug`, `orchestrator`
- **9 utility modes:** `translate`, `issue-fixer`, `pr-fixer`, `merge-resolver`, `docs-extractor`, `issue-investigator`, `issue-writer`, `rooignore-generator`, `rules-generator`

### 2. Removed system prompt injection (`src/core/prompts/sections/custom-instructions.ts`)

The following SuperRoo prompt-injection identifiers were removed:

- `CONFIDENCE_ASSESSMENT_PROMPT`
- `SUPERROO_WORKSPACE_RULES`
- `SUPERROO_DEDUP_MARKER`

`loadRuleFiles()` was cleaned up so it no longer injects these SuperRoo-specific prompt fragments into every workspace.

### 3. Added auto-cleanup migration (`src/utils/migrateSettings.ts`)

A new `migrateSuperRooModes()` migration now runs on extension activation.

The migration:

- removes SuperRoo modes from `globalState` `customModes`
- removes SuperRoo prompt overrides from `globalState` `customModePrompts`
- uses a one-time migration flag so cleanup only runs once

This allows existing users to be migrated automatically without manual cleanup.

### 4. Cleaned up project files

Project cleanup was completed alongside the code changes:

- removed `.roo/rules/superroo-workspace.md`
- removed SuperRoo entries from `.roomodes`
- removed SuperRoo references from `AGENTS.md`
- removed SuperRoo references from `.roo/rules/rules.md`

## Testing

The related changes were verified with the following checks:

- 22 `migrateSettings` tests pass, including 7 new migration tests
- 37 `custom-instructions` tests pass
- TypeScript compile passes

## Files Changed

- `packages/types/src/mode.ts`
- `src/core/prompts/sections/custom-instructions.ts`
- `src/core/prompts/sections/__tests__/custom-instructions.spec.ts`
- `src/utils/migrateSettings.ts`
- `src/utils/__tests__/migrateSettings.spec.ts`
- `.roomodes`
- `.roo/rules/superroo-workspace.md` (deleted)
- `AGENTS.md`
- `.roo/rules/rules.md`

## Outcome

The extension now returns to a narrower default mode set for general users, removes globally injected SuperRoo prompt behavior, and automatically cleans up legacy SuperRoo mode data for users who had already received the previous bundled configuration.
