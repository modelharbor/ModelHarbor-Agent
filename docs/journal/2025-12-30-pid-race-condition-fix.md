# PID Race Condition and Process Tree Termination Fix

**Date:** 2025-12-30
**Author:** Roo Code Assistant

## Summary

Fixed the PID mismatch and abort button issues in terminal command execution on macOS, with full process tree termination.

## Problems

1. **PID Mismatch in UI**: The displayed PID was the shell's PID, not the actual command's PID
2. **Abort Button Failures**: The abort button failed to terminate commands due to race conditions
3. **Incomplete Termination**: Only killed individual processes, not the entire process tree

## Root Cause Analysis

When using `shell: true` with execa on macOS, the process hierarchy creates a shell wrapper:

```
Shell (PID: 12345) ← subprocess.pid captures this
└── Actual Command (PID: 12346) ← what we need
    └── Subprocesses...
```

The code attempted to resolve this with a 100ms async update using `ps-tree`, but the PID was sent to the UI **before** the async update completed.

## Solution

### 1. Added `killProcessTree()` Function

- Uses `psTree` to discover ALL descendant processes recursively
- Kills processes in bottom-up order (grandchildren → children → shell)
- Uses SIGKILL for forceful termination
- Handles errors gracefully when processes are already dead

### 2. Fixed PID Race Condition

- Added `await this.pidUpdatePromise` before `setActiveStream()`
- UI now receives the actual command PID, not the shell PID

### 3. Stored Shell PID Separately

- Added `shellPid` property to track original shell PID
- Used for process tree killing during abort

### 4. Enhanced `abort()` Method

- Made async to properly await PID resolution
- Calls `killProcessTree(shellPid)` to kill entire process tree
- Falls back to `subprocess.kill()` as backup

## Kill Order for Process Tree

```
Shell → Command → Subprocess → Worker
Kill: Worker → Subprocess → Command → Shell (bottom-up)
```

## Files Changed

- `src/integrations/terminal/ExecaTerminalProcess.ts` - Implementation
- `src/integrations/terminal/__tests__/ExecaTerminalProcess.spec.ts` - Tests (17 tests pass)

## Test Coverage

- PID update completes before `setActiveStream` is called
- Shell PID stored separately from command PID
- `abort()` is async and waits for PID update
- Process tree kill recursively terminates all descendants
- Bottom-up kill order verified
- Graceful handling of `psTree` errors
- Graceful handling of already-dead processes
