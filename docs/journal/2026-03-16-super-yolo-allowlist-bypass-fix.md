# Super YOLO Allowlist Bypass Fix

**Date:** 2026-03-16
**Author:** ModelHarbor Agent

## Summary

Fixed a bug where super YOLO mode overrode the `commandExecutionTimeout` for allowlisted commands (like `npm install`, `pip install`), causing long-running install commands to be SIGKILL'd after 5 minutes. Also expanded the command timeout allowlist with 11 missing package manager prefixes.

## Problem

In super YOLO mode, allowlisted commands such as `npm install` and `pip install` were being killed after 5 minutes (`300000ms`). These commands are explicitly placed in the `commandTimeoutAllowlist` with `timeout = 0` (no timeout) because package installation can legitimately take longer than 5 minutes. Despite this, the super YOLO timeout override was resetting their timeout to `300000ms`.

## Root Cause

In `src/core/tools/ExecuteCommandTool.ts` at line 99, the condition `if (superYoloMode)` applied the timeout override to **all** commands, including those already matched by the allowlist. The execution flow was:

```
1. Command "npm install" matches allowlist
   → timeout set to 0 (no timeout)

2. Super YOLO block checks: if (superYoloMode)
   → Always true in super YOLO mode

3. Inside the block: if (commandExecutionTimeout === 0)
   → True, because allowlist just set it to 0

4. Timeout overridden to 300000ms (5 minutes)
   → npm install now gets killed after 5 minutes
```

The condition `commandExecutionTimeout === 0` was intended to catch commands with no configured timeout and give them a reasonable default. But it also matched the allowlist's intentional `timeout = 0`, creating a conflict.

## Solution

### Fix 1: Guard the super YOLO override with allowlist check

Changed the condition in [`ExecuteCommandTool.ts`](src/core/tools/ExecuteCommandTool.ts:99) from:

```typescript
if (superYoloMode)
```

to:

```typescript
if (superYoloMode && !isCommandAllowlisted)
```

This ensures allowlisted commands keep their `timeout = 0` even in super YOLO mode. The super YOLO timeout override only applies to commands that were **not** matched by the allowlist.

### Fix 2: Expand the command timeout allowlist

Added 11 missing package manager prefixes to the `commandTimeoutAllowlist` in [`src/package.json`](src/package.json):

| New prefix         | Package manager |
| ------------------ | --------------- |
| `bun install`      | Bun             |
| `bun add`          | Bun             |
| `uv install`       | uv (Python)     |
| `uv pip install`   | uv pip          |
| `uv pip sync`      | uv pip          |
| `uv sync`          | uv              |
| `uv add`           | uv              |
| `conda install`    | Conda           |
| `gem install`      | RubyGems        |
| `composer install` | Composer (PHP)  |
| `composer update`  | Composer (PHP)  |

## Files Changed

| File                                   | Change                                                                                   |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/core/tools/ExecuteCommandTool.ts` | Changed `if (superYoloMode)` to `if (superYoloMode && !isCommandAllowlisted)` at line 99 |
| `src/package.json`                     | Added 11 missing package manager prefixes to `commandTimeoutAllowlist`                   |

## Tests

| File                                                       | Tests | Description                                                             |
| ---------------------------------------------------------- | ----- | ----------------------------------------------------------------------- |
| `src/core/tools/__tests__/ExecuteCommandTool.spec.ts`      | —     | Tests that allowlisted commands retain `timeout = 0` in super YOLO mode |
| `src/core/tools/__tests__/commandTimeoutAllowlist.spec.ts` | —     | Tests all allowlist entries match expected commands                     |

All 38 tests across 3 files passed with 0 failures.

## Impact

- Allowlisted package manager commands (`npm install`, `pip install`, `yarn add`, etc.) no longer get killed after 5 minutes in super YOLO mode
- 11 additional package managers are now covered by the allowlist, preventing timeout issues for `bun`, `uv`, `conda`, `gem`, and `composer` commands
- Non-allowlisted commands in super YOLO mode are unaffected and still receive the 5-minute timeout as before
