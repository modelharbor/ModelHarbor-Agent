# SuperRoo Modes in DEFAULT_MODES

**Date:** 2026-03-23

## Summary

Added 28 SuperRoo and utility modes directly into `DEFAULT_MODES` in `packages/types/src/mode.ts`, so every user who installs the extension gets all 33 modes (5 original + 28 new) out of the box.

## Problem

The 28 custom modes (including all SuperRoo skill-modes) lived exclusively in `.roomodes`, which is a workspace-level config file. Users who installed the extension from the marketplace only received the 5 built-in modes (code, architect, ask, debug, orchestrator). The full SuperRoo experience required either cloning this repository or manually copying `.roomodes` content.

## Approaches Tried

### BUNDLED_MODES constant (reverted)

An intermediate approach created a separate `BUNDLED_MODES` constant in its own file and introduced merge logic to combine bundled modes with default modes. This was reverted because it added unnecessary complexity — a new file, new imports, and new merge behavior — for something that could be solved more simply.

### Direct addition to DEFAULT_MODES (final)

The final approach adds all 28 mode entries directly into the existing `DEFAULT_MODES` array in `packages/types/src/mode.ts`. No new files, no new constants, no merge logic changes. The simplest possible solution.

## Result

Every installation of the extension now ships with **33 modes**:

- **5 original:** code, architect, ask, debug, orchestrator
- **28 added:** translate, issue-fixer, pr-fixer, merge-resolver, docs-extractor, issue-investigator, issue-writer, using-superpowers, test-driven-development, testing-anti-patterns, verification-before-completion, condition-based-waiting, defense-in-depth, receiving-code-review, requesting-code-review, systematic-debugging, root-cause-tracing, dispatching-parallel-agents, brainstorming, writing-plans, executing-plans, subagent-driven-development, using-git-worktrees, finishing-a-development-branch, writing-skills, testing-skills-with-subagents, sharing-skills, code-reviewer

## Files Modified

- `packages/types/src/mode.ts` — added 28 entries to the `DEFAULT_MODES` array

## Tests

- `modes.spec.ts` — 41/41 passed
- `CustomModesManager.spec.ts` — 48/48 passed

## Why This Matters

SuperRoo skill-modes enforce development discipline (TDD, systematic debugging, code review, etc.). Making them available by default means every user benefits from structured workflows without any additional configuration.

---

## Confidence % Assessment — Global Injection

**Date:** 2026-03-24

### Summary

- เดิม: Confidence % prompt (บังคับให้ agent เริ่ม response ด้วย `**Confidence: X%**`) เป็น **fallback เท่านั้น** — ทำงานเฉพาะ workspace ที่ไม่มี `.roo/rules/`
- ปัญหา: workspace ที่มี `.roo/rules/` (เช่น โปรเจคนี้) จะไม่ได้ Confidence % prompt
- แก้ไข: แยก `CONFIDENCE_ASSESSMENT_PROMPT` เป็น exported constant แล้ว inject ต่อท้าย rule files ทุกเส้นทาง

### Files Modified

- `src/core/prompts/sections/custom-instructions.ts` — เพิ่ม `CONFIDENCE_ASSESSMENT_PROMPT` constant + inject ใน `loadRuleFiles()`
- `src/core/prompts/sections/__tests__/custom-instructions.spec.ts` — อัปเดต 6 tests

### Logic 3 เส้นทาง

| Path | เงื่อนไข                         | ผลลัพธ์                                                  |
| ---- | -------------------------------- | -------------------------------------------------------- |
| 1    | `.roo/rules/` มีไฟล์             | rules + Confidence %                                     |
| 2    | Legacy `.roorules`/`.clinerules` | rules + Confidence %                                     |
| 3    | ไม่มี rules เลย                  | `customInstructions` fallback (มี Confidence % อยู่แล้ว) |

### Tests

- `custom-instructions.spec.ts` — 43 passed
- `sections.spec.ts` — 17 passed
- `custom-instructions-global.spec.ts` — 7 passed
- `add-custom-instructions.spec.ts` — 19 passed
- **Total: 86 passed**

---

## SuperRoo Workspace Rules — Global Injection

**Date:** 2026-03-24

### Summary

- เดิม: SuperRoo workspace rules อยู่ใน `.roo/rules/superroo-workspace.md` ซึ่งเป็น project-level config — ผู้ใช้คนอื่นจะไม่ได้ rules เหล่านี้
- แก้ไข: เพิ่ม `SUPERROO_WORKSPACE_RULES` constant + inject เข้า `loadRuleFiles()` เหมือน Confidence %
- Dedup: ใช้ `SUPERROO_DEDUP_MARKER` ตรวจว่า content มีอยู่แล้วหรือไม่ → ป้องกัน inject ซ้ำ

### Files Modified

- `src/core/prompts/sections/custom-instructions.ts` — เพิ่ม `SUPERROO_WORKSPACE_RULES`, `SUPERROO_DEDUP_MARKER` constants + inject ใน `loadRuleFiles()` 3 paths
- `src/core/prompts/sections/__tests__/custom-instructions.spec.ts` — อัปเดต assertions + เพิ่ม dedup test

### Logic 3 เส้นทาง

| Path | เงื่อนไข                         | ผลลัพธ์                                                       |
| ---- | -------------------------------- | ------------------------------------------------------------- |
| 1    | `.roo/rules/` มีไฟล์             | rules + Confidence % + SuperRoo rules (deduped)               |
| 2    | Legacy `.roorules`/`.clinerules` | rules + Confidence % + SuperRoo rules                         |
| 3    | ไม่มี rules เลย                  | `customInstructions` fallback + Confidence % + SuperRoo rules |

### Tests

- `custom-instructions.spec.ts` — 37 passed
- `custom-instructions-global.spec.ts` — 7 passed
- **Total: 44 passed**
