import { addCustomInstructions, loadRuleFiles, customIntructions } from "../sections/custom-instructions"
import { getCapabilitiesSection } from "../sections/capabilities"
import type { DiffStrategy, DiffResult, DiffItem } from "../../../shared/tools"

describe("addCustomInstructions", () => {
	it("adds vscode language to custom instructions", async () => {
		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/test/path",
			"test-mode",
			{ language: "th" },
		)

		expect(result).toContain("Language Preference:")
		expect(result).toContain('You should always speak and think in the "ภาษาไทย" (th) language')
	})

	it("works without vscode language", async () => {
		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/test/path",
			"test-mode",
		)

		expect(result).not.toContain("Language Preference:")
		expect(result).not.toContain("You should always speak and think in")
	})
})

describe("loadRuleFiles", () => {
	it("returns customIntructions when no rule files are found", async () => {
		// Use a temporary directory that definitely doesn't have any rule files
		const nonExistentPath = "/tmp/test-no-rules-" + Date.now()

		const result = await loadRuleFiles(nonExistentPath)

		// Should return customIntructions instead of empty string
		expect(result).toBe(customIntructions)
		expect(result).toContain("# Collaboration Rules")
		expect(result).toContain("## Core Behavior")
	})
})

describe("getCapabilitiesSection", () => {
	const cwd = "/test/path"
	const mcpHub = undefined
	const mockDiffStrategy: DiffStrategy = {
		getName: () => "MockStrategy",
		getToolDescription: () => "apply_diff tool description",
		async applyDiff(_originalContent: string, _diffContents: string | DiffItem[]): Promise<DiffResult> {
			return { success: true, content: "mock result" }
		},
	}

	it("includes apply_diff in capabilities when diffStrategy is provided", () => {
		const result = getCapabilitiesSection(cwd, false, "code", undefined, undefined, mcpHub, mockDiffStrategy)

		expect(result).toContain("apply_diff")
		expect(result).toContain("write_to_file")
		expect(result).toContain("insert_content")
	})

	it("excludes apply_diff from capabilities when diffStrategy is undefined", () => {
		const result = getCapabilitiesSection(cwd, false, "code", undefined, undefined, mcpHub, undefined)

		expect(result).not.toContain("apply_diff")
		expect(result).toContain("write_to_file")
		expect(result).toContain("insert_content")
	})
})
