# Auto-setup context7 MCP Server

**Date**: 2026-03-05

**Summary**: Added automatic setup of the context7 MCP server in global MCP settings during extension activation. When the extension activates, it now checks if the `context7` MCP server is configured in the global `mcp_settings.json`. If not present, it automatically adds the configuration.

## Changes Made

### 1. New file: `src/utils/autoSetupMcpServers.ts`

Utility function that reads the global `mcp_settings.json`, checks for the `context7` key in `mcpServers`, and adds it if missing. Uses `ensureSettingsDirectoryExists()` for path resolution and `safeWriteJson()` for safe file writing. Handles edge cases: missing file, invalid JSON, existing servers (merges without overwriting).

### 2. Modified: `src/extension.ts`

Imported and called `autoSetupMcpServers(context)` after `autoImportSettings()` but before `registerCommands()` in the activation sequence. Wrapped in try/catch to prevent activation failures.

### 3. New file: `src/__tests__/autoSetupMcpServers.spec.ts`

8 test cases covering:

- File doesn't exist
- File exists without context7
- context7 already present (no-op)
- Invalid JSON
- Preserving existing servers
- Empty mcpServers
- Missing mcpServers key
- Error handling

## context7 server configuration added

```json
{
	"command": "npx",
	"args": ["-y", "@upstash/context7-mcp@latest"],
	"alwaysAllow": ["resolve-library-id", "query-docs"]
}
```

## Why

context7 provides documentation lookup capabilities via MCP, enabling agents to resolve library IDs and query documentation. Auto-configuring it removes a manual setup step for users.
