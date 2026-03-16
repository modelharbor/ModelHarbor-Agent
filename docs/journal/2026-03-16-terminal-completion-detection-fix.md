# Terminal Execution Completion Detection Fix

**Date:** 2026-03-16
**Author:** ModelHarbor Agent

## Summary

Fixed three issues causing terminal commands to finish executing but the system failing to detect completion, resulting in indefinite hangs. This was especially problematic in Super YOLO mode where the 5-minute timeout was the only safety net.

## Problem

Users reported that terminal commands would finish executing, but the system would not detect completion and hang/wait indefinitely. The `TerminalProcess.run()` method would block forever at `await shellExecutionComplete`, never proceeding to return the command output.

## Root Cause Analysis

Three separate issues contributed to this bug:

### Issue 1: Race Condition in TerminalRegistry.ts

In the `onDidEndTerminalShellExecution` handler (`src/integrations/terminal/TerminalRegistry.ts` ~lines 97-104), when `!terminal.running` was true (terminal already marked as not running), the function returned early **without** calling `terminal.shellExecutionComplete()`. This meant the `shell_execution_complete` event was never emitted, and `TerminalProcess.run()` hung forever waiting for it.

```
1. Command finishes executing
2. onDidEndTerminalShellExecution fires
3. terminal.running is already false (race condition)
4. Handler returns early — shellExecutionComplete() never called
5. TerminalProcess.run() waits forever at `await shellExecutionComplete`
```

### Issue 2: No Timeout on await shellExecutionComplete in TerminalProcess.ts

In `src/integrations/terminal/TerminalProcess.ts` (~line 204), `await shellExecutionComplete` had **no timeout**. If the VSCode `onDidEndTerminalShellExecution` event never fired (due to Issue 1 or any other reason), this promise waited forever with no fallback.

### Issue 3: Execa Provider Stream Hang on Windows

In `src/integrations/terminal/ExecaTerminalProcess.ts`, the `for await (const chunk of stream)` loop could hang if the child process's stdout stream didn't close on Windows (e.g., when a subprocess inherits pipes). The `continue` event was only emitted after the loop ended, creating a deadlock where the loop never terminates and the event never fires.

## Solution

### Fix 1: Always call shellExecutionComplete()

Changed the `onDidEndTerminalShellExecution` handler to always call `terminal.shellExecutionComplete()` even when `!terminal.running`. Instead of returning early with an error log, it now logs a warning and proceeds to call `shellExecutionComplete()`.

### Fix 2: Add 15-second timeout on shellExecutionComplete

Wrapped `await shellExecutionComplete` with `Promise.race` and a 15-second timeout. After the output stream ends, if `shellExecutionComplete` doesn't resolve within 15 seconds, the system assumes completion and proceeds.

### Fix 3: Force-destroy stream after process exit

Added a listener on the child process `exit` event with a 5-second grace period. If the stdout stream hasn't ended within 5 seconds after the process exits, the stream is force-destroyed to break the `for await` loop.

## Files Changed

| File                                                | Change                                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/integrations/terminal/TerminalRegistry.ts`     | Fixed race condition: always call `shellExecutionComplete()` even when `!terminal.running` |
| `src/integrations/terminal/TerminalProcess.ts`      | Added `Promise.race` with 15-second timeout on `await shellExecutionComplete`              |
| `src/integrations/terminal/ExecaTerminalProcess.ts` | Added process `exit` listener with 5-second grace period to force-destroy hung streams     |

## Tests Added

| File                                                               | Tests | Description                                                                           |
| ------------------------------------------------------------------ | ----- | ------------------------------------------------------------------------------------- |
| `src/integrations/terminal/__tests__/TerminalRegistry.spec.ts`     | —     | Tests that `shellExecutionComplete()` is called even when `terminal.running` is false |
| `src/integrations/terminal/__tests__/TerminalProcess.spec.ts`      | —     | Tests for 15-second timeout on `shellExecutionComplete` via `Promise.race`            |
| `src/integrations/terminal/__tests__/ExecaTerminalProcess.spec.ts` | —     | Tests for stream force-destroy after process exit + 5-second grace period             |

All 34 tests passed with 0 failures.

## Impact

- Terminal commands that previously caused indefinite hangs now complete reliably
- Super YOLO mode no longer depends solely on the 5-minute timeout as a safety net for stuck commands
- Windows users benefit from the Execa stream hang fix, which addresses a platform-specific edge case with inherited pipes
- The 15-second timeout provides a safety net for any future edge cases where VSCode events fail to fire

## Related Fixes

- [Super YOLO Allowlist Bypass Fix](2026-03-16-super-yolo-allowlist-bypass-fix.md) — Companion fix discovered during the same investigation. The super YOLO mode was overriding `commandExecutionTimeout` for allowlisted commands (like `npm install`), resetting their intentional `timeout = 0` to `300000ms` (5 minutes). This caused long-running install commands to be SIGKILL'd after 5 minutes. The fix guards the super YOLO timeout override with `!isCommandAllowlisted` and expands the allowlist with 11 missing package manager prefixes.
