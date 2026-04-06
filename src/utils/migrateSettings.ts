import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { fileExistsAtPath } from "./fs"
import { GlobalFileNames } from "../shared/globalFileNames"
import { getSettingsDirectoryPath } from "./storage"
import * as yaml from "yaml"
import type { ModeConfig, PromptComponent } from "@roo-code/types"

const deprecatedCustomModesJSONFilename = "custom_modes.json"

const REMOVED_MODE_SLUGS = new Set([
	"using-superpowers",
	"test-driven-development",
	"testing-anti-patterns",
	"verification-before-completion",
	"condition-based-waiting",
	"defense-in-depth",
	"receiving-code-review",
	"requesting-code-review",
	"systematic-debugging",
	"root-cause-tracing",
	"dispatching-parallel-agents",
	"brainstorming",
	"writing-plans",
	"executing-plans",
	"subagent-driven-development",
	"using-git-worktrees",
	"finishing-a-development-branch",
	"writing-skills",
	"testing-skills-with-subagents",
	"sharing-skills",
	"code-reviewer",
	"translate",
	"issue-fixer",
	"pr-fixer",
	"merge-resolver",
	"docs-extractor",
	"issue-investigator",
	"issue-writer",
])

const REMOVED_MODES_MIGRATION_KEY = "removedModesMigrationCompleted"

/**
 * Migrates old settings files to new file names and removes commands from old defaults
 *
 * TODO: Remove this migration code in September 2025 (6 months after implementation)
 */
export async function migrateSettings(
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel,
): Promise<void> {
	// First, migrate commands from old defaults (security fix)
	await migrateDefaultCommands(context, outputChannel)

	// Then, ensure built-in modes always use latest DEFAULT_MODES
	await migrateBuiltinModeOverrides(context, outputChannel)

	// Clean up modes removed from defaults or migrated to .roomodes for existing users
	await migrateRemovedModes(context, outputChannel)

	// Legacy file names that need to be migrated to the new names in GlobalFileNames
	const fileMigrations = [
		// custom_modes.json to custom_modes.yaml is handled separately below
		{ oldName: "cline_custom_modes.json", newName: deprecatedCustomModesJSONFilename },
		{ oldName: "cline_mcp_settings.json", newName: GlobalFileNames.mcpSettings },
	]

	try {
		const settingsDir = await getSettingsDirectoryPath(context.globalStorageUri.fsPath)

		// Check if settings directory exists first
		if (!(await fileExistsAtPath(settingsDir))) {
			outputChannel.appendLine("No settings directory found, no migrations necessary")
			return
		}

		// Process each file migration
		try {
			for (const migration of fileMigrations) {
				const oldPath = path.join(settingsDir, migration.oldName)
				const newPath = path.join(settingsDir, migration.newName)

				// Only migrate if old file exists and new file doesn't exist yet
				// This ensures we don't overwrite any existing new files
				const oldFileExists = await fileExistsAtPath(oldPath)
				const newFileExists = await fileExistsAtPath(newPath)

				if (oldFileExists && !newFileExists) {
					await fs.rename(oldPath, newPath)
					outputChannel.appendLine(`Renamed ${migration.oldName} to ${migration.newName}`)
				} else {
					outputChannel.appendLine(
						`Skipping migration of ${migration.oldName} to ${migration.newName}: ${oldFileExists ? "new file already exists" : "old file not found"}`,
					)
				}
			}

			// Special migration for custom_modes.json to custom_modes.yaml with content transformation
			await migrateCustomModesToYaml(settingsDir, outputChannel)
		} catch (error) {
			outputChannel.appendLine(`Error in file migrations: ${error}`)
		}
	} catch (error) {
		outputChannel.appendLine(`Error migrating settings files: ${error}`)
	}
}

/**
 * Special migration function to convert custom_modes.json to YAML format
 */
async function migrateCustomModesToYaml(settingsDir: string, outputChannel: vscode.OutputChannel): Promise<void> {
	const oldJsonPath = path.join(settingsDir, deprecatedCustomModesJSONFilename)
	const newYamlPath = path.join(settingsDir, GlobalFileNames.customModes)

	// Only proceed if JSON exists and YAML doesn't
	const jsonExists = await fileExistsAtPath(oldJsonPath)
	const yamlExists = await fileExistsAtPath(newYamlPath)

	if (!jsonExists) {
		outputChannel.appendLine("No custom_modes.json found, skipping YAML migration")
		return
	}

	if (yamlExists) {
		outputChannel.appendLine("custom_modes.yaml already exists, skipping migration")
		return
	}

	try {
		// Read JSON content
		const jsonContent = await fs.readFile(oldJsonPath, "utf-8")

		try {
			// Parse JSON to object (using the yaml library just to be safe/consistent)
			const customModesData = yaml.parse(jsonContent)

			// Convert to YAML with no line width limit to prevent line breaks
			const yamlContent = yaml.stringify(customModesData, { lineWidth: 0 })

			// Write YAML file
			await fs.writeFile(newYamlPath, yamlContent, "utf-8")

			// Keeping the old JSON file for backward compatibility
			// This allows users to roll back if needed
			outputChannel.appendLine(
				"Successfully migrated custom_modes.json to YAML format (original JSON file preserved for rollback purposes)",
			)
		} catch (parseError) {
			// Handle corrupt JSON file
			outputChannel.appendLine(
				`Error parsing custom_modes.json: ${parseError}. File might be corrupted. Skipping migration.`,
			)
		}
	} catch (fileError) {
		outputChannel.appendLine(`Error reading custom_modes.json: ${fileError}. Skipping migration.`)
	}
}

/**
 * Removes commands from old defaults that could execute arbitrary code
 * This addresses the security vulnerability where npm install/test can run malicious postinstall scripts
 */
async function migrateDefaultCommands(
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel,
): Promise<void> {
	try {
		// Check if this migration has already been run
		const migrationKey = "defaultCommandsMigrationCompleted"
		if (context.globalState.get(migrationKey)) {
			outputChannel.appendLine("[Default Commands Migration] Migration already completed, skipping")
			return
		}

		const allowedCommands = context.globalState.get<string[]>("allowedCommands")

		if (!allowedCommands || !Array.isArray(allowedCommands)) {
			// Mark migration as complete even if no commands to migrate
			await context.globalState.update(migrationKey, true)
			outputChannel.appendLine("No allowed commands found in global state, marking migration as complete")
			return
		}

		// Only migrate the specific commands that were removed from the defaults
		const oldDefaultCommands = ["npm install", "npm test", "tsc"]

		// Filter out old default commands (case-insensitive exact match only)
		const originalLength = allowedCommands.length
		const filteredCommands = allowedCommands.filter((cmd) => {
			const cmdLower = cmd.toLowerCase().trim()
			return !oldDefaultCommands.some((oldDefault) => cmdLower === oldDefault.toLowerCase())
		})

		if (filteredCommands.length < originalLength) {
			const removedCount = originalLength - filteredCommands.length
			await context.globalState.update("allowedCommands", filteredCommands)

			outputChannel.appendLine(
				`[Default Commands Migration] Removed ${removedCount} command(s) from old defaults to prevent arbitrary code execution vulnerability`,
			)
		} else {
			outputChannel.appendLine("[Default Commands Migration] No old default commands found in allowed list")
		}

		// Mark migration as complete
		await context.globalState.update(migrationKey, true)
		outputChannel.appendLine("[Default Commands Migration] Migration marked as complete")
	} catch (error) {
		outputChannel.appendLine(`[Default Commands Migration] Error migrating default commands: ${error}`)
	}
}

/**
 * Removes modes that are no longer shipped in DEFAULT_MODES or are now provided via .roomodes.
 * This ensures legacy utility modes and SuperRoo skill modes do not persist in globalState.
 */
async function migrateRemovedModes(
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel,
): Promise<void> {
	try {
		if (context.globalState.get(REMOVED_MODES_MIGRATION_KEY)) {
			outputChannel.appendLine("[Removed Modes Migration] Migration already completed, skipping")
			return
		}

		// Remove removed modes from customModes
		const customModes = context.globalState.get<ModeConfig[]>("customModes") || []
		const filteredModes = customModes.filter((mode) => !REMOVED_MODE_SLUGS.has(mode.slug))

		if (filteredModes.length < customModes.length) {
			const removedSlugs = customModes
				.filter((mode) => REMOVED_MODE_SLUGS.has(mode.slug))
				.map((mode) => mode.slug)
			await context.globalState.update("customModes", filteredModes)
			outputChannel.appendLine(
				`[Removed Modes Migration] Removed ${removedSlugs.length} mode(s): ${removedSlugs.join(", ")}`,
			)
		}

		// Remove removed mode prompts from customModePrompts
		const customModePrompts = context.globalState.get<Record<string, PromptComponent>>("customModePrompts") || {}
		const filteredPrompts: Record<string, PromptComponent> = {}
		const removedPromptSlugs: string[] = []

		for (const [slug, prompt] of Object.entries(customModePrompts)) {
			if (REMOVED_MODE_SLUGS.has(slug)) {
				removedPromptSlugs.push(slug)
			} else {
				filteredPrompts[slug] = prompt
			}
		}

		if (removedPromptSlugs.length > 0) {
			await context.globalState.update("customModePrompts", filteredPrompts)
			outputChannel.appendLine(
				`[Removed Modes Migration] Removed ${removedPromptSlugs.length} prompt(s): ${removedPromptSlugs.join(", ")}`,
			)
		}

		// Mark migration as complete
		await context.globalState.update(REMOVED_MODES_MIGRATION_KEY, true)
		outputChannel.appendLine("[Removed Modes Migration] Migration marked as complete")
	} catch (error) {
		outputChannel.appendLine(`[Removed Modes Migration] Error: ${error}`)
	}
}

/**
 * Ensures built-in modes always use the latest DEFAULT_MODES values
 * This migration runs on every extension activation to apply updates
 * to built-in modes, while preserving fully custom modes.
 */
async function migrateBuiltinModeOverrides(
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel,
): Promise<void> {
	try {
		// Built-in mode slugs that should always be overridden
		const BUILTIN_MODE_SLUGS = [
			"architect",
			"code",
			"ask",
			"debug",
			"orchestrator",
			"rooignore-generator",
			"rules-generator",
		] as const

		// Get current custom modes from globalState
		const customModes = context.globalState.get<ModeConfig[]>("customModes") || []

		// Get current custom mode prompts from globalState
		const customModePrompts = context.globalState.get<Record<string, PromptComponent>>("customModePrompts") || {}

		// If there are no custom modes or custom mode prompts, nothing to do
		if (customModes.length === 0 && Object.keys(customModePrompts).length === 0) {
			outputChannel.appendLine("[Built-in Modes Migration] No custom modes or prompts found, skipping")
			return
		}

		let modesRemoved = false
		let promptsRemoved: string[] = []

		// 1. Remove custom modes that override built-in modes
		const filteredCustomModes = customModes.filter((mode) => {
			const isBuiltinMode = BUILTIN_MODE_SLUGS.includes(mode.slug as any)
			if (isBuiltinMode) {
				modesRemoved = true
				outputChannel.appendLine(
					`[Built-in Modes Migration] Removing custom override for built-in mode: ${mode.slug}`,
				)
				return false // Remove built-in mode overrides
			}
			return true // Keep fully custom modes
		})

		// 2. Remove custom mode prompts for built-in modes
		const filteredCustomModePrompts: Record<string, PromptComponent> = {}
		for (const [slug, prompt] of Object.entries(customModePrompts)) {
			const isBuiltinMode = BUILTIN_MODE_SLUGS.includes(slug as any)
			if (isBuiltinMode) {
				promptsRemoved.push(slug)
				outputChannel.appendLine(
					`[Built-in Modes Migration] Removing custom prompt override for built-in mode: ${slug}`,
				)
				// Don't copy to filtered object
			} else {
				filteredCustomModePrompts[slug] = prompt
			}
		}

		// 3. Update globalState if any changes were made
		if (modesRemoved) {
			await context.globalState.update("customModes", filteredCustomModes)
			outputChannel.appendLine(`[Built-in Modes Migration] Updated customModes in globalState`)
		}

		if (promptsRemoved.length > 0) {
			await context.globalState.update("customModePrompts", filteredCustomModePrompts)
			outputChannel.appendLine(
				`[Built-in Modes Migration] Removed prompt overrides for: ${promptsRemoved.join(", ")}`,
			)
		}

		if (!modesRemoved && promptsRemoved.length === 0) {
			outputChannel.appendLine("[Built-in Modes Migration] No built-in mode overrides found, no changes needed")
		} else {
			outputChannel.appendLine(
				`[Built-in Modes Migration] Completed: removed ${modesRemoved ? "custom mode(s) and " : ""}${promptsRemoved.length} prompt override(s)`,
			)
		}
	} catch (error) {
		outputChannel.appendLine(`[Built-in Modes Migration] Error: ${error}`)
	}
}
