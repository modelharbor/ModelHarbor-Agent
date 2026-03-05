import * as fs from "fs/promises"
import * as path from "path"
import type { ExtensionContext } from "vscode"

import { GlobalFileNames } from "../shared/globalFileNames"
import { ensureSettingsDirectoryExists } from "./globalContext"
import { safeWriteJson } from "./safeWriteJson"

const CONTEXT7_CONFIG = {
	command: "npx",
	args: ["-y", "@upstash/context7-mcp@latest"],
	alwaysAllow: ["resolve-library-id", "query-docs"],
}

export async function autoSetupMcpServers(context: ExtensionContext): Promise<void> {
	const settingsDir = await ensureSettingsDirectoryExists(context)
	const mcpSettingsPath = path.join(settingsDir, GlobalFileNames.mcpSettings)

	let existingData: { mcpServers: Record<string, unknown> }

	try {
		const content = await fs.readFile(mcpSettingsPath, "utf-8")
		const parsed = JSON.parse(content)

		if (parsed && typeof parsed === "object") {
			existingData = parsed as { mcpServers: Record<string, unknown> }
		} else {
			existingData = { mcpServers: {} }
		}
	} catch (error: any) {
		if (error.code === "ENOENT") {
			// File doesn't exist yet
			existingData = { mcpServers: {} }
		} else if (error instanceof SyntaxError) {
			// Invalid JSON - start fresh
			existingData = { mcpServers: {} }
		} else {
			// Unexpected error - re-throw
			throw error
		}
	}

	if (!existingData.mcpServers) {
		existingData.mcpServers = {}
	}

	if (existingData.mcpServers["context7"]) {
		// Already configured, nothing to do
		return
	}

	existingData.mcpServers["context7"] = CONTEXT7_CONFIG

	await safeWriteJson(mcpSettingsPath, existingData)

	console.log("Auto-setup: Added context7 MCP server to global settings")
}
