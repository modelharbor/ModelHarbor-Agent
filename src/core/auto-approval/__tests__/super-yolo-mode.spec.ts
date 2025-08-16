import { checkAutoApproval } from "../index"

describe("Super YOLO Mode", () => {
	describe("when superYoloMode is enabled", () => {
		it("should auto-approve command execution", async () => {
			const result = await checkAutoApproval({
				state: {
					autoApprovalEnabled: true,
					superYoloMode: true,
					alwaysAllowReadOnly: false,
					alwaysAllowWrite: false,
					alwaysAllowExecute: false,
					alwaysAllowBrowser: false,
					alwaysAllowMcp: false,
					alwaysAllowModeSwitch: false,
					alwaysAllowSubtasks: false,
										alwaysAllowFollowupQuestions: false,
				},
				ask: "command",
				text: "rm -rf /some/path",
			})

			expect(result.decision).toBe("approve")
		})

		it("should auto-approve dangerous commands like rm -rf", async () => {
			const result = await checkAutoApproval({
				state: {
					autoApprovalEnabled: true,
					superYoloMode: true,
					alwaysAllowReadOnly: false,
					alwaysAllowWrite: false,
					alwaysAllowExecute: false,
					alwaysAllowBrowser: false,
					alwaysAllowMcp: false,
					alwaysAllowModeSwitch: false,
					alwaysAllowSubtasks: false,
										alwaysAllowFollowupQuestions: false,
				},
				ask: "command",
				text: "rm -rf / --no-preserve-root",
			})

			expect(result.decision).toBe("approve")
		})

		it("should auto-approve commands even without alwaysAllowExecute", async () => {
			const result = await checkAutoApproval({
				state: {
					autoApprovalEnabled: true,
					superYoloMode: true,
					alwaysAllowReadOnly: false,
					alwaysAllowWrite: false,
					alwaysAllowExecute: false,
					alwaysAllowBrowser: false,
					alwaysAllowMcp: false,
					alwaysAllowModeSwitch: false,
					alwaysAllowSubtasks: false,
										alwaysAllowFollowupQuestions: false,
				},
				ask: "command",
				text: "git push --force",
			})

			expect(result.decision).toBe("approve")
		})

		it("should auto-approve browser actions", async () => {
			const result = await checkAutoApproval({
				state: {
					autoApprovalEnabled: true,
					superYoloMode: true,
					alwaysAllowReadOnly: false,
					alwaysAllowWrite: false,
					alwaysAllowExecute: false,
					alwaysAllowBrowser: false,
					alwaysAllowMcp: false,
					alwaysAllowModeSwitch: false,
					alwaysAllowSubtasks: false,
										alwaysAllowFollowupQuestions: false,
				},
				ask: "browser_action_launch",
			})

			expect(result.decision).toBe("approve")
		})

		it("should auto-approve tool operations", async () => {
			const result = await checkAutoApproval({
				state: {
					autoApprovalEnabled: true,
					superYoloMode: true,
					alwaysAllowReadOnly: false,
					alwaysAllowWrite: false,
					alwaysAllowExecute: false,
					alwaysAllowBrowser: false,
					alwaysAllowMcp: false,
					alwaysAllowModeSwitch: false,
					alwaysAllowSubtasks: false,
										alwaysAllowFollowupQuestions: false,
				},
				ask: "tool",
				text: JSON.stringify({
					tool: "editedExistingFile",
					path: "/etc/passwd",
					diff: "some content",
				}),
			})

			expect(result.decision).toBe("approve")
		})

		it("should auto-approve MCP server usage", async () => {
			const result = await checkAutoApproval({
				state: {
					autoApprovalEnabled: true,
					superYoloMode: true,
					alwaysAllowReadOnly: false,
					alwaysAllowWrite: false,
					alwaysAllowExecute: false,
					alwaysAllowBrowser: false,
					alwaysAllowMcp: false,
					alwaysAllowModeSwitch: false,
					alwaysAllowSubtasks: false,
										alwaysAllowFollowupQuestions: false,
				},
				ask: "use_mcp_server",
				text: JSON.stringify({
					type: "use_mcp_tool",
					serverName: "test-server",
					toolName: "dangerous-tool",
				}),
			})

			expect(result.decision).toBe("approve")
		})
	})

	describe("when superYoloMode is disabled", () => {
		it("should not auto-approve command without proper settings", async () => {
			const result = await checkAutoApproval({
				state: {
					autoApprovalEnabled: true,
					superYoloMode: false,
					alwaysAllowReadOnly: false,
					alwaysAllowWrite: false,
					alwaysAllowExecute: false,
					alwaysAllowBrowser: false,
					alwaysAllowMcp: false,
					alwaysAllowModeSwitch: false,
					alwaysAllowSubtasks: false,
										alwaysAllowFollowupQuestions: false,
				},
				ask: "command",
				text: "git status",
			})

			expect(result.decision).toBe("ask")
		})

		it("should respect normal auto-approval settings for read-only", async () => {
			const result = await checkAutoApproval({
				state: {
					autoApprovalEnabled: true,
					superYoloMode: false,
					alwaysAllowReadOnly: true,
					alwaysAllowWrite: false,
					alwaysAllowExecute: false,
					alwaysAllowBrowser: false,
					alwaysAllowMcp: false,
					alwaysAllowModeSwitch: false,
					alwaysAllowSubtasks: false,
										alwaysAllowFollowupQuestions: false,
				},
				ask: "tool",
				text: JSON.stringify({
					tool: "readFile",
					path: "/test/file.txt",
				}),
			})

			expect(result.decision).toBe("approve")
		})

		it("should deny dangerous commands without allowedCommands", async () => {
			const result = await checkAutoApproval({
				state: {
					autoApprovalEnabled: true,
					superYoloMode: false,
					alwaysAllowReadOnly: false,
					alwaysAllowWrite: false,
					alwaysAllowExecute: true,
					alwaysAllowBrowser: false,
					alwaysAllowMcp: false,
					alwaysAllowModeSwitch: false,
					alwaysAllowSubtasks: false,
										alwaysAllowFollowupQuestions: false,
					allowedCommands: ["git"],
				},
				ask: "command",
				text: "rm -rf /",
			})

			// Should ask because rm is not in allowed commands
			expect(result.decision).toBe("ask")
		})
	})

	describe("superYoloMode with autoApprovalEnabled=false", () => {
		it("should NOT auto-approve when autoApprovalEnabled is false", async () => {
			// superYoloMode requires autoApprovalEnabled to be true
			const result = await checkAutoApproval({
				state: {
					autoApprovalEnabled: false,
					superYoloMode: true,
					alwaysAllowReadOnly: false,
					alwaysAllowWrite: false,
					alwaysAllowExecute: false,
					alwaysAllowBrowser: false,
					alwaysAllowMcp: false,
					alwaysAllowModeSwitch: false,
					alwaysAllowSubtasks: false,
										alwaysAllowFollowupQuestions: false,
				},
				ask: "command",
				text: "echo hello",
			})

			// autoApprovalEnabled must be true for superYoloMode to work
			expect(result.decision).toBe("ask")
		})
	})

	describe("superYoloMode undefined/null handling", () => {
		it("should treat undefined superYoloMode as disabled", async () => {
			const result = await checkAutoApproval({
				state: {
					autoApprovalEnabled: true,
					// superYoloMode is undefined
					alwaysAllowReadOnly: false,
					alwaysAllowWrite: false,
					alwaysAllowExecute: false,
					alwaysAllowBrowser: false,
					alwaysAllowMcp: false,
					alwaysAllowModeSwitch: false,
					alwaysAllowSubtasks: false,
										alwaysAllowFollowupQuestions: false,
				},
				ask: "command",
				text: "echo test",
			})

			expect(result.decision).toBe("ask")
		})
	})
})
