# 2025-12-28 - Super YOLO Mode Feature

## Overview

Super YOLO mode is a new auto-approval feature that allows maximum automation with the following capabilities:

- Auto-approves ALL commands unconditionally (bypasses allowed/denied command lists)
- Auto-approves browser actions, MCP server usage, and tool operations
- Includes a 5-minute stuck detection timeout - if the task waits for user input for 5 minutes, it automatically continues
- Includes a 5-minute command execution timeout - if a command takes longer than 5 minutes, it is terminated and the task continues

## Settings Added

1. `superYoloMode` (boolean) - Master toggle for Super YOLO mode
2. `superYoloStuckTimeoutMs` (number, default: 300000) - Timeout in milliseconds for stuck detection (5 minutes)

## Files Modified

1. **`packages/types/src/global-settings.ts`** - Added new settings to schema
2. **`src/core/auto-approval/index.ts`** - Added Super YOLO mode logic to [`checkAutoApproval()`](src/core/auto-approval/index.ts:0)
3. **`src/core/task/Task.ts`** - Added stuck detection timer implementation
4. **`webview-ui/src/components/settings/AutoApproveSettings.tsx`** - Added UI toggle with warning styling
5. **`src/core/tools/ExecuteCommandTool.ts`** - Added Super YOLO command execution timeout logic

## Tests Added

1. **`src/core/auto-approval/__tests__/super-yolo-mode.spec.ts`** - 16 tests for backend logic (11 original + 5 for `getSuperYoloCommandTimeout`)
2. **`webview-ui/src/components/settings/__tests__/SuperYoloMode.spec.tsx`** - 5 tests for UI component
3. **`src/core/tools/__tests__/executeCommandTool.spec.ts`** - 5 additional tests for command execution timeout

## Usage

1. Enable "Auto-approve" in the settings
2. Check the "Super YOLO Mode" checkbox (shown with amber warning styling)
3. The mode will auto-approve all commands and operations
4. If the task gets stuck waiting for input, it will automatically continue after 5 minutes

## Warning

⚠️ **Super YOLO mode bypasses all safety checks for command execution. Use with caution!**

## Technical Details

### Auto-Approval Logic

When Super YOLO mode is enabled, the [`checkAutoApproval()`](src/core/auto-approval/index.ts:0) function returns `true` for all operations, bypassing the normal allowed/denied command list checks.

### Stuck Detection (User Input Timeout)

The stuck detection timer is implemented in [`Task.ts`](src/core/task/Task.ts:0). When enabled:

- A timer starts when the task begins waiting for user input
- If the timeout elapses without user interaction, the task automatically continues
- This prevents tasks from getting stuck indefinitely

### Command Execution Timeout

When Super YOLO mode is enabled, commands have a maximum execution time of 5 minutes (300000ms). If a command takes longer than this, it will be terminated and the task will continue.

**How it works:**

- Uses the same `superYoloStuckTimeoutMs` setting (default: 5 minutes)
- If the user has configured a shorter `commandExecutionTimeout`, that takes precedence
- Commands in `commandTimeoutAllowlist` bypass all timeouts (including Super YOLO timeout)
- When a command times out, it is aborted and an error message is returned, but the task continues

**Implementation:**

- The [`getSuperYoloCommandTimeout()`](src/core/auto-approval/index.ts:0) function calculates the effective timeout
- Returns `undefined` if Super YOLO mode is disabled or if an allowlisted command is being executed
- Returns the minimum of `superYoloStuckTimeoutMs` and `commandExecutionTimeout` (if configured)
- The timeout is applied in [`ExecuteCommandTool.ts`](src/core/tools/ExecuteCommandTool.ts:0) during command execution

### UI Implementation

The AutoApproveSettings component includes:

- A checkbox for enabling Super YOLO mode
- Amber warning styling to indicate the elevated risk level
- The checkbox is only enabled when "Auto-approve" is already enabled

## Testing

The implementation includes comprehensive test coverage:

### Backend Tests (`super-yolo-mode.spec.ts`)

- Tests for Super YOLO mode enabling/disabling
- Tests for auto-approval behavior with Super YOLO mode
- Tests for stuck detection timeout functionality
- Tests for `getSuperYoloCommandTimeout` function:
    - Returns `undefined` when Super YOLO mode is disabled
    - Returns default timeout (5 minutes) when enabled
    - Returns custom `superYoloStuckTimeoutMs` when configured
    - Returns smaller `commandExecutionTimeout` when it's less than Super YOLO timeout
    - Returns `undefined` for commands in `commandTimeoutAllowlist`
- Edge cases and error handling

### Command Execution Tests (`executeCommandTool.spec.ts`)

- Tests for Super YOLO command timeout integration
- Tests for timeout calculation and application
- Tests for allowlist bypass behavior
- Tests for timeout precedence logic
- Tests for graceful termination on timeout

### UI Tests (`SuperYoloMode.spec.tsx`)

- Tests for checkbox rendering and interaction
- Tests for warning styling
- Tests for conditional enablement
- Integration with parent AutoApproveSettings component

## Migration Notes

This feature is backward compatible. Existing configurations will work without modification, and Super YOLO mode defaults to disabled.
